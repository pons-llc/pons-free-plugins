(function (PLUGIN_ID) {
  'use strict';

  const NS = window.GenaiAppShare;
  const { load } = NS.ConfigStore;
  const { buildInnerDocument, buildOuterShellDocument, buildDataUrl } =
    NS.BuildPreviewHtml;
  const { findCreatorName } = NS.FindCreatorName;

  const config = load(kintone.plugin.app.getConfig(PLUGIN_ID));
  const isConfigured = Boolean(config.htmlFieldCode);
  const fieldCodes = [
    config.htmlFieldCode,
    config.cssFieldCode,
    config.jsFieldCode,
  ].filter(Boolean);

  const fieldValue = (record, code) =>
    code && record[code] ? record[code].value : '';

  const CONTAINER_CLASS = 'genai-app-share-container';

  // 直前に発行したBlob URLを覚えておき、詳細画面が再描画されるたび(ページ送り・編集後の
  // 復帰・ステータス変更後等)に古いものをrevokeしてから新しく発行する(idea.md参照)。
  let currentUrls = null;
  const revokeCurrentUrls = () => {
    if (currentUrls) {
      URL.revokeObjectURL(currentUrls.innerUrl);
      URL.revokeObjectURL(currentUrls.outerUrl);
      currentUrls = null;
    }
  };

  const renderEmptyMessage = (containerEl) => {
    const emptyEl = document.createElement('p');
    emptyEl.className = 'genai-app-share-empty';
    emptyEl.textContent = 'HTML/JSのどちらも未入力です。';
    containerEl.appendChild(emptyEl);
  };

  // executionMode: 'blob'(既定) は殻ページ+sandbox化iframeの2段構成、'data'は生成ドキュメントを
  // そのままdata:URLにする(sandbox不要、代わりに別タブ遷移が環境によってはブロックされうる。
  // idea.md「実行方式の選択」参照)。
  const buildLinkHref = (innerDocument) => {
    if (config.executionMode === 'data') {
      return buildDataUrl(innerDocument);
    }
    const innerBlob = new Blob([innerDocument], { type: 'text/html' });
    const innerUrl = URL.createObjectURL(innerBlob);
    const outerBlob = new Blob([buildOuterShellDocument({ innerUrl })], {
      type: 'text/html',
    });
    const outerUrl = URL.createObjectURL(outerBlob);
    currentUrls = { innerUrl, outerUrl };
    return outerUrl;
  };

  const renderLink = (containerEl, record) => {
    const html = fieldValue(record, config.htmlFieldCode);
    const css = fieldValue(record, config.cssFieldCode);
    const js = fieldValue(record, config.jsFieldCode);
    const innerDocument = buildInnerDocument({
      html,
      css,
      js,
      reactMode: config.enableReact,
      // data方式では別タブを開いた直後に初回描画が白紙のまま止まることがあるため
      // (実機のChromeで確認済み、idea.md「実行方式の選択」参照)、自己リロードで補う。
      selfReloadOnce: config.executionMode === 'data',
    });

    const linkEl = document.createElement('a');
    linkEl.className = 'kintoneplugin-button-normal genai-app-share-link';
    linkEl.href = buildLinkHref(innerDocument);
    linkEl.target = '_blank';
    linkEl.rel = 'noopener noreferrer';
    linkEl.textContent = '生成AIアプリを開く';
    containerEl.appendChild(linkEl);

    const warningEl = document.createElement('p');
    warningEl.className = 'genai-app-share-warning';
    warningEl.textContent = `⚠️ このリンクは、${findCreatorName(record)}さんが入力したコードをブラウザで実行します。信頼できる相手が入力した内容か確認してから開いてください。`;
    containerEl.appendChild(warningEl);
  };

  // レコード詳細画面: 入力フィールドを隠し、代わりにBlobで別タブに開くリンクを表示する。
  const handleDetailShow = (event) => {
    if (!isConfigured) {
      return event;
    }
    fieldCodes.forEach((code) => kintone.app.record.setFieldShown(code, false));

    const headerEl = kintone.app.record.getHeaderMenuSpaceElement();
    if (!headerEl) {
      return event;
    }
    const existing = headerEl.querySelector(`.${CONTAINER_CLASS}`);
    if (existing) {
      existing.remove();
    }
    revokeCurrentUrls();

    const containerEl = document.createElement('div');
    containerEl.className = CONTAINER_CLASS;

    // React/JSXサポート時はHTMLフィールドが空でもJSだけでDOMを組み立てる構成が一般的なため
    // (ルートコンポーネントが#rootへ描画する)、HTML/JSの両方が空のときだけ「未入力」扱いにする。
    const htmlValue = fieldValue(event.record, config.htmlFieldCode);
    const jsValue = fieldValue(event.record, config.jsFieldCode);
    if (!htmlValue.trim() && !jsValue.trim()) {
      renderEmptyMessage(containerEl);
    } else {
      renderLink(containerEl, event.record);
    }

    headerEl.appendChild(containerEl);
    return event;
  };

  // レコード作成・編集画面: 入力フィールドが表示された状態を保証する(idea.md「確定仕様」参照。
  // 詳細画面から編集画面へ遷移する際のDOM状態引き継ぎに備えた防御的な明示指定)。
  const handleEditableShow = (event) => {
    if (!isConfigured) {
      return event;
    }
    fieldCodes.forEach((code) => kintone.app.record.setFieldShown(code, true));
    return event;
  };

  // レコード印刷画面: 生のHTML/CSS/JSがそのまま印刷されるのを防ぐため入力フィールドのみ隠す
  // (別タブへのリンクは印刷物として意味を持たないため出さない)。
  const handlePrintShow = (event) => {
    if (!isConfigured) {
      return event;
    }
    fieldCodes.forEach((code) => kintone.app.record.setFieldShown(code, false));
    return event;
  };

  kintone.events.on('app.record.detail.show', handleDetailShow);
  kintone.events.on(
    ['app.record.create.show', 'app.record.edit.show'],
    handleEditableShow,
  );
  kintone.events.on('app.record.print.show', handlePrintShow);
})(kintone.$PLUGIN_ID);
