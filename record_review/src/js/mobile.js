(function (global, kintone) {
  'use strict';

  const NS = global.RecordReview;
  const PLUGIN_ID = kintone.$PLUGIN_ID;
  const Model = NS.ReviewModel;

  // getConfig()の初回null対策(desktop.jsと同じ)。
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const loadConfig = async () => {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const raw = kintone.plugin.app.getConfig(PLUGIN_ID);
      if (raw) {
        return NS.ConfigStore.load(raw);
      }
      await sleep(200 * (attempt + 1));
    }
    return NS.ConfigStore.load(null);
  };

  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) {
      node.className = className;
    }
    if (text !== undefined) {
      node.textContent = text;
    }
    return node;
  };

  // モバイルではテーブル等の要素がgetFieldElement()で取得できないため、フィールド横のバッジは出さず、
  // ヘッダー下に未解決の指摘一覧を表示するだけにする(閲覧のみ。idea.md「モバイル」)。
  const renderUnresolvedPanel = (items) => {
    const space = kintone.mobile.app.getHeaderSpaceElement();
    if (!space) {
      return;
    }
    space.querySelectorAll('.rr-m-panel').forEach((n) => n.remove());
    const unresolved = items.filter((i) => !i.resolved);
    if (unresolved.length === 0) {
      return;
    }
    const panel = el('div', 'rr-m-panel');
    panel.appendChild(
      el('div', 'rr-m-title', `✕ 未解決の指摘 ${unresolved.length}件`),
    );
    unresolved.forEach((item) => {
      const row = el('div', 'rr-m-item');
      row.appendChild(
        el('div', 'rr-m-label', item.targetLabel || item.targetCode),
      );
      row.appendChild(el('div', 'rr-m-comment', item.comment));
      const by = item.pointedBy
        ? item.pointedBy.name || item.pointedBy.code
        : '';
      row.appendChild(
        el('div', 'rr-m-meta', `${by} ${Model.formatDateTime(item.pointedAt)}`),
      );
      panel.appendChild(row);
    });
    space.appendChild(panel);
  };

  kintone.events.on(
    [
      'mobile.app.record.create.show',
      'mobile.app.record.edit.show',
      'mobile.app.record.detail.show',
    ],
    async (event) => {
      const config = await loadConfig();
      if (!NS.ConfigStore.isConfigured(config)) {
        return event;
      }
      const codes = config.fieldCodes;
      const table = event.record[codes.table];
      if (!table) {
        return event;
      }
      if (event.type === 'mobile.app.record.create.show' && event.reuse) {
        table.value = [];
      }
      if (event.type !== 'mobile.app.record.detail.show') {
        NS.TableDisabler.disableAllRows(table);
      }
      if (event.type !== 'mobile.app.record.create.show') {
        renderUnresolvedPanel(Model.parseRows(table.value, codes));
      }
      return event;
    },
  );

  (async () => {
    const config = await loadConfig();
    if (!NS.ConfigStore.isConfigured(config)) {
      return;
    }
    const tableCode = config.fieldCodes.table;
    kintone.events.on(
      [
        `mobile.app.record.create.change.${tableCode}`,
        `mobile.app.record.edit.change.${tableCode}`,
      ],
      (event) => {
        NS.TableDisabler.disableAllRows(event.record[tableCode]);
        return event;
      },
    );
  })();
})(typeof window !== 'undefined' ? window : globalThis, kintone);
