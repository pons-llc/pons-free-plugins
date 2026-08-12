(function (global, kintone) {
  'use strict';

  // レコード一覧画面(表形式)の kintone.app.getHeaderSpaceElement()(一覧メニューと一覧本体の間、
  // フル幅)にカレンダーを描画する。app.record.index.show イベントの event.viewType === 'list'
  // のときのみ対象。ネイティブの一覧本体は非表示にせずそのまま残す(判断記録.md参照)。
  //
  // レコード取得は event.records(REST不使用)のみを使い、先頭100件に打ち切る(idea.md参照)。
  // 表示専用プラグインであり、REST APIは一切使用しない。

  const NS = global.CalendarView;
  const PLUGIN_ID = kintone.$PLUGIN_ID;

  const formFieldsCache = new Map();

  // ランタイムの表示状態(表示単位・基準日)は永続化しない。ページ再読み込みで既定値に戻る。
  const runtimeState = { unit: null, currentDate: new Date() };

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

  const navigateDate = (unit, currentDate, direction) => {
    if (direction === 'today') {
      return new Date();
    }
    const deltaDays = unit === 'day' ? 1 : 7;
    const sign = direction === 'prev' ? -1 : 1;
    return new Date(
      currentDate.getTime() + sign * deltaDays * 24 * 60 * 60 * 1000,
    );
  };

  const openRecordDetail = async (appId, recordId) => {
    try {
      const url = await kintone.buildPageUrl('APP_DETAIL', {
        appId: String(appId),
        recordId: String(recordId),
      });
      global.location.href = url;
    } catch (err) {
      console.error(
        '[calendar_view] レコード詳細画面のURL取得に失敗しました',
        err,
      );
    }
  };

  // ctx: { container, appId, config, formFields } … 一覧が変わらない限り一定
  // events: EventModel.buildEvents() の戻り値
  const renderCalendar = (ctx, events, capInfo) => {
    const { container, appId, config } = ctx;
    if (runtimeState.unit === null) {
      runtimeState.unit = config.defaultViewUnit;
    }

    NS.CalendarRender.render(container, {
      events,
      currentUnit: runtimeState.unit,
      currentDate: runtimeState.currentDate,
      layoutDirection: config.layoutDirection,
      colorOverrides: config.colorOverrides,
      totalRecords: capInfo.total,
      truncated: capInfo.truncated,
      maxRecords: capInfo.max,
      onUnitChange: (unit) => {
        runtimeState.unit = unit;
        renderCalendar(ctx, events, capInfo);
      },
      onNavigate: (direction) => {
        runtimeState.currentDate = navigateDate(
          runtimeState.unit,
          runtimeState.currentDate,
          direction,
        );
        renderCalendar(ctx, events, capInfo);
      },
      onJumpToDate: (date) => {
        runtimeState.currentDate = date;
        renderCalendar(ctx, events, capInfo);
      },
      onEventClick: (recordId) => openRecordDetail(appId, recordId),
    });
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
    // このビュー向けの設定が未作成、または必須項目が未設定の場合は何もしない。
    if (
      !resolvedConfig ||
      !resolvedConfig.titleFieldCode ||
      !resolvedConfig.startFieldCode
    ) {
      return event;
    }

    const appId = kintone.app.getId();
    const formFields = await fetchFormFields(appId);

    const capInfo = NS.RecordCap.capRecords(event.records);
    const events = NS.EventModel.buildEvents(
      capInfo.records,
      resolvedConfig,
      formFields,
    );

    renderCalendar(
      { container, appId, config: resolvedConfig, formFields },
      events,
      capInfo,
    );

    return event;
  });
})(window, kintone);
