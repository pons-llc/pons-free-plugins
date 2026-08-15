import type { Chart } from "chart.js";
import type { Map as LeafletMap } from "leaflet";

/**
 * §8.2「ウィジェット削除時に必ず destroy() する（canvasのリーク防止）」を満たすための小さな台帳。
 * renderChart/renderMap は (Query, Result) => HTMLElement の純関数のままにしたいので、
 * 生成したライブラリインスタンスをDOM要素に紐づけて覚えておき、その要素をDOMから外す前に
 * 呼び出し側（main.ts の再描画ループ）が disposeWidgetResources() でまとめて破棄する。
 */
const chartInstances = new WeakMap<HTMLCanvasElement, Chart>();
const mapInstances = new WeakMap<HTMLElement, LeafletMap>();

export function registerChart(canvas: HTMLCanvasElement, chart: Chart): void {
  chartInstances.set(canvas, chart);
}

export function registerMap(el: HTMLElement, map: LeafletMap): void {
  mapInstances.set(el, map);
}

/** container配下の canvas / 地図要素について、登録済みのインスタンスを破棄する。DOMから取り除く前に呼ぶこと。 */
export function disposeWidgetResources(container: ParentNode): void {
  container.querySelectorAll("canvas").forEach((canvas) => {
    const chart = chartInstances.get(canvas as HTMLCanvasElement);
    if (chart) {
      chart.destroy();
      chartInstances.delete(canvas as HTMLCanvasElement);
    }
  });
  container.querySelectorAll(".kdm-map").forEach((el) => {
    const map = mapInstances.get(el as HTMLElement);
    if (map) {
      map.remove();
      mapInstances.delete(el as HTMLElement);
    }
  });
}
