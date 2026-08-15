import { NEXT_TIME_BUCKET, bucketRange } from "../engine/axisValues";
import { isToolError, type DashboardTools } from "../mcp/tools";
import type { TimeBucket } from "../types/semantic";
import type { Axis, Filter, Query } from "../types/spec";
import { isMapQuery } from "../types/spec";

/**
 * §10「Phase3以降の候補」に挙げていたドリルダウン（ウィジェットのクリック→フィルタ追加）を、
 * Phase0のうちにライブアプリ限定で前倒し実装したもの。
 * エクスポートされた静的HTML(export/runtimeScript.ts)には生レコードが載らないため、
 * ここでの再集計はできない。ドリルダウンはあくまでライブの DataSource がある画面だけの機能。
 *
 * クリック操作は必ず既存のMCPツール（set_filters/update_widget/render_dashboard）経由で行う。
 * AIが呼ぶのと同じ入口を通すことで、Specの検証・決定論的な再集計をそのまま再利用する。
 */
export type DrillTarget =
  | { kind: "dimension"; field: string; key: string; label: string }
  | { kind: "time"; field: string; bucket: TimeBucket; bucketKey: string; bucketLabel: string };

export type AxisPath = "rows.0" | "rows.1" | "cols.0";

/** 軸定義と、その軸上でクリック/選択された1つの値(key/label)から DrillTarget を組み立てる */
export function buildDrillTargetForAxis(axis: Axis, key: string, label: string): DrillTarget {
  if ("bucket" in axis) {
    return { kind: "time", field: axis.field, bucket: axis.bucket, bucketKey: key, bucketLabel: label };
  }
  return { kind: "dimension", field: axis.field, key, label };
}

/** table/crosstab の行・列ヘッダーセルにドリルダウンのクリックを仕込む共通ヘルパー */
export function attachHeaderDrillClick(
  el: HTMLElement,
  axis: Axis,
  key: string,
  label: string,
  axisPath: AxisPath,
  interaction: DrillContext | undefined,
): void {
  if (!interaction) return;
  el.classList.add("kdm-clickable");
  el.addEventListener("click", (e) => {
    const target = buildDrillTargetForAxis(axis, key, label);
    openDrillMenu({ x: e.clientX, y: e.clientY }, target, axisPath, interaction);
  });
}

export type DrillContext = {
  tools: DashboardTools;
  dashboardId: string;
  widgetId: string;
  /** フィルタやウィジェットのbucketを変更した後、ダッシュボード全体を再描画するためのコールバック */
  onChanged: () => void | Promise<void>;
};

/** widgetId を除いた DrillContext。1つのダッシュボードに対して1個作り、各ウィジェットの描画時に widgetId を足す */
export type InteractionBase = Omit<DrillContext, "widgetId">;

export function forWidget(base: InteractionBase, widgetId: string): DrillContext {
  return { ...base, widgetId };
}

const BUCKET_LABEL_JA: Record<TimeBucket, string> = {
  year: "年別",
  quarter: "四半期別",
  month: "月別",
  week: "週別",
  day: "日別",
};

/** widgetId+axisPath ごとに「ドリル前の元のbucket」を覚えておく（リセット用） */
const originalBucketStore = new Map<string, TimeBucket>();
function originalBucketKey(widgetId: string, axisPath: AxisPath): string {
  return `${widgetId}:${axisPath}`;
}

function getAxis(query: Query, axisPath: AxisPath): Axis | undefined {
  const [slot, idx] = axisPath.split(".") as ["rows" | "cols", string];
  return (slot === "rows" ? query.rows : query.cols)[Number(idx)];
}

function withAxisBucket(query: Query, axisPath: AxisPath, bucket: TimeBucket): Query {
  const [slot, idxStr] = axisPath.split(".") as ["rows" | "cols", string];
  const idx = Number(idxStr);
  const list = slot === "rows" ? query.rows : query.cols;
  const nextList = list.map((a, i) => (i === idx ? { field: a.field, bucket } : a));
  return slot === "rows" ? { ...query, rows: nextList } : { ...query, cols: nextList };
}

async function replaceFieldFilter(ctx: DrillContext, filter: Filter): Promise<void> {
  const spec = await ctx.tools.get_dashboard.handler({ dashboardId: ctx.dashboardId });
  if (isToolError(spec)) return;
  const nextFilters = [...spec.filters.filter((f) => f.field !== filter.field), filter];
  await ctx.tools.set_filters.handler({ dashboardId: ctx.dashboardId, filters: nextFilters });
}

async function removeFieldFilter(ctx: DrillContext, field: string): Promise<void> {
  const spec = await ctx.tools.get_dashboard.handler({ dashboardId: ctx.dashboardId });
  if (isToolError(spec)) return;
  const nextFilters = spec.filters.filter((f) => f.field !== field);
  await ctx.tools.set_filters.handler({ dashboardId: ctx.dashboardId, filters: nextFilters });
}

