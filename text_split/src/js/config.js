(async (PLUGIN_ID) => {
  'use strict';

  const NS = window.TextSplit;

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
  const splitListEl = document.getElementById('js-split-list');
  const splitAddButtonEl = document.getElementById('js-split-add');
  const splitRowTemplateEl = document.getElementById('js-split-row-template');
  const delimiterRowTemplateEl = document.getElementById(
    'js-delimiter-row-template',
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

  const renderSplitList = () => {
    splitListEl.innerHTML = '';
    config.splits.forEach((split, splitIndex) => {
      const fragment = splitRowTemplateEl.content.cloneNode(true);
      const rowEl = fragment.querySelector('.js-split-row');
      const sourceEl = rowEl.querySelector('.js-split-source');
      const modeEl = rowEl.querySelector('.js-split-mode');
      const delimitersRowEl = rowEl.querySelector('.js-delimiters-row');
      const delimiterListEl = rowEl.querySelector('.js-delimiter-list');
      const delimiterAddButtonEl = rowEl.querySelector('.js-delimiter-add');
      const patternRowEl = rowEl.querySelector('.js-pattern-row');
      const patternEl = rowEl.querySelector('.js-split-pattern');
      const removeEl = rowEl.querySelector('.js-split-remove');
      const targetListEl = rowEl.querySelector('.js-target-list');
      const targetAddButtonEl = rowEl.querySelector('.js-target-add');

      const applyModeVisibility = () => {
        delimitersRowEl.style.display =
          split.delimiterMode === 'CHARACTERS' ? '' : 'none';
        patternRowEl.style.display =
          split.delimiterMode === 'REGEX' ? '' : 'none';
      };

      const renderDelimiterList = () => {
        delimiterListEl.innerHTML = '';
        split.delimiters.forEach((delimiter, delimiterIndex) => {
          const delimiterFragment =
            delimiterRowTemplateEl.content.cloneNode(true);
          const valueEl = delimiterFragment.querySelector(
            '.js-delimiter-value',
          );
          const removeDelimiterEl = delimiterFragment.querySelector(
            '.js-delimiter-remove',
          );

          valueEl.value = delimiter;
          valueEl.addEventListener('input', () => {
            split.delimiters[delimiterIndex] = valueEl.value;
          });
          removeDelimiterEl.addEventListener('click', () => {
            split.delimiters.splice(delimiterIndex, 1);
            renderDelimiterList();
          });

          delimiterListEl.appendChild(delimiterFragment);
        });
      };

      const renderTargetList = () => {
        targetListEl.innerHTML = '';
        split.targetFieldCodes.forEach((targetFieldCode, targetIndex) => {
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
            split.targetFieldCodes[targetIndex] = fieldEl.value;
          });
          removeTargetEl.addEventListener('click', () => {
            split.targetFieldCodes.splice(targetIndex, 1);
            renderTargetList();
          });

          targetListEl.appendChild(targetFragment);
        });
      };

      buildOptions(
        sourceEl,
        sourceFields,
        split.sourceFieldCode,
        '(選択してください)',
      );
      modeEl.value = split.delimiterMode;
      patternEl.value = split.pattern || '';
      applyModeVisibility();
      renderDelimiterList();
      renderTargetList();

      sourceEl.addEventListener('change', () => {
        split.sourceFieldCode = sourceEl.value;
      });
      modeEl.addEventListener('change', () => {
        split.delimiterMode = modeEl.value;
        applyModeVisibility();
      });
      patternEl.addEventListener('input', () => {
        split.pattern = patternEl.value;
      });
      removeEl.addEventListener('click', () => {
        config.splits.splice(splitIndex, 1);
        renderSplitList();
      });
      delimiterAddButtonEl.addEventListener('click', () => {
        split.delimiters.push('');
        renderDelimiterList();
      });
      targetAddButtonEl.addEventListener('click', () => {
        split.targetFieldCodes.push('');
        renderTargetList();
      });

      splitListEl.appendChild(fragment);
    });
  };
  renderSplitList();

  splitAddButtonEl.addEventListener('click', () => {
    config.splits.push({
      sourceFieldCode: '',
      delimiterMode: 'CHARACTERS',
      delimiters: [],
      pattern: '',
      targetFieldCodes: [],
    });
    renderSplitList();
  });

  cancelButtonEl.addEventListener('click', () => {
    window.location.href = '../../' + kintone.app.getId() + '/plugin/';
  });

  formEl.addEventListener('submit', (e) => {
    e.preventDefault();

    const validation = NS.ConfigValidation.validateSplits(config.splits);
    if (!validation.valid) {
      // 設定画面でアプリ管理者自身が選択・入力した値の検証結果(フィールドコードや正規表現)のみを
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
