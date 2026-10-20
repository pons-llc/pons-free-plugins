(function (root) {
  'use strict';

  // 閲覧用の表示(PCの詳細画面・印刷画面、モバイル)。図・人物の詳細・凡例・メモ一覧と、
  // options.onAddMemoを渡した場合はメモの追記フォームを出す。

  const NS = root.Genogram;
  const { h, personLabel } = NS.Renderer;
  const L = NS.Model.LABELS;

  const describeParents = (model, person) => {
    if (person.parentUnionId) {
      const union = model.unions.find((u) => u.id === person.parentUnionId);
      if (union) {
        const byId = (id) => model.persons.find((p) => p.id === id);
        return `${personLabel(byId(union.a))} と ${personLabel(byId(union.b))} の${L.childType[person.childType]}`;
      }
    }
    if (person.parentId) {
      const parent = model.persons.find((p) => p.id === person.parentId);
      return `${personLabel(parent)} の${L.childType[person.childType]}`;
    }
    return '';
  };

  const renderPersonInfo = (model, person) => {
    const rows = [
      ['名前', personLabel(person)],
      ['性別', L.gender[person.gender]],
      ['年齢', person.age],
      [
        '',
        [person.isClient ? '本人' : '', person.deceased ? '死亡' : '']
          .filter(Boolean)
          .join('・'),
      ],
      ['親', describeParents(model, person)],
      ['備考', person.note],
    ].filter(([, value]) => value);
    const dl = h('dl', { className: 'gng-info-list' });
    rows.forEach(([label, value]) => {
      dl.appendChild(h('dt', {}, [label || '状態']));
      dl.appendChild(h('dd', {}, [value]));
    });
    return dl;
  };

  // 戻り値: { root, setModel(model) }
  const mountViewer = (container, initialModel, options) => {
    const opts = options || {};
    let model = initialModel;
    let compact = !!opts.compact;
    let selectedId = '';
    let memoDraft = { targetId: '', text: '' };
    let busy = false;

    const rootEl = h('div', { className: 'gng-root gng-view' });
    container.textContent = '';
    container.appendChild(rootEl);

    const render = () => {
      rootEl.textContent = '';

      if (!opts.print) {
        const compactButton = h(
          'button',
          {
            type: 'button',
            className: 'gng-button js-gng-compact',
            onclick: () => {
              compact = !compact;
              render();
            },
          },
          [compact ? '等倍で表示' : '画面幅に縮小'],
        );
        const pngButton = h(
          'button',
          {
            type: 'button',
            className: 'gng-button js-gng-png',
            onclick: () => {
              const svg = rootEl.querySelector('.gng-svg');
              NS.Renderer.exportPng(svg, opts.filename || 'genogram.png').catch(
                (e) => window.alert(e.message),
              );
            },
          },
          ['画像を保存'],
        );
        rootEl.appendChild(
          h('div', { className: 'gng-toolbar' }, [compactButton, pngButton]),
        );
      }

      if (model.persons.length === 0) {
        rootEl.appendChild(
          h('p', { className: 'gng-empty' }, [
            opts.emptyMessage ||
              'まだ人物が登録されていません。レコードを編集して人物を追加してください。',
          ]),
        );
      }

      const svg = NS.Renderer.buildSvgFor(model, { selectedId });
      if (compact || opts.print) {
        svg.setAttribute('style', 'width:100%;height:auto;');
      }
      const canvas = h('div', { className: 'gng-canvas' }, [svg]);
      canvas.addEventListener('click', (e) => {
        const el = e.target.closest('[data-gtype]');
        if (!el) {
          selectedId = '';
          render();
          return;
        }
        const type = el.getAttribute('data-gtype');
        if (type === 'person' || type === 'memo') {
          const id = el.getAttribute('data-gid');
          selectedId = selectedId === id ? '' : id;
          render();
        }
      });
      rootEl.appendChild(canvas);

      const selected = model.persons.find((p) => p.id === selectedId);
      if (selected && !opts.print) {
        rootEl.appendChild(
          h('div', { className: 'gng-info' }, [
            h('div', { className: 'gng-section-title' }, ['人物の詳細']),
            renderPersonInfo(model, selected),
            h('div', { className: 'gng-subtitle' }, ['この人へのメモ']),
            NS.Renderer.renderMemoList(model, { filterTargetId: selected.id }),
          ]),
        );
      }

      rootEl.appendChild(NS.Renderer.renderLegend(!!opts.print));

      const memoSection = h('div', { className: 'gng-memos' }, [
        h('div', { className: 'gng-section-title' }, ['メモ']),
        NS.Renderer.renderMemoList(model),
      ]);
      if (opts.onAddMemo) {
        memoSection.appendChild(renderMemoForm());
      }
      rootEl.appendChild(memoSection);
    };

    const renderMemoForm = () => {
      const targetSelect = h(
        'select',
        { className: 'gng-select js-gng-memo-target' },
        [h('option', { value: '' }, ['全体'])],
      );
      model.persons.forEach((p) => {
        targetSelect.appendChild(
          h('option', { value: p.id }, [personLabel(p)]),
        );
      });
      targetSelect.value = model.persons.some(
        (p) => p.id === memoDraft.targetId,
      )
        ? memoDraft.targetId
        : '';
      targetSelect.addEventListener('change', () => {
        memoDraft.targetId = targetSelect.value;
      });
      const textarea = h('textarea', {
        className: 'gng-textarea js-gng-memo-text',
        rows: 3,
        placeholder: 'メモを入力(例: 本人と電話。母の入院を確認)',
        value: memoDraft.text,
        maxLength: NS.Model.LIMITS.memo,
      });
      textarea.addEventListener('input', () => {
        memoDraft.text = textarea.value;
      });
      const errorEl = h('div', { className: 'gng-error', hidden: true });
      const submit = h(
        'button',
        {
          type: 'button',
          className: 'gng-button gng-button-primary js-gng-memo-add',
        },
        ['メモを追記'],
      );
      submit.addEventListener('click', () => {
        if (busy) {
          return;
        }
        errorEl.hidden = true;
        if (!memoDraft.text.trim()) {
          errorEl.textContent = 'メモを入力してください。';
          errorEl.hidden = false;
          return;
        }
        busy = true;
        submit.disabled = true;
        Promise.resolve()
          .then(() =>
            opts.onAddMemo({
              targetId: memoDraft.targetId,
              text: memoDraft.text,
            }),
          )
          .then(() => {
            memoDraft = { targetId: '', text: '' };
          })
          .catch((e) => {
            errorEl.textContent =
              (e && e.message) || 'メモを追記できませんでした。';
            errorEl.hidden = false;
          })
          .finally(() => {
            busy = false;
            submit.disabled = false;
          });
      });
      return h('div', { className: 'gng-memo-form' }, [
        h('label', { className: 'gng-field' }, [
          h('span', { className: 'gng-field-label' }, ['対象']),
          targetSelect,
        ]),
        textarea,
        errorEl,
        submit,
      ]);
    };

    render();
    return {
      root: rootEl,
      setModel(next) {
        model = next;
        render();
      },
    };
  };

  NS.Viewer = { mountViewer, describeParents, renderPersonInfo };
})(window);
