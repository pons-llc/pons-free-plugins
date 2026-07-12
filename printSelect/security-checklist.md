# printSelect セキュリティチェックリスト

[secureCodingGuideline.md](../secureCodingGuideline.md)の各項目を、本プラグインの実装(`src/js/`, `src/html/config.html`)に照らして確認したもの。実装を変更した場合は該当項目を再確認すること。

最終確認日: 2026-07-12 / 対象: 本番運用中の実装をリポジトリに取り込んだ時点のコード(ロジック変更なし)

## コーディング作法

- [x] 文字コードはUTF-8(BOMなし) — 全js/css/htmlファイルの先頭バイトを確認し、BOMなしを確認済み
- [x] グローバル変数を作らず、即時関数のスコープ内で完結している — `js/js.js`・`js/config.js`ともIIFEの引数(`PLUGIN_ID`)とローカル変数のみで構成
- [x] 既存のkintoneグローバルオブジェクトを書き換え・参照していない
- [x] kintone内部のid/class属性やDOM構造に依存せず、JavaScript API(`kintone.plugin.app.getConfig/setConfig()`, `kintone.app.record.setFieldShown()`, `kintone.app.getId()`)のみを使用している
- [ ] `'use strict'`の明示 — `js/js.js`・`js/config.js`ともIIFEの先頭に`'use strict'`宣言がない(動作に支障はないが、次回改修時に追加を推奨)
- N/A — 複数ブラウザでの網羅的な動作確認は行わない方針。外部パッケージを使わずネイティブJS APIのみで実装しているため、ブラウザ間差異のリスクは低いと判断。個別の不具合は利用ユーザーからのIssue報告で対応する

## REST API利用

- [x] フィールド一覧の取得(`GET /k/v1/app/form/fields.json`)に相当するJavaScript APIが
      設定画面のコンテキストにも存在するため、REST APIは必須ではないが、既存実装は
      `kintone.api(kintone.api.url(...), 'GET', reqbody)`という内部向けラッパー経由の呼び出しに
      限定されており、生の`fetch`/`XHR`で外部サーバーへ直接アクセスしていない点は準拠している
      (CLAUDE.md開発方針3)。ロジック変更を避ける方針のため、今回はJavaScript APIへの置き換えは
      見送った。次回改修時に`kintone.app.getFormFields()`への置き換えを検討する。

## XSS・CSSインジェクション対策

- [x] フィールドラベルの描画は`label.innerText = ar.label`(`config.js`)で行っており、`innerHTML`
      による動的HTML生成を使用していない
- [x] チェックボックスの`id`にはフィールドコード(kintoneが英数字・アンダースコアのみで発行する値)
      のみを使用しており、外部からの任意文字列がDOM構造として解釈される余地がない
- [x] 外部サイトのJavaScript/CSSを読み込んでいない(`manifest.json`はローカルファイルのみを参照)
- [x] プラグインの実行コード(js/css)に外部パッケージ・外部ライブラリを一切使用しない
      (vanilla JSのみ)。ビルド用の`@kintone/cli` / `eslint` / `@cybozu/eslint-config`は
      ローカル開発用のdevDependencyでありプラグイン本体には含まれない
- N/A — `npm audit` — 実行コードに外部パッケージを持たない方針のため実施しない

## 通信・認証情報の取り扱い

- [x] kintone以外のサーバーへの外部通信を一切行わない(`kintone.api()`経由のkintone自身への
      REST呼び出しのみ)
- [x] 外部サービスとの認証・APIキーのやり取りを行わない
- [x] `kintone.plugin.app.setConfig()`に保存しているのは非表示対象フィールドのコード配列のみで、
      認証情報や機密情報は含まれない

## リダイレクト

- N/A — `location.href`等への画面遷移を行わない

## 個別確認事項(利用ユーザーへ委ねる項目)

以下は開発側での事前検証は行わず、公開後に利用ユーザーからのフィードバックに委ねる。問題があればGitHub Issueで報告してもらい対応する。

- 印刷画面表示のたびに`confirm()`ダイアログが出る挙動(意図した仕様)がユーザー体験として
  妥当かどうか
- 各ブラウザ(Chrome/Edge/Safari等)での表示差異
