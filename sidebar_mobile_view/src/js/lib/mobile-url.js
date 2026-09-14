(function (root) {
  'use strict';

  // kintoneのモバイル版URL(レコード詳細・レコード一覧)を組み立てる。
  //
  // URL形式は公式ドキュメントに記載が無いため(idea.md「モバイル版URLの形式」参照)、実際に
  // 検証環境へPuppeteerでログインしたうえで実URLに直接アクセスして確認した(推測実装ではない)。
  // PC版のレコード詳細は `#record={id}`(ハッシュ)だが、モバイル版で同じハッシュ形式を使うと
  // 400エラー(CB_VA01「入力内容が正しくありません」)になり、`?record={id}`(クエリ文字列)で
  // 初めて正しくレコード詳細が描画されることを確認済み。レコード一覧は`/k/m/{appId}/`
  // (PC版`/k/{appId}/`のモバイル版)で、これも実機で200・一覧描画を確認済み。
  const isPositiveIntLike = (v) => {
    if (typeof v === 'number') {
      return Number.isInteger(v) && v > 0;
    }
    if (typeof v === 'string' && /^[1-9][0-9]*$/.test(v)) {
      return true;
    }
    return false;
  };

  const normalizeOrigin = (origin) => origin.replace(/\/+$/, '');

  const buildRecordUrl = ({ origin, appId, recordId }) => {
    if (!origin || typeof origin !== 'string') {
      return null;
    }
    if (!isPositiveIntLike(appId) || !isPositiveIntLike(recordId)) {
      return null;
    }
    return `${normalizeOrigin(origin)}/k/m/${appId}/show?record=${recordId}`;
  };

  const buildListUrl = ({ origin, appId }) => {
    if (!origin || typeof origin !== 'string') {
      return null;
    }
    if (!isPositiveIntLike(appId)) {
      return null;
    }
    return `${normalizeOrigin(origin)}/k/m/${appId}/`;
  };

  // レコード詳細用URLと一覧用URLのどちらを使うかを決める。
  //
  // 対象アプリID(targetAppId)が現在のアプリ(currentAppId)と異なる場合、現在開いている
  // レコードのIDはそのアプリでは無関係の値(対応するレコードとは限らない)なので、
  // レコード詳細ではなく一覧(そのアプリのモバイル版レコード一覧)を表示する。
  // 対象アプリIDが未指定・現在のアプリと同じ場合は、レコードIDがあればレコード詳細、
  // 無ければ(新規作成画面など、レコードがまだ存在しない場合)現在のアプリの一覧を表示する。
  const resolve = ({ origin, currentAppId, targetAppId, recordId }) => {
    const effectiveAppId = targetAppId || currentAppId;
    const isSameApp =
      isPositiveIntLike(currentAppId) &&
      isPositiveIntLike(effectiveAppId) &&
      String(effectiveAppId) === String(currentAppId);

    if (isSameApp && isPositiveIntLike(recordId)) {
      return buildRecordUrl({ origin, appId: effectiveAppId, recordId });
    }
    return buildListUrl({ origin, appId: effectiveAppId });
  };

  const MobileUrl = { buildRecordUrl, buildListUrl, resolve };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = MobileUrl;
  } else {
    root.SidebarMobileView = root.SidebarMobileView || {};
    root.SidebarMobileView.MobileUrl = MobileUrl;
  }
})(typeof window !== 'undefined' ? window : globalThis);
