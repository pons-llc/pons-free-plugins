import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PieController,
  PointElement,
  Tooltip,
  type Plugin,
} from "chart.js";
import type { FieldSchema } from "../types/fieldSchema";
import type { AggregatedResult } from "../types/result";
import type { Query, WidgetOptions, WidgetType } from "../types/spec";
import { appendNotes } from "./renderTable";
import { registerChart } from "./chartRegistry";
import type { DrillContext, DrillTarget } from "./interaction";
import { buildDrillTargetForAxis, openDrillMenu } from "./interaction";
import { measureLabel } from "./labels";
import { seriesColor } from "./theme";

Chart.register(
  BarController,
  LineController,
  PieController,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Legend,
  Tooltip,
);

const PIE_MAX_SLICES = 12;

type ChartDataset = { label: string; data: (number | null)[]; backgroundColor: string | string[]; borderColor: string | string[] };

function buildRowsColsSeries(
  schema: FieldSchema,
  query: Query,
  result: AggregatedResult,
): { labels: string[]; datasets: ChartDataset[]; rowKeys: string[] } {
  const rowOrder: string[] = [];
  const rowLabelOf = new Map<string, string>();
  // rowKey[0] は bar/line/pie では常に唯一の行軸の生キー（ドリルダウンのフィルタ値に使う）。
  // OTHER_KEY("__other__"、limit.rows超過時の畳み込み)はクリック対象にしない。
  const rowKeyOf = new Map<string, string>();
  for (const cell of result.cells) {
    const rk = cell.rowKey.join("␟");
    if (!rowLabelOf.has(rk)) {
      rowOrder.push(rk);
      rowLabelOf.set(rk, cell.rowLabel.join(" / "));
      rowKeyOf.set(rk, cell.rowKey[0] ?? "");
    }
  }
  const labels = rowOrder.map((rk) => rowLabelOf.get(rk)!);
  const rowKeys = rowOrder.map((rk) => rowKeyOf.get(rk)!);

  if (query.cols.length > 0) {
    const colOrder: string[] = [];
    const colLabelOf = new Map<string, string>();
    const valueOf = new Map<string, (number | null)[]>();
    for (const cell of result.cells) {
      const rk = cell.rowKey.join("␟");
      const ck = cell.colKey.join("␟");
      if (!colLabelOf.has(ck)) {
        colOrder.push(ck);
        colLabelOf.set(ck, cell.colLabel.join(" / "));
      }
      valueOf.set(`${rk}|${ck}`, cell.measures);
    }
    // 列軸ありでも measures は1個とは限らない（WIDGET_SHAPEはbar/lineでmeasures 1+を許可）。
    // 指標が複数あるときは 列×指標 の組み合わせを別系列にする。
    const datasets: ChartDataset[] = [];
    let seriesIndex = 0;
    for (const ck of colOrder) {
      query.measures.forEach((ref, mi) => {
        const colLabel = colLabelOf.get(ck)!;
        const label = query.measures.length > 1 ? `${colLabel} / ${measureLabel(schema, ref)}` : colLabel;
        datasets.push({
          label,
          data: rowOrder.map((rk) => valueOf.get(`${rk}|${ck}`)?.[mi] ?? null),
          backgroundColor: seriesColor(seriesIndex),
          borderColor: seriesColor(seriesIndex),
        });
        seriesIndex++;
      });
    }
    return { labels, datasets, rowKeys };
  }

  const valueOf = new Map<string, (number | null)[]>();
  for (const cell of result.cells) {
    valueOf.set(cell.rowKey.join("␟"), cell.measures);
  }
  const datasets = query.measures.map((ref, i) => ({
    label: measureLabel(schema, ref),
    data: rowOrder.map((rk) => valueOf.get(rk)?.[i] ?? null),
    backgroundColor: seriesColor(i),
    borderColor: seriesColor(i),
  }));
  return { labels, datasets, rowKeys };
}

