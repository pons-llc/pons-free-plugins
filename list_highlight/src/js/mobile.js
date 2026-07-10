(function (global, kintone) {
  'use strict';

  const NS = global.ListHighlight;
  const PLUGIN_ID = kintone.$PLUGIN_ID;

  const UNSUPPORTED_COLUMN_TYPES = [
    'REFERENCE_TABLE',
    'GROUP',
    'HR',
    'LABEL',
    'SPACER',
    'SUBTABLE',
  ];

  const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  let columnCodesPromise = null;
  const getColumnCodes = () => {
    if (!columnCodesPromise) {
      columnCodesPromise = kintone.app
        .getFormFields()
        .then((formFields) =>
          Object.keys(formFields).filter(
            (code) => !UNSUPPORTED_COLUMN_TYPES.includes(formFields[code].type),
          ),
        );
    }
    return columnCodesPromise;
  };

  // desktop.js と同じロジック(モバイルAPIは kintone.mobile.app 名前空間になる点のみ異なる)。
  kintone.events.on('mobile.app.record.index.show', async (event) => {
    if (event.viewType !== 'list') {
      return event;
    }

    const columnCodes = await getColumnCodes();
    const body = NS.StyleBuilder.buildStyleConfig(
      event.records,
      config.rules,
      columnCodes,
    );
    await kintone.mobile.app.setRecordListStyle({ body });

    return event;
  });
})(window, kintone);
