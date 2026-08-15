export const appSalesGenConfig = {
  seed: 42,
  recordCount: 300,
  dateRange: { start: "2025-01-01T00:00:00Z", end: "2026-08-01T00:00:00Z" },
  categoryWeights: { 新規: 0.4, 既存: 0.3, 更新: 0.2, 解約: 0.1 },
  users: [
    { code: "sato", name: "佐藤" },
    { code: "suzuki", name: "鈴木" },
    { code: "takahashi", name: "高橋" },
    { code: "tanaka", name: "田中" },
    { code: "ito", name: "伊藤" },
  ],
  departments: [
    { code: "sales1", name: "営業一部" },
    { code: "sales2", name: "営業二部" },
    { code: "support", name: "サポート部" },
  ],
  groups: [
    { code: "reviewers_a", name: "レビュー班A" },
    { code: "reviewers_b", name: "レビュー班B" },
  ],
  /** 緯度経度を持つレコードの割合（残りは空 = 地図投影で除外されることを確認するため） */
  geoFillRate: 0.7,
  /** 日本国内のおおよその範囲 */
  geoBounds: { latMin: 26, latMax: 45, lngMin: 128, lngMax: 145 },
} as const;
