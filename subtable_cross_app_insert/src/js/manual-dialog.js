(function (global, kintone) {
  'use strict';

  const NS = global.SubtableCrossAppInsert;

  // 行のプレビュー文字列を組み立てる。サブテーブル列のマッピングがあればその値を、
  // なければ更新キー列の値を使う。値はすべて後段でtextContentに設定するため、
  // ここでHTML文字列を組み立てることはしない(XSS対策。secureCodingGuideline.md参照)。
  const buildRowSummaryParts = (config, row) => {
    const rowValue = row.value || {};
    const subtableColumnMappings = (config.fieldMappings || []).filter(
      (m) => m.sourceType === 'SUBTABLE_COLUMN',
    );
    const columns =
      subtableColumnMappings.length > 0 ? subtableColumnMappings : [];
    if (columns.length === 0) {
      const keyField = rowValue[config.updateKey.subtableColumnCode];
      return [keyField ? String(keyField.value) : ''];
    }
    return columns.slice(0, 4).map((m) => {
      const field = rowValue[m.sourceCode];
      return field ? String(field.value) : '';
    });
  };

  // ダイアログ本文のDOM要素を組み立てる。すべてcreateElement/textContentで構築し、
  // innerHTMLは一切使用しない(kintone.createDialogの`config.body`はサニタイズせずそのまま
  // 挿入されるため、ここでの安全な構築が唯一の防御線になる。secureCodingGuideline.md参照)。
  const buildDialogBody = (config, rows) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'scai-dialog-body';

    const description = document.createElement('p');
    description.textContent = `対象サブテーブルの行数: ${rows.length}件。転送する行にチェックを入れて「転送実行」を押してください(既定ではすべての行にチェックが入っています = 一括転送)。`;
    wrapper.appendChild(description);

    const controls = document.createElement('div');
    controls.className = 'scai-dialog-controls';
    const selectAllButton = document.createElement('button');
    selectAllButton.type = 'button';
    selectAllButton.textContent = 'すべて選択';
    const clearAllButton = document.createElement('button');
    clearAllButton.type = 'button';
    clearAllButton.textContent = 'すべて解除';
    controls.appendChild(selectAllButton);
    controls.appendChild(clearAllButton);
    wrapper.appendChild(controls);

    const table = document.createElement('table');
    table.className = 'scai-dialog-table';
    const tbody = document.createElement('tbody');

    const checkboxes = [];
    rows.forEach((row) => {
      const tr = document.createElement('tr');

      const checkboxCell = document.createElement('td');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = true;
      checkbox.dataset.rowId = row.id;
      checkboxes.push(checkbox);
      checkboxCell.appendChild(checkbox);
      tr.appendChild(checkboxCell);

      const summaryCell = document.createElement('td');
      summaryCell.textContent = buildRowSummaryParts(config, row).join(' / ');
      tr.appendChild(summaryCell);

      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrapper.appendChild(table);

    const errorEl = document.createElement('p');
    errorEl.className = 'scai-dialog-error';
    errorEl.style.display = 'none';
    wrapper.appendChild(errorEl);

    selectAllButton.addEventListener('click', () => {
      checkboxes.forEach((cb) => {
        cb.checked = true;
      });
    });
    clearAllButton.addEventListener('click', () => {
      checkboxes.forEach((cb) => {
        cb.checked = false;
      });
    });

    return { wrapper, checkboxes, errorEl };
  };

  // 手動転送ダイアログを開く。呼び出し元(detail画面)が既に取得済みのレコード情報を渡す。
  const openTransferDialog = async (config, sourceRecord) => {
    const rows = NS.TransferService.getRows(config, sourceRecord);
    if (rows.length === 0) {
      await kintone.showNotification(
        'INFO',
        '転送対象のサブテーブルに行がありません。',
      );
      return;
    }

    const { wrapper, checkboxes } = buildDialogBody(config, rows);

    const dialog = await kintone.createDialog({
      title: 'サブテーブルの行を転送',
      body: wrapper,
      okButtonText: '転送実行',
      showCancelButton: true,
      cancelButtonText: 'キャンセル',
      showCloseButton: true,
    });

    const action = await dialog.show();
    if (action !== 'OK') {
      return;
    }

    const selectedRowIds = checkboxes
      .filter((cb) => cb.checked)
      .map((cb) => cb.dataset.rowId);
    if (selectedRowIds.length === 0) {
      await kintone.showNotification(
        'ERROR',
        '転送する行が1件も選択されていません。',
      );
      return;
    }

    await kintone.showLoading('VISIBLE');
    try {
      const result = await NS.TransferService.runManual(
        config,
        sourceRecord,
        selectedRowIds,
      );

      if (config.successActionEnabled && config.successActionFieldCode) {
        await NS.RestClient.updateSelfField(
          kintone.app.getId(),
          sourceRecord.$id.value,
          sourceRecord.$revision.value,
          config.successActionFieldCode,
          config.successActionValue,
        );
      }

      await kintone.showNotification(
        'SUCCESS',
        `${result.transferredRowCount}件を転送しました。画面を再読み込みします。`,
      );
      global.location.reload();
    } catch (err) {
      await kintone.showNotification(
        'ERROR',
        `転送に失敗しました: ${err.message || err}`,
      );
    } finally {
      await kintone.showLoading('HIDDEN');
    }
  };

  NS.ManualDialog = { openTransferDialog, buildRowSummaryParts };
})(window, kintone);
