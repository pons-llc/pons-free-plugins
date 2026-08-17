(function (global, kintone) {
  'use strict';

  const NS = global.CrossAppCheck;

  // ファイルのアップロード/ダウンロードAPIは、kintone公式ドキュメントで明示的に
  // `kintone.api()`が非対応と記載されている(「このAPIは、kintone REST APIリクエストを
  // 送信するAPIでは実行できません」)。そのためこの2箇所だけ、同一オリジン(kintone自身)への
  // fetchを直接使う。外部ドメインへの通信は一切行わない(CLAUDE.md開発方針9)。
  const fileUrl = () => kintone.api.url('/k/v1/file.json', true);

  // 突合結果のJSONを一時保管領域へアップロードし、添付用のfileKeyを得る
  const uploadJson = async (jsonText, fileName) => {
    const blob = new Blob([jsonText], { type: 'application/json' });
    const formData = new FormData();
    // POSTなのでCSRFトークンが必要
    formData.append('__REQUEST_TOKEN__', kintone.getRequestToken());
    formData.append('file', blob, fileName);

    const resp = await fetch(fileUrl(), {
      method: 'POST',
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
      body: formData,
    });
    if (!resp.ok) {
      throw new Error(
        `結果ファイルのアップロードに失敗しました(status: ${resp.status})。`,
      );
    }
    const data = await resp.json();
    return data.fileKey;
  };

  // 添付済みの結果JSONを読み出す。
  // ここで返る文字列は「人が差し替えられる入力」なので、
  // 呼び出し元は必ず ResultSchema.parse() を通してから描画すること。
  const downloadText = async (fileKey) => {
    const resp = await fetch(
      `${fileUrl()}?fileKey=${encodeURIComponent(fileKey)}`,
      {
        method: 'GET',
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      },
    );
    if (!resp.ok) {
      throw new Error(
        `結果ファイルの読み込みに失敗しました(status: ${resp.status})。`,
      );
    }
    return resp.text();
  };

  // 画面から手元へCSVを保存させる
  const triggerTextDownload = (text, fileName, mimeType) => {
    const blob = new Blob([text], {
      type: mimeType || 'text/plain;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const anchorEl = document.createElement('a');
    anchorEl.href = url;
    anchorEl.download = fileName;
    document.body.appendChild(anchorEl);
    anchorEl.click();
    document.body.removeChild(anchorEl);
    URL.revokeObjectURL(url);
  };

  NS.FileClient = {
    uploadJson,
    downloadText,
    triggerTextDownload,
  };
})(typeof window !== 'undefined' ? window : globalThis, kintone);
