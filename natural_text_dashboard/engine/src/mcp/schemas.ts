import { z } from "zod";

const strOrNum = z.union([z.string(), z.number()]);

const FilterEqNe = z.object({ field: z.string(), op: z.enum(["eq", "ne"]), value: strOrNum }).strict();
const FilterInNotIn = z.object({ field: z.string(), op: z.enum(["in", "notIn"]), values: z.array(strOrNum) }).strict();
const FilterCmp = z.object({ field: z.string(), op: z.enum(["gt", "gte", "lt", "lte"]), value: strOrNum }).strict();
const FilterBetween = z.object({ field: z.string(), op: z.literal("between"), from: strOrNum, to: strOrNum }).strict();
const FilterContains = z.object({ field: z.string(), op: z.literal("contains"), value: z.string() }).strict();
const FilterEmpty = z.object({ field: z.string(), op: z.enum(["isEmpty", "isNotEmpty"]) }).strict();

export const FilterSchema = z.union([FilterEqNe, FilterInNotIn, FilterCmp, FilterBetween, FilterContains, FilterEmpty]);

const TimeBucketSchema = z.enum(["day", "week", "month", "quarter", "year"]);

const AxisBucket = z.object({ field: z.string(), bucket: TimeBucketSchema }).strict();
const AxisBins = z
  .object({
    field: z.string(),
    bins: z.union([
      z.object({ width: z.number().positive() }).strict(),
      z.object({ edges: z.array(z.number()).min(2) }).strict(),
    ]),
  })
  .strict();
const AxisPlain = z.object({ field: z.string() }).strict();

export const AxisSchema = z.union([AxisBucket, AxisBins, AxisPlain]);

export const MeasureRefSchema = z.union([
  z.object({ agg: z.literal("count") }).strict(),
  z.object({ agg: z.enum(["sum", "avg", "min", "max", "distinct"]), field: z.string() }).strict(),
]);

export const QuerySchema = z.object({
  rows: z.array(AxisSchema).max(2),
  cols: z.array(AxisSchema).max(1),
  measures: z.array(MeasureRefSchema).min(1),
  filters: z.array(FilterSchema),
  sort: z.object({ by: z.enum(["row", "measure"]), index: z.number().optional(), order: z.enum(["asc", "desc"]) }).optional(),
  limit: z
    .object({
      rows: z.number().int().positive().optional(),
      cols: z.number().int().positive().optional(),
      otherBucket: z.boolean().optional(),
    })
    .optional(),
});

export const MapQuerySchema = z.object({
  geo: z.union([
    z.object({ latField: z.string(), lngField: z.string() }).strict(),
    z.object({ pointField: z.string() }).strict(),
  ]),
  label: z.string().optional(),
  colorBy: z.string().optional(),
  filters: z.array(FilterSchema),
  limit: z.object({ markers: z.number().int().positive().optional() }).optional(),
});

export const WidgetOptionsSchema = z
  .object({
    showLegend: z.boolean().optional(),
    stacked: z.boolean().optional(),
    beginAtZero: z.boolean().optional(),
    mapStyle: z.enum(["pale", "std", "blank", "seamlessphoto"]).optional(),
  })
  .optional();

export const WidgetTypeSchema = z.enum(["kpi", "bar", "line", "pie", "table", "crosstab", "map"]);

// type と query の形は1対1に対応する（map だけ MapQuery、それ以外は Query）。
// 素の z.union([QuerySchema, MapQuerySchema]) だと type:"map" に Query 形のオブジェクトが
// 素通りしてしまい、後段（checkMapQuery / projectToPoints）で query.geo が undefined のまま
// 扱われてクラッシュするため、type ごとに discriminated union で縛る。
const NonMapWidgetInput = z.object({
  type: z.enum(["kpi", "bar", "line", "pie", "table", "crosstab"]),
  title: z.string(),
  query: QuerySchema,
  options: WidgetOptionsSchema,
});
const MapWidgetInput = z.object({
  type: z.literal("map"),
  title: z.string(),
  query: MapQuerySchema,
  options: WidgetOptionsSchema,
});

export const WidgetInputSchema = z.union([NonMapWidgetInput, MapWidgetInput]);

export const DescribeAppInput = z.object({}).strict();

export const CreateDashboardInput = z.object({ title: z.string(), filters: z.array(FilterSchema).optional() }).strict();

export const AddWidgetInput = z.object({ dashboardId: z.string(), widget: WidgetInputSchema }).strict();

export const UpdateWidgetInput = z
  .object({
    dashboardId: z.string(),
    widgetId: z.string(),
    patch: z
      .object({
        title: z.string().optional(),
        query: z.union([QuerySchema, MapQuerySchema]).optional(),
        options: WidgetOptionsSchema,
      })
      .strict(),
  })
  .strict();

export const RemoveWidgetInput = z.object({ dashboardId: z.string(), widgetId: z.string() }).strict();

export const SetLayoutInput = z.object({ dashboardId: z.string(), layout: z.object({ columns: z.literal(12) }).strict() }).strict();

export const SetFiltersInput = z.object({ dashboardId: z.string(), filters: z.array(FilterSchema) }).strict();

export const RenderDashboardInput = z.object({ dashboardId: z.string() }).strict();

export const GetDashboardInput = z.object({ dashboardId: z.string() }).strict();

export const ReadAggregateInput = z.object({ dashboardId: z.string(), widgetId: z.string(), maxCells: z.number().optional() }).strict();

export const ExportHtmlInput = z
  .object({ dashboardId: z.string(), filename: z.string().optional(), confirmed: z.boolean().optional() })
  .strict();
