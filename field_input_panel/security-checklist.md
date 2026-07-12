# field_input_panel セキュリティチェックリスト

[secureCodingGuideline.md](../secureCodingGuideline.md)の一般項目([box_gdrive_iframe/security-checklist.md](../box_gdrive_iframe/security-checklist.md)参照、UTF-8/BOMなし・名前空間分離・`'use strict'`・外部スクリプト不使用などは同様に満たしている)は重複記載を省略し、本プラグイン固有の項目のみ記載する。

最終確認日: 2026-07-12

## コーディング作法

- [x] 文字コードはUTF-8(BOMなし)
- [x] グローバル変数を作らず、即時関数(IIFE)+名前空間オブジェクト(`window.FieldInputPanel`)のみを公開している(`js/lib/field-eligibility.js`, `js/lib/field-value-codec.js`, `js/lib/config-store.js`, `js/lib/config-validation.js`)
- [x] 既存のkintoneグローバルオブジェクトを書き換え・参照していない
- [x] `'use strict'`を全JSファイルの先頭で使用している

## REST API・外部通信

- [x] REST API・`kintone.api()`を一切使用しない。フィールド情報の取得は`kintone.app.getFormFields()`、レコードの読み書きは`kintone.app.record.get()`/`kintone.app.record.set()`(いずれもJavaScript API)のみで完結する(CLAUDE.md開発方針3の対象外、REST APIが不要なケース)
- [x] kintone以外の外部サーバーへの通信(fetch/XHR)を一切行わない
- [x] 外部ライブラリを一切使用していない(vanilla JSのみ)

## kintone内部DOM・非公開APIへの非依存(本プラグイン固有の論点)

- [x] 入力パネルは画面右端(kintoneのレコードコメント/変更履歴サイドバーと同じ位置)に表示するが、そのサイドバー内部にコンテンツを挿入する公開APIは存在しないことをkintoneドキュメントMCPで確認済み(`kintone.app.record.showSideBar()`/`getSideBarDisplayState()`は開閉制御のみ)。そのため本プラグインは**kintoneの実サイドバーのDOM構造を一切読み書きせず**、`document.body`に独自の`<div id="fip-panel">`を`position: fixed`かつ高い`z-index`で追加するだけの実装にした。kintone側の画面レイアウト変更(サイドバーの内部DOM変更等)の影響を受けない
- [x] フローティングボタン・パネルの挿入先も`document.body`のみで、kintone内部のid/class名や要素構造には一切依存していない

## XSS・CSSインジェクション対策

- [x] 設定画面(`js/config.js`)でタブ見出し・フィールド選択肢を描画する際、`innerHTML`ではなく`document.createElement()` + `textContent`のみを使用している。行の追加・削除は`<template>`要素からの`cloneNode(true)`で組み立てる
- [x] 実行時パネル(`js/desktop.js`)のラベル・タイトル・選択肢表示もすべて`textContent`/`document.createTextNode()`で組み立てており、`innerHTML`を一切使用していない(ボタンラベル・パネルタイトルは設定画面でアプリ管理者が入力した文字列だが、念のため`innerHTML`を避けている)
- [x] レコードへの値の反映(`js/desktop.js`の「反映」ボタン)は、`kintone.app.record.get()`で取得したレコードオブジェクトの`record[fieldCode].value`への代入と`kintone.app.record.set()`のみで、DOM操作(`innerHTML`等)を経由しない。書き込む値はkintone標準のフィールド値レンダリングを経由するためHTMLとして解釈されない

## 反映対象フィールドの限定(許可リスト方式)

- [x] `kintone.app.record.set()`で書き換えるのは、設定画面でアプリ管理者が明示的に選択したフィールドコード(`config.buttons[].items[].fieldCode`)のみで、パネルに存在しない任意のフィールドを書き換えることはできない
- [x] 添付ファイル・リッチエディター・ユーザー/組織/グループ選択・ルックアップ・関連レコード一覧・テーブル・システム項目(計算/レコード番号/作成者/作成日時/更新者/更新日時/ステータス/作業者/カテゴリー)は`js/lib/field-eligibility.js`の`isEligibleField()`により選択肢に出さず、設定・実行時のどちらでも対象外にしている(idea.md「対応フィールド型」参照)。特にリッチエディターを除外することで、HTML文字列をそのままフィールド値として書き込む経路自体を作らないようにした
- [x] 実行時(`desktop.js`)は`kintone.app.getFormFields()`で取得した最新のフィールド情報を毎回参照するため、設定保存後にフィールドが削除・型変更された場合でも`fieldInfoByCode[item.fieldCode]`が存在しなければその項目を描画せずスキップする(早期リターン、画面をクラッシュさせない)

## 設定の妥当性検証

- [x] 保存前に`js/lib/config-validation.js`でチェックし、不正な設定(ボタンラベル未入力、ボタン0件、フィールド項目0件、FIELD項目のフィールド未選択、同一ボタン内でのフィールドコード重複、`fieldInfoByCode`を渡した場合は選択不可なフィールド型)は保存させない
- [x] `kintone.plugin.app.getConfig()`が`null`/`undefined`を返す場合でも、`js/lib/config-store.js`の`load()`は例外を投げず既定値(`{ buttons: [] }`)を返す

## 通信・認証情報の取り扱い

- [x] 外部通信を一切行わないため、APIトークン・パスワード等の認証情報を扱う経路自体が存在しない
- [x] `kintone.plugin.app.setConfig()`に保存しているのはボタンのラベル・タイトル・フィールドコードの並びのみで、認証情報や機微情報は含まれない

## リダイレクト

- [x] `window.location.href`に渡す値は`kintone.app.getId()`など信頼できる内部値のみで、外部入力を含まない(`config.js`の保存後・キャンセル時の画面遷移)

## 日時(DATETIME)変換の正確性(セキュリティというより正確性の論点)

- [x] タイムゾーン変換は`Date`オブジェクト(ブラウザのローカルタイムゾーン)にのみ依存し、外部のタイムゾーンデータベースや通信を必要としない。往復変換(UTC→ローカル→UTC)がホストのタイムゾーンに関わらず一致することを`__tests__/field-value-codec.test.js`でテスト済み

問題があれば、公開サイトのリポジトリのGitHub Issueで報告してもらい対応する。
