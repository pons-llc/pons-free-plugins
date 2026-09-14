(async (PLUGIN_ID) => {
  'use strict';

  const NS = window.ProcessActionAutofill;

  const CATEGORY_BLOCK_SELECTOR = {
    TEXT: '.js-source-text',
    NUMBER: '.js-source-number',
    CHOICE: '.js-source-choice',
    MULTI_CHOICE: '.js-source-multi-choice',
    DATE_TIME: '.js-source-date',
    USER: '.js-source-user',
    ORGANIZATION: '.js-source-organization',
    GROUP: '.js-source-group',
  };

  const formEl = document.querySelector('.js-submit-settings');
  const cancelButtonEl = document.querySelector('.js-cancel-button');
  const errorsEl = document.getElementById('js-errors');
  const processWarningEl = document.getElementById('js-process-warning');
  const ruleListEl = document.getElementById('js-rule-list');
  const ruleAddButtonEl = document.getElementById('js-rule-add');
  const ruleRowTemplateEl = document.getElementById('js-rule-row-template');

  // kintone.app.getFormFields() は REST APIレスポンスの properties と同様の値
  // (フィールドコードをキーにした平坦なオブジェクト)を解決する(CLAUDE.mdの既知の落とし穴、
  // {properties: {...}}のようにラップされない。auto_lookup/date_offset_autofillと同じ確認方法)。
  const formFields = await kintone.app.getFormFields();

  // kintone.app.getStatus()はプラグイン設定画面では利用できない(利用可能画面がレコード一覧/
  // 追加/編集/詳細/グラフ画面のみとkintoneドキュメントMCPで確認済み)。設定画面はアプリ公開前の
  // 下書き(preview)を操作しているため、REST APIでプレビューのプロセス管理設定を取得する
  // (CLAUDE.md開発方針3「JS APIで実現できない場合のみkintone.api()」に該当)。
  const processSettings = await kintone.api(
    kintone.api.url('/k/v1/preview/app/status.json', true),
    'GET',
    { app: kintone.app.getId() },
  );
  // プロセス管理を一度も設定していないアプリでは states/actions が null で返る
  // (kintoneドキュメントMCP「プロセス管理の設定を取得する」で確認済み)。
  const actionNames = Array.from(
    new Set((processSettings.actions || []).map((a) => a.name)),
  );
  const statusNames = Object.keys(processSettings.states || {});
  processWarningEl.hidden = !!(
    processSettings.states && processSettings.actions
  );

  const eligibleFields = NS.FieldEligibility.listEligibleFields(formFields);

  const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  const buildSelectOptions = (selectEl, items, selectedValue, placeholder) => {
    selectEl.innerHTML = '';
    if (placeholder !== undefined) {
      const placeholderOptionEl = document.createElement('option');
      placeholderOptionEl.value = '';
      placeholderOptionEl.textContent = placeholder;
      selectEl.appendChild(placeholderOptionEl);
    }
    items.forEach((item) => {
      const optionEl = document.createElement('option');
      optionEl.value = item.value;
      optionEl.textContent = item.label;
      optionEl.selected = item.value === selectedValue;
      selectEl.appendChild(optionEl);
    });
  };

  const optionLabelsOf = (fieldInfo) => {
    if (!fieldInfo || !fieldInfo.options) {
      return [];
    }
    return Object.keys(fieldInfo.options).sort(
      (a, b) =>
        Number(fieldInfo.options[a].index) - Number(fieldInfo.options[b].index),
    );
  };

  const defaultSourceFor = (category) => {
    switch (category) {
      case 'TEXT':
      case 'NUMBER':
        return { type: 'FIXED', value: '', fieldCode: '' };
      case 'CHOICE':
        return { type: 'FIXED', value: '' };
      case 'MULTI_CHOICE':
        return { type: 'FIXED', values: [] };
      case 'DATE_TIME':
        return { type: 'NOW_OFFSET', unit: 'DAYS', magnitude: 0 };
      case 'USER':
        return { type: 'ACTOR' };
      case 'ORGANIZATION':
        return { type: 'FIXED_CODE', value: '' };
      case 'GROUP':
        return { type: 'FIXED_CODE', value: '' };
      default:
        return {};
    }
  };

  const renderRuleList = () => {
    ruleListEl.innerHTML = '';
    config.rules.forEach((rule, ruleIndex) => {
      const fragment = ruleRowTemplateEl.content.cloneNode(true);
      const rowEl = fragment.querySelector('.js-rule-row');

      const filterActionEl = rowEl.querySelector('.js-filter-action');
      const filterFromEl = rowEl.querySelector('.js-filter-from');
      const filterToEl = rowEl.querySelector('.js-filter-to');
      const targetEl = rowEl.querySelector('.js-target');
      const opSetEl = rowEl.querySelector('.js-op-set');
      const opClearEl = rowEl.querySelector('.js-op-clear');
      const setRowEl = rowEl.querySelector('.js-set-row');
      const clearRowEl = rowEl.querySelector('.js-clear-row');
      const clearRadioCautionEl = rowEl.querySelector(
        '.js-clear-radio-caution',
      );
      const removeEl = rowEl.querySelector('.js-rule-remove');

      const sourceTextFixedEl = rowEl.querySelector('.js-source-text-fixed');
      const sourceTextCopyEl = rowEl.querySelector('.js-source-text-copy');
      const sourceTextFixedRowEl = rowEl.querySelector(
        '.js-source-text-fixed-row',
      );
      const sourceTextFixedValueEl = rowEl.querySelector(
        '.js-source-text-fixed-value',
      );
      const sourceTextCopyRowEl = rowEl.querySelector(
        '.js-source-text-copy-row',
      );
      const sourceTextCopyFieldEl = rowEl.querySelector(
        '.js-source-text-copy-field',
      );

      const sourceNumberFixedEl = rowEl.querySelector(
        '.js-source-number-fixed',
      );
      const sourceNumberCopyEl = rowEl.querySelector('.js-source-number-copy');
      const sourceNumberFixedRowEl = rowEl.querySelector(
        '.js-source-number-fixed-row',
      );
      const sourceNumberFixedValueEl = rowEl.querySelector(
        '.js-source-number-fixed-value',
      );
      const sourceNumberCopyRowEl = rowEl.querySelector(
        '.js-source-number-copy-row',
      );
      const sourceNumberCopyFieldEl = rowEl.querySelector(
        '.js-source-number-copy-field',
      );

      const sourceChoiceValueEl = rowEl.querySelector(
        '.js-source-choice-value',
      );
      const sourceMultiChoiceOptionsEl = rowEl.querySelector(
        '.js-source-multi-choice-options',
      );

      const sourceDateUnitEl = rowEl.querySelector('.js-source-date-unit');
      const sourceDateMagnitudeEl = rowEl.querySelector(
        '.js-source-date-magnitude',
      );

      const sourceOrgFixedEl = rowEl.querySelector('.js-source-org-fixed');
      const sourceOrgActorEl = rowEl.querySelector('.js-source-org-actor');
      const sourceOrgFixedRowEl = rowEl.querySelector(
        '.js-source-org-fixed-row',
      );
      const sourceOrgCodeEl = rowEl.querySelector('.js-source-org-code');

      const sourceGroupCodeEl = rowEl.querySelector('.js-source-group-code');

      const currentCategory = () =>
        NS.FieldEligibility.categoryOf(
          formFields[rule.targetFieldCode] &&
            formFields[rule.targetFieldCode].type,
        );

      const applyOperationVisibility = () => {
        setRowEl.hidden = rule.operation !== 'SET';
        clearRowEl.hidden = rule.operation !== 'CLEAR';
        const targetField = formFields[rule.targetFieldCode];
        clearRadioCautionEl.hidden = !(
          rule.operation === 'CLEAR' &&
          targetField &&
          targetField.type === 'RADIO_BUTTON'
        );
      };

      const applySourceBlockVisibility = () => {
        const category = currentCategory();
        Object.entries(CATEGORY_BLOCK_SELECTOR).forEach(([cat, selector]) => {
          rowEl.querySelector(selector).hidden = cat !== category;
        });
      };

      const renderTextSourceControls = () => {
        const isFixed = rule.source.type === 'FIXED';
        sourceTextFixedEl.checked = isFixed;
        sourceTextCopyEl.checked = !isFixed;
        sourceTextFixedRowEl.hidden = !isFixed;
        sourceTextCopyRowEl.hidden = isFixed;
        sourceTextFixedValueEl.value = rule.source.value || '';
        buildSelectOptions(
          sourceTextCopyFieldEl,
          NS.FieldEligibility.listCopySourceCandidates(formFields, 'TEXT').map(
            (f) => ({
              value: f.code,
              label: `${f.label} (${f.code})`,
            }),
          ),
          rule.source.fieldCode,
          '(選択してください)',
        );
      };

      const renderNumberSourceControls = () => {
        const isFixed = rule.source.type === 'FIXED';
        sourceNumberFixedEl.checked = isFixed;
        sourceNumberCopyEl.checked = !isFixed;
        sourceNumberFixedRowEl.hidden = !isFixed;
        sourceNumberCopyRowEl.hidden = isFixed;
        sourceNumberFixedValueEl.value = rule.source.value || '';
        buildSelectOptions(
          sourceNumberCopyFieldEl,
          NS.FieldEligibility.listCopySourceCandidates(
            formFields,
            'NUMBER',
          ).map((f) => ({
            value: f.code,
            label: `${f.label} (${f.code})`,
          })),
          rule.source.fieldCode,
          '(選択してください)',
        );
      };

      const renderChoiceSourceControls = () => {
        const targetField = formFields[rule.targetFieldCode];
        buildSelectOptions(
          sourceChoiceValueEl,
          optionLabelsOf(targetField).map((label) => ({ value: label, label })),
          rule.source.value,
          '(選択してください)',
        );
      };

      const renderMultiChoiceSourceControls = () => {
        const targetField = formFields[rule.targetFieldCode];
        sourceMultiChoiceOptionsEl.innerHTML = '';
        optionLabelsOf(targetField).forEach((label) => {
          const wrapperEl = document.createElement('label');
          wrapperEl.className = 'paf-checkbox-label';
          const checkboxEl = document.createElement('input');
          checkboxEl.type = 'checkbox';
          checkboxEl.value = label;
          checkboxEl.checked = (rule.source.values || []).includes(label);
          checkboxEl.addEventListener('change', () => {
            const values = new Set(rule.source.values || []);
            if (checkboxEl.checked) {
              values.add(label);
            } else {
              values.delete(label);
            }
            rule.source.values = Array.from(values);
          });
          wrapperEl.appendChild(checkboxEl);
          wrapperEl.appendChild(document.createTextNode(label));
          sourceMultiChoiceOptionsEl.appendChild(wrapperEl);
        });
      };

      const renderDateSourceControls = () => {
        sourceDateUnitEl.value = rule.source.unit || 'DAYS';
        sourceDateMagnitudeEl.value =
          rule.source.magnitude === null || rule.source.magnitude === undefined
            ? ''
            : rule.source.magnitude;
      };

      const renderOrganizationSourceControls = () => {
        const isFixed = rule.source.type === 'FIXED_CODE';
        sourceOrgFixedEl.checked = isFixed;
        sourceOrgActorEl.checked = !isFixed;
        sourceOrgFixedRowEl.hidden = !isFixed;
        sourceOrgCodeEl.value = rule.source.value || '';
      };

      const renderGroupSourceControls = () => {
        sourceGroupCodeEl.value = rule.source.value || '';
      };

      const renderSourceControls = () => {
        const category = currentCategory();
        if (category === 'TEXT') renderTextSourceControls();
        else if (category === 'NUMBER') renderNumberSourceControls();
        else if (category === 'CHOICE') renderChoiceSourceControls();
        else if (category === 'MULTI_CHOICE') renderMultiChoiceSourceControls();
        else if (category === 'DATE_TIME') renderDateSourceControls();
        else if (category === 'ORGANIZATION')
          renderOrganizationSourceControls();
        else if (category === 'GROUP') renderGroupSourceControls();
      };

      const refreshForTargetChange = () => {
        rule.source = defaultSourceFor(currentCategory());
        applyOperationVisibility();
        applySourceBlockVisibility();
        renderSourceControls();
      };

      // --- 初期描画 ---
      buildSelectOptions(
        filterActionEl,
        actionNames.map((n) => ({ value: n, label: n })),
        rule.filter.actionName,
        '(いずれでも)',
      );
      buildSelectOptions(
        filterFromEl,
        statusNames.map((n) => ({ value: n, label: n })),
        rule.filter.fromStatus,
        '(いずれでも)',
      );
      buildSelectOptions(
        filterToEl,
        statusNames.map((n) => ({ value: n, label: n })),
        rule.filter.toStatus,
        '(いずれでも)',
      );
      buildSelectOptions(
        targetEl,
        eligibleFields.map((f) => ({
          value: f.code,
          label: `${f.label} (${f.code})`,
        })),
        rule.targetFieldCode,
        '(選択してください)',
      );
      opSetEl.checked = rule.operation === 'SET';
      opClearEl.checked = rule.operation === 'CLEAR';
      applyOperationVisibility();
      applySourceBlockVisibility();
      renderSourceControls();

      // --- イベント配線 ---
      filterActionEl.addEventListener('change', () => {
        rule.filter.actionName = filterActionEl.value;
      });
      filterFromEl.addEventListener('change', () => {
        rule.filter.fromStatus = filterFromEl.value;
      });
      filterToEl.addEventListener('change', () => {
        rule.filter.toStatus = filterToEl.value;
      });
      targetEl.addEventListener('change', () => {
        rule.targetFieldCode = targetEl.value;
        refreshForTargetChange();
      });
      opSetEl.addEventListener('change', () => {
        if (opSetEl.checked) {
          rule.operation = 'SET';
          applyOperationVisibility();
        }
      });
      opClearEl.addEventListener('change', () => {
        if (opClearEl.checked) {
          rule.operation = 'CLEAR';
          applyOperationVisibility();
        }
      });

      sourceTextFixedEl.addEventListener('change', () => {
        rule.source = { type: 'FIXED', value: '', fieldCode: '' };
        renderTextSourceControls();
      });
      sourceTextCopyEl.addEventListener('change', () => {
        rule.source = { type: 'COPY_FIELD', value: '', fieldCode: '' };
        renderTextSourceControls();
      });
      sourceTextFixedValueEl.addEventListener('input', () => {
        rule.source.value = sourceTextFixedValueEl.value;
      });
      sourceTextCopyFieldEl.addEventListener('change', () => {
        rule.source.fieldCode = sourceTextCopyFieldEl.value;
      });

      sourceNumberFixedEl.addEventListener('change', () => {
        rule.source = { type: 'FIXED', value: '', fieldCode: '' };
        renderNumberSourceControls();
      });
      sourceNumberCopyEl.addEventListener('change', () => {
        rule.source = { type: 'COPY_FIELD', value: '', fieldCode: '' };
        renderNumberSourceControls();
      });
      sourceNumberFixedValueEl.addEventListener('input', () => {
        rule.source.value = sourceNumberFixedValueEl.value;
      });
      sourceNumberCopyFieldEl.addEventListener('change', () => {
        rule.source.fieldCode = sourceNumberCopyFieldEl.value;
      });

      sourceChoiceValueEl.addEventListener('change', () => {
        rule.source.value = sourceChoiceValueEl.value;
      });

      sourceDateUnitEl.addEventListener('change', () => {
        rule.source.unit = sourceDateUnitEl.value;
      });
      sourceDateMagnitudeEl.addEventListener('input', () => {
        rule.source.magnitude =
          sourceDateMagnitudeEl.value === ''
            ? null
            : parseFloat(sourceDateMagnitudeEl.value);
      });

      sourceOrgFixedEl.addEventListener('change', () => {
        rule.source = { type: 'FIXED_CODE', value: '' };
        renderOrganizationSourceControls();
      });
      sourceOrgActorEl.addEventListener('change', () => {
        rule.source = { type: 'ACTOR_PRIMARY_ORG' };
        renderOrganizationSourceControls();
      });
      sourceOrgCodeEl.addEventListener('input', () => {
        rule.source.value = sourceOrgCodeEl.value;
      });

      sourceGroupCodeEl.addEventListener('input', () => {
        rule.source.value = sourceGroupCodeEl.value;
      });

      removeEl.addEventListener('click', () => {
        config.rules.splice(ruleIndex, 1);
        renderRuleList();
      });

      ruleListEl.appendChild(fragment);
    });
  };
  renderRuleList();

  ruleAddButtonEl.addEventListener('click', () => {
    config.rules.push({
      filter: { actionName: '', fromStatus: '', toStatus: '' },
      targetFieldCode: '',
      operation: 'SET',
      source: {},
    });
    renderRuleList();
  });

  cancelButtonEl.addEventListener('click', () => {
    window.location.href = '../../' + kintone.app.getId() + '/plugin/';
  });

  formEl.addEventListener('submit', (e) => {
    e.preventDefault();

    const validation = NS.ConfigValidation.validateRules(
      config.rules,
      formFields,
    );
    if (!validation.valid) {
      // 設定画面でアプリ管理者自身が選択・入力した値の検証結果(フィールドコードや選択肢名)の
      // みを表示しており、外部からの入力ではないが、念のためinnerHTMLではなくtextContentで出力する。
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
