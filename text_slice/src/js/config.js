(async (PLUGIN_ID) => {
  'use strict';

  const NS = window.TextSlice;

  const SOURCE_FIELD_TYPES = ['SINGLE_LINE_TEXT', 'MULTI_LINE_TEXT'];
  // レイアウト専用・値を持たないフィールドタイプは出力先の対象から除外する。
  const NON_VALUE_FIELD_TYPES = [
    'SUBTABLE',
    'REFERENCE_TABLE',
    'GROUP',
    'SPACER',
    'LABEL',
    'HR',
    'CATEGORY',
    'STATUS',
  ];

  const formEl = document.querySelector('.js-submit-settings');
  const cancelButtonEl = document.querySelector('.js-cancel-button');
  const errorsEl = document.getElementById('js-errors');
  const sliceListEl = document.getElementById('js-slice-list');
  const sliceAddButtonEl = document.getElementById('js-slice-add');
  const sliceRowTemplateEl = document.getElementById('js-slice-row-template');

  // kintone.app.getFormFields() は REST APIレスポンスの properties と同様の値
  // (フィールドコードをキーにした平坦なオブジェクト)を解決する。
  const formFields = await kintone.app.getFormFields();
  const sourceFields = Object.values(formFields).filter((f) =>
    SOURCE_FIELD_TYPES.includes(f.type),
  );
  const targetFieldCandidates = Object.values(formFields).filter(
    (f) => !NON_VALUE_FIELD_TYPES.includes(f.type),
  );

  const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  const buildOptions = (selectEl, items, selectedCode, placeholder) => {
    selectEl.innerHTML = '';
    if (placeholder) {
      const placeholderOptionEl = document.createElement('option');
      placeholderOptionEl.value = '';
      placeholderOptionEl.textContent = placeholder;
      selectEl.appendChild(placeholderOptionEl);
    }
    items.forEach((item) => {
      const optionEl = document.createElement('option');
      optionEl.value = item.code;
      optionEl.textContent = `${item.label} (${item.code})`;
      optionEl.selected = item.code === selectedCode;
      selectEl.appendChild(optionEl);
    });
  };

  const renderSliceList = () => {
    sliceListEl.innerHTML = '';
    config.slices.forEach((slice, sliceIndex) => {
      const fragment = sliceRowTemplateEl.content.cloneNode(true);
      const rowEl = fragment.querySelector('.js-slice-row');
      const sourceEl = rowEl.querySelector('.js-slice-source');
      const funcEl = rowEl.querySelector('.js-slice-func');
      const startRowEl = rowEl.querySelector('.js-slice-start-row');
      const startEl = rowEl.querySelector('.js-slice-start');
      const lengthEl = rowEl.querySelector('.js-slice-length');
      const targetEl = rowEl.querySelector('.js-slice-target');
      const removeEl = rowEl.querySelector('.js-slice-remove');

      const applyFuncVisibility = () => {
        startRowEl.style.display = slice.func === 'MID' ? '' : 'none';
      };

      buildOptions(
        sourceEl,
        sourceFields,
        slice.sourceFieldCode,
        '(選択してください)',
      );
      funcEl.value = slice.func;
      startEl.value = slice.start || '';
      lengthEl.value = slice.length || '';
      buildOptions(
        targetEl,
        targetFieldCandidates,
        slice.targetFieldCode,
        '(選択してください)',
      );
      applyFuncVisibility();

      sourceEl.addEventListener('change', () => {
        slice.sourceFieldCode = sourceEl.value;
      });
      funcEl.addEventListener('change', () => {
        slice.func = funcEl.value;
        applyFuncVisibility();
      });
      startEl.addEventListener('input', () => {
        slice.start = parseInt(startEl.value, 10);
      });
      lengthEl.addEventListener('input', () => {
        slice.length = parseInt(lengthEl.value, 10);
      });
      targetEl.addEventListener('change', () => {
        slice.targetFieldCode = targetEl.value;
      });
      removeEl.addEventListener('click', () => {
        config.slices.splice(sliceIndex, 1);
        renderSliceList();
      });

      sliceListEl.appendChild(fragment);
    });
  };
  renderSliceList();

  sliceAddButtonEl.addEventListener('click', () => {
    config.slices.push({
      sourceFieldCode: '',
      func: 'LEFT',
      start: 1,
      length: 1,
      targetFieldCode: '',
    });
    renderSliceList();
  });

  cancelButtonEl.addEventListener('click', () => {
    window.location.href = '../../' + kintone.app.getId() + '/plugin/';
  });

  formEl.addEventListener('submit', (e) => {
    e.preventDefault();

    const validation = NS.ConfigValidation.validateSlices(config.slices);
    if (!validation.valid) {
      // 設定画面でアプリ管理者自身が選択・入力した値の検証結果(フィールドコードや数値)のみを
      // 表示しており、外部からの入力ではないが、念のためinnerHTMLではなくtextContentで出力する。
      errorsEl.textContent = validation.errors.join('\n');
      return;
    }
    errorsEl.textContent = '';

    kintone.plugin.app.setConfig(NS.ConfigStore.serialize(config), () => {
      alert('プラグインの設定を保存しました。アプリを更新してください。');
      window.location.href = '../../flow?app=' + kintone.app.getId();
    });
  });
})(kintone.$PLUGIN_ID);
