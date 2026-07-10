(function (global) {
  'use strict';

  // ガントチャート本体の描画(DOM+CSSによる自前実装、外部ライブラリ不使用)。
  // kintone.app.getHeaderMenuSpaceElement() で取得した要素の中に、独立したブロックとして挿入する
  // (一覧本体の表(行)には手を入れない)。
  //
  // セキュリティ(security-checklist.md参照): レコードの値に由来する文字列は、
  // すべて textContent で挿入する。innerHTML/insertAdjacentHTML は一切使用しない。

  const NS = global.GanttChartView;

  const LABEL_COLUMN_WIDTH = 200;
  const ROW_HEIGHT = 28;
  const BAR_HEIGHT = 18;

  const clearElement = (el) => {
    while (el.firstChild) {
      el.removeChild(el.firstChild);
    }
  };

  const el = (tagName, className, text) => {
    const node = document.createElement(tagName);
    if (className) {
      node.className = className;
    }
    if (text !== undefined && text !== null) {
      node.textContent = text; // XSS対策: innerHTMLではなくtextContentのみ使用する
    }
    return node;
  };

  // ユーザー選択/組織/グループ選択などの配列値は name をカンマ区切りで、
  // 文字列値(ドロップダウン等)はそのまま表示用テキストにする。
  const fieldDisplayText = (record, fieldCode) => {
    if (!fieldCode || !record[fieldCode]) {
      return '';
    }
    const value = record[fieldCode].value;
    if (Array.isArray(value)) {
      return value
        .map((item) =>
          item && typeof item === 'object'
            ? item.name || item.code
            : String(item),
        )
        .join(', ');
    }
    if (value === null || value === undefined) {
      return '';
    }
    return String(value);
  };

  const buildRowLabel = (record, barFieldCodes) => {
    const parts = (barFieldCodes || [])
      .map((code) => fieldDisplayText(record, code))
      .filter((text) => text !== '');
    if (parts.length > 0) {
      return parts.join(' / ');
    }
    return record.$id ? `#${record.$id.value}` : '';
  };

  const buildToolbar = (options) => {
    const toolbar = el('div', 'gcv-toolbar');

    const scaleGroup = el('div', 'gcv-toolbar-group');
    scaleGroup.appendChild(el('span', 'gcv-toolbar-label', '表示単位:'));
    ['day', 'week', 'month'].forEach((unit) => {
      const label = { day: '日', week: '週', month: '月' }[unit];
      const button = el('button', 'gcv-scale-button', label);
      button.type = 'button';
      if (unit === options.currentScaleUnit) {
        button.classList.add('gcv-scale-button-active');
      }
      button.addEventListener('click', () => options.onScaleChange(unit));
      scaleGroup.appendChild(button);
    });
    toolbar.appendChild(scaleGroup);

    if (options.groupFieldOptions && options.groupFieldOptions.length > 0) {
      const groupGroup = el('div', 'gcv-toolbar-group');
      groupGroup.appendChild(el('span', 'gcv-toolbar-label', 'グループ分け:'));
      const select = document.createElement('select');
      select.className = 'gcv-group-select';

      const noneOption = document.createElement('option');
      noneOption.value = '';
      noneOption.textContent = 'グループ分けなし';
      select.appendChild(noneOption);

      options.groupFieldOptions.forEach((field) => {
        const optionEl = document.createElement('option');
        optionEl.value = field.code;
        optionEl.textContent = field.label;
        select.appendChild(optionEl);
      });
      select.value = options.currentGroupFieldCode || '';
      select.addEventListener('change', () =>
        options.onGroupChange(select.value),
      );
      groupGroup.appendChild(select);
      toolbar.appendChild(groupGroup);
    }

    if (options.fullFetchEnabled) {
      const fetchButton = el('button', 'gcv-fetch-button', '全件取得');
      fetchButton.type = 'button';
      fetchButton.addEventListener('click', () => options.onFullFetch());
      toolbar.appendChild(fetchButton);
    }

    if (options.statusText) {
      toolbar.appendChild(el('span', 'gcv-status-text', options.statusText));
    }

    return toolbar;
  };

  const buildGridHeader = (scale) => {
    const header = el('div', 'gcv-grid-header');
    header.style.marginLeft = `${LABEL_COLUMN_WIDTH}px`;
    header.style.width = `${scale.totalWidth}px`;
    header.style.position = 'relative';

    scale.gridLines.forEach((line) => {
      const label = el('span', 'gcv-grid-header-label', line.label);
      label.style.left = `${line.x}px`;
      header.appendChild(label);
    });
    return header;
  };

  const buildGridLines = (scale, bodyHeight) => {
    const linesLayer = el('div', 'gcv-grid-lines');
    linesLayer.style.left = `${LABEL_COLUMN_WIDTH}px`;
    linesLayer.style.width = `${scale.totalWidth}px`;
    linesLayer.style.height = `${bodyHeight}px`;

    scale.gridLines.forEach((line) => {
      const lineEl = el('div', 'gcv-grid-line');
      lineEl.style.left = `${line.x}px`;
      linesLayer.appendChild(lineEl);
    });
    return linesLayer;
  };

  const buildScheduledRow = (row, scale, colorMap, config) => {
    const rowEl = el('div', 'gcv-row');

    const labelEl = el(
      'div',
      'gcv-row-label',
      buildRowLabel(row.record, config.barFieldCodes),
    );
    labelEl.style.width = `${LABEL_COLUMN_WIDTH}px`;
    rowEl.appendChild(labelEl);

    const trackEl = el('div', 'gcv-row-track');
    trackEl.style.width = `${scale.totalWidth}px`;

    const x = scale.dateToX(row.startDate);
    const width = Math.max(scale.dateToWidth(row.startDate, row.endDate), 2);
    const color = NS.ColorAssignment.getColorForRow(
      colorMap,
      row.record,
      config.colorFieldCode,
    );

    const barEl = el('div', 'gcv-bar');
    barEl.style.left = `${x}px`;
    barEl.style.width = `${width}px`;
    barEl.style.height = `${BAR_HEIGHT}px`;
    barEl.style.backgroundColor = color;
    barEl.title = buildRowLabel(row.record, config.barFieldCodes); // ブラウザ側で自動エスケープされる属性
    trackEl.appendChild(barEl);

    const barLabelEl = el(
      'span',
      'gcv-bar-label',
      buildRowLabel(row.record, config.barFieldCodes),
    );
    barLabelEl.style.left = `${x + width + 4}px`;
    trackEl.appendChild(barLabelEl);

    rowEl.appendChild(trackEl);
    return rowEl;
  };

  const buildUnscheduledRow = (row, config) => {
    const rowEl = el('div', 'gcv-row gcv-row-unscheduled');
    const labelEl = el(
      'div',
      'gcv-row-label',
      buildRowLabel(row.record, config.barFieldCodes),
    );
    labelEl.style.width = `${LABEL_COLUMN_WIDTH}px`;
    rowEl.appendChild(labelEl);
    rowEl.appendChild(el('div', 'gcv-row-note', '(開始日未設定)'));
    return rowEl;
  };

  const buildGroupSection = (group, scale, colorMap, config) => {
    const section = el('div', 'gcv-group');
    section.appendChild(
      el(
        'div',
        'gcv-group-header',
        `${group.label || '(すべて)'} (${group.rows.length}件)`,
      ),
    );
    group.rows.forEach((row) => {
      if (row.isUnscheduled || !scale) {
        section.appendChild(buildUnscheduledRow(row, config));
      } else {
        section.appendChild(buildScheduledRow(row, scale, colorMap, config));
      }
    });
    return section;
  };

  // container: kintone.app.getHeaderMenuSpaceElement() の戻り値
  // options: { groups, scale, colorMap, config, currentScaleUnit, currentGroupFieldCode,
  //            groupFieldOptions, fullFetchEnabled, statusText,
  //            onScaleChange, onGroupChange, onFullFetch }
  const render = (container, options) => {
    clearElement(container);

    const root = el('div', 'gcv-root');
    root.appendChild(buildToolbar(options));

    const scrollWrapper = el('div', 'gcv-scroll');
    const chart = el('div', 'gcv-chart');
    chart.style.position = 'relative';

    const body = el('div', 'gcv-body');

    if (options.scale) {
      chart.appendChild(buildGridHeader(options.scale));
    }

    (options.groups || []).forEach((group) => {
      body.appendChild(
        buildGroupSection(
          group,
          options.scale,
          options.colorMap,
          options.config,
        ),
      );
    });

    chart.appendChild(body);
    scrollWrapper.appendChild(chart);
    root.appendChild(scrollWrapper);
    container.appendChild(root);

    // グリッド線はレイアウト確定後(bodyの実高さが判明した後)に、bodyの上に重ねて挿入する。
    if (options.scale) {
      const bodyHeight = body.offsetHeight;
      chart.insertBefore(buildGridLines(options.scale, bodyHeight), body);
    }
  };

  const GanttRender = {
    render,
    LABEL_COLUMN_WIDTH,
    ROW_HEIGHT,
    fieldDisplayText,
    buildRowLabel,
  };

  global.GanttChartView = global.GanttChartView || {};
  global.GanttChartView.GanttRender = GanttRender;
})(typeof window !== 'undefined' ? window : globalThis);
