# list_highlight セキュリティチェックリスト

[secureCodingGuideline.md](../secureCodingGuideline.md)の一般項目([box_gdrive_iframe/security-checklist.md](../box_gdrive_iframe/security-checklist.md)参照、UTF-8/BOMなし・名前空間分離・`'use strict'`・外部スクリプト不使用などは同様に満たしている)は重複記載を省略し、本プラグイン固有の項目のみ記載する。

最終確認日: 2026-07-10 / 対象: 初回実装時点

## コーディング作法

- [x] 文字コードはUTF-8(BOMなし)
- [x] グローバル変数を作らず、即時関数(IIFE)+名前空間オブジェクト(`window.ListHighlight`)のみを公開している(`js/lib/condition-engine.js`, `js/lib/rule-matcher.js`, `js/lib/style-builder.js`, `js/lib/config-store.js`, `js/lib/config-validation.js`)
- [x] 既存のkintoneグローバルオブジェクトを書き換え・参照していない
- [x] `'use strict'`を全JSファイルの先頭で使用している
- [x] kintone内部のid/class属性やDOM構造に依存せず、JavaScript API(`kintone.app.getFormFields()`, `kintone.app.setRecordListStyle()`, `kintone.plugin.app.getConfig/setConfig()`)のみを使用している。行の背景色変更もDOM直接操作ではなく`setRecordListStyle()`という公式APIに委ねている

## REST API・外部通信

- [x] 本プラグインはREST APIを一切使用しない(CLAUDE.md開発方針3に準拠)
- [x] kintone以外の外部サーバーへの通信(fetch/XHR)を一切行わない
- [x] 外部ライブラリを一切使用していない(vanilla JSのみ、`js/lib/`配下は依存なしの純粋関数)

## XSS・CSSインジェクション対策

- [x] `kintone.app.setRecordListStyle()`に渡す背景色は、設定画面の`<input type="color">`(ブラウザ標準のカラーピッカー)で選択した16進カラーコード文字列(`#rrggbb`形式)のみを使用する。任意の文字列をCSSプロパティ値としてそのまま埋め込むわけではなく、ブラウザのカラー入力コントロールが返す値のみを使うため、CSSインジェクションのリスクは実質的にない
- [x] `js/lib/config-validation.js`の`validateRules()`で、色の値が`#`+16進数6桁の形式(`/^#[0-9a-fA-F]{6}$/`)であることを検証し、不正な形式では保存させない
- [x] 設定画面(`js/config.js`)でフィールド一覧・エラーメッセージを描画する際、`innerHTML`ではなく`document.createElement()` + `textContent`のみを使用している
- [x] ルール・条件のリスト再描画(`innerHTML = ''`)はリストをクリアするためだけの用途で、外部由来の文字列を差し込んでいない(`<template>`要素からの`cloneNode(true)`で行を組み立てる)

## 設定の妥当性検証

- [x] 保存前に`js/lib/config-validation.js`でチェックし、不正な設定(条件0件、フィールド未選択、未知の演算子、色の形式不正)は保存させない
- [x] `kintone.plugin.app.getConfig()`が`null`/`undefined`を返す場合でも、`js/lib/config-store.js`の`load()`は例外を投げず既定値(`{ rules: [] }`)を返す
- [x] レコード一覧画面側(`desktop.js`/`mobile.js`)でも、設定に含まれるフィールドが実際のレコードに存在しない場合(フィールド削除・設定の食い違い等)は該当条件を評価対象外として扱い、画面をクラッシュさせない(`js/lib/condition-engine.js`がフィールド不在時に例外を投げず`false`を返す設計)

## 通信・認証情報の取り扱い

- N/A — 外部サービスとの認証・APIキーのやり取りを行わない。REST APIも使用しないため、認証情報の保存先を検討する必要自体がない

## 表示専用機能である旨の注記(セキュリティというより運用上の注意)

- [x] 一覧の行強調はUIレベルの視覚表現であり、レコードデータそのものやアクセス権には一切影響しない。`kintone.app.setRecordListStyle()`はスタイル情報のみを扱うAPIであることを`idea.md`に明記した

## 個別確認事項(利用ユーザーへ委ねる項目)

- 複数ルール一致時の優先順位(設定順で最初に一致したルールを採用)が意図と異なる場合の仕様変更要否(`判断記録.md`の1番)
- 操作UI列への強調適用が必要な場合の拡張要否(`判断記録.md`の2番)

問題があれば、公開サイトのリポジトリのGitHub Issueで報告してもらい対応する。