async function setWidgetBucket(ctx: DrillContext, axisPath: AxisPath, bucket: TimeBucket, rememberOriginal: boolean): Promise<void> {
  const spec = await ctx.tools.get_dashboard.handler({ dashboardId: ctx.dashboardId });
  if (isToolError(spec)) return;
  const widget = spec.widgets.find((w) => w.id === ctx.widgetId);
  if (!widget || isMapQuery(widget.query)) return;
  const axis = getAxis(widget.query, axisPath);
  if (!axis || !("bucket" in axis)) return;

  const key = originalBucketKey(ctx.widgetId, axisPath);
  if (rememberOriginal && !originalBucketStore.has(key)) {
    originalBucketStore.set(key, axis.bucket);
  }
  const nextQuery = withAxisBucket(widget.query, axisPath, bucket);
  await ctx.tools.update_widget.handler({ dashboardId: ctx.dashboardId, widgetId: ctx.widgetId, patch: { query: nextQuery } });
}

async function refresh(ctx: DrillContext): Promise<void> {
  await ctx.tools.render_dashboard.handler({ dashboardId: ctx.dashboardId });
  await ctx.onChanged();
}

type MenuItem = { text: string; run: () => Promise<void> };

function buildMenuItems(target: DrillTarget, axisPath: AxisPath, ctx: DrillContext): MenuItem[] {
  if (target.kind === "dimension") {
    return [
      {
        text: `「${target.label}」で絞り込む`,
        run: async () => {
          await replaceFieldFilter(ctx, { field: target.field, op: "eq", value: target.key });
          await refresh(ctx);
        },
      },
    ];
  }

  const range = bucketRange(target.bucketKey, target.bucket);
  const items: MenuItem[] = [];
  if (range) {
    const endInclusive = new Date(range.end.getTime() - 1000);
    items.push({
      text: "この期間で絞り込む",
      run: async () => {
        await replaceFieldFilter(ctx, { field: target.field, op: "between", from: range.start.toISOString(), to: endInclusive.toISOString() });
        await refresh(ctx);
      },
    });
    items.push({
      text: `${target.bucketLabel} 以降で絞り込む`,
      run: async () => {
        await replaceFieldFilter(ctx, { field: target.field, op: "gte", value: range.start.toISOString() });
        await refresh(ctx);
      },
    });
    items.push({
      text: `${target.bucketLabel} より前で絞り込む`,
      run: async () => {
        await replaceFieldFilter(ctx, { field: target.field, op: "lt", value: range.start.toISOString() });
        await refresh(ctx);
      },
    });

    const nextBucket = NEXT_TIME_BUCKET[target.bucket];
    if (nextBucket) {
      items.push({
        text: `${BUCKET_LABEL_JA[nextBucket]}に見る（ドリルダウン）`,
        run: async () => {
          await replaceFieldFilter(ctx, { field: target.field, op: "between", from: range.start.toISOString(), to: endInclusive.toISOString() });
          await setWidgetBucket(ctx, axisPath, nextBucket, true);
          await refresh(ctx);
        },
      });
    }
  }

  const originalKey = originalBucketKey(ctx.widgetId, axisPath);
  const original = originalBucketStore.get(originalKey);
  if (original && original !== target.bucket) {
    items.push({
      text: `${BUCKET_LABEL_JA[original]}の粒度に戻す`,
      run: async () => {
        await removeFieldFilter(ctx, target.field);
        await setWidgetBucket(ctx, axisPath, original, false);
        originalBucketStore.delete(originalKey);
        await refresh(ctx);
      },
    });
  }

  return items;
}

let openMenuEl: HTMLElement | null = null;
function closeMenu(): void {
  openMenuEl?.remove();
  openMenuEl = null;
  document.removeEventListener("mousedown", handleOutsideClick, true);
  document.removeEventListener("keydown", handleKeydown, true);
}
function handleOutsideClick(e: MouseEvent): void {
  if (openMenuEl && !openMenuEl.contains(e.target as Node)) closeMenu();
}
function handleKeydown(e: KeyboardEvent): void {
  if (e.key === "Escape") closeMenu();
}

/** クリック位置に「絞り込み/ドリルダウン」の小さなメニューを出す */
export function openDrillMenu(anchor: { x: number; y: number }, target: DrillTarget, axisPath: AxisPath, ctx: DrillContext): void {
  closeMenu();
  const items = buildMenuItems(target, axisPath, ctx);
  if (items.length === 0) return;

  const menu = document.createElement("div");
  menu.className = "kdm-drill-menu";
  for (const item of items) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = item.text;
    btn.addEventListener("click", () => {
      closeMenu();
      void item.run();
    });
    menu.appendChild(btn);
  }

  document.body.appendChild(menu);
  const rect = menu.getBoundingClientRect();
  const x = Math.min(anchor.x, window.innerWidth - rect.width - 8);
  const y = Math.min(anchor.y, window.innerHeight - rect.height - 8);
  menu.style.left = `${Math.max(8, x)}px`;
  menu.style.top = `${Math.max(8, y)}px`;

  openMenuEl = menu;
  // 開いた瞬間のクリックイベントで即座に閉じないよう、次のタスクでリスナーを張る
  setTimeout(() => {
    document.addEventListener("mousedown", handleOutsideClick, true);
    document.addEventListener("keydown", handleKeydown, true);
  }, 0);
}
