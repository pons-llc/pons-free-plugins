(() => {
  'use strict';

  const formEl = document.querySelector('.js-submit-settings');
  const cancelButtonEl = document.querySelector('.js-cancel-button');

  formEl.addEventListener('submit', (e) => {
    e.preventDefault();
    // 保存する設定値はない(APIキー等はプラグイン設定に保存しない方針)。
    // kintoneは一度もsetConfigを呼んでいないプラグインをアプリに適用できないため、空の設定を保存するだけ。
    kintone.plugin.app.setConfig({}, () => {
      window.location.href = '../../flow?app=' + kintone.app.getId();
    });
  });

  cancelButtonEl.addEventListener('click', () => {
    window.location.href = '../../' + kintone.app.getId() + '/plugin/';
  });
})();
