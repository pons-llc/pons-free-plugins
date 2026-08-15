import { appSalesGenConfig as cfg } from "../fixtures/appSales.config";
import type { RawRecord } from "../DataSource";
import { SeededRandom } from "./rng";

function weightedPick(rng: SeededRandom, weights: Record<string, number>): string {
  const entries = Object.entries(weights);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = rng.float() * total;
  for (const [key, w] of entries) {
    r -= w;
    if (r <= 0) return key;
  }
  return entries[entries.length - 1]![0];
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toDateString(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function toDateTimeString(d: Date): string {
  return `${toDateString(d)}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:00Z`;
}

/**
 * シード固定の擬似乱数で `appSalesSchema` に対応するレコードを生成する。
 * 同じ config なら常に同じレコード列を返す（P3のテスト担保）。
 */
export function generateAppSalesRecords(): RawRecord[] {
  const rng = new SeededRandom(cfg.seed);
  const start = new Date(cfg.dateRange.start);
  const end = new Date(cfg.dateRange.end);
  const dealNames = ["新規契約", "更新提案", "追加導入", "サポート契約", "保守契約", "拡張提案"];
  const tagOptions = ["重要", "要フォロー", "紹介", "キャンペーン"];
  const channelOptions = ["Web", "紹介", "展示会", "広告"];
  const priorityOptions = ["高", "中", "低"];
  const statusOptions = ["未着手", "対応中", "完了"];
  const itemNames = ["ライセンス", "導入支援", "保守", "オプション機能"];
  const categoryLabels = ["国内", "海外"];

  const records: RawRecord[] = [];

  for (let i = 0; i < cfg.recordCount; i++) {
    const id = i + 1;
    const dealDate = rng.dateBetween(start, end);
    const closedAt = rng.dateBetween(dealDate, end);
    const quantity = rng.int(1, 20);
    const unitPriceValue = rng.int(1000, 50000);
    const amount = quantity * unitPriceValue;
    const assignee = rng.pick(cfg.users);
    const modifier = rng.pick(cfg.users);
    const department = rng.pick(cfg.departments);
    const reviewerCount = rng.int(0, 2);
    const reviewers = rng.pickN(cfg.groups, reviewerCount);
    const tagCount = rng.int(0, 2);
    const tags = rng.pickN(tagOptions, tagCount);
    const channelCount = rng.int(1, 2);
    const channels = rng.pickN(channelOptions, channelCount);

    const hasGeo = rng.bool(cfg.geoFillRate);
    const lat = hasGeo ? cfg.geoBounds.latMin + rng.float() * (cfg.geoBounds.latMax - cfg.geoBounds.latMin) : "";
    const lng = hasGeo ? cfg.geoBounds.lngMin + rng.float() * (cfg.geoBounds.lngMax - cfg.geoBounds.lngMin) : "";

    const itemCount = rng.int(1, 3);
    const items = Array.from({ length: itemCount }, (_, idx) => ({
      id: String(idx + 1),
      value: {
        item_name: { type: "SINGLE_LINE_TEXT", value: rng.pick(itemNames) },
        item_qty: { type: "NUMBER", value: String(rng.int(1, 10)) },
        item_amount: { type: "NUMBER", value: String(rng.int(1000, 20000)) },
      },
    }));

    const record: RawRecord = {
      record_number: { type: "RECORD_NUMBER", value: String(id) },
      deal_name: { type: "SINGLE_LINE_TEXT", value: `${rng.pick(dealNames)} #${id}` },
      amount: { type: "NUMBER", value: String(amount) },
      quantity: { type: "NUMBER", value: String(quantity) },
      unit_price: { type: "CALC", value: String(unitPriceValue) },
      category: { type: "DROP_DOWN", value: weightedPick(rng, cfg.categoryWeights) },
      priority: { type: "RADIO_BUTTON", value: rng.pick(priorityOptions) },
      tags: { type: "CHECK_BOX", value: tags },
      channels: { type: "MULTI_SELECT", value: channels },
      assignee: { type: "USER_SELECT", value: [assignee] },
      department: { type: "ORGANIZATION_SELECT", value: [department] },
      reviewers: { type: "GROUP_SELECT", value: reviewers },
      deal_date: { type: "DATE", value: toDateString(dealDate) },
      closed_at: { type: "DATETIME", value: toDateTimeString(closedAt) },
      contact_time: { type: "TIME", value: `${pad(rng.int(9, 18))}:00` },
      notes: { type: "MULTI_LINE_TEXT", value: rng.bool(0.3) ? "フォロー要" : "" },
      description: { type: "RICH_TEXT", value: "" },
      reference_url: { type: "LINK", value: "" },
      attachment: { type: "FILE", value: [] },
      Creator: { type: "CREATOR", value: assignee },
      Modifier: { type: "MODIFIER", value: modifier },
      Created_datetime: { type: "CREATED_TIME", value: toDateTimeString(dealDate) },
      Updated_datetime: { type: "UPDATED_TIME", value: toDateTimeString(closedAt) },
      deal_category: { type: "CATEGORY", value: rng.pickN(categoryLabels, rng.int(0, categoryLabels.length)) },
      Status: { type: "STATUS", value: rng.pick(statusOptions) },
      Status_Assignee: { type: "STATUS_ASSIGNEE", value: rng.pickN(cfg.users, rng.int(0, 2)) },
      items: { type: "SUBTABLE", value: items },
      latitude: { type: "NUMBER", value: hasGeo ? String(lat) : "" },
      longitude: { type: "NUMBER", value: hasGeo ? String(lng) : "" },
      lookup_customer: { type: "SINGLE_LINE_TEXT", value: `顧客${id % 37}` },
    };
    records.push(record);
  }

  return records;
}
