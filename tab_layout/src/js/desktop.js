(function (global, kintone) {
  'use strict';

  const NS = global.TabLayout;
  const PLUGIN_ID = kintone.$PLUGIN_ID;

  // このプラグインの設定はレコード画面の表示中には変わらないため、画面読み込み時に一度だけ読み込む。
  const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  // 1つのタブグループ(アンカーのスペースフィールド+タブの配列)をレコード画面に描画する。
  const renderTabGroup = (layoutConfig) => {
    const spaceEl = kintone.app.record.getSpaceElement(
      layoutConfig.spaceElementId,
    );
    // アンカーとなるスペースフィールドが存在しない(フィールド削除・設定の食い違い等)場合は
    // 何もせず、画面全体をクラッシュさせない。
    if (!spaceEl) {
      return;
    }
    spaceEl.innerHTML = '';

    const containerEl = document.createElement('div');
    containerEl.className = 'tbl-tab-buttons';

    let activeIndex = NS.TabVisibility.resolveDefaultTabIndex(
      layoutConfig.tabs,
      layoutConfig.defaultTabIndex,
    );

    const applyVisibility = () => {
      const visibility = NS.TabVisibility.computeVisibility(
        layoutConfig.tabs,
        activeIndex,
      );
      Object.keys(visibility).forEach((code) => {
        kintone.app.record.setFieldShown(code, visibility[code]);
      });
    };

    const buttonEls = layoutConfig.tabs.map((tab, index) => {
      const buttonEl = document.createElement('button');
      buttonEl.type = 'button';
      buttonEl.className = 'tbl-tab-button';
      // タブラベルはアプリ管理者が設定画面で入力した自由記述文字列のため、innerHTMLではなく
      // textContentで描画する(security-checklist.mdのXSS対策参照)。
      buttonEl.textContent = tab.label;
      buttonEl.addEventListener('click', () => {
        activeIndex = index;
        buttonEls.forEach((b, i) => {
          b.classList.toggle('tbl-tab-button-active', i === activeIndex);
        });
        applyVisibility();
      });
      containerEl.appendChild(buttonEl);
      return buttonEl;
    });
    buttonEls.forEach((b, i) => {
      b.classList.toggle('tbl-tab-button-active', i === activeIndex);
    });

    spaceEl.appendChild(containerEl);
    applyVisibility();
  };

  const initTabGroups = () => {
    config.layouts.forEach((layoutConfig) => {
      renderTabGroup(layoutConfig);
    });
  };

  // kintone.app.record.getSpaceElement()/setFieldShown()が利用できる画面すべてで発動する
  // (idea.mdの「発動する画面」参照)。
  kintone.events.on(
    [
      'app.record.create.show',
      'app.record.edit.show',
      'app.record.detail.show',
      'app.record.print.show',
    ],
    (event) => {
      initTabGroups();
      return event;
    },
  );
})(window, kintone);
