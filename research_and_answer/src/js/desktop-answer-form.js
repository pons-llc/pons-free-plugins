(function (global, kintone) {
  'use strict';

  // 回答アプリ側のレコード画面: ルックアップで取り込んだフォーム定義JSONから仮想フォームを描画し、
  // 保存時に入力値を予備フィールドへ書き戻し・必須チェックを行う。

  const NS = global.ResearchAnswer;
  const PLUGIN_ID = kintone.$PLUGIN_ID;
  const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  if (config.role !== 'answer') {
    return;
  }

  const FormModel = NS.FormModel;
  const FormUI = NS.FormUI;
  const AnalysisCore = NS.AnalysisCore;

  // 予備フィールドと管理用フィールドは標準フォーム上では非表示にする
  // (kintone.app.record.setFieldShown(): フィールドコード指定、存在しないコードはエラーに
  // ならず何も起きない仕様を確認済み)。
  const hideBackingFields = (record) => {
    Object.keys(record).forEach((code) => {
      if (AnalysisCore.SPARE_FIELD_PATTERN.test(code) || code === 'json') {
        kintone.app.record.setFieldShown(code, false);
      }
    });
  };

  const renderVirtualForm = (event) => {
    const record = event.record;
    if (!record.json || !record.json.value) {
      return;
    }
    const spaceField = kintone.app.record.getSpaceElement(config.formSpaceId);
    if (!spaceField) {
      return;
    }
    const setting = FormModel.parseSettingJson(record.json.value);
    if (setting.layout.length === 0) {
      return;
    }
    const isDisabled = event.type === 'app.record.detail.show';
    FormUI.renderForm(
      spaceField,
      setting.layout,
      setting.condition,
      (fieldCode) => (record[fieldCode] ? record[fieldCode].value : ''),
      isDisabled,
    );
  };

  kintone.events.on(
    [
      'app.record.detail.show',
      'app.record.create.show',
      'app.record.edit.show',
    ],
    (event) => {
      hideBackingFields(event.record);
      renderVirtualForm(event);
      // 追加・編集画面ではルックアップの自動取得を促す(照会レコード選択時にJSONが入る)
      if (event.type !== 'app.record.detail.show' && event.record.lookup) {
        event.record.lookup.lookup = true;
      }
      return event;
    },
  );

  // ルックアップ取得などでフォーム定義JSONが変わったら描画し直す
  kintone.events.on(
    ['app.record.create.change.json', 'app.record.edit.change.json'],
    (event) => {
      renderVirtualForm(event);
      return event;
    },
  );

  // --- 保存時: 仮想フォームの値を実フィールドへ書き戻し、必須チェック ---
  kintone.events.on(
    ['app.record.create.submit', 'app.record.edit.submit'],
    (event) => {
      const record = event.record;
      if (!record.json || !record.json.value) {
        return event;
      }
      const spaceField = kintone.app.record.getSpaceElement(config.formSpaceId);
      if (!spaceField) {
        return event;
      }
      const setting = FormModel.parseSettingJson(record.json.value);

      setting.layout.forEach((item) => {
        const fieldData = item.value;
        const fieldCode =
          fieldData.insert_column && fieldData.insert_column.value;
        const type = fieldData.field_type && fieldData.field_type.value;
        if (!fieldCode || !record[fieldCode]) {
          return;
        }
        const value = FormUI.getValueFromDOM(fieldCode, type);
        if (type === '日時') {
          record[fieldCode].value = FormModel.fromDatetimeLocalToISO(value);
        } else if (Array.isArray(value)) {
          // チェックボックスの値は文字列フィールドにカンマ区切りで格納する
          // (読み出し側・分析側のparseCommaSeparatedと対になる)
          record[fieldCode].value = value.join(',');
        } else {
          record[fieldCode].value = value;
        }
      });

      if (FormUI.validateAndMarkErrors(spaceField, setting.layout)) {
        event.error = '入力エラーがあります。確認してください。';
      }
      return event;
    },
  );
})(window, kintone);
