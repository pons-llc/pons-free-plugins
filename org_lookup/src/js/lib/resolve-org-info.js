(function (root) {
  'use strict';

  // 組織コードから、自組織+(あれば)直属の親組織の情報を解決する。
  // fetchOrgByCode(code) は「コードを1件受け取り、組織オブジェクト(またはnull)を返すPromise」を
  // 呼び出し側(desktop.js/mobile.js、実際はkintone.api()でGET /v1/organizations.jsonを呼ぶ)から
  // 注入してもらう。ここでは注入されたフェッチャーを呼ぶ回数を制御するだけの純粋なオーケストレーション
  // ロジックにし、Jestで「親のさらに親(祖父)は絶対に取得しない」ことを確定的にテストできるようにする
  // (kintone依存を持ち込まないため、モックのfetchOrgByCodeで検証可能)。
  //
  // 元メモ「親組織があった場合は親組織もルックアップする。祖父以上までは遡らない」の通り、
  // org.parentCodeがある場合に1回だけ親組織を追加取得し、親組織自身のparentCodeは一切参照しない
  // (祖父を取得するfetchOrgByCode呼び出しは発生しない)。
  const resolveOrgInfo = async (code, fetchOrgByCode) => {
    if (!code) {
      return { org: null, parentOrg: null };
    }

    const org = await fetchOrgByCode(code);
    if (!org) {
      return { org: null, parentOrg: null };
    }

    const parentOrg = org.parentCode
      ? await fetchOrgByCode(org.parentCode)
      : null;
    return { org, parentOrg };
  };

  const ResolveOrgInfo = { resolveOrgInfo };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ResolveOrgInfo;
  } else {
    root.OrgLookup = root.OrgLookup || {};
    root.OrgLookup.ResolveOrgInfo = ResolveOrgInfo;
  }
})(typeof window !== 'undefined' ? window : globalThis);
