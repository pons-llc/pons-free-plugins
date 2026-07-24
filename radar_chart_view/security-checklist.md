# radar_chart_view セキュリティチェックリスト

[secureCodingGuideline.md](../secureCodingGuideline.md)の一般項目(UTF-8/BOMなし・即時関数によるグローバル汚染防止・`'use strict'`・外部スクリプト不使用など)は`box_gdrive_iframe/security-checklist.md`・`gantt_chart_view/security-checklist.md`と同様に満たしている。本プラグイン固有の項目(特に「別タブに開く自己完結HTMLファイルの生成」という他プラグインにない処理)のみ記載する。

最終確認日: 2026-07-24 / 対象: 初回実装時点(Puppeteerによる実環境テストはこのあと実施。`pnpm run upload`・`.env`の実環境ドメインへの接続はこの確認時点ではまだ)

## 生成HTML(別タブ)のXSS対策 — 本プラグインで最もリスクが高い箇所

本プラグインは「レコードの値を含む新しいHTMLドキュメントを丸ごと1つ生成し、別タブとして開く」という、他の表示専用プラグイン(DOM挿入のみ)より一段リスクの高い処理を行う。idea.md記載の設計方針どおり、以下を徹底している。

- [x] 生成HTMLの外殻(`js/lib/html-template.js`の`buildRadarHtmlDocument()`が返す文字列のうち、`<!doctype>`〜`<style>`〜`<body>`の構造・`<script>`タグそのもの)は**完全な固定文字列**で、レコード由来の動的データを一切含まない。動的データの埋め込み箇所は`<script type="application/json" id="radar-data">`の中身1箇所のみ(`__tests__/html-template.test.js`の「returns a full standalone HTML document」で外殻の構造を確認済み)
- [x] 動的データは`JSON.stringify(payload)`でJSON文字列化してから埋め込んでいる。`JSON.stringify()`は`</`をエスケープしないため、レコード値に`</script><script>...`のような文字列が含まれていた場合に`<script type="application/json">`タグから脱出できてしまう問題があるが、`escapeScriptClose()`で`</`を`<\/`に置換してから埋め込むことでこれを防止している(`__tests__/html-template.test.js`の「neutralizes "</script>" inside record-derived string values」「embeds the payload as JSON exactly once, parseable back to the original data」で、エスケープ後も`JSON.parse()`で元の値を正しく復元できること・`</script`という生の文字列が2箇所(自分たちが書いた2つの`<script>`の閉じタグ)以外に出現しないことをテスト済み)
- [x] 埋め込んだJSONは、`js/lib/standalone-page-script.js`の静的スクリプト(完全に固定文字列、動的データを含まない)側で`JSON.parse()`した上で、DOM API(`document.createElement`/`textContent`/`createElementNS`+`textContent`/`setAttribute`)のみで描画する。`innerHTML`・`insertAdjacentHTML`・`document.write`(生成ページ側)は一切使用していない(`__tests__/html-template.test.js`の「never uses innerHTML/insertAdjacentHTML」でテスト済み。`js/lib/standalone-page-script.js`のソース自体にも同文字列は含まれない)
- [x] SVG要素(グリッド線・軸ラベル・系列ポリゴン・凡例)もすべて`document.createElementNS`+属性は`setAttribute`(固定のプロパティ名・数値座標のみ)、テキストは`textContent`で設定しており、SVG内へのHTML注入経路(`foreignObject`等)は使用していない
- [x] `<script>`タグ自体は2つのみ(JSONデータ用の`type="application/json"`、および静的な描画ロジック用)で、いずれもこのファイル(`js/lib/html-template.js`)が組み立てる固定の外殻構造の一部としてのみ出現する

## Blob/window.openの取り扱い

- [x] 生成したHTML文字列は`new Blob([html], { type: 'text/html' })` → `URL.createObjectURL()`でBlob URLを作成し、同一ブラウザ内の新しいタブに開く。外部サーバーへのアップロード・送信は一切行わない(`js/desktop.js`の`navigateToGeneratedHtml`)
- [x] ポップアップブロック対策として選択ボタン押下の同期コールバック内で`window.open('', '_blank')`しているが、この時点では空白ページを開くのみで、レコード由来のデータはまだ何も渡していない(`about:blank`への遷移のみ)。データが揃った後に`win.location.href = blobUrl`で遷移させる設計であり、window.open呼び出し自体にレコード値を含めることはない
- [x] `window.open()`の戻り値(`win`)に対しては`location.href`の設定と`document.title`/`textContent`によるローディングメッセージ表示、`close()`のみを行い、`win.opener`経由の逆方向アクセス(生成タブ側から元のkintone画面を操作する処理)は実装していない(生成HTML側=`js/lib/standalone-page-script.js`は`window.opener`を一切参照しない)

