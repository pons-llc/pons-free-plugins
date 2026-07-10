(function (global) {
  'use strict';

  // XSS／オープンリダイレクト対策として、埋め込み先ホストをサービスごとに許可リストで限定する
  const ALLOWED_HOSTS = {
    box: ['box.com'],
    google: ['drive.google.com', 'docs.google.com'],
  };

  const isAllowedHost = (hostname, service) => {
    const hosts = ALLOWED_HOSTS[service] || [];
    return hosts.some(
      (host) => hostname === host || hostname.endsWith('.' + host),
    );
  };

  // ユーザー入力のURLフィールド値は信頼できないため、URLとしてパースできて
  // https かつ許可ドメインであることを確認したうえでのみ埋め込みに利用する
  const buildEmbedUrl = (rawValue, service) => {
    if (!rawValue) {
      return null;
    }
    let url;
    try {
      url = new URL(rawValue);
    } catch {
      return null;
    }
    if (url.protocol !== 'https:' || !isAllowedHost(url.hostname, service)) {
      return null;
    }

    if (service === 'google') {
      const folderMatch = url.pathname.match(/\/folders\/([a-zA-Z0-9_-]+)/);
      const folderId = folderMatch
        ? folderMatch[1]
        : url.searchParams.get('id');
      if (folderId) {
        // Googleドライブのフォルダはリスト表示になる埋め込みビューに変換する
        return (
          'https://drive.google.com/embeddedfolderview?id=' +
          encodeURIComponent(folderId) +
          '#list'
        );
      }
    }

    if (service === 'box') {
      // 通常の共有リンク（/s/xxxx）はX-Frame-Optionsによりフレーム表示を拒否されるため、
      // Boxが提供する埋め込み専用URL（/embed/s/xxxx）に変換する
      const sharedMatch = url.pathname.match(/^\/s\/([a-zA-Z0-9]+)/);
      if (sharedMatch) {
        return 'https://app.box.com/embed/s/' + sharedMatch[1] + '?view=list';
      }
    }

    return url.href;
  };

  const clearElement = (el) => {
    while (el.firstChild) {
      el.removeChild(el.firstChild);
    }
  };

  const renderMessage = (spaceEl, text) => {
    clearElement(spaceEl);
    const messageEl = document.createElement('p');
    messageEl.className = 'box-gdrive-embed-message';
    messageEl.textContent = text;
    spaceEl.appendChild(messageEl);
  };

  const renderEmbed = (getSpaceElementFn, embed, record) => {
    const spaceEl = getSpaceElementFn(embed.spaceElementId);
    if (!spaceEl) {
      return;
    }

    const field = record[embed.urlFieldCode];
    const rawValue = field ? field.value : '';
    const embedUrl = buildEmbedUrl(rawValue, embed.service);

    if (!embedUrl) {
      renderMessage(
        spaceEl,
        rawValue
          ? '埋め込みURLの形式が正しくないか、許可されていないサイトのため表示できません。'
          : '埋め込みURLが設定されていません。',
      );
      return;
    }

    clearElement(spaceEl);
    const iframeEl = document.createElement('iframe');
    iframeEl.src = embedUrl;
    iframeEl.width = String(parseInt(embed.width, 10) || 600);
    iframeEl.height = String(parseInt(embed.height, 10) || 400);
    iframeEl.style.border = 'none';
    iframeEl.setAttribute('frameborder', '0');
    iframeEl.loading = 'lazy';
    if (embed.service === 'box') {
      // Boxが「埋め込みコードを生成」で発行するコードと同じ許可設定に合わせる
      iframeEl.setAttribute(
        'allow',
        'local-network-access *; clipboard-read *; clipboard-write *',
      );
    }
    iframeEl.allowFullscreen = true;
    spaceEl.appendChild(iframeEl);
  };

  const renderAll = (config, record, getSpaceElementFn) => {
    let embeds = [];
    try {
      embeds = config.embeds ? JSON.parse(config.embeds) : [];
    } catch {
      return;
    }
    if (!Array.isArray(embeds)) {
      return;
    }
    embeds.forEach((embed) => {
      if (
        embed &&
        embed.spaceElementId &&
        embed.urlFieldCode &&
        embed.service
      ) {
        renderEmbed(getSpaceElementFn, embed, record);
      }
    });
  };

  global.BoxGdriveEmbed = { renderAll };
})(window);
