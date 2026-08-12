(function (global, kintone) {
  'use strict';

  const NS = global.BudgetMeter;
  const PLUGIN_ID = kintone.$PLUGIN_ID;

  const recordsUrl = () => kintone.api.url('/k/v1/records.json', true);
  const viewsUrl = () => kintone.api.url('/k/v1/app/views.json', true);

  const loadConfig = () =>
    NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  // 自アプリの「絞り込み条件に該当する全レコード」の集計対象フィールドを合計する。
  // 読み取り専用のためレコードカーソルAPIは使わず、$id昇順ページングで全件取得する
  // (idea.md「API仕様確認」参照)。
  const sumForRow = async (appId, baseQuery, row) => {
    const fetchPage = (query) =>
      kintone.api(recordsUrl(), 'GET', {
        app: appId,
        query,
        fields: ['$id', row.targetFieldCode],
      });
    const records = await NS.PagedFetch.fetchAllPages(baseQuery, fetchPage);
    return NS.Aggregator.sum(records, row.targetFieldCode);
  };

  // 動的な値(ラベル・合計額など)はtextContentでDOMに設定し、innerHTMLへ文字列連結しない
  // (kintone.createDialog()のドキュメント注意事項に従ったXSS対策。secureCodingGuideline.md参照)。
  // titlePrefixは「すべての予算を確認」ダイアログで一覧名を見出しに含めるためのオプション引数。
  const buildMeterRow = (row, formFields, sum, titlePrefix) => {
    const meter = NS.Meter.compute(
      sum,
      row.budget,
      row.warningThresholdPct,
      row.dangerThresholdPct,
    );
    const fieldDef = formFields[row.targetFieldCode];
    const baseLabel =
      row.label || (fieldDef ? fieldDef.label : row.targetFieldCode);
    const label = titlePrefix ? `${titlePrefix}: ${baseLabel}` : baseLabel;

    const wrapper = document.createElement('div');
    wrapper.className = 'bm-meter';

    const titleEl = document.createElement('div');
    titleEl.className = 'bm-meter-title';
    titleEl.textContent = label;
    wrapper.appendChild(titleEl);

    const valuesEl = document.createElement('div');
    valuesEl.className = 'bm-meter-values';
    valuesEl.textContent = `${sum.toLocaleString()} / ${row.budget.toLocaleString()} (${meter.roundedPercentage}%)`;
    wrapper.appendChild(valuesEl);

    const trackEl = document.createElement('div');
    trackEl.className = 'bm-meter-track';
    const fillEl = document.createElement('div');
    fillEl.className = `bm-meter-fill bm-meter-level-${meter.level}`;
    fillEl.style.width = `${meter.barWidthPercentage}%`;
    trackEl.appendChild(fillEl);
    wrapper.appendChild(trackEl);

    return wrapper;
  };

  // 単一一覧の「予算を確認」用のダイアログの中身(タイトル・本文要素)を組み立てる。
  // 今まさにその一覧画面に表示されている絞り込み条件(kintone.app.getQueryCondition()。
  // 保存済みfilterCondに加え、画面上で追加・変更した絞り込みも反映される)を使う。
  const buildBudgetDialogData = async (matches, appId, viewName) => {
    const baseQuery = kintone.app.getQueryCondition() || '';
    // kintone.app.getFormFields() はREST APIレスポンスの`properties`と同様の値
    // (戻り値自体がその値。プロパティ名でラップされない)を返す。
    const formFields = await kintone.app.getFormFields();

    const body = document.createElement('div');
    body.className = 'bm-dialog-body';
    for (const row of matches) {
      const sum = await sumForRow(appId, baseQuery, row);
      body.appendChild(buildMeterRow(row, formFields, sum));
    }

    return { title: `予算確認: ${viewName}`, body };
  };

  // すべての一覧の一覧設定(id/filterCond)を取得する。config画面の「対象一覧を選ぶドロップダウン」
  // が使う`GET /k/v1/preview/app/views.json`(動作テスト環境、アプリ管理権限が必要)とは異なり、
  // 一般利用者が一覧画面から呼ぶため、運用環境の`GET /k/v1/app/views.json`
  // (レコード閲覧/追加権限で足りる)を使う(idea.md「API仕様確認」参照)。
  const fetchProductionViewFilterConds = async (appId) => {
    const resp = await kintone.api(viewsUrl(), 'GET', {
      app: appId,
      lang: 'ja',
    });
    return NS.ViewFilterIndex.indexFilterCondByViewId(resp.views);
  };

  // 「すべての予算を確認」用のダイアログの中身を組み立てる。現在表示中の画面に関わらず、
  // 設定されている全ての予算設定行を対象に、行ごとに割り当てられた一覧の*保存済み*filterCondで
  // 集計する(現在表示中の画面のライブな絞り込みではない。複数の一覧を横断するため、単一一覧の
  // 確認とは基準が異なる。idea.md参照)。
  const buildAllBudgetsDialogData = async (rows, appId) => {
    const [formFields, filterCondByViewId] = await Promise.all([
      kintone.app.getFormFields(),
      fetchProductionViewFilterConds(appId),
    ]);

    const resolvedRows = rows
      .map((row) => ({ row, baseQuery: filterCondByViewId[row.viewId] }))
      .filter((entry) => entry.baseQuery !== undefined);
    const skippedCount = rows.length - resolvedRows.length;

    const body = document.createElement('div');
    body.className = 'bm-dialog-body';
    for (const { row, baseQuery } of resolvedRows) {
      const sum = await sumForRow(appId, baseQuery, row);
      body.appendChild(
        buildMeterRow(row, formFields, sum, row.viewName || row.viewId),
      );
    }
    if (skippedCount > 0) {
      const noteEl = document.createElement('p');
      noteEl.className = 'bm-dialog-note';
      noteEl.textContent = `${skippedCount}件の設定は対象の一覧が見つからないため表示していません。`;
      body.appendChild(noteEl);
    }

    return { title: 'すべての予算を確認', body };
  };

  const showDialog = async ({ title, body }) => {
    const dialog = await kintone.createDialog({
      title,
      body,
      showOkButton: true,
      okButtonText: '閉じる',
      showCancelButton: false,
      showCloseButton: true,
    });
    await dialog.show();
  };

  // ボタン押下時の共通処理。
  //
  // kintone.createDialog()が返す`dialog.show()`のPromiseは、ドキュメントに明記の通り
  // 「ユーザーがダイアログを閉じたときに解決される」(表示された時点では解決されない)。
  // そのため、集計処理(REST呼び出し)からダイアログを閉じるまでを丸ごと
  // kintone.showLoading('VISIBLE')/'HIDDEN'で挟むと、ローディングのオーバーレイが
  // ダイアログの上に表示されたまま(dialog.show()が解決するまでHIDDENが呼ばれない)になり、
  // オーバーレイに遮られてユーザーがダイアログを閉じられず、ローディングが消えなくなる
  // (実際に発生した不具合)。ローディング表示は「集計中(buildDialogData)」だけを覆い、
  // データが揃った時点で先にHIDDENへ戻してからダイアログを表示する。
  const createActionButton = (className, text, buildDialogData) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `kintoneplugin-button-normal ${className}`;
    button.textContent = text;
    button.addEventListener('click', async () => {
      button.disabled = true;
      kintone.showLoading('VISIBLE');
      let dialogData;
      try {
        dialogData = await buildDialogData();
      } catch (err) {
        kintone.showLoading('HIDDEN');
        button.disabled = false;
        global.alert(`予算の集計に失敗しました: ${err.message}`);
        return;
      }
      kintone.showLoading('HIDDEN');
      try {
        await showDialog(dialogData);
      } finally {
        button.disabled = false;
      }
    });
    return button;
  };

  kintone.events.on('app.record.index.show', async (event) => {
    const config = loadConfig();
    const headerEl = kintone.app.getHeaderMenuSpaceElement();
    if (!headerEl) {
      return event;
    }

    // 一覧を切り替えるたびに表示要否を再判定するため、前回描画したボタンは都度取り除いてから
    // 必要な場合のみ作り直す(「描画済みマーカー」方式だと、一覧を跨いだ非表示への切り替えに
    // 対応できないため)。
    ['.bm-check-button', '.bm-all-button'].forEach((className) => {
      const existing = headerEl.querySelector(className);
      if (existing) {
        existing.remove();
      }
    });

    const appId = kintone.app.getId();

    if (event.viewType === 'list') {
      const matches = NS.ViewMatcher.matchRowsForView(
        config.rows,
        event.viewId,
      );
      if (matches.length > 0) {
        headerEl.appendChild(
          createActionButton('bm-check-button', '予算を確認', () =>
            buildBudgetDialogData(matches, appId, event.viewName),
          ),
        );
      }
    }

    if (config.rows.length > 0 && config.allViewsGroupCodes.length > 0) {
      const groups = await kintone.user.getGroups();
      if (
        NS.GroupAuthorization.isAuthorized(groups, config.allViewsGroupCodes)
      ) {
        headerEl.appendChild(
          createActionButton('bm-all-button', 'すべての予算を確認', () =>
            buildAllBudgetsDialogData(config.rows, appId),
          ),
        );
      }
    }

    return event;
  });
})(window, kintone);
