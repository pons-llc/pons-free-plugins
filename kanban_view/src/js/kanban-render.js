(function (global) {
  'use strict';

  // カンバンボードのDOM描画のみを担当する(kintone APIには一切依存しない)。
  // タイトル/バッジ/期限/担当者はすべて textContent で挿入し、ホバー詳細は
  // title属性へのプロパティ代入で設定する(DOM APIのプロパティ代入はHTMLエスケープの
  // 心配が無いため innerHTML は使わない。secureCodingGuideline.md参照)。

  const NS = global.KanbanView;

  const renderCard = (card, onCardClick) => {
    const cardEl = document.createElement('div');
    cardEl.className = 'kb-card';
    if (card.hoverText) {
      cardEl.title = card.hoverText;
    }

    const titleEl = document.createElement('div');
    titleEl.className = 'kb-card-title';
    titleEl.textContent = card.title;
    cardEl.appendChild(titleEl);

    if (card.badgeLabel) {
      const badgeEl = document.createElement('span');
      badgeEl.className = 'kb-badge';
      badgeEl.textContent = card.badgeLabel;
      cardEl.appendChild(badgeEl);
    }

    const metaEl = document.createElement('div');
    metaEl.className = 'kb-card-meta';

    if (card.dueLabel) {
      const dueEl = document.createElement('span');
      dueEl.className = card.overdue ? 'kb-due kb-due-overdue' : 'kb-due';
      dueEl.textContent = (card.overdue ? '🔥 ' : '') + card.dueLabel;
      metaEl.appendChild(dueEl);
    }

    if (card.assignee) {
      const assigneeEl = document.createElement('span');
      assigneeEl.className = 'kb-assignee';
      assigneeEl.textContent = card.assignee.name;
      metaEl.appendChild(assigneeEl);
    }

    cardEl.appendChild(metaEl);

    if (card.id !== undefined && typeof onCardClick === 'function') {
      cardEl.classList.add('kb-card-clickable');
      cardEl.addEventListener('click', () => onCardClick(card.id));
    }

    return cardEl;
  };

  const renderColumn = (column, onCardClick) => {
    const colEl = document.createElement('div');
    colEl.className = 'kb-column';

    const headerEl = document.createElement('div');
    headerEl.className = 'kb-column-header';
    const labelEl = document.createElement('span');
    labelEl.className = 'kb-column-label';
    labelEl.textContent = column.label;
    const countEl = document.createElement('span');
    countEl.className = 'kb-column-count';
    countEl.textContent = String(column.cards.length);
    headerEl.append(labelEl, countEl);
    colEl.appendChild(headerEl);

    const bodyEl = document.createElement('div');
    bodyEl.className = 'kb-column-body';
    column.cards.forEach((card) =>
      bodyEl.appendChild(renderCard(card, onCardClick)),
    );
    colEl.appendChild(bodyEl);

    return colEl;
  };

  // boardColumns: [{ key, label, cards: [cardModel, ...] }]
  const render = (container, { boardColumns, totalCount, onCardClick }) => {
    container.textContent = '';

    const rootEl = document.createElement('div');
    rootEl.className = 'kb-root';

    const statusEl = document.createElement('div');
    statusEl.className = 'kb-status';
    statusEl.textContent = `表示中: ${totalCount}件`;
    rootEl.appendChild(statusEl);

    const boardEl = document.createElement('div');
    boardEl.className = 'kb-board';
    (boardColumns || []).forEach((column) => {
      boardEl.appendChild(renderColumn(column, onCardClick));
    });
    rootEl.appendChild(boardEl);

    container.appendChild(rootEl);
  };

  const KanbanRender = { render };

  NS.KanbanRender = KanbanRender;
})(typeof window !== 'undefined' ? window : globalThis);
