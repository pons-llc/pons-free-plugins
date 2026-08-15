export type ResultCell = {
  rowKey: string[];
  rowLabel: string[];
  colKey: string[];
  colLabel: string[];
  measures: (number | null)[];
};

export type AggregatedResult = {
  cells: ResultCell[];
  /** 多値次元の展開により、件数の合計が母数と一致しない可能性がある */
  overlapping: boolean;
  /** グループ数上限を超え、上位N＋「その他」に畳んだ */
  truncated: boolean;
  /** このクエリのフィルタにマッチした母数（展開前のレコード数） */
  rowCount: number;
};

export type PointResult = {
  lat: number;
  lng: number;
  label?: string;
  colorKey?: string;
};

export type MapProjectionResult = {
  points: PointResult[];
  excludedCount: number;
  truncated: boolean;
};
