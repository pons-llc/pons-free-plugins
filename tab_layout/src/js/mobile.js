(function (global, kintone) {
  'use strict';

  const NS = global.TabLayout;
  const PLUGIN_ID = kintone.$PLUGIN_ID;

  const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  // desktop.js と同じ描画ロジック(モバイルAPIは kintone.mobile.app.record 名前空間になる点のみ異なる)。
  const renderTabGroup = (layoutConfig) => {
    const spaceEl = kintone.mobile.app.record.getSpaceElement(
      layoutConfig.spaceElementId,
    );
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
        kintone.mobile.app.record.setFieldShown(code, visibility[code]);
      });
    };

    const buttonEls = layoutConfig.tabs.map((tab, index) => {
      const buttonEl = document.createElement('button');
      buttonEl.type = 'button';
      buttonEl.className = 'tbl-tab-button';
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

  // モバイルには印刷画面がないため、詳細・追加・編集画面のみで発動する。
  kintone.events.on(
    [
      'mobile.app.record.create.show',
      'mobile.app.record.edit.show',
      'mobile.app.record.detail.show',
    ],
    (event) => {
      initTabGroups();
      return event;
    },
  );
})(window, kintone);
