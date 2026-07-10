# number_extract セキュリティチェックリスト

[secureCodingGuideline.md](../secureCodingGuideline.md)の一般項目([box_gdrive_iframe/security-checklist.md](../box_gdrive_iframe/security-checklist.md)参照、UTF-8/BOMなし・名前空間分離・`'use strict'`・外部スクリプト不使用などは同様に満たしている)は重複記載を省略し、本プラグイン固有の項目のみ記載する。`text_split`と設計方針が共通する項目(submit限定発動、disabled化の範囲、設定バリデーション方針)は理由の重複記載を省略する。

最終確認日: 2026-07-10 / 対象: 初回実装時点

## コーディング作法

- [x] 文字コードはUTF-8(BOMなし)
- [x] グローバル変数を作らず、即時関数(IIFE)+名前空間オブジェクト(`window.NumberExtract`)のみを公開している(`js/lib/kanji-number.js`, `js/lib/extract.js`, `js/lib/field-assign.js`, `js/lib/config-store.js`, `js/lib/config-validation.js`)
- [x] 既存のkintoneグローバルオブジェクトを書き換え・参照していない
- [x] `'use strict'`を全JSファイルの先頭で使用している
- [x] kintone内部のid/class属性やDOM構造に依存せず、JavaScript API(`kintone.app.getFormFields()`, `kintone.plugin.app.getConfig/setConfig()`, `kintone.events.on()`のイベントオブジェクト経由の値書き換え・`disabled`設定)のみを使用している

## REST API・外部通信

- [x] 本プラグインはREST APIを一切使用しない(CLAUDE.md開発方針3に準拠)
- [x] kintone以外の外部サーバーへの通信(fetch/XHR)を一切行わない
- [x] 外部ライブラリを一切使用していない(vanilla JSのみ、`js/lib/`配下は依存なしの純粋関数。漢数字変換も自前の`kanji-number.js`で実装しており、外部の数値変換ライブラリは使用しない)

## 正規表現に関するリスク

- [x] `js/lib/extract.js`の数字・漢数字の抽出には固定パターン(`/\d+/g`、`/[〇一二三四五六七八九十百千万]+/g`)のみを使用しており、設定画面からの入力を正規表現として動的に組み立てることはしない(`text_split`のREGEXモードのようなユーザー入力正規表現は本プラグインにはない)ため、ReDoSや正規表現インジェクションのリスクは実質的にない

## XSS・CSSインジェクション対策

- [x] 設定画面(`js/config.js`)でフィールド一覧・エラーメッセージを描画する際、`innerHTML`ではなく`document.createElement()` + `textContent`のみを使用している
- [x] 出力先フィールド行のリスト再描画(`innerHTML = ''`)はリストをクリアするためだけの用途で、外部由来の文字列を差し込んでいない(`<template>`要素からの`cloneNode(true)`で行を組み立てる)
- [x] 出力先フィールドへの書き込み(`desktop.js`/`mobile.js`の`applyExtractions()`)は`event.record[...].value`への文字列代入のみで、DOM操作(`innerHTML`等)を一切行わない

## 設定の妥当性検証

- [x] 保存前に`js/lib/config-validation.js`の`validateExtracts()`でチェックし、不正な設定(元フィールド未選択、出力先フィールド0件、出力先フィールドの重複、出力先フィールドと元フィールドの重複)は保存させない
- [x] `kintone.plugin.app.getConfig()`が`null`/`undefined`を返す場合(未設定のアプリ)でも、`js/lib/config-store.js`の`load()`は例外を投げず既定値(`{ extracts: [] }`)を返す
- [x] レコード画面側(`desktop.js`/`mobile.js`)でも、設定に含まれる元フィールド・出力先フィールドが実際のレコードに存在しない場合は早期リターンし、画面をクラッシュさせない

## 通信・認証情報の取り扱い

- N/A — 外部サービスとの認証・APIキーのやり取りを行わない

## 編集禁止(disabled化)の仕様(セキュリティというより運用上の注意)

- [x] ユーザーレビューにより、出力先フィールドの`disabled`化は行わない設計に変更した(`判断記録.md`の6番)。抽出結果は`change`イベントで自動入力されるが、その後ユーザーが出力先フィールドを手で書き換えることができ、`submit`時に再上書きされることもない。これはセキュリティ上の制約ではなく、通常操作での利便性を優先した設計判断であることを`idea.md`に明記した
- [x] 元フィールドの`disabled`化(一覧のインライン編集のみ対象)はJavaScript APIによるUIレベルの制御であり、REST API経由でのフィールド更新やアクセス権による制御ではない。「不正操作を防ぐ」機能ではなく「通常操作でのミスを防ぐUI上の制約」であることを`idea.md`に明記した

## 個別確認事項(利用ユーザーへ委ねる項目)

- 漢数字変換の対応範囲(`億`以上非対応、位取り/読み上げの自動判別ルール)が実際の業務データと合わない場合の挙動(`判断記録.md`参照)
- 数値(NUMBER)型の出力先フィールドに先頭ゼロを含む抽出結果を格納した場合、kintone側の仕様により先頭ゼロが失われる(プラグインの不具合ではなくkintoneフィールドの一般的な挙動)

問題があれば、公開サイトのリポジトリのGitHub Issueで報告してもらい対応する。
