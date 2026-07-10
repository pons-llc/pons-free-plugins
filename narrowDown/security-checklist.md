# narrowDown(選択肢絞込プラグイン) セキュリティチェックリスト

[secureCodingGuideline.md](../secureCodingGuideline.md)の各項目を、本プラグインの実装(`src/js/`, `src/html/config.html`)に照らして確認したもの。実装を変更した場合は該当項目を再確認すること。

最終確認日: 2026-07-10 / 対象: 公開前レビュー時点の実装(この確認の過程で、外部AWSエンドポイントへライセンス認証情報を送信していた`config.js`の`kintone.proxy`呼び出しを削除し、`kintone.plugin.app.setConfig()`を直接呼ぶよう修正済み。あわせてE2E実環境テストで発覚した実バグとして、プラグイン未設定(`configKey`未保存)の状態で`js/narrow.js`・`js/narrow_mobile.js`・`js/config.js`が`JSON.parse(undefined)`で例外を投げていた箇所を`|| "{}"`のフォールバック付きに修正。`config.js`は例外時に`alert()`を呼んでいたため、未設定状態で設定画面を開くとダイアログでJS実行がブロックされる不具合があった)

## コーディング作法

- [x] 文字コードはUTF-8(BOMなし) — `src/js/*.js`の先頭バイトを確認し、BOMなしを確認済み
- [x] グローバル変数を作らず、即時関数のスコープ内で変数を定義している — `js/narrow.js`・`js/narrow_mobile.js`は`((PLUGIN_ID) => {...})(kintone.$PLUGIN_ID)`のIIFEでラップ。`js/config.js`も`(async (PLUGIN_ID) => {...})(kintone.$PLUGIN_ID)`のIIFEでラップ
- [x] 既存のkintoneグローバルオブジェクトを書き換え・参照していない
- [x] kintone内部のid/class属性やDOM構造に依存せず、JavaScript API(`kintone.plugin.app.getConfig/setConfig()`, `kintone.app.record.set()`, `kintone.mobile.app.record.set()`, `kintone.events.on()`)を使用している
- [x] `'use strict'`を`js/narrow.js`・`js/narrow_mobile.js`の先頭で使用している。`js/config.js`(設定画面。一般利用者ではなくアプリ管理者のみが開く画面)には未付与だが、実装は`const`/`let`のみでグローバル変数を作っていないため実害はない
- N/A — 複数ブラウザでの網羅的な動作確認は行わない方針。外部パッケージを使わずネイティブJS APIのみで実装しているため、ブラウザ間差異のリスクは低いと判断。個別の不具合は利用ユーザーからのIssue報告で対応する

## REST API利用

- 設定画面(`js/config.js`)はフォームフィールド一覧の取得に`kintone.api(kintone.api.url('/k/v1/app/form/fields', true), 'GET', body)`を使用している(kintone自身への呼び出しに限定した内部ラッパー経由。生の`fetch`/`XHR`は使っていない)。`kintone.app.getFormFields()`等のJavaScript APIでも同等の情報が取得できるため、CLAUDE.md開発方針3(JavaScript API優先)の観点では改善余地がある点をここに記録しておく。外部システムとの通信ではないためセキュリティ上の実害はない
- [x] 外部サーバー(kintone以外)への通信は行っていない — 当初`config.js`に含まれていた外部AWSエンドポイント(`kintone.proxy`によるライセンス認証)呼び出しは、レビューの過程で発見しユーザー確認のうえ削除済み

## XSS・CSSインジェクション対策

- [x] ユーザー入力(絞込条件・絞込対象の値)を`innerHTML`で出力していない。`js/config.js`のセレクト肢生成(`makeOptions`)は`innerText`を使用。`js/narrow.js`・`js/narrow_mobile.js`のモーダル内ラベル・オプション表示も`innerText`/`option.innerText`のみを使用
- [x] 外部サイトのJavaScript/CSSを読み込んでいない(`manifest.json`はローカルファイルのみを参照)
- [x] プラグインの実行コード(js/css)に外部パッケージ・外部ライブラリを一切使用しない方針(vanilla JSのみ)。ビルド用の`@kintone/cli`はローカル開発用のdevDependencyでありプラグイン本体には含まれない
- N/A — `npm audit` — 実行コードに外部パッケージを持たない方針のため実施しない

## 通信・認証情報の取り扱い

- [x] kintone以外のサーバーへの外部通信を一切行わない(修正後)
- [x] 外部サービスとの認証・APIキーのやり取りを行わない
- [x] `kintone.plugin.app.setConfig()`に保存しているのは条件フィールド・絞込対象フィールドと選択肢のマッピングのみで、認証情報や機密情報は含まれない
- N/A — HTTPS通信/ユーザーID識別/Cookie取得の項目は、外部APIへのリクエストを行わない本プラグインの実装には該当しない

## リダイレクト

- [x] `window.location.href`に渡す値は`kintone.app.getId()`など信頼できる内部値のみで、外部入力を含まない(`config.js`のキャンセルボタン)

## 個別確認事項(利用ユーザーへ委ねる項目)

以下は開発側での事前検証は行わず、公開後に利用ユーザーからのフィードバックに委ねる。問題があればGitHub Issueで報告してもらい対応する。

- 絞込対象フィールドの選択肢数が多い場合のモーダル表示・操作性
- 各ブラウザ(Chrome/Edge/Safari等)での表示差異
