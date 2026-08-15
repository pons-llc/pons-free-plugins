import { createDashboardRuntime, isToolError } from "../mcp/tools";
import { THEME_CSS } from "../render/theme";
import { mountChatPanel } from "./chatPanel";
import { createDashboardPanel } from "./dashboardPanel";
import { KintoneDataSource } from "./DataSourceKintone";
import { openModal } from "./modal";
import { showSetupModal, type SetupResult } from "./setupModal";

const EXTRA_CSS = `
/* THEME_CSS(render/theme.ts)はCSS変数(--kdm-surface等)を.kdm-rootスコープでしか定義しない。
   ドリルダウンメニュー(.kdm-drill-menu)はdocument.bodyに直接追加され.kdm-rootの外に出るため、
   このままだと変数が解決できず背景が透明になり、文字がグラフに重なって読めなくなる
   (render/theme.tsのCHROME定数と同じ値を:rootにも複製し、bodyに直接ぶら下がる要素からも
   解決できるようにする。値そのものはrender/theme.tsを単一の情報源として保つため変更しない)。 */
:root {
  --kdm-surface: #fcfcfb;
  --kdm-page: #f9f9f7;
  --kdm-text-primary: #0b0b0b;
  --kdm-text-secondary: #52514e;
  --kdm-muted: #898781;
  --kdm-gridline: #e1e0d9;
  --kdm-baseline: #c3c2b7;
}
@media (prefers-color-scheme: dark) {
  :root {
    --kdm-surface: #1a1a19;
    --kdm-page: #0d0d0d;
    --kdm-text-primary: #ffffff;
    --kdm-text-secondary: #c3c2b7;
    --kdm-muted: #898781;
    --kdm-gridline: #2c2c2a;
    --kdm-baseline: #383835;
  }
}
.ntd-overlay { position: fixed; inset: 0; z-index: 100000; background: rgba(11,11,11,0.45); display: flex; align-items: center; justify-content: center; }
.ntd-panel { background: var(--kdm-surface); border-radius: 10px; box-shadow: 0 12px 40px rgba(0,0,0,0.28); display: flex; flex-direction: column; overflow: hidden; max-width: 96vw; max-height: 92vh; }
.ntd-panel-header { display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border-bottom: 1px solid var(--kdm-gridline); font-weight: 600; }
.ntd-panel-close { all: unset; cursor: pointer; font-size: 18px; line-height: 1; padding: 4px 8px; border-radius: 6px; }
.ntd-panel-close:hover { background: var(--kdm-gridline); }
.ntd-panel-body { flex: 1; min-height: 0; overflow: auto; }
.ntd-setup-form { display: flex; flex-direction: column; gap: 12px; padding: 16px; }
.ntd-setup-form label { display: flex; flex-direction: column; gap: 4px; font-size: 13px; font-weight: 600; }
.ntd-setup-form select, .ntd-setup-form input { font: inherit; padding: 6px 8px; border-radius: 6px; border: 1px solid var(--kdm-baseline); }
.ntd-setup-note { font-size: 12px; color: var(--kdm-text-secondary); margin: 0; }
.ntd-setup-disclosure { border: 1px solid var(--kdm-gridline); border-radius: 8px; padding: 10px 12px; background: var(--kdm-page); }
.ntd-setup-disclosure-title { font-size: 12px; font-weight: 600; margin: 0 0 6px; }
.ntd-setup-disclosure ul { margin: 0; padding-left: 18px; font-size: 12px; color: var(--kdm-text-secondary); }
.ntd-setup-disclosure ul li { margin: 2px 0; }
.ntd-setup-disclosure-note { font-size: 11px; color: var(--kdm-muted); margin: 6px 0 0; }
.ntd-setup-consent { display: flex !important; flex-direction: row !important; align-items: flex-start; gap: 8px; font-size: 12px; font-weight: 400 !important; }
.ntd-setup-consent input[type="checkbox"] { width: auto; padding: 0; margin: 2px 0 0; }
.ntd-setup-error { font-size: 12px; color: #d03b3b; margin: 0; }
.ntd-setup-actions { display: flex; justify-content: flex-end; gap: 8px; }
.ntd-setup-actions button { font: inherit; padding: 6px 14px; border-radius: 6px; border: 1px solid var(--kdm-baseline); background: var(--kdm-surface); cursor: pointer; }
.ntd-workspace { display: grid; grid-template-columns: 380px 1fr; height: 100%; min-height: 0; }
.ntd-chat-col { display: flex; flex-direction: column; border-right: 1px solid var(--kdm-gridline); min-width: 0; min-height: 0; }
.ntd-dash-col { overflow-y: auto; min-width: 0; }
.ntd-chat-messages { flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 10px; min-height: 0; }
.ntd-chat-msg { max-width: 90%; padding: 8px 10px; border-radius: 10px; font-size: 13px; line-height: 1.5; white-space: pre-wrap; }
.ntd-chat-msg.user { align-self: flex-end; background: color-mix(in srgb, var(--kdm-baseline) 35%, var(--kdm-surface)); }
.ntd-chat-msg.model { align-self: flex-start; background: var(--kdm-surface); border: 1px solid var(--kdm-gridline); }
.ntd-chat-msg.system { align-self: center; color: var(--kdm-muted); font-size: 12px; background: none; }
.ntd-chat-msg.error { align-self: flex-start; background: color-mix(in srgb, #d03b3b 15%, var(--kdm-surface)); border: 1px solid #d03b3b; }
.ntd-tool-log { align-self: flex-start; max-width: 92%; font-size: 11px; font-family: ui-monospace, monospace; color: var(--kdm-muted); }
.ntd-tool-log summary { cursor: pointer; }
.ntd-tool-log pre { white-space: pre-wrap; margin: 4px 0 0; }
.ntd-chat-input-row { display: flex; gap: 8px; padding: 12px; border-top: 1px solid var(--kdm-gridline); }
.ntd-chat-input-row textarea { flex: 1; resize: none; font: inherit; font-size: 13px; padding: 8px; border-radius: 8px; border: 1px solid var(--kdm-baseline); background: var(--kdm-surface); color: var(--kdm-text-primary); }
.ntd-chat-input-row button { font: inherit; padding: 0 16px; border-radius: 8px; border: 1px solid var(--kdm-baseline); background: var(--kdm-surface); cursor: pointer; }
.ntd-chat-input-row button:disabled { opacity: 0.5; cursor: default; }
.ntd-toolbar-btn { font: inherit; padding: 4px 12px; border-radius: 6px; border: 1px solid #c3c2b7; background: #fff; cursor: pointer; margin: 0 4px; }
.ntd-dash-header { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 10px 12px; border-bottom: 1px solid var(--kdm-gridline); position: sticky; top: 0; background: var(--kdm-surface); z-index: 1; }
.ntd-dash-title { font-weight: 600; font-size: 13px; color: var(--kdm-text-secondary); }
.ntd-download-btn { font: inherit; padding: 5px 12px; border-radius: 6px; border: 1px solid var(--kdm-baseline); background: var(--kdm-surface); cursor: pointer; }
.ntd-download-btn:disabled { opacity: 0.5; cursor: default; }
/* ドリルダウンメニュー(render/theme.tsのTHEME_CSS由来、z-index:1000)はdocument.bodyに直接
   追加されるposition:fixed要素で、同じくbody直下にfixedで追加される.ntd-overlay(z-index:100000)の
   下に隠れてクリックできなくなる。ワークスペースはこのオーバーレイの中でしか開かないため、
   常にオーバーレイより上に来るよう上書きする。 */
.kdm-drill-menu { z-index: 100010 !important; }
`;

