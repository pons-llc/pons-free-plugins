(function (global, kintone) {
  'use strict';

  const NS = global.CrossAppCheck;

  // 基準アプリ・対象アプリはこのプラグインが動作している集計アプリとは別アプリのため、
  // kintone.app.getFormFields()等のJavaScript API(現在開いているアプリ専用)は使えない。
  // CLAUDE.md開発方針3に従い、kintone自身へのREST呼び出しは kintone.api()
  // (内部向けラッパー)経由で行う。生のfetch/XHRでURLを組み立てることはしない。
  const recordsUrl = () => kintone.api.url('/k/v1/records.json', true);
  const recordUrl = () => kintone.api.url('/k/v1/record.json', true);
  const formFieldsUrl = () =>
    kintone.api.url('/k/v1/app/form/fields.json', true);
  const viewsUrl = () => kintone.api.url('/k/v1/app/views.json', true);
  const appsUrl = () => kintone.api.url('/k/v1/apps.json', true);

  // アプリ名は結果一覧の見出しに使う。取れなくても突合自体はできるので、失敗しても止めない。
  const fetchAppName = async (appId) => {
    try {
      const resp = await kintone.api(appsUrl(), 'GET', { ids: [appId] });
      return resp.apps && resp.apps[0] ? resp.apps[0].name : '';
    } catch {
      return '';
    }
  };

  // 別アプリのフィールド一覧を取得する(設定画面のプルダウン生成に使う)。
  // 「フィールドを取得する」REST APIの戻り値は`properties`でラップされている
  // (kintone.app.getFormFields()と違い、こちらはラップあり。MCPで確認済み)。
  const fetchFormFields = async (appId) => {
    const resp = await kintone.api(formFieldsUrl(), 'GET', { app: appId });
    return resp.properties || {};
  };

  const fetchPage = (appId, pagedQuery, fields) =>
    kintone.api(recordsUrl(), 'GET', { app: appId, query: pagedQuery, fields });

  // 別アプリのレコードを全件取得する。
  // カーソルAPIは「1ドメインで同時に10本まで・作成は排他」という制約があり、
  // 共有環境では他のカスタマイズと取り合いになるため使わず、
  // $id昇順ページング(kintone公式が案内している方法)で回す。
  const fetchAllRecords = async (appId, baseQuery, fieldCodes, maxRecords) => {
    const fields = Array.from(
      new Set(['$id'].concat(fieldCodes || []).filter(Boolean)),
    );
    const pageSize = NS.IdPaging.DEFAULT_PAGE_SIZE;
    let lastMaxId = null;
    let all = [];

    for (;;) {
      const pagedQuery = NS.IdPaging.buildPagedQuery(
        baseQuery,
        lastMaxId,
        pageSize,
      );
      const resp = await fetchPage(appId, pagedQuery, fields);
      all = all.concat(resp.records);

      if (NS.IdPaging.isLastPage(resp.records, pageSize)) {
        return { records: all, truncated: false };
      }
      if (maxRecords && all.length >= maxRecords) {
        // 上限に達したらそこで打ち切り、呼び出し元が警告を出せるよう印を返す
        return { records: all.slice(0, maxRecords), truncated: true };
      }
      lastMaxId = NS.IdPaging.nextMaxId(resp.records);
    }
  };

  // 一覧(view)の設定を取る。
  // 一覧のURLに`view=`しか付いていない場合、その一覧に保存された絞り込み条件は
  // URLに現れないため、ここで`filterCond`を引いて補う。
  const fetchViewFilterCond = async (appId, viewId) => {
    if (!appId || !viewId) {
      return '';
    }
    const resp = await kintone.api(viewsUrl(), 'GET', { app: appId });
    const views = resp.views || {};
    const matched = Object.keys(views)
      .map((name) => views[name])
      .find((view) => String(view.id) === String(viewId));
    return matched && matched.filterCond ? matched.filterCond : '';
  };

  const fetchRecord = async (appId, recordId) => {
    const resp = await kintone.api(recordUrl(), 'GET', {
      app: appId,
      id: recordId,
    });
    return resp.record;
  };

  const updateRecord = (appId, recordId, record, revision) =>
    kintone.api(recordUrl(), 'PUT', {
      app: appId,
      id: recordId,
      record,
      revision,
    });

  NS.RecordsClient = {
    fetchFormFields,
    fetchAppName,
    fetchViewFilterCond,
    fetchAllRecords,
    fetchRecord,
    updateRecord,
  };
})(typeof window !== 'undefined' ? window : globalThis, kintone);