function foldPieSlices(
  rowKeys: string[],
  labels: string[],
  values: (number | null)[],
): { rowKeys: (string | null)[]; labels: string[]; values: number[] } {
  const pairs = labels.map((label, i) => ({ key: rowKeys[i] ?? null, label, value: values[i] ?? 0 }));
  if (pairs.length <= PIE_MAX_SLICES) {
    return { rowKeys: pairs.map((p) => p.key), labels: pairs.map((p) => p.label), values: pairs.map((p) => p.value) };
  }
  const sorted = [...pairs].sort((a, b) => b.value - a.value);
  const kept = sorted.slice(0, PIE_MAX_SLICES - 1);
  const rest = sorted.slice(PIE_MAX_SLICES - 1);
  const otherTotal = rest.reduce((s, p) => s + p.value, 0);
  // 「その他」は複数値の合算なので、クリックしても単一値のフィルタにはできない(key: null)
  return {
    rowKeys: [...kept.map((p) => p.key), null],
    labels: [...kept.map((p) => p.label), "その他"],
    values: [...kept.map((p) => p.value), otherTotal],
  };
}

type CalloutLabel = { edgeX: number; edgeY: number; elbowX: number; elbowY: number; y: number; isRight: boolean; text: string; color: string };

function declutter(items: CalloutLabel[], minGap: number): void {
  items.sort((a, b) => a.y - b.y);
  for (let i = 1; i < items.length; i++) {
    const prev = items[i - 1]!;
    const cur = items[i]!;
    if (cur.y < prev.y + minGap) cur.y = prev.y + minGap;
  }
}

/**
 * 円グラフ用: 各スライスから外側へ引き出し線を伸ばし、「ラベル 割合%」を表示するカスタムプラグイン。
 * 既定の凡例の代わりにこちらでカテゴリ名を示すため、色は各スライスの塗りだけに頼らない（identity carrier）。
 * 色トークンは canvas に直接色を持たせず、THEME_CSS が定義するCSS変数を都度読むことで
 * ライト/ダーク切り替えに追随させる（テーマの単一情報源を theme.ts に保つ）。
 */
