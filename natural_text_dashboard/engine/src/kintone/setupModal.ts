import { PROVIDERS } from "../providers";
import type { ProviderId } from "../providers";
import { openModal } from "./modal";

export type SetupResult = { providerId: ProviderId; model: string; apiKey: string };

/**
 * ボタン押下ごとに毎回表示する接続設定モーダル。AIプロバイダ・モデル・APIキーを入力させる。
 * APIキーはどこにも保存しない(localStorage/sessionStorage/kintoneのプラグイン設定いずれも不使用)。
 * このモーダルを閉じてしまえばJSの変数ごと破棄される。
 */
export function showSetupModal(): Promise<SetupResult | null> {
  return new Promise((resolve) => {
    let settled = false;
    const settle = (value: SetupResult | null): void => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    const modal = openModal({
      title: "AIダッシュボード for kintone — 接続設定",
      width: "min(480px, 92vw)",
      height: "auto",
      closableByBackdrop: true,
      onClose: () => settle(null),
    });

    const form = document.createElement("form");
    form.className = "ntd-setup-form";

    const note = document.createElement("p");
    note.className = "ntd-setup-note";
    note.textContent =
      "入力したAPIキーは保存されません。このダッシュボードを開いている間だけブラウザのメモリ上で使い、閉じると破棄されます。";

    const providerLabel = document.createElement("label");
    providerLabel.textContent = "AIプロバイダ";
    const providerSelect = document.createElement("select");
    for (const p of PROVIDERS) {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.label;
      providerSelect.appendChild(opt);
    }
    providerLabel.appendChild(providerSelect);

    const modelLabel = document.createElement("label");
    modelLabel.textContent = "モデル";
    const modelSelect = document.createElement("select");
    modelLabel.appendChild(modelSelect);

    // 分間のリクエスト数上限はモデル固有の値ではなく、APIキーの契約プラン(無料枠か有料か)によって
    // 大きく変わる。特定の数値をモデル名に決め打ちで表示すると誤解を招くため、ここでは一般的な
    // 注意書きに留める(labelの外に出し、select自体のアクセシブルネームに巻き込まれないようにする)。
    const modelNote = document.createElement("p");
    modelNote.className = "ntd-setup-note";
    modelNote.textContent =
      "無料枠のAPIキーは分間のリクエスト数が少なく設定されていることが多く、エラーになる場合があります。「Lite」「mini」等の軽量モデルは無料枠でも制限に達しにくい傾向があります。";

    function refreshModelOptions(): void {
      const provider = PROVIDERS.find((p) => p.id === providerSelect.value) ?? PROVIDERS[0]!;
      modelSelect.innerHTML = "";
      for (const m of provider.modelChoices) {
        const opt = document.createElement("option");
        opt.value = m.value;
        opt.textContent = m.label;
        modelSelect.appendChild(opt);
      }
      modelSelect.value = provider.defaultModel;
    }
    providerSelect.addEventListener("change", refreshModelOptions);
    refreshModelOptions();

    const keyLabel = document.createElement("label");
    keyLabel.textContent = "APIキー";
    const keyInput = document.createElement("input");
    keyInput.type = "password";
    keyInput.autocomplete = "off";
    keyInput.required = true;
    keyInput.placeholder = "sk-... / AIza... など";
    keyLabel.appendChild(keyInput);

    // secureCodingGuideline.mdのレビュー(security-checklist.md参照)を受けて追加。
    // 生レコードは送信しないが(P1原則)、フィールド名・絞り込み条件・集計値は選択したAIプロバイダに
    // 送信されるため、実際にAPIキーを入力する利用者自身がその場で内容を確認・同意できるようにする
    // (config.htmlの管理者向け説明だけでは、ボタンを押す一般利用者の目に触れないため不十分と判断)。
    const disclosure = document.createElement("div");
    disclosure.className = "ntd-setup-disclosure";
    const disclosureTitle = document.createElement("p");
    disclosureTitle.className = "ntd-setup-disclosure-title";
    disclosureTitle.textContent = "選択したAIプロバイダに送信される内容";
    const disclosureList = document.createElement("ul");
    for (const text of [
      "このアプリのフィールド名・種類",
      "現在の一覧の絞り込み条件(フィールド名と値)",
      "チャットで入力した依頼文",
      "集計結果(件数・合計・平均などの数値、グラフの軸ラベル)",
    ]) {
      const li = document.createElement("li");
      li.textContent = text;
      disclosureList.appendChild(li);
    }
    const disclosureNote = document.createElement("p");
    disclosureNote.className = "ntd-setup-disclosure-note";
    disclosureNote.textContent = "レコードの生データそのものは送信しません。送信先は上で選んだAIプロバイダの外部サーバーです。";
    disclosure.append(disclosureTitle, disclosureList, disclosureNote);

    const consentLabel = document.createElement("label");
    consentLabel.className = "ntd-setup-consent";
    const consentCheckbox = document.createElement("input");
    consentCheckbox.type = "checkbox";
    consentCheckbox.required = true;
    const consentText = document.createElement("span");
    consentText.textContent = "上記の内容が外部のAIプロバイダに送信されることに同意します";
    consentLabel.append(consentCheckbox, consentText);

    const errorEl = document.createElement("p");
    errorEl.className = "ntd-setup-error";
    errorEl.hidden = true;

    const actions = document.createElement("div");
    actions.className = "ntd-setup-actions";
    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.textContent = "キャンセル";
    const submitBtn = document.createElement("button");
    submitBtn.type = "submit";
    submitBtn.textContent = "ダッシュボードを開く";
    actions.append(cancelBtn, submitBtn);

    form.append(note, providerLabel, modelLabel, modelNote, keyLabel, disclosure, consentLabel, errorEl, actions);
    modal.body.appendChild(form);

    cancelBtn.addEventListener("click", () => modal.close());
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const apiKey = keyInput.value.trim();
      if (!apiKey) {
        errorEl.textContent = "APIキーを入力してください。";
        errorEl.hidden = false;
        return;
      }
      settle({ providerId: providerSelect.value as ProviderId, model: modelSelect.value, apiKey });
      modal.close();
    });

    keyInput.focus();
  });
}
