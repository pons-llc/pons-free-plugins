(async (PLUGIN_ID) => {
  'use strict';

  const NS = window.WarekiDateFormat;

  const formEl = document.querySelector('.js-submit-settings');
  const cancelButtonEl = document.querySelector('.js-cancel-button');
  const errorsEl = document.getElementById('js-errors');
  const pairListEl = document.getElementById('js-pair-list');
  const pairAddButtonEl = document.getElementById('js-pair-add');
  const pairRowTemplateEl = document.getElementById('js-pair-row-template');
  const eraListEl = document.getElementById('js-era-list');
  const eraAddButtonEl = document.getElementById('js-era-add');
  const eraRowTemplateEl = document.getElementById('js-era-row-template');

  // kintone.app.getFormFields() は REST APIのレスポンスではなく、
  // その `properties` プロパティと同様の値(フィールドコードをキーにした平坦なオブジェクト)を解決する。
  const formFields = await kintone.app.getFormFields();
  const sourceFields = Object.values(formFields).filter((f) =>
    NS.Wareki.SUPPORTED_SOURCE_FIELD_TYPES.includes(f.type),
  );
  const targetFields = Object.values(formFields).filter(
    (f) => f.type === 'SINGLE_LINE_TEXT',
  );

  const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  // プレビュー表示用の固定サンプル日付(実データではなく画面上の書式イメージを示すためだけに使う)。
  const PREVIEW_SAMPLE = { type: 'DATE', value: '2024-07-09' };

  const buildOptions = (selectEl, fields, selectedCode) => {
    selectEl.innerHTML = '';
    const blankOptionEl = document.createElement('option');
    blankOptionEl.value = '';
    blankOptionEl.textContent = '(選択してください)';
    selectEl.appendChild(blankOptionEl);
    fields.forEach((field) => {
      const optionEl = document.createElement('option');
      optionEl.value = field.code;
      // ラベルはユーザーが設定したフィールド名だが、innerHTMLではなくtextContentへの代入と
      // 同等のDOM API(createElement + textContent)で組み立てているためXSSのおそれはない。
      optionEl.textContent = `${field.label} (${field.code})`;
      optionEl.selected = field.code === selectedCode;
      selectEl.appendChild(optionEl);
    });
  };

  const updatePreview = (previewEl, pair) => {
    previewEl.textContent = NS.Wareki.format(
      PREVIEW_SAMPLE.type,
      PREVIEW_SAMPLE.value,
      {
        preset: pair.preset,
        zenkaku: pair.zenkaku,
        eraTable: config.eras,
      },
    );
  };

  const renderPairList = () => {
    pairListEl.innerHTML = '';
    config.pairs.forEach((pair, index) => {
      const fragment = pairRowTemplateEl.content.cloneNode(true);
      const sourceEl = fragment.querySelector('.js-pair-source');
      const targetEl = fragment.querySelector('.js-pair-target');
      const presetEl = fragment.querySelector('.js-pair-preset');
      const zenkakuEl = fragment.querySelector('.js-pair-zenkaku');
      const previewEl = fragment.querySelector('.js-pair-preview');
      const removeEl = fragment.querySelector('.js-pair-remove');

      buildOptions(sourceEl, sourceFields, pair.sourceFieldCode);
      buildOptions(targetEl, targetFields, pair.targetFieldCode);
      presetEl.value = pair.preset;
      zenkakuEl.checked = Boolean(pair.zenkaku);
      updatePreview(previewEl, pair);

      sourceEl.addEventListener('change', () => {
        config.pairs[index].sourceFieldCode = sourceEl.value;
      });
      targetEl.addEventListener('change', () => {
        config.pairs[index].targetFieldCode = targetEl.value;
      });
      presetEl.addEventListener('change', () => {
        config.pairs[index].preset = presetEl.value;
        updatePreview(previewEl, config.pairs[index]);
      });
      zenkakuEl.addEventListener('change', () => {
        config.pairs[index].zenkaku = zenkakuEl.checked;
        updatePreview(previewEl, config.pairs[index]);
      });
      removeEl.addEventListener('click', () => {
        config.pairs.splice(index, 1);
        renderPairList();
      });

      pairListEl.appendChild(fragment);
    });
  };
  renderPairList();

  pairAddButtonEl.addEventListener('click', () => {
    config.pairs.push({
      sourceFieldCode: '',
      targetFieldCode: '',
      preset: NS.Wareki.PRESETS.WAREKI_ONLY,
      zenkaku: false,
    });
    renderPairList();
  });

  const renderEraList = () => {
    eraListEl.innerHTML = '';
    config.eras.forEach((era, index) => {
      const fragment = eraRowTemplateEl.content.cloneNode(true);
      const nameEl = fragment.querySelector('.js-era-name');
      const startDateEl = fragment.querySelector('.js-era-start-date');
      const removeEl = fragment.querySelector('.js-era-remove');

      nameEl.value = era.name || '';
      startDateEl.value = era.startDate || '';

      nameEl.addEventListener('input', () => {
        config.eras[index].name = nameEl.value;
      });
      startDateEl.addEventListener('change', () => {
        config.eras[index].startDate = startDateEl.value;
        // 改元日を変えると各ペアのプレビュー結果が変わりうるため再計算する。
        renderPairList();
      });
      removeEl.addEventListener('click', () => {
        config.eras.splice(index, 1);
        renderEraList();
        renderPairList();
      });

      eraListEl.appendChild(fragment);
    });
  };
  renderEraList();

  eraAddButtonEl.addEventListener('click', () => {
    config.eras.push({ name: '', startDate: '' });
    renderEraList();
  });

  cancelButtonEl.addEventListener('click', () => {
    window.location.href = '../../' + kintone.app.getId() + '/plugin/';
  });

  formEl.addEventListener('submit', (e) => {
    e.preventDefault();

    const pairValidation = NS.ConfigValidation.validatePairs(config.pairs);
    const eraValidation = NS.ConfigValidation.validateEras(config.eras);
    const errors = [...pairValidation.errors, ...eraValidation.errors];
    if (errors.length > 0) {
      // ユーザー自身が設定画面で入力した値の検証結果(フィールドコード・プリセット名・元号名・改元日)のみを
      // 表示しており、外部からの入力ではないが、念のためinnerHTMLではなくtextContentで出力する。
      errorsEl.textContent = errors.join('\n');
      return;
    }
    errorsEl.textContent = '';

    kintone.plugin.app.setConfig(NS.ConfigStore.serialize(config), () => {
      alert('プラグインの設定を保存しました。アプリを更新してください。');
      window.location.href = '../../flow?app=' + kintone.app.getId();
    });
  });
})(kintone.$PLUGIN_ID);
