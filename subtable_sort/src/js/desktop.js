(function (global, kintone) {
  'use strict';

  const NS = global.SubtableSort;
  const PLUGIN_ID = kintone.$PLUGIN_ID;

  // このプラグインの設定はレコード画面の表示中には変わらないため、画面読み込み時に一度だけ読み込む。
  const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  const submitRules = config.rules.filter(
    (rule) => rule.triggerMode === 'SUBMIT',
  );
  const manualRules = config.rules.filter(
    (rule) => rule.triggerMode === 'MANUAL',
  );

  // SUBMITモード: 保存直前にサブテーブルをソートする(idea.mdの「発動タイミング」参照)。
  const applySubmitSort = (record) => {
    submitRules.forEach((rule) => {
      const subtableField = record[rule.subtableFieldCode];
      if (!subtableField || !Array.isArray(subtableField.value)) {
        return;
      }
      subtableField.value = NS.SortComparator.sortRows(
        subtableField.value,
        rule.sortKeys,
      );
    });
  };

  kintone.events.on(
    ['app.record.create.submit', 'app.record.edit.submit'],
    (event) => {
      applySubmitSort(event.record);
      return event;
    },
  );

  // MANUALモード: 画面表示のたびにソート済フィールドを「未」へリセットする
  // (idea.mdの「ソート済フィールド」参照)。
  kintone.events.on(
    ['app.record.create.show', 'app.record.edit.show'],
    (event) => {
      manualRules.forEach((rule) => {
        const flagField = rule.sortedFlagFieldCode
          ? event.record[rule.sortedFlagFieldCode]
          : undefined;
        if (flagField) {
          flagField.value = NS.FlagValues.PENDING;
        }
      });

      // MANUALモードのソート実行ボタンをヘッダーメニュー領域に描画する(kintone.events.on()の
      // イベントハンドラー内ではkintone.app.record.set()が使えないため、ボタンのクリックリスナーは
      // イベントハンドラーの外(通常のDOMイベント)として登録する)。
      if (manualRules.length > 0) {
        const headerEl = kintone.app.record.getHeaderMenuSpaceElement();
        if (headerEl) {
          headerEl.innerHTML = '';
          manualRules.forEach((rule) => {
            const buttonEl = document.createElement('button');
            buttonEl.type = 'button';
            buttonEl.className = 'sts-sort-button kintoneplugin-button-normal';
            buttonEl.textContent = 'サブテーブルをソート';
            buttonEl.addEventListener('click', async () => {
              const { record } = await kintone.app.record.get();
              const subtableField = record[rule.subtableFieldCode];
              if (subtableField && Array.isArray(subtableField.value)) {
                subtableField.value = NS.SortComparator.sortRows(
                  subtableField.value,
                  rule.sortKeys,
                );
              }
              const flagField = rule.sortedFlagFieldCode
                ? record[rule.sortedFlagFieldCode]
                : undefined;
              if (flagField) {
                flagField.value = NS.FlagValues.DONE;
              }
              await kintone.app.record.set({ record });
            });
            headerEl.appendChild(buttonEl);
          });
        }
      }

      return event;
    },
  );
})(window, kintone);
