(function (global, kintone) {
  'use strict';

  const NS = global.GeoCheckin;
  const PLUGIN_ID = kintone.$PLUGIN_ID;

  const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  const GEOLOCATION_OPTIONS = {
    enableHighAccuracy: true,
    timeout: 15000,
    maximumAge: 0,
  };

  const getCurrentPosition = () =>
    new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('このブラウザは位置情報の取得に対応していません。'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        resolve,
        reject,
        GEOLOCATION_OPTIONS,
      );
    });

  // desktop.jsと同じ自動リトライ(js/lib/geo-retry.js参照)。
  const RETRY_OPTIONS = {
    maxAttempts: 3,
    delayMs: 1000,
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  };
  const getCurrentPositionWithRetry = () =>
    NS.GeoRetry.withGeoRetry(getCurrentPosition, RETRY_OPTIONS);

  const isConfigured = () =>
    !!(config.latitudeFieldCode && config.longitudeFieldCode);

  // desktop.jsと同じ「常に非表示」の仕様(kintone.mobile.app.record.setFieldShown()を使う)。
  // モバイルにはレコード一覧のインライン編集が存在しないため、index.edit.show相当の処理は無い
  // (idea.md参照)。
  const hideFields = () => {
    if (!isConfigured()) {
      return;
    }
    kintone.mobile.app.record.setFieldShown(config.latitudeFieldCode, false);
    kintone.mobile.app.record.setFieldShown(config.longitudeFieldCode, false);
  };

  // 編集画面では非表示に加えてdisabledにもする(desktop.jsと同じ二重の防御)。
  const disableFields = (record) => {
    if (!isConfigured()) {
      return;
    }
    const latField = record[config.latitudeFieldCode];
    const lngField = record[config.longitudeFieldCode];
    if (latField) {
      latField.disabled = true;
    }
    if (lngField) {
      lngField.disabled = true;
    }
  };

  const clearMapSpace = (spaceEl) => {
    while (spaceEl.firstChild) {
      spaceEl.removeChild(spaceEl.firstChild);
    }
  };

  const renderMapMessage = (spaceEl, text) => {
    clearMapSpace(spaceEl);
    const messageEl = document.createElement('p');
    messageEl.className = 'geoc-map-message';
    messageEl.textContent = text;
    spaceEl.appendChild(messageEl);
  };

  // desktop.jsのgetHeaderMenuSpaceElement()に対応するモバイル側API
  // (kintone.mobile.app.getHeaderSpaceElement())にGoogleマップを埋め込む。
  // レコード一覧画面でも利用できるAPIだが、本プラグインでは追加・編集・詳細画面でのみ使う。
  const renderMap = (record) => {
    if (!config.showMap || !isConfigured()) {
      return;
    }
    const spaceEl = kintone.mobile.app.getHeaderSpaceElement();
    if (!spaceEl) {
      return;
    }
    const latField = record[config.latitudeFieldCode];
    const lngField = record[config.longitudeFieldCode];
    const embedUrl = NS.MapEmbedUrl.buildUrl(
      latField ? latField.value : undefined,
      lngField ? lngField.value : undefined,
    );

    if (!embedUrl) {
      renderMapMessage(
        spaceEl,
        '位置情報が未登録のため、地図を表示できません(保存すると位置情報が登録されます)。',
      );
      return;
    }

    clearMapSpace(spaceEl);
    const iframeEl = document.createElement('iframe');
    iframeEl.className = 'geoc-map-iframe';
    iframeEl.src = embedUrl;
    iframeEl.width = '100%';
    iframeEl.height = '200';
    iframeEl.style.border = 'none';
    iframeEl.setAttribute('frameborder', '0');
    iframeEl.loading = 'lazy';
    iframeEl.title = '位置情報の地図表示';
    spaceEl.appendChild(iframeEl);
  };

  kintone.events.on(
    [
      'mobile.app.record.create.show',
      'mobile.app.record.edit.show',
      'mobile.app.record.detail.show',
    ],
    (event) => {
      hideFields();
      if (event.type === 'mobile.app.record.edit.show') {
        disableFields(event.record);
      }
      renderMap(event.record);
      return event;
    },
  );

  kintone.events.on(
    ['mobile.app.record.create.submit', 'mobile.app.record.edit.submit'],
    async (event) => {
      if (!isConfigured()) {
        return event;
      }
      try {
        const position = await getCurrentPositionWithRetry();
        const latField = event.record[config.latitudeFieldCode];
        const lngField = event.record[config.longitudeFieldCode];
        if (latField) {
          latField.value = String(position.coords.latitude);
        }
        if (lngField) {
          lngField.value = String(position.coords.longitude);
        }
      } catch (err) {
        alert(NS.GeoErrorMessage.buildMessage(err));
      }
      return event;
    },
  );
})(window, kintone);
