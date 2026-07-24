(function (global, kintone) {
  'use strict';

  const NS = global.DeleteBackup;
  const PLUGIN_ID = kintone.$PLUGIN_ID;

  const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  // ファイルのアップロード/ダウンロードAPIはkintone公式ドキュメントで明示的に`kintone.api()`が
  // 非対応と記載されているため、この2箇所のみ同一オリジン(kintone自身)へのfetchを直接使う
  // (CLAUDE.md開発方針3、外部ドメインへの送信は一切行わない)。
  const fetchFileBlob = async (fileKey) => {
    const resp = await fetch(
      `/k/v1/file.json?fileKey=${encodeURIComponent(fileKey)}`,
      {
        method: 'GET',
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      },
    );
    if (!resp.ok) {
      throw new Error(
        `ファイルのダウンロードに失敗しました(fileKey: ${fileKey}, status: ${resp.status})`,
      );
    }
    return resp.blob();
  };

  // ダウンロードしたBlobを一時保管領域へ再アップロードし、新しい一時fileKeyを得る
  // (レコード取得由来のfileKeyはアップロードに使えないため。idea.md「添付ファイルの扱いに関する
  // 重要な制約」参照)。
  const uploadFileBlob = async (blob, filename) => {
    const formData = new FormData();
    formData.append('__REQUEST_TOKEN__', kintone.getRequestToken());
    formData.append('file', blob, filename);
    const resp = await fetch('/k/v1/file.json', {
      method: 'POST',
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
      body: formData,
    });
    if (!resp.ok) {
      throw new Error(
        `ファイルの再アップロードに失敗しました(${filename}, status: ${resp.status})`,
      );
    }
    const data = await resp.json();
    return data.fileKey;
  };

  const registerArchiveRecord = (appId, record) =>
    kintone.api(kintone.api.url('/k/v1/record.json', true), 'POST', {
      app: appId,
      record,
    });

  const triggerZipDownload = (bytes, filename) => {
    const blob = new Blob([bytes], { type: 'application/zip' });
    const url = URL.createObjectURL(blob);
    const anchorEl = document.createElement('a');
    anchorEl.href = url;
    anchorEl.download = filename;
    document.body.appendChild(anchorEl);
    anchorEl.click();
    anchorEl.remove();
    // Blob URLはダウンロード開始後も参照され続けるため、即座にrevokeせず次のイベントループまで待つ。
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const runZipBackup = async (event, files, backupJson) => {
    const downloaded = [];
    for (const file of files) {
      const blob = await fetchFileBlob(file.fileKey);
      downloaded.push({ ...file, blob });
    }
    const named = NS.BuildZipEntryNames.buildZipEntryNames(downloaded);

    const entries = [
      { name: 'record.json', data: new TextEncoder().encode(backupJson) },
    ];
    for (const file of named) {
      const buffer = await file.blob.arrayBuffer();
      entries.push({ name: file.entryName, data: new Uint8Array(buffer) });
    }

    const zipBytes = NS.BuildZip.buildZip(entries);
    triggerZipDownload(
      zipBytes,
      `backup_app${event.appId}_record${event.recordId}.zip`,
    );
  };

  const runArchiveBackup = async (files, backupJson) => {
    const uploadedFiles = [];
    for (const file of files) {
      const blob = await fetchFileBlob(file.fileKey);
      const newFileKey = await uploadFileBlob(blob, file.name);
      uploadedFiles.push({ fileKey: newFileKey });
    }

    const record = {
      [config.jsonFieldCode]: { value: backupJson },
      [config.attachmentFieldCode]: { value: uploadedFiles },
    };
    await registerArchiveRecord(config.archiveAppId, record);
  };

  // 削除の直前(保存前)に発火するイベント。バックアップに失敗した場合はevent.errorを設定して
  // 削除処理そのものをキャンセルする(「削除はできたがバックアップは失敗した」状態を作らない、
  // idea.md参照)。両画面(詳細/一覧)で同じ形のイベントオブジェクト(type/appId/recordId/record)
  // が発火する(kintoneドキュメントMCPで確認済み)。
  const handleDeleteSubmit = async (event) => {
    kintone.showLoading('VISIBLE');
    try {
      const files = NS.CollectFileFields.collectFileFields(event.record);
      const backupJson = NS.BackupPayload.buildBackupPayload({
        appId: event.appId,
        recordId: event.recordId,
        record: event.record,
        deletedAt: new Date().toISOString(),
      });

      if (config.mode === 'archive') {
        await runArchiveBackup(files, backupJson);
      } else {
        await runZipBackup(event, files, backupJson);
      }

      return event;
    } catch (err) {
      event.error = `削除バックアップに失敗したため、削除を中止しました: ${
        (err && err.message) || err
      }`;
      return event;
    } finally {
      kintone.showLoading('HIDDEN');
    }
  };

  kintone.events.on(
    ['app.record.detail.delete.submit', 'app.record.index.delete.submit'],
    handleDeleteSubmit,
  );
})(window, kintone);
