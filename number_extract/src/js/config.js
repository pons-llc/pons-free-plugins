(async (PLUGIN_ID) => {
  'use strict';

  const NS = window.NumberExtract;

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
  const extractListEl = document.getElementById('js-extract-list');
  const extractAddButtonEl = document.getElementById('js-extract-add');
  const extractRowTemplateEl = document.getElementById(
    'js-extract-row-template',
  );
  const targetRowTemplateEl = document.getElementById('js-target-row-template');

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

  const renderExtractList = () => {
    extractListEl.innerHTML = '';
    config.extracts.forEach((extract, extractIndex) => {
      const fragment = extractRowTemplateEl.content.cloneNode(true);
      const rowEl = fragment.querySelector('.js-extract-row');
      const sourceEl = rowEl.querySelector('.js-extract-source');
      const fullwidthEl = rowEl.querySelector('.js-extract-fullwidth');
      const kanjiEl = rowEl.querySelector('.js-extract-kanji');
      const removeEl = rowEl.querySelector('.js-extract-remove');
      const targetListEl = rowEl.querySelector('.js-target-list');
      const targetAddButtonEl = rowEl.querySelector('.js-target-add');

      const renderTargetList = () => {
        targetListEl.innerHTML = '';
        extract.targetFieldCodes.forEach((targetFieldCode, targetIndex) => {
          const targetFragment = targetRowTemplateEl.content.cloneNode(true);
          const fieldEl = targetFragment.querySelector('.js-target-field');
          const removeTargetEl =
            targetFragment.querySelector('.js-target-remove');

          buildOptions(
            fieldEl,
            targetFieldCandidates,
            targetFieldCode,
            '(選択してください)',
          );

          fieldEl.addEventListener('change', () => {
            extract.targetFieldCodes[targetIndex] = fieldEl.value;
          });
          removeTargetEl.addEventListener('click', () => {
            extract.targetFieldCodes.splice(targetIndex, 1);
            renderTargetList();
          });

          targetListEl.appendChild(targetFragment);
        });
      };

      buildOptions(
        sourceEl,
        sourceFields,
        extract.sourceFieldCode,
        '(選択してください)',
      );
      fullwidthEl.checked = Boolean(extract.includeFullWidth);
      kanjiEl.checked = Boolean(extract.includeKanji);
      renderTargetList();

      sourceEl.addEventListener('change', () => {
        extract.sourceFieldCode = sourceEl.value;
      });
      fullwidthEl.addEventListener('change', () => {
        extract.includeFullWidth = fullwidthEl.checked;
      });
      kanjiEl.addEventListener('change', () => {
        extract.includeKanji = kanjiEl.checked;
      });
      removeEl.addEventListener('click', () => {
        config.extracts.splice(extractIndex, 1);
        renderExtractList();
      });
      targetAddButtonEl.addEventListener('click', () => {
        extract.targetFieldCodes.push('');
        renderTargetList();
      });

      extractListEl.appendChild(fragment);
    });
  };
  renderExtractList();

  extractAddButtonEl.addEventListener('click', () => {
    config.extracts.push({
      sourceFieldCode: '',
      includeFullWidth: false,
      includeKanji: false,
      targetFieldCodes: [],
    });
    renderExtractList();
  });

  cancelButtonEl.addEventListener('click', () => {
    window.location.href = '../../' + kintone.app.getId() + '/plugin/';
  });

  formEl.addEventListener('submit', (e) => {
    e.preventDefault();

    const validation = NS.ConfigValidation.validateExtracts(config.extracts);
    if (!validation.valid) {
      // 設定画面でアプリ管理者自身が選択した値の検証結果(フィールドコード)のみを表示しており、
      // 外部からの入力ではないが、念のためinnerHTMLではなくtextContentで出力する。
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
