(function (global, kintone) {
  'use strict';

  const NS = global.HierarchyView;
  const PLUGIN_ID = kintone.$PLUGIN_ID;

  const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  // plugin_idea_plan.mdの全件取得方針: offset・カーソルAPIは使わず、$id昇順+$id>直前最大$idの
  // ページングで500件ずつ取得する。現在の絞り込み条件は kintone.app.getQueryCondition() で
  // 取得する(order by/limit/offsetを含まない条件部分のみが返る)。
  const fetchAllRecords = async () => {
    const baseCondition = kintone.app.getQueryCondition();
    const records = [];
    let lastId = 0;
    for (;;) {
      const clauses = [];
      if (baseCondition) {
        clauses.push(`(${baseCondition})`);
      }
      clauses.push(`$id > ${lastId}`);
      const query = `${clauses.join(' and ')} order by $id asc limit 500`;
      const response = await kintone.api(
        kintone.api.url('/k/v1/records.json', true),
        'GET',
        { app: kintone.app.getId(), query },
      );
      if (response.records.length === 0) {
        break;
      }
      records.push(...response.records);
      lastId = response.records[response.records.length - 1].$id.value;
      if (response.records.length < 500) {
        break;
      }
    }
    return records;
  };

  // 保留中の変更を反映した見かけ上のレコード配列を組み立てる(表示専用、実データは書き換えない)。
  const applyPendingChangesForDisplay = (records, pendingChanges) =>
    records.map((record) => {
      const recordId = NS.TreeBuilder.getFieldValue(record, '$id');
      if (!(recordId in pendingChanges)) {
        return record;
      }
      const overridden = Object.assign({}, record);
      overridden[config.parentFieldCode] = {
        type: record[config.parentFieldCode]
          ? record[config.parentFieldCode].type
          : 'SINGLE_LINE_TEXT',
        value: pendingChanges[recordId],
      };
      return overridden;
    });

  const recordLabel = (record) => {
    const idValue = NS.TreeBuilder.getFieldValue(record, '$id');
    const recordNumber = record.レコード番号
      ? record.レコード番号.value
      : idValue;
    return `#${recordNumber}`;
  };

  const initHierarchyView = (initialRecords) => {
    if (!config.parentFieldCode || !config.matchFieldCode) {
      return;
    }
    const headerEl = kintone.app.getHeaderMenuSpaceElement();
    if (!headerEl) {
      return;
    }
    headerEl.innerHTML = '';

    let currentRecords = initialRecords;
    let pendingChanges = {};
    let editMode = false;

    const containerEl = document.createElement('div');
    containerEl.className = 'hrv-container';

    const toolbarEl = document.createElement('div');
    toolbarEl.className = 'hrv-toolbar';

    const fetchAllButtonEl = document.createElement('button');
    fetchAllButtonEl.type = 'button';
    fetchAllButtonEl.className = 'kintoneplugin-button-normal';
    fetchAllButtonEl.textContent = '現在のクエリで全件表示';

    const editModeButtonEl = document.createElement('button');
    editModeButtonEl.type = 'button';
    editModeButtonEl.className = 'kintoneplugin-button-normal';
    editModeButtonEl.textContent = '編集モード: OFF';

    const saveButtonEl = document.createElement('button');
    saveButtonEl.type = 'button';
    saveButtonEl.className = 'kintoneplugin-button-dialog-ok';
    saveButtonEl.textContent = '保存';
    saveButtonEl.disabled = true;

    toolbarEl.appendChild(fetchAllButtonEl);
    toolbarEl.appendChild(editModeButtonEl);
    toolbarEl.appendChild(saveButtonEl);

    const treeEl = document.createElement('div');
    treeEl.className = 'hrv-tree';

    containerEl.appendChild(toolbarEl);
    containerEl.appendChild(treeEl);
    headerEl.appendChild(containerEl);

    const renderNode = (node) => {
      const li = document.createElement('li');
      li.className = 'hrv-node';
      const recordId = NS.TreeBuilder.getFieldValue(node.record, '$id');
      li.dataset.recordId = recordId;
      li.draggable = editMode;

      const labelEl = document.createElement('span');
      labelEl.className = 'hrv-node-label';
      labelEl.textContent = recordLabel(node.record);
      li.appendChild(labelEl);

      li.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', recordId);
      });
      li.addEventListener('dragover', (e) => {
        if (editMode) {
          e.preventDefault();
        }
      });
      li.addEventListener('drop', (e) => {
        e.preventDefault();
        const movingId = e.dataTransfer.getData('text/plain');
        if (!movingId || movingId === recordId) {
          return;
        }
        const displayRecords = applyPendingChangesForDisplay(
          currentRecords,
          pendingChanges,
        );
        if (
          NS.CycleCheck.wouldCreateCycle(
            displayRecords,
            movingId,
            recordId,
            config.parentFieldCode,
            config.matchFieldCode,
          )
        ) {
          alert('その移動は循環参照になるため実行できません。');
          return;
        }
        pendingChanges = NS.PendingChanges.setChange(
          pendingChanges,
          movingId,
          recordId,
        );
        saveButtonEl.disabled = false;
        renderTree();
      });

      if (node.children.length > 0) {
        const ul = document.createElement('ul');
        ul.className = 'hrv-node-children';
        node.children.forEach((child) => ul.appendChild(renderNode(child)));
        li.appendChild(ul);
      }
      return li;
    };

    const renderTree = () => {
      treeEl.innerHTML = '';
      const displayRecords = applyPendingChangesForDisplay(
        currentRecords,
        pendingChanges,
      );
      const nodes = NS.TreeBuilder.buildTree(
        displayRecords,
        config.parentFieldCode,
        config.matchFieldCode,
      );
      const rootUl = document.createElement('ul');
      rootUl.className = 'hrv-node-children hrv-root';
      nodes.forEach((node) => rootUl.appendChild(renderNode(node)));
      treeEl.appendChild(rootUl);
    };

    fetchAllButtonEl.addEventListener('click', async () => {
      fetchAllButtonEl.disabled = true;
      try {
        currentRecords = await fetchAllRecords();
        renderTree();
      } finally {
        fetchAllButtonEl.disabled = false;
      }
    });

    editModeButtonEl.addEventListener('click', () => {
      editMode = !editMode;
      editModeButtonEl.textContent = editMode
        ? '編集モード: ON'
        : '編集モード: OFF';
      renderTree();
    });

    saveButtonEl.addEventListener('click', async () => {
      const bodies = NS.PendingChanges.buildUpdateRequestBodies(
        kintone.app.getId(),
        pendingChanges,
        config.parentFieldCode,
      );
      saveButtonEl.disabled = true;
      try {
        for (const body of bodies) {
          await kintone.api(
            kintone.api.url('/k/v1/records.json', true),
            'PUT',
            body,
          );
        }
        currentRecords = applyPendingChangesForDisplay(
          currentRecords,
          pendingChanges,
        );
        pendingChanges = {};
        renderTree();
        alert('親レコードの変更を保存しました。');
      } catch (err) {
        alert(`保存に失敗しました: ${(err && err.message) || err}`);
        saveButtonEl.disabled = false;
      }
    });

    renderTree();
  };

  kintone.events.on('app.record.index.show', (event) => {
    if (event.viewType !== 'list') {
      return event;
    }
    initHierarchyView(event.records);
    return event;
  });
})(window, kintone);
