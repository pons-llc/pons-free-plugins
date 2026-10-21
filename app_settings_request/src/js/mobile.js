((PLUGIN_ID) => {
  'use strict';

  const NS = window.AppSettingsRequest;
  const { CODES } = NS.FieldDefs;
  const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  // 依頼の入力UIはPCのみ。モバイルで変更内容なしのレコードが保存されないようにする。
  kintone.events.on(
    ['mobile.app.record.create.submit', 'mobile.app.record.edit.submit'],
    (event) => {
      const field = event.record[CODES.changeJson];
      if (field && !NS.ChangeRequest.parseChange(field.value).ok) {
        event.error =
          '変更内容が入力されていません。依頼の作成・編集はPC版の画面から行ってください。';
      }
      return event;
    },
  );

  kintone.events.on(
    [
      'mobile.app.record.create.show',
      'mobile.app.record.edit.show',
      'mobile.app.record.detail.show',
    ],
    (event) => {
      kintone.mobile.app.record.setFieldShown(CODES.changeJson, false);
      return event;
    },
  );

  kintone.events.on(
    'mobile.app.record.detail.process.proceed',
    async (event) => {
      if (!NS.ProcessSetup.isCompletingAction(event, config.completeStatus)) {
        return event;
      }
      const handled = await NS.handleCompletingAction({
        event,
        ownAppId: kintone.mobile.app.getId(),
        // モバイルはダイアログAPIが使えないため確認ボトムシート(本文は文字列のみ)で確認する。
        confirm: async (change) =>
          (await kintone.mobile.showConfirmBottomSheet({
            title: '変更内容の確認',
            body: NS.ChangeRequest.confirmationText(change),
            okButtonText: '反映する',
            showCancelButton: true,
            cancelButtonText: 'キャンセル',
          })) === 'OK',
        showLoading: (visible) =>
          kintone.mobile.showLoading(visible ? 'VISIBLE' : 'HIDDEN'),
      });
      if (handled.cancelled) {
        return false;
      }
      if (!handled.ok) {
        // モバイルでは「画面上部にエラーを表示する」が使えない(PCのみ)ため、alertしてfalseでキャンセルする。
        alert(handled.error);
        return false;
      }
      return handled.event;
    },
  );
})(kintone.$PLUGIN_ID);
