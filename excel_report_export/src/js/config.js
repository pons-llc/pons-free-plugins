(async (PLUGIN_ID) => {
  'use strict';

  const NS = window.ExcelReportExport;
  const { ConfigStore, CellMapping } = NS;

  const formEl = document.querySelector('.js-submit-settings');
  const cancelButtonEl = document.querySelector('.js-cancel-button');

  const templateAppIdEl = document.querySelector('.js-template-app-id');
  const templateRecordIdEl = document.querySelector('.js-template-record-id');
  const templateFieldCodeEl = document.querySelector('.js-template-field-code');

  const mappingTableBodyEl = document.getElementById('js-mapping-table-body');
  const mappingAddButtonEl = document.getElementById('js-mapping-add');
  const mappingRowTemplateEl = document.getElementById(
    'js-mapping-row-template',
  );
  const mappingErrorsEl = document.querySelector('.js-mapping-errors');

  const subtableListEl = document.getElementById('js-subtable-list');
  const subtableFieldPickerEl = document.querySelector(
    '.js-subtable-field-picker',
  );
  const subtableAddButtonEl = document.getElementById('js-subtable-add');
  const subtableBlockTemplateEl = document.getElementById(
    'js-subtable-block-template',
  );
  const subtableColumnRowTemplateEl = document.getElementById(
    'js-subtable-column-row-template',
  );

  const fileNameTemplateEl = document.querySelector('.js-filename-template');
  const bulkLimitEl = document.querySelector('.js-bulk-limit');

  // kintone.app.getFormFields() は REST APIのレスポンスと同様の、フィールドコードをキーにした
  // 平坦なオブジェクト(properties相当)を解決する(CLAUDE.md方針3: JavaScript APIを優先)。
  const formFields = await kintone.app.getFormFields();
  const UNSUPPORTED_MAPPING_TYPES = new Set([
    'SUBTABLE',
    'REFERENCE_TABLE',
    'LABEL',
    'SPACER',
    'HR',
    'GROUP',
  ]);
  const mappableFields = Object.values(formFields).filter(
    (f) => !UNSUPPORTED_MAPPING_TYPES.has(f.type),
  );
  const subtableFields = Object.values(formFields).filter(
    (f) => f.type === 'SUBTABLE',
  );

  const buildOptions = (selectEl, fields, selectedCode) => {
    selectEl.innerHTML = '';
    fields.forEach((field) => {
      const optionEl = document.createElement('option');
      optionEl.value = field.code;
      optionEl.textContent = `${field.label} (${field.code})`;
      optionEl.selected = field.code === selectedCode;
      selectEl.appendChild(optionEl);
    });
  };

  const config = ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  // --- テンプレート参照先 ---
  templateAppIdEl.value = config.templateSource.appId;
  templateRecordIdEl.value = config.templateSource.recordId;
  templateFieldCodeEl.value = config.templateSource.fieldCode;

  // --- セルマッピング ---
  const renderMappingTable = () => {
    mappingTableBodyEl.innerHTML = '';
    config.mappings.forEach((mapping, index) => {
      const fragment = mappingRowTemplateEl.content.cloneNode(true);
      const rowEl = fragment.querySelector('.js-mapping-row');
      const sheetEl = rowEl.querySelector('.js-mapping-sheet');
      const cellEl = rowEl.querySelector('.js-mapping-cell');
      const fieldEl = rowEl.querySelector('.js-mapping-field');
      const removeEl = rowEl.querySelector('.js-mapping-remove');

      sheetEl.value = mapping.sheetName;
      cellEl.value = mapping.cellAddress;
      buildOptions(fieldEl, mappableFields, mapping.fieldCode);

      sheetEl.addEventListener('input', () => {
        config.mappings[index].sheetName = sheetEl.value;
      });
      cellEl.addEventListener('input', () => {
        config.mappings[index].cellAddress = cellEl.value.toUpperCase();
      });
      fieldEl.addEventListener('change', () => {
        config.mappings[index].fieldCode = fieldEl.value;
      });
      removeEl.addEventListener('click', () => {
        config.mappings.splice(index, 1);
        renderMappingTable();
      });

      mappingTableBodyEl.appendChild(rowEl);
    });
  };
  renderMappingTable();

  mappingAddButtonEl.addEventListener('click', () => {
    config.mappings.push({
      sheetName: '',
      cellAddress: '',
      fieldCode: mappableFields[0] ? mappableFields[0].code : '',
    });
    renderMappingTable();
  });

  // --- サブテーブル設定 ---
  buildOptions(subtableFieldPickerEl, subtableFields, '');

  const columnFieldsFor = (tableFieldCode) => {
    const tableField = subtableFields.find((f) => f.code === tableFieldCode);
    return tableField ? Object.values(tableField.fields || {}) : [];
  };

  const renderSubtableList = () => {
    subtableListEl.innerHTML = '';
    config.subtables.forEach((subtable, index) => {
      const tableField = subtableFields.find(
        (f) => f.code === subtable.tableFieldCode,
      );
      if (!tableField) {
        return;
      }
      const fragment = subtableBlockTemplateEl.content.cloneNode(true);
      const titleEl = fragment.querySelector('.js-subtable-title');
      const sheetEl = fragment.querySelector('.js-subtable-sheet');
      const startRowEl = fragment.querySelector('.js-subtable-start-row');
      const maxRowsEl = fragment.querySelector('.js-subtable-max-rows');
      const columnsBodyEl = fragment.querySelector('.js-subtable-columns');
      const columnAddButtonEl = fragment.querySelector(
        '.js-subtable-column-add',
      );
      const removeEl = fragment.querySelector('.js-subtable-remove');

      titleEl.textContent = `${tableField.label} (${tableField.code})`;
      sheetEl.value = subtable.sheetName;
      startRowEl.value = subtable.startRow;
      maxRowsEl.value = subtable.maxRows;

      sheetEl.addEventListener('input', () => {
        config.subtables[index].sheetName = sheetEl.value;
      });
      startRowEl.addEventListener('input', () => {
        config.subtables[index].startRow = Number(startRowEl.value) || 1;
      });
      maxRowsEl.addEventListener('input', () => {
        config.subtables[index].maxRows = Number(maxRowsEl.value) || 1;
      });

      const renderColumns = () => {
        columnsBodyEl.innerHTML = '';
        subtable.columns.forEach((column, columnIndex) => {
          const columnFragment =
            subtableColumnRowTemplateEl.content.cloneNode(true);
          const columnRowEl = columnFragment.querySelector(
            '.js-subtable-column-row',
          );
          const columnLetterEl = columnRowEl.querySelector(
            '.js-subtable-column',
          );
          const columnFieldEl = columnRowEl.querySelector(
            '.js-subtable-column-field',
          );
          const columnRemoveEl = columnRowEl.querySelector(
            '.js-subtable-column-remove',
          );

          columnLetterEl.value = column.column;
          buildOptions(
            columnFieldEl,
            columnFieldsFor(subtable.tableFieldCode),
            column.fieldCode,
          );

          columnLetterEl.addEventListener('input', () => {
            config.subtables[index].columns[columnIndex].column =
              columnLetterEl.value.toUpperCase();
          });
          columnFieldEl.addEventListener('change', () => {
            config.subtables[index].columns[columnIndex].fieldCode =
              columnFieldEl.value;
          });
          columnRemoveEl.addEventListener('click', () => {
            config.subtables[index].columns.splice(columnIndex, 1);
            renderColumns();
          });

          columnsBodyEl.appendChild(columnFragment);
        });
      };
      renderColumns();

      columnAddButtonEl.addEventListener('click', () => {
        const columnFields = columnFieldsFor(subtable.tableFieldCode);
        config.subtables[index].columns.push({
          column: '',
          fieldCode: columnFields[0] ? columnFields[0].code : '',
        });
        renderColumns();
      });

      removeEl.addEventListener('click', () => {
        config.subtables.splice(index, 1);
        renderSubtableList();
      });

      subtableListEl.appendChild(fragment);
    });
  };
  renderSubtableList();

  subtableAddButtonEl.addEventListener('click', () => {
    const tableFieldCode = subtableFieldPickerEl.value;
    if (
      !tableFieldCode ||
      config.subtables.some((s) => s.tableFieldCode === tableFieldCode)
    ) {
      return;
    }
    config.subtables.push({
      tableFieldCode,
      sheetName: '',
      startRow: 2,
      maxRows: 20,
      columns: [],
    });
    renderSubtableList();
  });

  // --- 出力ファイル名 / 一括ダウンロード上限 ---
  fileNameTemplateEl.value = config.fileNameTemplate;
  bulkLimitEl.value = config.bulkDownloadLimit;

  cancelButtonEl.addEventListener('click', () => {
    window.location.href = '../../' + kintone.app.getId() + '/plugin/';
  });

  formEl.addEventListener('submit', (e) => {
    e.preventDefault();
    mappingErrorsEl.textContent = '';

    config.templateSource = {
      appId: templateAppIdEl.value.trim(),
      recordId: templateRecordIdEl.value.trim(),
      fieldCode: templateFieldCodeEl.value.trim(),
    };
    config.fileNameTemplate = fileNameTemplateEl.value.trim() || 'report';
    config.bulkDownloadLimit = Number(bulkLimitEl.value) || 0;

    const errors = [];
    if (
      !config.templateSource.appId ||
      !config.templateSource.recordId ||
      !config.templateSource.fieldCode
    ) {
      errors.push(
        'テンプレート参照先(アプリID・レコードID・フィールドコード)をすべて入力してください。',
      );
    }

    const mappingValidation = CellMapping.validateMapping(config.mappings);
    mappingValidation.errors.forEach((err) => {
      errors.push(`セルマッピング${err.index + 1}行目: ${err.message}`);
    });

    config.subtables.forEach((subtable, index) => {
      if (!subtable.sheetName.trim()) {
        errors.push(
          `サブテーブル設定${index + 1}: 出力先シート名を入力してください。`,
        );
      }
      if (subtable.columns.length === 0) {
        errors.push(
          `サブテーブル設定${index + 1}: 列マッピングを1つ以上追加してください。`,
        );
      }
    });

    if (!config.bulkDownloadLimit || config.bulkDownloadLimit <= 0) {
      errors.push('一括ダウンロードの上限件数を1以上で入力してください。');
    }

    if (errors.length > 0) {
      mappingErrorsEl.textContent = errors.join('\n');
      return;
    }

    kintone.plugin.app.setConfig(ConfigStore.serialize(config), () => {
      alert('プラグインの設定を保存しました。アプリを更新してください。');
      window.location.href = '../../flow?app=' + kintone.app.getId();
    });
  });
})(kintone.$PLUGIN_ID);
