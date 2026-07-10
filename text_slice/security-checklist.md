# text_slice セキュリティチェックリスト

[secureCodingGuideline.md](../secureCodingGuideline.md)の一般項目([box_gdrive_iframe/security-checklist.md](../box_gdrive_iframe/security-checklist.md)参照、UTF-8/BOMなし・名前空間分離・`'use strict'`・外部スクリプト不使用などは同様に満たしている)は重複記載を省略し、本プラグイン固有の項目のみ記載する。`text_split`と設計方針が共通する項目(submit限定発動、disabled化の範囲、設定バリデーション方針)は理由の重複記載を省略する。

最終確認日: 2026-07-10 / 対象: 初回実装時点

## コーディング作法

- [x] 文字コードはUTF-8(BOMなし)
- [x] グローバル変数を作らず、即時関数(IIFE)+名前空間オブジェクト(`window.TextSlice`)のみを公開している(`js/lib/slice.js`, `js/lib/config-store.js`, `js/lib/config-validation.js`)
- [x] 既存のkintoneグローバルオブジェクトを書き換え・参照していない
- [x] `'use strict'`を全JSファイルの先頭で使用している
- [x] kintone内部のid/class属性やDOM構造に依存せず、JavaScript API(`kintone.app.getFormFields()`, `kintone.plugin.app.getConfig/setConfig()`, `kintone.events.on()`のイベントオブジェクト経由の値書き換え・`disabled`設定)のみを使用している

## REST API・外部通信

- [x] 本プラグインはREST APIを一切使用しない(CLAUDE.md開発方針3に準拠)
- [x] kintone以外の外部サーバーへの通信(fetch/XHR)を一切行わない
- [x] 外部ライブラリを一切使用していない(vanilla JSのみ、`js/lib/`配下は依存なしの純粋関数。`String.prototype.slice()`等の標準APIのみ使用)

## XSS・CSSインジェクション対策

- [x] 設定画面(`js/config.js`)でフィールド一覧・エラーメッセージを描画する際、`innerHTML`ではなく`document.createElement()` + `textContent`のみを使用している
- [x] ルール行のリスト再描画(`innerHTML = ''`)はリストをクリアするためだけの用途で、外部由来の文字列を差し込んでいない(`<template>`要素からの`cloneNode(true)`で行を組み立てる)
- [x] 出力先フィールドへの書き込み(`desktop.js`/`mobile.js`の`applySlices()`)は`event.record[...].value`への文字列代入と`event.record[...].disabled`の真偽値設定のみで、DOM操作(`innerHTML`等)を一切行わない

## 設定の妥当性検証

- [x] 保存前に`js/lib/config-validation.js`の`validateSlices()`でチェックし、不正な設定(元フィールド未選択、未知の関数種別、`start`/`length`が1以上の整数でない、出力先フィールド未選択、出力先フィールドの重複、出力先フィールドと元フィールドの重複)は保存させない
- [x] `kintone.plugin.app.getConfig()`が`null`/`undefined`を返す場合(未設定のアプリ)でも、`js/lib/config-store.js`の`load()`は例外を投げず既定値(`{ slices: [] }`)を返す
- [x] レコード画面側(`desktop.js`/`mobile.js`)でも、設定に含まれる元フィールド・出力先フィールドが実際のレコードに存在しない場合は早期リターンし、画面をクラッシュさせない

## 通信・認証情報の取り扱い

- N/A — 外部サービスとの認証・APIキーのやり取りを行わない

## 編集禁止(disabled化)の仕様(セキュリティというより運用上の注意)

- [x] 出力先フィールドの`disabled`化はJavaScript APIによるUIレベルの制御であり、REST API経由でのフィールド更新やアクセス権による制御ではない。「不正操作を防ぐ」機能ではなく「通常操作でのミスを防ぐUI上の制約」であることを`idea.md`に明記した(`text_split/security-checklist.md`と同じ注意事項)。`number_extract`はユーザーレビューによりこの方針を撤回したが、本プラグインは`判断記録.md`の4番の通り元の方針を維持している

## 個別確認事項(利用ユーザーへ委ねる項目)

- 切り出し結果を手直ししたいのに出力先フィールドが編集できないという使い勝手上の指摘があれば、`number_extract`と同様の「change発動・disabledなし」への変更を検討する(`判断記録.md`の4番)

問題があれば、公開サイトのリポジトリのGitHub Issueで報告してもらい対応する。
