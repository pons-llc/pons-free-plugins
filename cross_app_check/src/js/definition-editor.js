(function (global) {
  'use strict';

  const NS = global.CrossAppCheck;

  // レコード詳細画面に出す「突合設定」の編集UI。
  // 突合の定義はプラグイン設定ではなくレコード単位に持つので、設定画面もレコードの中にある。
  //
  // アプリの指定は「レコード一覧のURLを貼る」方式にしている。
  // 一覧画面で絞り込んでからURLをコピーすれば、アプリIDと絞り込み条件が同時に決まるため、
  // 利用者がクエリ記法を覚える必要がない([[list-url]])。
  //
  // 描画はすべてcreateElement/textContentで行う(innerHTMLは使わない)。
  const el = (tagName, className, text) => {
    const node = document.createElement(tagName);
    if (className) {
      node.className = className;
    }
    if (text !== undefined && text !== null) {
      node.textContent = String(text);
    }
    return node;
  };

  const input = (className, placeholder) => {
    const node = document.createElement('input');
    node.type = 'text';
    node.className = `kintoneplugin-input-text ${className}`;
    if (placeholder) {
      node.placeholder = placeholder;
    }
    return node;
  };

  const select = (className) => {
    const node = document.createElement('select');
    node.className = `kintoneplugin-select ${className}`;
    node.disabled = true;
    return node;
  };

  const buildOptions = (selectEl, fields, selectedCode, placeholder) => {
    selectEl.textContent = '';
    const blank = el('option', null, placeholder || '(選択してください)');
    blank.value = '';
    selectEl.appendChild(blank);
    fields.forEach((field) => {
      const option = el('option', null, `${field.label} (${field.code})`);
      option.value = field.code;
      if (field.code === selectedCode) {
        option.selected = true;
      }
      selectEl.appendChild(option);
    });
  };

  const selectableFields = (properties, predicate) =>
    Object.keys(properties || {})
      .map((code) => properties[code])
      .filter((field) => field.type !== 'SUBTABLE')
      .filter((field) => predicate(field.type))
      .sort((a, b) => (a.label > b.label ? 1 : -1));

  // 表示名は値が1つ読めれば何でもよいので、装飾系・複数値系だけ除く
  const NON_VALUE_TYPES = [
    'SUBTABLE',
    'REFERENCE_TABLE',
    'GROUP',
    'LABEL',
    'SPACER',
    'HR',
    'CATEGORY',
    'STATUS_ASSIGNEE',
    'FILE',
  ];
  const isDisplayableType = (type) => NON_VALUE_TYPES.indexOf(type) === -1;

  // 貼られたURLからアプリID・絞り込み条件を確定し、そのアプリのフィールド一覧を読む。
  // `view=`しか付いていないURLでは、一覧に保存された絞り込み条件をAPIで引いて補う。
  const resolveFromUrl = async (rawUrl) => {
    const parsed = NS.ListUrl.parse(rawUrl);
    if (!parsed.ok) {
      throw new Error(parsed.error);
    }
    const viewFilterCond = parsed.viewId
      ? await NS.RecordsClient.fetchViewFilterCond(parsed.appId, parsed.viewId)
      : '';
    const [properties, appName] = await Promise.all([
      NS.RecordsClient.fetchFormFields(parsed.appId),
      NS.RecordsClient.fetchAppName(parsed.appId),
    ]);
    return {
      appId: parsed.appId,
      appName,
      viewId: parsed.viewId,
      query: NS.ListUrl.combineQuery(viewFilterCond, parsed.query),
      properties,
      sourceUrl: String(rawUrl).trim(),
    };
  };

  const create = (container, options) => {
    const definition = NS.DefinitionStore.normalize(options.definition);
    const currentAppId = String(options.currentAppId);
    const onSaved = options.onSaved || (() => {});

    // アプリIDごとのフィールド一覧。突合キーのフィールドタイプを引くのにも使う。
    const propertiesByAppId = {};

    const root = el('div', 'cac-editor');
    const toggle = el('button', 'cac-editor-toggle', '突合設定');
    toggle.type = 'button';
    const body = el('div', 'cac-editor-body');
    const targetList = el('div', 'cac-editor-targets');
    const errorBox = el('p', 'cac-editor-error');
    errorBox.hidden = true;
    const statusBox = el('p', 'cac-editor-status');
    statusBox.hidden = true;

    const setOpen = (open) => {
      body.hidden = !open;
      toggle.setAttribute('aria-expanded', String(open));
      toggle.textContent = open ? '突合設定 ▲' : '突合設定 ▼';
    };

    const setError = (messages) => {
      if (!messages || messages.length === 0) {
        errorBox.textContent = '';
        errorBox.hidden = true;
        return;
      }
      errorBox.textContent = messages.join(' / ');
      errorBox.hidden = false;
    };

    const setStatus = (text) => {
      statusBox.textContent = text || '';
      statusBox.hidden = !text;
    };

    const fieldTypeOf = (appId, fieldCode) => {
      const properties = propertiesByAppId[appId];
      if (!properties || !fieldCode || !properties[fieldCode]) {
        return '';
      }
      return properties[fieldCode].type;
    };

    // --- 基準アプリ ---

    const baseUrlInput = input(
      'cac-base-url',
      '例) https://example.cybozu.com/k/12/?view=...',
    );
    const baseLoadButton = el(
      'button',
      'kintoneplugin-button-normal cac-base-load',
      'このURLから読み込む',
    );
    baseLoadButton.type = 'button';
    const baseStatus = el('span', 'cac-note cac-base-status');
    const baseKeySelect = select('cac-base-key');
    const baseNameSelect = select('cac-base-name');
    const baseQueryNote = el('p', 'cac-note cac-base-query');

    const renderBaseQueryNote = () => {
      baseQueryNote.textContent = `絞り込み条件: ${NS.ListUrl.describe(definition.baseApp.query)}`;
    };

    const applyBaseResolved = (resolved, keep) => {
      propertiesByAppId[resolved.appId] = resolved.properties;
      definition.baseApp.appId = resolved.appId;
      definition.baseApp.appName = resolved.appName;
      definition.baseApp.viewId = resolved.viewId;
      definition.baseApp.query = resolved.query;
      definition.baseApp.sourceUrl = resolved.sourceUrl;

      buildOptions(
        baseKeySelect,
        selectableFields(resolved.properties, NS.MatchKey.isSelectableKeyType),
        keep ? definition.baseApp.keyFieldCode : '',
      );
      buildOptions(
        baseNameSelect,
        selectableFields(resolved.properties, isDisplayableType),
        keep ? definition.baseApp.nameFieldCode : '',
        '(なし)',
      );
      baseKeySelect.disabled = false;
      baseNameSelect.disabled = false;
      if (!keep) {
        definition.baseApp.keyFieldCode = '';
        definition.baseApp.nameFieldCode = '';
      }
      baseStatus.textContent = `${resolved.appName || `アプリ${resolved.appId}`} を読み込みました。`;
      renderBaseQueryNote();
    };

    const loadBase = async (rawUrl, keep) => {
      baseStatus.textContent = '読み込み中...';
      try {
        applyBaseResolved(await resolveFromUrl(rawUrl), keep);
      } catch (err) {
        baseKeySelect.disabled = true;
        baseNameSelect.disabled = true;
        baseStatus.textContent = `読み込めませんでした: ${(err && err.message) || err}`;
      }
    };

    const buildBaseSection = () => {
      const section = el('section', 'cac-editor-section');
      section.appendChild(
        el('h4', 'cac-editor-heading', '基準アプリ(対象者の母集団)'),
      );
      section.appendChild(
        el(
          'p',
          'cac-note',
          '対象者一覧になるアプリのレコード一覧URLを貼り付けます。一覧画面で絞り込んでからURLをコピーすると、その絞り込み条件がそのまま使われます。',
        ),
      );

      const urlRow = el('div', 'cac-editor-row');
      urlRow.appendChild(el('span', 'cac-editor-label', '一覧のURL'));
      urlRow.appendChild(baseUrlInput);
      urlRow.appendChild(baseLoadButton);
      section.appendChild(urlRow);
      section.appendChild(baseStatus);
      section.appendChild(baseQueryNote);

      const keyRow = el('div', 'cac-editor-row');
      keyRow.appendChild(el('span', 'cac-editor-label', '突合キー'));
      keyRow.appendChild(baseKeySelect);
      keyRow.appendChild(
        el(
          'span',
          'cac-note',
          '個人番号・宛名番号など、人を一意に特定できるフィールド',
        ),
      );
      section.appendChild(keyRow);

      const nameRow = el('div', 'cac-editor-row');
      nameRow.appendChild(el('span', 'cac-editor-label', '表示名'));
      nameRow.appendChild(baseNameSelect);
      nameRow.appendChild(
        el('span', 'cac-note', '結果一覧に併記する氏名など(任意)'),
      );
      section.appendChild(nameRow);

      baseLoadButton.addEventListener('click', () => {
        loadBase(baseUrlInput.value, false);
      });
      baseKeySelect.addEventListener('change', () => {
        definition.baseApp.keyFieldCode = baseKeySelect.value;
        definition.baseApp.keyFieldType = fieldTypeOf(
          definition.baseApp.appId,
          baseKeySelect.value,
        );
      });
      baseNameSelect.addEventListener('change', () => {
        definition.baseApp.nameFieldCode = baseNameSelect.value;
      });

      return section;
    };

    // --- 対象アプリ ---

    const renumberTargets = () => {
      Array.from(targetList.querySelectorAll('.cac-editor-target')).forEach(
        (row, position) => {
          row.querySelector('.cac-target-title').textContent =
            `対象アプリ${position + 1}`;
        },
      );
    };

    const addTargetSection = (target) => {
      const model = target || NS.DefinitionStore.createTarget();
      const section = el('section', 'cac-editor-section cac-editor-target');

      const heading = el('div', 'cac-editor-target-heading');
      heading.appendChild(el('span', 'cac-target-title', '対象アプリ'));
      const removeButton = el('span', 'cac-row-remove', '削除');
      heading.appendChild(removeButton);
      section.appendChild(heading);

      const urlInput = input(
        'cac-target-url',
        '例) https://example.cybozu.com/k/13/?view=...',
      );
      const loadButton = el(
        'button',
        'kintoneplugin-button-normal cac-target-load',
        'このURLから読み込む',
      );
      loadButton.type = 'button';
      const status = el('span', 'cac-note cac-target-status');
      const keySelect = select('cac-target-key');
      const dateSelect = select('cac-target-date');
      const labelInput = input('cac-target-label', '例) 面談');
      const queryNote = el('p', 'cac-note cac-target-query');

      const renderQueryNote = () => {
        queryNote.textContent = `絞り込み条件: ${NS.ListUrl.describe(model.query)}`;
      };

      const urlRow = el('div', 'cac-editor-row');
      urlRow.appendChild(el('span', 'cac-editor-label', '一覧のURL'));
      urlRow.appendChild(urlInput);
      urlRow.appendChild(loadButton);
      section.appendChild(urlRow);
      section.appendChild(status);
      section.appendChild(queryNote);

      const keyRow = el('div', 'cac-editor-row');
      keyRow.appendChild(el('span', 'cac-editor-label', '突合キー'));
      keyRow.appendChild(keySelect);
      section.appendChild(keyRow);

      const dateRow = el('div', 'cac-editor-row');
      dateRow.appendChild(el('span', 'cac-editor-label', '提出日'));
      dateRow.appendChild(dateSelect);
      dateRow.appendChild(
        el('span', 'cac-note', '結果一覧に最終提出日を出す場合(任意)'),
      );
      section.appendChild(dateRow);

      const labelRow = el('div', 'cac-editor-row');
      labelRow.appendChild(el('span', 'cac-editor-label', '表示ラベル'));
      labelRow.appendChild(labelInput);
      labelRow.appendChild(
        el(
          'span',
          'cac-note',
          '結果一覧の列見出し。空欄ならアプリ名を使います',
        ),
      );
      section.appendChild(labelRow);

      const applyResolved = (resolved, keep) => {
        propertiesByAppId[resolved.appId] = resolved.properties;
        model.appId = resolved.appId;
        model.appName = resolved.appName;
        model.viewId = resolved.viewId;
        model.query = resolved.query;
        model.sourceUrl = resolved.sourceUrl;

        buildOptions(
          keySelect,
          selectableFields(
            resolved.properties,
            NS.MatchKey.isSelectableKeyType,
          ),
          keep ? model.keyFieldCode : '',
        );
        buildOptions(
          dateSelect,
          selectableFields(
            resolved.properties,
            NS.MatchKey.isSelectableDateType,
          ),
          keep ? model.dateFieldCode : '',
          '(なし)',
        );
        keySelect.disabled = false;
        dateSelect.disabled = false;
        if (!keep) {
          model.keyFieldCode = '';
          model.dateFieldCode = '';
        }
        status.textContent = `${resolved.appName || `アプリ${resolved.appId}`} を読み込みました。`;
        renderQueryNote();
      };

      const load = async (rawUrl, keep) => {
        status.textContent = '読み込み中...';
        try {
          applyResolved(await resolveFromUrl(rawUrl), keep);
        } catch (err) {
          keySelect.disabled = true;
          dateSelect.disabled = true;
          status.textContent = `読み込めませんでした: ${(err && err.message) || err}`;
        }
      };

      loadButton.addEventListener('click', () => {
        load(urlInput.value, false);
      });
      keySelect.addEventListener('change', () => {
        model.keyFieldCode = keySelect.value;
        model.keyFieldType = fieldTypeOf(model.appId, keySelect.value);
      });
      dateSelect.addEventListener('change', () => {
        model.dateFieldCode = dateSelect.value;
      });
      labelInput.addEventListener('input', () => {
        model.label = labelInput.value.trim();
      });
      removeButton.addEventListener('click', () => {
        const position = definition.targets.indexOf(model);
        if (position !== -1) {
          definition.targets.splice(position, 1);
        }
        section.remove();
        renumberTargets();
      });

      if (definition.targets.indexOf(model) === -1) {
        definition.targets.push(model);
      }

      urlInput.value = model.sourceUrl || '';
      labelInput.value = model.label || '';
      renderQueryNote();

      targetList.appendChild(section);
      renumberTargets();

      if (model.sourceUrl) {
        load(model.sourceUrl, true);
      }
      return section;
    };

    // --- 保存 ---

    const saveButton = el(
      'button',
      'kintoneplugin-button-dialog-ok cac-editor-save',
      '設定を保存',
    );
    saveButton.type = 'button';

    saveButton.addEventListener('click', async () => {
      const validation = NS.DefinitionValidation.validate(
        definition,
        currentAppId,
      );
      if (!validation.ok) {
        setError(validation.errors);
        setStatus('');
        return;
      }
      setError(null);
      saveButton.disabled = true;
      setStatus('保存しています...');
      try {
        await NS.ReconcileRunner.saveDefinition(
          options.summaryAppId,
          options.summaryRecordId,
          definition,
        );
        setStatus('設定を保存しました。「突合を実行」で突合できます。');
        onSaved(NS.DefinitionStore.normalize(definition));
      } catch (err) {
        setStatus('');
        setError([`保存に失敗しました: ${(err && err.message) || err}`]);
      } finally {
        saveButton.disabled = false;
      }
    });

    // --- 組み立て ---

    const targetsSection = el('section', 'cac-editor-section');
    targetsSection.appendChild(
      el('h4', 'cac-editor-heading', '対象アプリ(提出状況を調べるアプリ)'),
    );
    targetsSection.appendChild(
      el(
        'p',
        'cac-note',
        '基準アプリの人が「出しているかどうか」を調べるアプリです。複数指定できます。',
      ),
    );
    targetsSection.appendChild(targetList);
    const addTargetButton = el(
      'button',
      'kintoneplugin-button-normal cac-target-add',
      '+ 対象アプリを追加',
    );
    addTargetButton.type = 'button';
    addTargetButton.addEventListener('click', () => {
      addTargetSection(null);
    });
    targetsSection.appendChild(addTargetButton);

    body.appendChild(buildBaseSection());
    body.appendChild(targetsSection);
    body.appendChild(errorBox);
    body.appendChild(statusBox);
    body.appendChild(saveButton);

    toggle.addEventListener('click', () => {
      setOpen(body.hidden);
    });

    root.appendChild(toggle);
    root.appendChild(body);
    container.appendChild(root);

    // 保存済みの設定を画面へ戻す。
    // 対象アプリは addTargetSection が definition.targets へ push し直すので、
    // いったん空にしてから元の並びで作り直す。
    const restoreSavedDefinition = () => {
      baseUrlInput.value = definition.baseApp.sourceUrl || '';
      renderBaseQueryNote();
      if (definition.baseApp.sourceUrl) {
        loadBase(definition.baseApp.sourceUrl, true);
      }
      const existingTargets = definition.targets.slice();
      definition.targets.length = 0;
      existingTargets.forEach((target) => {
        addTargetSection(target);
      });
      if (definition.targets.length === 0) {
        addTargetSection(null);
      }
    };

    restoreSavedDefinition();

    // 未設定のレコードでは開いた状態で出す(何をすればよいか分かるように)
    setOpen(NS.DefinitionStore.isEmpty(definition));

    return {
      getDefinition: () => NS.DefinitionStore.normalize(definition),
      open: () => setOpen(true),
    };
  };

  NS.DefinitionEditor = { create, resolveFromUrl };
})(typeof window !== 'undefined' ? window : globalThis);
