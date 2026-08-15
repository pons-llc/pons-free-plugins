/**
 * dataviz スキルの配色formula(§8.2/design.md)に基づく共通トークン。
 * Chart.js の backgroundColor/borderColor と Leaflet のアイコン色は、
 * ここで定義した同じパレットだけを参照する。
 */

export const CATEGORICAL_LIGHT = [
  "#2a78d6", // 1 blue
  "#eb6834", // 2 orange
  "#1baf7a", // 3 aqua
  "#eda100", // 4 yellow
  "#e87ba4", // 5 magenta
  "#008300", // 6 green
  "#4a3aa7", // 7 violet
  "#e34948", // 8 red
] as const;

export const CATEGORICAL_DARK = [
  "#3987e5",
  "#d95926",
  "#199e70",
  "#c98500",
  "#d55181",
  "#008300",
  "#9085e9",
  "#e66767",
] as const;

export const SEQUENTIAL_BLUE = ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#184f95", "#0d366b"] as const;

export const STATUS = {
  good: "#0ca30c",
  warning: "#fab219",
  serious: "#ec835a",
  critical: "#d03b3b",
} as const;

export const CHROME = {
  light: {
    surface: "#fcfcfb",
    page: "#f9f9f7",
    textPrimary: "#0b0b0b",
    textSecondary: "#52514e",
    muted: "#898781",
    gridline: "#e1e0d9",
    baseline: "#c3c2b7",
  },
  dark: {
    surface: "#1a1a19",
    page: "#0d0d0d",
    textPrimary: "#ffffff",
    textSecondary: "#c3c2b7",
    muted: "#898781",
    gridline: "#2c2c2a",
    baseline: "#383835",
  },
} as const;

export function prefersDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches === true;
}

export function seriesColor(index: number, dark = prefersDark()): string {
  const palette = dark ? CATEGORICAL_DARK : CATEGORICAL_LIGHT;
  return palette[index % palette.length]!;
}

export const FONT_FAMILY = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** HTMLエクスポート・アプリ内共通で読み込むCSS変数定義 */
export const THEME_CSS = `
.kdm-root {
  color-scheme: light;
  --kdm-surface: ${CHROME.light.surface};
  --kdm-page: ${CHROME.light.page};
  --kdm-text-primary: ${CHROME.light.textPrimary};
  --kdm-text-secondary: ${CHROME.light.textSecondary};
  --kdm-muted: ${CHROME.light.muted};
  --kdm-gridline: ${CHROME.light.gridline};
  --kdm-baseline: ${CHROME.light.baseline};
  --kdm-font: ${FONT_FAMILY};
}
@media (prefers-color-scheme: dark) {
  .kdm-root {
    color-scheme: dark;
    --kdm-surface: ${CHROME.dark.surface};
    --kdm-page: ${CHROME.dark.page};
    --kdm-text-primary: ${CHROME.dark.textPrimary};
    --kdm-text-secondary: ${CHROME.dark.textSecondary};
    --kdm-muted: ${CHROME.dark.muted};
    --kdm-gridline: ${CHROME.dark.gridline};
    --kdm-baseline: ${CHROME.dark.baseline};
  }
}
.kdm-root {
  background: var(--kdm-page);
  color: var(--kdm-text-primary);
  font-family: var(--kdm-font);
}
.kdm-grid {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: 12px;
  padding: 12px;
}
.kdm-widget {
  background: var(--kdm-surface);
  border: 1px solid var(--kdm-gridline);
  border-radius: 8px;
  padding: 12px;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.kdm-widget h3 {
  margin: 0 0 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--kdm-text-secondary);
}
.kdm-kpi-value {
  font-size: 32px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.kdm-table {
  border-collapse: collapse;
  width: 100%;
  font-size: 13px;
}
.kdm-table th,
.kdm-table td {
  border: 1px solid var(--kdm-gridline);
  padding: 4px 8px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.kdm-table th:first-child,
.kdm-table td:first-child {
  text-align: left;
  font-variant-numeric: normal;
}
.kdm-table tfoot td {
  font-weight: 600;
  background: color-mix(in srgb, var(--kdm-gridline) 40%, transparent);
}
.kdm-note {
  font-size: 11px;
  color: var(--kdm-muted);
  margin-top: 6px;
}
.kdm-canvas-wrap {
  position: relative;
  flex: 1;
  min-height: 180px;
}
.kdm-map {
  flex: 1;
  min-height: 320px;
  border-radius: 4px;
}
.kdm-empty {
  color: var(--kdm-muted);
  font-size: 13px;
  padding: 24px 0;
  text-align: center;
}
.kdm-clickable {
  cursor: pointer;
}
.kdm-clickable:hover {
  background: color-mix(in srgb, var(--kdm-gridline) 50%, transparent);
}
.kdm-drill-menu {
  position: fixed;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  background: var(--kdm-surface);
  border: 1px solid var(--kdm-gridline);
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(11, 11, 11, 0.16);
  padding: 4px;
  min-width: 200px;
  font-family: var(--kdm-font);
}
.kdm-drill-menu button {
  all: unset;
  box-sizing: border-box;
  display: block;
  width: 100%;
  padding: 8px 10px;
  font-size: 13px;
  color: var(--kdm-text-primary);
  border-radius: 5px;
  cursor: pointer;
}
.kdm-drill-menu button:hover,
.kdm-drill-menu button:focus-visible {
  background: color-mix(in srgb, var(--kdm-gridline) 60%, transparent);
}
.kdm-filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 0 12px 12px;
}
.kdm-filter-bar:empty {
  display: none;
}
.kdm-filter-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--kdm-text-primary);
  background: color-mix(in srgb, var(--kdm-gridline) 45%, transparent);
  border: 1px solid var(--kdm-gridline);
  border-radius: 999px;
  padding: 3px 6px 3px 10px;
}
.kdm-filter-chip button {
  all: unset;
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  cursor: pointer;
  color: var(--kdm-muted);
  font-size: 12px;
  line-height: 1;
}
.kdm-filter-chip button:hover,
.kdm-filter-chip button:focus-visible {
  background: color-mix(in srgb, var(--kdm-muted) 30%, transparent);
  color: var(--kdm-text-primary);
}
@media print {
  .kdm-grid {
    display: block;
  }
  .kdm-widget {
    break-inside: avoid;
    margin-bottom: 12px;
  }
}
`;
