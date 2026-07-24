(function (root) {
  'use strict';

  // 削除されるレコードのバックアップ用JSON(zipの`record.json`、またはアーカイブ先アプリの
  // JSON保存先フィールドの値)を組み立てる。record自体はイベントオブジェクトの生の値をそのまま
  // 保持する(フィールドごとのtype情報を含む、REST APIの「フィールド形式」と同じ形)。
  const buildBackupPayload = ({ appId, recordId, record, deletedAt }) =>
    JSON.stringify({ appId, recordId, deletedAt, record }, null, 2);

  const BackupPayload = { buildBackupPayload };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = BackupPayload;
  } else {
    root.DeleteBackup = root.DeleteBackup || {};
    root.DeleteBackup.BackupPayload = BackupPayload;
  }
})(typeof window !== 'undefined' ? window : globalThis);
