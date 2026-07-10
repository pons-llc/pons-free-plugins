(async (PLUGIN_ID) => {
  'use strict';

  const NS = window.TabLayout;

  const formEl = document.querySelector('.js-submit-settings');
  const cancelButtonEl = document.querySelector('.js-cancel-button');
  const errorsEl = document.getElementById('js-errors');
  const layoutListEl = document.getElementById('js-layout-list');
  const layoutAddButtonEl = document.getElementById('js-layout-add');
  const layoutRowTemplateEl = document.getElementById('js-layout-row-template');
  const tabRowTemplateEl = document.getElementById('js-tab-row-template');
  const itemRowTemplateEl = document.getElementById('js-item-row-template');
  const noSpaceWarningEl = document.getElementById('js-no-space-warning');

  // layout[].type === 'SUBTABLE' の中身(テーブル内フィールド)はスコープ外として除外する
  // (判断記録.md参照)。GROUPの中身は再帰的に展開する。
  const flattenLayout = (layout) => {
    const items = [];
    (layout || []).forEach((row) => {
      if (row.type === 'SUBTABLE') {
        return;
      }
      if (row.type === 'GROUP') {
        items.push(...flattenLayout(row.layout));
        return;
      }
      (row.fields || []).forEach((field) => {
        items.push(field);
      });
    });
    return items;
  };

  const labelOf = (field, formFields) => {
    if (field.type === 'LABEL') {
      return field.label || '(ラベル)';
    }
    if (field.type === 'SPACER') {
      return '(スペース)';
    }
    if (field.type === 'HR') {
      return '(罫線)';
    }
    const fieldInfo = formFields[field.code];
    return fieldInfo ? fieldInfo.label : field.code;
  };

  // kintone.app.getFormFields() は通常フィールドのラベル・型を、kintone.app.getFormLayout() は
  // ラベル/スペース/罫線を含むレイアウト順・要素ID(elementId)を解決する。両方を組み合わせて、
  // タブに割り当てられる「選択可能な項目」の一覧を組み立てる(idea.mdの「ラベルフィールドへの対応」参照)。
  // kintone.app.getFormFields()/getFormLayout() は、それぞれREST APIの`properties`/`layout`
  // プロパティ「と同様の値」に解決される(=戻り値自体がそのプロパティの値であり、
  // `{ properties: {...} }`や`{ layout: [...] }`のようにプロパティ名でラップされてはいない)。
  // kintoneドキュメントMCPで確認済み。
  const [formFields, layout] = await Promise.all([
    kintone.app.getFormFields(),
    kintone.app.getFormLayout(),
  ]);
  const layoutFields = flattenLayout(layout);

  const selectableItems = layoutFields.map((field) => {
    const code = field.code || field.elementId;
    return { code, label: labelOf(field, formFields), type: field.type };
  });
  const spaceItems = selectableItems.filter((item) => item.type === 'SPACER');
  // アンカーにできるスペースフィールドがアプリのフォームに1つもない場合、その旨を明示する
  // (「アンカーとなるスペースが選択できない」というフィードバックへの対応。原因は選択肢が
  // 空になっていて分かりにくいことだったため、空である事実をUIで明示する)。
  noSpaceWarningEl.hidden = spaceItems.length > 0;

  const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  const buildOptions = (selectEl, items, selectedCode, placeholder) => {
    selectEl.innerHTML = '';
    if (placeholder) {
      const placeholderOptionEl = document.createElement('option');
      placeholderOptionEl.value = '';
      placeholderOptionEl.textContent = placeholder;
      selectEl.appendChild(placeholderOptionEl);
    }
    items.forEach((item) => {
      const optionEl = document.createElement('option');
      optionEl.value = item.code;
      optionEl.textContent = `${item.label} (${item.code})`;
      optionEl.selected = item.code === selectedCode;
      selectEl.appendChild(optionEl);
    });
  };

  const renderLayoutList = () => {
    layoutListEl.innerHTML = '';
    config.layouts.forEach((layoutConfig, layoutIndex) => {
      const fragment = layoutRowTemplateEl.content.cloneNode(true);
      const rowEl = fragment.querySelector('.js-layout-row');
      const headingTextEl = rowEl.querySelector('.js-layout-heading-text');
      const spaceEl = rowEl.querySelector('.js-layout-space');
      const removeEl = rowEl.querySelector('.js-layout-remove');
      const tabListEl = rowEl.querySelector('.js-tab-list');
      const tabAddButtonEl = rowEl.querySelector('.js-tab-add');

      // 見出しに選択中のアンカー(スペースフィールド)のラベルを表示し、複数のタブグループが
      // あるときにどれがどのスペースに対応するか一目で分かるようにする(UXフィードバック対応)。
      const updateHeadingText = () => {
        const selectedItem = spaceItems.find(
          (item) => item.code === layoutConfig.spaceElementId,
        );
        headingTextEl.textContent = selectedItem
          ? `タブグループ — ${selectedItem.label} (${selectedItem.code})`
          : 'タブグループ(表示場所が未選択)';
      };

      const renderTabList = () => {
        tabListEl.innerHTML = '';
        layoutConfig.tabs.forEach((tab, tabIndex) => {
          const tabFragment = tabRowTemplateEl.content.cloneNode(true);
          const labelEl = tabFragment.querySelector('.js-tab-label');
          const defaultRadioEl = tabFragment.querySelector('.js-tab-default');
          const removeTabEl = tabFragment.querySelector('.js-tab-remove');
          const itemListEl = tabFragment.querySelector('.js-item-list');
          const itemAddButtonEl = tabFragment.querySelector('.js-item-add');

          const renderItemList = () => {
            itemListEl.innerHTML = '';
            tab.itemCodes.forEach((itemCode, itemIndex) => {
              const itemFragment = itemRowTemplateEl.content.cloneNode(true);
              const itemSelectEl =
                itemFragment.querySelector('.js-item-select');
              const removeItemEl =
                itemFragment.querySelector('.js-item-remove');

              buildOptions(
                itemSelectEl,
                selectableItems,
                itemCode,
                '(選択してください)',
              );

              itemSelectEl.addEventListener('change', () => {
                tab.itemCodes[itemIndex] = itemSelectEl.value;
              });
              removeItemEl.addEventListener('click', () => {
                tab.itemCodes.splice(itemIndex, 1);
                renderItemList();
              });

              itemListEl.appendChild(itemFragment);
            });
          };

          labelEl.value = tab.label || '';
          // 既定タブはタブごとのラジオボタンで選ぶ(数値インデックス入力は分かりにくいという
          // フィードバックへの対応)。同じタブグループ内でのみ排他選択されるよう、name属性を
          // layoutIndexでスコープする。
          defaultRadioEl.name = `js-layout-${layoutIndex}-default-tab`;
          defaultRadioEl.checked =
            tabIndex === (layoutConfig.defaultTabIndex || 0);
          renderItemList();

          labelEl.addEventListener('input', () => {
            tab.label = labelEl.value;
          });
          defaultRadioEl.addEventListener('change', () => {
            layoutConfig.defaultTabIndex = tabIndex;
          });
          removeTabEl.addEventListener('click', () => {
            layoutConfig.tabs.splice(tabIndex, 1);
            renderTabList();
          });
          itemAddButtonEl.addEventListener('click', () => {
            tab.itemCodes.push('');
            renderItemList();
          });

          tabListEl.appendChild(tabFragment);
        });
      };

      buildOptions(
        spaceEl,
        spaceItems,
        layoutConfig.spaceElementId,
        spaceItems.length === 0
          ? '(スペースフィールドがありません)'
          : '(選択してください)',
      );
      updateHeadingText();
      renderTabList();

      spaceEl.addEventListener('change', () => {
        layoutConfig.spaceElementId = spaceEl.value;
        updateHeadingText();
      });
      removeEl.addEventListener('click', () => {
        config.layouts.splice(layoutIndex, 1);
        renderLayoutList();
      });
      tabAddButtonEl.addEventListener('click', () => {
        layoutConfig.tabs.push({ label: '', itemCodes: [] });
        renderTabList();
      });

      layoutListEl.appendChild(fragment);
    });
  };
  renderLayoutList();

  layoutAddButtonEl.addEventListener('click', () => {
    config.layouts.push({ spaceElementId: '', defaultTabIndex: 0, tabs: [] });
    renderLayoutList();
  });

  cancelButtonEl.addEventListener('click', () => {
    window.location.href = '../../' + kintone.app.getId() + '/plugin/';
  });

  formEl.addEventListener('submit', (e) => {
    e.preventDefault();

    const validation = NS.ConfigValidation.validateLayouts(config.layouts);
    if (!validation.valid) {
      // 設定画面でアプリ管理者自身が選択・入力した値の検証結果(フィールドコードやタブラベル)のみを
      // 表示しており、外部からの入力ではないが、念のためinnerHTMLではなくtextContentで出力する。
      errorsEl.textContent = validation.errors.join('\n');
      return;
    }
    errorsEl.textContent = '';

    kintone.plugin.app.setConfig(NS.ConfigStore.serialize(config), () => {
      alert('プラグインの設定を保存しました。アプリを更新してください。');
      window.location.href = '../../flow?app=' + kintone.app.getId();
    });
  });
})(kintone.$PLUGIN_ID);
