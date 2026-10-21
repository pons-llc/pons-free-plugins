(() => {
  'use strict';

  // 追加/編集画面の「一覧」の依頼の入力欄(作成・修正・削除)。desktop.jsから呼ぶ。
  // 作成・修正の絞り込み条件・並び順は、一覧画面のURLを貼り付けて変換する(query-url.js参照)。
  const NS = window.AppSettingsRequest;
  const { ViewChanges, QueryUrl, ApiPath } = NS;

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

  // フォームの配置順で表示フィールドの候補を並べるため、レイアウトを取得する({layout, revision}にラップされている)。
  const fetchLayout = async (app) => {
    try {
      const resp = await kintone.api(
        ApiPath.buildApiPath('/k/v1/app/form/layout.json', app.guestSpaceId),
        'GET',
        { app: app.id },
      );
      return resp.layout;
    } catch {
      return null;
    }
  };

  const fetchProcessEnabled = async (app) => {
    try {
      const resp = await kintone.api(
        ApiPath.buildApiPath('/k/v1/app/status.json', app.guestSpaceId),
        'GET',
        { app: app.id },
      );
      return resp.enable === true;
    } catch {
      return false;
    }
  };

  // REST APIのレスポンスは {views, revision} にラップされている。
  const fetchLiveViews = async (app) => {
    const resp = await kintone.api(
      ApiPath.buildApiPath('/k/v1/app/views.json', app.guestSpaceId),
      'GET',
      { app: app.id },
    );
    return resp.views;
  };

  // 一覧画面のURLを同一オリジンの非表示iframeで開き、そのページのkintone.app.getQueryCondition()/
  // getQuery()(公式のJavaScript API)でフィールドコードの条件・並び順に変換する。
  // 一覧画面のURLは条件を内部のフィールドIDで持ち、IDとコードの対応を返す公開APIが無いため
  // (query-url.js冒頭のコメント参照)。iframeで開くのは検証済みの一覧画面のパスだけ。
  const CONVERT_TIMEOUT_MS = 30000;

  const convertListUrl = (src) =>
    new Promise((resolve, reject) => {
      const iframe = el('iframe', {
        className: 'asr-hidden-frame',
        title: '一覧の条件の変換',
        'aria-hidden': 'true',
      });
      iframe.src = src;
      const started = Date.now();
      const finish = (fn, value) => {
        iframe.remove();
        fn(value);
      };
      const poll = () => {
        let w = null;
        try {
          w = iframe.contentWindow;
          const app = w && w.kintone && w.kintone.app;
          const query = app && app.getQuery && app.getQuery();
          if (query) {
            finish(resolve, {
              filterCond: app.getQueryCondition() || '',
              sort: QueryUrl.splitQuery(query).sort,
            });
            return;
          }
        } catch {
          // 読み込み中(まだkintoneのAPIが使えない)
        }
        if (Date.now() - started > CONVERT_TIMEOUT_MS) {
          finish(
            reject,
            new Error(
              '一覧画面を読み込めませんでした。URLが正しいか、対象アプリを閲覧できるか確認してください。',
            ),
          );
          return;
        }
        setTimeout(poll, 300);
      };
      document.body.appendChild(iframe);
      poll();
    });

  // app: { id, name, guestSpaceId }、properties: 対象アプリのフィールド定義、restoreChange: 編集画面で復元する依頼。
  // 戻り値の buildChange() は { change, itemName } か { error } を返す。
  const create = ({ app, properties, restoreChange, onError }) => {
    const root = el('div', { className: 'asr-view-editor' });
    const state = {
      views: null,
      view: null,
      converted: null,
      confirmDelete: false,
      processEnabled: false,
      layout: null,
    };
    // 表示フィールドの候補と初期値(view-changes.js の listableFields)
    const candidates = () =>
      ViewChanges.listableFields(
        properties,
        state.layout,
        state.processEnabled,
      );

    const opSelect = el('select', {
      className: 'asr-select asr-js-view-op',
    });
    ViewChanges.VIEW_OPERATIONS.forEach((op) =>
      opSelect.appendChild(el('option', { value: op.id, text: op.name })),
    );
    const viewSelect = el('select', { className: 'asr-select asr-js-view' });
    const viewRow = el('div', { className: 'asr-section' }, [
      el('div', { className: 'asr-section-title', text: '対象の一覧' }),
      viewSelect,
    ]);
    const currentEl = el('div', {
      className: 'asr-current asr-js-view-current',
    });
    const body = el('div', { className: 'asr-view-body' });
    const warningsEl = el('ul', { className: 'asr-warnings' });

    root.appendChild(
      el('div', { className: 'asr-section' }, [
        el('div', { className: 'asr-section-title', text: '変更内容' }),
        opSelect,
      ]),
    );
    root.appendChild(viewRow);
    root.appendChild(currentEl);
    root.appendChild(body);
    root.appendChild(warningsEl);

    const renderWarnings = () => {
      clear(warningsEl);
      ViewChanges.warningsFor(opSelect.value).forEach((w) =>
        warningsEl.appendChild(el('li', { text: w })),
      );
    };

    let nameInput = null;
    let urlInput = null;
    let convertedEl = null;
    let fieldsBox = null;

    const renderFieldCheckboxes = (checkedCodes) => {
      clear(fieldsBox);
      const defs = candidates().fields;
      const order = (code) => {
        const i = checkedCodes.indexOf(code);
        return i === -1 ? checkedCodes.length : i;
      };
      defs
        .slice()
        .sort((a, b) => order(a.code) - order(b.code))
        .forEach((def) => {
          const box = el('input', {
            type: 'checkbox',
            value: def.code,
            className: 'asr-js-view-field',
          });
          box.checked = checkedCodes.includes(def.code);
          fieldsBox.appendChild(
            el('label', { className: 'asr-choice asr-view-field' }, [
              box,
              el('span', { text: `${def.label}(${def.code})` }),
            ]),
          );
        });
    };

    const showConverted = () => {
      clear(convertedEl);
      if (!state.converted) {
        return;
      }
      convertedEl.appendChild(
        el('div', {
          className: 'asr-converted',
          text: `変換結果\n絞り込み条件: ${state.converted.filterCond || '(すべてのレコード)'}\n並び順: ${state.converted.sort || '(指定なし)'}`,
        }),
      );
    };

    const convert = async (button) => {
      onError('');
      const parsed = QueryUrl.parseListUrl(urlInput.value, location.origin);
      if (!parsed.ok) {
        onError(parsed.error);
        return;
      }
      if (
        parsed.appId !== app.id ||
        parsed.guestSpaceId !== (app.guestSpaceId || '')
      ) {
        onError(
          `URLのアプリ(アプリID: ${parsed.appId})が、選択中の対象アプリ(アプリID: ${app.id})と違います。`,
        );
        return;
      }
      button.disabled = true;
      convertedEl.textContent = '一覧画面のURLを変換しています…';
      try {
        const result = await convertListUrl(parsed.src);
        state.converted = { ...result, sourceUrl: parsed.src };
        showConverted();
        // 作成のとき、URLの一覧の表示フィールドを初期値にする(「（すべて）」等、APIに無い一覧なら全フィールド)。
        if (opSelect.value === 'viewCreate' && fieldsBox) {
          const base = Object.keys(state.views || {})
            .map((k) => state.views[k])
            .find((v) => String(v.id) === parsed.viewId);
          renderFieldCheckboxes(
            base && base.fields ? base.fields : candidates().defaultChecked,
          );
        }
      } catch (err) {
        state.converted = null;
        clear(convertedEl);
        onError(err.message);
      } finally {
        button.disabled = false;
      }
    };

    const renderBody = (restoreAfter) => {
      clear(body);
      nameInput = null;
      urlInput = null;
      convertedEl = null;
      fieldsBox = null;
      state.converted = null;
      const op = opSelect.value;
      viewRow.hidden = op === 'viewCreate';
      currentEl.textContent =
        op !== 'viewCreate' && state.view
          ? `現在の設定\n${ViewChanges.describe(ViewChanges.currentValue(state.view))}`
          : '';
      renderWarnings();

      if (op === 'viewDelete') {
        const box = el('input', {
          type: 'checkbox',
          className: 'asr-js-view-delete-confirm',
        });
        box.checked = !!restoreAfter;
        state.confirmDelete = box.checked;
        box.addEventListener('change', () => {
          state.confirmDelete = box.checked;
        });
        body.appendChild(
          el('label', { className: 'asr-choice' }, [
            box,
            el('span', { text: 'この一覧を削除することを確認しました' }),
          ]),
        );
        return;
      }

      nameInput = el('input', {
        type: 'text',
        className: 'asr-input asr-js-view-name',
        maxlength: '64',
      });
      if (restoreAfter) {
        nameInput.value = restoreAfter.name;
      } else if (op === 'viewUpdate' && state.view) {
        nameInput.value = state.view.name;
      }
      urlInput = el('input', {
        type: 'text',
        className: 'asr-input asr-input-wide asr-js-view-url',
        placeholder: 'https://…/k/アプリID/?view=…',
      });
      const convertButton = el('button', {
        type: 'button',
        className: 'asr-button asr-js-view-convert',
        text: '変換',
      });
      convertButton.addEventListener('click', () => convert(convertButton));
      convertedEl = el('div', { className: 'asr-js-view-converted' });

      body.appendChild(
        el('div', { className: 'asr-section' }, [
          el('div', { className: 'asr-section-title', text: '一覧名' }),
          nameInput,
        ]),
      );
      body.appendChild(
        el('div', { className: 'asr-section' }, [
          el('div', {
            className: 'asr-section-title',
            text: '絞り込み条件・並び順(一覧画面のURL)',
          }),
          el('div', { className: 'asr-row' }, [urlInput, convertButton]),
          el('div', {
            className: 'asr-help',
            text:
              '対象アプリの一覧画面で絞り込み・並べ替えをしてから、ブラウザーのアドレスバーのURLを貼り付けて「変換」を押します。' +
              (op === 'viewUpdate'
                ? 'URLを指定しない場合、絞り込み条件・並び順は変更しません。'
                : 'URLを指定しない場合、すべてのレコードを並び順の指定なしで表示します。'),
          }),
          convertedEl,
        ]),
      );
      if (restoreAfter && restoreAfter.sourceUrl) {
        urlInput.value = new URL(restoreAfter.sourceUrl, location.origin).href;
        state.converted = {
          filterCond: restoreAfter.filterCond,
          sort: restoreAfter.sort,
          sourceUrl: restoreAfter.sourceUrl,
        };
        showConverted();
      }

      if (op === 'viewCreate') {
        fieldsBox = el('div', { className: 'asr-view-fields' });
        body.appendChild(
          el('div', { className: 'asr-section' }, [
            el('div', {
              className: 'asr-section-title',
              text: '表示するフィールド',
            }),
            fieldsBox,
          ]),
        );
        renderFieldCheckboxes(
          restoreAfter && restoreAfter.fields
            ? restoreAfter.fields
            : candidates().defaultChecked,
        );
      }
    };

    const selectView = (id) => {
      state.view =
        ViewChanges.editableViews(state.views).find(
          (v) => String(v.id) === String(id),
        ) || null;
    };

    opSelect.addEventListener('change', () => renderBody());
    viewSelect.addEventListener('change', () => {
      selectView(viewSelect.value);
      renderBody();
    });

    const load = async () => {
      const [processEnabled, layout, views] = await Promise.all([
        fetchProcessEnabled(app),
        fetchLayout(app),
        fetchLiveViews(app).catch((err) => {
          onError(
            `対象アプリの一覧を取得できませんでした: ${ApiPath.describeApiError(err)}`,
          );
          return {};
        }),
      ]);
      Object.assign(state, { processEnabled, layout, views });
      const editable = ViewChanges.editableViews(state.views);
      clear(viewSelect);
      viewSelect.appendChild(
        el('option', { value: '', text: '-- 一覧を選択 --' }),
      );
      editable.forEach((v) =>
        viewSelect.appendChild(
          el('option', {
            value: v.id,
            text: `${v.name}${v.type === 'CALENDAR' ? '(カレンダー形式)' : ''}`,
          }),
        ),
      );
      if (restoreChange) {
        opSelect.value = restoreChange.operation;
        if (restoreChange.view.id) {
          viewSelect.value = restoreChange.view.id;
          selectView(restoreChange.view.id);
          if (!state.view) {
            onError(
              `依頼していた一覧「${restoreChange.view.name}」が対象アプリに見つかりません。選び直してください。`,
            );
          }
        }
        renderBody(
          restoreChange.operation === 'viewDelete' ? true : restoreChange.after,
        );
      } else {
        renderBody();
      }
      root.dataset.loaded = '1';
    };
    load();

    const buildChange = () => {
      const op = opSelect.value;
      if (!state.views) {
        return {
          error:
            '対象アプリの一覧を読み込んでいます。少し待ってから保存してください。',
        };
      }
      if (op !== 'viewCreate' && !state.view) {
        return { error: '対象の一覧を選択してください。' };
      }
      const before =
        op === 'viewCreate' ? null : ViewChanges.currentValue(state.view);
      const view =
        op === 'viewCreate'
          ? { id: '', name: '' }
          : { id: String(state.view.id), name: state.view.name };
      let after = null;
      if (op === 'viewDelete') {
        if (!state.confirmDelete) {
          return { error: '一覧の削除の確認にチェックを入れてください。' };
        }
      } else {
        const name = nameInput.value.trim();
        const converted = state.converted;
        after = {
          name,
          filterCond: converted
            ? converted.filterCond
            : before
              ? before.filterCond
              : '',
          sort: converted ? converted.sort : before ? before.sort : '',
          sourceUrl: converted ? converted.sourceUrl : '',
        };
        if (op === 'viewCreate') {
          after.fields = Array.from(
            fieldsBox.querySelectorAll('input.asr-js-view-field:checked'),
          ).map((b) => b.value);
        }
        if (urlInput.value.trim() && !converted) {
          return {
            error: '一覧画面のURLを入力したら「変換」を押してください。',
          };
        }
        const error = ViewChanges.validateValue(op, after);
        if (error) {
          return { error };
        }
        const taken = Object.keys(state.views).some(
          (key) =>
            (state.views[key].name || key) === name &&
            (op === 'viewCreate' || String(state.views[key].id) !== view.id),
        );
        if (taken) {
          return { error: `「${name}」と同じ名前の一覧が既にあります。` };
        }
        if (
          op === 'viewUpdate' &&
          JSON.stringify({
            name: after.name,
            filterCond: after.filterCond,
            sort: after.sort,
          }) === JSON.stringify(before)
        ) {
          return { error: '一覧の設定が現在と同じです。' };
        }
      }
      return {
        change: NS.ChangeRequest.buildChange({
          app,
          view,
          operation: op,
          before,
          after,
        }),
        itemName: `一覧: ${op === 'viewCreate' ? after.name : view.name}`,
      };
    };

    return { node: root, buildChange };
  };

  NS.ViewEditor = { create };
})();
