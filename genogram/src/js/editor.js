(function (root) {
  'use strict';

  // PCの追加・編集画面のエディター。モデルを画面内に持ち、変更のたびに図を描き直す。
  // レコードへの書き込みは desktop.js が保存イベントで getModel() の結果を event.record に入れて行う
  // (kintone.app.record.set()はkintone.events.on()のハンドラー内で使えないため、保存時に一括で反映する)。

  const NS = root.Genogram;
  const { Model, Ops } = NS;
  const { h, personLabel } = NS.Renderer;
  const L = Model.LABELS;
  const DRAG_THRESHOLD = 4;

  const options = (entries, selected) =>
    entries.map(([value, label]) =>
      h('option', { value, selected: value === selected }, [label]),
    );

  const field = (label, control, extraClass) =>
    h(
      'label',
      { className: 'gng-field' + (extraClass ? ' ' + extraClass : '') },
      [h('span', { className: 'gng-field-label' }, [label]), control],
    );

  const button = (label, onclick, extraClass, disabled) =>
    h(
      'button',
      {
        type: 'button',
        className: 'gng-button' + (extraClass ? ' ' + extraClass : ''),
        onclick,
        disabled: !!disabled,
      },
      [label],
    );

  const linkButton = (label, onclick, extraClass) =>
    h(
      'button',
      {
        type: 'button',
        className: 'gng-link-button' + (extraClass ? ' ' + extraClass : ''),
        onclick,
      },
      [label],
    );

  const mountEditor = (container, initialModel, editorOptions) => {
    const opts = editorOptions || {};
    const model = initialModel;
    const state = {
      selection: null, // { type: 'person'|'union'|'relation'|'household'|'newUnion'|'newRelation'|'newHousehold', id? }
      compact: false,
      memoDraft: { targetId: '', text: '' },
      panelError: '',
    };

    const rootEl = h('div', { className: 'gng-root gng-edit' });
    const toolbarEl = h('div', { className: 'gng-toolbar' });
    const canvasEl = h('div', { className: 'gng-canvas gng-editable' });
    const panelEl = h('div', { className: 'gng-panel' });
    const listsEl = h('div', { className: 'gng-lists' });
    const memosEl = h('div', { className: 'gng-memos' });
    rootEl.appendChild(toolbarEl);
    rootEl.appendChild(
      h('div', { className: 'gng-body' }, [canvasEl, panelEl]),
    );
    rootEl.appendChild(NS.Renderer.renderLegend(false));
    rootEl.appendChild(listsEl);
    rootEl.appendChild(memosEl);
    container.textContent = '';
    container.appendChild(rootEl);

    const personById = (id) => model.persons.find((p) => p.id === id);
    const personOptions = (selected, includeEmpty) =>
      options(
        (includeEmpty ? [['', '(選択してください)']] : []).concat(
          model.persons.map((p) => [p.id, personLabel(p)]),
        ),
        selected,
      );
    const unionLabel = (u) =>
      `${personLabel(personById(u.a))} と ${personLabel(personById(u.b))}`;

    // ---- 再描画 ----

    // 選択中の人物ID(1人選択・複数選択のどちらでも配列で返す)
    const selectedPersonIds = () => {
      const sel = state.selection;
      if (!sel) {
        return [];
      }
      if (sel.type === 'person') {
        return [sel.id];
      }
      if (sel.type === 'multi') {
        return sel.ids.filter((id) => personById(id));
      }
      return [];
    };

    let lastLayout = null;
    const renderDiagram = () => {
      lastLayout = NS.Layout.layout(model);
      const svg = NS.Renderer.renderSvg(
        NS.Scene.buildScene(model, lastLayout, {
          selectedIds: selectedPersonIds(),
        }),
      );
      if (state.compact) {
        svg.setAttribute('style', 'width:100%;height:auto;');
      }
      canvasEl.textContent = '';
      if (model.persons.length === 0) {
        canvasEl.appendChild(
          h('p', { className: 'gng-empty' }, [
            '「＋ 人物を追加」から、本人(相談者)を追加してください。続けて「両親を追加」「配偶者・パートナーを追加」「子を追加」で家族を広げられます。',
          ]),
        );
      }
      canvasEl.appendChild(svg);
    };

    const refresh = (withPanel) => {
      renderDiagram();
      renderLists();
      renderMemos();
      if (withPanel) {
        renderPanel();
      }
    };

    const select = (selection) => {
      state.selection = selection;
      state.panelError = '';
      refresh(true);
    };

    // ---- ツールバー ----

    const renderToolbar = () => {
      toolbarEl.textContent = '';
      toolbarEl.appendChild(
        button(
          '＋ 人物を追加',
          () => {
            const id = Ops.addPerson(model, {});
            select({ type: 'person', id });
            focusName();
          },
          'gng-button-primary js-gng-add-person',
        ),
      );
      toolbarEl.appendChild(
        button(
          '＋ 夫婦・パートナー',
          () => select({ type: 'newUnion' }),
          'js-gng-new-union',
        ),
      );
      toolbarEl.appendChild(
        button(
          '＋ 関係',
          () => select({ type: 'newRelation' }),
          'js-gng-new-relation',
        ),
      );
      toolbarEl.appendChild(
        button(
          '＋ 同居(世帯)',
          () => select({ type: 'newHousehold' }),
          'js-gng-new-household',
        ),
      );
      toolbarEl.appendChild(h('span', { className: 'gng-toolbar-sep' }));
      toolbarEl.appendChild(
        button(
          '自動配置に戻す',
          () => {
            if (!model.persons.some((p) => p.pos)) {
              return;
            }
            if (
              window.confirm(
                'ドラッグで動かした位置をすべて解除し、自動配置に戻します。よろしいですか？',
              )
            ) {
              Ops.clearPositions(model);
              refresh(false);
            }
          },
          'js-gng-reset-layout',
        ),
      );
      toolbarEl.appendChild(
        button(
          state.compact ? '等倍で表示' : '画面幅に縮小',
          () => {
            state.compact = !state.compact;
            renderToolbar();
            renderDiagram();
          },
          'js-gng-compact',
        ),
      );
      toolbarEl.appendChild(
        button(
          '画像を保存',
          () => {
            const svg = canvasEl.querySelector('.gng-svg');
            NS.Renderer.exportPng(svg, opts.filename || 'genogram.png').catch(
              (e) => window.alert(e.message),
            );
          },
          'js-gng-png',
        ),
      );
    };

    const focusName = () => {
      const input = panelEl.querySelector('.js-gng-person-name');
      if (input) {
        input.focus();
      }
    };

    // ---- パネル(選択中の対象の編集フォーム) ----

    const panelHeader = (title) =>
      h('div', { className: 'gng-panel-head' }, [
        h('div', { className: 'gng-section-title' }, [title]),
        linkButton('閉じる', () => select(null), 'js-gng-panel-close'),
      ]);

    const panelErrorEl = () =>
      h('div', { className: 'gng-error', hidden: !state.panelError }, [
        state.panelError,
      ]);

    const renderPersonPanel = (person) => {
      const update = (fields, structural) => {
        Ops.updatePerson(model, person.id, fields);
        if (structural) {
          refresh(true);
        } else {
          renderDiagram();
          renderLists();
        }
      };
      const current = () => personById(person.id);

      const nameInput = h('input', {
        type: 'text',
        className: 'gng-input js-gng-person-name',
        value: person.name,
        maxLength: Model.LIMITS.name,
        placeholder: '例) 山田太郎',
      });
      nameInput.addEventListener('input', () =>
        update({ name: nameInput.value }),
      );
      const genderSelect = h(
        'select',
        { className: 'gng-select js-gng-person-gender' },
        options(
          Model.GENDERS.map((g) => [g, L.gender[g]]),
          person.gender,
        ),
      );
      genderSelect.addEventListener('change', () =>
        update({ gender: genderSelect.value }),
      );
      const ageInput = h('input', {
        type: 'text',
        className: 'gng-input gng-input-short js-gng-person-age',
        value: person.age,
        maxLength: Model.LIMITS.age,
        placeholder: '例) 45',
      });
      ageInput.addEventListener('input', () => update({ age: ageInput.value }));
      const deceasedBox = h('input', {
        type: 'checkbox',
        className: 'js-gng-person-deceased',
        checked: person.deceased,
      });
      deceasedBox.addEventListener('change', () =>
        update({ deceased: deceasedBox.checked }),
      );
      const clientBox = h('input', {
        type: 'checkbox',
        className: 'js-gng-person-client',
        checked: person.isClient,
      });
      clientBox.addEventListener('change', () =>
        update({ isClient: clientBox.checked }),
      );

      const parentChoices = Ops.parentOptions(model, person.id);
      let parentValue = '';
      if (person.parentUnionId) {
        parentValue = `u:${person.parentUnionId}`;
      } else if (person.parentId) {
        parentValue = `p:${person.parentId}`;
      }
      const parentSelect = h(
        'select',
        { className: 'gng-select js-gng-person-parent' },
        options(
          [['', '(なし)']]
            .concat(
              parentChoices.unions.map((u) => [
                `u:${u.id}`,
                `${unionLabel(u)} の子`,
              ]),
            )
            .concat(
              parentChoices.persons.map((p) => [
                `p:${p.id}`,
                `${personLabel(p)} の子(片親のみ)`,
              ]),
            ),
          parentValue,
        ),
      );
      parentSelect.addEventListener('change', () => {
        const v = parentSelect.value;
        update(
          {
            parentUnionId: v.startsWith('u:') ? v.slice(2) : '',
            parentId: v.startsWith('p:') ? v.slice(2) : '',
          },
          true,
        );
      });
      const childTypeSelect = h(
        'select',
        {
          className: 'gng-select js-gng-person-childtype',
          disabled: !parentValue,
        },
        options(
          Model.CHILD_TYPES.map((t) => [t, L.childType[t]]),
          person.childType,
        ),
      );
      childTypeSelect.addEventListener('change', () =>
        update({ childType: childTypeSelect.value }),
      );
      const noteInput = h('textarea', {
        className: 'gng-textarea js-gng-person-note',
        rows: 2,
        value: person.note,
        maxLength: Model.LIMITS.note,
        placeholder: '例) 会社員、要介護2',
      });
      noteInput.addEventListener('input', () =>
        update({ note: noteInput.value }),
      );

      const hasParents = !!(person.parentUnionId || person.parentId);
      return [
        panelHeader('人物'),
        field('名前', nameInput),
        h('div', { className: 'gng-field-row' }, [
          field('性別', genderSelect),
          field('年齢', ageInput),
        ]),
        h('div', { className: 'gng-field-row' }, [
          h('label', { className: 'gng-check' }, [clientBox, '本人(相談者)']),
          h('label', { className: 'gng-check' }, [deceasedBox, '死亡']),
        ]),
        field('親', parentSelect),
        field('続柄', childTypeSelect),
        field('備考(図に表示)', noteInput),
        h('div', { className: 'gng-subtitle' }, ['家族を追加']),
        h('div', { className: 'gng-actions' }, [
          button(
            '配偶者・パートナーを追加',
            () => {
              const result = Ops.addPartner(model, person.id);
              select({ type: 'person', id: result.personId });
              focusName();
            },
            'js-gng-add-partner',
          ),
          button(
            '子を追加',
            () => {
              const id = Ops.addChild(model, person.id);
              select({ type: 'person', id });
              focusName();
            },
            'js-gng-add-child',
          ),
          button(
            '両親を追加',
            () => {
              const result = Ops.addParents(model, person.id);
              if (result) {
                select({ type: 'person', id: result.fatherId });
                focusName();
              }
            },
            'js-gng-add-parents',
            hasParents,
          ),
        ]),
        h('div', { className: 'gng-subtitle' }, ['兄弟の中での並び']),
        h('div', { className: 'gng-actions' }, [
          button(
            '← 左へ',
            () => {
              Ops.moveSibling(model, person.id, -1);
              refresh(false);
            },
            'js-gng-move-left',
          ),
          button(
            '右へ →',
            () => {
              Ops.moveSibling(model, person.id, 1);
              refresh(false);
            },
            'js-gng-move-right',
          ),
          current() && current().pos
            ? button(
                'この人の位置を自動に戻す',
                () => {
                  delete current().pos;
                  refresh(true);
                },
                'js-gng-reset-pos',
              )
            : null,
        ]),
        h('div', { className: 'gng-actions gng-actions-end' }, [
          button(
            'この人へのメモを書く',
            () => {
              state.memoDraft.targetId = person.id;
              renderMemos();
              const memoText = memosEl.querySelector('.js-gng-memo-text');
              if (memoText) {
                memoText.focus();
              }
            },
            'js-gng-memo-for',
          ),
          button(
            '削除',
            () => {
              if (
                window.confirm(
                  `「${personLabel(current())}」を削除します。この人を含む夫婦・関係・同居の所属・この人へのメモも削除されます。よろしいですか？`,
                )
              ) {
                Ops.removePerson(model, person.id);
                select(null);
              }
            },
            'gng-button-danger js-gng-delete-person',
          ),
        ]),
      ];
    };

    const renderUnionPanel = (union) => {
      const statusSelect = h(
        'select',
        { className: 'gng-select js-gng-union-status' },
        options(
          Model.UNION_STATUSES.map((s) => [s, L.unionStatus[s]]),
          union.status,
        ),
      );
      statusSelect.addEventListener('change', () => {
        Ops.updateUnion(model, union.id, { status: statusSelect.value });
        refresh(false);
      });
      const noteInput = h('textarea', {
        className: 'gng-textarea js-gng-union-note',
        rows: 2,
        value: union.note,
        maxLength: Model.LIMITS.note,
        placeholder: '例) 2015年離婚',
      });
      noteInput.addEventListener('input', () => {
        Ops.updateUnion(model, union.id, { note: noteInput.value });
        renderLists();
      });
      return [
        panelHeader('夫婦・パートナー'),
        h('p', { className: 'gng-panel-desc' }, [unionLabel(union)]),
        field('関係', statusSelect),
        field('備考', noteInput),
        h('div', { className: 'gng-actions' }, [
          button(
            'この2人の子を追加',
            () => {
              const id = Ops.addPerson(model, { parentUnionId: union.id });
              select({ type: 'person', id });
              focusName();
            },
            'js-gng-union-add-child',
          ),
        ]),
        h('div', { className: 'gng-actions gng-actions-end' }, [
          button(
            '削除',
            () => {
              if (
                window.confirm(
                  `「${unionLabel(union)}」の夫婦・パートナー関係を削除します。この2人の子は親が未設定になります。よろしいですか？`,
                )
              ) {
                Ops.removeUnion(model, union.id);
                select(null);
              }
            },
            'gng-button-danger js-gng-delete-union',
          ),
        ]),
      ];
    };

    const renderRelationPanel = (relation) => {
      const kindSelect = h(
        'select',
        { className: 'gng-select js-gng-relation-kind' },
        options(
          Model.RELATION_KINDS.map((k) => [k, L.relationKind[k]]),
          relation.kind,
        ),
      );
      kindSelect.addEventListener('change', () => {
        Ops.updateRelation(model, relation.id, { kind: kindSelect.value });
        refresh(false);
      });
      const noteInput = h('textarea', {
        className: 'gng-textarea js-gng-relation-note',
        rows: 2,
        value: relation.note,
        maxLength: Model.LIMITS.note,
      });
      noteInput.addEventListener('input', () => {
        Ops.updateRelation(model, relation.id, { note: noteInput.value });
        renderLists();
      });
      return [
        panelHeader('関係'),
        h('p', { className: 'gng-panel-desc' }, [
          `${personLabel(personById(relation.a))} と ${personLabel(personById(relation.b))}`,
        ]),
        field('関係の種類', kindSelect),
        field('備考', noteInput),
        h('div', { className: 'gng-actions gng-actions-end' }, [
          button(
            '削除',
            () => {
              if (window.confirm('この関係を削除します。よろしいですか？')) {
                Ops.removeRelation(model, relation.id);
                select(null);
              }
            },
            'gng-button-danger js-gng-delete-relation',
          ),
        ]),
      ];
    };

    const memberChecklist = (selectedIds) => {
      const list = h('div', { className: 'gng-member-list' });
      model.persons.forEach((p) => {
        list.appendChild(
          h('label', { className: 'gng-check' }, [
            h('input', {
              type: 'checkbox',
              className: 'js-gng-member',
              value: p.id,
              checked: selectedIds.includes(p.id),
            }),
            personLabel(p),
          ]),
        );
      });
      return list;
    };
    const checkedMembers = (list) =>
      Array.from(list.querySelectorAll('.js-gng-member'))
        .filter((el) => el.checked)
        .map((el) => el.value);

    const renderHouseholdPanel = (household) => {
      const labelInput = h('input', {
        type: 'text',
        className: 'gng-input js-gng-household-label',
        value: household ? household.label : '同居',
        maxLength: Model.LIMITS.label,
      });
      const defaultMembers =
        state.selection && state.selection.memberHint
          ? state.selection.memberHint
          : [];
      const list = memberChecklist(
        household ? household.members : defaultMembers,
      );
      if (household) {
        const apply = () => {
          const members = checkedMembers(list);
          if (members.length === 0) {
            state.panelError =
              '1人以上選んでください(世帯を消す場合は「削除」を押してください)。';
            renderPanel();
            return;
          }
          Ops.updateHousehold(model, household.id, labelInput.value, members);
          refresh(false);
        };
        labelInput.addEventListener('input', apply);
        list.addEventListener('change', apply);
      }
      return [
        panelHeader(household ? '同居(世帯)' : '同居(世帯)を追加'),
        field('世帯名(図に表示)', labelInput),
        h('div', { className: 'gng-field-label' }, ['同居している人']),
        list,
        panelErrorEl(),
        household
          ? h('div', { className: 'gng-actions gng-actions-end' }, [
              button(
                '削除',
                () => {
                  if (
                    window.confirm(
                      'この世帯(同居の枠)を削除します。人物は削除されません。よろしいですか？',
                    )
                  ) {
                    Ops.removeHousehold(model, household.id);
                    select(null);
                  }
                },
                'gng-button-danger js-gng-delete-household',
              ),
            ])
          : h('div', { className: 'gng-actions' }, [
              button(
                '追加',
                () => {
                  const id = Ops.addHousehold(
                    model,
                    labelInput.value,
                    checkedMembers(list),
                  );
                  if (!id) {
                    state.panelError =
                      '同居している人を1人以上選んでください。';
                    renderPanel();
                    return;
                  }
                  select({ type: 'household', id });
                },
                'gng-button-primary js-gng-household-submit',
              ),
            ]),
      ];
    };

    const renderNewPairPanel = (kind) => {
      const isUnion = kind === 'union';
      const hint = state.selection.personHint || '';
      const aSelect = h(
        'select',
        { className: 'gng-select js-gng-pair-a' },
        personOptions(hint, true),
      );
      const bSelect = h(
        'select',
        { className: 'gng-select js-gng-pair-b' },
        personOptions('', true),
      );
      const typeSelect = isUnion
        ? h(
            'select',
            { className: 'gng-select js-gng-pair-type' },
            options(
              Model.UNION_STATUSES.map((s) => [s, L.unionStatus[s]]),
              'married',
            ),
          )
        : h(
            'select',
            { className: 'gng-select js-gng-pair-type' },
            options(
              Model.RELATION_KINDS.map((k) => [k, L.relationKind[k]]),
              'close',
            ),
          );
      return [
        panelHeader(isUnion ? '夫婦・パートナーを追加' : '関係を追加'),
        model.persons.length < 2
          ? h('p', { className: 'gng-panel-desc' }, [
              '先に人物を2人以上追加してください。',
            ])
          : null,
        field('1人目', aSelect),
        field('2人目', bSelect),
        field(isUnion ? '関係' : '関係の種類', typeSelect),
        panelErrorEl(),
        h('div', { className: 'gng-actions' }, [
          button(
            '追加',
            () => {
              const a = aSelect.value;
              const b = bSelect.value;
              if (!a || !b || a === b) {
                state.panelError = '異なる2人を選んでください。';
                renderPanel();
                return;
              }
              if (isUnion) {
                const id = Ops.addUnion(model, a, b, typeSelect.value);
                select({ type: 'union', id });
              } else {
                const id = Ops.addRelation(model, a, b, typeSelect.value);
                select({ type: 'relation', id });
              }
            },
            'gng-button-primary js-gng-pair-submit',
          ),
        ]),
      ];
    };

    const renderMultiPanel = (ids) => [
      panelHeader(`${ids.length}人を選択中`),
      h('p', { className: 'gng-panel-desc' }, [
        ids.map((id) => personLabel(personById(id))).join('、'),
      ]),
      h('p', { className: 'gng-panel-desc' }, [
        '選択中の人をドラッグすると、全員をまとめて動かせます。Ctrl(Macは⌘)またはShift+クリックで選択に追加・選択から外せます。',
      ]),
      h('div', { className: 'gng-actions' }, [
        button(
          '選択した人で同居(世帯)を作る',
          () => select({ type: 'newHousehold', memberHint: ids }),
          'js-gng-multi-household',
        ),
        button(
          '位置を自動に戻す',
          () => {
            Ops.clearPositions(model, ids);
            refresh(true);
          },
          'js-gng-multi-reset-pos',
          !ids.some((id) => personById(id).pos),
        ),
        button('選択を解除', () => select(null), 'js-gng-multi-clear'),
      ]),
    ];

    const renderPanel = () => {
      panelEl.textContent = '';
      const sel = state.selection;
      let content = null;
      if (sel) {
        if (sel.type === 'person') {
          const person = personById(sel.id);
          content = person ? renderPersonPanel(person) : null;
        } else if (sel.type === 'union') {
          const union = model.unions.find((u) => u.id === sel.id);
          content = union ? renderUnionPanel(union) : null;
        } else if (sel.type === 'relation') {
          const relation = model.relations.find((r) => r.id === sel.id);
          content = relation ? renderRelationPanel(relation) : null;
        } else if (sel.type === 'household') {
          const household = model.households.find((x) => x.id === sel.id);
          content = household ? renderHouseholdPanel(household) : null;
        } else if (sel.type === 'newHousehold') {
          content = renderHouseholdPanel(null);
        } else if (sel.type === 'newUnion') {
          content = renderNewPairPanel('union');
        } else if (sel.type === 'newRelation') {
          content = renderNewPairPanel('relation');
        } else if (sel.type === 'multi') {
          const ids = selectedPersonIds();
          content = ids.length > 1 ? renderMultiPanel(ids) : null;
        }
      }
      if (!content) {
        panelEl.appendChild(
          h('p', { className: 'gng-panel-desc' }, [
            '図の人物をクリックすると、ここで編集できます。人物はドラッグで位置を調整できます。Ctrl(Macは⌘)またはShiftを押しながらクリックすると複数人を選択でき、まとめてドラッグで動かせます。夫婦・関係・同居は下の一覧の「編集」から編集できます。',
          ]),
        );
        return;
      }
      content.forEach((el) => el && panelEl.appendChild(el));
    };

    // ---- 一覧(夫婦・関係・世帯) ----

    const renderLists = () => {
      listsEl.textContent = '';
      const section = (title, rows, emptyText) => {
        const list = h('ul', { className: 'gng-item-list' });
        if (rows.length === 0) {
          list.appendChild(
            h('li', { className: 'gng-memo-empty' }, [emptyText]),
          );
        }
        rows.forEach(([text, selection]) => {
          list.appendChild(
            h('li', { className: 'gng-item' }, [
              h('span', {}, [text]),
              linkButton('編集', () => select(selection), 'js-gng-list-edit'),
            ]),
          );
        });
        return h('div', { className: 'gng-list-section' }, [
          h('div', { className: 'gng-section-title' }, [title]),
          list,
        ]);
      };
      listsEl.appendChild(
        section(
          '夫婦・パートナー',
          model.unions.map((u) => [
            `${unionLabel(u)}(${L.unionStatus[u.status]})${u.note ? ' ' + u.note : ''}`,
            { type: 'union', id: u.id },
          ]),
          'まだありません。',
        ),
      );
      listsEl.appendChild(
        section(
          '関係',
          model.relations.map((r) => [
            `${personLabel(personById(r.a))} と ${personLabel(personById(r.b))}(${L.relationKind[r.kind]})${r.note ? ' ' + r.note : ''}`,
            { type: 'relation', id: r.id },
          ]),
          'まだありません。',
        ),
      );
      listsEl.appendChild(
        section(
          '同居(世帯)',
          model.households.map((x) => [
            `${x.label || '(名前なし)'}: ${x.members.map((id) => personLabel(personById(id))).join('、')}`,
            { type: 'household', id: x.id },
          ]),
          'まだありません。',
        ),
      );
    };

    // ---- メモ ----

    const renderMemos = () => {
      memosEl.textContent = '';
      memosEl.appendChild(
        h('div', { className: 'gng-section-title' }, ['メモ']),
      );
      memosEl.appendChild(
        NS.Renderer.renderMemoList(model, {
          onDelete: (memoId) => {
            if (
              window.confirm(
                'このメモを削除します。よろしいですか？(レコードを保存すると確定します)',
              )
            ) {
              Ops.removeMemo(model, memoId);
              refresh(false);
            }
          },
        }),
      );
      const draft = state.memoDraft;
      if (!model.persons.some((p) => p.id === draft.targetId)) {
        draft.targetId = '';
      }
      const targetSelect = h(
        'select',
        { className: 'gng-select js-gng-memo-target' },
        options(
          [['', '全体']].concat(
            model.persons.map((p) => [p.id, personLabel(p)]),
          ),
          draft.targetId,
        ),
      );
      targetSelect.addEventListener('change', () => {
        draft.targetId = targetSelect.value;
      });
      const textarea = h('textarea', {
        className: 'gng-textarea js-gng-memo-text',
        rows: 3,
        value: draft.text,
        maxLength: Model.LIMITS.memo,
        placeholder: 'メモを入力(例: 本人と電話。母の入院を確認)',
      });
      textarea.addEventListener('input', () => {
        draft.text = textarea.value;
      });
      memosEl.appendChild(
        h('div', { className: 'gng-memo-form' }, [
          field('対象', targetSelect),
          textarea,
          button(
            'メモを追加',
            () => {
              const id = Ops.addMemo(model, {
                targetId: draft.targetId,
                text: draft.text,
                author: opts.getAuthor ? opts.getAuthor() : {},
                at: new Date().toISOString(),
              });
              if (id) {
                state.memoDraft = { targetId: '', text: '' };
                refresh(false);
              }
            },
            'gng-button-primary js-gng-memo-add',
          ),
          h('p', { className: 'gng-hint' }, [
            '追加したメモは、レコードを保存すると確定します。',
          ]),
        ]),
      );
    };

    // ---- 図のクリック・ドラッグ ----

    let drag = null;
    let frame = 0;

    const toSvgPoint = (clientX, clientY) => {
      const svg = canvasEl.querySelector('.gng-svg');
      const ctm = svg && svg.getScreenCTM();
      if (!ctm) {
        return null;
      }
      const point = svg.createSVGPoint();
      point.x = clientX;
      point.y = clientY;
      return point.matrixTransform(ctm.inverse());
    };

    const onPointerMove = (e) => {
      if (!drag) {
        return;
      }
      if (
        !drag.moved &&
        Math.hypot(e.clientX - drag.clientX, e.clientY - drag.clientY) <
          DRAG_THRESHOLD
      ) {
        return;
      }
      drag.moved = true;
      const point = toSvgPoint(e.clientX, e.clientY);
      if (!point) {
        return;
      }
      // 複数選択中の人をつかんだ場合は選択中の全員を、それ以外はその人だけを同じ移動量で動かす
      Ops.moveGroup(
        model,
        drag.ids,
        drag.startNodes,
        point.x - drag.startX,
        point.y - drag.startY,
      );
      if (!frame) {
        frame = window.requestAnimationFrame(() => {
          frame = 0;
          renderDiagram();
        });
      }
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      if (!drag) {
        return;
      }
      const { id, moved, additive } = drag;
      drag = null;
      if (moved) {
        refresh(true);
      } else if (additive) {
        toggleInSelection(id);
      } else {
        select({ type: 'person', id });
      }
    };

    // Ctrl(Mac: ⌘)/Shift+クリックで、人物を選択に追加・選択から外す。
    const toggleInSelection = (id) => {
      const ids = selectedPersonIds();
      const next = ids.includes(id)
        ? ids.filter((x) => x !== id)
        : ids.concat([id]);
      if (next.length === 0) {
        select(null);
      } else if (next.length === 1) {
        select({ type: 'person', id: next[0] });
      } else {
        select({ type: 'multi', ids: next });
      }
    };

    const isAdditive = (e) => e.ctrlKey || e.metaKey || e.shiftKey;

    // MacのCtrl+クリックは右クリック扱いでメニューが開くため、人物の上では抑止する
    canvasEl.addEventListener('contextmenu', (e) => {
      if (e.ctrlKey && e.target.closest('[data-gtype="person"]')) {
        e.preventDefault();
      }
    });

    canvasEl.addEventListener('pointerdown', (e) => {
      const macCtrlClick = e.button === 2 && e.ctrlKey;
      if (e.button !== 0 && !macCtrlClick) {
        return;
      }
      const el = e.target.closest('[data-gtype]');
      if (!el) {
        return;
      }
      const type = el.getAttribute('data-gtype');
      const id = el.getAttribute('data-gid');
      if (type === 'person' || type === 'memo') {
        const node = lastLayout && lastLayout.nodes[id];
        const point = toSvgPoint(e.clientX, e.clientY);
        if (!node || !point) {
          return;
        }
        e.preventDefault();
        const selectedIds = selectedPersonIds();
        const ids =
          selectedIds.length > 1 && selectedIds.includes(id)
            ? selectedIds
            : [id];
        const startNodes = {};
        ids.forEach((x) => {
          if (lastLayout.nodes[x]) {
            startNodes[x] = {
              x: lastLayout.nodes[x].x,
              y: lastLayout.nodes[x].y,
            };
          }
        });
        drag = {
          id,
          ids,
          startNodes,
          additive: isAdditive(e),
          moved: false,
          clientX: e.clientX,
          clientY: e.clientY,
          startX: point.x,
          startY: point.y,
        };
        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
      } else if (
        type === 'union' ||
        type === 'relation' ||
        type === 'household'
      ) {
        select({ type, id });
      }
    });

    renderToolbar();
    refresh(true);

    return {
      root: rootEl,
      getModel: () => model,
    };
  };

  NS.Editor = { mountEditor };
})(window);
