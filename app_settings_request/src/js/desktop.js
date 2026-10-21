((PLUGIN_ID) => {
  'use strict';

  const NS = window.AppSettingsRequest;
  const { CODES, SPACER_ELEMENT_ID } = NS.FieldDefs;
  const { Operations, TargetFields, ChangeRequest, ApiPath } = NS;
  const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  // プラグインが自動入力するフィールド(手で書き換えさせない)。
  const AUTO_FIELDS = [
    CODES.appId,
    CODES.appName,
    CODES.fieldLabel,
    CODES.operation,
    CODES.result,
    CODES.appliedAt,
  ];

  // 画面の要素はすべて createElement + textContent で組み立てる(innerHTMLは使わない)。
  const el = (tag, attrs, children) => {
    const node = document.createElement(tag);
    Object.keys(attrs || {}).forEach((key) => {
      if (key === 'text') {
        node.textContent = attrs[key];
      } else if (key === 'className') {
        node.className = attrs[key];
      } else {
        node.setAttribute(key, attrs[key]);
      }
    });
    (children || []).forEach((child) => child && node.appendChild(child));
    return node;
  };

  const clear = (node) => {
    while (node.firstChild) {
      node.removeChild(node.firstChild);
    }
  };

  const ownAppId = String(kintone.app.getId());

  // --- 対象アプリの情報取得(いずれも実行ユーザーの権限。kintone自身へのREST APIのみ) ---

  // 複数のアプリの情報を取得するAPIは、ゲストスペースIDなしのURLでも閲覧できるゲストスペースの
  // アプリを返す(ドキュメントの補足)ため、常に /k/v1/apps.json を使う。
  const searchApps = async (keyword) => {
    const resp = await kintone.api('/k/v1/apps.json', 'GET', {
      name: keyword,
      limit: 100,
    });
    return resp.apps;
  };

  const getAppById = async (id) => {
    const resp = await kintone.api('/k/v1/apps.json', 'GET', { ids: [id] });
    return resp.apps[0] || null;
  };

  // 所属スペースがゲストスペースなら、REST APIのパスにゲストスペースIDが必要になる。
  const resolveGuestSpaceId = async (app) => {
    if (!app.spaceId) {
      return '';
    }
    try {
      const space = await kintone.api('/k/v1/space.json', 'GET', {
        id: app.spaceId,
      });
      return space.isGuest ? String(app.spaceId) : '';
    } catch {
      // スペースの情報を見られない場合は通常のスペースとして扱う(フィールド取得で失敗すればそこで分かる)。
      return '';
    }
  };

  // REST APIのレスポンスは {properties, revision} にラップされている
  // (JavaScript APIのkintone.app.getFormFields()とは異なる)。
  const fetchTargetProperties = async (appId, guestSpaceId) => {
    const resp = await kintone.api(
      ApiPath.buildApiPath('/k/v1/app/form/fields.json', guestSpaceId),
      'GET',
      { app: appId },
    );
    return resp.properties;
  };

  // --- 追加/編集画面: 依頼の入力UI ---

  const state = {
    app: null, // { id, name, guestSpaceId }
    properties: null,
    items: [],
    item: null,
    operation: '',
    readValue: null, // 現在の入力欄から値を読む関数
    targetKind: 'field', // 'field'(フィールド) か 'view'(一覧)
    viewEditor: null, // view-editor.js の入力欄
  };

  const buildEditor = (space, initialChange) => {
    clear(space);
    const root = el('div', { className: 'asr-editor' });
    space.appendChild(root);

    const errorEl = el('div', { className: 'asr-error', role: 'alert' });

    // 1. 対象アプリ
    const keywordInput = el('input', {
      type: 'text',
      className: 'asr-input asr-js-keyword',
      placeholder: 'アプリ名の一部',
    });
    const searchButton = el('button', {
      type: 'button',
      className: 'asr-button asr-js-search',
      text: '検索',
    });
    const idInput = el('input', {
      type: 'text',
      className: 'asr-input asr-input-short asr-js-app-id',
      placeholder: 'アプリID',
      inputmode: 'numeric',
    });
    const idButton = el('button', {
      type: 'button',
      className: 'asr-button asr-js-load-id',
      text: 'IDで指定',
    });
    const resultsSelect = el('select', {
      className: 'asr-select asr-js-app-results',
      size: '6',
    });
    resultsSelect.hidden = true;
    const appStatus = el('div', { className: 'asr-status asr-js-app-status' });

    // 2. 変更の対象(フィールド / 一覧)
    const kindName = 'asr-target-kind';
    const kindRadios = [
      ['field', 'フィールド'],
      ['view', '一覧'],
    ].map(([value, label]) => {
      const radio = el('input', {
        type: 'radio',
        name: kindName,
        value,
        className: 'asr-js-target-kind',
      });
      radio.checked = value === 'field';
      return {
        radio,
        node: el('label', { className: 'asr-choice' }, [
          radio,
          el('span', { text: label }),
        ]),
      };
    });
    const fieldArea = el('div', { className: 'asr-field-area' });
    const viewArea = el('div', { className: 'asr-view-area' });
    viewArea.hidden = true;

    // 対象フィールド
    const fieldSelect = el('select', {
      className: 'asr-select asr-js-field',
    });
    fieldSelect.disabled = true;

    // 3. 変更内容
    const opSelect = el('select', { className: 'asr-select asr-js-operation' });
    opSelect.disabled = true;
    const currentEl = el('div', { className: 'asr-current asr-js-current' });

    // 4. 変更後の値
    const valueArea = el('div', { className: 'asr-value asr-js-value' });
    const warningsEl = el('ul', { className: 'asr-warnings' });

    const section = (title, children) =>
      el(
        'div',
        { className: 'asr-section' },
        [el('div', { className: 'asr-section-title', text: title })].concat(
          children,
        ),
      );

    root.appendChild(
      el('div', { className: 'asr-heading', text: 'アプリ設定の変更依頼' }),
    );
    root.appendChild(errorEl);
    root.appendChild(
      section('1. 対象アプリ', [
        el('div', { className: 'asr-row' }, [
          keywordInput,
          searchButton,
          el('span', { className: 'asr-or', text: 'または' }),
          idInput,
          idButton,
        ]),
        resultsSelect,
        appStatus,
      ]),
    );
    root.appendChild(
      section('2. 変更の対象', [
        el(
          'div',
          { className: 'asr-row' },
          kindRadios.map((k) => k.node),
        ),
      ]),
    );
    fieldArea.appendChild(section('3. 対象フィールド', [fieldSelect]));
    fieldArea.appendChild(section('4. 変更内容', [opSelect, currentEl]));
    fieldArea.appendChild(section('5. 変更後', [valueArea, warningsEl]));
    root.appendChild(fieldArea);
    root.appendChild(viewArea);

    const showError = (message) => {
      errorEl.textContent = message || '';
    };

    // 一覧の入力欄は対象アプリを読み込んだ後に作る(アプリを選び直したら作り直す)。
    const renderViewArea = (restoreChange) => {
      clear(viewArea);
      state.viewEditor = null;
      if (!state.app) {
        viewArea.appendChild(
          el('div', {
            className: 'asr-help',
            text: '先に対象アプリを選択してください。',
          }),
        );
        return;
      }
      state.viewEditor = NS.ViewEditor.create({
        app: state.app,
        properties: state.properties,
        restoreChange,
        onError: showError,
      });
      viewArea.appendChild(state.viewEditor.node);
    };

    const setTargetKind = (kind, restoreChange) => {
      state.targetKind = kind;
      kindRadios.forEach((k) => {
        k.radio.checked = k.radio.value === kind;
      });
      fieldArea.hidden = kind !== 'field';
      viewArea.hidden = kind !== 'view';
      if (kind === 'view') {
        renderViewArea(restoreChange);
      }
    };

    kindRadios.forEach((k) =>
      k.radio.addEventListener('change', () => {
        if (k.radio.checked) {
          showError('');
          setTargetKind(k.radio.value);
        }
      }),
    );

    const resetOperation = () => {
      clear(opSelect);
      opSelect.disabled = true;
      currentEl.textContent = '';
      clear(valueArea);
      clear(warningsEl);
      state.operation = '';
      state.readValue = null;
    };

    // valueは入力欄の生値(readValue()の戻り値)。選択肢の変更は削除の有無を判定するため変更前も渡す。
    const renderWarnings = (op, value) => {
      clear(warningsEl);
      const def = state.item ? state.item.def : null;
      Operations.warningsFor(
        op,
        Operations.normalizeInput(op, value),
        def ? Operations.currentValue(op, def) : null,
      ).forEach((w) => warningsEl.appendChild(el('li', { text: w })));
    };

    // 選択肢の変更の入力欄。既存の選択肢ごとに「新しい名前」「並べ替え」「削除」を指定でき、
    // 新しい選択肢を追加できる。名前を変えた選択肢はキーに変更前の名前を付けて送るため、
    // 既存レコードの値・絞り込み条件もkintoneが書き換える(option-changes.js参照)。
    const buildOptionsEditor = (currentLabels, restoreEntries, onChange) => {
      const list = el('div', { className: 'asr-options' });

      const addRow = ({ from, label, deleted }) => {
        const input = el('input', {
          type: 'text',
          className: 'asr-input asr-js-option-label',
          'aria-label': from
            ? `「${from}」の新しい名前`
            : '追加する選択肢の名前',
        });
        input.value = label;
        const up = el('button', {
          type: 'button',
          className: 'asr-icon-button asr-js-option-up',
          'aria-label': '上へ',
          text: '↑',
        });
        const down = el('button', {
          type: 'button',
          className: 'asr-icon-button asr-js-option-down',
          'aria-label': '下へ',
          text: '↓',
        });
        const row = el('div', { className: 'asr-option-row' }, [
          el('span', {
            className: 'asr-option-from',
            text: from ? `変更前: ${from}` : '追加',
          }),
          input,
          up,
          down,
        ]);
        row.dataset.from = from;
        if (from) {
          const box = el('input', {
            type: 'checkbox',
            className: 'asr-js-option-delete',
          });
          box.checked = !!deleted;
          const sync = () => {
            row.classList.toggle('asr-option-deleted', box.checked);
            input.disabled = box.checked;
          };
          sync();
          box.addEventListener('change', () => {
            sync();
            onChange();
          });
          row.appendChild(
            el('label', { className: 'asr-choice' }, [
              box,
              el('span', { text: '削除' }),
            ]),
          );
        } else {
          const remove = el('button', {
            type: 'button',
            className: 'asr-link-button asr-js-option-remove',
            text: '取り消し',
          });
          remove.addEventListener('click', () => {
            row.remove();
            onChange();
          });
          row.appendChild(remove);
        }
        up.addEventListener('click', () => {
          if (row.previousElementSibling) {
            list.insertBefore(row, row.previousElementSibling);
            onChange();
          }
        });
        down.addEventListener('click', () => {
          if (row.nextElementSibling) {
            list.insertBefore(row.nextElementSibling, row);
            onChange();
          }
        });
        input.addEventListener('input', onChange);
        list.appendChild(row);
        return input;
      };

      if (restoreEntries) {
        restoreEntries.forEach((x) => addRow({ ...x, deleted: false }));
        // 依頼時に削除を指定した選択肢は、削除にチェックした状態で末尾に並べる。
        currentLabels
          .filter((l) => !restoreEntries.some((x) => x.from === l))
          .forEach((l) => addRow({ from: l, label: l, deleted: true }));
      } else {
        currentLabels.forEach((l) => addRow({ from: l, label: l }));
      }

      const addButton = el('button', {
        type: 'button',
        className: 'asr-button asr-js-option-add',
        text: '選択肢を追加',
      });
      addButton.addEventListener('click', () => {
        addRow({ from: '', label: '' }).focus();
        onChange();
      });

      const readRows = () =>
        Array.from(list.querySelectorAll('.asr-option-row')).map((row) => {
          const box = row.querySelector('.asr-js-option-delete');
          return {
            from: row.dataset.from,
            label: row.querySelector('.asr-js-option-label').value,
            deleted: !!(box && box.checked),
          };
        });

      return { nodes: [list, addButton], readRows };
    };

    // 変更内容ごとの入力欄。readValue()は変更内容JSONに保存する形(normalizeInput前の生値)を返す。
    const renderValueInput = (op, def, initial) => {
      clear(valueArea);
      const current = Operations.currentValue(op, def);
      const value = initial === undefined ? current : initial;
      let readValue;

      if (Operations.BOOLEAN_LABELS[op]) {
        const labels = Operations.BOOLEAN_LABELS[op];
        // 初期表示は「現在と逆」(変更依頼なので)。
        const selected = initial === undefined ? !current : !!initial;
        const name = `asr-bool-${op}`;
        [true, false].forEach((v) => {
          const radio = el('input', {
            type: 'radio',
            name,
            value: String(v),
            className: 'asr-js-bool',
          });
          radio.checked = v === selected;
          radio.addEventListener('change', () => renderWarnings(op, v));
          valueArea.appendChild(
            el('label', { className: 'asr-choice' }, [
              radio,
              el('span', { text: labels[String(v)] }),
            ]),
          );
        });
        readValue = () => {
          const checked = valueArea.querySelector('input.asr-js-bool:checked');
          return checked ? checked.value === 'true' : null;
        };
      } else if (op === 'options') {
        const editor = buildOptionsEditor(
          current,
          initial === undefined ? null : initial,
          () => renderWarnings(op, editor.readRows()),
        );
        editor.nodes.forEach((node) => valueArea.appendChild(node));
        valueArea.appendChild(
          el('div', {
            className: 'asr-help',
            text: '名前を書き換えると「名前の変更」になり、既存レコードの値も新しい名前に変わります。↑↓で並び順を変えられます。',
          }),
        );
        readValue = editor.readRows;
      } else if (op === 'length' || op === 'range') {
        const minInput = el('input', {
          type: 'text',
          className: 'asr-input asr-input-short asr-js-min',
        });
        const maxInput = el('input', {
          type: 'text',
          className: 'asr-input asr-input-short asr-js-max',
        });
        minInput.value = (value && value.min) || '';
        maxInput.value = (value && value.max) || '';
        valueArea.appendChild(
          el('div', { className: 'asr-row' }, [
            el('span', { text: '最小' }),
            minInput,
            el('span', { text: '最大' }),
            maxInput,
          ]),
        );
        valueArea.appendChild(
          el('div', {
            className: 'asr-help',
            text: '空欄は「制限なし」です。',
          }),
        );
        readValue = () => ({ min: minInput.value, max: maxInput.value });
      } else if (op === 'delete') {
        const confirmBox = el('input', {
          type: 'checkbox',
          className: 'asr-js-delete-confirm',
        });
        confirmBox.checked = initial !== undefined;
        valueArea.appendChild(
          el('label', { className: 'asr-choice' }, [
            confirmBox,
            el('span', {
              text: 'このフィールドを削除することを確認しました(データも削除されます)',
            }),
          ]),
        );
        readValue = () => (confirmBox.checked ? null : undefined);
      } else if (op === 'defaultValue' && def.options) {
        const labels = Operations.optionLabels(def);
        if (Operations.MULTI_VALUE_TYPES.has(def.type)) {
          labels.forEach((label) => {
            const box = el('input', {
              type: 'checkbox',
              value: label,
              className: 'asr-js-default-multi',
            });
            box.checked = (value || []).includes(label);
            valueArea.appendChild(
              el('label', { className: 'asr-choice' }, [
                box,
                el('span', { text: label }),
              ]),
            );
          });
          readValue = () =>
            Array.from(
              valueArea.querySelectorAll('input.asr-js-default-multi:checked'),
            ).map((b) => b.value);
        } else {
          const select = el('select', {
            className: 'asr-select asr-js-default-select',
          });
          if (def.type !== 'RADIO_BUTTON') {
            select.appendChild(el('option', { value: '', text: '(なし)' }));
          }
          labels.forEach((label) =>
            select.appendChild(el('option', { value: label, text: label })),
          );
          select.value = value || '';
          valueArea.appendChild(select);
          readValue = () => select.value;
        }
      } else {
        const multiline =
          op === 'defaultValue' && def.type === 'MULTI_LINE_TEXT';
        const input = multiline
          ? el('textarea', { className: 'asr-textarea asr-js-text', rows: '4' })
          : el('input', { type: 'text', className: 'asr-input asr-js-text' });
        input.value = value === null || value === undefined ? '' : value;
        valueArea.appendChild(input);
        readValue = () => input.value;
      }

      renderWarnings(op, readValue());
      state.readValue = readValue;
    };

    const selectOperation = (op, initialValue) => {
      state.operation = op;
      const def = state.item.def;
      const current = Operations.currentValue(op, def);
      currentEl.textContent =
        op === 'delete'
          ? ''
          : `現在: ${op === 'options' ? current.join(' / ') : Operations.formatValue(op, current)}`;
      renderValueInput(op, def, initialValue);
    };

    const selectField = (key, restoreChange) => {
      resetOperation();
      state.item = state.items.find((i) => i.key === key) || null;
      if (!state.item) {
        return;
      }
      const ops = Operations.applicableOperations(state.item.def);
      ops.forEach((op) =>
        opSelect.appendChild(
          el('option', { value: op, text: Operations.operationName(op) }),
        ),
      );
      opSelect.disabled = ops.length === 0;
      const op =
        restoreChange && ops.includes(restoreChange.operation)
          ? restoreChange.operation
          : ops[0];
      if (op) {
        opSelect.value = op;
        selectOperation(op, restoreChange ? restoreChange.after : undefined);
      }
    };

    const loadApp = async (app, restoreChange) => {
      showError('');
      if (String(app.appId) === ownAppId) {
        showError('この依頼アプリ自身は対象にできません。');
        return;
      }
      appStatus.textContent = '対象アプリのフィールドを読み込んでいます…';
      clear(fieldSelect);
      fieldSelect.disabled = true;
      resetOperation();
      state.app = null;
      state.item = null;
      try {
        const guestSpaceId = await resolveGuestSpaceId(app);
        const properties = await fetchTargetProperties(app.appId, guestSpaceId);
        state.app = {
          id: String(app.appId),
          name: app.name,
          guestSpaceId,
        };
        state.properties = properties;
        state.items = TargetFields.flattenFields(properties);
      } catch (err) {
        appStatus.textContent = '';
        showError(
          `対象アプリのフィールドを取得できませんでした: ${ApiPath.describeApiError(err)}`,
        );
        return;
      }
      appStatus.textContent = `選択中: ${state.app.name}(アプリID: ${state.app.id}${state.app.guestSpaceId ? `、ゲストスペースID: ${state.app.guestSpaceId}` : ''})`;
      fieldSelect.appendChild(
        el('option', { value: '', text: '-- フィールドを選択 --' }),
      );
      state.items.forEach((item) =>
        fieldSelect.appendChild(
          el('option', {
            value: item.key,
            text: TargetFields.displayName(item),
          }),
        ),
      );
      fieldSelect.disabled = false;
      if (
        restoreChange &&
        NS.ViewChanges.isViewOperation(restoreChange.operation)
      ) {
        setTargetKind('view', restoreChange);
        return;
      }
      if (state.targetKind === 'view') {
        renderViewArea();
      }
      if (restoreChange) {
        const f = restoreChange.field;
        const key = f.subtableCode ? `${f.subtableCode}/${f.code}` : f.code;
        if (state.items.some((i) => i.key === key)) {
          fieldSelect.value = key;
          selectField(key, restoreChange);
        } else {
          showError(
            `依頼していたフィールド「${ChangeRequest.fieldText(f)}」が対象アプリに見つかりません。選び直してください。`,
          );
        }
      }
    };

    let foundApps = [];
    const showResults = (keyword, apps) => {
      clear(resultsSelect);
      foundApps = apps;
      resultsSelect.hidden = apps.length === 0;
      if (apps.length === 0) {
        showError(`「${keyword}」を含むアプリが見つかりませんでした。`);
        return;
      }
      apps.forEach((a) =>
        resultsSelect.appendChild(
          el('option', {
            value: a.appId,
            text: `${a.name}(アプリID: ${a.appId})`,
          }),
        ),
      );
    };

    resultsSelect.addEventListener('change', () => {
      const app = foundApps.find(
        (a) => String(a.appId) === resultsSelect.value,
      );
      if (app) {
        loadApp(app);
      }
    });

    searchButton.addEventListener('click', async () => {
      showError('');
      const keyword = keywordInput.value.trim();
      if (!keyword) {
        showError('アプリ名の一部を入力してください。');
        return;
      }
      try {
        const apps = (await searchApps(keyword)).filter(
          (a) => String(a.appId) !== ownAppId,
        );
        showResults(keyword, apps);
      } catch (err) {
        showError(
          `アプリを検索できませんでした: ${ApiPath.describeApiError(err)}`,
        );
      }
    });

    keywordInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        searchButton.click();
      }
    });

    idButton.addEventListener('click', async () => {
      showError('');
      const id = idInput.value.trim();
      if (!/^[1-9][0-9]*$/.test(id)) {
        showError('アプリIDは正の整数で入力してください。');
        return;
      }
      try {
        const app = await getAppById(id);
        if (!app) {
          showError(
            `アプリID ${id} のアプリが見つからないか、閲覧権限がありません。`,
          );
          return;
        }
        resultsSelect.hidden = true;
        loadApp(app);
      } catch (err) {
        showError(
          `アプリを取得できませんでした: ${ApiPath.describeApiError(err)}`,
        );
      }
    });

    fieldSelect.addEventListener('change', () =>
      selectField(fieldSelect.value),
    );
    opSelect.addEventListener('change', () => selectOperation(opSelect.value));

    if (initialChange) {
      // 編集画面: 保存済みの依頼内容を復元する(フィールドは最新の定義を取り直す)。
      idInput.value = initialChange.app.id;
      getAppById(initialChange.app.id)
        .then((app) => {
          if (!app) {
            showError(
              `依頼していたアプリ(ID: ${initialChange.app.id})が見つからないか、閲覧権限がありません。`,
            );
            return null;
          }
          return loadApp(app, initialChange);
        })
        .catch((err) =>
          showError(
            `アプリを取得できませんでした: ${ApiPath.describeApiError(err)}`,
          ),
        );
    }
  };

  // 入力内容から変更内容JSONを組み立てる。エラーなら { error }。
  const buildChangeFromState = () => {
    if (!state.app) {
      return { error: '対象アプリを選択してください。' };
    }
    if (state.targetKind === 'view') {
      return state.viewEditor
        ? state.viewEditor.buildChange()
        : { error: '一覧の変更内容を入力してください。' };
    }
    if (!state.item) {
      return { error: '対象フィールドを選択してください。' };
    }
    if (!state.operation || !state.readValue) {
      return { error: '変更内容を選択してください。' };
    }
    const op = state.operation;
    const def = state.item.def;
    const raw = state.readValue();
    if (op === 'delete' && raw === undefined) {
      return { error: '削除の確認にチェックを入れてください。' };
    }
    const value = Operations.normalizeInput(op, raw);
    const error = Operations.validateValue(op, value, def, {
      existingCodes: TargetFields.collectCodes(state.properties),
    });
    if (error) {
      return { error };
    }
    const before = Operations.currentValue(op, def);
    const unchanged =
      op === 'options'
        ? NS.OptionChanges.isNoop(before, value)
        : JSON.stringify(before) === JSON.stringify(value);
    if (op !== 'delete' && unchanged) {
      return { error: '変更後の値が現在と同じです。' };
    }
    return {
      change: ChangeRequest.buildChange({
        app: state.app,
        field: {
          code: state.item.code,
          label: state.item.label,
          type: state.item.type,
          subtableCode: state.item.subtableCode,
        },
        operation: op,
        before: op === 'delete' ? null : before,
        after: value,
      }),
      itemName: TargetFields.displayName(state.item),
    };
  };

  kintone.events.on(
    ['app.record.create.show', 'app.record.edit.show'],
    (event) => {
      AUTO_FIELDS.forEach((code) => {
        if (event.record[code]) {
          event.record[code].disabled = true;
        }
      });
      kintone.app.record.setFieldShown(CODES.changeJson, false);
      const space = kintone.app.record.getSpaceElement(SPACER_ELEMENT_ID);
      if (!space) {
        return event;
      }
      const parsed =
        event.type === 'app.record.edit.show' && event.record[CODES.changeJson]
          ? ChangeRequest.parseChange(event.record[CODES.changeJson].value)
          : { ok: false };
      buildEditor(space, parsed.ok ? parsed.change : null);
      return event;
    },
  );

  kintone.events.on(
    ['app.record.create.submit', 'app.record.edit.submit'],
    (event) => {
      if (!kintone.app.record.getSpaceElement(SPACER_ELEMENT_ID)) {
        event.error =
          '依頼の入力欄(スペース)が見つかりません。プラグインの設定画面で設定を保存し直してください。';
        return event;
      }
      const built = buildChangeFromState();
      if (built.error) {
        event.error = built.error;
        return event;
      }
      const { change, itemName } = built;
      const r = event.record;
      r[CODES.appId].value = change.app.id;
      r[CODES.appName].value = change.app.name;
      r[CODES.fieldLabel].value = itemName;
      r[CODES.operation].value = ChangeRequest.summarize(change).operationName;
      r[CODES.changeJson].value = ChangeRequest.serialize(change);
      return event;
    },
  );

  // --- 詳細画面: 依頼内容の表示(JSONから毎回生成するため、表示内容=反映される内容) ---

  // 依頼内容の表(+警告)。詳細画面と、完了アクション前の確認ダイアログで共用する。
  const buildSummaryNodes = (change) => {
    const s = ChangeRequest.summarize(change);
    const row = (label, value, className) =>
      el('tr', {}, [
        el('th', { text: label }),
        el('td', { className: className || '', text: value }),
      ]);
    const appLink = el('a', {
      href: `/k/${change.app.guestSpaceId ? `guest/${change.app.guestSpaceId}/` : ''}${change.app.id}/`,
      target: '_blank',
      rel: 'noopener',
      text: s.appText,
    });
    const nodes = [
      el('table', { className: 'asr-summary' }, [
        el('tbody', {}, [
          el('tr', {}, [
            el('th', { text: '対象アプリ' }),
            el('td', {}, [appLink]),
          ]),
          row(s.targetLabel, s.targetText),
          row('変更内容', s.operationName),
          row('変更前', s.beforeText, 'asr-pre'),
          row('変更後', s.afterText, 'asr-pre asr-after'),
        ]),
      ]),
    ];
    if (s.warnings.length > 0) {
      const ul = el('ul', { className: 'asr-warnings' });
      s.warnings.forEach((w) => ul.appendChild(el('li', { text: w })));
      nodes.push(ul);
    }
    return nodes;
  };

  // 完了アクション前の確認ダイアログ。body要素はcreateElement+textContentのみで組み立てる
  // (createDialogのbodyはそのまま組み込まれるため。ドキュメントの注意事項)。
  const confirmChange = async (change) => {
    const body = el('div', { className: 'asr-confirm' }, [
      el('p', {
        className: 'asr-confirm-lead',
        text: '次の内容で対象アプリの設定を変更し、運用環境へ反映(アプリを更新)します。よろしいですか？',
      }),
      ...buildSummaryNodes(change),
      el('p', {
        className: 'asr-help',
        text: '反映はあなたの権限で行われます(対象アプリの管理権限が必要です)。キャンセルするとステータスは変わりません。',
      }),
    ]);
    const dialog = await kintone.createDialog({
      title: '変更内容の確認',
      body,
      okButtonText: '反映する',
      showCancelButton: true,
      cancelButtonText: 'キャンセル',
      showCloseButton: true,
    });
    return (await dialog.show()) === 'OK';
  };

  const renderDetail = (space, record) => {
    clear(space);
    const root = el('div', { className: 'asr-detail' });
    space.appendChild(root);
    root.appendChild(el('div', { className: 'asr-heading', text: '依頼内容' }));
    const parsed = ChangeRequest.parseChange(
      record[CODES.changeJson] ? record[CODES.changeJson].value : '',
    );
    if (!parsed.ok) {
      root.appendChild(
        el('div', { className: 'asr-error', text: parsed.error }),
      );
      return;
    }
    buildSummaryNodes(parsed.change).forEach((node) => root.appendChild(node));
    if (!(record[CODES.appliedAt] && record[CODES.appliedAt].value)) {
      root.appendChild(
        el('div', {
          className: 'asr-help',
          text: `ステータスを「${config.completeStatus}」にするアクションを実行すると、実行したユーザーの権限で対象アプリへ反映し、運用環境へ反映します(対象アプリの管理権限が必要です)。`,
        }),
      );
    }
  };

  kintone.events.on('app.record.detail.show', (event) => {
    kintone.app.record.setFieldShown(CODES.changeJson, false);
    const space = kintone.app.record.getSpaceElement(SPACER_ELEMENT_ID);
    if (space) {
      renderDetail(space, event.record);
    }
    return event;
  });

  // --- 「完了」へのアクション: 対象アプリへの反映 ---

  kintone.events.on('app.record.detail.process.proceed', async (event) => {
    if (!NS.ProcessSetup.isCompletingAction(event, config.completeStatus)) {
      return event;
    }
    const handled = await NS.handleCompletingAction({
      event,
      ownAppId,
      confirm: confirmChange,
      showLoading: (visible) =>
        kintone.showLoading(visible ? 'VISIBLE' : 'HIDDEN'),
    });
    if (handled.cancelled) {
      // falseを返すとアクションがキャンセルされる(ステータスは変わらない)。
      return false;
    }
    if (!handled.ok) {
      // 画面上部にエラーを表示するとアクションはキャンセルされる(ステータスは変わらない)。
      // eventはこのハンドラーの引数で、await中に差し替わることはないためrequire-atomic-updatesは誤検知。
      // eslint-disable-next-line require-atomic-updates
      event.error = handled.error;
      return event;
    }
    return handled.event;
  });
})(kintone.$PLUGIN_ID);
