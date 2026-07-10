(async (PLUGIN_ID) => {
  'use strict';

  const NS = window.RelatedRecordSummary;

  const formEl = document.querySelector('.js-submit-settings');
  const cancelButtonEl = document.querySelector('.js-cancel-button');
  const rowBodyEl = document.getElementById('js-row-body');
  const rowAddButtonEl = document.getElementById('js-row-add');
  const rowTemplateEl = document.getElementById('js-row-template');
  const triggerSubmitEl = document.querySelector('.js-trigger-submit');
  const triggerDetailEl = document.querySelector('.js-trigger-detail');
  const triggerIndexEl = document.querySelector('.js-trigger-index');
  const bulkGroupCodesEl = document.querySelector('.js-bulk-group-codes');

  // kintone.app.getFormFields() は REST APIのレスポンスの `properties` と同様の値
  // (referenceTableを含む)を返す。関連レコード一覧フィールドの参照先アプリの情報も
  // ここから取得できる(CLAUDE.md方針3: 同じ目的を達成できるならJS APIを優先する)。
  const formFields = await kintone.app.getFormFields();
  const referenceFields = Object.values(formFields).filter(
    (f) => f.type === 'REFERENCE_TABLE',
  );
  const numberFields = Object.values(formFields).filter(
    (f) => f.type === 'NUMBER',
  );

  // 参照先アプリのフィールド一覧はこのアプリのJS APIでは取得できないため、
  // 集計対象フィールド(SUM/AVERAGE用)の候補を出すためだけにREST APIを使う
  // (参照先アプリのフィールド一覧を読むだけであり、レコードの読み書きではない)。
  const relatedAppFieldsCache = {};
  const fetchRelatedAppNumberFields = async (relatedAppId) => {
    if (!relatedAppId) {
      return [];
    }
    if (!relatedAppFieldsCache[relatedAppId]) {
      const resp = await kintone.api(
        kintone.api.url('/k/v1/app/form/fields.json', true),
        'GET',
        {
          app: relatedAppId,
        },
      );
      // 同じrelatedAppIdへ連続でawaitが重なった場合、キャッシュへの書き込みが複数回起きることは
      // あり得るが、書き込む値は毎回同じ(冪等)なので実害はない。require-atomic-updatesは誤検知として無効化する。
      // eslint-disable-next-line require-atomic-updates
      relatedAppFieldsCache[relatedAppId] = Object.values(
        resp.properties,
      ).filter((f) => f.type === 'NUMBER');
    }
    return relatedAppFieldsCache[relatedAppId];
  };

  const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  const buildOptions = (selectEl, fields, selectedCode) => {
    selectEl.innerHTML = '';
    const blankOptionEl = document.createElement('option');
    blankOptionEl.value = '';
    blankOptionEl.textContent = '(選択してください)';
    selectEl.appendChild(blankOptionEl);
    fields.forEach((field) => {
      const optionEl = document.createElement('option');
      optionEl.value = field.code;
      optionEl.textContent = `${field.label} (${field.code})`;
      optionEl.selected = field.code === selectedCode;
      selectEl.appendChild(optionEl);
    });
  };

  const relatedAppIdOf = (row) => {
    const fieldDef = formFields[row.referenceFieldCode];
    return fieldDef && fieldDef.referenceTable
      ? fieldDef.referenceTable.relatedApp.app
      : null;
  };

  const renderRows = () => {
    rowBodyEl.innerHTML = '';
    config.rows.forEach((row, index) => {
      const fragment = rowTemplateEl.content.cloneNode(true);
      const rowEl = fragment.querySelector('.js-row');
      const referenceFieldEl = rowEl.querySelector('.js-row-reference-field');
      const summaryTypeEl = rowEl.querySelector('.js-row-summary-type');
      const targetFieldEl = rowEl.querySelector('.js-row-target-field');
      const writeFieldEl = rowEl.querySelector('.js-row-write-field');
      const exclusionCondEl = rowEl.querySelector('.js-row-exclusion-cond');
      const removeEl = rowEl.querySelector('.js-row-remove');

      buildOptions(referenceFieldEl, referenceFields, row.referenceFieldCode);
      summaryTypeEl.value = row.summaryType || 'COUNT';
      buildOptions(writeFieldEl, numberFields, row.writeFieldCode);
      exclusionCondEl.value = row.exclusionCond || '';

      const refreshTargetFieldOptions = async () => {
        const relatedAppId = relatedAppIdOf(row);
        const candidates = await fetchRelatedAppNumberFields(relatedAppId);
        buildOptions(targetFieldEl, candidates, row.targetFieldCode);
        targetFieldEl.disabled = summaryTypeEl.value === 'COUNT';
      };
      refreshTargetFieldOptions();

      referenceFieldEl.addEventListener('change', () => {
        row.referenceFieldCode = referenceFieldEl.value;
        row.targetFieldCode = '';
        refreshTargetFieldOptions();
      });
      summaryTypeEl.addEventListener('change', () => {
        row.summaryType = summaryTypeEl.value;
        targetFieldEl.disabled = row.summaryType === 'COUNT';
      });
      targetFieldEl.addEventListener('change', () => {
        row.targetFieldCode = targetFieldEl.value;
      });
      writeFieldEl.addEventListener('change', () => {
        row.writeFieldCode = writeFieldEl.value;
      });
      exclusionCondEl.addEventListener('input', () => {
        row.exclusionCond = exclusionCondEl.value;
      });
      removeEl.addEventListener('click', () => {
        config.rows.splice(index, 1);
        renderRows();
      });

      rowBodyEl.appendChild(rowEl);
    });
  };
  renderRows();

  rowAddButtonEl.addEventListener('click', () => {
    config.rows.push({
      referenceFieldCode: '',
      summaryType: 'COUNT',
      targetFieldCode: '',
      writeFieldCode: '',
      exclusionCond: '',
    });
    renderRows();
  });

  triggerSubmitEl.checked = config.triggers.onSubmit;
  triggerDetailEl.checked = config.triggers.onDetailButton;
  triggerIndexEl.checked = config.triggers.onIndexBulk;
  bulkGroupCodesEl.value = (config.bulkGroupCodes || []).join(', ');

  cancelButtonEl.addEventListener('click', () => {
    window.location.href = '../../' + kintone.app.getId() + '/plugin/';
  });

  formEl.addEventListener('submit', (e) => {
    e.preventDefault();

    const invalidRow = config.rows.find((row) => {
      if (!row.referenceFieldCode || !row.writeFieldCode) {
        return true;
      }
      if (
        (row.summaryType === 'SUM' || row.summaryType === 'AVERAGE') &&
        !row.targetFieldCode
      ) {
        return true;
      }
      return false;
    });
    if (invalidRow) {
      alert(
        '集計設定の必須項目(関連レコード一覧フィールド・書き込み先フィールド。合計/平均の場合は集計対象フィールドも)を入力してください。',
      );
      return;
    }

    config.triggers = {
      onSubmit: triggerSubmitEl.checked,
      onDetailButton: triggerDetailEl.checked,
      onIndexBulk: triggerIndexEl.checked,
    };
    config.bulkGroupCodes = bulkGroupCodesEl.value
      .split(',')
      .map((code) => code.trim())
      .filter((code) => code.length > 0);

    kintone.plugin.app.setConfig(NS.ConfigStore.serialize(config), () => {
      alert('プラグインの設定を保存しました。アプリを更新してください。');
      window.location.href = '../../flow?app=' + kintone.app.getId();
    });
  });
})(kintone.$PLUGIN_ID);
