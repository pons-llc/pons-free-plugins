(function (global, kintone) {
  'use strict';

  const NS = global.TimeBandAggregator;
  const PLUGIN_ID = kintone.$PLUGIN_ID;

  const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  // 作成された2フィールド(ドロップダウン・数値)はレコード画面では常に非表示にする
  // (idea.md「機能概要」。集計用の自動算出フィールドであり、入力させる項目ではないため)。
  const hideCreatedFields = () => {
    config.rows.forEach((row) => {
      if (row.dropdownFieldCode) {
        kintone.app.record.setFieldShown(row.dropdownFieldCode, false);
      }
      if (row.numberFieldCode) {
        kintone.app.record.setFieldShown(row.numberFieldCode, false);
      }
    });
  };

  // 変換元フィールドの値・型・区切り幅・タイムゾーンから時間帯を算出し、
  // ドロップダウン・数値フィールドへ反映する。値が空・不正な場合は出力先を空にする。
  const applyRowToRecord = (record, row, timeZone) => {
    const sourceField = record[row.sourceFieldCode];
    const result = NS.TimeBand.computeTimeBand({
      value: sourceField ? sourceField.value : null,
      fieldType: sourceField ? sourceField.type : undefined,
      bandWidthMinutes: row.bandWidthMinutes,
      timeZone,
    });
    const dropdownField = record[row.dropdownFieldCode];
    if (dropdownField) {
      dropdownField.value = result ? result.label : '';
    }
    const numberField = record[row.numberFieldCode];
    if (numberField) {
      numberField.value = result ? String(result.number) : '';
    }
  };

  kintone.events.on(
    [
      'app.record.create.show',
      'app.record.edit.show',
      'app.record.detail.show',
    ],
    (event) => {
      hideCreatedFields();
      return event;
    },
  );

  // トリガー設定によらず、レコード保存の直前に必ずすべての設定行を再計算する
  // (user-test.mdフィードバック「レコード保存しても値が入らない」反映)。「フィールド変更時」を
  // 選んでいても、変換元フィールドの値が他プラグイン・レコード取込・複製等の`kintone.app.record.set()`
  // 経由で入った場合はchangeイベントが発火しない(kintone公式の既知の制約、
  // e2e/config-save-and-record.e2e.test.js参照)ため、保存時の再計算だけがフィールド変更時の
  // 「取りこぼし」を防ぐ唯一の手段になる。「フィールド変更時」設定は、保存前に画面上でリアルタイムに
  // 値を確認できるようにする追加のプレビュー用途として残す。
  kintone.events.on(
    ['app.record.create.submit', 'app.record.edit.submit'],
    (event) => {
      // kintone.getLoginUser()は同期API(Promiseを返さない)。
      const timeZone = kintone.getLoginUser().timezone;
      config.rows.forEach((row) =>
        applyRowToRecord(event.record, row, timeZone),
      );
      return event;
    },
  );

  // 発動タイミングが「フィールド変更時」の場合、設定行ごとに変換元フィールドのchangeイベントを
  // 個別に登録し、保存前の画面上でも値をリアルタイムに反映する(config-validationで変換元
  // フィールドの重複は禁止済み)。
  if (config.trigger === 'CHANGE') {
    config.rows.forEach((row) => {
      if (!row.sourceFieldCode) {
        return;
      }
      kintone.events.on(
        [
          `app.record.create.change.${row.sourceFieldCode}`,
          `app.record.edit.change.${row.sourceFieldCode}`,
        ],
        (event) => {
          const timeZone = kintone.getLoginUser().timezone;
          applyRowToRecord(event.record, row, timeZone);
          return event;
        },
      );
    });
  }

  // 作成された2フィールドは自動算出専用のため、レコード一覧のインライン編集では直接編集させない。
  kintone.events.on('app.record.index.edit.show', (event) => {
    config.rows.forEach((row) => {
      const dropdownField = event.record[row.dropdownFieldCode];
      if (dropdownField) {
        dropdownField.disabled = true;
      }
      const numberField = event.record[row.numberFieldCode];
      if (numberField) {
        numberField.disabled = true;
      }
    });
    return event;
  });

  // 一覧画面: 対象グループのメンバーにのみ一括実行ボタンを表示する。
  kintone.events.on('app.record.index.show', (event) => {
    NS.BulkRunner.renderButtonIfAuthorized(
      kintone.app.getHeaderMenuSpaceElement(),
      config,
      kintone.app.getId(),
    );
    return event;
  });
})(window, kintone);