const pieCalloutLabels: Plugin<"pie"> = {
  id: "pieCalloutLabels",
  afterDraw(chart) {
    const meta = chart.getDatasetMeta(0);
    const dataset = chart.data.datasets[0];
    if (!dataset) return;
    const values = dataset.data as number[];
    const total = values.reduce((s, v) => s + (v || 0), 0);
    if (total <= 0) return;

    const style = getComputedStyle(chart.canvas);
    const textColor = style.getPropertyValue("--kdm-text-primary").trim() || "#0b0b0b";
    const lineColor = style.getPropertyValue("--kdm-muted").trim() || "#898781";

    const ELBOW = 10;
    const STUB = 16;
    const MIN_GAP = 15;

    const rightSide: CalloutLabel[] = [];
    const leftSide: CalloutLabel[] = [];

    meta.data.forEach((arc, i) => {
      const el = arc as unknown as { startAngle: number; endAngle: number; outerRadius: number; x: number; y: number };
      const mid = (el.startAngle + el.endAngle) / 2;
      const cos = Math.cos(mid);
      const sin = Math.sin(mid);
      const edgeX = el.x + el.outerRadius * cos;
      const edgeY = el.y + el.outerRadius * sin;
      const elbowX = el.x + (el.outerRadius + ELBOW) * cos;
      const elbowY = el.y + (el.outerRadius + ELBOW) * sin;
      const isRight = cos >= 0;
      const pct = Math.round((values[i]! / total) * 100);
      const label = chart.data.labels?.[i] ?? "";
      const backgroundColor = dataset.backgroundColor as string[];
      const item: CalloutLabel = { edgeX, edgeY, elbowX, elbowY, y: elbowY, isRight, text: `${label} ${pct}%`, color: backgroundColor[i] ?? lineColor };
      (isRight ? rightSide : leftSide).push(item);
    });

    declutter(rightSide, MIN_GAP);
    declutter(leftSide, MIN_GAP);

    const ctx = chart.ctx;
    ctx.save();
    ctx.font = "12px system-ui, -apple-system, 'Segoe UI', sans-serif";
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = lineColor;
    ctx.textBaseline = "middle";

    for (const item of [...rightSide, ...leftSide]) {
      const stubX = item.elbowX + (item.isRight ? STUB : -STUB);
      ctx.beginPath();
      ctx.moveTo(item.edgeX, item.edgeY);
      ctx.lineTo(item.elbowX, item.elbowY);
      ctx.lineTo(stubX, item.y);
      ctx.stroke();

      ctx.fillStyle = item.color;
      ctx.beginPath();
      ctx.arc(item.edgeX, item.edgeY, 2.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = textColor;
      ctx.textAlign = item.isRight ? "left" : "right";
      ctx.fillText(item.text, stubX + (item.isRight ? 4 : -4), item.y);
    }
    ctx.restore();
  },
};

/** 行軸(rows[0])のクリックされたインデックスから、ドリルメニュー用のターゲットを組み立てる */
function buildRowDrillTarget(query: Query, index: number, rowKeys: (string | null | undefined)[], labels: string[]): DrillTarget | null {
  const key = rowKeys[index];
  if (key === undefined || key === null) return null; // 「その他」など単一値に対応しないセル
  const axis = query.rows[0];
  if (!axis) return null;
  const label = labels[index] ?? key;
  return buildDrillTargetForAxis(axis, key, label);
}

/**
 * bar / line / pie を Chart.js で描画する。Spec の値からの変換は固定のマッピング関数のみで行い、
 * AIから options を丸ごと受け取ることはしない（P2）。文字列はすべて Chart.js 内部の canvas 描画に留まる。
 * interaction を渡すと、要素クリックでドリルダウンメニュー（絞り込み/粒度変更）を出す。
 */
export function renderChart(
  schema: FieldSchema,
  widgetType: Extract<WidgetType, "bar" | "line" | "pie">,
  query: Query,
  result: AggregatedResult,
  options?: WidgetOptions,
  interaction?: DrillContext,
): HTMLElement {
  const wrap = document.createElement("div");
  if (result.cells.length === 0) {
    const empty = document.createElement("div");
    empty.className = "kdm-empty";
    empty.textContent = "データがありません。";
    wrap.appendChild(empty);
    return wrap;
  }

  const canvasWrap = document.createElement("div");
  canvasWrap.className = "kdm-canvas-wrap";
  const canvas = document.createElement("canvas");
  canvasWrap.appendChild(canvas);
  wrap.appendChild(canvasWrap);

  if (widgetType === "pie") {
    const { labels, datasets, rowKeys } = buildRowsColsSeries(schema, query, result);
    const single = datasets[0]?.data ?? [];
    const { rowKeys: pieRowKeys, labels: pieLabels, values } = foldPieSlices(rowKeys, labels, single);
    const chart = new Chart(canvas, {
      type: "pie",
      data: {
        labels: pieLabels,
        datasets: [
          {
            data: values,
            backgroundColor: pieLabels.map((_, i) => seriesColor(i)),
          },
        ],
      },
      // 引き出し線ラベルがカテゴリ名を兼ねるため、凡例は既定で隠す（明示的にtrueにした時だけ両方出す）。
      // radiusを絞って、外側のラベル・引き出し線を描く余白をキャンバス内に確保する。
      options: {
        responsive: true,
        maintainAspectRatio: false,
        radius: "60%",
        plugins: { legend: { display: options?.showLegend === true } },
        onClick: interaction
          ? (evt, elements) => {
              if (elements.length === 0) return;
              const target = buildRowDrillTarget(query, elements[0]!.index, pieRowKeys, pieLabels);
              if (!target) return;
              const native = evt.native as MouseEvent | undefined;
              openDrillMenu({ x: native?.clientX ?? 0, y: native?.clientY ?? 0 }, target, "rows.0", interaction);
            }
          : undefined,
      },
      plugins: [pieCalloutLabels],
    });
    registerChart(canvas, chart);
  } else {
    const { labels, datasets, rowKeys } = buildRowsColsSeries(schema, query, result);
    const chart = new Chart(canvas, {
      type: widgetType,
      data: {
        labels,
        datasets: datasets.map((d) => ({
          ...d,
          fill: false,
          stack: options?.stacked ? "stack0" : undefined,
        })),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        // 「そのカテゴリの列のどこでも」ヒットするようにする（クリック/ホバーの当たり判定をマークより大きくする）。
        interaction: { mode: "index", intersect: false },
        plugins: { legend: { display: options?.showLegend !== false && datasets.length > 1 } },
        scales: {
          x: { stacked: options?.stacked ?? false },
          y: { stacked: options?.stacked ?? false, beginAtZero: options?.beginAtZero ?? true },
        },
        onClick: interaction
          ? (evt, elements) => {
              if (elements.length === 0) return;
              const target = buildRowDrillTarget(query, elements[0]!.index, rowKeys, labels);
              if (!target) return;
              const native = evt.native as MouseEvent | undefined;
              openDrillMenu({ x: native?.clientX ?? 0, y: native?.clientY ?? 0 }, target, "rows.0", interaction);
            }
          : undefined,
      },
    });
    registerChart(canvas, chart);
  }

  appendNotes(wrap, result);
  return wrap;
}
