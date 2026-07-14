(function (root) {
  'use strict';

  // 転記できる法人情報項目の一覧。gBizINFO REST API v2「法人基本情報を取得する」
  // (GET /v2/hojin/{corporate_number}、レスポンスのhojin-infos[0] = HojinInfoV2)のうち、
  // スカラー値(配列・入れ子オブジェクトではない)の項目のみを対象にする(idea.md参照)。
  // 実際のOpenAPI仕様(https://api.info.gbiz.go.jp/hojin/v3/api-docs?group=v2)を取得して
  // プロパティ名を確認済み(推測実装ではない)。
  const ATTRIBUTES = [
    { key: 'name', label: '法人名' },
    { key: 'kana', label: '法人名フリガナ' },
    { key: 'name_en', label: '法人名(英語)' },
    { key: 'postal_code', label: '郵便番号' },
    { key: 'location', label: '本社所在地' },
    { key: 'representative_name', label: '代表者名' },
    { key: 'capital_stock', label: '資本金' },
    { key: 'employee_number', label: '従業員数' },
    { key: 'founding_year', label: '創業年' },
    { key: 'date_of_establishment', label: '設立年月日' },
    { key: 'business_summary', label: '事業概要' },
    { key: 'company_url', label: '企業ホームページ' },
    { key: 'kind', label: '法人種別' },
    { key: 'status', label: 'ステータス' },
    { key: 'update_date', label: '更新年月日' },
  ];

  const ATTRIBUTE_KEYS = ATTRIBUTES.map((a) => a.key);

  const GBizAttributes = { ATTRIBUTES, ATTRIBUTE_KEYS };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = GBizAttributes;
  } else {
    root.BizCodeSearch = root.BizCodeSearch || {};
    root.BizCodeSearch.GBizAttributes = GBizAttributes;
  }
})(typeof window !== 'undefined' ? window : globalThis);
