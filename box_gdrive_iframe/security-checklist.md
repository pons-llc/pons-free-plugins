# box_gdrive_iframe セキュリティチェックリスト

[secureCodingGuideline.md](../secureCodingGuideline.md)の各項目を、本プラグインの実装(`src/js/`, `src/html/config.html`)に照らして確認したもの。実装を変更した場合は該当項目を再確認すること。

最終確認日: 2026-07-09 / 対象コミット: 初回コミット(`0880799`)時点の実装

## コーディング作法

- [x] 文字コードはUTF-8(BOMなし) — 全js/css/htmlファイルの先頭バイトを確認し、BOMなしを確認済み
- [x] グローバル変数を作らず、即時関数/名前空間オブジェクトを使っている — `js/embed-common.js`は`window.BoxGdriveEmbed`という単一の名前空間オブジェクトのみを公開。他のファイルもすべてIIFE内のローカル変数で完結
- [x] 既存のkintoneグローバルオブジェクトを書き換え・参照していない
- [x] kintone内部のid/class属性やDOM構造に依存せず、JavaScript API(`kintone.app.getFormLayout()`, `kintone.plugin.app.getConfig/setConfig()`, `kintone.app.record.getSpaceElement`, `kintone.mobile.app.record.getSpaceElement`)のみを使用している
- [x] `'use strict'`を全JSファイルの先頭で使用している
- N/A — 複数ブラウザでの網羅的な動作確認は行わない方針。外部パッケージを使わずネイティブJS APIのみで実装しているため、ブラウザ間差異のリスクは低いと判断。個別の不具合は利用ユーザーからのIssue報告で対応する

## REST API利用

- N/A — 本プラグインはREST APIを使用せず、JavaScript API(`kintone.app.getFormLayout()`等)のみで実装している(CLAUDE.md開発方針3に準拠)
- 方針 — 今後REST APIが必要になった場合も、外部サーバーとの通信は行わず、kintone自身に対する呼び出しに限り`kintone.api()`(内部向けラッパー)を使用する。生の`fetch`/`XHR`で直接URLを組み立てない

## XSS・CSSインジェクション対策

- [x] ユーザー入力(タブ名、埋め込みURLの値)を`innerHTML`で出力していない。ラベルやメッセージ表示は`textContent`のみを使用(`config.js`のタブボタン、`embed-common.js`の`renderMessage`)
- [x] 埋め込みURL(URLフィールドの値)は`new URL()`でパース可能かを確認し、`https:`のみ許可、さらにサービスごとのホスト許可リスト(`box.com` / `drive.google.com`, `docs.google.com`)を通過したものだけを`iframe.src`に設定している(`embed-common.js`の`buildEmbedUrl`)。ガイドラインの「http/httpsで始まるURLのみ出力」より厳格
- [x] 外部サイトのJavaScript/CSSを読み込んでいない(`manifest.json`はローカルファイルのみを参照)
- [x] プラグインの実行コード(js/css)に外部パッケージ・外部ライブラリを一切使用しない方針(vanilla JSのみ)。ビルド用の`@kintone/cli` / `eslint` / `@cybozu/eslint-config` / `npm-run-all`はローカル開発用のdevDependencyでありプラグイン本体には含まれない
- N/A — `npm audit` — 実行コードに外部パッケージを持たない方針のため実施しない

## 通信・認証情報の取り扱い

- [x] kintone以外のサーバーへの外部通信を一切行わない方針(埋め込みURLはiframe表示のみで、fetch/XHRによる送信は行わない)
- [x] 外部サービスとの認証・APIキーのやり取りを行わない(埋め込みURLはユーザーが手動入力するBox/Googleドライブの共有リンクのみ)
- [x] `kintone.plugin.app.setConfig()`に保存しているのはフィールドコード・スペースID・表示サイズなどの表示設定のみで、認証情報や機密情報は含まれない
- N/A — HTTPS通信/ユーザーID識別/Cookie取得の項目は、外部APIへのリクエストを行わない本プラグインの実装には該当しない

## リダイレクト

- [x] `window.location.href`に渡す値は`kintone.app.getId()`など信頼できる内部値のみで、外部入力を含まない(`config.js`の保存後・キャンセル時の画面遷移)

## 個別確認事項(利用ユーザーへ委ねる項目)

以下は開発側での事前検証は行わず、公開後に利用ユーザーからのフィードバックに委ねる。問題があればGitHub Issueで報告してもらい対応する。

- `iframeEl`の`allow`属性(`"local-network-access *; clipboard-read *; clipboard-write *"`, `embed-common.js`)がBox公式の最新の埋め込みコード仕様と一致しているか
- 「許可されていないホスト」「httpのURL」「不正な文字列」を入力した場合の警告表示・ブロック動作
- 各ブラウザ(Chrome/Edge/Safari等)での表示差異
