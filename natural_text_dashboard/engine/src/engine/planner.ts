import type { FetchPlan } from "../data/DataSource";
import type { DashboardSpec, Filter, MapQuery, Query, Widget } from "../types/spec";
import { isMapQuery } from "../types/spec";

export type PlanGroup = { plan: FetchPlan; widgetIds: string[] };

function fieldsOfQuery(query: Query): string[] {
  const set = new Set<string>();
  query.rows.forEach((a) => set.add(a.field));
  query.cols.forEach((a) => set.add(a.field));
  query.measures.forEach((m) => {
    if ("field" in m) set.add(m.field);
  });
  query.filters.forEach((f) => set.add(f.field));
  return [...set];
}

function fieldsOfMapQuery(query: MapQuery): string[] {
  const set = new Set<string>();
  if ("latField" in query.geo) {
    set.add(query.geo.latField);
    set.add(query.geo.lngField);
  } else {
    set.add(query.geo.pointField);
  }
  if (query.label) set.add(query.label);
  if (query.colorBy) set.add(query.colorBy);
  query.filters.forEach((f) => set.add(f.field));
  return [...set];
}

function combinedFilters(dashboardFilters: Filter[], widgetFilters: Filter[]): Filter[] {
  return [...dashboardFilters, ...widgetFilters];
}

function filterSignature(filters: Filter[]): string {
  return filters
    .map((f) => JSON.stringify(f))
    .sort()
    .join("&");
}

/**
 * §7.1: 同じ (フィルタ集合, 必要フィールド集合) を要求するウィジェットをまとめ、
 * 1回の fetchRecords から複数ウィジェットの集計を賄えるように FetchPlan[] を作る。
 */
export function buildFetchPlans(spec: DashboardSpec): PlanGroup[] {
  const groups = new Map<string, PlanGroup>();

  for (const widget of spec.widgets) {
    const isMap = widget.type === "map";
    const query = widget.query;
    const filters = isMap
      ? combinedFilters(spec.filters, (query as MapQuery).filters)
      : combinedFilters(spec.filters, (query as Query).filters);
    const fields = isMap ? fieldsOfMapQuery(query as MapQuery) : fieldsOfQuery(query as Query);

    const sig = filterSignature(filters);
    let group = groups.get(sig);
    if (!group) {
      group = { plan: { filters, fields: [] }, widgetIds: [] };
      groups.set(sig, group);
    }
    const fieldSet = new Set([...group.plan.fields, ...fields]);
    group.plan.fields = [...fieldSet];
    group.widgetIds.push(widget.id);
  }

  return [...groups.values()];
}

export function widgetsById(spec: DashboardSpec): Map<string, Widget> {
  return new Map(spec.widgets.map((w) => [w.id, w]));
}
