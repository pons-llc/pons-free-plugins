import type { TimeBucket } from "./semantic";

export type WidgetType = "kpi" | "bar" | "line" | "pie" | "table" | "crosstab" | "map";

export type Filter =
  | { field: string; op: "eq" | "ne"; value: string | number }
  | { field: string; op: "in" | "notIn"; values: (string | number)[] }
  | { field: string; op: "gt" | "gte" | "lt" | "lte"; value: number | string }
  | { field: string; op: "between"; from: string | number; to: string | number }
  | { field: string; op: "contains"; value: string }
  | { field: string; op: "isEmpty" | "isNotEmpty" };

export type Axis =
  | { field: string }
  | { field: string; bucket: TimeBucket }
  | { field: string; bins: { width: number } | { edges: number[] } };

export type MeasureRef =
  | { agg: "count" }
  | { agg: "sum" | "avg" | "min" | "max" | "distinct"; field: string };

export type Query = {
  rows: Axis[];
  cols: Axis[];
  measures: MeasureRef[];
  filters: Filter[];
  sort?: { by: "row" | "measure"; index?: number; order: "asc" | "desc" };
  limit?: { rows?: number; cols?: number; otherBucket?: boolean };
};

export type MapQuery = {
  geo: { latField: string; lngField: string } | { pointField: string };
  label?: string;
  colorBy?: string;
  filters: Filter[];
  limit?: { markers?: number };
};

export type MapStyle = "pale" | "std" | "blank" | "seamlessphoto";

export type WidgetOptions = {
  showLegend?: boolean;
  stacked?: boolean;
  beginAtZero?: boolean;
  mapStyle?: MapStyle;
};

export type Widget = {
  id: string;
  type: WidgetType;
  title: string;
  position: { x: number; y: number; w: number; h: number };
  query: Query | MapQuery;
  options?: WidgetOptions;
};

export type DashboardSpec = {
  specVersion: "1.0";
  dashboardId: string;
  appId: string;
  title: string;
  filters: Filter[];
  layout: { columns: 12 };
  widgets: Widget[];
};

export function isMapQuery(query: Query | MapQuery): query is MapQuery {
  return "geo" in query;
}
