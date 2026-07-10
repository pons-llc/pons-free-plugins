(function (global, kintone) {
  'use strict';

  const NS = global.ListHighlight;
  const PLUGIN_ID = kintone.$PLUGIN_ID;

  // kintone.app.setRecordListStyle()が非対応のフィールドタイプ(公式ドキュメント記載)。
  const UNSUPPORTED_COLUMN_TYPES = [
    'REFERENCE_TABLE',
    'GROUP',
    'HR',
    'LABEL',
    'SPACER',
    'SUBTABLE',
  ];

  // このプラグインの設定はレコード画面の表示中には変わらないため、画面読み込み時に一度だけ読み込む。
  const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  // 対象列コードは初回だけ取得してキャッシュする(フォーム構成は画面遷移がない限り変わらない)。
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

  // kintone.app.setRecordListStyle()が対応する画面(表形式の一覧)でのみ発動する
  // (idea.mdの「発動する画面」参照)。
  kintone.events.on('app.record.index.show', async (event) => {
    if (event.viewType !== 'list') {
      return event;
    }

    const columnCodes = await getColumnCodes();
    const body = NS.StyleBuilder.buildStyleConfig(
      event.records,
      config.rules,
      columnCodes,
    );
    await kintone.app.setRecordListStyle({ body });

    return event;
  });
})(window, kintone);
