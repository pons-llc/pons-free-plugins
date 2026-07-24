# record_button_toggle セキュリティチェックリスト

[secureCodingGuideline.md](../secureCodingGuideline.md)の一般項目([box_gdrive_iframe/security-checklist.md](../box_gdrive_iframe/security-checklist.md)参照、UTF-8/BOMなし・名前空間分離・`'use strict'`・外部スクリプト不使用などは同様に満たしている)は重複記載を省略し、本プラグイン固有の項目のみ記載する。`sidebar_toggle`/`group_field_toggle`と条件エンジンを共有しているため、共通部分は[sidebar_toggle/security-checklist.md](../sidebar_toggle/security-checklist.md)も参照。

最終確認日: 2026-07-24 / 対象: 初回実装時点

## コーディング作法

- [x] 文字コードはUTF-8(BOMなし)
- [x] グローバル変数を作らず、即時関数(IIFE)+名前空間オブジェクト(`window.RecordButtonToggle`)のみを公開している(`js/lib/condition-engine.js`, `js/lib/rule-matcher.js`, `js/lib/button-action.js`, `js/lib/config-store.js`, `js/lib/config-validation.js`)
- [x] 既存のkintoneグローバルオブジェクトを書き換え・参照していない
- [x] `'use strict'`を全JSファイルの先頭で使用している
- [x] レコード画面側(`js/desktop.js`/`js/mobile.js`)はDOM操作を一切行わず、JavaScript API(`showAddRecordButton()`/`showEditRecordButton()`/`showDuplicateRecordButton()`)のみでボタンの表示状態を切り替えている。ボタンをCSSやDOM直接操作で隠す実装は行っていない(公式APIが存在するため、kintone内部のDOM構造への依存を避けられる)

## REST API・外部通信

- [x] レコード画面(`desktop.js`/`mobile.js`)はREST APIを使用せず、JavaScript APIのみで完結する
- [x] 設定画面(`config.js`)のみ、プロセス管理のステータス名一覧を取得するために`kintone.api()`経由で`GET /k/v1/app/status.json`を呼ぶ(`sidebar_toggle`/`group_field_toggle`と同じ理由)
- [x] kintone以外の外部サーバーへの通信(fetch/XHR)を一切行わない
- [x] 外部ライブラリを一切使用していない(vanilla JSのみ、`js/lib/`配下は依存なしの純粋関数)

## XSS・CSSインジェクション対策

- [x] 設定画面(`js/config.js`)でフィールド一覧・選択肢・エラーメッセージを描画する際、`innerHTML`に外部由来の文字列を差し込まず、`document.createElement()` + `textContent`のみで組み立てている
- [x] ルール・条件のリスト再描画(`innerHTML = ''`)はリストをクリアするためだけの用途で、外部由来の文字列を差し込んでいない(`<template>`要素からの`cloneNode(true)`で行を組み立てる)
- [x] 対象ボタン(追加/編集/コピー)は設定画面の`<select>`固定選択肢からのみ選ばれ、自由入力を一切受け付けない

## 設定の妥当性検証

- [x] 保存前に`js/lib/config-validation.js`でチェックし、不正な設定(対象ボタン不正、条件モード不正、条件0件、フィールド種別不正、フィールド未選択、フィールド種別に対して許可されない演算子、値未入力、動作の指定不正)は保存させない
- [x] `kintone.plugin.app.getConfig()`が`null`/`undefined`を返す場合でも、`js/lib/config-store.js`の`load()`は例外を投げず既定値(`{ rules: [] }`)を返す
- [x] レコード一覧・グラフ画面のようにレコード文脈が無い画面では`record`に`null`を渡し、`js/lib/rule-matcher.js`が`mode: 'MATCH'`のルールを一致させない設計にすることで、存在しないレコードに対する誤判定(例: `IS_EMPTY`が常に真になる)を防いでいる(`判断記録.md`の1番)

## セキュリティ上の重要な注意(表示制御であり、アクセス制御ではない)

- [x] **本プラグインが提供するのはUIレベルの表示/非表示のみであり、レコードの追加・編集・複製操作そのものを禁止するアクセス制御機能ではない。** ボタンを非表示にしても、そのアプリの権限設定でユーザーに追加・編集権限がある限り、URLを直接操作する、または他の手段(REST API、他のカスタマイズ、既存のブックマーク等)で該当操作を行うことは技術的に可能。本当にレコードの追加・編集・複製を禁止したい場合は、kintoneアプリ自体の「アクセス権」設定(レコードのアクセス権、フィールドのアクセス権)を使うべきであり、本プラグインはその代替にはならない旨をidea.mdおよび公開ページに明記する。

## 通信・認証情報の取り扱い

- N/A — 外部サービスとの認証・APIキーのやり取りを行わない

## 個別確認事項(利用ユーザーへ委ねる項目)

- レコード一覧・グラフ画面では「常に」ルールのみが適用され、条件付きルールが効かない制約について、実際の運用で問題が無いか(`判断記録.md`の1番)
- コピー(再利用)ボタンの制御をPC専用とした点(モバイル版APIの存在が未確認のため、`判断記録.md`の2番)
- 上記「表示制御であり、アクセス制御ではない」という性質の理解(必須の確認事項)

問題があれば、公開サイトのリポジトリのGitHub Issueで報告してもらい対応する。
