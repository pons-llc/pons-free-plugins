(function (global) {
  'use strict';

  // カレンダーのDOM描画を担当する。レコード値に由来する文字列は必ずtextContent/title
  // プロパティ代入で挿入し、innerHTML/insertAdjacentHTMLは使用しない(security-checklist.md参照)。
  // 表示専用(クリックでレコード詳細へ遷移するのみ)で、ドラッグ&ドロップでの編集は行わない
  // (判断記録.md参照。当初はドラッグ&ドロップ対応も実装したが、スコープから外した)。

  const NS = global.CalendarView;
  const { DayGrid, WeekGrid, Grouping, ColorAssignment } = NS;

  const PX_PER_MINUTE = 1; // 24h = 1440px。日表示の時刻軸(縦/横共通)のスケール。
  const DAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];

  const el = (tag, className) => {
    const node = document.createElement(tag);
    if (className) {
      node.className = className;
    }
    return node;
  };

  const clearElement = (node) => {
    while (node.firstChild) {
      node.removeChild(node.firstChild);
    }
  };

  const pad2 = (n) => String(n).padStart(2, '0');

  const formatDateInputValue = (date) =>
    `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

  const formatPeriodLabel = (unit, currentDate) => {
    if (unit === 'day') {
      return `${currentDate.getFullYear()}/${currentDate.getMonth() + 1}/${currentDate.getDate()}(${DAY_LABELS[currentDate.getDay()]})`;
    }
    const weekStart = WeekGrid.startOfWeek(currentDate);
    const weekEnd = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
    return `${weekStart.getMonth() + 1}/${weekStart.getDate()} 〜 ${weekEnd.getMonth() + 1}/${weekEnd.getDate()}`;
  };

  const buildToolbar = (opts) => {
    const toolbar = el('div', 'cv-toolbar');

    const navGroup = el('div', 'cv-toolbar-group');
    const prevBtn = el('button', 'cv-nav-button');
    prevBtn.type = 'button';
    prevBtn.textContent = '◀ 前へ';
    prevBtn.addEventListener('click', () => opts.onNavigate('prev'));
    const todayBtn = el('button', 'cv-nav-button');
    todayBtn.type = 'button';
    todayBtn.textContent = '今日';
    todayBtn.addEventListener('click', () => opts.onNavigate('today'));
    const nextBtn = el('button', 'cv-nav-button');
    nextBtn.type = 'button';
    nextBtn.textContent = '次へ ▶';
    nextBtn.addEventListener('click', () => opts.onNavigate('next'));
    const periodLabel = el('span', 'cv-period-label');
    periodLabel.textContent = formatPeriodLabel(
      opts.currentUnit,
      opts.currentDate,
    );
    // 前へ/次へだけだと日表示で1日ずつしか移動できず遠くの日付へ辿り着きにくいため、
    // 任意の日付へ直接ジャンプできる日付入力を用意する(週表示ではその日を含む週へ移動する)。
    const dateInput = el('input', 'cv-date-input');
    dateInput.type = 'date';
    dateInput.value = formatDateInputValue(opts.currentDate);
    dateInput.addEventListener('change', () => {
      if (!dateInput.value) {
        return;
      }
      const [y, m, d] = dateInput.value.split('-').map(Number);
      opts.onJumpToDate(new Date(y, m - 1, d));
    });
    navGroup.appendChild(prevBtn);
    navGroup.appendChild(todayBtn);
    navGroup.appendChild(nextBtn);
    navGroup.appendChild(periodLabel);
    navGroup.appendChild(dateInput);

    const unitGroup = el('div', 'cv-toolbar-group');
    ['week', 'day'].forEach((unit) => {
      const btn = el(
        'button',
        `cv-unit-button${unit === opts.currentUnit ? ' cv-unit-button-active' : ''}`,
      );
      btn.type = 'button';
      btn.textContent = unit === 'week' ? '週表示' : '日表示';
      btn.addEventListener('click', () => opts.onUnitChange(unit));
      unitGroup.appendChild(btn);
    });

    const statusText = el('span', 'cv-status-text');
    statusText.textContent = opts.truncated
      ? `⚠ 最大${opts.maxRecords}件まで表示中(全${opts.totalRecords}件中)`
      : `表示中: ${opts.totalRecords}件 / 最大${opts.maxRecords}件(REST API不使用のため)`;

    toolbar.appendChild(navGroup);
    toolbar.appendChild(unitGroup);
    toolbar.appendChild(statusText);
    return toolbar;
  };

  const applyHover = (blockEl, evt) => {
    blockEl.title = [evt.title].concat(evt.hoverLines).join('\n');
  };

  const attachClick = (blockEl, evt, opts) => {
    blockEl.addEventListener('click', () => opts.onEventClick(evt.recordId));
  };

  // ---- 週表示(曜日を軸。グループ分けフィールド設定時はグループも軸として使う) ----

  const buildWeekDayCell = (dayEvents, dayIndex, colorMap, opts) => {
    const cell = el('div', 'cv-week-day-cell');
    cell.dataset.dayIndex = String(dayIndex);

    dayEvents.forEach((evt) => {
      const chip = el('div', 'cv-event-chip');
      chip.style.backgroundColor = colorMap[evt.colorKey] || '#3498db';
      const hh = String(evt.start.getHours()).padStart(2, '0');
      const mm = String(evt.start.getMinutes()).padStart(2, '0');
      chip.textContent = evt.allDay ? evt.title : `${hh}:${mm} ${evt.title}`;
      applyHover(chip, evt);
      attachClick(chip, evt, opts);
      cell.appendChild(chip);
    });

    return cell;
  };

  const dayHeaderText = (date, dayIndex) =>
    `${date.getMonth() + 1}/${date.getDate()}(${DAY_LABELS[dayIndex]})`;

  // グループ分けフィールドが未設定(またはデータが単一グループのみ)の場合は、従来どおり
  // 曜日だけを軸にしたシンプルな7セル表示にする。
  const renderWeekViewSimple = (
    scroll,
    events,
    weekStart,
    horizontal,
    colorMap,
    opts,
  ) => {
    const buckets = WeekGrid.bucketEventsByDay(events, weekStart);
    const grid = el(
      'div',
      horizontal
        ? 'cv-week-grid cv-week-grid-horizontal'
        : 'cv-week-grid cv-week-grid-vertical',
    );
    scroll.appendChild(grid);

    for (let i = 0; i < 7; i += 1) {
      const dayDate = new Date(weekStart.getTime() + i * 24 * 60 * 60 * 1000);
      const header = el('div', 'cv-week-day-header');
      header.textContent = dayHeaderText(dayDate, i);
      grid.appendChild(header);
      if (horizontal) {
        grid.appendChild(buildWeekDayCell(buckets[i], i, colorMap, opts));
      }
    }
    if (!horizontal) {
      for (let i = 0; i < 7; i += 1) {
        grid.appendChild(buildWeekDayCell(buckets[i], i, colorMap, opts));
      }
    }
  };

  // グループ分けフィールドが設定されている場合は、曜日(7日分)とグループの2軸グリッドにする。
  // 縦デザイン: グループ=列、曜日=行。横デザイン: 曜日=列、グループ=行(日表示のグループ軸の
  // 向きの決め方〈縦=列/横=行〉と揃える。ユーザー指示により追加)。
  const renderWeekViewGrouped = (
    scroll,
    groups,
    weekStart,
    horizontal,
    colorMap,
    opts,
  ) => {
    const dayDates = Array.from(
      { length: 7 },
      (_, i) => new Date(weekStart.getTime() + i * 24 * 60 * 60 * 1000),
    );
    const perGroupBuckets = groups.map((group) =>
      WeekGrid.bucketEventsByDay(group.events, weekStart),
    );

    const grid = el('div', 'cv-week-grouped-grid');
    scroll.appendChild(grid);

    if (!horizontal) {
      // 縦: 1列目=曜日ラベル、以降はグループごとの列。
      grid.style.gridTemplateColumns = `80px repeat(${groups.length}, minmax(120px, 1fr))`;
      grid.appendChild(el('div', 'cv-week-grouped-corner'));
      groups.forEach((group) => {
        const headerEl = el('div', 'cv-group-header-cell');
        headerEl.textContent = group.label;
        grid.appendChild(headerEl);
      });
      dayDates.forEach((dayDate, dayIndex) => {
        const dayLabelEl = el('div', 'cv-week-day-header');
        dayLabelEl.textContent = dayHeaderText(dayDate, dayIndex);
        grid.appendChild(dayLabelEl);
        groups.forEach((group, groupIndex) => {
          grid.appendChild(
            buildWeekDayCell(
              perGroupBuckets[groupIndex][dayIndex],
              dayIndex,
              colorMap,
              opts,
            ),
          );
        });
      });
    } else {
      // 横: 1行目=曜日ラベル、以降はグループごとの行。
      grid.style.gridTemplateColumns = '80px repeat(7, minmax(120px, 1fr))';
      grid.appendChild(el('div', 'cv-week-grouped-corner'));
      dayDates.forEach((dayDate, dayIndex) => {
        const dayLabelEl = el('div', 'cv-week-day-header');
        dayLabelEl.textContent = dayHeaderText(dayDate, dayIndex);
        grid.appendChild(dayLabelEl);
      });
      groups.forEach((group, groupIndex) => {
        const groupLabelEl = el('div', 'cv-group-row-label');
        groupLabelEl.textContent = group.label;
        grid.appendChild(groupLabelEl);
        dayDates.forEach((dayDate, dayIndex) => {
          grid.appendChild(
            buildWeekDayCell(
              perGroupBuckets[groupIndex][dayIndex],
              dayIndex,
              colorMap,
              opts,
            ),
          );
        });
      });
    }
  };

  const renderWeekView = (scroll, events, opts) => {
    const weekStart = WeekGrid.startOfWeek(opts.currentDate);
    const colorKeys = Array.from(new Set(events.map((e) => e.colorKey)));
    const colorMap = ColorAssignment.assignColors(
      colorKeys,
      undefined,
      opts.colorOverrides,
    );
    const horizontal = opts.layoutDirection === 'horizontal';
    const groups = Grouping.buildDayGroups(events);

    if (groups.length > 1) {
      renderWeekViewGrouped(
        scroll,
        groups,
        weekStart,
        horizontal,
        colorMap,
        opts,
      );
    } else {
      renderWeekViewSimple(
        scroll,
        events,
        weekStart,
        horizontal,
        colorMap,
        opts,
      );
    }
  };

  // ---- 日表示(グループを軸に使用) ----

  const buildEventBlock = (evt, colorMap, horizontal, opts) => {
    const startMin = DayGrid.minutesSinceMidnight(evt.start);
    const rawEndMin = DayGrid.minutesSinceMidnight(evt.end);
    const endMin =
      evt.end.getTime() > evt.start.getTime() && rawEndMin > startMin
        ? Math.min(DayGrid.MINUTES_PER_DAY, rawEndMin)
        : DayGrid.MINUTES_PER_DAY;
    const durationMin = Math.max(15, endMin - startMin);

    const block = el('div', 'cv-event-block');
    block.style.backgroundColor = colorMap[evt.colorKey] || '#3498db';
    if (horizontal) {
      block.style.left = `${DayGrid.minutesToPixels(startMin, PX_PER_MINUTE)}px`;
      block.style.width = `${DayGrid.minutesToPixels(durationMin, PX_PER_MINUTE)}px`;
      block.style.top = '4px';
      block.style.bottom = '4px';
    } else {
      block.style.top = `${DayGrid.minutesToPixels(startMin, PX_PER_MINUTE)}px`;
      block.style.height = `${DayGrid.minutesToPixels(durationMin, PX_PER_MINUTE)}px`;
      block.style.left = '2px';
      block.style.right = '2px';
    }
    block.textContent = evt.title;
    applyHover(block, evt);
    attachClick(block, evt, opts);
    return block;
  };

  // 1グループ分のレーン(縦デザイン: 列/横デザイン: 行)を組み立てる。
  // 横デザインの場合は「グループ名ラベル + タイムライン」を横並びにした行全体を返す。
  const buildGroupLane = (group, colorMap, totalPx, horizontal, opts) => {
    const lane = el(
      'div',
      horizontal ? 'cv-day-group-row' : 'cv-day-group-col',
    );
    lane.style.position = 'relative';
    if (horizontal) {
      lane.style.minWidth = `${totalPx}px`;
      lane.style.flex = '1 1 auto';
    } else {
      lane.style.height = `${totalPx}px`;
      lane.style.flex = '1 1 0';
    }

    group.events.forEach((evt) => {
      lane.appendChild(buildEventBlock(evt, colorMap, horizontal, opts));
    });

    if (!horizontal) {
      return lane;
    }
    const row = el('div', 'cv-day-group-row');
    row.style.display = 'flex';
    row.style.height = '56px';
    const label = el('div', 'cv-group-row-label');
    label.textContent = group.label;
    row.appendChild(label);
    row.appendChild(lane);
    return row;
  };

  // 横デザインの「グループ名ラベル」列の幅(desktop.cssの.cv-group-row-labelと一致させる)。
  const GROUP_LABEL_WIDTH = 100;
  // 縦デザインの時刻軸(左側の余白)の幅(desktop.cssの.cv-day-timeaxisと一致させる)。
  const TIME_AXIS_WIDTH = 48;

  const buildHourLabels = (timeAxis, horizontal) => {
    for (let hour = 0; hour <= 24; hour += 2) {
      const label = el('div', 'cv-hour-label');
      label.textContent = `${String(hour).padStart(2, '0')}:00`;
      if (horizontal) {
        label.style.left = `${hour * 60 * PX_PER_MINUTE}px`;
      } else {
        label.style.top = `${hour * 60 * PX_PER_MINUTE}px`;
      }
      timeAxis.appendChild(label);
    }
  };

  // 横デザイン: ヘッダー行は「グループ名ラベル分の余白(100px) + 時刻軸(1440px)」。
  // レーン側もグループ名ラベル(100px)+タイムライン(1440px)なので、両者の合計幅を
  // 明示的なwidthとしてすべての祖先に持たせることで、cv-scrollのoverflow:autoが
  // 正しく横スクロールバーを出す(明示しないと、途中の要素がflexの伸縮既定値で
  // 親幅に収まるよう縮んでしまい、はみ出した部分が見切れる)。
  const renderDayViewHorizontal = (scroll, groups, colorMap, totalPx, opts) => {
    const contentWidth = GROUP_LABEL_WIDTH + totalPx;

    const headerRow = el('div', 'cv-day-group-header-row');
    headerRow.style.display = 'flex';
    headerRow.style.width = `${contentWidth}px`;
    const spacer = el('div', 'cv-group-row-label');
    spacer.style.flex = `0 0 ${GROUP_LABEL_WIDTH}px`;
    const timeAxis = el('div', 'cv-day-timeaxis-horizontal');
    timeAxis.style.flex = `0 0 ${totalPx}px`;
    buildHourLabels(timeAxis, true);
    headerRow.appendChild(spacer);
    headerRow.appendChild(timeAxis);
    scroll.appendChild(headerRow);

    const body = el('div', 'cv-day-body cv-day-body-horizontal');
    body.style.width = `${contentWidth}px`;
    groups.forEach((group) => {
      body.appendChild(buildGroupLane(group, colorMap, totalPx, true, opts));
    });
    scroll.appendChild(body);
  };

  // 縦デザイン: 列ヘッダー行(時刻軸の余白48px + グループ名を等分)。縦スクロールしても
  // グループ名が見えるよう、cv-scroll内で上端に固定する(sticky、desktop.cssで指定)。
  const renderDayViewVertical = (scroll, groups, colorMap, totalPx, opts) => {
    const headerRow = el('div', 'cv-day-group-header-row');
    headerRow.style.display = 'flex';
    const headerSpacer = el('div', 'cv-day-timeaxis');
    headerSpacer.style.flex = `0 0 ${TIME_AXIS_WIDTH}px`;
    headerSpacer.style.height = 'auto';
    headerRow.appendChild(headerSpacer);
    groups.forEach((group) => {
      const cell = el('div', 'cv-group-header-cell');
      cell.style.flex = '1 1 0';
      cell.textContent = group.label;
      headerRow.appendChild(cell);
    });
    scroll.appendChild(headerRow);

    const dayGridEl = el('div', 'cv-day-grid');
    scroll.appendChild(dayGridEl);

    const timeAxis = el('div', 'cv-day-timeaxis');
    timeAxis.style.height = `${totalPx}px`;
    buildHourLabels(timeAxis, false);

    const body = el('div', 'cv-day-body');
    groups.forEach((group) => {
      body.appendChild(buildGroupLane(group, colorMap, totalPx, false, opts));
    });

    dayGridEl.appendChild(timeAxis);
    dayGridEl.appendChild(body);
  };

  const renderDayView = (scroll, events, opts) => {
    const dayStart = WeekGrid.startOfDay(opts.currentDate);
    const dayEvents = events.filter(
      (evt) => WeekGrid.startOfDay(evt.start).getTime() === dayStart.getTime(),
    );
    const groups = Grouping.buildDayGroups(dayEvents);
    const colorMap = ColorAssignment.assignColors(
      dayEvents.map((evt) => evt.colorKey),
      undefined,
      opts.colorOverrides,
    );
    const totalPx = DayGrid.MINUTES_PER_DAY * PX_PER_MINUTE;
    const horizontal = opts.layoutDirection === 'horizontal';

    if (horizontal) {
      renderDayViewHorizontal(scroll, groups, colorMap, totalPx, opts);
    } else {
      renderDayViewVertical(scroll, groups, colorMap, totalPx, opts);
    }

    // 初期表示位置: 最も早いイベントの1時間前(なければ現在時刻の1時間前)へスクロールする。
    // 24時間分のグリッドは cv-scroll の可視領域より高い/広いため、何も調整しないと常に0:00から
    // 表示されてしまい、日中〜夜のイベントが見えない(スクロールしないと存在に気づけない)。
    const earliestMinutes = dayEvents.length
      ? Math.min(
          ...dayEvents.map((evt) => DayGrid.minutesSinceMidnight(evt.start)),
        )
      : DayGrid.minutesSinceMidnight(opts.currentDate);
    const scrollTarget = Math.max(
      0,
      DayGrid.minutesToPixels(earliestMinutes - 60, PX_PER_MINUTE),
    );
    if (horizontal) {
      scroll.scrollLeft = scrollTarget;
    } else {
      scroll.scrollTop = scrollTarget;
    }
  };

  // 色分けの凡例。表示中の日/週に関わらず、取得済みレコード全体(最大100件)に含まれる値を
  // 対象にする(日/週を切り替えるたびに凡例の項目が増減して見づらくならないようにするため)。
  // assignColors()は色分けキー単体のハッシュのみで色を決めるため、ここで計算した色は
  // 実際に描画されるイベントの色と常に一致する(渡すキー集合の違いによる不一致は起きない)。
  const buildLegend = (events, opts) => {
    const labelByKey = new Map();
    events.forEach((evt) => {
      if (evt.colorKey !== '' && !labelByKey.has(evt.colorKey)) {
        labelByKey.set(evt.colorKey, evt.colorLabel || evt.colorKey);
      }
    });
    if (labelByKey.size === 0) {
      return null;
    }
    const keys = Array.from(labelByKey.keys());
    const colorMap = ColorAssignment.assignColors(
      keys,
      undefined,
      opts.colorOverrides,
    );

    const legend = el('div', 'cv-legend');
    keys.forEach((key) => {
      const item = el('span', 'cv-legend-item');
      const swatch = el('span', 'cv-legend-swatch');
      swatch.style.backgroundColor = colorMap[key];
      const label = el('span', 'cv-legend-label');
      label.textContent = labelByKey.get(key);
      item.appendChild(swatch);
      item.appendChild(label);
      legend.appendChild(item);
    });
    return legend;
  };

  const render = (container, opts) => {
    clearElement(container);
    const root = el('div', 'cv-root');

    if (opts.truncated) {
      const warning = el('div', 'cv-warning');
      warning.textContent = `⚠ このカレンダーは一覧の現在ページから最大${opts.maxRecords}件までを表示しています(全${opts.totalRecords}件中)。REST APIを使わずJavaScript APIのみでレコードを取得しているための制限です。`;
      root.appendChild(warning);
    }

    root.appendChild(buildToolbar(opts));

    const legend = buildLegend(opts.events, opts);
    if (legend) {
      root.appendChild(legend);
    }

    const scroll = el('div', 'cv-scroll');
    root.appendChild(scroll);

    // renderDayView()が日表示の初期スクロール位置(scrollTop)を設定するには、要素が
    // 実際のドキュメントツリーに接続済み(レイアウト計算が行われる状態)である必要がある。
    // そのため、scroll要素の中身を組み立てる前にcontainerへ接続しておく。
    container.appendChild(root);

    if (opts.currentUnit === 'day') {
      renderDayView(scroll, opts.events, opts);
    } else {
      renderWeekView(scroll, opts.events, opts);
    }
  };

  NS.CalendarRender = { render };
})(window);
