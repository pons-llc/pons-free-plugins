(function (root) {
  'use strict';

  // 添付ファイルフィールドの値(kintone REST APIのレコード更新)を組み立てる純粋関数。
  // 添付ファイルフィールドの更新はPUT(全置換)のため、既存のファイルを残したい場合は
  // 既存分のfileKeyも一緒に指定し直す必要がある(kintone公式ドキュメントの
  // 「1件のレコードを更新するAPI/添付ファイルフィールドを更新するとき」参照)。
  // レコード取得時に得られるfileKeyは「ダウンロード専用」だが、既存ファイルを保持したまま
  // 更新するリクエストのvalueに指定する用途では、そのfileKeyをそのまま再指定してよい
  // (ドキュメントのサンプルもこの方式)。新規にアップロードしたファイルのfileKeyのみ、
  // アップロードAPI(/k/v1/file.json)のレスポンスで取得したものを使う。
  const buildUpdatedFileFieldValue = (existingFiles, newFileKey) => {
    const existingFileKeys = (existingFiles || []).map((file) => ({
      fileKey: file.fileKey,
    }));
    return { value: [...existingFileKeys, { fileKey: newFileKey }] };
  };

  // ファイル名は「固定テキスト+タイムスタンプ」で組み立てる(ユーザー指示「ファイル保存時の
  // 名称は固定テキスト+タイムスタンプ。configで設定できるように」)。固定テキストはconfig画面で
  // 設定できるが、空欄の場合は「帳票」を既定値として使う(config-store.jsのDEFAULTSと同じ値)。
  // タイムスタンプはYYYYMMDDHHmmss形式(区切り記号はファイル名として避けたいスラッシュ・
  // コロンを含まない)。
  const pad2 = (value) => String(value).padStart(2, '0');
  const formatTimestampForFileName = (date) =>
    `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}${pad2(date.getHours())}${pad2(date.getMinutes())}${pad2(date.getSeconds())}`;

  const buildAttachmentFileName = (fileNamePrefix, date) => {
    const prefix = (fileNamePrefix || '').trim() || '帳票';
    return `${prefix}_${formatTimestampForFileName(date)}.pdf`;
  };

  const AttachmentField = {
    buildUpdatedFileFieldValue,
    buildAttachmentFileName,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = AttachmentField;
  } else {
    root.ReportPromptBuilder = root.ReportPromptBuilder || {};
    root.ReportPromptBuilder.AttachmentField = AttachmentField;
  }
})(typeof window !== 'undefined' ? window : globalThis);
