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

  // レコード内の全テーブルの現在の行ID(行単位の指摘の「n行目」表示・存在判定に使う)。
  const rowIdsOf = (record) => {
    const result = {};
    Object.keys(record).forEach((code) => {
      const field = record[code];
      if (field && field.type === 'SUBTABLE' && Array.isArray(field.value)) {
        result[code] = field.value.map((row) => String(row.id));
      }
    });
    return result;
  };

  // 編集画面では、修正しながら確認できるよう未解決の指摘をメニュー上側に一覧表示する。
  const renderEditPanel = (items, describe) => {
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
      li.appendChild(el('strong', '', `【${describe(item)}】`));
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
        // getFormFields()はラップされない値(フィールドコードをキーにしたオブジェクト)を解決する。
        const formFields = await kintone.app.getFormFields();
        const rowIds = rowIdsOf(event.record);
        renderEditPanel(Model.parseRows(table.value, codes), (item) =>
          Model.describeTarget(
            item,
            (code) => formFields[code] && formFields[code].label,
            rowIds,
          ),
        );
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

  // 指摘履歴テーブルを更新する(v3: API実行数を抑える設計)。
  // 通常は、画面表示時のレコード(event.record)のテーブルとリビジョン番号でそのままPUTする(API 1回)。
  // 表示後に他のユーザーがレコードを更新していた場合は、kintoneがリビジョン不一致(GAIA_CO02)で拒否するので、
  // そのときだけ最新のレコードを取得(GET)してテーブルを組み立て直し、そのリビジョンでPUTし直す(計3回)。
  // buildTable()の入力チェック(内容が空など)はAPIを呼ぶ前に例外になるため、エラーで実行数を消費しない。
  const isRevisionConflict = (err) => !!(err && err.code === 'GAIA_CO02');

  const saveTable = async (ctx, buildTable) => {
    const appId = kintone.app.getId();
    const put = (revision, value) =>
      kintone.api(kintone.api.url('/k/v1/record.json', true), 'PUT', {
        app: appId,
        id: ctx.recordId,
        revision,
        record: { [ctx.codes.table]: { value } },
      });

    const firstValue = buildTable(ctx.tableValue);
    try {
      await put(ctx.revision, firstValue);
      return;
    } catch (err) {
      if (!isRevisionConflict(err)) {
        throw err;
      }
    }

    const resp = await kintone.api(
      kintone.api.url('/k/v1/record.json', true),
      'GET',
      { app: appId, id: ctx.recordId },
    );
    const current = resp.record[ctx.codes.table];
    if (!current) {
      throw new Error(
        '指摘履歴テーブルが見つかりません。プラグインの設定を確認してください。',
      );
    }
    await put(resp.record.$revision.value, buildTable(current.value));
  };

  const errorMessage = (err) => {
    if (isRevisionConflict(err)) {
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

  const renderItemCard = (ctx, item, onAction) => {
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
    // テーブル全体のダイアログには、削除された行への指摘も寄せて表示するため、行の指摘は対象行を明記する。
    if (item.targetRowId) {
      card.appendChild(el('div', 'rr-item-target', ctx.describe(item)));
    }
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

    // 解決も1件ずつ即保存せず、下書きに追加して指摘とまとめて登録する(v3)。
    const form = el('div', 'rr-resolve-form');
    const drafted = resolveDrafts.has(String(item.rowId));
    const button = el(
      'button',
      'rr-btn rr-btn--primary js-rr-add-resolve-draft',
      drafted ? '解決の下書きを編集する' : '解決内容を下書きに追加',
    );
    button.type = 'button';
    button.addEventListener('click', () => {
      if (onAction) {
        onAction();
      }
      addResolveDraft(ctx, item);
    });
    form.appendChild(button);
    card.appendChild(form);
    return card;
  };

  // ---------------------------------------------------------------------------
  // 指摘の下書き(まとめて登録)
  // 指摘は1件ずつ即保存せず、指摘モードの「＋」で下書きに追加 → 下書きパネルの「まとめて登録」で
  // 1回のPUTにまとめて登録する(idea.md「指摘の登録」)。下書きはページ内のメモリにだけ持つ。
  // ---------------------------------------------------------------------------

  const drafts = new Map(); // targetKey → { targetCode, targetLabel, targetRowId, rowSummary, comment }
  const resolveDrafts = new Map(); // 指摘履歴の行id → { rowId, label, comment, resolution }
  let draftsRecordId = null;

  const draftCount = () => drafts.size + resolveDrafts.size;

  const hasDraftText = () =>
    Array.from(drafts.values()).some((d) => d.comment.trim() !== '') ||
    Array.from(resolveDrafts.values()).some((d) => d.resolution.trim() !== '');

  global.addEventListener('beforeunload', (e) => {
    if (hasDraftText()) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  const getDraftPanel = () => {
    let panel = document.getElementById('rr-draft-panel');
    if (!panel) {
      panel = el('div', 'rr-draft-panel');
      panel.id = 'rr-draft-panel';
      panel.setAttribute('role', 'region');
      panel.setAttribute('aria-label', '指摘・解決の下書き');
      document.body.appendChild(panel);
    }
    return panel;
  };

  let renderBadges = () => {};

  // 下書きパネルの1項目(見出し+削除ボタン+補足+入力欄)。
  const buildDraftItem = (opts) => {
    const item = el('div', `rr-draft-item ${opts.className}`);
    Object.keys(opts.dataset).forEach((k) => {
      item.dataset[k] = opts.dataset[k];
    });
    const head = el('div', 'rr-draft-item-head');
    const label = el('strong', 'rr-draft-label');
    if (opts.badge) {
      label.appendChild(el('span', opts.badgeClass, opts.badge));
    }
    label.appendChild(document.createTextNode(opts.label));
    head.appendChild(label);
    const remove = el('button', 'rr-draft-remove js-rr-draft-remove', '×');
    remove.type = 'button';
    remove.setAttribute('aria-label', `「${opts.label}」の下書きを削除`);
    remove.addEventListener('click', opts.onRemove);
    head.appendChild(remove);
    item.appendChild(head);
    if (opts.note) {
      item.appendChild(el('div', 'rr-meta rr-pre', opts.note));
    }
    const textarea = el('textarea', `rr-textarea ${opts.textareaClass}`);
    textarea.placeholder = opts.placeholder;
    textarea.rows = 2;
    textarea.value = opts.value;
    textarea.addEventListener('input', () => opts.onInput(textarea.value));
    item.appendChild(textarea);
    return { item, textarea };
  };

  const renderDraftPanel = (ctx, focus) => {
    const panel = getDraftPanel();
    panel.textContent = '';
    panel.hidden = draftCount() === 0;
    if (draftCount() === 0) {
      return;
    }
    const rerender = () => {
      renderDraftPanel(ctx);
      renderBadges(ctx);
    };
    panel.appendChild(
      el(
        'div',
        'rr-draft-title',
        `下書き(指摘 ${drafts.size}件・解決 ${resolveDrafts.size}件)`,
      ),
    );
    panel.appendChild(
      el(
        'div',
        'rr-meta',
        '指摘・解決をすべて書いてから、まとめて登録してください(1回の保存で登録します)。',
      ),
    );
    const list = el('div', 'rr-draft-list');
    let focusEl = null;
    drafts.forEach((draft, key) => {
      const { item, textarea } = buildDraftItem({
        className: 'rr-draft-item--comment',
        dataset: { targetKey: key },
        badge: '指摘',
        badgeClass: 'rr-draft-kind rr-draft-kind--comment',
        label: draft.targetLabel,
        note: draft.rowSummary,
        textareaClass: 'js-rr-draft-comment',
        placeholder: '指摘内容(どこを・どのように直してほしいか)',
        value: draft.comment,
        onInput: (v) => {
          draft.comment = v;
        },
        onRemove: () => {
          drafts.delete(key);
          rerender();
        },
      });
      list.appendChild(item);
      if (focus && focus.kind === 'comment' && focus.key === key) {
        focusEl = textarea;
      }
    });
    resolveDrafts.forEach((draft, rowId) => {
      const { item, textarea } = buildDraftItem({
        className: 'rr-draft-item--resolve',
        dataset: { resolveRowId: rowId },
        badge: '解決',
        badgeClass: 'rr-draft-kind rr-draft-kind--resolve',
        label: draft.label,
        note: `指摘: ${draft.comment}`,
        textareaClass: 'js-rr-draft-resolution',
        placeholder: '解決内容(どのように修正・対応したか)',
        value: draft.resolution,
        onInput: (v) => {
          draft.resolution = v;
        },
        onRemove: () => {
          resolveDrafts.delete(rowId);
          rerender();
        },
      });
      list.appendChild(item);
      if (focus && focus.kind === 'resolve' && focus.key === rowId) {
        focusEl = textarea;
      }
    });
    panel.appendChild(list);

    const errorEl = el('div', 'rr-error');
    errorEl.hidden = true;
    panel.appendChild(errorEl);

    const footer = el('div', 'rr-draft-footer');
    const clear = el('button', 'rr-btn js-rr-draft-clear', 'すべて破棄');
    clear.type = 'button';
    clear.addEventListener('click', () => {
      drafts.clear();
      resolveDrafts.clear();
      rerender();
    });
    const submit = el(
      'button',
      'rr-btn rr-btn--danger js-rr-draft-submit',
      `まとめて登録(${draftCount()}件)`,
    );
    submit.type = 'button';
    submit.addEventListener('click', () =>
      runSave(submit, errorEl, async () => {
        const comments = Array.from(drafts.values());
        const resolutions = Array.from(resolveDrafts.values());
        const nowIso = Model.toKintoneDateTime(new Date());
        const userCode = kintone.getLoginUser().code;
        await saveTable(ctx, (tableValue) =>
          Model.buildTableForBatch(tableValue, ctx.codes, {
            comments,
            resolutions,
            userCode,
            nowIso,
          }),
        );
        // 保存できたので、再読み込み時に「未保存の下書き」警告を出さない。
        drafts.clear();
        resolveDrafts.clear();
      }),
    );
    footer.append(clear, submit);
    panel.appendChild(footer);

    if (focusEl) {
      focusEl.focus();
    }
  };

  const addDraft = (ctx, target) => {
    if (!drafts.has(target.key)) {
      drafts.set(target.key, {
        targetCode: target.code,
        targetLabel: target.label,
        targetRowId: target.rowId || '',
        rowSummary: target.rowSummary || '',
        comment: '',
      });
    }
    renderDraftPanel(ctx, { kind: 'comment', key: target.key });
    renderBadges(ctx);
  };

  const addResolveDraft = (ctx, item) => {
    const rowId = String(item.rowId);
    if (!resolveDrafts.has(rowId)) {
      resolveDrafts.set(rowId, {
        rowId,
        label: ctx.describe(item),
        comment: item.comment,
        resolution: '',
      });
    }
    renderDraftPanel(ctx, { kind: 'resolve', key: rowId });
    renderBadges(ctx);
  };

  // ---------------------------------------------------------------------------
  // ダイアログ(対象ごとの指摘・解決/指摘履歴)
  // ---------------------------------------------------------------------------

  const openTargetDialog = (ctx, target) => {
    const entry = ctx.summary[target.key] || { unresolved: [], resolved: [] };
    const body = el('div', 'rr-field-dialog');
    body.dataset.targetKey = target.key;

    const items = entry.unresolved.concat(entry.resolved);
    if (items.length === 0) {
      body.appendChild(
        el('p', 'rr-empty', 'この項目への指摘はまだありません。'),
      );
    }
    let closeDialog = null;
    items.forEach((item) =>
      body.appendChild(renderItemCard(ctx, item, () => closeDialog())),
    );

    const addArea = el('div', 'rr-add-form');
    const addBtn = el(
      'button',
      'rr-btn js-rr-dialog-add-draft',
      drafts.has(target.key)
        ? '下書きを編集する'
        : 'この項目への指摘を下書きに追加',
    );
    addBtn.type = 'button';
    addArea.appendChild(addBtn);
    addArea.appendChild(
      el(
        'div',
        'rr-meta',
        '指摘・解決は下書きに追加し、画面右下の下書きパネルからまとめて登録します。',
      ),
    );
    body.appendChild(addArea);

    const { close } = openModal(`「${target.label}」への指摘`, body);
    closeDialog = close;
    addBtn.addEventListener('click', () => {
      close();
      addDraft(ctx, target);
    });
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
      tr.appendChild(el('td', '', ctx.describe(item)));
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

  // ---------------------------------------------------------------------------
  // バッジ(フィールド・テーブルの行)
  // バッジはgetFieldElement()の要素内部に挿入せず(ドキュメント上、内部構造の変更は非推奨)、
  // body直下のオーバーレイ層に、要素の位置から計算した座標で絶対配置する。
  // ---------------------------------------------------------------------------

  let repositionTimer = null;
  let repositionEntries = [];
  // 対象の要素が、スクロールでkintoneの固定ヘッダー等の下に隠れているかどうか。要素の左上の点に
  // 実際に表示されている要素を調べ、対象要素(またはこのプラグインの表示物)でなければ隠れているとみなす。
  // 画面外(elementFromPointがnull)の場合も表示しない(スクロールで画面内に入ると再計算される)。
  const isCovered = (anchorEl, rect) => {
    const hit = document.elementFromPoint(rect.left + 2, rect.top + 2);
    if (!hit) {
      return true;
    }
    return !(
      anchorEl.contains(hit) ||
      hit.closest('#rr-badge-layer, #rr-draft-panel, .rr-modal-backdrop')
    );
  };

  const reposition = () => {
    repositionEntries.forEach(({ anchorEl, wrap, placement }) => {
      const rect = anchorEl.getBoundingClientRect();
      const visible =
        document.body.contains(anchorEl) &&
        (rect.width > 0 || rect.height > 0) &&
        !isCovered(anchorEl, rect);
      wrap.hidden = !visible;
      if (!visible) {
        return;
      }
      if (placement === 'row') {
        // 行はテーブルの右外側、行の高さの中央に置く。
        wrap.style.top = `${rect.top + global.scrollY + rect.height / 2 - 13}px`;
        wrap.style.left = `${rect.right + global.scrollX + 6}px`;
      } else {
        wrap.style.top = `${rect.top + global.scrollY - 10}px`;
        wrap.style.left = `${rect.right + global.scrollX - 14}px`;
      }
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

  const buildTip = (entry) => {
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
    return tip;
  };

  // 1つの対象(フィールド or 行)のバッジ群を作る。指摘がなく指摘モードOFFなら何も出さない。
  const buildWrap = (ctx, target) => {
    const entry = ctx.summary[target.key];
    if (!entry && !ctx.reviewMode) {
      return null;
    }
    const wrap = el('div', 'rr-badge-wrap');
    wrap.dataset.targetKey = target.key;

    if (entry) {
      const badge = el('button', `rr-badge rr-badge--${entry.state}`);
      badge.type = 'button';
      if (entry.state === 'unresolved') {
        badge.textContent = `✕ ${entry.unresolved.length}`;
        badge.setAttribute(
          'aria-label',
          `「${target.label}」の未解決の指摘 ${entry.unresolved.length}件`,
        );
      } else {
        badge.textContent = '✓';
        badge.setAttribute(
          'aria-label',
          `「${target.label}」の指摘はすべて解決済み`,
        );
        badge.title = `「${target.label}」の指摘はすべて解決済みです(${entry.resolved.length}件)`;
      }
      badge.addEventListener('click', () => openTargetDialog(ctx, target));
      wrap.appendChild(badge);
    }

    if (ctx.reviewMode) {
      const drafted = drafts.has(target.key);
      const add = el(
        'button',
        `rr-badge rr-badge--add${drafted ? ' rr-badge--drafted' : ''}`,
        drafted ? '✎' : '＋',
      );
      add.type = 'button';
      const action = drafted ? '下書きを編集' : '指摘を下書きに追加';
      add.setAttribute('aria-label', `「${target.label}」の${action}`);
      add.title = `「${target.label}」の${action}`;
      add.addEventListener('click', () => addDraft(ctx, target));
      wrap.appendChild(add);
    }

    if (entry && entry.state === 'unresolved') {
      wrap.appendChild(buildTip(entry));
    }
    return wrap;
  };

  renderBadges = (ctx) => {
    const layer = getLayer();
    layer.textContent = '';
    repositionEntries.forEach(({ anchorEl, placement }) => {
      if (placement === 'field') {
        anchorEl.style.outline = '';
        anchorEl.style.outlineOffset = '';
      }
    });
    repositionEntries = [];

    const place = (target, anchorEl, placement) => {
      const wrap = buildWrap(ctx, target);
      if (!wrap) {
        return;
      }
      wrap.classList.add(`rr-badge-wrap--${placement}`);
      layer.appendChild(wrap);
      repositionEntries.push({ anchorEl, wrap, placement });
    };

    ctx.targets.forEach((target) => {
      const fieldEl = kintone.app.record.getFieldElement(target.code);
      if (!fieldEl) {
        return;
      }
      const entry = ctx.summary[target.key];
      if (entry && entry.state === 'unresolved') {
        // ドキュメントで許可されているstyle属性の変更で、対象フィールドを赤枠で強調する。
        fieldEl.style.outline = '2px solid #e74c3c';
        fieldEl.style.outlineOffset = '2px';
      }
      place(target, fieldEl, 'field');
      (ctx.rowTargets[target.code] || []).forEach((rowTarget) => {
        place(rowTarget, rowTarget.rowEl, 'row');
      });
    });

    reposition();
    if (repositionTimer) {
      clearInterval(repositionTimer);
    }
    // 画像の読み込み・グループの開閉などでレイアウトが変わっても追従させる。
    repositionTimer = setInterval(reposition, 800);
  };

  // テーブルの各行の要素。getFieldElement()はテーブルに対して<table>を返し、tbody直下の<tr>が
  // レコードの行の並び順と一致する(実機で確認済み)。内部構造は読み取るだけで変更しない。
  // 行数が一致しない(kintoneの内部構造が変わった等)場合はnullを返し、行の指摘はテーブル単位に寄せる。
  const findRowElements = (tableEl, count) => {
    if (!tableEl || tableEl.tagName !== 'TABLE') {
      return null;
    }
    const tbody = Array.from(tableEl.children).find(
      (child) => child.tagName === 'TBODY',
    );
    const rows = tbody
      ? Array.from(tbody.children).filter((child) => child.tagName === 'TR')
      : [];
    return rows.length === count && count > 0 ? rows : null;
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
      'ONにすると、各フィールド・テーブルの各行に「＋」を表示し、指摘を下書きに追加できます(まとめて登録)';
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
    const labelOf = (code) => formFields[code] && formFields[code].label;
    const rowIdsByTable = rowIdsOf(event.record);

    // 行単位の指摘は「対象行ID」列(v2で追加)があるときだけ受け付ける。v1のまま設定を再保存していない
    // アプリでは、フィールド・テーブル単位の指摘のみ(設定画面で保存すると列が追加される)。
    const reviewTableDef = formFields[codes.table];
    const canRowComment = !!(
      codes.targetRowId &&
      reviewTableDef &&
      reviewTableDef.fields &&
      reviewTableDef.fields[codes.targetRowId]
    );

    const targets = NS.TargetFields.resolveTargets(
      NS.TargetFields.listTargetFields(formFields, layout, codes.table),
      config.targetFields,
    ).map((f) => ({ ...f, key: f.code, rowId: '' }));

    // 行のバッジを置ける(行要素が取得できた)テーブルの行だけを、行単位の対象にする。
    const rowTargets = {};
    const locatableRowIds = {};
    targets
      .filter((t) => t.type === 'SUBTABLE')
      .forEach((t) => {
        const rows = event.record[t.code] ? event.record[t.code].value : [];
        const rowEls = findRowElements(
          kintone.app.record.getFieldElement(t.code),
          rows.length,
        );
        if (!rowEls) {
          return;
        }
        locatableRowIds[t.code] = rowIdsByTable[t.code];
        rowTargets[t.code] = canRowComment
          ? rows.map((row, i) => ({
              code: t.code,
              rowId: String(row.id),
              key: Model.targetKey(t.code, String(row.id)),
              label: Model.rowLabel(t.label, i),
              rowSummary: Model.rowSummary(row),
              type: 'ROW',
              rowEl: rowEls[i],
            }))
          : [];
      });

    const items = Model.parseRows(table.value, codes);
    // 別のレコードへ移動した場合は、前のレコードの下書きを捨てる。
    if (draftsRecordId !== String(event.recordId)) {
      drafts.clear();
      resolveDrafts.clear();
      draftsRecordId = String(event.recordId);
    }
    const ctx = {
      recordId: event.recordId,
      // 保存時はまずこのテーブル・リビジョンでPUTする(GETを省いてAPI実行数を1回に抑える。saveTable参照)。
      revision: event.record.$revision.value,
      tableValue: table.value,
      codes,
      items,
      summary: Model.summarizeByTarget(items, locatableRowIds),
      targets,
      rowTargets,
      reviewMode: readMode(),
      describe: (item) => Model.describeTarget(item, labelOf, rowIdsByTable),
    };
    renderToolbar(ctx);
    renderBadges(ctx);
    renderDraftPanel(ctx);
    return event;
  });
})(typeof window !== 'undefined' ? window : globalThis, kintone);
