# input_format_rule セキュリティチェックリスト

[secureCodingGuideline.md](../secureCodingGuideline.md)の一般項目([box_gdrive_iframe/security-checklist.md](../box_gdrive_iframe/security-checklist.md)参照、UTF-8/BOMなし・名前空間分離・`'use strict'`・外部スクリプト不使用などは同様に満たしている)は重複記載を省略し、本プラグイン固有の項目のみ記載する。

最終確認日: 2026-09-17 / 対象: 初回実装時点

## コーディング作法

- [x] 文字コードはUTF-8(BOMなし)
- [x] グローバル変数を作らず、即時関数(IIFE)+名前空間オブジェクト(`window.InputFormatRule`)のみを公開している(`js/lib/char-type.js`, `js/lib/record-validator.js`, `js/lib/config-store.js`, `js/lib/config-validation.js`)
- [x] 既存のkintoneグローバルオブジェクトを書き換え・参照していない
- [x] `'use strict'`を全JSファイルの先頭で使用している
- [x] `js/lib/char-type.js`の文字種判定用正規表現は、ソースコード上で目視確認しやすいASCIIの`\uXXXX`エスケープ表記のまま保つため`new RegExp('[\\uXXXX-\\uXXXX]')`(文字列からの構築)を使っている。正規表現リテラル(`/[\uXXXX]/`)で書くと、ESLint(`no-useless-escape`)の自動修正がエスケープを実際のUnicode文字(全角スペース等、見た目で区別しづらくエディタ・フォントによって表示が壊れうる)へ書き換えてしまうことを実装時に確認したため、意図的にこの書き方を採用している(`eslint.config.mjs`に理由をコメントで明記、`prefer-regex-literals`をこのファイルに限り無効化)

## REST API・外部通信

- [x] `desktop.js`・`mobile.js`・`config.js`のいずれもREST API・`kintone.api()`を一切使用せず、JavaScript API(`kintone.events.on()`、`kintone.app.getFormFields()`、`kintone.plugin.app.getConfig()`/`setConfig()`)のみで完結する
- [x] kintone以外の外部サーバーへの通信(fetch/XHR)を一切行わない
- [x] 外部ライブラリを一切使用していない(vanilla JSのみ、文字種判定は標準の正規表現のみで実装)

## XSS・CSSインジェクション対策

- [x] 設定画面(`js/config.js`)でフィールド一覧・エラーメッセージを描画する際、`innerHTML`に外部由来の文字列を差し込まず、`document.createElement()` + `textContent`のみで組み立てている(フィールドコード・ラベルは`kintone.app.getFormFields()`から取得したアプリ管理者自身の設定値であり、任意の外部入力ではない)
- [x] レコード画面側(`desktop.js`/`mobile.js`)はDOM操作を一切行わず、`record[フィールドコード].error`へのメッセージ代入のみで完結する(kintone標準のエラー表示UIを使うため、任意のHTML注入経路が存在しない)。エラーメッセージ自体も`js/lib/char-type.js`の`LABELS`(プラグイン内で固定定義した文字列)から組み立てており、レコードの値やユーザー入力をメッセージに含めない

## 設定の妥当性検証

- [x] 保存前に`js/lib/config-validation.js`の`validateRules()`でチェックし、不正な設定(対象フィールド未選択、禁止する文字種が1つも選択されていない、同じフィールドへの重複ルール)は保存させない
- [x] `kintone.plugin.app.getConfig()`が`null`/`undefined`を返す場合でも、`js/lib/config-store.js`の`load()`は例外を投げず既定値(`{ rules: [] }`)を返す
- [x] `js/lib/record-validator.js`は、レコードに対象フィールドが存在しない場合(型変更等での不整合)や`rule`が`null`/`undefined`の場合でも例外を投げず`null`/空の結果を返す(画面をクラッシュさせない)
- [x] `js/lib/char-type.js`の`detectForbiddenTypes()`は`forbid`が未指定・空オブジェクトでも例外を投げず空配列を返す

## 通信・認証情報の取り扱い

- N/A — 外部サービスとの認証・APIキーのやり取りを行わない。`kintone.app.getFormFields()`はログイン中のセッションをそのまま利用する標準APIであり、認証情報をプラグイン側で保存・送信することはない

## 入力チェック機能である旨の注記(セキュリティというより運用上の注意)

- [x] 本プラグインが行うのは文字種の混入チェックのみであり、アクセス権・保存されるデータの暗号化・改ざん検知等には一切関与しない
- [x] `record[フィールドコード].error`の代入は表示用のエラーメッセージであり、レコードの実際の値そのものを書き換えることはない(値は入力されたまま保持され、保存をブロックするか否かのみに影響する)
- [x] チェックは`create.change`/`edit.change`(値変更時)と`create.submit`/`edit.submit`(保存時)のみで行われるため、既に保存済みの過去レコードは自動的には再検証されない(ルール追加前に登録されたレコードには遡って適用されない)

## 個別確認事項(利用ユーザーへ委ねる項目)

- 対象フィールドを文字列1行のみに限定している点(文字列複数行は`.change`イベントが発火しないため、idea.md「対象フィールド」参照)の仕様変更要否
- サブテーブル内の文字列1行フィールドを対象外としている点の仕様変更要否

問題があれば、公開サイトのリポジトリのGitHub Issueで報告してもらい対応する。
