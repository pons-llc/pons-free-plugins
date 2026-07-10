# confirm_modal セキュリティチェックリスト

[secureCodingGuideline.md](../secureCodingGuideline.md)の一般項目([box_gdrive_iframe/security-checklist.md](../box_gdrive_iframe/security-checklist.md)参照、UTF-8/BOMなし・名前空間分離・`'use strict'`・外部スクリプト不使用などは同様に満たしている)は重複記載を省略し、本プラグイン固有の項目のみ記載する。

最終確認日: 2026-07-10 / 対象: 初回実装時点

## コーディング作法

- [x] 文字コードはUTF-8(BOMなし)
- [x] グローバル変数を作らず、即時関数(IIFE)+名前空間オブジェクト(`window.ConfirmModal`)のみを公開している(`js/lib/template.js`, `js/lib/rule-lookup.js`, `js/lib/config-store.js`, `js/lib/config-validation.js`)
- [x] 既存のkintoneグローバルオブジェクトを書き換え・参照していない
- [x] `'use strict'`を全JSファイルの先頭で使用している
- [x] kintone内部のid/class属性やDOM構造に依存せず、JavaScript API(`kintone.showConfirmDialog()`, `kintone.events.on()`, `kintone.plugin.app.getConfig/setConfig()`)のみを使用している

## REST API・外部通信

- [x] 本プラグインはREST APIを一切使用しない(CLAUDE.md開発方針3に準拠)
- [x] kintone以外の外部サーバーへの通信(fetch/XHR)を一切行わない
- [x] 外部ライブラリを一切使用していない(vanilla JSのみ)

## XSS対策

- [x] `kintone.showConfirmDialog()`はkintone標準のダイアログUIであり、`config.title`/`config.body`/`config.okButtonText`/`config.cancelButtonText`はDOMへの`innerHTML`埋め込みではなくkintone側の実装がテキストとして安全にレンダリングする(公式APIの仕様に委ねる)
- [x] ダイアログ本文のプレースホルダー置換(`js/lib/template.js`の`renderTemplate()`)は文字列の`String#replace`のみで、DOM操作や`eval`等コード実行を伴う置換は行わない。置換元の値(`event.action.value`/`event.nextStatus.value`)はkintone自身が生成するプロセス管理のアクション名・ステータス名であり、レコード編集者の自由入力ではない
- [x] 設定画面(`js/config.js`)でエラーメッセージを描画する際、`innerHTML`ではなく`document.createElement()` + `textContent`のみを使用している
- [x] ルールのリスト再描画(`innerHTML = ''`)はリストをクリアするためだけの用途で、外部由来の文字列を差し込んでいない(`<template>`要素からの`cloneNode(true)`で行を組み立てる)

## 設定の妥当性検証

- [x] 保存前に`js/lib/config-validation.js`でチェックし、不正な設定(対象イベント未選択、本文未入力)は保存させない
- [x] `kintone.plugin.app.getConfig()`が`null`/`undefined`を返す場合でも、`js/lib/config-store.js`の`load()`は例外を投げず既定値(`{ rules: [] }`)を返す
- [x] レコード画面側(`desktop.js`)でも、対象イベントに対応するルールが設定されていない場合は確認ダイアログを表示せず処理をそのまま続行する(未設定を「常にキャンセルする」ような安全側だが業務を止める誤動作にはしない)

## 通信・認証情報の取り扱い

- N/A — 外部サービスとの認証・APIキーのやり取りを行わない。REST APIも使用しないため、認証情報の保存先を検討する必要自体がない

## 処理キャンセルの仕様に関する注意(セキュリティというより運用上の注意)

- [x] 本プラグインが実現する「確認してキャンセルできる」機能はUIレベルの誤操作防止であり、アクセス権による制御を代替するものではないことを`idea.md`に明記した。REST API経由でのレコード保存・削除・ステータス更新はこの確認ダイアログを経由しない

## 個別確認事項(利用ユーザーへ委ねる項目)

- 「次の作業者」プレースホルダーが必要な場合の拡張要否(`判断記録.md`の1番)
- モバイル対応が必要な場合の拡張要否(`判断記録.md`の2番)

問題があれば、公開サイトのリポジトリのGitHub Issueで報告してもらい対応する。
