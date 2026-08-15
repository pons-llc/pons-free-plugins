export type ModalHandle = { panel: HTMLElement; body: HTMLElement; close: () => void };

/**
 * kintone.createDialog() はダイアログ本文が小さめの中央ボックスに収まる想定のAPIで、
 * チャット+ダッシュボードの2カラムを100vh近くで表示するワークスペースには手狭。
 * そのためネイティブダイアログは使わず、独自のフルスクリーンに近いオーバーレイを都度生成する。
 */
export function openModal(opts: {
  title: string;
  width: string;
  height: string;
  closableByBackdrop?: boolean;
  onClose?: () => void;
}): ModalHandle {
  const overlay = document.createElement("div");
  overlay.className = "ntd-overlay";

  const panel = document.createElement("div");
  panel.className = "ntd-panel kdm-root";
  panel.style.width = opts.width;
  panel.style.height = opts.height;

  const header = document.createElement("div");
  header.className = "ntd-panel-header";
  const titleEl = document.createElement("span");
  titleEl.className = "ntd-panel-title";
  titleEl.textContent = opts.title;
  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "ntd-panel-close";
  closeBtn.setAttribute("aria-label", "閉じる");
  closeBtn.textContent = "×";
  header.append(titleEl, closeBtn);

  const body = document.createElement("div");
  body.className = "ntd-panel-body";

  panel.append(header, body);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  let closed = false;
  function close(): void {
    if (closed) return;
    closed = true;
    document.removeEventListener("keydown", onKeydown);
    overlay.remove();
    opts.onClose?.();
  }

  function onKeydown(e: KeyboardEvent): void {
    if (e.key === "Escape") close();
  }
  document.addEventListener("keydown", onKeydown);

  closeBtn.addEventListener("click", close);
  if (opts.closableByBackdrop) {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close();
    });
  }

  return { panel, body, close };
}
