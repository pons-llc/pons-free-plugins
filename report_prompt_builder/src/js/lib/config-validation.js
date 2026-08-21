(function (root) {
  'use strict';

  const MIN_FONT_SIZE_PT = 6;
  const MAX_FONT_SIZE_PT = 72;
  const GRID_COLUMNS = 12;
  const MAX_ROW_PADDING_PX = 100;
  // kintoneのプラグイン設定保存は「プラグイン全体で合計256KBまで」(公式ドキュメントで確認済み)。
  // 実際のバイト数ではなく文字数での概算だが(日本語の説明文はUTF-8で1文字3バイト程度になり
  // 過小評価するが、サイズの大半を占めるのは画像のbase64=ASCIIなのでほぼ実態に近い)、
  // 256KBに対して十分な安全マージンを残した自前の上限として200,000文字を採用する。
  const MAX_TOTAL_CONFIG_SIZE = 200000;

  // TEXT/IMAGE項目はフィールドに紐付かずlabelを持たないため、エラーメッセージ用の表示名を
  // 別途用意する。
  const displayName = (item) => {
    if (item.kind === 'TEXT') {
      return '自由テキスト';
    }
    if (item.kind === 'IMAGE') {
      return '画像';
    }
    return item.label;
  };

  const validateItemBounds = (item, pageNo, errors, images) => {
    const name = displayName(item);
    if (!(item.colStart >= 1 && item.colStart <= GRID_COLUMNS)) {
      errors.push(
        `${pageNo}ページ目: 「${name}」の開始列は1〜12の範囲で指定してください。`,
      );
    }
    if (!(item.colSpan >= 1 && item.colSpan <= GRID_COLUMNS)) {
      errors.push(
        `${pageNo}ページ目: 「${name}」の幅は1〜12の範囲で指定してください。`,
      );
    }
    if (item.colStart + item.colSpan - 1 > GRID_COLUMNS) {
      errors.push(
        `${pageNo}ページ目: 「${name}」が12列を超えてはみ出しています。開始列・幅を見直してください。`,
      );
    }
    // IMAGE項目は文字を扱わないため文字サイズの対象外。TABLE項目は文字サイズを項目全体ではなく
    // 列ごとに持つため(ユーザー指示「テーブルのフィールドも通常フィールド同様に...表示できる
    // ように」)、下のcolumns側のチェックに委ねる。
    if (
      item.kind !== 'IMAGE' &&
      item.kind !== 'TABLE' &&
      !(
        item.fontSizePt >= MIN_FONT_SIZE_PT &&
        item.fontSizePt <= MAX_FONT_SIZE_PT
      )
    ) {
      errors.push(
        `${pageNo}ページ目: 「${name}」の文字サイズは${MIN_FONT_SIZE_PT}〜${MAX_FONT_SIZE_PT}ptの範囲で指定してください。`,
      );
    }
    if (item.kind === 'TABLE') {
      const columns = item.columns || [];
      if (columns.length === 0) {
        errors.push(
          `${pageNo}ページ目: テーブル「${name}」の列を1つ以上選択してください。`,
        );
      }
      columns.forEach((column) => {
        if (!(
          column.fontSizePt >= MIN_FONT_SIZE_PT &&
          column.fontSizePt <= MAX_FONT_SIZE_PT
        )) {
          errors.push(
            `${pageNo}ページ目: テーブル「${name}」の列「${column.label}」の文字サイズは${MIN_FONT_SIZE_PT}〜${MAX_FONT_SIZE_PT}ptの範囲で指定してください。`,
          );
        }
      });
    }
    if (item.kind === 'TEXT' && !(item.text || '').trim()) {
      errors.push(`${pageNo}ページ目: 自由テキストの内容を入力してください。`);
    }
    if (item.kind === 'IMAGE' && !(item.imageId && images[item.imageId])) {
      errors.push(`${pageNo}ページ目: 画像が設定されていません。`);
    }
  };

  const rangesOverlap = (a, b) => {
    const aEnd = a.colStart + a.colSpan - 1;
    const bEnd = b.colStart + b.colSpan - 1;
    return a.colStart <= bEnd && b.colStart <= aEnd;
  };

  const validateRowPadding = (rowPadding, pageNo, errors) => {
    Object.entries(rowPadding || {}).forEach(([rowNumber, padding]) => {
      if (!(padding >= 0 && padding <= MAX_ROW_PADDING_PX)) {
        errors.push(
          `${pageNo}ページ目: 行${rowNumber}の上下の余白は0〜${MAX_ROW_PADDING_PX}pxの範囲で指定してください。`,
        );
      }
    });
  };

  // IMAGE項目(社印・ロゴ)は、他の項目の上に重ねて配置できるようにする(ユーザー指示
  // 「画像は被せられる用にしたい」)。そのため重なりチェックの対象から常に除外する。
  const validateRowOverlaps = (items, pageNo, errors) => {
    const byRow = {};
    items
      .filter((item) => item.kind !== 'IMAGE')
      .forEach((item) => {
        byRow[item.row] = byRow[item.row] || [];
        byRow[item.row].push(item);
      });

    Object.values(byRow).forEach((rowItems) => {
      for (let i = 0; i < rowItems.length; i += 1) {
        for (let j = i + 1; j < rowItems.length; j += 1) {
          if (rangesOverlap(rowItems[i], rowItems[j])) {
            errors.push(
              `${pageNo}ページ目: 「${displayName(rowItems[i])}」と「${displayName(rowItems[j])}」の列が同じ行で重なっています。`,
            );
          }
        }
      }
    });
  };

  // kintoneのプラグイン設定保存の合計256KB上限に対する簡易チェック(文字数ベースの概算)。
  const validateTotalConfigSize = (config, errors) => {
    const imagesSize = Object.values(config.images || {}).reduce(
      (sum, dataUrl) => sum + (dataUrl ? dataUrl.length : 0),
      0,
    );
    const totalSize =
      JSON.stringify(config.outputModes || {}).length +
      JSON.stringify(config.pages || []).length +
      imagesSize;

    if (totalSize > MAX_TOTAL_CONFIG_SIZE) {
      errors.push(
        `設定全体のサイズが上限を超えています(kintoneのプラグイン設定は保存できる容量に上限があります)。画像を削除するか、より小さい画像に差し替えてください。`,
      );
    }
  };

  // 個別出力時にPDFを添付ファイルフィールドへ保存する機能は任意(既定は無効。ユーザー指示
  // 「添付ファイルフィールドに保存するかは選択制にしてね」)。有効にした場合のみ、保存先の
  // フィールドが選択されていることを保存前に確認する。
  const validateSaveToAttachment = (saveToAttachment, errors) => {
    if (!saveToAttachment || !saveToAttachment.enabled) {
      return;
    }
    if (!saveToAttachment.fieldCode) {
      errors.push(
        '帳票の保存先となる添付ファイルフィールドを選択してください。',
      );
    }
  };

  // idea.md「グリッド配置」に対応する保存前チェック。
  const validateConfig = (config) => {
    const errors = [];
    const images = config.images || {};

    const outputModes = config.outputModes || {};
    if (!outputModes.individual && !outputModes.bulk) {
      errors.push(
        '出力方法(個別出力・一括出力)を少なくとも1つ有効にしてください。',
      );
    }

    validateSaveToAttachment(config.saveToAttachment, errors);

    const pages = Array.isArray(config.pages) ? config.pages : [];
    if (pages.length === 0) {
      errors.push('ページを1つ以上追加してください。');
    }

    pages.forEach((page, index) => {
      const pageNo = index + 1;
      const items = Array.isArray(page.items) ? page.items : [];

      if (items.length === 0) {
        errors.push(
          `${pageNo}ページ目: フィールド・テーブル・自由テキストのいずれかを1つ以上配置してください。`,
        );
        return;
      }

      items.forEach((item) => validateItemBounds(item, pageNo, errors, images));
      validateRowOverlaps(items, pageNo, errors);
      validateRowPadding(page.rowPadding, pageNo, errors);
    });

    validateTotalConfigSize(config, errors);

    return { valid: errors.length === 0, errors };
  };

  const ConfigValidation = { validateConfig };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConfigValidation;
  } else {
    root.ReportPromptBuilder = root.ReportPromptBuilder || {};
    root.ReportPromptBuilder.ConfigValidation = ConfigValidation;
  }
})(typeof window !== 'undefined' ? window : globalThis);
