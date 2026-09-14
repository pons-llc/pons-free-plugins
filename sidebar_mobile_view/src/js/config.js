(async (PLUGIN_ID) => {
  'use strict';

  const NS = window.SidebarMobileView;

  const formEl = document.querySelector('.js-submit-settings');
  const cancelButtonEl = document.querySelector('.js-cancel-button');
  const errorsEl = document.getElementById('js-errors');
  const defaultViewEl = document.querySelector('.js-default-view');
  const defaultNativeStateEl = document.querySelector(
    '.js-default-native-state',
  );
  const panelWidthEl = document.querySelector('.js-panel-width');
  const targetAppIdEl = document.querySelector('.js-target-app-id');

  const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  // 設定画面を開いたとき、対象アプリIDが未入力ならこのアプリのID(kintone.app.getId()は
  // プラグイン設定画面でも利用できるJavaScript API、idea.md「使用するJavaScript API」参照)を
  // 初期値として補完する(ユーザー要望「設定画面で初期のアプリIDを指定する」に対応)。
  // 管理者が明示的に空へ戻して保存することもでき、その場合はdesktop.js側で現在のアプリIDへ
  // フォールバックする(js/lib/config-store.jsのDEFAULTS.targetAppId参照)。
  if (!config.targetAppId) {
    config.targetAppId = String(kintone.app.getId());
  }

  defaultViewEl.value = config.defaultView;
  defaultNativeStateEl.value = config.defaultNativeState;
  panelWidthEl.value = String(config.panelWidth);
  targetAppIdEl.value = config.targetAppId;

  cancelButtonEl.addEventListener('click', () => {
    window.location.href = '../../' + kintone.app.getId() + '/plugin/';
  });

  formEl.addEventListener('submit', (e) => {
    e.preventDefault();

    const nextConfig = {
      defaultView: defaultViewEl.value,
      defaultNativeState: defaultNativeStateEl.value,
      panelWidth: Number.parseInt(panelWidthEl.value, 10),
      targetAppId: targetAppIdEl.value.trim(),
    };

    const validation = NS.ConfigValidation.validateConfig(nextConfig);
    if (!validation.valid) {
      // 設定画面でアプリ管理者自身が選択・入力した値の検証結果のみを表示しており、外部からの
      // 入力ではないが、念のためinnerHTMLではなくtextContentで出力する。
      errorsEl.textContent = validation.errors.join('\n');
      return;
    }
    errorsEl.textContent = '';

    kintone.plugin.app.setConfig(NS.ConfigStore.serialize(nextConfig), () => {
      alert('プラグインの設定を保存しました。アプリを更新してください。');
      window.location.href = '../../flow?app=' + kintone.app.getId();
    });
  });
})(kintone.$PLUGIN_ID);
