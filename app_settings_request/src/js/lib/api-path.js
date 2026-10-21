(function (root) {
  'use strict';

  // ゲストスペースのアプリはREST APIのURLが /k/guest/{ゲストスペースID}/v1/... になる
  // (kintone REST APIの共通仕様)。kintone.api.url(path, true)は「今開いているアプリ」の
  // ゲストスペースしか判定できないため、別アプリ用のパスはここで組み立てて kintone.api() に渡す
  // (kintone.api()の第1引数はURLだけでなくパスも受け付ける。plugin_config_backupから改変)。
  const buildApiPath = (path, guestSpaceId) => {
    if (!/^\/k\/v1\//.test(path)) {
      throw new Error(`/k/v1/ で始まるパスを指定してください: ${path}`);
    }
    const id =
      guestSpaceId === undefined || guestSpaceId === null
        ? ''
        : String(guestSpaceId);
    if (!id) {
      return path;
    }
    if (!/^[1-9][0-9]*$/.test(id)) {
      throw new Error(`ゲストスペースIDが正しくありません: ${id}`);
    }
    return path.replace(/^\/k\/v1\//, `/k/guest/${id}/v1/`);
  };

  // kintone.api()の失敗時に渡されるエラー(kintoneのエラーオブジェクト/Error/文字列)を表示用文言にする。
  // 入力内容のエラー(CB_VA01等)は errors に項目ごとのメッセージが入るため、それも並べる。
  const describeApiError = (err) => {
    if (!err) {
      return '不明なエラーが発生しました。';
    }
    if (typeof err === 'string') {
      return err;
    }
    const base = err.message || String(err);
    const details = [];
    if (err.errors && typeof err.errors === 'object') {
      Object.keys(err.errors).forEach((key) => {
        const messages = (err.errors[key] && err.errors[key].messages) || [];
        messages.forEach((m) => details.push(`${key}: ${m}`));
      });
    }
    return details.length > 0 ? `${base}(${details.join(' / ')})` : base;
  };

  // 権限エラー(kintone REST APIの共通エラーコード)。
  const isPermissionError = (err) => !!err && err.code === 'CB_NO02';

  const ApiPath = { buildApiPath, describeApiError, isPermissionError };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ApiPath;
  } else {
    root.AppSettingsRequest = root.AppSettingsRequest || {};
    root.AppSettingsRequest.ApiPath = ApiPath;
  }
})(typeof window !== 'undefined' ? window : globalThis);
