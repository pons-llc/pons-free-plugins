(function (root) {
  'use strict';

  // 仮想フォームのDOM描画。依頼アプリのプレビューと回答アプリの回答フォームで共用する。
  // 純粋ロジック(バリデーション・条件判定・日時変換)はlib/form-model.jsに分離済み。

  const NS = root.ResearchAnswer;
  const FormModel = NS.FormModel;

  const inputId = (fieldCode) => `pons-${fieldCode}`;

  // DOMから現在の入力値を取得する(チェックボックスは配列で返す)
  const getValueFromDOM = (fieldCode, type) => {
    const id = inputId(fieldCode);
    if (type === 'ラジオボタン') {
      const checked = document.querySelector(
        `input[name="${CSS.escape(id)}"]:checked`,
      );
      return checked ? checked.value : '';
    }
    if (type === 'チェックボックス') {
      const boxes = document.querySelectorAll(
        `input[id^="${CSS.escape(id)}-"]:checked`,
      );
      return Array.from(boxes).map((b) => b.dataset.display);
    }
    const elm = document.getElementById(id);
    return elm ? elm.value : '';
  };

  // 動的必須条件を評価して *マークとdata属性をDOMに反映する
  const applyDynamicLogic = (spaceField, conditions, layoutRows) => {
    const states = FormModel.computeRequiredStates(
      layoutRows,
      conditions,
      getValueFromDOM,
    );
    Object.keys(states).forEach((fieldCode) => {
      const targetRow = spaceField.querySelector(
        `.kintoneplugin-row[data-field-code="${CSS.escape(fieldCode)}"]`,
      );
      if (!targetRow) {
        return;
      }
      const label = targetRow.querySelector('.kintoneplugin-label');
      const existing = label.querySelector('.ra-dynamic-require');
      if (existing) {
        existing.remove();
      }
      if (states[fieldCode]) {
        targetRow.dataset.dynamicMandatory = 'true';
        const span = document.createElement('span');
        span.classList.add('ra-dynamic-require');
        span.textContent = ' *';
        label.appendChild(span);
      } else {
        targetRow.dataset.dynamicMandatory = 'false';
      }
    });
  };

  // 1項目分の入力行を作る(ラベル・詳細説明・入力要素・エラー表示欄)。
  // ラベル・選択肢等はすべてtextContent経由で挿入する(XSS対策、innerHTML不使用)。
  const makeInputElement = (settings) => {
    const {
      type,
      label,
      desc,
      id,
      value,
      options,
      mandatory,
      isDisabled,
      fieldCode,
    } = settings;

    const rowDiv = document.createElement('div');
    rowDiv.classList.add('kintoneplugin-row', 'ra-form-row');
    rowDiv.dataset.fieldCode = fieldCode;

    const labelElement = document.createElement('div');
    labelElement.classList.add('kintoneplugin-label');
    labelElement.textContent = label;
    if (mandatory === '必須') {
      const requireSpan = document.createElement('span');
      requireSpan.classList.add('ra-static-require');
      requireSpan.textContent = ' *';
      labelElement.appendChild(requireSpan);
    }
    rowDiv.appendChild(labelElement);

    if (desc) {
      const details = document.createElement('details');
      details.classList.add('ra-form-desc');
      const summary = document.createElement('summary');
      summary.textContent = '詳細説明を表示';
      const descElement = document.createElement('div');
      descElement.classList.add('kintoneplugin-desc', 'ra-form-desc-body');
      descElement.textContent = desc;
      details.appendChild(summary);
      details.appendChild(descElement);
      rowDiv.appendChild(details);
    }

    let inputElm;
    switch (type) {
      case '文字列':
      case '数値': {
        const outer = document.createElement('div');
        outer.classList.add('kintoneplugin-input-outer');
        inputElm = document.createElement('input');
        inputElm.classList.add('kintoneplugin-input-text');
        inputElm.id = id;
        inputElm.type = type === '数値' ? 'number' : 'text';
        inputElm.value = value || '';
        inputElm.disabled = isDisabled;
        outer.appendChild(inputElm);
        rowDiv.appendChild(outer);
        break;
      }
      case '日時':
      case '日付':
      case '時刻': {
        const outer = document.createElement('div');
        outer.classList.add('kintoneplugin-input-outer');
        inputElm = document.createElement('input');
        inputElm.classList.add('kintoneplugin-input-text');
        inputElm.id = id;
        inputElm.type =
          type === '日時'
            ? 'datetime-local'
            : type === '日付'
              ? 'date'
              : 'time';
        inputElm.value =
          type === '日時' ? FormModel.toDatetimeLocal(value) : value || '';
        inputElm.disabled = isDisabled;
        outer.appendChild(inputElm);
        rowDiv.appendChild(outer);
        break;
      }
      case '文字列_複数行': {
        const outer = document.createElement('div');
        outer.classList.add('kintoneplugin-input-outer');
        inputElm = document.createElement('textarea');
        inputElm.classList.add('kintoneplugin-input-text', 'ra-form-textarea');
        inputElm.id = id;
        inputElm.disabled = isDisabled;
        inputElm.value = value || '';
        outer.appendChild(inputElm);
        rowDiv.appendChild(outer);
        break;
      }
      case 'ドロップダウン': {
        const selectOuter = document.createElement('div');
        selectOuter.classList.add('kintoneplugin-select-outer');
        const selectDiv = document.createElement('div');
        selectDiv.classList.add('kintoneplugin-select');
        inputElm = document.createElement('select');
        inputElm.id = id;
        inputElm.disabled = isDisabled;
        inputElm.add(new Option('-- 選択してください --', ''));
        (options || []).forEach((opt) =>
          inputElm.add(new Option(opt, opt, false, opt === value)),
        );
        selectDiv.appendChild(inputElm);
        selectOuter.appendChild(selectDiv);
        rowDiv.appendChild(selectOuter);
        break;
      }
      case 'ラジオボタン':
      case 'チェックボックス': {
        const groupDiv = document.createElement('div');
        groupDiv.id = id;
        groupDiv.classList.add('ra-choice-group');
        const activeValues =
          type === 'チェックボックス' && typeof value === 'string' && value
            ? value.split(',').map((v) => v.trim())
            : Array.isArray(value)
              ? value
              : [value];
        (options || []).forEach((opt, index) => {
          const itemSpan = document.createElement('span');
          itemSpan.classList.add('ra-choice-item');
          const inp = document.createElement('input');
          inp.type = type === 'ラジオボタン' ? 'radio' : 'checkbox';
          if (type === 'ラジオボタン') {
            inp.name = id;
          }
          inp.id = `${id}-${index}`;
          inp.value = opt;
          inp.dataset.display = opt;
          inp.disabled = isDisabled;
          if (activeValues.includes(opt)) {
            inp.checked = true;
          }
          const lbl = document.createElement('label');
          lbl.htmlFor = `${id}-${index}`;
          lbl.textContent = opt;
          itemSpan.appendChild(inp);
          itemSpan.appendChild(lbl);
          groupDiv.appendChild(itemSpan);
        });
        rowDiv.appendChild(groupDiv);
        inputElm = groupDiv;
        break;
      }
      default: {
        // 未知タイプは文字列として扱う
        const outer = document.createElement('div');
        outer.classList.add('kintoneplugin-input-outer');
        inputElm = document.createElement('input');
        inputElm.classList.add('kintoneplugin-input-text');
        inputElm.id = id;
        inputElm.type = 'text';
        inputElm.value = value || '';
        inputElm.disabled = isDisabled;
        outer.appendChild(inputElm);
        rowDiv.appendChild(outer);
      }
    }

    const errorElm = document.createElement('div');
    errorElm.classList.add('ra-error-message');
    rowDiv.appendChild(errorElm);

    return rowDiv;
  };

  // 仮想フォームをスペースフィールドへ描画する。
  //   spaceField: 描画先要素 / layoutRows: フォーム定義 / conditions: 動的必須条件
  //   getFieldValue(fieldCode): 初期値の取得 / isDisabled: 閲覧専用かどうか
  const renderForm = (
    spaceField,
    layoutRows,
    conditions,
    getFieldValue,
    isDisabled,
  ) => {
    spaceField.textContent = '';
    spaceField.classList.add('ra-virtual-form');

    const sortedLayout = FormModel.sortLayoutByOrder(layoutRows);

    let currentGridWidth = 0;
    sortedLayout.forEach((item) => {
      const elm = item.value;
      const fieldCode = elm.insert_column && elm.insert_column.value;
      if (!fieldCode) {
        return;
      }

      const widthVal = elm.question_width && elm.question_width.value;
      const isHalf = widthVal === '1/2';
      const itemWidth = isHalf ? 1 : 2;

      // 行あふれ判定: 現在の幅 + 新しい項目の幅 > 2 なら区切り線を入れて改行
      if (currentGridWidth > 0 && currentGridWidth + itemWidth > 2) {
        const hr = document.createElement('hr');
        hr.classList.add('ra-form-hr');
        spaceField.appendChild(hr);
        currentGridWidth = 0;
      }

      const inputRow = makeInputElement({
        type: (elm.field_type && elm.field_type.value) || '文字列',
        label: (elm.question && elm.question.value) || '',
        desc: (elm.question_detail && elm.question_detail.value) || '',
        id: inputId(fieldCode),
        value: getFieldValue(fieldCode),
        options: FormModel.parseChoices(elm.choice && elm.choice.value),
        mandatory: (elm.mondatory && elm.mondatory.value) || '任意',
        isDisabled,
        fieldCode,
      });

      inputRow.classList.add(isHalf ? 'ra-col-half' : 'ra-col-full');
      spaceField.appendChild(inputRow);

      // 入力変更で動的必須条件を再評価する
      inputRow
        .querySelectorAll('input, select, textarea')
        .forEach((targetInput) => {
          targetInput.addEventListener('change', () => {
            applyDynamicLogic(spaceField, conditions, layoutRows);
          });
        });

      currentGridWidth += itemWidth;
    });

    applyDynamicLogic(spaceField, conditions, layoutRows);
  };

  // 保存時の必須チェックとエラー表示。エラーがあればtrueを返す。
  const validateAndMarkErrors = (spaceField, layoutRows) => {
    spaceField.querySelectorAll('.ra-error-message').forEach((msg) => {
      msg.textContent = '';
      msg.classList.remove('is-visible');
    });

    let hasError = false;
    (layoutRows || []).forEach((item) => {
      const fieldData = item.value;
      const fieldCode =
        fieldData.insert_column && fieldData.insert_column.value;
      const type = fieldData.field_type && fieldData.field_type.value;
      const originalMandatory =
        fieldData.mondatory && fieldData.mondatory.value;
      if (!fieldCode) {
        return;
      }
      const targetRow = spaceField.querySelector(
        `.kintoneplugin-row[data-field-code="${CSS.escape(fieldCode)}"]`,
      );
      if (!targetRow) {
        return;
      }
      const isHidden = targetRow.style.display === 'none';
      const isDynamicMandatory = targetRow.dataset.dynamicMandatory === 'true';
      const value = getValueFromDOM(fieldCode, type);

      if (!isHidden && (originalMandatory === '必須' || isDynamicMandatory)) {
        const isEmpty = Array.isArray(value)
          ? value.length === 0
          : !value || String(value).trim() === '';
        if (isEmpty) {
          hasError = true;
          const errorElm = targetRow.querySelector('.ra-error-message');
          if (errorElm) {
            errorElm.textContent = '必須項目です。入力してください。';
            errorElm.classList.add('is-visible');
          }
        }
      }
    });
    return hasError;
  };

  NS.FormUI = {
    inputId,
    getValueFromDOM,
    applyDynamicLogic,
    makeInputElement,
    renderForm,
    validateAndMarkErrors,
  };
})(window);
