(function (global, kintone) {
  'use strict';

  // 回答アプリの「集計リスト」一覧: フォーム定義JSONに基づいて、その照会で使う列だけの
  // 仮想テーブルを描画する。

  const NS = global.ResearchAnswer;
  const PLUGIN_ID = kintone.$PLUGIN_ID;
  const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  if (config.role !== 'answer') {
    return;
  }

  const AnalysisCore = NS.AnalysisCore;

  // 描画先: カスタマイズ一覧の #virtual-table-div を優先し、無ければ(表形式一覧でも動くように)
  // ヘッダースペースに描画領域を作るフォールバック。
  const getContainer = () => {
    const custom = document.getElementById('virtual-table-div');
    if (custom) {
      return custom;
    }
    const headerSpace = kintone.app.getHeaderSpaceElement();
    if (!headerSpace) {
      return null;
    }
    let fallback = document.getElementById('ra-virtual-table-fallback');
    if (!fallback) {
      fallback = document.createElement('div');
      fallback.id = 'ra-virtual-table-fallback';
      headerSpace.appendChild(fallback);
    }
    return fallback;
  };

  const showMessage = (container, text) => {
    container.textContent = '';
    const msg = document.createElement('div');
    msg.classList.add('ra-list-message');
    msg.textContent = text;
    container.appendChild(msg);
  };

  // 回答レコードのjson(フォーム定義)はLOOKUPコピーのため、依頼レコードを編集しても既存の
  // 回答レコード側には反映されない(kintoneのLOOKUP仕様。desktop-answer-analysis.jsの
  // fetchLatestJsonと同じ理由)。表示のたびに依頼アプリから直接最新のjsonをREST取得し、
  // コピー値より優先することで一覧を常に最新のフォーム定義で表示する。
  const fetchLatestJson = async (configRecord, answerProperties) => {
    const fallback = configRecord.json.value;
    const lookupField = answerProperties && answerProperties.lookup;
    const relatedKeyField =
      lookupField && lookupField.lookup && lookupField.lookup.relatedKeyField;
    if (!config.requestAppId || !relatedKeyField || !configRecord.lookup) {
      return fallback;
    }
    try {
      const query = AnalysisCore.buildRequestRecordQuery(
        relatedKeyField,
        configRecord.lookup.value,
      );
      const resp = await kintone.api(
        kintone.api.url('/k/v1/records.json', true),
        'GET',
        { app: config.requestAppId, query, fields: ['json'] },
      );
      const latest = resp.records && resp.records[0] && resp.records[0].json;
      return latest ? latest.value : fallback;
    } catch (e) {
      console.error(
        '依頼アプリから最新のフォーム定義を取得できませんでした',
        e,
      );
      return fallback;
    }
  };

  kintone.events.on('app.record.index.show', async (event) => {
    const params = new URLSearchParams(window.location.search);

    if (!params.has('view') && event.viewName !== config.listViewName) {
      // 「集計・分析」ボタンからの遷移はviewパラメーター無し(=デフォルト一覧)で来るため、
      // デフォルト一覧が集計リストでないと遷移が成立しない(kintone.showNotificationは実在API、
      // kintone_doc MCPで確認済み)
      kintone.showNotification(
        'ERROR',
        `デフォルトの一覧が「${config.listViewName}」ではありません。一覧の表示順を変更してください。`,
      );
      return event;
    }
    if (event.viewName !== config.listViewName) {
      return event;
    }

    const container = getContainer();
    if (!container) {
      return event;
    }

    if (!event.records || event.records.length < 1) {
      showMessage(container, 'レコードがありません。');
      return event;
    }

    const queryString = kintone.app.getQueryCondition() || '';
    if (!queryString.includes('lookup')) {
      showMessage(
        container,
        '照会で絞り込まれていないため一覧を表示できません。依頼アプリの「集計・分析」ボタンから遷移してください。',
      );
      return event;
    }

    const configRecord = event.records[0];
    if (!configRecord || !configRecord.json || !configRecord.json.value) {
      showMessage(container, 'フォームレイアウト(json)が見つかりません。');
      return event;
    }

    // フォーム定義列+実フィールド列(予備・管理用は除外)。REST APIレスポンスは
    // {properties: {...}} にラップされている(kintone.app.getFormFields()とは違う点に注意)。
    let answerProperties = {};
    try {
      const appFieldsResp = await kintone.api(
        kintone.api.url('/k/v1/app/form/fields.json', true),
        'GET',
        { app: kintone.app.getId() },
      );
      answerProperties = appFieldsResp.properties;
    } catch (e) {
      console.error('フィールド情報の取得に失敗しました', e);
    }

    const latestJson = await fetchLatestJson(configRecord, answerProperties);
    const setting = NS.FormModel.parseSettingJson(latestJson);
    const formLayout = NS.FormModel.sortLayoutByOrder(setting.layout);
    const targetColumns = AnalysisCore.buildTargetColumns(
      formLayout,
      answerProperties,
    );

    // --- ヘッダーメニュー: 分析ビューへの遷移ボタン ---
    const headerMenu = kintone.app.getHeaderMenuSpaceElement();
    if (headerMenu && !document.getElementById('ra-analysis-button')) {
      const analysisButton = document.createElement('button');
      analysisButton.id = 'ra-analysis-button';
      analysisButton.type = 'button';
      analysisButton.classList.add('kintoneplugin-button-dialog-ok');
      analysisButton.textContent = '現在の条件で分析する';
      analysisButton.addEventListener('click', async () => {
        try {
          // kintone.app.getViews()はPromise解決時に「一覧設定の配列」({type, builtinType,
          // name, id}の配列、表示順)をそのまま返す(REST /k/v1/app/views.jsonのように
          // {views: {一覧名: ...}}のオブジェクト形ではない。MCPで確認済み)
          const views = await kintone.app.getViews();
          const analysisView = views.find(
            (v) => v.name === config.analysisViewName,
          );
          if (!analysisView) {
            kintone.showNotification(
              'ERROR',
              `一覧「${config.analysisViewName}」が見つかりません。プラグイン設定画面の自動作成を実行してください。`,
            );
            return;
          }
          const url = new URL(window.location.href);
          url.searchParams.set('view', analysisView.id);
          window.location.href = url.toString();
        } catch (e) {
          console.error(e);
          kintone.showNotification('ERROR', '一覧情報の取得に失敗しました。');
        }
      });
      headerMenu.appendChild(analysisButton);
    }

    // --- 仮想テーブル描画(すべてtextContentで挿入、innerHTML不使用) ---
    container.textContent = '';

    const titleElm = document.createElement('h2');
    titleElm.classList.add('ra-list-title');
    titleElm.textContent = configRecord.title ? configRecord.title.value : '';
    container.appendChild(titleElm);

    const tableWrap = document.createElement('div');
    tableWrap.classList.add('ra-table-wrap');
    container.appendChild(tableWrap);

    const table = document.createElement('table');
    table.classList.add('modern-table');
    tableWrap.appendChild(table);

    const thead = document.createElement('thead');
    table.appendChild(thead);
    const headRow = document.createElement('tr');
    thead.appendChild(headRow);

    const linkTh = document.createElement('th');
    linkTh.textContent = 'View';
    headRow.appendChild(linkTh);
    targetColumns.forEach((col) => {
      const th = document.createElement('th');
      th.textContent = col.label;
      th.dataset.column = col.f_code;
      headRow.appendChild(th);
    });

    const tbody = document.createElement('tbody');
    table.appendChild(tbody);

    event.records.forEach((rec) => {
      const tr = document.createElement('tr');
      tbody.appendChild(tr);

      const linkTd = document.createElement('td');
      const linkA = document.createElement('a');
      linkA.href = `/k/${kintone.app.getId()}/show#record=${rec.$id.value}`;
      linkA.textContent = '→';
      linkA.classList.add('record-link');
      linkTd.appendChild(linkA);
      tr.appendChild(linkTd);

      targetColumns.forEach((col) => {
        const td = document.createElement('td');
        td.textContent = rec[col.f_code]
          ? AnalysisCore.formatFieldValue(
              rec[col.f_code].type,
              rec[col.f_code].value,
            )
          : '';
        tr.appendChild(td);
      });
    });

    return event;
  });
})(window, kintone);
