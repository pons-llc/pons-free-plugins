(function (global, kintone) {
  'use strict';

  const NS = global.StatusArrow;
  const PLUGIN_ID = kintone.$PLUGIN_ID;

  // プロセス管理のステータスは、フィールドコードではなく固定のフィールド名でアクセスする
  // (idea.mdの「対象フィールド」参照、kintone公式ドキュメントの仕様)。
  const STATUS_FIELD_NAME = 'ステータス';

  // このプラグインの設定はレコード画面の表示中には変わらないため、画面読み込み時に一度だけ読み込む。
  const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  const currentValueOf = (widget, record) => {
    const fieldCode =
      widget.sourceType === 'STATUS' ? STATUS_FIELD_NAME : widget.fieldCode;
    const field = record[fieldCode];
    return field ? field.value : '';
  };

  // 1つのウィジェットの矢羽根UIを描画する。
  const renderWidget = (widget, containerEl, record) => {
    const widgetEl = document.createElement('div');
    widgetEl.className =
      'sta-widget ' + NS.DesignPreset.resolveDesignClass(widget.design);

    const currentValue = currentValueOf(widget, record);
    const arrowStates = NS.ArrowState.computeArrowStates(
      widget.steps,
      currentValue,
    );

    arrowStates.forEach((arrow) => {
      const arrowEl = document.createElement('span');
      arrowEl.className = 'sta-arrow sta-arrow-' + arrow.state.toLowerCase();
      // ステップ名はアプリ管理者が設定画面で選んだ選択肢文字列(またはプロセス管理のステータス名)なので、
      // innerHTMLではなくtextContentで描画する(security-checklist.mdのXSS対策参照)。
      arrowEl.textContent = arrow.value;
      widgetEl.appendChild(arrowEl);
    });

    containerEl.appendChild(widgetEl);
  };

  const renderAllWidgets = (record) => {
    const headerEl = kintone.app.record.getHeaderMenuSpaceElement();
    // 対応していない画面、またはヘッダーメニュー領域が取得できない場合は何もしない
    // (画面をクラッシュさせない)。
    if (!headerEl) {
      return;
    }
    headerEl.innerHTML = '';

    const containerEl = document.createElement('div');
    containerEl.className = 'sta-container';
    config.widgets.forEach((widget) => {
      renderWidget(widget, containerEl, record);
    });
    headerEl.appendChild(containerEl);
  };

  // kintone.app.record.getHeaderMenuSpaceElement()が利用できる画面(レコード詳細・追加・編集画面、
  // PC専用)で発動する(idea.mdの「発動する画面・モバイル対応」参照)。
  kintone.events.on(
    [
      'app.record.create.show',
      'app.record.edit.show',
      'app.record.detail.show',
    ],
    (event) => {
      renderAllWidgets(event.record);
      return event;
    },
  );
})(window, kintone);
