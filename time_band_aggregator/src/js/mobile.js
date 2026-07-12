(function (global, kintone) {
  'use strict';

  const NS = global.TimeBandAggregator;
  const PLUGIN_ID = kintone.$PLUGIN_ID;

  const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  // desktop.jsと同じロジック(モバイルでは一括実行ボタンは提供しない。idea.md参照)。
  const hideCreatedFields = () => {
    config.rows.forEach((row) => {
      if (row.dropdownFieldCode) {
        kintone.mobile.app.record.setFieldShown(row.dropdownFieldCode, false);
      }
      if (row.numberFieldCode) {
        kintone.mobile.app.record.setFieldShown(row.numberFieldCode, false);
      }
    });
  };

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
      'mobile.app.record.create.show',
      'mobile.app.record.edit.show',
      'mobile.app.record.detail.show',
    ],
    (event) => {
      hideCreatedFields();
      return event;
    },
  );

  if (config.trigger === 'SUBMIT') {
    kintone.events.on(
      ['mobile.app.record.create.submit', 'mobile.app.record.edit.submit'],
      (event) => {
        const timeZone = kintone.getLoginUser().timezone;
        config.rows.forEach((row) =>
          applyRowToRecord(event.record, row, timeZone),
        );
        return event;
      },
    );
  }

  if (config.trigger === 'CHANGE') {
    config.rows.forEach((row) => {
      if (!row.sourceFieldCode) {
        return;
      }
      kintone.events.on(
        [
          `mobile.app.record.create.change.${row.sourceFieldCode}`,
          `mobile.app.record.edit.change.${row.sourceFieldCode}`,
        ],
        (event) => {
          const timeZone = kintone.getLoginUser().timezone;
          applyRowToRecord(event.record, row, timeZone);
          return event;
        },
      );
    });
  }

  // モバイルにはレコード一覧のインライン編集・一括実行に相当する画面が無いため、それらの処理はない。
})(window, kintone);
