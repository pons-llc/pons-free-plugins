(function (root) {
  'use strict';

  const FieldValueFormatter =
    typeof module !== 'undefined' && module.exports
      ? require('./field-value-formatter')
      : root.ReportPromptBuilder.FieldValueFormatter;

  // ページの配置データ(グリッド上のFIELD/TABLE項目)と1レコード分のkintoneレコードオブジェクトから、
  // 実際に画面へ描画するための構造(行ごとにグルーピングし、値を整形済みにしたモデル)を組み立てる
  // 純粋関数。DOM操作は一切行わない(report-dom.jsが、この戻り値を使ってDOMを組み立てる)。
  // 以前はここを生成AIに任せていたが、グリッド座標と項目情報だけで決定論的に組み立てられるように
  // なったため、AIを介さずこのプラグイン自身で完結させる(idea.md参照)。

  const VALID_TEXT_ALIGNS = ['LEFT', 'CENTER', 'RIGHT'];
  const normalizeTextAlign = (value) =>
    VALID_TEXT_ALIGNS.includes(value) ? value : 'LEFT';

  // 自由テキストの上下位置(ユーザー指示「任意テキストの上下位置も選択したい」)。
  const VALID_VERTICAL_ALIGNS = ['TOP', 'MIDDLE', 'BOTTOM'];
  const normalizeVerticalAlign = (value) =>
    VALID_VERTICAL_ALIGNS.includes(value) ? value : 'TOP';

  // NUMBER型・数値形式のCALC型(field-catalog.jsのisNumericField判定を配置時に反映した
  // item.isNumeric)は、単位(unit/unitPosition)・桁区切りの表示可否を項目ごとに選べるようにする
  // (ユーザー指示)。それ以外は従来どおりカテゴリ別の整形(formatFieldValue)を使う。
  const buildFieldCell = (item, record) => {
    const field = record ? record[item.code] : undefined;
    const text = item.isNumeric
      ? FieldValueFormatter.formatNumericValue(field, {
          unit: item.unit,
          unitPosition: item.unitPosition,
          showUnit: !!item.showUnit,
          digitGrouping: !!item.digitGrouping,
        })
      : FieldValueFormatter.formatFieldValue(item.type, field);
    return {
      kind: 'FIELD',
      code: item.code,
      label: item.label,
      showLabel: !!item.showLabel,
      fontSizePt: item.fontSizePt,
      wrap: item.wrap,
      bordered: !!item.bordered,
      labelPosition: item.labelPosition === 'LEFT' ? 'LEFT' : 'TOP',
      textAlign: normalizeTextAlign(item.textAlign),
      colStart: item.colStart,
      colSpan: item.colSpan,
      text,
    };
  };

  // テーブルの各列も、通常のFIELD項目と同様に文字pt・折返し・文字位置・単位・桁区切りを
  // 列ごとに選べるようにする(ユーザー指示「テーブルのフィールドも通常フィールド同様に...
  // 表示できるように」)。列の数値判定(column.isNumeric)はbuildFieldCellと同じ考え方。
  const buildTableColumnValue = (column, subtableRow) => {
    const field = subtableRow.value[column.code];
    return column.isNumeric
      ? FieldValueFormatter.formatNumericValue(field, {
          unit: column.unit,
          unitPosition: column.unitPosition,
          showUnit: !!column.showUnit,
          digitGrouping: !!column.digitGrouping,
        })
      : FieldValueFormatter.formatFieldValue(column.type, field);
  };

  const buildTableCell = (item, record) => {
    const subtableField = record ? record[item.code] : undefined;
    const subtableRows = (subtableField && subtableField.value) || [];
    const columns = item.columns || [];

    const rows = subtableRows.map((subtableRow) =>
      columns.map((column) => buildTableColumnValue(column, subtableRow)),
    );

    return {
      kind: 'TABLE',
      code: item.code,
      label: item.label,
      bordered: !!item.bordered,
      colStart: item.colStart,
      colSpan: item.colSpan,
      columns: columns.map((column) => ({
        label: column.label,
        textAlign: normalizeTextAlign(column.textAlign),
        fontSizePt: column.fontSizePt,
        wrap: column.wrap,
      })),
      rows,
    };
  };

  // TEXT: フィールドに紐付かない固定の自由記述テキスト(見出し・注記等)。レコードの値を
  // 参照しないため、record非依存でそのまま表示用テキストとして扱う。
  const buildTextCell = (item) => ({
    kind: 'TEXT',
    text: item.text || '',
    fontSizePt: item.fontSizePt,
    wrap: item.wrap,
    bordered: !!item.bordered,
    textAlign: normalizeTextAlign(item.textAlign),
    verticalAlign: normalizeVerticalAlign(item.verticalAlign),
    colStart: item.colStart,
    colSpan: item.colSpan,
  });

  // IMAGE: レコードの値にもフィールド定義にも紐付かない、社印・ロゴなどの固定画像。実体(dataURL)は
  // 項目自体には持たず、config.imagesにimageIdで参照する(kintoneのプラグイン設定保存が
  // 「1つの値につき最大65,535文字」のため、画像ごとに専用の設定キーを割り当てて保存する設計。
  // idea.md参照)。参照先が無い(孤立した参照・未設定)場合はdataUrl:''を返し、クラッシュしない。
  const buildImageCell = (item, images) => ({
    kind: 'IMAGE',
    dataUrl: (images || {})[item.imageId] || '',
    bordered: !!item.bordered,
    colStart: item.colStart,
    colSpan: item.colSpan,
  });

  const buildCell = (item, record, images) => {
    if (item.kind === 'TABLE') {
      return buildTableCell(item, record);
    }
    if (item.kind === 'TEXT') {
      return buildTextCell(item);
    }
    if (item.kind === 'IMAGE') {
      return buildImageCell(item, images);
    }
    return buildFieldCell(item, record);
  };

  const buildPageModel = (page, record, images) => {
    const items = (page && page.items) || [];
    const rowPadding = (page && page.rowPadding) || {};

    const rowNumbers = Array.from(new Set(items.map((item) => item.row))).sort(
      (a, b) => a - b,
    );

    const rows = rowNumbers.map((rowNumber) => {
      // IMAGE項目は他の項目に重ねて配置できる(ユーザー指示)。DOM上で最後に描画された要素が
      // 手前に表示されるため、同じ行の中でIMAGEを常に最後(=一番手前)にして重ね順を安定させる。
      const rowItems = items
        .filter((item) => item.row === rowNumber)
        .sort((a, b) => {
          const aIsImage = a.kind === 'IMAGE' ? 1 : 0;
          const bIsImage = b.kind === 'IMAGE' ? 1 : 0;
          if (aIsImage !== bIsImage) {
            return aIsImage - bIsImage;
          }
          return a.colStart - b.colStart;
        });
      return {
        row: rowNumber,
        padding: Number(rowPadding[rowNumber]) || 0,
        cells: rowItems.map((item) => buildCell(item, record, images)),
      };
    });

    return { rows };
  };

  const ReportModel = { buildPageModel };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ReportModel;
  } else {
    root.ReportPromptBuilder = root.ReportPromptBuilder || {};
    root.ReportPromptBuilder.ReportModel = ReportModel;
  }
})(typeof window !== 'undefined' ? window : globalThis);
