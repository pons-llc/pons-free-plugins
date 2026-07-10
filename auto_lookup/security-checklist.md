# auto_lookup セキュリティチェックリスト

[secureCodingGuideline.md](../secureCodingGuideline.md)の一般項目([box_gdrive_iframe/security-checklist.md](../box_gdrive_iframe/security-checklist.md)参照、UTF-8/BOMなし・名前空間分離・`'use strict'`・外部スクリプト不使用などは同様に満たしている)は重複記載を省略し、本プラグイン固有の項目のみ記載する。

最終確認日: 2026-07-10 / 対象: 初回実装時点

## コーディング作法

- [x] 文字コードはUTF-8(BOMなし)
- [x] グローバル変数を作らず、即時関数(IIFE)+名前空間オブジェクト(`window.AutoLookup`)のみを公開している(`js/lib/lookup-target-resolver.js`, `js/lib/lookup-trigger.js`, `js/lib/config-store.js`, `js/lib/config-validation.js`)
- [x] 既存のkintoneグローバルオブジェクトを書き換え・参照していない
- [x] `'use strict'`を全JSファイルの先頭で使用している
- [x] kintone内部のid/class属性やDOM構造に依存せず、JavaScript API(`kintone.app.getFormFields()`, `kintone.events.on()`のイベントオブジェクトの`lookup`プロパティ経由の再取得指示)のみを使用している

## REST API・外部通信

- [x] 本プラグインはREST APIを一切使用しない(CLAUDE.md開発方針3に準拠)。ルックアップの再実行自体はkintone本体がフィールド設定に基づいて内部的に行う処理であり、本プラグインは`event.record[...].lookup = true`という「再実行の指示」を出すだけで、参照先アプリへの通信を自分で組み立てることはない
- [x] kintone以外の外部サーバーへの通信(fetch/XHR)を一切行わない
- [x] 外部ライブラリを一切使用していない(vanilla JSのみ、`js/lib/`配下は依存なしの純粋関数)

## XSS対策

- [x] 本プラグインはDOMへの描画を伴わない(`edit.show`イベントでフィールドの`lookup`プロパティを設定するのみ)ため、XSSのリスクとなる文字列描画箇所がない
- [x] 設定画面(`js/config.js`)でフィールド一覧・エラーメッセージを描画する際、`innerHTML`ではなく`document.createElement()` + `textContent`のみを使用している

## 設定の妥当性検証

- [x] 保存前に`js/lib/config-validation.js`でチェックし、対象フィールドコードの重複を除去してから保存する
- [x] `kintone.plugin.app.getConfig()`が`null`/`undefined`を返す場合でも、`js/lib/config-store.js`の`load()`は例外を投げず既定値(`{ targetFieldCodes: [] }`)を返す
- [x] レコード画面側(`desktop.js`/`mobile.js`)でも、設定に含まれる対象フィールドが実際のフォームに存在しない場合(フィールド削除・設定の食い違い等)は`js/lib/lookup-target-resolver.js`が該当フィールドをスキップし、画面をクラッシュさせない

## 通信・認証情報の取り扱い

- N/A — 外部サービスとの認証・APIキーのやり取りを行わない。REST APIも使用しないため、認証情報の保存先を検討する必要自体がない

## ルックアップ再実行の権限に関する注記(セキュリティというより運用上の注意)

- [x] ルックアップフィールドの再取得は、ログインユーザーが参照先アプリのレコードを閲覧できる権限を持っている場合のみ正しく動作する(kintone標準のルックアップフィールドの権限モデルに準拠、本プラグインが独自の権限チェックを行うわけではない)ことを`idea.md`に明記した
- [x] 参照先で複数件が一致する場合は自動実行されない(kintone標準の制約)。本プラグインがこの制約を回避したり、任意のレコードを推測で選択したりすることは一切ない(`判断記録.md`の2番)

問題があれば、公開サイトのリポジトリのGitHub Issueで報告してもらい対応する。
