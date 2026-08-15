export type FilterOperator =
  | "eq"
  | "ne"
  | "in"
  | "notIn"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "between"
  | "contains"
  | "isEmpty"
  | "isNotEmpty";

export type TimeBucket = "day" | "week" | "month" | "quarter" | "year";

export type Dimension = {
  code: string;
  label: string;
  kind: "single" | "multi";
  cardinality:
    | { known: true; values: { key: string; label: string }[] }
    | { known: false; hint: "low" | "high" };
  operators: FilterOperator[];
};

export type MeasureAgg = "count" | "sum" | "avg" | "min" | "max" | "distinct";

export type Measure = {
  /** null = レコード件数 (count only) */
  code: string | null;
  label: string;
  aggs: MeasureAgg[];
  unit?: string;
  format?: { decimals?: number; thousandSeparator?: boolean };
};

export type TimeField = {
  code: string;
  label: string;
  buckets: TimeBucket[];
  range?: { min: string; max: string };
};

export type GeoCandidate =
  | {
      kind: "latLngPair";
      latField: string;
      lngField: string;
      confidence: "configured" | "inferred";
    }
  | {
      kind: "pointText";
      pointField: string;
      confidence: "configured" | "inferred";
    };

export type SemanticModel = {
  appId: string;
  appName: string;
  recordCountHint?: number;
  dimensions: Dimension[];
  measures: Measure[];
  timeFields: TimeField[];
  geoCandidates: GeoCandidate[];
  unsupported: { code: string; reason: string }[];
  suggestedQuestions: string[];
};

/** §4.2 決定表: フィールド型が集計上どう扱われるか */
export type FieldRole =
  | "identifier"
  | "measure"
  | "dimension"
  | "multiDimension"
  | "time"
  | "text"
  | "attachment"
  | "subScope"
  | "layout"
  | "unsupported";
