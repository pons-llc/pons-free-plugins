(function (root) {
  'use strict';

  // 1アプリ分の生の取得結果(design、kintone依存の取得コード側が組み立てる。各項目は
  // 個別にtry/catchされているため、成功時は値、失敗時は`{key}Error`にメッセージが入る)から、
  // `render-app-document.js`が期待する`{ appId, appInfo, appInfoError, sections }`の形に変換する
  // 純粋関数。項目の並び順・見出しはidea.md「取得する設計情報」の表の順序に合わせている。
  const SECTION_DEFS = [
    { dataKey: 'fields', errorKey: 'fieldsError', title: 'フィールド情報' },
    { dataKey: 'settings', errorKey: 'settingsError', title: 'アプリ一般設定' },
    { dataKey: 'status', errorKey: 'statusError', title: 'プロセス管理設定' },
    {
      dataKey: 'customize',
      errorKey: 'customizeError',
      title: 'カスタマイズ設定',
      filesKey: 'customizeFiles',
    },
    {
      dataKey: 'notificationsGeneral',
      errorKey: 'notificationsGeneralError',
      title: '条件通知(アプリ全体)',
    },
    {
      dataKey: 'notificationsPerRecord',
      errorKey: 'notificationsPerRecordError',
      title: '条件通知(レコード条件)',
    },
    {
      dataKey: 'notificationsReminder',
      errorKey: 'notificationsReminderError',
      title: 'リマインダー通知',
    },
    { dataKey: 'acl', errorKey: 'aclError', title: 'アプリのアクセス権' },
    {
      dataKey: 'recordAcl',
      errorKey: 'recordAclError',
      title: 'レコードのアクセス権',
    },
    {
      dataKey: 'fieldAcl',
      errorKey: 'fieldAclError',
      title:
        'フィールドのアクセス権(運用環境反映済み、他項目は保存済みの動作テスト環境の設定)',
    },
    {
      dataKey: 'actions',
      errorKey: 'actionsError',
      title: 'アプリアクション設定',
    },
    {
      dataKey: 'plugins',
      errorKey: 'pluginsError',
      title: '導入プラグイン一覧',
    },
  ];

  const buildAppResult = (appId, design) => {
    const sections = SECTION_DEFS.map((def) => ({
      key: def.dataKey,
      title: def.title,
      data: design[def.dataKey] === undefined ? null : design[def.dataKey],
      error: design[def.errorKey] || null,
      files: def.filesKey ? design[def.filesKey] : undefined,
    }));

    return {
      appId,
      appInfo: design.appInfo || null,
      appInfoError: design.appInfoError || null,
      sections,
    };
  };

  const BuildAppResult = { buildAppResult };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = BuildAppResult;
  } else {
    root.NotebooklmExport = root.NotebooklmExport || {};
    root.NotebooklmExport.BuildAppResult = BuildAppResult;
  }
})(typeof window !== 'undefined' ? window : globalThis);
