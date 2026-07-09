# box_gdrive_iframe セキュリティチェックリスト

[secureCodingGuideline.md](../secureCodingGuideline.md)の各項目を、本プラグインの実装(`src/js/`, `src/html/config.html`)に照らして確認したもの。実装を変更した場合は該当項目を再確認すること。

最終確認日: 2026-07-09 / 対象コミット: 初回コミット(`0880799`)時点の実装

## コーディング作法

- [x] 文字コードはUTF-8(BOMなし) — 全js/css/htmlファイルの先頭バイトを確認し、BOMなしを確認済み
- [x] グローバル変数を作らず、即時関数/名前空間オブジェクトを使っている — `js/embed-common.js`は`window.BoxGdriveEmbed`という単一の名前空間オブジェクトのみを公開。他のファイルもすべてIIFE内のローカル変数で完結
- [x] 既存のkintoneグローバルオブジェクトを書き換え・参照していない
- [x] kintone内部のid/class属性やDOM構造に依存せず、JavaScript API(`kintone.app.getFormLayout()`, `kintone.plugin.app.getConfig/setConfig()`, `kintone.app.record.getSpaceElement`, `kintone.mobile.app.record.getSpaceElement`)のみを使用している
- [x] `'use strict'`を全JSファイルの先頭で使用している
- [ ] 複数ブラウザ(Chrome/Edge/Safari等)での動作確認 — 未実施。実環境テスト時に確認する

## REST API利用

- N/A — 本プラグインはREST APIを使用せず、JavaScript API(`kintone.app.getFormLayout()`等)のみで実装している(CLAUDE.md開発方針3に準拠)

## XSS・CSSインジェクション対策

- [x] ユーザー入力(タブ名、埋め込みURLの値)を`innerHTML`で出力していない。ラベルやメッセージ表示は`textContent`のみを使用(`config.js`のタブボタン、`embed-common.js`の`renderMessage`)
- [x] 埋め込みURL(URLフィールドの値)は`new URL()`でパース可能かを確認し、`https:`のみ許可、さらにサービスごとのホスト許可リスト(`box.com` / `drive.google.com`, `docs.google.com`)を通過したものだけを`iframe.src`に設定している(`embed-common.js`の`buildEmbedUrl`)。ガイドラインの「http/httpsで始まるURLのみ出力」より厳格
- [x] 外部サイトのJavaScript/CSSを読み込んでいない(`manifest.json`はローカルファイルのみを参照)
- [x] 依存パッケージは`@kintone/cli` / `eslint` / `@cybozu/eslint-config` / `npm-run-all`のみで最小限、`package-lock.json`あり
- [ ] `npm audit`の実施 — 開発環境のサンドボックスがネットワーク制限のため未実行。リリース前にネットワーク接続可能な環境で`npm audit`を実行し、結果をこのチェックリストに追記する

## 通信・認証情報の取り扱い

- [x] 外部サービスとの認証・APIキーのやり取りを行わない(埋め込みURLはユーザーが手動入力するBox/Googleドライブの共有リンクのみ)
- [x] `kintone.plugin.app.setConfig()`に保存しているのはフィールドコード・スペースID・表示サイズなどの表示設定のみで、認証情報や機密情報は含まれない
- N/A — HTTPS通信/ユーザーID識別/Cookie取得の項目は、外部APIへのリクエストを行わない本プラグインの実装には該当しない

## リダイレクト

- [x] `window.location.href`に渡す値は`kintone.app.getId()`など信頼できる内部値のみで、外部入力を含まない(`config.js`の保存後・キャンセル時の画面遷移)

## 個別確認事項(要フォローアップ)

- [ ] `iframeEl`の`allow`属性に設定している`"local-network-access *; clipboard-read *; clipboard-write *"`(`embed-common.js`)が、Box公式の最新の埋め込みコード仕様と一致しているか、リリース前に再確認する(許可範囲を必要以上に広げていないか)
- [ ] Puppeteerによる実環境テストで、正常な埋め込み表示に加えて「許可されていないホスト」「httpのURL」「不正な文字列」を入力した場合に警告メッセージが表示されブロックされることを確認する
- [ ] 複数ブラウザでの表示確認
