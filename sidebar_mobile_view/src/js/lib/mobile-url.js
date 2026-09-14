(function (root) {
  'use strict';

  // kintoneのモバイル版レコード詳細URLを組み立てる。
  //
  // URL形式は公式ドキュメントに記載が無いため(idea.md「モバイル版URLの形式」参照)、実際に
  // 検証環境へPuppeteerでログインしたうえで実URLに直接アクセスして確認した(推測実装ではない)。
  // PC版は `#record={id}`(ハッシュ)だが、モバイル版で同じハッシュ形式を使うと
  // 400エラー(CB_VA01「入力内容が正しくありません」)になり、`?record={id}`(クエリ文字列)で
  // 初めて正しくレコード詳細が描画されることを確認済み。
  const isPositiveIntLike = (v) => {
    if (typeof v === 'number') {
      return Number.isInteger(v) && v > 0;
    }
    if (typeof v === 'string' && /^[1-9][0-9]*$/.test(v)) {
      return true;
    }
    return false;
  };

  const build = ({ origin, appId, recordId }) => {
    if (!origin || typeof origin !== 'string') {
      return null;
    }
    if (!isPositiveIntLike(appId) || !isPositiveIntLike(recordId)) {
      return null;
    }
    const normalizedOrigin = origin.replace(/\/+$/, '');
    return `${normalizedOrigin}/k/m/${appId}/show?record=${recordId}`;
  };

  const MobileUrl = { build };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = MobileUrl;
  } else {
    root.SidebarMobileView = root.SidebarMobileView || {};
    root.SidebarMobileView.MobileUrl = MobileUrl;
  }
})(typeof window !== 'undefined' ? window : globalThis);
