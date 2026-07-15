(function (global, kintone) {
  'use strict';

  const NS = global.ApprovalHistory;
  const PLUGIN_ID = kintone.$PLUGIN_ID;

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

  const disableTable = (record, config) => {
    const table = record[config.fieldCodes.table];
    if (table) {
      table.disabled = true;
    }
  };

  // モバイルには一覧画面のインライン編集(index.edit.show)が存在しないため、
  // 作成画面・編集画面のみ対応する(desktop.jsと同じ理由)。
  kintone.events.on(
    ['mobile.app.record.create.show', 'mobile.app.record.edit.show'],
    async (event) => {
      const config = await loadConfig();
      if (NS.ConfigStore.isConfigured(config)) {
        disableTable(event.record, config);
      }
      return event;
    },
  );

  kintone.events.on(
    'mobile.app.record.detail.process.proceed',
    async (event) => {
      const config = await loadConfig();
      if (!NS.ConfigStore.isConfigured(config)) {
        return event;
      }

      const fieldCodes = config.fieldCodes;
      const table = event.record[fieldCodes.table];
      if (!table) {
        return event;
      }

      const loginUser = kintone.getLoginUser();

      let title = '';
      try {
        const organizations = await kintone.user.getOrganizations();
        title = NS.TitleResolver.resolveTitle(organizations);
      } catch {
        title = '';
      }

      const row = NS.HistoryRow.buildHistoryRow(fieldCodes, {
        statusBefore: event.status && event.status.value,
        statusAfter: event.nextStatus && event.nextStatus.value,
        executedByCode: loginUser.code,
        executedByName: loginUser.name,
        executedByTitle: title,
        executedAtIso: new Date().toISOString(),
      });
      table.value.push(row);

      return event;
    },
  );
})(typeof window !== 'undefined' ? window : globalThis, kintone);
