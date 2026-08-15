export type ErrorCode =
  | "FIELD_NOT_FOUND"
  | "FIELD_NOT_AGGREGATABLE"
  | "AGG_TYPE_MISMATCH"
  | "BUCKET_NOT_APPLICABLE"
  | "TOO_MANY_GROUPS"
  | "RECORD_LIMIT_EXCEEDED"
  | "SUBTABLE_UNSUPPORTED"
  | "GEO_FIELD_UNRESOLVED"
  | "MAP_NOT_READABLE"
  | "MAP_EXPORT_NEEDS_CONFIRMATION"
  | "INVALID_INPUT"
  | "WIDGET_SHAPE_INVALID"
  | "DASHBOARD_NOT_FOUND"
  | "WIDGET_NOT_FOUND"
  | "WIDGET_LIMIT_EXCEEDED";

export type ToolError = {
  ok: false;
  code: ErrorCode;
  message: string;
  field?: string;
  alternatives?: string[];
};

export function toolError(
  code: ErrorCode,
  message: string,
  extra?: { field?: string; alternatives?: string[] },
): ToolError {
  return { ok: false, code, message, ...extra };
}

export class DashboardMcpError extends Error {
  readonly toolError: ToolError;
  constructor(err: ToolError) {
    super(err.message);
    this.name = "DashboardMcpError";
    this.toolError = err;
  }
}
