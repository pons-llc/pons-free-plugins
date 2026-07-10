# status_arrow セキュリティチェックリスト

[secureCodingGuideline.md](../secureCodingGuideline.md)の一般項目([box_gdrive_iframe/security-checklist.md](../box_gdrive_iframe/security-checklist.md)参照、UTF-8/BOMなし・名前空間分離・`'use strict'`・外部スクリプト不使用などは同様に満たしている)は重複記載を省略し、本プラグイン固有の項目のみ記載する。

最終確認日: 2026-07-10 / 対象: ステップ選択肢のフォーム連動対応時点

## コーディング作法

- [x] 文字コードはUTF-8(BOMなし)
- [x] グローバル変数を作らず、即時関数(IIFE)+名前空間オブジェクト(`window.StatusArrow`)のみを公開している(`js/lib/arrow-state.js`, `js/lib/design-preset.js`, `js/lib/config-store.js`, `js/lib/config-validation.js`)
- [x] 既存のkintoneグローバルオブジェクトを書き換え・参照していない
- [x] `'use strict'`を全JSファイルの先頭で使用している
- [x] kintone内部のid/class属性やDOM構造に依存せず、JavaScript API(`kintone.app.getFormFields()`, `kintone.app.record.getHeaderMenuSpaceElement()`, `kintone.plugin.app.getConfig/setConfig()`)を優先して使用している

## REST API・外部通信

- [x] REST APIは、設定画面でのプロセス管理ステータス一覧の取得(`GET /k/v1/app/status.json`)のみに限定して使用する。JavaScript API `kintone.app.getStatus()`は「利用できる画面」にプラグイン設定画面が含まれておらず(レコード一覧・追加・編集・詳細・グラフ画面のみ)、実機でも`kintone.app.getStatus is not a function`になることを確認したため、CLAUDE.md開発方針3(JavaScript APIで実現できない場合のみRESTを使う)に従いkintone自身への呼び出しに限り`kintone.api()`(内部向けラッパー)で代替した。生の`fetch`/`XHR`は使用しない
- [x] 対象フィールド一覧の取得(`kintone.app.getFormFields()`)・矢羽根の描画先取得(`kintone.app.record.getHeaderMenuSpaceElement()`)はJavaScript APIのみで完結する
- [x] kintone以外の外部サーバーへの通信(fetch/XHR)を一切行わない
- [x] 外部ライブラリを一切使用していない(vanilla JSのみ、矢羽根のDOM描画も標準DOM APIのみで実装する)

## XSS・CSSインジェクション対策

- [x] 矢羽根のステップ名(アプリ管理者が設定画面で選択肢から選ぶ文字列、またはプロセス管理のステータス名)をDOMへ描画する際、`innerHTML`ではなく`document.createElement()` + `textContent`のみを使用する
- [x] 設定画面(`js/config.js`)でフィールド一覧・エラーメッセージを描画する際も同様に`innerHTML`ではなく`document.createElement()` + `textContent`のみを使用している
- [x] ウィジェット・ステップのリスト再描画(`innerHTML = ''`)はリストをクリアするためだけの用途で、外部由来の文字列を差し込んでいない(`<template>`要素からの`cloneNode(true)`で行を組み立てる)
- [x] デザインプリセットの適用は`js/lib/design-preset.js`が返す固定のCSSクラス名(あらかじめ定義された文字列のいずれか)を`classList.add()`するのみで、ユーザー入力由来の文字列をクラス名やスタイル文字列として動的に組み立てることはない

## 設定の妥当性検証

- [x] 保存前に`js/lib/config-validation.js`でチェックし、不正な設定(対象種別未選択、`FIELD`種別でフィールド未選択、ステップ0件)は保存させない
- [x] `kintone.plugin.app.getConfig()`が`null`/`undefined`を返す場合でも、`js/lib/config-store.js`の`load()`は例外を投げず既定値(`{ widgets: [] }`)を返す
- [x] レコード画面側(`desktop.js`)でも、設定に含まれる対象フィールドが実際のレコードに存在しない場合(フィールド削除・設定の食い違い、プロセス管理が無効化された場合等)は早期リターンし、画面をクラッシュさせない

## 通信・認証情報の取り扱い

- N/A — 外部サービスとの認証・APIキーのやり取りを行わない。REST APIも使用しないため、認証情報の保存先を検討する必要自体がない

## モバイル非対応の注記(セキュリティというより運用上の注意)

- [x] `kintone.app.record.getHeaderMenuSpaceElement()`はPC専用のJavaScript APIであり、本プラグインはモバイル画面では動作しない(`mobile.js`を作成していない)。`idea.md`・`判断記録.md`に明記した

## 個別確認事項(利用ユーザーへ委ねる項目)

- 3状態モデル(完了/現在/未着手)が元メモの意図と異なっていた場合の仕様変更要否(`判断記録.md`の1番)
- モバイル対応が必要な場合の設計変更要否(`判断記録.md`の2番)

問題があれば、公開サイトのリポジトリのGitHub Issueで報告してもらい対応する。
