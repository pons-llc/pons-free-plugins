import { isToolError } from "../mcp/tools";
import { getProvider } from "../providers";
import type { AiTools, ProviderId, ToolCallLog } from "../providers";

const SYSTEM_INSTRUCTION = `あなたはkintoneアプリの画面に組み込まれたダッシュボード作成AIエージェントです。
ユーザーの依頼に応じて、用意されたツール(関数)だけを使ってダッシュボードを組み立てます。

厳守すること:
- 生のレコードは一切見えません。スキーマと集計結果の要約だけを根拠に判断してください。
- HTMLや文字列を自分で組み立てることはありません。ウィジェットの種類とクエリ(Spec)をツール呼び出しで指定するだけです。
- 対象データは、ユーザーがkintone一覧画面で絞り込んでいた「現在のクエリ」に一致するレコードだけです。
- 基本の流れ: まず describe_app で使える軸・指標・時間フィールド・地図候補・質問例を確認する。次に create_dashboard でダッシュボードを作る。次に add_widget を1回1ウィジェットずつ呼ぶ(複数まとめて頼まれても1個ずつ)。最後に render_dashboard を呼んで集計を実行する。
- add_widget や update_widget がエラーを返したら、message と alternatives を読んで指定を直し、同じ間違いを繰り返さないでください。
- ユーザーが specific な指示をしない場合は、時系列・内訳・クロス集計など性質の異なるウィジェットを数個組み合わせ、バランスの良いダッシュボードにしてください。
- 一通り作業を終えたら render_dashboard を呼び、最後に日本語で簡潔に「何を作ったか」をユーザーに伝えてください。ダッシュボードはこの画面を閉じると消えること、残したい場合は右側のダッシュボード欄にある「ダウンロード」ボタンでHTMLとして保存できることも伝えてください(このダウンロードはあなた自身では実行できません。ユーザーがボタンを押す必要があります)。
- ツールが返すエラーコードは自己修正のためのヒントです。分からなければユーザーに聞かず、まず自分で別の指定を試してください。`;

export function mountChatPanel(opts: {
  container: HTMLElement;
  tools: AiTools;
  providerId: ProviderId;
  model: string;
  apiKey: string;
  onDashboardId: (id: string) => void;
  onChanged: () => void;
}): void {
  const messagesEl = document.createElement("div");
  messagesEl.className = "ntd-chat-messages";

  const inputRow = document.createElement("div");
  inputRow.className = "ntd-chat-input-row";
  const textarea = document.createElement("textarea");
  textarea.rows = 2;
  textarea.placeholder = "例: 案件の状況を一目で把握できるダッシュボードを作って(Shift+Enterで送信)";
  const sendBtn = document.createElement("button");
  sendBtn.type = "button";
  sendBtn.textContent = "送信";
  inputRow.append(textarea, sendBtn);

  opts.container.append(messagesEl, inputRow);

  function appendMessage(role: "user" | "model" | "system" | "error", text: string): void {
    const el = document.createElement("div");
    el.className = `ntd-chat-msg ${role}`;
    el.textContent = text;
    messagesEl.appendChild(el);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function appendToolLog(log: ToolCallLog): void {
    const details = document.createElement("details");
    details.className = "ntd-tool-log";
    const summary = document.createElement("summary");
    const failed = isToolError(log.result);
    summary.textContent = `🔧 ${log.name}${failed ? ` — ${(log.result as { code: string }).code}` : ""}`;
    const pre = document.createElement("pre");
    pre.textContent = `in:  ${JSON.stringify(log.args)}\nout: ${JSON.stringify(log.result)}`;
    details.append(summary, pre);
    messagesEl.appendChild(details);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  const provider = getProvider(opts.providerId);
  const session = provider.createSession({
    apiKey: opts.apiKey,
    model: opts.model,
    systemInstruction: SYSTEM_INSTRUCTION,
    tools: opts.tools,
  });

  let busy = false;

  async function send(): Promise<void> {
    const text = textarea.value.trim();
    if (!text || busy) return;
    textarea.value = "";
    appendMessage("user", text);
    busy = true;
    sendBtn.disabled = true;
    sendBtn.textContent = "考え中…";

    const result = await session.sendUserMessage(text, (log) => {
      appendToolLog(log);
      if (log.name === "create_dashboard" && !isToolError(log.result)) {
        const out = log.result as { dashboardId?: string };
        if (out.dashboardId) opts.onDashboardId(out.dashboardId);
      }
      opts.onChanged();
    });

    if (result.error) {
      appendMessage("error", result.error);
    } else if (result.finalText) {
      appendMessage("model", result.finalText);
    }
    opts.onChanged();

    busy = false;
    sendBtn.disabled = false;
    sendBtn.textContent = "送信";
    textarea.focus();
  }

  // 送信はShift+Enterのみ。素のEnterはテキストエリアの改行に任せる
  // (IME変換確定のEnterと送信が衝突する問題も、これで根本的に起きなくなる)。
  sendBtn.addEventListener("click", () => void send());
  textarea.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" || !e.shiftKey) return;
    e.preventDefault();
    void send();
  });

  appendMessage("system", "現在の一覧の絞り込み結果について、見たいダッシュボードを話しかけてください。");
  textarea.focus();
}
