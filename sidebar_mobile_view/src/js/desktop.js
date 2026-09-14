(function (global, kintone) {
  'use strict';

  const NS = global.SidebarMobileView;
  const PLUGIN_ID = kintone.$PLUGIN_ID;
  const PANEL_ID = 'smv-panel';

  // このプラグインの設定はレコード画面の表示中には変わらないため、画面読み込み時に一度だけ読み込む。
  const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  let currentView = NS.PanelState.resolveInitialView(config);
  let toggleButtonEl = null;

  // カスタムパネルはkintone標準のサイドバー(コメント欄・変更履歴)とは別に、画面右端に
  // position:fixedで重ねて表示する自作の要素(kintoneにはサイドバーへ任意コンテンツを
  // 差し込む公式APIが無いため、idea.md「カスタムサイドパネルの実装方式」参照)。
  // detail画面→edit画面への遷移(実際には`/show`のまま`mode=edit`ハッシュが付与されるだけで
  // ページ自体は再読み込みされない、CLAUDE.mdのgoToEditScreenFromDetail()コメント参照)でも
  // DOMが残るため、既存要素があれば使い回す(二重生成防止)。
  const getOrCreatePanel = () => {
    let panelEl = document.getElementById(PANEL_ID);
    if (panelEl) {
      return panelEl;
    }

    panelEl = document.createElement('div');
    panelEl.id = PANEL_ID;
    panelEl.className = 'smv-panel';
    panelEl.hidden = true;

    const barEl = document.createElement('div');
    barEl.className = 'smv-panel-bar';

    const titleEl = document.createElement('span');
    titleEl.className = 'smv-panel-title';
    titleEl.textContent = 'モバイル版プレビュー';

    const closeButtonEl = document.createElement('button');
    closeButtonEl.type = 'button';
    closeButtonEl.className = 'smv-panel-close';
    closeButtonEl.textContent = '閉じる';
    closeButtonEl.addEventListener('click', () => applyView('NATIVE'));

    barEl.appendChild(titleEl);
    barEl.appendChild(closeButtonEl);

    const iframeEl = document.createElement('iframe');
    iframeEl.className = 'smv-panel-iframe';
    iframeEl.title = 'モバイル版プレビュー';

    panelEl.appendChild(barEl);
    panelEl.appendChild(iframeEl);

    // ヘッダー(HTML5セマンティックな<header>要素、実機で確認済み)の下端ぶんパネルの
    // 開始位置を下げる。スクロールでヘッダーが隠れる場合の追従は行わない簡略仕様
    // (idea.md「既知の制約」参照)。<header>要素が見つからない場合は既定値を使う。
    const headerEl = document.querySelector('header');
    const headerBottom = headerEl
      ? Math.ceil(headerEl.getBoundingClientRect().bottom)
      : 60;
    panelEl.style.top = `${headerBottom}px`;

    document.body.appendChild(panelEl);
    return panelEl;
  };

  const resolveMobileUrl = () => {
    const appId = config.targetAppId || String(kintone.app.getId());
    const recordId = kintone.app.record.getId();
    return NS.MobileUrl.build({ origin: location.origin, appId, recordId });
  };

  const updateToggleButtonLabel = () => {
    if (toggleButtonEl) {
      toggleButtonEl.textContent =
        NS.PanelState.resolveToggleButtonLabel(currentView);
    }
  };

  const applyView = (view) => {
    currentView = view;
    const panelEl = getOrCreatePanel();
    panelEl.style.width = `${config.panelWidth}px`;
    const iframeEl = panelEl.querySelector('.smv-panel-iframe');

    if (currentView === 'IFRAME') {
      const url = resolveMobileUrl();
      if (url) {
        // レコード詳細/編集画面ではネイティブのサイドバーと自作パネルが同じ右側の領域を
        // 奪い合うため、iframe表示時はネイティブ側を閉じて場所を譲る。
        kintone.app.record.showSideBar('CLOSED');
        if (iframeEl.src !== url) {
          iframeEl.src = url;
        }
        panelEl.hidden = false;
      } else {
        // アプリID・レコードIDが取得できない(想定外の画面状態)場合は何もしない。
        panelEl.hidden = true;
      }
    } else {
      panelEl.hidden = true;
      // 非表示中もiframeの読み込みが裏で走り続けないよう、URLを空にしておく。
      iframeEl.src = 'about:blank';
      kintone.app.record.showSideBar(
        NS.PanelState.resolveNativeSideBarState(config),
      );
    }

    updateToggleButtonLabel();
  };

  const ensureToggleButton = () => {
    const headerSpaceEl = kintone.app.record.getHeaderMenuSpaceElement();
    if (!headerSpaceEl) {
      return;
    }
    if (!toggleButtonEl) {
      toggleButtonEl = document.createElement('button');
      toggleButtonEl.type = 'button';
      toggleButtonEl.className =
        'kintoneplugin-button-normal smv-toggle-button';
      toggleButtonEl.addEventListener('click', () => {
        applyView(NS.PanelState.toggleView(currentView));
      });
    }
    // getHeaderMenuSpaceElement()は画面ごとに別のElementを返しうるため、既存のボタンを
    // 都度その時点の要素へ移し替える(appendChildは既存ノードを移動させるだけで複製しない)。
    headerSpaceEl.appendChild(toggleButtonEl);
    updateToggleButtonLabel();
  };

  kintone.events.on(
    ['app.record.detail.show', 'app.record.edit.show'],
    (event) => {
      ensureToggleButton();
      applyView(NS.PanelState.resolveInitialView(config));
      return event;
    },
  );
})(window, kintone);
