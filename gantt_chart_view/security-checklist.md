# gantt_chart_view セキュリティチェックリスト

[secureCodingGuideline.md](../secureCodingGuideline.md)の一般項目(UTF-8/BOMなし・即時関数によるグローバル汚染防止・`'use strict'`・外部スクリプト不使用など)は`fiscal_year_numbering/security-checklist.md`・`box_gdrive_iframe/security-checklist.md`と同様に満たしている。本プラグイン固有の項目のみ記載する。

最終確認日: 2026-07-09 / 対象: 初回実装時点(Puppeteerによる実環境テストは未実施。`pnpm run upload`・`.env`の実環境ドメインへの接続はまだ行っていない)

## XSS対策(ガント描画: `js/gantt-render.js`)

ガントチャートは、レコードのフィールド値(行ラベル・バー内ラベル・グループ見出し)を直接DOMへ挿入する箇所が多く、本プラグインで最もXSSリスクが高い部分。

- [x] レコードの値に由来する文字列は、すべて `node.textContent = text` を経由して挿入している(`js/gantt-render.js` の `el()` ヘルパー関数に集約)。`innerHTML`・`insertAdjacentHTML`・`document.write` は本プラグイン全体(`js/`・`html/`)で一切使用していない(`grep -rn "innerHTML\|insertAdjacentHTML\|document.write" js/ html/` で未使用を確認済み)
- [x] バー要素の `title` 属性(ツールチップ)にもレコード値由来の文字列を設定しているが、DOM APIの `element.title = text` によるプロパティ代入であり、HTML文字列の結合ではないため、ブラウザ側で属性値として適切にエスケープされる(`<`や`"`をHTMLとして解釈させる余地がない)
- [x] グループ見出し(`${group.label || '(すべて)'} (${group.rows.length}件)`)はテンプレートリテラルで組み立てているが、最終的に `el()` 経由で `textContent` に代入しており、HTMLとして解釈されない
- [x] 色分けに使う値(`js/lib/color-assignment.js` の `resolveColorKey`)は、色パレット配列のインデックス選択にのみ使うキーであり、CSSやHTMLへ値そのものを埋め込むことはない(CSSインジェクション対策。パレットは固定配列 `DEFAULT_PALETTE` のみを使用し、フィールド値をCSSの値として直接使用しない)
- [x] `kintone.app.getHeaderMenuSpaceElement()` で取得した要素へは、`clearElement()`(`removeChild`ループ、`innerHTML = ''`は使わない)でクリアしたうえで、`document.createElement`で組み立てたDOM要素のみを`appendChild`で追加している。取得した要素はkintoneのCSSの影響を受ける場合がある(ドキュメント記載事項)ため、独自クラス名(`gcv-`プレフィックス)で見た目を明示的に指定し、既存のkintoneのクラス名・DOM構造には一切依存していない

## 設定画面のXSS対策(`js/config.js`)

- [x] フィールドラベル・一覧名など、kintoneの管理者操作でのみ変更可能な値についても、`optionEl.textContent = ...` / `labelEl.textContent = ...` で挿入しており、`innerHTML`は使用していない(管理者操作のみで変更可能な値であっても、多層防御としてエスケープを徹底する方針)
- [x] `kintone.plugin.app.setConfig()` へ保存する値はすべて `JSON.stringify()` した文字列であり、保存時・読み込み時(`js/lib/config-store.js`)ともにDOMへの直接挿入は行わない

## REST API利用(全件取得・一覧列挙)

- [x] REST API呼び出しは`js/full-fetch.js`(全件取得)・`js/desktop.js`(一覧列挙のキャッシュ取得)・`js/config.js`(一覧列挙)の3箇所のみで、いずれも`kintone.api()`経由(自ドメインのkintoneへの呼び出しに限定)。生の`fetch`/`XHR`は使用していない
- [x] 全件取得(`js/lib/paging-query.js`のクエリ合成 + `js/full-fetch.js`)は`offset`・カーソルAPIを使わず、`$id`昇順ページング(plugin_idea_plan.md 共通の全件取得方針)を採用している。逐次(`await`を伴うループ)で1リクエストずつ実行しており、並列で大量リクエストを送信することはない(secureCodingGuideline.md「短時間で大量のリクエスト送信を避ける」対応)
- [x] `GET /k/v1/app/views.json`(一覧列挙)は、JavaScript APIに相当する機能がないため`kintone.api()`を使用している(CLAUDE.md方針3に準拠)。`js/desktop.js`では`appId`単位でキャッシュ(`appViewsCache`)し、ページ送り・ソート・絞り込みのたびに`app.record.index.show`が発火しても同じリクエストを繰り返し送らないようにしている
- [x] 全件取得は件数上限(`config.maxRecords`、既定2000件)を設けており、無制限に取得し続けることはない
- [ ] 全件取得の件数上限そのものはクライアント側の実装で担保しているに過ぎず、真の安全弁ではない(悪意ある改変や設定ミスで極端に大きい上限値を設定された場合の挙動は未検証)。実環境での大量データに対する挙動確認は、Puppeteerによる実環境テスト(未実施)で確認する

## 認証情報の取り扱い

- [x] 本プラグインは外部サービスとの連携を行わないため、APIキー・パスワード等の認証情報を一切保持しない(`kintone.plugin.app.setConfig()`に保存するのは対象一覧の設定情報のみで、認証情報は含まれない)
- [x] `kintone.api()`はログインユーザー自身のセッションのみを使用しており、APIトークン・`kintone.plugin.app.setProxyConfig()`/`getProxyConfig()`は使用していない

## URLの取り扱い

- [x] `kintone.api.url()`を使用してkintoneのURLを取得しており、URLを文字列結合で組み立てていない(secureCodingGuideline.md「URLの取得」に準拠)
- [x] 外部からの入力値(レコード値)を用いて`location.href`・`window.open`等のURLを動的生成する処理は存在しない(表示専用プラグインのため、画面遷移を伴う操作自体が設定画面のCancel/Save後の固定パス遷移のみ)

## 権限モデル

- [x] 本プラグインは表示専用(読み取り専用)であり、レコードの作成・更新・削除を一切行わない。全件取得(`GET /k/v1/records.json`)は「アプリのレコード閲覧権限」の範囲でのみ動作し、権限のないレコード・フィールドは応答に含まれない(kintone REST API自体の権限制御に委譲)
- [x] 全件取得ボタンの有効/無効は設定画面(管理者操作)でのみ切り替えられ、一般ユーザーの操作では変更できない。ただし、ボタンの表示/非表示自体はクライアント側の表示ゲートであり、真の権限境界ではない(全件取得APIそのものが閲覧権限に従うため、この点のリスクは限定的)

## 個別確認事項(利用ユーザーへ委ねる項目・将来の実環境テストで確認する項目)

- Puppeteerによる実環境テスト(CLAUDE.md項目6)は本タスクのスコープ外のため未実施。`kintone.app.getHeaderMenuSpaceElement()`への実際の描画結果、`app.record.index.show`の実発火タイミング、`GET /k/v1/app/views.json`の実際のレスポンス形式(特にビルトイン「すべて」ビューが本当に応答へ含まれないか)は、実環境で改めて確認する
- 大量データ(数千件規模)を全件取得した際の実ブラウザでの描画性能・メモリ使用量は未検証(idea.mdの「将来課題: 仮想スクロール未実装」を参照)
- 問題があれば、公開サイトのリポジトリのGitHub Issueで報告してもらい対応する
