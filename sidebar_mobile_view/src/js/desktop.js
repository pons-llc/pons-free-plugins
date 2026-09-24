(function (global, kintone) {
  'use strict';

  const NS = global.SidebarMobileView;
  const PLUGIN_ID = kintone.$PLUGIN_ID;
  const PANEL_ID = 'smv-panel';
  const SCREEN_KIND_BY_EVENT_TYPE = {
    'app.record.detail.show': 'DETAIL',
    'app.record.edit.show': 'EDIT',
    'app.record.create.show': 'CREATE',
  };

  // このプラグインの設定はレコード画面の表示中には変わらないため、画面読み込み時に一度だけ読み込む。
  const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  let currentView = 'OFF';
  // 新規作成画面ではkintone.app.record.showSideBar()・getSideBarDisplayState()が
  // 利用できないAPI(公式ドキュメントの「利用できる画面」にレコード詳細・編集画面のみ記載され
  // 追加画面が含まれない)なので、これらを呼んでよいかどうかをイベントの種類ごとに切り替える。
  let currentHasNativeSideBar = true;
  // トグルボタン・パネルの閉じるボタンでモバイル版プレビューを閉じたときに戻る先の状態。
  // レコード詳細画面ではOFF(サイドパネルには一切触らない)、編集・新規作成画面では設定の
  // 初期表示(NATIVE/IFRAME)に戻す(js/lib/panel-state.jsのresolveInitialView()参照)。
  let currentOffState = 'NATIVE';
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
    closeButtonEl.addEventListener('click', () =>
      applyView(currentOffState, currentHasNativeSideBar),
    );

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

  // 対象アプリID(config.targetAppId)が現在のアプリと異なる場合、現在のレコードIDはそのアプリでは
  // 無関係の値になるため、レコード詳細ではなくそのアプリのモバイル版レコード一覧を表示する
  // (顧客マスタを見ながら案件管理を更新する、といった「別アプリを見ながら操作したい」用途)。
  // 対象アプリIDが未指定・現在のアプリと同じ場合はレコード詳細を表示するが、新規作成画面など
  // レコードIDがまだ存在しない場合は、現在のアプリの一覧を表示する
  // (js/lib/mobile-url.jsのresolve()参照)。
  // ゲストスペース内のアプリはURLが通常と異なるため、URLは自前で組み立てず
  // kintone.buildPageUrl()(対象アプリがゲストスペース内なら自動でゲストスペース用URLを返す、
  // 公式ドキュメントで確認済み)で取得する。取得に失敗した場合(1分50回の上限超過等)のみ、
  // 通常スペース用の自前のURL組み立てにフォールバックする。
  const resolveMobileUrl = async (hasNativeSideBar) => {
    const currentAppId = kintone.app.getId();
    // 新規作成画面ではkintone.app.record.getId()が利用できない(未保存のレコードにはIDが
    // 存在しない)ため呼び出さない。
    const recordId = hasNativeSideBar ? kintone.app.record.getId() : null;
    const args = { currentAppId, targetAppId: config.targetAppId, recordId };
    const target = NS.MobileUrl.resolvePage(args);
    if (!target) {
      return null;
    }
    try {
      return await kintone.buildPageUrl(target.page, target.params);
    } catch {
      return NS.MobileUrl.resolve({ origin: location.origin, ...args });
    }
  };

  const updateToggleButtonLabel = (hasNativeSideBar) => {
    if (toggleButtonEl) {
      toggleButtonEl.textContent = NS.PanelState.resolveToggleButtonLabel(
        currentView,
        hasNativeSideBar,
      );
    }
  };

  const applyView = async (view, hasNativeSideBar) => {
    currentView = view;
    const panelEl = getOrCreatePanel();
    panelEl.style.width = `${config.panelWidth}px`;
    const iframeEl = panelEl.querySelector('.smv-panel-iframe');

    if (currentView === 'IFRAME') {
      const url = await resolveMobileUrl(hasNativeSideBar);
      if (url) {
        if (hasNativeSideBar) {
          // レコード詳細/編集画面ではネイティブのサイドバーと自作パネルが同じ右側の領域を
          // 奪い合うため、iframe表示時はネイティブ側を閉じて場所を譲る。新規作成画面には
          // そもそもネイティブのサイドバーが無いため呼び出さない。
          kintone.app.record.showSideBar('CLOSED');
        }
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
      // NATIVE(コメント・変更履歴を明示的に開く)のときのみshowSideBar()を呼ぶ。
      // OFF(レコード詳細画面の初期表示)ではサイドバーの状態には一切触れない
      // (自作パネルが編集ボタン等の他の画面要素に重なって隠してしまう不具合の対応として、
      // 詳細画面の初期表示ではkintone標準の状態をそのまま残す設計に変更した)。
      if (hasNativeSideBar && currentView === 'NATIVE') {
        kintone.app.record.showSideBar(
          NS.PanelState.resolveNativeSideBarState(config),
        );
      }
    }

    updateToggleButtonLabel(hasNativeSideBar);
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
        applyView(
          NS.PanelState.toggleView(currentView, currentOffState),
          currentHasNativeSideBar,
        );
      });
    }
    // getHeaderMenuSpaceElement()は画面ごとに別のElementを返しうるため、既存のボタンを
    // 都度その時点の要素へ移し替える(appendChildは既存ノードを移動させるだけで複製しない)。
    headerSpaceEl.appendChild(toggleButtonEl);
    updateToggleButtonLabel(currentHasNativeSideBar);
  };

  // 新規作成画面(app.record.create.show)もPCの「利用できる画面」に含まれる
  // getHeaderMenuSpaceElement()は使えるが、showSideBar()・getSideBarDisplayState()・
  // record.getId()は使えない(公式ドキュメント確認済み、idea.md参照)。そのため
  // event.typeで実際に発火したイベントを判定し、画面の種類ごとに
  // ネイティブサイドバー関連のAPI呼び出しと初期表示を切り替える。
  kintone.events.on(
    [
      'app.record.detail.show',
      'app.record.edit.show',
      'app.record.create.show',
    ],
    (event) => {
      const screenKind = SCREEN_KIND_BY_EVENT_TYPE[event.type] || 'EDIT';
      currentHasNativeSideBar = screenKind !== 'CREATE';
      currentOffState = NS.PanelState.resolveInitialView(config, screenKind);
      ensureToggleButton();
      applyView(currentOffState, currentHasNativeSideBar);
      return event;
    },
  );
})(window, kintone);