let stylesInjected = false;
function ensureStyles(): void {
  if (stylesInjected) return;
  stylesInjected = true;
  const style = document.createElement("style");
  style.textContent = THEME_CSS + EXTRA_CSS;
  document.head.appendChild(style);
}

function openDashboardWorkspace(setup: SetupResult): void {
  const appId = String(kintone.app.getId());
  // kintone.app.getQueryCondition() は同期API。一覧画面で絞り込んでいなければ空文字列("=現在のクエリ"は全件)。
  const baseQuery: string = kintone.app.getQueryCondition() ?? "";
  const dataSource = new KintoneDataSource({ appId, baseQuery });
  const { tools, specStore, resultStore } = createDashboardRuntime(dataSource);

  const modal = openModal({
    title: "AIダッシュボード for kintone",
    width: "min(1400px, 96vw)",
    height: "min(880px, 92vh)",
    closableByBackdrop: false,
  });

  const workspace = document.createElement("div");
  workspace.className = "ntd-workspace";

  const chatCol = document.createElement("div");
  chatCol.className = "ntd-chat-col";

  let dashboardId: string | undefined;

  const dashCol = document.createElement("div");
  dashCol.className = "ntd-dash-col";

  const dashHeader = document.createElement("div");
  dashHeader.className = "ntd-dash-header";
  const dashTitle = document.createElement("span");
  dashTitle.className = "ntd-dash-title";
  dashTitle.textContent = "ダッシュボード";
  const downloadBtn = document.createElement("button");
  downloadBtn.type = "button";
  downloadBtn.className = "ntd-download-btn";
  downloadBtn.textContent = "ダウンロード";
  dashHeader.append(dashTitle, downloadBtn);

  const filterBar = document.createElement("div");
  filterBar.className = "kdm-filter-bar";
  const grid = document.createElement("div");
  grid.className = "kdm-grid";
  const empty = document.createElement("div");
  empty.className = "kdm-empty";
  empty.style.padding = "48px 12px";
  empty.textContent = "まだダッシュボードがありません。左のチャットで作成を依頼してください。";
  dashCol.append(dashHeader, empty, filterBar, grid);

  workspace.append(chatCol, dashCol);
  modal.body.appendChild(workspace);

  const panel = createDashboardPanel({ dataSource, tools, specStore, resultStore, filterBarEl: filterBar, gridEl: grid });

  async function refresh(): Promise<void> {
    if (!dashboardId) return;
    empty.style.display = "none";
    await panel.render(dashboardId);
  }

  // ダウンロードはAIのツール呼び出しからは実行しない(mountChatPanelにはexport_htmlを含まないAiToolsだけを渡す)。
  // 実際のファイル出力は、この常設ボタンをユーザーが押したときだけ、完全な tools.export_html を直接呼んで行う。
  downloadBtn.addEventListener("click", () => {
    void (async () => {
      if (!dashboardId) {
        window.alert("まだダッシュボードがありません。先にチャットで作成してください。");
        return;
      }
      downloadBtn.disabled = true;
      try {
        let result = await tools.export_html.handler({ dashboardId, confirmed: false });
        if (isToolError(result) && result.code === "MAP_EXPORT_NEEDS_CONFIRMATION") {
          const proceed = window.confirm(`${result.message}\n\nこのままダウンロードしますか?`);
          if (!proceed) return;
          result = await tools.export_html.handler({ dashboardId, confirmed: true });
        }
        if (isToolError(result)) {
          window.alert(`ダウンロードに失敗しました: ${result.message}`);
        }
      } finally {
        downloadBtn.disabled = false;
      }
    })();
  });

  const { export_html: _exportHtmlTool, ...aiTools } = tools;

  mountChatPanel({
    container: chatCol,
    tools: aiTools,
    providerId: setup.providerId,
    model: setup.model,
    apiKey: setup.apiKey,
    onDashboardId: (id) => {
      dashboardId = id;
    },
    onChanged: () => void refresh(),
  });
}

function addToolbarButton(): void {
  const space = kintone.app.getHeaderMenuSpaceElement();
  if (!space) return;
  // app.record.index.show は絞り込み・ページ送り・並び替えのたびに再発火するため、多重挿入を避ける。
  if (space.querySelector(".ntd-toolbar-btn")) return;

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "ntd-toolbar-btn";
  btn.textContent = "現在のクエリでダッシュボードを作成";
  btn.addEventListener("click", () => {
    void (async () => {
      const setup = await showSetupModal();
      if (!setup) return;
      openDashboardWorkspace(setup);
    })();
  });
  space.appendChild(btn);
}

kintone.events.on("app.record.index.show", (event: unknown) => {
  ensureStyles();
  addToolbarButton();
  return event;
});
