# tab_layout セキュリティチェックリスト

[secureCodingGuideline.md](../secureCodingGuideline.md)の一般項目([box_gdrive_iframe/security-checklist.md](../box_gdrive_iframe/security-checklist.md)参照、UTF-8/BOMなし・名前空間分離・`'use strict'`・外部スクリプト不使用などは同様に満たしている)は重複記載を省略し、本プラグイン固有の項目のみ記載する。

最終確認日: 2026-07-10 / 対象: 初回実装時点

## コーディング作法

- [x] 文字コードはUTF-8(BOMなし)
- [x] グローバル変数を作らず、即時関数(IIFE)+名前空間オブジェクト(`window.TabLayout`)のみを公開している(`js/lib/tab-visibility.js`, `js/lib/config-store.js`, `js/lib/config-validation.js`)
- [x] 既存のkintoneグローバルオブジェクトを書き換え・参照していない
- [x] `'use strict'`を全JSファイルの先頭で使用している
- [x] kintone内部のid/class属性やDOM構造に依存せず、JavaScript API(`kintone.app.getFormLayout()`, `kintone.app.record.getSpaceElement()`, `kintone.app.record.setFieldShown()`, `kintone.plugin.app.getConfig/setConfig()`)のみを使用している

## REST API・外部通信

- [x] 本プラグインはREST APIを一切使用しない(CLAUDE.md開発方針3に準拠)。フォームのレイアウト取得(`kintone.app.getFormLayout()`)・フィールド表示切り替え(`kintone.app.record.setFieldShown()`)・スペース要素取得(`kintone.app.record.getSpaceElement()`)はすべてJavaScript APIのみで完結する
- [x] kintone以外の外部サーバーへの通信(fetch/XHR)を一切行わない
- [x] 外部ライブラリを一切使用していない(vanilla JSのみ、タブボタンのDOM描画も標準DOM APIのみで実装する)

## XSS・CSSインジェクション対策(本プラグイン固有の重要項目)

- [x] タブボタンのラベル文字列(アプリ管理者が設定画面で入力する`label`)をDOMへ描画する際、`innerHTML`ではなく`document.createElement('button')` + `textContent`のみを使用する。タブラベルは自由記述のテキストであり、`innerHTML`で描画するとXSSの原因になり得るため、`textContent`の使用を徹底する
- [x] 設定画面(`js/config.js`)でフィールド一覧・エラーメッセージを描画する際も同様に`innerHTML`ではなく`document.createElement()` + `textContent`のみを使用している
- [x] タブグループ・タブ・項目選択のリスト再描画(`innerHTML = ''`)はリストをクリアするためだけの用途で、外部由来の文字列を差し込んでいない(`<template>`要素からの`cloneNode(true)`で行を組み立てる)
- [x] `kintone.app.record.setFieldShown()`はフィールドコード/要素IDと真偽値のみを引数に取り、値の代入やDOM構造の直接操作を行わないAPIであるため、XSSのリスクはない

## 設定の妥当性検証

- [x] 保存前に`js/lib/config-validation.js`でチェックし、不正な設定(アンカーのスペースフィールド未選択、タブ0件、タブラベル未入力)は保存させない
- [x] `kintone.plugin.app.getConfig()`が`null`/`undefined`を返す場合でも、`js/lib/config-store.js`の`load()`は例外を投げず既定値(`{ layouts: [] }`)を返す
- [x] レコード画面側(`desktop.js`/`mobile.js`)でも、設定に含まれるアンカーのスペースフィールドが実際のフォームに存在しない場合(フィールド削除・設定の食い違い等)は`kintone.app.record.getSpaceElement()`が`null`を返すため、その場合はタブUIの描画をスキップし画面をクラッシュさせない。個々の項目(フィールドコード/要素ID)が存在しない場合も`setFieldShown()`は「エラーにならず、何も起こらない」仕様(公式ドキュメント記載)のため、追加のガードなしで安全に動作する

## 通信・認証情報の取り扱い

- N/A — 外部サービスとの認証・APIキーのやり取りを行わない。REST APIも使用しないため、認証情報の保存先を検討する必要自体がない

## 表示/非表示の切り替えに関する注意(セキュリティというより運用上の注意)

- [x] `setFieldShown()`によるフィールドの非表示化はUIレベルの制御であり、非表示にしたフィールドの値自体はレコードデータとして保持され続け、保存・REST API経由での取得は通常通り可能である。「特定のタブでフィールドを隠す」ことは情報を完全に秘匿する機能ではないことを`idea.md`に明記した(アクセス権による制御とは異なる)

## 個別確認事項(利用ユーザーへ委ねる項目)

- 印刷画面でのタブボタン表示の要否(`判断記録.md`の3番)
- 「タブ=表示する項目の集合」という解釈が元メモの意図と異なっていた場合の仕様変更要否(`判断記録.md`の1番)

問題があれば、公開サイトのリポジトリのGitHub Issueで報告してもらい対応する。
