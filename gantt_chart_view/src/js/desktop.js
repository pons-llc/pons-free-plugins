(function (global, kintone) {
  'use strict';

  // レコード一覧画面(表形式)のヘッダー領域(kintone.app.getHeaderMenuSpaceElement())に
  // ガントチャートを描画する。app.record.index.show イベントの event.viewType === 'list' のときのみ対象。
  //
  // 対象一覧の判定: event.viewId は、GET /k/v1/app/views.json のレスポンスに現れない
  // ビルトインの「すべて」一覧のときにも発行される(APIでは列挙できない)。そのため、
  // 一覧APIの結果に event.viewId が存在するかどうかで「ALL(すべて)」設定へのフォールバックを
  // 判定する(js/lib/paging-query.js の resolveViewConfig)。

  const NS = global.GanttChartView;
  const PLUGIN_ID = kintone.$PLUGIN_ID;

  const PIXELS_PER_UNIT = { day: 40, week: 70, month: 300 };
  const GROUPABLE_FIELD_TYPES = NS.Grouping.ALLOWED_GROUP_FIELD_TYPES;

  // appIdごとにビュー一覧・フォーム項目をキャッシュし、ページ送りやソートのたびに
  // 同じREST/JS APIを繰り返し呼び出さないようにする(短時間の大量リクエストを避けるため)。
  const appViewsCache = new Map();
  const formFieldsCache = new Map();

  // ランタイムの表示状態(スケール単位・グループ分けフィールド)は永続化しない。
  // ページを再読み込みすると設定画面の既定値に戻る。
  const runtimeState = { scaleUnit: 'day', groupFieldCode: null };

  const viewsUrl = () => kintone.api.url('/k/v1/app/views.json', true);

  const fetchApiViews = async (appId) => {
    if (appViewsCache.has(appId)) {
      return appViewsCache.get(appId);
    }
    const resp = await kintone.api(viewsUrl(), 'GET', { app: appId });
    const list = Object.keys(resp.views).map((name) => {
      const view = resp.views[name];
      return { id: view.id, name: view.name, type: view.type };
    });
    appViewsCache.set(appId, list);
    return list;
  };

  const fetchFormFields = async (appId) => {
    if (formFieldsCache.has(appId)) {
      return formFieldsCache.get(appId);
    }
    // JavaScript APIを優先する(CLAUDE.md方針3)。現在開いているアプリの項目取得はJS APIで完結する。
    const fields = await kintone.app.getFormFields();
    formFieldsCache.set(appId, fields);
    return fields;
  };

  const groupFieldOptionsFor = (config, formFields) =>
    (config.allowedGroupFieldCodes || [])
      .filter(
        (code) =>
          formFields[code] &&
          GROUPABLE_FIELD_TYPES.includes(formFields[code].type),
      )
      .map((code) => ({ code, label: `${formFields[code].label} (${code})` }));

  const buildStatusText = (count, totalKnown, truncated) => {
    if (totalKnown === null) {
      return `表示中: ${count}件(現在のページ)`;
    }
    return truncated
      ? `全件取得: ${count}件を表示(上限に達したため打ち切りました)`
      : `全件取得: ${count}件を表示`;
  };

  // ctx: { container, appId, config, formFields } … 一覧が変わらない限り一定の値
  // data: { records, totalKnown, truncated } … 描画対象データ(通常表示 or 全件取得後で入れ替わる)
  const renderGantt = (ctx, data) => {
    const { container, appId, config, formFields } = ctx;
    const { records, totalKnown, truncated } = data;

    const rows = NS.RecordModel.buildRows(records, config);
    const groupFieldCode =
      runtimeState.groupFieldCode !== null
        ? runtimeState.groupFieldCode
        : config.groupFieldCode;
    const groups = NS.Grouping.groupRows(rows, groupFieldCode);
    const range = NS.TimeScale.computeDateRange(rows);
    const scale = NS.TimeScale.createScale(
      range,
      runtimeState.scaleUnit,
      PIXELS_PER_UNIT[runtimeState.scaleUnit],
    );
    const colorMap = NS.ColorAssignment.assignColors(
      rows,
      config.colorFieldCode,
    );

    NS.GanttRender.render(container, {
      groups,
      scale,
      colorMap,
      config,
      currentScaleUnit: runtimeState.scaleUnit,
      currentGroupFieldCode: groupFieldCode,
      groupFieldOptions: groupFieldOptionsFor(config, formFields),
      fullFetchEnabled: Boolean(config.enableFullFetch),
      statusText: buildStatusText(records.length, totalKnown, truncated),
      onScaleChange: (unit) => {
        runtimeState.scaleUnit = unit;
        renderGantt(ctx, data);
      },
      onGroupChange: (fieldCode) => {
        runtimeState.groupFieldCode = fieldCode;
        renderGantt(ctx, data);
      },
      onFullFetch: async () => {
        kintone.showLoading('VISIBLE');
        try {
          const baseCondition = kintone.app.getQueryCondition() || '';
          const result = await NS.FullFetch.fetchAll(
            appId,
            baseCondition,
            config.maxRecords,
          );
          renderGantt(ctx, {
            records: result.records,
            totalKnown: result.records.length,
            truncated: result.truncated,
          });
        } catch (err) {
          console.error('[gantt_chart_view] 全件取得に失敗しました', err);
          kintone.showNotification(
            'ERROR',
            '全件取得に失敗しました。時間をおいて再度お試しください。',
          );
        } finally {
          kintone.showLoading('HIDDEN');
        }
      },
    });
  };

  kintone.events.on('app.record.index.show', async (event) => {
    if (event.viewType !== 'list') {
      return event;
    }

    const container = kintone.app.getHeaderMenuSpaceElement();
    if (!container) {
      return event;
    }

    const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));
    if (!config.viewConfigs || config.viewConfigs.length === 0) {
      return event;
    }

    const appId = kintone.app.getId();
    const apiViews = await fetchApiViews(appId);
    const resolvedConfig = NS.PagingQuery.resolveViewConfig(
      event.viewId,
      config.viewConfigs,
      apiViews,
    );

    // このビュー向けの設定が未作成(管理者がまだ設定画面で追加していない)場合は何もしない。
    if (!resolvedConfig || !resolvedConfig.startFieldCode) {
      return event;
    }

    if (runtimeState.groupFieldCode === null) {
      runtimeState.groupFieldCode = resolvedConfig.groupFieldCode;
    }

    const formFields = await fetchFormFields(appId);
    renderGantt(
      { container, appId, config: resolvedConfig, formFields },
      { records: event.records, totalKnown: null, truncated: false },
    );

    return event;
  });
})(window, kintone);
