(function (global, kintone) {
  'use strict';

  const NS = global.CrossAppCheck;

  // 画面に一度に描く行数の上限。全件はCSVで取れるようにしてある。
  const MAX_RENDER_ROWS = 500;

  // すべてtextContent/createElementで組み立てる。innerHTMLは使わない
  // (氏名・突合キー・アプリ名がそのまま出るため。secureCodingGuideline.md参照)
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

  // レコードへのリンク。アプリIDとレコードIDはResultSchema側で
  // 「数字のみ」に検証済みだが、組み立て時にも念のため確認する。
  const recordLink = (appId, recordId, text) => {
    if (/^[0-9]+$/.test(String(appId)) && /^[0-9]+$/.test(String(recordId))) {
      const anchor = el('a', 'cac-link', text);
      anchor.href = `/k/${appId}/show#record=${recordId}`;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      return anchor;
    }
    return el('span', null, text);
  };

  const buildToolbar = (state, handlers) => {
    const toolbar = el('div', 'cac-toolbar');

    const runLabel = el('label', 'cac-field');
    runLabel.appendChild(el('span', 'cac-field-label', '表示する実行'));
    const runSelect = el('select', 'kintoneplugin-select cac-run-select');
    runLabel.appendChild(runSelect);
    toolbar.appendChild(runLabel);

    const targetLabel = el('label', 'cac-field');
    targetLabel.appendChild(el('span', 'cac-field-label', '対象アプリ'));
    const targetSelect = el('select', 'kintoneplugin-select cac-target-select');
    targetLabel.appendChild(targetSelect);
    toolbar.appendChild(targetLabel);

    const onlyLabel = el('label', 'cac-field cac-field-inline');
    const onlyCheckbox = document.createElement('input');
    onlyCheckbox.type = 'checkbox';
    onlyCheckbox.className = 'cac-unsubmitted-only';
    onlyLabel.appendChild(onlyCheckbox);
    onlyLabel.appendChild(el('span', null, '未提出のみ表示'));
    toolbar.appendChild(onlyLabel);

    const keywordLabel = el('label', 'cac-field');
    keywordLabel.appendChild(el('span', 'cac-field-label', '絞り込み'));
    const keywordInput = document.createElement('input');
    keywordInput.type = 'search';
    keywordInput.className = 'kintoneplugin-input-text cac-keyword';
    keywordInput.placeholder = '突合キー・氏名';
    keywordLabel.appendChild(keywordInput);
    toolbar.appendChild(keywordLabel);

    const csvButton = el(
      'button',
      'kintoneplugin-button-normal cac-csv-button',
      'CSVダウンロード',
    );
    csvButton.type = 'button';
    toolbar.appendChild(csvButton);

    runSelect.addEventListener('change', () => {
      handlers.onRunChange(runSelect.value);
    });
    targetSelect.addEventListener('change', () => {
      state.targetIndex = Number(targetSelect.value);
      handlers.onFilterChange();
    });
    onlyCheckbox.addEventListener('change', () => {
      state.unsubmittedOnly = onlyCheckbox.checked;
      handlers.onFilterChange();
    });
    keywordInput.addEventListener('input', () => {
      state.keyword = keywordInput.value;
      handlers.onFilterChange();
    });
    csvButton.addEventListener('click', () => {
      handlers.onCsvDownload();
    });

    return {
      toolbar,
      runSelect,
      targetSelect,
      onlyCheckbox,
      keywordInput,
      csvButton,
    };
  };

  const fillRunOptions = (selectEl, runs, selectedFileKey) => {
    selectEl.textContent = '';
    if (runs.length === 0) {
      const option = el('option', null, '（まだ実行していません）');
      option.value = '';
      selectEl.appendChild(option);
      selectEl.disabled = true;
      return;
    }
    selectEl.disabled = false;
    runs.forEach((run) => {
      const option = el(
        'option',
        null,
        `${run.runAt || run.runId} — ${run.summary}`,
      );
      option.value = run.fileKey;
      if (run.fileKey === selectedFileKey) {
        option.selected = true;
      }
      selectEl.appendChild(option);
    });
  };

  const fillTargetOptions = (selectEl, targets) => {
    selectEl.textContent = '';
    const allOption = el('option', null, 'すべて');
    allOption.value = String(NS.RowFilter.ALL_TARGETS);
    selectEl.appendChild(allOption);
    targets.forEach((target, position) => {
      const option = el('option', null, target.label);
      option.value = String(position);
      selectEl.appendChild(option);
    });
  };

  const buildSummary = (result) => {
    const box = el('div', 'cac-summary');
    const summary = result.summary || {};

    box.appendChild(
      el('span', 'cac-summary-item', `対象者 ${summary.baseCount} 件`),
    );
    box.appendChild(
      el(
        'span',
        'cac-summary-item cac-summary-warn',
        `いずれか未提出 ${summary.unsubmittedAny} 件`,
      ),
    );
    (summary.perTarget || []).forEach((entry) => {
      box.appendChild(
        el(
          'span',
          'cac-summary-item',
          `${entry.label}: 提出済 ${entry.submitted} / 未提出 ${entry.unsubmitted}`,
        ),
      );
    });
    if (summary.skippedNoKey > 0) {
      box.appendChild(
        el(
          'span',
          'cac-summary-item cac-summary-note',
          `突合キーが空のため除外 ${summary.skippedNoKey} 件`,
        ),
      );
    }
    return box;
  };

  const buildTable = (result, rows) => {
    const labels = result.labels || {};
    const table = el('table', 'cac-table');

    const thead = el('thead');
    const headRow = el('tr');
    headRow.appendChild(el('th', 'cac-th', '突合キー'));
    headRow.appendChild(el('th', 'cac-th', '氏名'));
    (result.targets || []).forEach((target) => {
      const th = el('th', 'cac-th', target.label);
      th.colSpan = 2;
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);

    const subRow = el('tr');
    subRow.appendChild(el('th', 'cac-th cac-th-sub', ''));
    subRow.appendChild(el('th', 'cac-th cac-th-sub', ''));
    (result.targets || []).forEach(() => {
      subRow.appendChild(el('th', 'cac-th cac-th-sub', '状況'));
      subRow.appendChild(el('th', 'cac-th cac-th-sub', '最終提出日'));
    });
    thead.appendChild(subRow);
    table.appendChild(thead);

    const tbody = el('tbody');
    rows.slice(0, MAX_RENDER_ROWS).forEach((row) => {
      const tr = el('tr', 'cac-tr');

      const keyCell = el('td', 'cac-td');
      const firstBaseRecordId = (row.baseRecordIds || [])[0];
      keyCell.appendChild(
        recordLink(result.baseApp.appId, firstBaseRecordId, row.key),
      );
      tr.appendChild(keyCell);

      tr.appendChild(el('td', 'cac-td', row.name));

      (result.targets || []).forEach((target, position) => {
        const cell = (row.targets || [])[position] || {};
        const statusText = cell.submitted
          ? labels.submitted
          : labels.unsubmitted;
        const statusCell = el(
          'td',
          `cac-td cac-status ${cell.submitted ? 'cac-status-ok' : 'cac-status-ng'}`,
        );
        const firstTargetRecordId = (cell.recordIds || [])[0];
        statusCell.appendChild(
          recordLink(
            target.appId,
            firstTargetRecordId,
            cell.count > 1 ? `${statusText}(${cell.count}件)` : statusText,
          ),
        );
        tr.appendChild(statusCell);

        tr.appendChild(el('td', 'cac-td', cell.lastDate || ''));
      });

      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    return table;
  };

  // 1レコードぶんのビューワを組み立てて返す。
  // container配下は毎回作り直す(部分更新はしない)。
  const create = (container, options) => {
    const state = {
      runs: [],
      result: null,
      filteredRows: [],
      selectedFileKey: '',
      targetIndex: NS.RowFilter.ALL_TARGETS,
      unsubmittedOnly: false,
      keyword: '',
    };

    container.textContent = '';
    const wrapper = el('div', 'cac-view');
    const messageBox = el('div', 'cac-message');
    const summaryBox = el('div', 'cac-summary-wrap');
    const tableWrap = el('div', 'cac-table-wrap');

    const setMessage = (text, isError) => {
      messageBox.textContent = text || '';
      messageBox.classList.toggle('cac-message-error', Boolean(isError));
      messageBox.hidden = !text;
    };

    const renderRows = () => {
      state.filteredRows = NS.RowFilter.filterRows(state.result.rows, {
        unsubmittedOnly: state.unsubmittedOnly,
        targetIndex: state.targetIndex,
        keyword: state.keyword,
      });
      tableWrap.textContent = '';
      if (state.filteredRows.length === 0) {
        tableWrap.appendChild(
          el('p', 'cac-empty', '条件に一致する対象者はいません。'),
        );
        return;
      }
      tableWrap.appendChild(buildTable(state.result, state.filteredRows));
      if (state.filteredRows.length > MAX_RENDER_ROWS) {
        tableWrap.appendChild(
          el(
            'p',
            'cac-empty',
            `${state.filteredRows.length}件のうち先頭${MAX_RENDER_ROWS}件を表示しています。全件はCSVでダウンロードしてください。`,
          ),
        );
      }
    };

    const loadRun = async (fileKey) => {
      state.selectedFileKey = fileKey;
      summaryBox.textContent = '';
      tableWrap.textContent = '';
      if (!fileKey) {
        setMessage(
          '結果ファイルが添付されていません。もう一度突合を実行してください。',
          true,
        );
        return;
      }
      setMessage('結果を読み込んでいます...');
      try {
        const text = await NS.FileClient.downloadText(fileKey);
        // 添付ファイルは差し替えられうる「信用できない入力」。必ず検証してから描画する。
        state.result = NS.ResultSchema.parse(text);
        setMessage('');
        fillTargetOptions(controls.targetSelect, state.result.targets);
        controls.targetSelect.value = String(state.targetIndex);
        summaryBox.appendChild(buildSummary(state.result));
        renderRows();
      } catch (err) {
        state.result = null;
        setMessage(
          `結果を表示できませんでした: ${(err && err.message) || err}`,
          true,
        );
      }
    };

    const controls = buildToolbar(state, {
      onRunChange: (fileKey) => {
        loadRun(fileKey);
      },
      onFilterChange: () => {
        if (state.result) {
          renderRows();
        }
      },
      onCsvDownload: () => {
        if (!state.result) {
          return;
        }
        NS.FileClient.triggerTextDownload(
          NS.Csv.withBom(NS.Csv.buildCsv(state.result, state.filteredRows)),
          NS.Csv.buildFileName(state.result),
          'text/csv;charset=utf-8',
        );
      },
    });

    wrapper.appendChild(controls.toolbar);
    wrapper.appendChild(messageBox);
    wrapper.appendChild(summaryBox);
    wrapper.appendChild(tableWrap);
    container.appendChild(wrapper);
    setMessage('');

    // 履歴を差し替えて先頭(最新)を表示する
    const setRuns = (runs) => {
      state.runs = runs;
      fillRunOptions(
        controls.runSelect,
        runs,
        runs.length > 0 ? runs[0].fileKey : '',
      );
      if (runs.length === 0) {
        summaryBox.textContent = '';
        tableWrap.textContent = '';
        setMessage(
          'まだ突合を実行していません。上の「突合を実行」ボタンから実行してください。',
        );
        return Promise.resolve();
      }
      return loadRun(runs[0].fileKey);
    };

    return { setRuns, setMessage };
  };

  NS.ResultView = { create, MAX_RENDER_ROWS };
})(typeof window !== 'undefined' ? window : globalThis, kintone);
