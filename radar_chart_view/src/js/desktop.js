(function (global, kintone) {
  'use strict';

  // レコード一覧画面(表形式)のヘッダー領域(kintone.app.getHeaderSpaceElement())に
  // 「レーダーチャートを表示」ボタンを設置する。app.record.index.show の
  // event.viewType === 'list' のときのみ対象(カレンダー形式・カスタマイズビューは対象外。
  // event.recordsの形が異なるため。idea.md参照)。
  //
  // ボタン押下 → 対象選択(表示中のレコード/絞り込み条件の全件)→ 生成したHTMLをBlob化して
  // 別タブに開く、という流れ。ポップアップブロック対策として、どちらの選択でも
  // 選択ボタン押下の同期コールバック内で先に window.open('', '_blank') し、
  // 空タブへの参照を保持してから、データ取得完了後にその参照へ遷移させる(idea.md参照)。

  const NS = global.RadarChartView;
  const PLUGIN_ID = kintone.$PLUGIN_ID;
  const MIN_AXIS_FIELDS = 3;

  // appIdごとにフォーム項目をキャッシュし、ページ送り・絞り込みのたびに同じJS APIを
  // 繰り返し呼び出さないようにする。
  const formFieldsCache = new Map();

  const fetchFormFields = async (appId) => {
    if (formFieldsCache.has(appId)) {
      return formFieldsCache.get(appId);
    }
    // JavaScript APIを優先する(CLAUDE.md方針3)。kintone.app.getFormFields()の戻り値は
    // プロパティ名でラップされず、戻り値そのものがREST版propertiesと同等の値
    // (CLAUDE.md記載の既知の落とし穴、確認済み)。
    const fields = await kintone.app.getFormFields();
    formFieldsCache.set(appId, fields);
    return fields;
  };

  const isConfigured = (config) =>
    Array.isArray(config.axisFieldCodes) &&
    config.axisFieldCodes.length >= MIN_AXIS_FIELDS;

  const showError = (err) => {
    console.error('[radar_chart_view]', err);
    kintone.showNotification(
      'ERROR',
      'レーダーチャートの生成に失敗しました。時間をおいて再度お試しください。',
    );
  };

  const createButton = (label, className) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.textContent = label;
    return button;
  };

  const buildAxisLabels = (config, formFields) =>
    config.axisFieldCodes.map((code) => ({
      code,
      label: formFields[code] ? formFields[code].label : code,
    }));

  const buildSourceDescription = (kind, count) =>
    kind === 'all'
      ? `絞り込み条件の全件(${count}件)`
      : `表示中のレコード(${count}件)`;

  const buildPayload = (config, formFields, records, kind, truncated) => ({
    title: config.title,
    axisLabels: buildAxisLabels(config, formFields),
    scaleDivisions: config.scaleDivisions,
    series: NS.SeriesBuilder.buildSeries(records, config),
    sourceDescription: buildSourceDescription(kind, records.length),
    truncated: Boolean(truncated),
    generatedAt: new Date().toLocaleString('ja-JP'),
  });

  // win: window.open('', '_blank') で事前に確保しておいた空タブへの参照。
  // Blob URLはあえて revokeObjectURL しない(新しいタブでの読み込み完了タイミングを
  // 別ウィンドウ側から検知するのは煩雑で、手動操作の都度発生する程度の頻度であれば
  // メモリ上のコストは軽微と判断した)。
  const navigateToGeneratedHtml = (win, html) => {
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    if (win && !win.closed) {
      win.location.href = url;
    } else {
      window.open(url, '_blank');
    }
  };

  const showGeneratingMessage = (win) => {
    if (!win || !win.document) {
      return;
    }
    win.document.title = '生成中…';
    const p = win.document.createElement('p');
    p.textContent = 'レーダーチャートを生成しています…';
    win.document.body.appendChild(p);
  };

  const handleSelection = async (kind, ctx) => {
    const win = window.open('', '_blank');
    showGeneratingMessage(win);

    kintone.showLoading('VISIBLE');
    try {
      const formFields = await fetchFormFields(ctx.appId);

      if (kind === 'all') {
        const baseCondition = kintone.app.getQueryCondition() || '';
        const result = await NS.FullFetch.fetchAll(
          ctx.appId,
          baseCondition,
          ctx.config.maxRecords,
        );
        const payload = buildPayload(
          ctx.config,
          formFields,
          result.records,
          'all',
          result.truncated,
        );
        navigateToGeneratedHtml(
          win,
          NS.HtmlTemplate.buildRadarHtmlDocument(payload),
        );
        return;
      }

      const payload = buildPayload(
        ctx.config,
        formFields,
        ctx.currentRecords,
        'current',
        false,
      );
      navigateToGeneratedHtml(
        win,
        NS.HtmlTemplate.buildRadarHtmlDocument(payload),
      );
    } catch (err) {
      if (win && !win.closed) {
        win.close();
      }
      showError(err);
    } finally {
      kintone.showLoading('HIDDEN');
    }
  };

  const buildSelectionPanel = (onSelect) => {
    const panel = document.createElement('div');
    panel.className = 'rcv-selection-panel';

    const currentButton = createButton(
      '表示中のレコードで作成',
      'kintoneplugin-button-normal rcv-selection-button',
    );
    currentButton.addEventListener('click', () => onSelect('current'));

    const allButton = createButton(
      '絞り込み条件の全件で作成',
      'kintoneplugin-button-normal rcv-selection-button',
    );
    allButton.addEventListener('click', () => onSelect('all'));

    panel.appendChild(currentButton);
    panel.appendChild(allButton);
    return panel;
  };

  kintone.events.on('app.record.index.show', (event) => {
    if (event.viewType !== 'list') {
      return event;
    }

    const container = kintone.app.getHeaderSpaceElement();
    if (!container || container.querySelector('.rcv-open-button')) {
      // index.showは表示のたびに発火するため、二重にボタンを追加しないようにする。
      return event;
    }

    const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));
    if (!isConfigured(config)) {
      return event;
    }

    const appId = kintone.app.getId();
    // クリック時点で即座にタブを開けるよう、フォーム項目を先読みしてキャッシュしておく。
    fetchFormFields(appId).catch(() => {});

    let panelEl = null;
    const closePanel = () => {
      if (panelEl) {
        panelEl.remove();
        panelEl = null;
      }
    };

    const mainButton = createButton(
      'レーダーチャートを表示',
      'kintoneplugin-button-normal rcv-open-button',
    );
    mainButton.addEventListener('click', () => {
      if (panelEl) {
        closePanel();
        return;
      }
      panelEl = buildSelectionPanel((kind) => {
        closePanel();
        handleSelection(kind, {
          appId,
          config,
          currentRecords: event.records,
        });
      });
      container.appendChild(panelEl);
    });

    container.appendChild(mainButton);

    return event;
  });
})(window, kintone);
