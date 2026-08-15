import { matchesFilters } from "../data/filterMatch";
import type { DataSource, FetchPlan, RawRecord } from "../data/DataSource";
import { LIMITS } from "../config/limits";
import type { FieldSchema } from "../types/fieldSchema";
import type { Filter } from "../types/spec";

const CURSOR_PAGE_SIZE = 500;

/**
 * kintone一覧画面の「現在のクエリ」(kintone.app.getQueryCondition()で取得した絞り込み条件)に
 * マッチするレコードを、ダッシュボード作成の起点(describe_app呼び出し前)で一度だけ全件取得し、
 * 以降はメモリ上でフィルタする DataSource 実装。engine側(mcp/tools.ts等)は無改変。
 *
 * DashboardSpecのfilter(AIが set_filters/create_dashboard 等で組み立てる絞り込み)は、
 * この取得済みレコード集合に対する絞り込みであり、kintone一覧画面自体の検索条件とは別レイヤ
 * (このDataSourceのbaseQueryとして固定済み)。
 */
export class KintoneDataSource implements DataSource {
  private readonly appId: string;
  private readonly baseQuery: string;
  private schema: FieldSchema | undefined;
  private records: RawRecord[] | undefined;
  private appName = "";

  constructor(options: { appId: string; baseQuery: string }) {
    this.appId = options.appId;
    this.baseQuery = options.baseQuery;
  }

  async getAppInfo(): Promise<{ appId: string; appName: string }> {
    if (!this.appName) {
      // kintone.app.get() は非同期API。戻り値はPromise解決時に {id,name,...} を直接返す(kintone_doc MCP: js-api/app/get-app で確認)。
      const app = (await kintone.app.get()) as { name: string };
      this.appName = app.name;
    }
    return { appId: this.appId, appName: this.appName };
  }

  async getSchema(): Promise<FieldSchema> {
    if (!this.schema) {
      // kintone.app.getFormFields() は非同期APIで、戻り値はREST API「フィールドを取得する」の
      // properties と同形の値そのもの({properties:...}にラップされない)。kintone_doc MCP
      // (js-api/app/get-form-fields)で確認済み。CLAUDE.mdに記載の既知の落とし穴の通り。
      const properties = (await kintone.app.getFormFields()) as FieldSchema["properties"];
      const appInfo = await this.getAppInfo();
      this.schema = { appId: appInfo.appId, appName: appInfo.appName, properties };
    }
    return this.schema;
  }

  private async ensureRecords(): Promise<RawRecord[]> {
    if (this.records) return this.records;

    const created = (await kintone.api(kintone.api.url("/k/v1/records/cursor.json", true), "POST", {
      app: this.appId,
      query: this.baseQuery,
      size: CURSOR_PAGE_SIZE,
    })) as { id: string; totalCount: string };

    const records: RawRecord[] = [];
    let cutOff = false;
    try {
      let next = true;
      while (next) {
        const page = (await kintone.api(kintone.api.url("/k/v1/records/cursor.json", true), "GET", {
          id: created.id,
        })) as { records: RawRecord[]; next: boolean };
        records.push(...page.records);
        next = page.next;
        if (records.length >= LIMITS.maxFetchRecords && next) {
          cutOff = true;
          break;
        }
      }
    } finally {
      // 上限で打ち切った場合、カーソルは自動削除されない(1ドメイン10個までの上限を圧迫しないよう明示削除する。失敗しても致命的ではないのでbest-effort)。
      if (cutOff) {
        await kintone.api(kintone.api.url("/k/v1/records/cursor.json", true), "DELETE", { id: created.id }).catch(() => {});
      }
    }

    this.records = records.slice(0, LIMITS.maxFetchRecords);
    return this.records;
  }

  async countRecords(filters: Filter[]): Promise<number> {
    const schema = await this.getSchema();
    const records = await this.ensureRecords();
    return records.filter((r) => matchesFilters(schema, r, filters)).length;
  }

  fetchRecords(plan: FetchPlan): AsyncIterable<RawRecord[]> {
    const CHUNK = 500;
    const self = this;
    async function* generator(): AsyncIterable<RawRecord[]> {
      const schema = await self.getSchema();
      const records = await self.ensureRecords();
      const filtered = records.filter((r) => matchesFilters(schema, r, plan.filters));
      for (let i = 0; i < filtered.length; i += CHUNK) {
        yield filtered.slice(i, i + CHUNK);
      }
    }
    return generator();
  }
}
