((PLUGIN_ID) => {
  'use strict';

  const NS = window.ConfirmModal;

  const formEl = document.querySelector('.js-submit-settings');
  const cancelButtonEl = document.querySelector('.js-cancel-button');
  const errorsEl = document.getElementById('js-errors');
  const ruleListEl = document.getElementById('js-rule-list');
  const ruleAddButtonEl = document.getElementById('js-rule-add');
  const ruleRowTemplateEl = document.getElementById('js-rule-row-template');

  const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  const renderRuleList = () => {
    ruleListEl.innerHTML = '';
    config.rules.forEach((rule, ruleIndex) => {
      const fragment = ruleRowTemplateEl.content.cloneNode(true);
      const triggerEl = fragment.querySelector('.js-rule-trigger');
      const titleEl = fragment.querySelector('.js-rule-title');
      const bodyEl = fragment.querySelector('.js-rule-body');
      const okTextEl = fragment.querySelector('.js-rule-ok-text');
      const cancelTextEl = fragment.querySelector('.js-rule-cancel-text');
      const removeEl = fragment.querySelector('.js-rule-remove');

      triggerEl.value = rule.triggerEvent;
      titleEl.value = rule.title || '';
      bodyEl.value = rule.body || '';
      okTextEl.value = rule.okButtonText || '';
      cancelTextEl.value = rule.cancelButtonText || '';

      triggerEl.addEventListener('change', () => {
        rule.triggerEvent = triggerEl.value;
      });
      titleEl.addEventListener('input', () => {
        rule.title = titleEl.value;
      });
      bodyEl.addEventListener('input', () => {
        rule.body = bodyEl.value;
      });
      okTextEl.addEventListener('input', () => {
        rule.okButtonText = okTextEl.value;
      });
      cancelTextEl.addEventListener('input', () => {
        rule.cancelButtonText = cancelTextEl.value;
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
      triggerEvent: 'EDIT_SUBMIT',
      title: '',
      body: '',
      okButtonText: '',
      cancelButtonText: '',
    });
    renderRuleList();
  });

  cancelButtonEl.addEventListener('click', () => {
    window.location.href = '../../' + kintone.app.getId() + '/plugin/';
  });

  formEl.addEventListener('submit', (e) => {
    e.preventDefault();

    const validation = NS.ConfigValidation.validateRules(config.rules);
    if (!validation.valid) {
      // 設定画面でアプリ管理者自身が入力した値の検証結果(対象イベント名や本文の有無)のみを表示しており、
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
