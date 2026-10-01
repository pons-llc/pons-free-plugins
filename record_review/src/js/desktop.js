(function (global, kintone) {
  'use strict';

  const NS = global.RecordReview;
  const PLUGIN_ID = kintone.$PLUGIN_ID;
  const Model = NS.ReviewModel;

  // kintone.plugin.app.getConfig()は、画面表示直後の最初の呼び出しでnullを返すことがある
  // (fiscal_year_numbering/approval_historyで実機確認済みの既知の挙動)ため、短い間隔でリトライする。
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

  const userName = (user) => (user ? user.name || user.code : '');

  // ---------------------------------------------------------------------------
  // 追加・編集画面/一覧のインライン編集: 指摘履歴テーブルは手入力させない(idea.md「画面ごとの挙動」)
  // ---------------------------------------------------------------------------

  // 編集画面では、修正しながら確認できるよう未解決の指摘をメニュー上側に一覧表示する。
  const renderEditPanel = (items) => {
    const space = kintone.app.record.getHeaderMenuSpaceElement();
    if (!space) {
      return;
    }
    space.querySelectorAll('.rr-edit-panel').forEach((n) => n.remove());
    const unresolved = items.filter((i) => !i.resolved);
    if (unresolved.length === 0) {
      return;
    }
    const panel = el('div', 'rr-edit-panel');
    panel.appendChild(
      el('div', 'rr-edit-panel-title', `✕ 未解決の指摘 ${unresolved.length}件`),
    );
    const list = el('ul', 'rr-edit-panel-list');
    unresolved.forEach((item) => {
      const li = el('li');
      li.appendChild(
        el('strong', '', `【${item.targetLabel || item.targetCode}】`),
      );
      li.appendChild(el('span', 'rr-pre', item.comment));
      li.appendChild(
        el(
          'span',
          'rr-meta',
          ` — ${userName(item.pointedBy)} ${Model.formatDateTime(item.pointedAt)}`,
        ),
      );
      list.appendChild(li);
    });
    panel.appendChild(list);
    space.appendChild(panel);
  };

  kintone.events.on(
    [
      'app.record.create.show',
      'app.record.edit.show',
      'app.record.index.edit.show',
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
      // 再利用で追加画面を開いた場合、コピー元の指摘を引き継がない。
      if (event.type === 'app.record.create.show' && event.reuse) {
        table.value = [];
      }
      NS.TableDisabler.disableAllRows(table);
      if (event.type === 'app.record.edit.show') {
        renderEditPanel(Model.parseRows(table.value, codes));
      }
      return event;
    },
  );

  // テーブルの行追加ボタンでも`change.<テーブル>`が発生するため、手動で追加された行も即座にdisabledにする
  // (approval_historyと同じ)。フィールドコードは設定読み込み後に判明するので動的に登録する。
  (async () => {
    const config = await loadConfig();
    if (!NS.ConfigStore.isConfigured(config)) {
      return;
    }
    const tableCode = config.fieldCodes.table;
    kintone.events.on(
      [
        `app.record.create.change.${tableCode}`,
        `app.record.edit.change.${tableCode}`,
        `app.record.index.edit.change.${tableCode}`,
      ],
      (event) => {
        NS.TableDisabler.disableAllRows(event.record[tableCode]);
        return event;
      },
    );
  })();

  // ---------------------------------------------------------------------------
  // 詳細画面: バッジ・ダイアログ・指摘の登録/解決
  // ---------------------------------------------------------------------------

  const MODE_STORAGE_KEY = `recordReview.mode.${kintone.app.getId()}`;
  const readMode = () => {
    try {
      return global.localStorage.getItem(MODE_STORAGE_KEY) === 'on';
    } catch {
      return false;
    }
  };
  const writeMode = (on) => {
    try {
      global.localStorage.setItem(MODE_STORAGE_KEY, on ? 'on' : 'off');
    } catch {
      // localStorageが使えない環境では記憶しないだけ。
    }
  };

  // 最新のレコードを取得して指摘履歴テーブルを組み立て直し、revision付きでPUTする(idea.md参照)。
  const updateTable = async (ctx, buildTable) => {
    const appId = kintone.app.getId();
    const resp = await kintone.api(
      kintone.api.url('/k/v1/record.json', true),
      'GET',
      {
        app: appId,
        id: ctx.recordId,
      },
    );
    const record = resp.record;
    const current = record[ctx.codes.table];
    if (!current) {
      throw new Error(
        '指摘履歴テーブルが見つかりません。プラグインの設定を確認してください。',
      );
    }
    const value = buildTable(current.value);
    await kintone.api(kintone.api.url('/k/v1/record.json', true), 'PUT', {
      app: appId,
      id: ctx.recordId,
      revision: record.$revision.value,
      record: { [ctx.codes.table]: { value } },
    });
  };

  const errorMessage = (err) => {
    if (err && err.code === 'GAIA_CO02') {
      return '他のユーザーがこのレコードを更新しました。画面を再読み込みしてからやり直してください。';
    }
    return (err && err.message) || String(err);
  };

  // 登録処理の共通ラッパー: ボタンを無効化 → 実行 → 成功なら再読み込み、失敗ならエラー表示。
  const setBusy = (buttonEl, busy, text) => {
    buttonEl.disabled = busy;
    buttonEl.textContent = text;
  };
  const runSave = async (buttonEl, errorEl, action) => {
    errorEl.hidden = true;
    const originalText = buttonEl.textContent;
    setBusy(buttonEl, true, '保存中...');
    try {
      await action();
      global.location.reload();
    } catch (err) {
      errorEl.textContent = errorMessage(err);
      errorEl.hidden = false;
      setBusy(buttonEl, false, originalText);
    }
  };

  const openModal = (title, bodyEl) => {
    const backdrop = el('div', 'rr-modal-backdrop');
    const modal = el('div', 'rr-modal');
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    const header = el('div', 'rr-modal-header');
    header.appendChild(el('div', 'rr-modal-title', title));
    const closeBtn = el('button', 'rr-modal-close', '×');
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', '閉じる');
    header.appendChild(closeBtn);
    modal.appendChild(header);
    const body = el('div', 'rr-modal-body');
    body.appendChild(bodyEl);
    modal.appendChild(body);
    backdrop.appendChild(modal);

    const close = () => {
      backdrop.remove();
      document.removeEventListener('keydown', onKey);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        close();
      }
    };
    closeBtn.addEventListener('click', close);
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        close();
      }
    });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(backdrop);
    return { close, modal };
  };

  const renderItemCard = (ctx, item) => {
    const card = el(
      'div',
      `rr-item ${item.resolved ? 'rr-item--resolved' : 'rr-item--unresolved'}`,
    );
    card.dataset.rowId = item.rowId;
    const head = el('div', 'rr-item-head');
    head.appendChild(
      el(
        'span',
        `rr-chip ${item.resolved ? 'rr-chip--resolved' : 'rr-chip--unresolved'}`,
        item.resolved ? '✓ 解決済み' : '✕ 未解決',
      ),
    );
    head.appendChild(
      el(
        'span',
        'rr-meta',
        `指摘: ${userName(item.pointedBy)} ${Model.formatDateTime(item.pointedAt)}`,
      ),
    );
    card.appendChild(head);
    card.appendChild(el('div', 'rr-item-comment rr-pre', item.comment));

    if (item.resolved) {
      const res = el('div', 'rr-item-resolution');
      res.appendChild(
        el(
          'div',
          'rr-meta',
          `解決: ${userName(item.resolvedBy)} ${Model.formatDateTime(item.resolvedAt)}`,
        ),
      );
      res.appendChild(el('div', 'rr-pre', item.resolution));
      card.appendChild(res);
      return card;
    }

    const form = el('div', 'rr-resolve-form');
    const textarea = el('textarea', 'rr-textarea js-rr-resolution');
    textarea.placeholder = '解決内容(どのように修正・対応したか)';
    textarea.rows = 2;
    const button = el(
      'button',
      'rr-btn rr-btn--primary js-rr-resolve',
      '解決済みにする',
    );
    button.type = 'button';
    const errorEl = el('div', 'rr-error');
    errorEl.hidden = true;
    button.addEventListener('click', () =>
      runSave(button, errorEl, () =>
        updateTable(ctx, (tableValue) =>
          Model.buildTableForResolve(tableValue, ctx.codes, {
            rowId: item.rowId,
            resolution: textarea.value,
            userCode: kintone.getLoginUser().code,
            nowIso: Model.toKintoneDateTime(new Date()),
          }),
        ),
      ),
    );
    form.append(textarea, button, errorEl);
    card.appendChild(form);
    return card;
  };

  const openFieldDialog = (ctx, target) => {
    const entry = ctx.summary[target.code] || { unresolved: [], resolved: [] };
    const body = el('div', 'rr-field-dialog');
    body.dataset.fieldCode = target.code;

    const items = entry.unresolved.concat(entry.resolved);
    if (items.length === 0) {
      body.appendChild(
        el('p', 'rr-empty', 'このフィールドへの指摘はまだありません。'),
      );
    }
    items.forEach((item) => body.appendChild(renderItemCard(ctx, item)));

    const addForm = el('div', 'rr-add-form');
    addForm.appendChild(el('div', 'rr-add-title', '新しい指摘を追加'));
    const textarea = el('textarea', 'rr-textarea js-rr-comment');
    textarea.placeholder = '指摘内容(どこを・どのように直してほしいか)';
    textarea.rows = 3;
    const button = el(
      'button',
      'rr-btn rr-btn--danger js-rr-add',
      '指摘を登録',
    );
    button.type = 'button';
    const errorEl = el('div', 'rr-error');
    errorEl.hidden = true;
    button.addEventListener('click', () =>
      runSave(button, errorEl, () =>
        updateTable(ctx, (tableValue) =>
          Model.buildTableForAdd(tableValue, ctx.codes, {
            targetCode: target.code,
            targetLabel: target.label,
            comment: textarea.value,
            userCode: kintone.getLoginUser().code,
            nowIso: Model.toKintoneDateTime(new Date()),
          }),
        ),
      ),
    );
    addForm.append(textarea, button, errorEl);
    body.appendChild(addForm);

    openModal(`「${target.label}」への指摘`, body);
    textarea.focus();
  };

  const openHistoryDialog = (ctx) => {
    const body = el('div', 'rr-history-dialog');
    if (ctx.items.length === 0) {
      body.appendChild(
        el('p', 'rr-empty', 'このレコードへの指摘はまだありません。'),
      );
      openModal('指摘履歴', body);
      return;
    }
    const filterLabel = el('label', 'rr-history-filter');
    const filter = el('input');
    filter.type = 'checkbox';
    filter.className = 'js-rr-unresolved-only';
    filterLabel.append(filter, document.createTextNode(' 未解決のみ表示'));
    body.appendChild(filterLabel);

    const table = el('table', 'rr-history-table');
    const thead = el('thead');
    const headRow = el('tr');
    [
      '対象項目',
      '指摘内容',
      '指摘者・日時',
      '解決状況',
      '解決内容',
      '対応者・日時',
    ].forEach((h) => headRow.appendChild(el('th', '', h)));
    thead.appendChild(headRow);
    table.appendChild(thead);
    const tbody = el('tbody');
    const sorted = ctx.items
      .slice()
      .sort((a, b) => String(a.pointedAt).localeCompare(String(b.pointedAt)));
    sorted.forEach((item) => {
      const tr = el(
        'tr',
        item.resolved ? 'rr-row--resolved' : 'rr-row--unresolved',
      );
      tr.appendChild(el('td', '', ctx.labelOf(item)));
      tr.appendChild(el('td', 'rr-pre', item.comment));
      tr.appendChild(
        el(
          'td',
          '',
          `${userName(item.pointedBy)}\n${Model.formatDateTime(item.pointedAt)}`,
        ),
      );
      tr.appendChild(el('td', '', item.resolved ? '✓ 解決済み' : '✕ 未解決'));
      tr.appendChild(el('td', 'rr-pre', item.resolution));
      tr.appendChild(
        el(
          'td',
          '',
          item.resolved
            ? `${userName(item.resolvedBy)}\n${Model.formatDateTime(item.resolvedAt)}`
            : '',
        ),
      );
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    body.appendChild(table);
    filter.addEventListener('change', () => {
      table.classList.toggle(
        'rr-history-table--unresolved-only',
        filter.checked,
      );
    });
    openModal(`指摘履歴(全${ctx.items.length}件)`, body);
  };

  // バッジはgetFieldElement()の要素内部に挿入せず(ドキュメント上、内部構造の変更は非推奨)、
  // body直下のオーバーレイ層に、要素の位置から計算した座標で絶対配置する。
  let repositionTimer = null;
  let repositionEntries = [];
  const reposition = () => {
    repositionEntries.forEach(({ fieldEl, wrap }) => {
      const rect = fieldEl.getBoundingClientRect();
      const visible =
        document.body.contains(fieldEl) && (rect.width > 0 || rect.height > 0);
      wrap.hidden = !visible;
      if (!visible) {
        return;
      }
      wrap.style.top = `${rect.top + global.scrollY - 10}px`;
      wrap.style.left = `${rect.right + global.scrollX - 14}px`;
    });
  };
  global.addEventListener('resize', reposition);
  document.addEventListener('scroll', reposition, true);

  const getLayer = () => {
    let layer = document.getElementById('rr-badge-layer');
    if (!layer) {
      layer = el('div', 'rr-badge-layer');
      layer.id = 'rr-badge-layer';
      document.body.appendChild(layer);
    }
    return layer;
  };

  const renderBadges = (ctx) => {
    const layer = getLayer();
    layer.textContent = '';
    repositionEntries.forEach(({ fieldEl }) => {
      fieldEl.style.outline = '';
      fieldEl.style.outlineOffset = '';
    });
    repositionEntries = [];

    ctx.targets.forEach((target) => {
      const fieldEl = kintone.app.record.getFieldElement(target.code);
      if (!fieldEl) {
        return;
      }
      const entry = ctx.summary[target.code];
      if (!entry && !ctx.reviewMode) {
        return;
      }
      const state = entry ? entry.state : 'none';
      const wrap = el('div', `rr-badge-wrap rr-badge-wrap--${state}`);
      wrap.dataset.fieldCode = target.code;
      const badge = el('button', `rr-badge rr-badge--${state}`);
      badge.type = 'button';
      if (state === 'unresolved') {
        badge.textContent = `✕ ${entry.unresolved.length}`;
        badge.setAttribute(
          'aria-label',
          `「${target.label}」の未解決の指摘 ${entry.unresolved.length}件`,
        );
        // ドキュメントで許可されているstyle属性の変更で、対象フィールドを赤枠で強調する。
        fieldEl.style.outline = '2px solid #e74c3c';
        fieldEl.style.outlineOffset = '2px';
        const tip = el('div', 'rr-tip');
        entry.unresolved.forEach((item) => {
          const line = el('div', 'rr-tip-line');
          line.appendChild(el('div', 'rr-pre', item.comment));
          line.appendChild(
            el(
              'div',
              'rr-meta',
              `${userName(item.pointedBy)} ${Model.formatDateTime(item.pointedAt)}`,
            ),
          );
          tip.appendChild(line);
        });
        wrap.appendChild(tip);
      } else if (state === 'resolved') {
        badge.textContent = '✓';
        badge.setAttribute(
          'aria-label',
          `「${target.label}」の指摘はすべて解決済み`,
        );
        badge.title = `「${target.label}」の指摘はすべて解決済みです(${entry.resolved.length}件)`;
      } else {
        badge.textContent = '＋';
        badge.setAttribute('aria-label', `「${target.label}」に指摘を追加`);
        badge.title = `「${target.label}」に指摘を追加`;
      }
      badge.addEventListener('click', () => openFieldDialog(ctx, target));
      wrap.insertBefore(badge, wrap.firstChild);
      layer.appendChild(wrap);
      repositionEntries.push({ fieldEl, wrap });
    });

    reposition();
    if (repositionTimer) {
      clearInterval(repositionTimer);
    }
    // 画像の読み込み・グループの開閉などでレイアウトが変わっても追従させる。
    repositionTimer = setInterval(reposition, 800);
  };

  const renderToolbar = (ctx) => {
    const space = kintone.app.record.getHeaderMenuSpaceElement();
    if (!space) {
      return;
    }
    space.querySelectorAll('.rr-toolbar').forEach((n) => n.remove());
    const bar = el('div', 'rr-toolbar');
    const unresolvedCount = Model.countUnresolved(ctx.items);
    bar.appendChild(
      unresolvedCount > 0
        ? el(
            'span',
            'rr-summary rr-summary--unresolved',
            `✕ 未解決の指摘 ${unresolvedCount}件`,
          )
        : el(
            'span',
            'rr-summary rr-summary--clear',
            ctx.items.length > 0
              ? '✓ 指摘はすべて解決済みです'
              : '指摘はありません',
          ),
    );
    const historyBtn = el(
      'button',
      'rr-btn js-rr-history',
      `指摘履歴(${ctx.items.length}件)`,
    );
    historyBtn.type = 'button';
    historyBtn.addEventListener('click', () => openHistoryDialog(ctx));
    bar.appendChild(historyBtn);

    const modeBtn = el('button', 'rr-btn js-rr-mode');
    modeBtn.type = 'button';
    const renderModeBtn = () => {
      modeBtn.textContent = ctx.reviewMode
        ? '指摘モード: ON'
        : '指摘モード: OFF';
      modeBtn.setAttribute('aria-pressed', ctx.reviewMode ? 'true' : 'false');
      modeBtn.classList.toggle('rr-btn--active', ctx.reviewMode);
    };
    renderModeBtn();
    modeBtn.title =
      'ONにすると、指摘がまだないフィールドにも「＋」ボタンを表示します';
    modeBtn.addEventListener('click', () => {
      ctx.reviewMode = !ctx.reviewMode;
      writeMode(ctx.reviewMode);
      renderModeBtn();
      renderBadges(ctx);
    });
    bar.appendChild(modeBtn);
    space.appendChild(bar);
  };

  kintone.events.on('app.record.detail.show', async (event) => {
    const config = await loadConfig();
    if (!NS.ConfigStore.isConfigured(config)) {
      return event;
    }
    const codes = config.fieldCodes;
    const table = event.record[codes.table];
    if (!table) {
      return event;
    }

    // getFormFields()/getFormLayout()はラップされない値(フィールドオブジェクト/レイアウト配列)を解決する
    // (CLAUDE.mdの既知の落とし穴、kintone_doc MCPで確認済み)。
    const [formFields, layout] = await Promise.all([
      kintone.app.getFormFields(),
      kintone.app.getFormLayout(),
    ]);
    const targets = NS.TargetFields.resolveTargets(
      NS.TargetFields.listTargetFields(formFields, layout, codes.table),
      config.targetFields,
    );
    const items = Model.parseRows(table.value, codes);
    const ctx = {
      recordId: event.recordId,
      codes,
      items,
      summary: Model.summarizeByField(items),
      targets,
      reviewMode: readMode(),
      labelOf: (item) =>
        (formFields[item.targetCode] && formFields[item.targetCode].label) ||
        item.targetLabel ||
        item.targetCode,
    };
    renderToolbar(ctx);
    renderBadges(ctx);
    return event;
  });
})(typeof window !== 'undefined' ? window : globalThis, kintone);
