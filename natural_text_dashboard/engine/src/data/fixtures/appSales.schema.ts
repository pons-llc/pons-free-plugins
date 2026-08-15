import type { FieldSchema } from "../../types/fieldSchema";

function opts(labels: string[]): Record<string, { label: string; index: string }> {
  const out: Record<string, { label: string; index: string }> = {};
  labels.forEach((label, i) => {
    out[label] = { label, index: String(i) };
  });
  return out;
}

/**
 * §4.2 決定表の全型を網羅するフィクスチャ。実際の kintone.app.getFormFields() の
 * 戻り値（= REST API「フィールドを取得する」の properties）と同形。
 */
export const appSalesSchema: FieldSchema = {
  appId: "1",
  appName: "案件管理",
  properties: {
    record_number: { type: "RECORD_NUMBER", code: "record_number", label: "レコード番号" },
    deal_name: { type: "SINGLE_LINE_TEXT", code: "deal_name", label: "案件名" },
    amount: { type: "NUMBER", code: "amount", label: "金額", unit: "円", unitPosition: "AFTER" },
    quantity: { type: "NUMBER", code: "quantity", label: "数量" },
    unit_price: { type: "CALC", code: "unit_price", label: "単価", unit: "円", unitPosition: "AFTER" },
    category: { type: "DROP_DOWN", code: "category", label: "カテゴリ", options: opts(["新規", "既存", "更新", "解約"]) },
    priority: { type: "RADIO_BUTTON", code: "priority", label: "優先度", options: opts(["高", "中", "低"]) },
    tags: { type: "CHECK_BOX", code: "tags", label: "タグ", options: opts(["重要", "要フォロー", "紹介", "キャンペーン"]) },
    channels: {
      type: "MULTI_SELECT",
      code: "channels",
      label: "流入チャネル",
      options: opts(["Web", "紹介", "展示会", "広告"]),
    },
    assignee: { type: "USER_SELECT", code: "assignee", label: "担当者" },
    department: { type: "ORGANIZATION_SELECT", code: "department", label: "部署" },
    reviewers: { type: "GROUP_SELECT", code: "reviewers", label: "レビューグループ" },
    deal_date: { type: "DATE", code: "deal_date", label: "商談日" },
    closed_at: { type: "DATETIME", code: "closed_at", label: "成約日時" },
    contact_time: { type: "TIME", code: "contact_time", label: "連絡希望時間" },
    notes: { type: "MULTI_LINE_TEXT", code: "notes", label: "備考" },
    description: { type: "RICH_TEXT", code: "description", label: "詳細説明" },
    reference_url: { type: "LINK", code: "reference_url", label: "参考URL" },
    attachment: { type: "FILE", code: "attachment", label: "添付ファイル" },
    Creator: { type: "CREATOR", code: "Creator", label: "作成者" },
    Modifier: { type: "MODIFIER", code: "Modifier", label: "更新者" },
    Created_datetime: { type: "CREATED_TIME", code: "Created_datetime", label: "作成日時" },
    Updated_datetime: { type: "UPDATED_TIME", code: "Updated_datetime", label: "更新日時" },
    deal_category: { type: "CATEGORY", code: "deal_category", label: "案件区分" },
    Status: { type: "STATUS", code: "Status", label: "ステータス" },
    Status_Assignee: { type: "STATUS_ASSIGNEE", code: "Status_Assignee", label: "作業者" },
    items: {
      type: "SUBTABLE",
      code: "items",
      label: "明細",
      fields: {
        item_name: { type: "SINGLE_LINE_TEXT", code: "item_name", label: "品目" },
        item_qty: { type: "NUMBER", code: "item_qty", label: "数量" },
        item_amount: { type: "NUMBER", code: "item_amount", label: "金額" },
      },
    },
    latitude: { type: "NUMBER", code: "latitude", label: "緯度" },
    longitude: { type: "NUMBER", code: "longitude", label: "経度" },
    lookup_customer: {
      type: "LOOKUP",
      code: "lookup_customer",
      label: "顧客名（ルックアップ）",
      lookup: { relatedAppId: "2", fieldType: "SINGLE_LINE_TEXT" },
    },
    layout_group: { type: "GROUP", code: "layout_group", label: "グループ" },
    layout_spacer: { type: "SPACER", code: "layout_spacer", label: "" },
    layout_label: { type: "LABEL", code: "layout_label", label: "注意事項" },
    layout_hr: { type: "HR", code: "layout_hr", label: "" },
    related_table: { type: "REFERENCE_TABLE", code: "related_table", label: "関連テーブル" },
  },
};
