(function (root) {
  'use strict';

  // report-model.jsが組み立てた表示モデルを、実際のdocumentへcreateElement/textContentのみで
  // 描画する(secureCodingGuideline.mdの「innerHTMLではなくtextContent」を徹底、文字列結合による
  // HTML組み立ては一切行わない)。kintone非依存だがDOM(documentオブジェクト)には依存するため、
  // config.js/desktop.js同様にJestでのユニットテスト対象外とする(idea.md参照)。
  //
  // A4縦固定(ユーザー確認済み: 「A4縦固定でいい」)。ページサイズ・向きの選択肢は持たない。
  const REPORT_CSS = `@page {
  size: A4 portrait;
  margin: 12mm;
}
body {
  font-family: "Hiragino Kaku Gothic ProN", "Yu Gothic", "Meiryo", sans-serif;
  color: #222;
  background: #fff;
  margin: 0;
}
/* 外枠(ボーダー)は付けない(ユーザー指示)。画面上でページの境目が分かるよう、印刷されない
   ごく薄い影だけを付ける(box-shadowは既定で印刷されないため、印刷結果には影響しない)。 */
.report-page {
  box-sizing: border-box;
  width: 190mm;
  margin: 0 auto 16px;
  padding: 8mm;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.08), 0 2px 6px rgba(0, 0, 0, 0.08);
}
@media print {
  .report-page {
    box-shadow: none;
    page-break-after: always;
  }
  .report-page:last-child {
    page-break-after: auto;
  }
}
.report-row {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
}
.report-cell {
  /* grid-rowを明示しないと、列位置が重なる項目(画像を他の項目に重ねて配置した場合)を
     ブラウザの自動配置が「衝突」とみなし、暗黙のうちに次のグリッド行へ送ってしまい
     重ね描画にならない。.report-rowは常に1行分のグリッドなので、常に1行目に固定する。 */
  grid-row: 1;
  box-sizing: border-box;
  padding: 6px 8px;
  min-height: 2.6em;
  display: flex;
}
.report-cell-bordered {
  border: 1px solid #666;
}
.report-cell-label-top {
  flex-direction: column;
}
.report-cell-label-left {
  flex-direction: row;
  align-items: stretch;
}
.report-cell-label {
  color: #555;
  flex-shrink: 0;
}
.report-cell-label-top .report-cell-label {
  font-size: 8pt;
  margin-bottom: 2px;
}
.report-cell-label-left .report-cell-label {
  font-size: 9pt;
  margin-right: 8px;
  white-space: nowrap;
  display: flex;
  align-items: center;
}
/* ラベルが横並び、かつ枠線ありのときだけ、ラベルと値の間に区切り線を入れる
   (ユーザー指示)。枠線なしのときは区切り線も出さない。 */
.report-cell-bordered.report-cell-label-left .report-cell-label {
  border-right: 1px solid #666;
  padding-right: 8px;
}
.report-cell-value {
  display: block;
  flex: 1;
  min-width: 0;
}
.report-cell-label-left .report-cell-value {
  display: flex;
  align-items: center;
}
.report-cell-table {
  padding: 4px;
  display: block;
}
.report-table {
  width: 100%;
  border-collapse: collapse;
  font-size: inherit;
}
/* テーブルが印刷時にページをまたいで分割される場合、列見出し(thead)を次ページの先頭にも
   繰り返し表示させる(表形式の<table>のブラウザ標準挙動。thead/tbodyの役割を明示して
   確実にする)。tr側はbreak-inside:avoidで、1行の途中でページが切り替わって行が分断される
   ことを防ぐ(行単位でまるごと次ページへ送られる)。 */
.report-table thead {
  display: table-header-group;
}
.report-table tbody {
  display: table-row-group;
}
.report-table tr {
  break-inside: avoid;
}
.report-table th,
.report-table td {
  padding: 8px 10px;
  text-align: left;
}
/* モノトーンで外枠・縦線なしのミニマルな見た目(ユーザー指示・参考画像に準拠)。
   ヘッダーは単色の帯、本文行は縦線を引かず点線の下線だけで区切る。 */
.report-table thead th {
  background: #333;
  color: #fff;
  font-weight: bold;
}
.report-table tbody td {
  border-bottom: 1px dotted #999;
}
/* 背景色は既定の印刷設定では省略されるブラウザが多いため、印刷時もヘッダーの帯を保持する
   指定をしておく(最終的に反映されるかはブラウザの「背景のグラフィックス」設定にも依存する)。 */
.report-table {
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
/* テーブルの列ごとの折返し設定(ユーザー指示「テーブルのフィールドも通常フィールド同様に
   ...折り返し...表示できるように」)。列によって折返し有無を変えられるよう、テーブル全体
   ではなくtd単位でクラスを付与する。 */
.report-table td.report-table-cell-nowrap {
  white-space: nowrap;
}
.report-cell-image img {
  display: block;
  width: 100%;
  height: auto;
}`;

  // 'normal'/'nowrap'は改行文字を空白に潰してしまうため、複数行文字列(MULTI_LINE_TEXTの値・
  // 自由テキストで入力した改行)を保持できるよう'pre-wrap'/'pre'を使う。
  const applyWrapStyle = (el, wrap) => {
    if (wrap) {
      el.style.whiteSpace = 'pre-wrap';
      el.style.overflowWrap = 'break-word';
    } else {
      el.style.whiteSpace = 'pre';
    }
  };

  // labelPosition:LEFT(ラベルが横並び)のFIELDセルは、.report-cell-valueがdisplay:flexに
  // なる(report-dom.jsのCSS参照)。flexコンテナ化された要素にはtext-alignが効かない
  // (揃える先の余白はjustify-contentが担う)ため、text-alignだけを設定していると
  // labelPosition:LEFTのときに限って文字位置(textAlign)が無視されるバグになっていた
  // (ユーザー報告「消費税10％相当分とか合計(税込)が右寄せにならない」)。display:blockの
  // ときはjustify-contentが無視されるだけで無害なので、常に両方設定して両ケースに対応する。
  const TEXT_ALIGN_TO_JUSTIFY_CONTENT = {
    LEFT: 'flex-start',
    CENTER: 'center',
    RIGHT: 'flex-end',
  };
  const applyTextAlignStyle = (el, textAlign) => {
    el.style.textAlign = textAlign.toLowerCase();
    el.style.justifyContent =
      TEXT_ALIGN_TO_JUSTIFY_CONTENT[textAlign] || 'flex-start';
  };

  // 折り返しオフ(1行表示)の値は、セル幅に収まらない場合に文字を1文字も削らず文字サイズだけを
  // 縮小して収める(FIELD/TEXTの単一値のみが対象。TABLEの列は複数セルの兼ね合いが絡み単純な
  // 縮小では済まないため対象外)。要素がまだ描画木に接続されていないとscrollWidth/clientWidthが
  // 正しく取れないため、呼び出し側(appendPage)でdocumentへの接続後にまとめて適用する。
  const shrinkToFitWidth = (el) => {
    if (el.clientWidth === 0 || el.scrollWidth <= el.clientWidth) {
      return;
    }
    const currentFontSizePx = parseFloat(
      el.ownerDocument.defaultView.getComputedStyle(el).fontSize,
    );
    if (!(currentFontSizePx > 0)) {
      return;
    }
    const scale = el.clientWidth / el.scrollWidth;
    el.style.fontSize = `${currentFontSizePx * scale}px`;
  };

  const appendFieldCell = (rowEl, doc, cell, shrinkCandidates) => {
    const cellEl = doc.createElement('div');
    cellEl.className = `report-cell ${
      cell.labelPosition === 'LEFT'
        ? 'report-cell-label-left'
        : 'report-cell-label-top'
    }`;
    if (cell.bordered) {
      cellEl.classList.add('report-cell-bordered');
    }
    cellEl.style.gridColumn = `${cell.colStart} / span ${cell.colSpan}`;

    if (cell.showLabel) {
      const labelEl = doc.createElement('span');
      labelEl.className = 'report-cell-label';
      labelEl.textContent = cell.label;
      cellEl.appendChild(labelEl);
    }

    const valueEl = doc.createElement('span');
    valueEl.className = 'report-cell-value';
    valueEl.style.fontSize = `${cell.fontSizePt}pt`;
    applyTextAlignStyle(valueEl, cell.textAlign);
    valueEl.textContent = cell.text;
    applyWrapStyle(valueEl, cell.wrap);
    if (!cell.wrap) {
      shrinkCandidates.push(valueEl);
    }
    cellEl.appendChild(valueEl);

    rowEl.appendChild(cellEl);
  };

  // テーブルの各列は、通常のFIELD項目と同様に文字pt・折返し・文字位置を列ごとに持つ
  // (ユーザー指示「テーブルのフィールドも通常フィールド同様に...表示できるように」)。
  // ヘッダー(th)は列見出しのみのため文字ptだけ列の設定を反映し、折返し・文字位置は本文(td)側の
  // 設定とする。
  const appendTableCell = (rowEl, doc, cell) => {
    const wrapEl = doc.createElement('div');
    wrapEl.className = 'report-cell report-cell-table';
    if (cell.bordered) {
      wrapEl.classList.add('report-cell-bordered');
    }
    wrapEl.style.gridColumn = `${cell.colStart} / span ${cell.colSpan}`;

    const tableEl = doc.createElement('table');
    tableEl.className = 'report-table';

    const theadEl = doc.createElement('thead');
    const headerRowEl = doc.createElement('tr');
    cell.columns.forEach((column) => {
      const thEl = doc.createElement('th');
      thEl.textContent = column.label;
      thEl.style.fontSize = `${column.fontSizePt}pt`;
      headerRowEl.appendChild(thEl);
    });
    theadEl.appendChild(headerRowEl);

    const tbodyEl = doc.createElement('tbody');
    cell.rows.forEach((rowValues) => {
      const trEl = doc.createElement('tr');
      rowValues.forEach((text, columnIndex) => {
        const column = cell.columns[columnIndex];
        const tdEl = doc.createElement('td');
        tdEl.textContent = text;
        tdEl.style.fontSize = `${column.fontSizePt}pt`;
        tdEl.style.textAlign = column.textAlign.toLowerCase();
        if (!column.wrap) {
          tdEl.classList.add('report-table-cell-nowrap');
        }
        trEl.appendChild(tdEl);
      });
      tbodyEl.appendChild(trEl);
    });

    tableEl.appendChild(theadEl);
    tableEl.appendChild(tbodyEl);
    wrapEl.appendChild(tableEl);
    rowEl.appendChild(wrapEl);
  };

  // 上下位置(ユーザー指示「任意テキストの上下位置も選択したい」)。.report-cellはdisplay:flexで
  // 既定のflex-direction(row)のため、align-itemsがそのまま縦方向の位置を決める。
  const VERTICAL_ALIGN_TO_FLEX_ALIGN_ITEMS = {
    TOP: 'flex-start',
    MIDDLE: 'center',
    BOTTOM: 'flex-end',
  };

  // TEXT: フィールドに紐付かない固定の自由記述テキスト。ラベルの概念が無いため値のみ描画する。
  const appendTextCell = (rowEl, doc, cell, shrinkCandidates) => {
    const cellEl = doc.createElement('div');
    cellEl.className = 'report-cell';
    if (cell.bordered) {
      cellEl.classList.add('report-cell-bordered');
    }
    cellEl.style.gridColumn = `${cell.colStart} / span ${cell.colSpan}`;
    cellEl.style.alignItems =
      VERTICAL_ALIGN_TO_FLEX_ALIGN_ITEMS[cell.verticalAlign] || 'flex-start';

    const valueEl = doc.createElement('span');
    valueEl.className = 'report-cell-value';
    valueEl.style.fontSize = `${cell.fontSizePt}pt`;
    applyTextAlignStyle(valueEl, cell.textAlign);
    valueEl.textContent = cell.text;
    applyWrapStyle(valueEl, cell.wrap);
    if (!cell.wrap) {
      shrinkCandidates.push(valueEl);
    }
    cellEl.appendChild(valueEl);

    rowEl.appendChild(cellEl);
  };

  // IMAGE: 社印・ロゴなど固定の画像。dataUrlは常にconfig.js側でcanvas経由により自前生成した
  // data URLのみで、外部URLや任意文字列をsrcに渡すことはない(secureCodingGuideline.md
  // 「出力するURLはhttp/httpsで始まるものだけ」を踏まえた安全設計。idea.md参照)。
  const appendImageCell = (rowEl, doc, cell) => {
    const cellEl = doc.createElement('div');
    cellEl.className = 'report-cell report-cell-image';
    if (cell.bordered) {
      cellEl.classList.add('report-cell-bordered');
    }
    cellEl.style.gridColumn = `${cell.colStart} / span ${cell.colSpan}`;

    if (cell.dataUrl) {
      const imgEl = doc.createElement('img');
      imgEl.src = cell.dataUrl;
      imgEl.alt = '';
      cellEl.appendChild(imgEl);
    }

    rowEl.appendChild(cellEl);
  };

  const appendCell = (rowEl, doc, cell, shrinkCandidates) => {
    if (cell.kind === 'TABLE') {
      appendTableCell(rowEl, doc, cell);
    } else if (cell.kind === 'TEXT') {
      appendTextCell(rowEl, doc, cell, shrinkCandidates);
    } else if (cell.kind === 'IMAGE') {
      appendImageCell(rowEl, doc, cell);
    } else {
      appendFieldCell(rowEl, doc, cell, shrinkCandidates);
    }
  };

  // 行ごとに独立した12列グリッド(.report-row)として描画する。行をまたいだ1つの巨大なグリッドに
  // せず行単位で分けているのは、行ごとのpadding設定を素直に適用できるようにするため。
  // shrinkCandidates(折り返しオフのFIELD/TEXT値)は、pageElをdocumentへ接続した後でないと
  // scrollWidth/clientWidthが正しく取れないため、ここでまとめて縮小処理を適用する。
  const appendPage = (bodyEl, doc, pageModel) => {
    const pageEl = doc.createElement('div');
    pageEl.className = 'report-page';
    const shrinkCandidates = [];

    pageModel.rows.forEach((row) => {
      const rowEl = doc.createElement('div');
      rowEl.className = 'report-row';
      // 行の余白は上下のみ(ユーザー指示)。左右まで空けると12列グリッドの列位置が
      // ページ全体の列基準からズレて見えるため。
      rowEl.style.padding = `${row.padding}px 0`;
      row.cells.forEach((cell) =>
        appendCell(rowEl, doc, cell, shrinkCandidates),
      );
      pageEl.appendChild(rowEl);
    });

    bodyEl.appendChild(pageEl);
    shrinkCandidates.forEach(shrinkToFitWidth);
  };

  // pageModels: report-model.jsのbuildPageModel()の戻り値の配列。1レコード分は
  // 「ページ構成の全ページ」、複数レコード分(一括出力)はレコードごとに全ページを繰り返したもの。
  const renderReportDocument = (doc, pageModels) => {
    doc.title = '帳票';
    const styleEl = doc.createElement('style');
    styleEl.textContent = REPORT_CSS;
    doc.head.appendChild(styleEl);
    pageModels.forEach((pageModel) => appendPage(doc.body, doc, pageModel));
  };

  const ReportDom = { renderReportDocument, REPORT_CSS };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ReportDom;
  } else {
    root.ReportPromptBuilder = root.ReportPromptBuilder || {};
    root.ReportPromptBuilder.ReportDom = ReportDom;
  }
})(typeof window !== 'undefined' ? window : globalThis);
