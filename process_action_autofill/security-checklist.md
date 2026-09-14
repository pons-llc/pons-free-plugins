# process_action_autofill セキュリティチェックリスト

[secureCodingGuideline.md](../secureCodingGuideline.md)の一般項目([box_gdrive_iframe/security-checklist.md](../box_gdrive_iframe/security-checklist.md)参照、UTF-8/BOMなし・名前空間分離・`'use strict'`・外部スクリプト不使用などは同様に満たしている)は重複記載を省略し、本プラグイン固有の項目のみ記載する。

最終確認日: 2026-09-14

## コーディング作法

- [x] 文字コードはUTF-8(BOMなし)
- [x] グローバル変数を作らず、即時関数(IIFE)+名前空間オブジェクト(`window.ProcessActionAutofill`)のみを公開している(`js/lib/rule-matcher.js`, `js/lib/now-offset-calculator.js`, `js/lib/value-resolver.js`, `js/lib/clear-value.js`, `js/lib/field-eligibility.js`, `js/lib/config-store.js`, `js/lib/config-validation.js`)
- [x] 既存のkintoneグローバルオブジェクトを書き換え・参照していない
- [x] `'use strict'`を全JSファイルの先頭で使用している
- [x] kintone内部のid/class属性やDOM構造に依存せず、JavaScript API(`kintone.app.getFormFields()`, `kintone.plugin.app.getConfig/setConfig()`, `kintone.getLoginUser()`, `kintone.user.getOrganizations()`, `kintone.events.on()`)と`kintone.api()`(内部向けラッパー)のみを使用している

## REST API・外部通信(CLAUDE.md開発方針3参照)

- [x] 設定画面でのプロセス管理の状態・アクション一覧の取得には、`kintone.app.getStatus()`(JavaScript API)がプラグイン設定画面では利用できない(利用可能画面はレコード一覧/追加/編集/詳細/グラフ画面のみとkintoneドキュメントMCPで確認済み)ため、REST API `GET /k/v1/preview/app/status.json`を`kintone.api(kintone.api.url('/k/v1/preview/app/status.json', true), 'GET', { app: kintone.app.getId() })`(kintone自身への呼び出し専用の内部ラッパー)経由でのみ呼び出す。生の`fetch`/`XMLHttpRequest`でURLを直接組み立てていない
- [x] レコード詳細画面(実行時)側は、イベントオブジェクト(`event.action`/`event.status`/`event.nextStatus`)にフィルター条件の判定に必要な情報がすべて含まれているため、追加のREST API呼び出しを行わない。ORGANIZATION_SELECTの「アクション実行者の優先する組織」ソースを使うルールがある場合のみ、JavaScript API `kintone.user.getOrganizations()`を呼び出す(REST APIではない)
- [x] `kintone.api.url(path, true)`の第2引数`true`によりドメイン部分を自動解決させ、外部ドメインへのリクエストになる余地をコード上排除している
- [x] kintone以外の外部サーバーへの通信(fetch/XHR)を一切行わない
- [x] 外部ライブラリを一切使用していない(vanilla JSのみ、`js/lib/`配下は依存なしの純粋関数、kintone APIの呼び出し結果は呼び出し側から関数の引数として注入する設計にしている)

## XSS・CSSインジェクション対策

- [x] 設定画面(`js/config.js`)でフィールド一覧・アクション名・ステータス名・エラーメッセージを描画する際、`innerHTML`ではなく`document.createElement()` + `textContent`のみを使用している(`buildSelectOptions`)
- [x] ルール行のリスト再描画(`innerHTML = ''`)はリストをクリアするためだけの用途で、外部由来の文字列を差し込んでいない(`<template>`要素からの`cloneNode(true)`で行を組み立てる、`auto_lookup`/`date_offset_autofill`と同じパターン)
- [x] 対象フィールドへの書き込み(`desktop.js`/`mobile.js`)は`event.record`の`[...].value`への値代入のみで、DOM操作(`innerHTML`等)を一切行わない。設定画面で入力した固定文字列・組織コード・グループコードがそのままフィールド値として書き込まれるが、kintone標準のフィールド値レンダリングを経由するためHTMLとして解釈されない

## 設定の妥当性検証

- [x] 保存前に`js/lib/config-validation.js`でチェックし、不正な設定(対象フィールド未選択・非対応型・存在しないフィールド、動作不正、SET時のソース必須値欠落、コピー元フィールドの型不一致、選択肢が現在のフィールド定義に存在しない、DATE型への単位「分数」指定、組織/グループの固定コード未入力)は保存させない
- [x] `kintone.plugin.app.getConfig()`が`null`/`undefined`を返す場合でも、`js/lib/config-store.js`の`load()`は例外を投げず既定値(`{ rules: [] }`)を返す
- [x] レコード画面側(`desktop.js`/`mobile.js`)でも、ルールの対象フィールドが実際のレコードに存在しない場合(フォームからフィールドが削除された等)は早期リターンし、画面をクラッシュさせない

## 通信・認証情報の取り扱い

- [x] `kintone.api()`/`kintone.user.getOrganizations()`はログイン中のセッション情報を自動的に使用するため、APIトークンやパスワード等の認証情報をコード・設定に含めない(secureCodingGuideline.md準拠)
- [x] `kintone.plugin.app.setConfig()`に保存しているのはフィールドコード・フィルター条件(アクション名/ステータス名)・固定値・組織/グループコードなどの設定情報のみで、認証情報や機密情報は含まれない

## 権限に関する注意(個別確認事項)

- [x] レコード詳細画面のフィールド値書き換えには「レコードまたはフィールドの編集権限」が必要(kintoneドキュメントMCPで確認済み)。編集権限のないフィールドを対象に設定した場合、kintone側の仕様により値は書き換わらない(プラグイン側でこれを検知・警告する手段はREST APIでの追加確認が必要になり複雑化するため、v1では対応しない。意図通りに動作しない場合はアプリのフィールドアクセス権設定を確認するよう、公開サイトのプラグインページで案内する)
- [x] `kintone.user.getOrganizations()`はユーザーごとに1分あたり50回を超えるサーバーからのデータ取得があった場合にPromiseが拒否される(kintoneドキュメントMCPで確認済み)。本プラグインは1回のアクション実行につき最大1回しか呼び出さないため、通常利用でこの上限に達する可能性は低い

## 既知の仕様上の制約(セキュリティというより機能上の注意、idea.mdに明記済み)

- RADIO_BUTTONフィールドへの「値をクリア」操作は、kintoneの仕様上、空文字列を指定すると初期値に設定されている選択肢が選ばれる(真の空にはならない)。設定画面上にも注意書きを表示している

問題があれば、公開サイトのリポジトリのGitHub Issueで報告してもらい対応する。
