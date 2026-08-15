import type { FieldSchema } from "../types/fieldSchema";
import type { Filter } from "../types/spec";

/** kintone REST API のレコード1件と同形（フィールドコード → {type, value}）。 */
export type RawRecord = Record<string, { type: string; value: unknown }>;

export type FetchPlan = {
  /** ダッシュボード全体フィルタ + ウィジェット固有フィルタを合成したもの（AND） */
  filters: Filter[];
  /** 取得が必要なフィールドコード。空 = 全件（原則使わない） */
  fields: string[];
};

/**
 * kintoneからのデータ取得を抽象化する境界。MVPは MockDataSource のみを実装し、
 * 実kintone実装（KintoneDataSource, Phase 1）はこのインタフェースの差し替えだけで済むようにする。
 */
export interface DataSource {
  getAppInfo(): Promise<{ appId: string; appName: string }>;
  /** kintone REST API「フィールドを取得する」の properties と同形 */
  getSchema(): Promise<FieldSchema>;
  /** 実kintoneの cursor API と同じ「チャンク単位の非同期反復」で返す */
  fetchRecords(plan: FetchPlan): AsyncIterable<RawRecord[]>;
  countRecords(filters: Filter[]): Promise<number>;
}
