# sidebar_toggle セキュリティチェックリスト

[secureCodingGuideline.md](../secureCodingGuideline.md)の一般項目([box_gdrive_iframe/security-checklist.md](../box_gdrive_iframe/security-checklist.md)参照、UTF-8/BOMなし・名前空間分離・`'use strict'`・外部スクリプト不使用などは同様に満たしている)は重複記載を省略し、本プラグイン固有の項目のみ記載する。

最終確認日: 2026-07-24 / 対象: 初回実装時点

## コーディング作法

- [x] 文字コードはUTF-8(BOMなし)
- [x] グローバル変数を作らず、即時関数(IIFE)+名前空間オブジェクト(`window.SidebarToggle`)のみを公開している(`js/lib/condition-engine.js`, `js/lib/rule-matcher.js`, `js/lib/sidebar-action.js`, `js/lib/config-store.js`, `js/lib/config-validation.js`)
- [x] 既存のkintoneグローバルオブジェクトを書き換え・参照していない
- [x] `'use strict'`を全JSファイルの先頭で使用している
- [x] レコード画面側(`js/desktop.js`)はDOM操作を一切行わず、JavaScript API(`kintone.app.record.showSideBar()`)のみでサイドバーの状態を切り替えている

## REST API・外部通信

- [x] レコード画面(`desktop.js`)はREST APIを使用せず、JavaScript API(`kintone.app.record.showSideBar()`)のみで完結する
- [x] 設定画面(`config.js`)のみ、プロセス管理のステータス名一覧を取得するために`kintone.api()`経由で`GET /k/v1/app/status.json`を呼ぶ。`kintone.app.getStatus()`(JavaScript API)はプラグイン設定画面では利用できない(利用可能な画面がレコード一覧・追加・編集・詳細・グラフ画面のみ)ため、CLAUDE.md開発方針3に従いkintone自身への呼び出しに限定した`kintone.api()`を使用した(生の`fetch`/`XHR`は使用していない、`status_arrow`と同じ扱い)
- [x] kintone以外の外部サーバーへの通信(fetch/XHR)を一切行わない
- [x] 外部ライブラリを一切使用していない(vanilla JSのみ、`js/lib/`配下は依存なしの純粋関数)

## XSS・CSSインジェクション対策

- [x] 設定画面(`js/config.js`)でフィールド一覧・選択肢・エラーメッセージを描画する際、`innerHTML`に外部由来の文字列を差し込まず、`document.createElement()` + `textContent`のみで組み立てている(フィールドコード・選択肢・ステータス名はいずれも`kintone.app.getFormFields()`/REST APIレスポンスから取得したアプリ管理者自身の設定値であり、任意の外部入力ではない)
- [x] ルール・条件のリスト再描画(`innerHTML = ''`)はリストをクリアするためだけの用途で、外部由来の文字列を差し込んでいない(`<template>`要素からの`cloneNode(true)`で行を組み立てる)
- [x] 日時条件の値(`<input type="datetime-local">`等)はブラウザ標準の日時入力コントロールの値をそのまま`Date.parse()`に渡すのみで、文字列をDOMやCSSに埋め込まない

## 設定の妥当性検証

- [x] 保存前に`js/lib/config-validation.js`でチェックし、不正な設定(条件モード不正、条件0件、フィールド種別不正、フィールド未選択、フィールド種別に対して許可されない演算子、値未入力、サイドバー動作の指定不正)は保存させない
- [x] `kintone.plugin.app.getConfig()`が`null`/`undefined`を返す場合でも、`js/lib/config-store.js`の`load()`は例外を投げず既定値(`{ rules: [] }`)を返す
- [x] レコード画面側(`desktop.js`)で、設定に含まれるフィールドが実際のレコードに存在しない場合(フィールド削除・設定の食い違い等)でも、`js/lib/condition-engine.js`がフィールド不在時に例外を投げず`false`を返す設計のため、画面をクラッシュさせない
- [x] 日時の比較で`Date.parse()`が`NaN`になる不正な値の場合も例外を投げず`false`を返す(`evaluateDateClause`)

## 通信・認証情報の取り扱い

- N/A — 外部サービスとの認証・APIキーのやり取りを行わない。`kintone.api()`はkintoneのセッション認証をそのまま利用する内部ラッパーであり、認証情報をプラグイン側で保存・送信することはない

## 表示専用機能である旨の注記(セキュリティというより運用上の注意)

- [x] サイドバーの開閉はUIレベルの表示状態の切り替えであり、レコードデータそのものやアクセス権には一切影響しない。コメント・履歴のデータ自体は`showSideBar('CLOSED')`で非表示にしても削除・変更されない

## 個別確認事項(利用ユーザーへ委ねる項目)

- 複数ルール一致時の優先順位(設定順で最初に一致したルールを採用)が意図と異なる場合の仕様変更要否(`判断記録.md`の1番)
- 「常に」ルールの解釈(ルール単位の条件モードとして実装)が意図と異なる場合の仕様変更要否(`判断記録.md`の2番)
- 日時条件が「現在時刻」ではなく管理者設定の固定値との比較である点の仕様変更要否(`判断記録.md`の3番)

問題があれば、公開サイトのリポジトリのGitHub Issueで報告してもらい対応する。
