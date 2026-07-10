(function (global, kintone) {
  'use strict';

  const NS = global.ExcelReportExport;
  const PLUGIN_ID = kintone.$PLUGIN_ID;

  const loadConfig = () =>
    NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  const showError = (err) => {
    console.error(err);
    global.alert(`Excel出力でエラーが発生しました。\n\n${err.message || err}`);
  };

  const createButton = (label) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'kintoneplugin-button-normal ere-export-button';
    button.textContent = label;
    return button;
  };

  // 詳細画面: 1件のレコードをExcelファイルとしてダウンロードするボタンを設置する。
  // kintone.app.record.getHeaderMenuSpaceElement()はPC専用(詳細/追加/編集画面で利用可)。
  kintone.events.on('app.record.detail.show', (event) => {
    const config = loadConfig();
    if (!NS.SingleExport.isConfigured(config)) {
      return event;
    }

    const spaceEl = kintone.app.record.getHeaderMenuSpaceElement();
    if (!spaceEl) {
      return event;
    }

    const button = createButton('Excelダウンロード');
    button.addEventListener('click', () => {
      NS.SingleExport.exportRecord(config, event.record).catch(showError);
    });
    spaceEl.appendChild(button);

    return event;
  });

  // 一覧画面: 現在の絞り込み条件に一致する全レコードをまとめてzipダウンロードするボタンを設置する。
  // kintone.app.getHeaderSpaceElement()はPC専用(レコード一覧画面で利用可)。
  kintone.events.on('app.record.index.show', (event) => {
    const config = loadConfig();
    if (!NS.SingleExport.isConfigured(config)) {
      return event;
    }

    const spaceEl = kintone.app.getHeaderSpaceElement();
    if (!spaceEl || spaceEl.querySelector('.ere-bulk-export-button')) {
      // index.showは表示のたびに発火するため、二重にボタンを追加しないようにする。
      return event;
    }

    const button = createButton('一括ダウンロード(zip)');
    button.classList.add('ere-bulk-export-button');
    button.addEventListener('click', () => {
      NS.BulkExport.exportBulk(config, kintone.app.getId()).catch(showError);
    });
    spaceEl.appendChild(button);

    return event;
  });
})(window, kintone);
