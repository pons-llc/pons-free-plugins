(async (PLUGIN_ID) => {
  'use strict';

  const NS = window.BulkRecordCreation;

  const formEl = document.querySelector('.js-submit-settings');
  const cancelButtonEl = document.querySelector('.js-cancel-button');
  const assigneeFieldSelectEl = document.getElementById(
    'js-assignee-field-code',
  );
  const dateFieldSelectEl = document.getElementById('js-date-field-code');
  const endDateFieldRowEl = document.getElementById('js-end-date-field-row');
  const endDateFieldSelectEl = document.getElementById(
    'js-end-date-field-code',
  );
  const templateFieldBodyEl = document.getElementById('js-template-field-body');
  const noTemplateFieldsWarningEl = document.getElementById(
    'js-no-template-fields-warning',
  );
  const groupCodesEl = document.querySelector('.js-group-codes');

  if (!(
    formEl &&
    cancelButtonEl &&
    assigneeFieldSelectEl &&
    dateFieldSelectEl &&
    endDateFieldRowEl &&
    endDateFieldSelectEl &&
    templateFieldBodyEl &&
    noTemplateFieldsWarningEl &&
    groupCodesEl
  )) {
    throw new Error('Required elements do not exist.');
  }

  const TYPE_LABELS = {
    SINGLE_LINE_TEXT: '文字列(1行)',
    MULTI_LINE_TEXT: '文字列(複数行)',
    RICH_TEXT: 'リッチエディター',
    NUMBER: '数値',
    CHECK_BOX: 'チェックボックス',
    RADIO_BUTTON: 'ラジオボタン',
    MULTI_SELECT: '複数選択',
    DROP_DOWN: 'ドロップダウン',
    DATE: '日付',
    TIME: '時刻',
    DATETIME: '日時',
    LINK: 'リンク',
    USER_SELECT: 'ユーザー選択',
    ORGANIZATION_SELECT: '組織選択',
    GROUP_SELECT: 'グループ選択',
  };

  // kintone.app.getFormFields()はREST APIレスポンスのpropertiesプロパティと同様の値
  // (フィールドコードをキーとするオブジェクト)を直接解決する。{ properties: {...} }のように
  // ラップされて返るわけではない(CLAUDE.md「既知の落とし穴」参照、確認済み)。
  const formFields = await kintone.app.getFormFields();

  const assigneeCandidates =
    NS.FieldEligibility.listAssigneeCandidateFields(formFields);
  const dateCandidates =
    NS.FieldEligibility.listRecurrenceFieldCandidates(formFields);

  const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  const appendBlankOption = (selectEl, text) => {
    const optionEl = document.createElement('option');
    optionEl.value = '';
    optionEl.textContent = text;
    selectEl.appendChild(optionEl);
  };

  const appendFieldOptions = (selectEl, fields) => {
    fields.forEach((field) => {
      const optionEl = document.createElement('option');
      optionEl.value = field.code;
      optionEl.textContent = `${field.label}(${field.code})・${TYPE_LABELS[field.type] || field.type}`;
      selectEl.appendChild(optionEl);
    });
  };

  appendBlankOption(assigneeFieldSelectEl, '(使用しない)');
  appendFieldOptions(assigneeFieldSelectEl, assigneeCandidates);
  if (assigneeCandidates.some((f) => f.code === config.assigneeFieldCode)) {
    assigneeFieldSelectEl.value = config.assigneeFieldCode;
  }

  appendBlankOption(dateFieldSelectEl, '(使用しない)');
  appendFieldOptions(dateFieldSelectEl, dateCandidates);
  if (dateCandidates.some((f) => f.code === config.dateFieldCode)) {
    dateFieldSelectEl.value = config.dateFieldCode;
  }

  // 終了日時フィールドは、繰り返し用フィールドがDATETIME型の場合のみ使う(DATE型には
  // 「時刻」の概念が無いため)。候補もDATETIME型のみ・繰り返し用フィールド自身を除いたもの。
  // idea.md「終了日時フィールド」参照。
  const renderEndDateFieldOptions = () => {
    const selectedDateField = formFields[dateFieldSelectEl.value];
    const isDatetime =
      !!selectedDateField && selectedDateField.type === 'DATETIME';
    endDateFieldRowEl.hidden = !isDatetime;
    if (!isDatetime) {
      endDateFieldSelectEl.value = '';
      return;
    }
    const previousValue = endDateFieldSelectEl.value;
    endDateFieldSelectEl.innerHTML = '';
    appendBlankOption(endDateFieldSelectEl, '(使用しない)');
    const endDateCandidates = dateCandidates.filter(
      (f) => f.type === 'DATETIME' && f.code !== dateFieldSelectEl.value,
    );
    appendFieldOptions(endDateFieldSelectEl, endDateCandidates);
    let restoreValue = '';
    if (endDateCandidates.some((f) => f.code === previousValue)) {
      restoreValue = previousValue;
    } else if (
      endDateCandidates.some((f) => f.code === config.endDateFieldCode)
    ) {
      restoreValue = config.endDateFieldCode;
    }
    endDateFieldSelectEl.value = restoreValue;
  };
  renderEndDateFieldOptions();

  // テンプレート対象フィールドのチェック状態は、繰り返し用日付フィールドの選択変更で
  // 一覧が再描画されても保持する(idea.md「テンプレート対象フィールドの絞り込み」)。
  // change イベントの発火に依存せず、再描画・保存の直前に現在のDOM上のチェック状態を
  // そのまま読み取ってこのSetへ反映する(captureCheckedFromDom)ことで、プログラムから
  // .checkedを直接書き換えた場合(E2Eテスト等)でも正しく状態を保持できるようにしている。
  const checkedTemplateCodes = new Set(config.templateFieldCodes);

  const captureCheckedFromDom = () => {
    templateFieldBodyEl
      .querySelectorAll('input[type="checkbox"]')
      .forEach((checkboxEl) => {
        const code = checkboxEl.dataset.fieldCode;
        if (checkboxEl.checked) {
          checkedTemplateCodes.add(code);
        } else {
          checkedTemplateCodes.delete(code);
        }
      });
  };

  // テンプレート対象から除くフィールドコード(繰り返し用フィールド・終了日時フィールド)。
  const currentExcludeFieldCodes = () =>
    [dateFieldSelectEl.value, endDateFieldSelectEl.value].filter(Boolean);

  const renderTemplateRows = () => {
    captureCheckedFromDom();

    const eligibleFields = NS.FieldEligibility.listEligibleFields(formFields, {
      excludeFieldCodes: currentExcludeFieldCodes(),
    });

    noTemplateFieldsWarningEl.style.display =
      eligibleFields.length === 0 ? 'block' : 'none';

    templateFieldBodyEl.innerHTML = '';
    eligibleFields.forEach((field) => {
      const rowEl = document.createElement('tr');

      const enabledCellEl = document.createElement('td');
      const enabledCheckboxEl = document.createElement('input');
      enabledCheckboxEl.type = 'checkbox';
      enabledCheckboxEl.dataset.fieldCode = field.code;
      enabledCheckboxEl.checked = checkedTemplateCodes.has(field.code);
      enabledCellEl.appendChild(enabledCheckboxEl);
      rowEl.appendChild(enabledCellEl);

      const labelCellEl = document.createElement('td');
      labelCellEl.textContent = `${field.label}(${field.code})`;
      if (field.required) {
        const requireEl = document.createElement('span');
        requireEl.className = 'kintoneplugin-require';
        requireEl.textContent = '必須';
        labelCellEl.appendChild(document.createTextNode(' '));
        labelCellEl.appendChild(requireEl);
      }
      rowEl.appendChild(labelCellEl);

      const typeCellEl = document.createElement('td');
      typeCellEl.textContent = TYPE_LABELS[field.type] || field.type;
      rowEl.appendChild(typeCellEl);

      templateFieldBodyEl.appendChild(rowEl);
    });
  };
  renderTemplateRows();
  dateFieldSelectEl.addEventListener('change', () => {
    renderEndDateFieldOptions();
    renderTemplateRows();
  });
  endDateFieldSelectEl.addEventListener('change', renderTemplateRows);

  // groupCodesElはトップレベルのconstであり、await後に再代入され得ないため
  // require-atomic-updatesは誤検知。
  // eslint-disable-next-line require-atomic-updates
  groupCodesEl.value = (config.groupCodes || []).join(', ');

  cancelButtonEl.addEventListener('click', () => {
    window.location.href = '../../' + kintone.app.getId() + '/plugin/';
  });

  formEl.addEventListener('submit', (e) => {
    e.preventDefault();
    captureCheckedFromDom();

    const eligibleCodes = new Set(
      NS.FieldEligibility.listEligibleFields(formFields, {
        excludeFieldCodes: currentExcludeFieldCodes(),
      }).map((field) => field.code),
    );
    const templateFieldCodes = [...checkedTemplateCodes].filter((code) =>
      eligibleCodes.has(code),
    );

    const nextConfig = {
      assigneeFieldCode: assigneeFieldSelectEl.value,
      dateFieldCode: dateFieldSelectEl.value,
      endDateFieldCode: endDateFieldSelectEl.value,
      templateFieldCodes,
      groupCodes: groupCodesEl.value
        .split(',')
        .map((code) => code.trim())
        .filter((code) => code.length > 0),
    };

    const { valid, errors } = NS.ConfigValidation.validateConfig(nextConfig);
    if (!valid) {
      alert(errors.join('\n'));
      return;
    }

    kintone.plugin.app.setConfig(NS.ConfigStore.serialize(nextConfig), () => {
      alert('プラグインの設定を保存しました。アプリを更新してください。');
      window.location.href = '../../flow?app=' + kintone.app.getId();
    });
  });
})(kintone.$PLUGIN_ID);
