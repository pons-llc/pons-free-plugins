(function (global) {
  'use strict';

  // カレンダーのDOM描画を担当する。レコード値に由来する文字列は必ずtextContent/title
  // プロパティ代入で挿入し、innerHTML/insertAdjacentHTMLは使用しない(security-checklist.md参照)。

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
    navGroup.appendChild(prevBtn);
    navGroup.appendChild(todayBtn);
    navGroup.appendChild(nextBtn);
    navGroup.appendChild(periodLabel);

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

  const attachClickAndDrag = (blockEl, evt, opts) => {
    blockEl.addEventListener('click', () => opts.onEventClick(evt.recordId));
    if (!opts.dragEnabled) {
      return;
    }
    blockEl.draggable = true;
    blockEl.addEventListener('dragstart', (e) => {
      opts.setDraggingEvent(evt);
      blockEl.classList.add(
        'cv-event-block-dragging',
        'cv-event-chip-dragging',
      );
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(evt.recordId));
    });
    blockEl.addEventListener('dragend', () => {
      blockEl.classList.remove(
        'cv-event-block-dragging',
        'cv-event-chip-dragging',
      );
      opts.setDraggingEvent(null);
    });
  };

  // ---- 週表示(曜日を軸、グループは色分けのみ) ----

  const buildWeekDayCell = (dayEvents, dayIndex, colorMap, opts) => {
    const cell = el('div', 'cv-week-day-cell');
    cell.dataset.dayIndex = String(dayIndex);

    dayEvents.forEach((evt) => {
      const chip = el('div', 'cv-event-chip');
      chip.style.backgroundColor = colorMap[evt.groupKey] || '#3498db';
      const hh = String(evt.start.getHours()).padStart(2, '0');
      const mm = String(evt.start.getMinutes()).padStart(2, '0');
      chip.textContent = evt.allDay ? evt.title : `${hh}:${mm} ${evt.title}`;
      applyHover(chip, evt);
      attachClickAndDrag(chip, evt, opts);
      cell.appendChild(chip);
    });

    if (opts.dragEnabled) {
      cell.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        cell.classList.add('cv-week-day-cell-dragover');
      });
      cell.addEventListener('dragleave', () =>
        cell.classList.remove('cv-week-day-cell-dragover'),
      );
      cell.addEventListener('drop', (e) => {
        e.preventDefault();
        cell.classList.remove('cv-week-day-cell-dragover');
        const draggingEvent = opts.getDraggingEvent();
        if (!draggingEvent) {
          return;
        }
        const weekStart = WeekGrid.startOfWeek(opts.currentDate);
        const originalIndex = WeekGrid.dayIndexInWeek(
          draggingEvent.start,
          weekStart,
        );
        const deltaDays = dayIndex - originalIndex;
        if (deltaDays === 0) {
          return;
        }
        opts.onEventDrop(draggingEvent, { kind: 'week', deltaDays });
      });
    }

    return cell;
  };

  const renderWeekView = (scroll, events, opts) => {
    const weekStart = WeekGrid.startOfWeek(opts.currentDate);
    const buckets = WeekGrid.bucketEventsByDay(events, weekStart);
    const groupKeys = Array.from(new Set(events.map((e) => e.groupKey)));
    const colorMap = ColorAssignment.assignColors(groupKeys);
    const horizontal = opts.layoutDirection === 'horizontal';

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
      header.textContent = `${dayDate.getMonth() + 1}/${dayDate.getDate()}(${DAY_LABELS[i]})`;
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

  // ---- 日表示(グループを軸に使用) ----

  const buildEventBlock = (evt, group, colorMap, horizontal, opts) => {
    const startMin = DayGrid.minutesSinceMidnight(evt.start);
    const rawEndMin = DayGrid.minutesSinceMidnight(evt.end);
    const endMin =
      evt.end.getTime() > evt.start.getTime() && rawEndMin > startMin
        ? Math.min(DayGrid.MINUTES_PER_DAY, rawEndMin)
        : DayGrid.MINUTES_PER_DAY;
    const durationMin = Math.max(15, endMin - startMin);

    const block = el('div', 'cv-event-block');
    block.style.backgroundColor = colorMap[group.key] || '#3498db';
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
    attachClickAndDrag(block, evt, opts);
    return block;
  };

  // 1グループ分のレーン(縦デザイン: 列/横デザイン: 行)を組み立てる。
  // 横デザインの場合は「グループ名ラベル + タイムライン」を横並びにした行全体を返す。
  const buildGroupLane = (group, colorMap, totalPx, horizontal, opts) => {
    const lane = el(
      'div',
      horizontal ? 'cv-day-group-row' : 'cv-day-group-col',
    );
    lane.dataset.groupKey = group.key;
    lane.style.position = 'relative';
    if (horizontal) {
      lane.style.minWidth = `${totalPx}px`;
      lane.style.flex = '1 1 auto';
    } else {
      lane.style.height = `${totalPx}px`;
      lane.style.flex = '1 1 0';
    }

    group.events.forEach((evt) => {
      lane.appendChild(buildEventBlock(evt, group, colorMap, horizontal, opts));
    });

    if (opts.dragEnabled) {
      const dragoverClass = horizontal
        ? 'cv-day-group-row-dragover'
        : 'cv-day-group-col-dragover';
      lane.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        lane.classList.add(dragoverClass);
      });
      lane.addEventListener('dragleave', () =>
        lane.classList.remove(dragoverClass),
      );
      lane.addEventListener('drop', (e) => {
        e.preventDefault();
        lane.classList.remove(dragoverClass);
        const draggingEvent = opts.getDraggingEvent();
        if (!draggingEvent) {
          return;
        }
        const rect = lane.getBoundingClientRect();
        const offsetPx = horizontal
          ? e.clientX - rect.left
          : e.clientY - rect.top;
        const newMinutes = DayGrid.pixelsToMinutes(offsetPx, PX_PER_MINUTE);
        const originalMinutes = DayGrid.minutesSinceMidnight(
          draggingEvent.start,
        );
        const deltaMinutes = newMinutes - originalMinutes;
        const newGroupKey = opts.groupDragUpdatable ? group.key : undefined;
        const groupChanged =
          newGroupKey !== undefined && newGroupKey !== draggingEvent.groupKey;
        if (deltaMinutes === 0 && !groupChanged) {
          return;
        }
        opts.onEventDrop(
          draggingEvent,
          { kind: 'day', deltaMinutes },
          newGroupKey,
        );
      });
    }

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

  const renderDayView = (scroll, events, opts) => {
    const dayStart = WeekGrid.startOfDay(opts.currentDate);
    const dayEvents = events.filter(
      (evt) => WeekGrid.startOfDay(evt.start).getTime() === dayStart.getTime(),
    );
    const groups = Grouping.buildDayGroups(dayEvents);
    const colorMap = ColorAssignment.assignColors(groups.map((g) => g.key));
    const totalPx = DayGrid.MINUTES_PER_DAY * PX_PER_MINUTE;
    const horizontal = opts.layoutDirection === 'horizontal';

    if (!horizontal) {
      // 列ヘッダー行(時刻軸の余白48px + グループ名を等分)。縦スクロールしてもグループ名が
      // 見えるよう、cv-scroll内で上端に固定する(sticky)。
      const headerRow = el('div', 'cv-day-group-header-row');
      headerRow.style.display = 'flex';
      const spacer = el('div', 'cv-day-timeaxis');
      spacer.style.flex = '0 0 48px';
      spacer.style.height = 'auto';
      headerRow.appendChild(spacer);
      groups.forEach((group) => {
        const cell = el('div', 'cv-group-header-cell');
        cell.style.flex = '1 1 0';
        cell.textContent = group.label;
        headerRow.appendChild(cell);
      });
      scroll.appendChild(headerRow);
    }

    const dayGridEl = el('div', 'cv-day-grid');
    scroll.appendChild(dayGridEl);

    const timeAxis = el(
      'div',
      horizontal ? 'cv-day-timeaxis-horizontal' : 'cv-day-timeaxis',
    );
    if (horizontal) {
      timeAxis.style.width = `${totalPx}px`;
    } else {
      timeAxis.style.height = `${totalPx}px`;
    }
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

    const body = el(
      'div',
      horizontal ? 'cv-day-body cv-day-body-horizontal' : 'cv-day-body',
    );
    groups.forEach((group) => {
      body.appendChild(
        buildGroupLane(group, colorMap, totalPx, horizontal, opts),
      );
    });

    if (horizontal) {
      dayGridEl.style.flexDirection = 'column';
      dayGridEl.appendChild(timeAxis);
      dayGridEl.appendChild(body);
    } else {
      dayGridEl.appendChild(timeAxis);
      dayGridEl.appendChild(body);
    }

    // 初期表示位置: 最も早いイベントの1時間前(なければ現在時刻の1時間前)へスクロールする。
    // 24時間分のグリッドは cv-scroll の可視領域より高いため、何も調整しないと常に0:00から
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

  const render = (container, opts) => {
    clearElement(container);
    const root = el('div', 'cv-root');

    if (opts.truncated) {
      const warning = el('div', 'cv-warning');
      warning.textContent = `⚠ このカレンダーは一覧の現在ページから最大${opts.maxRecords}件までを表示しています(全${opts.totalRecords}件中)。REST APIを使わずJavaScript APIのみでレコードを取得しているための制限です。`;
      root.appendChild(warning);
    }

    root.appendChild(buildToolbar(opts));

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
