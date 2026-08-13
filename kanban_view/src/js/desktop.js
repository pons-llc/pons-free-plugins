(function (global, kintone) {
  'use strict';

  // レコード一覧画面(表形式)の kintone.app.getHeaderSpaceElement()(一覧メニューと一覧本体の間、
  // フル幅)にカンバンボードを描画する。app.record.index.show イベントの event.viewType === 'list'
  // のときのみ対象。ネイティブの一覧本体は非表示にせずそのまま残す(calendar_view/idea.md参照)。
  //
  // レコード取得は event.records(REST不使用)のみを使う(idea.md「データ取得方針」参照、
  // bulk_approvalと同じ設計方針)。表示専用プラグインであり、REST APIは一切使用しない。

  const NS = global.KanbanView;
  const PLUGIN_ID = kintone.$PLUGIN_ID;

  const formFieldsCache = new Map();

  const fetchFormFields = async (appId) => {
    if (formFieldsCache.has(appId)) {
      return formFieldsCache.get(appId);
    }
    // JavaScript APIを優先する(CLAUDE.md方針3)。kintone.app.getFormFields()の戻り値は
    // REST版 GET /k/v1/app/form/fields.json の properties と同等の値そのもの
    // ({ properties: {...} } のようにラップされない。CLAUDE.mdの既知の落とし穴を確認済み)。
    const fields = await kintone.app.getFormFields();
    formFieldsCache.set(appId, fields);
    return fields;
  };

  // カード押下時はボード(一覧画面)を離脱させず、レコード詳細を別タブで開く
  // (ユーザー指示・確定・2026-08-13。同一タブ遷移だと一覧の絞り込み・スクロール位置が失われるため)。
  // window.open()の第3引数'noopener'は、開いたタブ側からwindow.opener経由で元のタブを
  // 操作できないようにする多層防御(secureCodingGuideline.mdの外部遷移時の注意に準拠。
  // URL自体はkintone.buildPageUrl()が組み立てる同一オリジンのURLで外部入力に由来しない)。
  const openRecordDetail = async (appId, recordId) => {
    try {
      const url = await kintone.buildPageUrl('APP_DETAIL', {
        appId: String(appId),
        recordId: String(recordId),
      });
      global.open(url, '_blank', 'noopener');
    } catch (err) {
      console.error(
        '[kanban_view] レコード詳細画面のURL取得に失敗しました',
        err,
      );
    }
  };

  // resolvedConfig・records・formFieldsから、ボードの列(グループ)を組み立てる。
  // groupModeがSTATUSでプロセス管理が無効(または対応するSTATUSフィールドが無い)場合はnullを返す。
  const buildColumns = async (records, resolvedConfig, formFields) => {
    if (resolvedConfig.groupMode === 'STATUS') {
      const statusFieldCode = NS.FieldLookup.findFieldCodeByType(
        formFields,
        'STATUS',
      );
      if (!statusFieldCode) {
        return null;
      }
      // kintone.app.getStatus()はレコード一覧画面でも利用できる非同期API。戻り値はREST API
      // GET /k/v1/app/status.json のrevisionを除いた値と同様の値がそのまま返る(bulk_approvalで確認済み)。
      const statusSettings = await kintone.app.getStatus();
      if (!statusSettings || !statusSettings.enable) {
        return null;
      }
      return NS.RecordGrouping.groupRecordsByStatus(
        records,
        statusFieldCode,
        statusSettings,
      );
    }

    const groupField = formFields[resolvedConfig.groupFieldCode];
    const options = NS.FieldLookup.optionsOf(groupField);
    return NS.RecordGrouping.groupRecordsByField(
      records,
      resolvedConfig.groupFieldCode,
      options,
    );
  };

  kintone.events.on('app.record.index.show', async (event) => {
    if (event.viewType !== 'list') {
      return event;
    }

    const container = kintone.app.getHeaderSpaceElement();
    if (!container) {
      return event;
    }

    const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));
    if (!config.viewConfigs || config.viewConfigs.length === 0) {
      return event;
    }

    const resolvedConfig = NS.ViewResolution.resolveViewConfig(
      event.viewId,
      config.viewConfigs,
    );
    if (!resolvedConfig || !resolvedConfig.titleFieldCode) {
      return event;
    }
    if (
      resolvedConfig.groupMode === 'FIELD' &&
      !resolvedConfig.groupFieldCode
    ) {
      return event;
    }
    if (
      resolvedConfig.assigneeMode === 'USER_FIELD' &&
      !resolvedConfig.assigneeFieldCode
    ) {
      return event;
    }

    const appId = kintone.app.getId();
    const formFields = await fetchFormFields(appId);
    const records = event.records || [];

    const columns = await buildColumns(records, resolvedConfig, formFields);
    if (!columns) {
      return event;
    }

    const statusAssigneeFieldCode =
      resolvedConfig.assigneeMode === 'STATUS_ASSIGNEE'
        ? NS.FieldLookup.findFieldCodeByType(formFields, 'STATUS_ASSIGNEE')
        : null;

    const cardContext = {
      formFields,
      statusAssigneeFieldCode,
      now: new Date(),
    };
    const boardColumns = columns.map((column) => ({
      key: column.key,
      label: column.label,
      cards: column.records.map((record) =>
        NS.CardModel.buildCard(record, resolvedConfig, cardContext),
      ),
    }));

    NS.KanbanRender.render(container, {
      boardColumns,
      totalCount: records.length,
      onCardClick: (recordId) => openRecordDetail(appId, recordId),
    });

    return event;
  });
})(window, kintone);