## 設定画面のXSS対策(`js/config.js`)

- [x] フィールドラベル(kintoneの管理者操作でのみ変更可能な値)も、`optionEl.textContent = ...`/`labelEl.textContent = ...`で挿入しており、`innerHTML`は使用していない
- [x] `kintone.plugin.app.setConfig()`へ保存する値は文字列またはJSON文字列化した配列のみで、保存時・読み込み時(`js/lib/config-store.js`)ともにDOMへの直接挿入は行わない

## 設定バリデーション(`js/lib/config-validation.js`)

- [x] 保存時に軸フィールド(3〜8個・重複なし・`NUMBER`型)、グルーピングフィールド(`RADIO_BUTTON`/`DROP_DOWN`型)、目盛数(2〜10の整数)、全件取得上限(1以上の整数)を検証しており、不正な設定値が保存されないようにしている(`__tests__/config-validation.test.js`)
- [x] このバリデーションはあくまで管理者の設定ミス防止(UX上のガード)であり、真の権限境界ではない。仮に設定画面をバイパスして不正な値が`setConfig()`に書き込まれたとしても、`js/lib/series-builder.js`の数値変換(`parseNumberOrZero`)・`js/lib/radar-geometry.js`の`maxValue > 0`ガード等により、描画処理自体が例外を投げたりXSSを起こしたりすることはない(数値以外の値は常に0扱いになるのみ)

## REST API利用(全件取得)

- [x] REST API呼び出しは`js/full-fetch.js`(全件取得)のみで、`kintone.api()`経由(自ドメインのkintoneへの呼び出しに限定)。生の`fetch`/`XHR`は使用していない
- [x] 全件取得(`js/lib/paging-query.js`のクエリ合成 + `js/full-fetch.js`、`gantt_chart_view`から流用)は`offset`・カーソルAPIを使わず、`$id`昇順ページングを採用している。逐次実行(`await`を伴うループ)で、並列で大量リクエストを送信することはない
- [x] 全件取得は件数上限(`config.maxRecords`、既定2000件)を設けており、無制限に取得し続けることはない
- [ ] 件数上限そのものはクライアント側の実装で担保しているに過ぎず、真の安全弁ではない点は`gantt_chart_view`と同様。実環境での大量データに対する挙動確認は、この後実施するPuppeteer E2Eで一部確認する(件数の少ないテストデータのため、大量データでの性能検証は将来課題のまま)

## 認証情報の取り扱い

- [x] 本プラグインは外部サービスとの連携を行わないため、APIキー・パスワード等の認証情報を一切保持しない
- [x] `kintone.api()`はログインユーザー自身のセッションのみを使用しており、APIトークン・`kintone.plugin.app.setProxyConfig()`/`getProxyConfig()`は使用していない

## 権限モデル

- [x] 本プラグインは表示専用(読み取り専用)であり、レコードの作成・更新・削除を一切行わない。全件取得(`GET /k/v1/records.json`)は「アプリのレコード閲覧権限」の範囲でのみ動作し、権限のないレコード・フィールドは応答に含まれない(kintone REST API自体の権限制御に委譲)
- [x] 生成したHTMLファイルはブラウザのローカルタブ上にのみ存在し(Blob URL)、kintone側にもサーバーにも保存されない。ユーザーがブラウザの「名前を付けて保存」で任意の場所に保存した場合、以降のアクセス制御(閲覧権限)は失われる旨は、そのような操作をするユーザー自身の判断に委ねる(idea.mdに既知の制約として明記)

## 個別確認事項(この後のPuppeteer E2Eで確認する項目)

- `kintone.app.getHeaderSpaceElement()`への実際のボタン描画結果、`app.record.index.show`の実発火タイミング
- 実際に生成されたHTMLが新しいタブで正しく開き、コンソールエラーなく描画されること
- 「表示中のレコード」「絞り込み条件の全件」の両方の生成経路が実環境で動作すること
- 問題があれば、公開サイトのリポジトリのGitHub Issueで報告してもらい対応する
