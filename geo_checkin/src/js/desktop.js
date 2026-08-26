(function (global, kintone) {
  'use strict';

  const NS = global.GeoCheckin;
  const PLUGIN_ID = kintone.$PLUGIN_ID;

  const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  const GEOLOCATION_OPTIONS = {
    enableHighAccuracy: true,
    timeout: 15000,
    // 常にその場で取得する(キャッシュされた古い位置情報を使わない)。「保存の瞬間の証跡」という
    // プラグインの目的上、位置情報は毎回フレッシュに取得する。
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

  const isConfigured = () =>
    !!(config.latitudeFieldCode && config.longitudeFieldCode);

  // 緯度・経度フィールドは追加・編集・詳細のすべての画面で常に非表示にする(idea.md「常にvisible=false」
  // の仕様)。値そのものはレコードに保存され続けるため、一覧の列やCSVエクスポート・REST APIからは
  // 参照できる。フォーム上で直接見せない/触らせないことを目的とした表示制御であり、
  // アクセス権による制御ではない(UIレベルの制限、idea.md・security-checklist.md参照)。
  const hideFields = () => {
    if (!isConfigured()) {
      return;
    }
    kintone.app.record.setFieldShown(config.latitudeFieldCode, false);
    kintone.app.record.setFieldShown(config.longitudeFieldCode, false);
  };

  // 編集画面・レコード一覧のインライン編集では、非表示に加えてdisabledにもする(二重の防御。
  // 「UIだけの制限」であることはidea.mdに明記し、変更履歴〈リビジョン〉のON運用を案内している)。
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

  // ヘッダーメニュースペース(kintone.app.record.getHeaderMenuSpaceElement())にGoogleマップを
  // iframeで埋め込む。APIキー不要の公開埋め込み形式のみを使い、緯度・経度は数値として検証した
  // 値のみをURLに組み込む(js/lib/map-embed-url.js、外部通信はiframe表示のみでfetch/XHRは行わない)。
  const renderMap = (record) => {
    if (!config.showMap || !isConfigured()) {
      return;
    }
    const spaceEl = kintone.app.record.getHeaderMenuSpaceElement();
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
    iframeEl.height = '300';
    iframeEl.style.border = 'none';
    iframeEl.setAttribute('frameborder', '0');
    iframeEl.loading = 'lazy';
    iframeEl.title = '位置情報の地図表示';
    spaceEl.appendChild(iframeEl);
  };

  kintone.events.on(
    [
      'app.record.create.show',
      'app.record.edit.show',
      'app.record.detail.show',
    ],
    (event) => {
      hideFields();
      if (event.type === 'app.record.edit.show') {
        disableFields(event.record);
      }
      renderMap(event.record);
      return event;
    },
  );

  // 保存の直前に位置情報を取得し、緯度・経度フィールドへ書き込む。追加・編集どちらの保存でも
  // 「保存の瞬間」の位置情報で上書きする(idea.md参照)。取得に失敗してもevent.errorは設定せず、
  // レコード登録・更新は継続する(緯度・経度は空のまま)。alert()は同期的にブロックするため、
  // 保存処理が先に進む前に必ず利用者に通知できる。
  kintone.events.on(
    ['app.record.create.submit', 'app.record.edit.submit'],
    async (event) => {
      if (!isConfigured()) {
        return event;
      }
      try {
        const position = await getCurrentPosition();
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

  // レコード一覧画面のインライン編集では、緯度・経度フィールドの直接編集を禁止する
  // (setFieldShown()はインライン編集では利用できないため、disabledのみで制御する)。
  kintone.events.on('app.record.index.edit.show', (event) => {
    disableFields(event.record);
    return event;
  });
})(window, kintone);
