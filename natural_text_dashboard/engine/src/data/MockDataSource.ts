import type { FieldSchema } from "../types/fieldSchema";
import type { Filter } from "../types/spec";
import type { DataSource, FetchPlan, RawRecord } from "./DataSource";
import { appSalesSchema } from "./fixtures/appSales.schema";
import { matchesFilters } from "./filterMatch";
import { generateAppSalesRecords } from "./mock/generateRecords";

const CHUNK_SIZE = 500;
const CHUNK_DELAY_MS = 50;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * kintoneに接続せず、シード固定の擬似乱数で生成したフィクスチャデータを返すDataSource実装。
 * 実kintone実装（KintoneDataSource, Phase 1）に差し替えても集計エンジン・レンダラは無変更で動く。
 */
export class MockDataSource implements DataSource {
  private readonly schema: FieldSchema;
  private readonly records: RawRecord[];
  private readonly chunkDelayMs: number;

  constructor(options?: { schema?: FieldSchema; records?: RawRecord[]; chunkDelayMs?: number }) {
    this.schema = options?.schema ?? appSalesSchema;
    this.records = options?.records ?? generateAppSalesRecords();
    this.chunkDelayMs = options?.chunkDelayMs ?? CHUNK_DELAY_MS;
  }

  async getAppInfo(): Promise<{ appId: string; appName: string }> {
    return { appId: this.schema.appId, appName: this.schema.appName };
  }

  async getSchema(): Promise<FieldSchema> {
    return this.schema;
  }

  async countRecords(filters: Filter[]): Promise<number> {
    return this.records.filter((r) => matchesFilters(this.schema, r, filters)).length;
  }

  fetchRecords(plan: FetchPlan): AsyncIterable<RawRecord[]> {
    const filtered = this.records.filter((r) => matchesFilters(this.schema, r, plan.filters));
    const chunkDelayMs = this.chunkDelayMs;
    async function* generator(): AsyncIterable<RawRecord[]> {
      for (let i = 0; i < filtered.length; i += CHUNK_SIZE) {
        await delay(chunkDelayMs);
        yield filtered.slice(i, i + CHUNK_SIZE);
      }
    }
    return generator();
  }
}
