(function (root) {
  'use strict';

  // イベントオブジェクトのrecord(REST APIの「フィールド形式」と同じ形)から、type === 'FILE'の
  // 全フィールドの全ファイルを、フィールドコード付きのフラットな配列として抽出する。
  // レコード内のフィールドの並び順(Object.entriesの列挙順)をそのまま維持する。
  const collectFileFields = (record) => {
    if (!record) {
      return [];
    }
    const result = [];
    Object.entries(record).forEach(([fieldCode, field]) => {
      if (!field || field.type !== 'FILE') {
        return;
      }
      (field.value || []).forEach((file) => {
        result.push({
          fieldCode,
          fileKey: file.fileKey,
          name: file.name,
          contentType: file.contentType,
          size: file.size,
        });
      });
    });
    return result;
  };

  const CollectFileFields = { collectFileFields };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CollectFileFields;
  } else {
    root.DeleteBackup = root.DeleteBackup || {};
    root.DeleteBackup.CollectFileFields = CollectFileFields;
  }
})(typeof window !== 'undefined' ? window : globalThis);
