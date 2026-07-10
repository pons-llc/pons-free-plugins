# text_split セキュリティチェックリスト

[secureCodingGuideline.md](../secureCodingGuideline.md)の一般項目([box_gdrive_iframe/security-checklist.md](../box_gdrive_iframe/security-checklist.md)参照、UTF-8/BOMなし・名前空間分離・`'use strict'`・外部スクリプト不使用などは同様に満たしている)は重複記載を省略し、本プラグイン固有の項目のみ記載する。

最終確認日: 2026-07-10 / 対象: 初回実装時点

## コーディング作法

- [x] 文字コードはUTF-8(BOMなし)
- [x] グローバル変数を作らず、即時関数(IIFE)+名前空間オブジェクト(`window.TextSplit`)のみを公開している(`js/lib/split.js`, `js/lib/row-mapper.js`, `js/lib/config-store.js`, `js/lib/config-validation.js`)
- [x] 既存のkintoneグローバルオブジェクトを書き換え・参照していない
- [x] `'use strict'`を全JSファイルの先頭で使用している
- [x] kintone内部のid/class属性やDOM構造に依存せず、JavaScript API(`kintone.app.getFormFields()`, `kintone.plugin.app.getConfig/setConfig()`, `kintone.events.on()`のイベントオブジェクト経由の値書き換え・`disabled`設定)のみを使用している

## REST API・外部通信

- [x] 本プラグインはREST APIを一切使用しない(CLAUDE.md開発方針3に準拠)。`kintone.app.getFormFields()`(JS API)でフィールド一覧を取得するのみで、レコードの読み書きはすべて`kintone.events.on()`のイベントオブジェクト(`event.record`)の書き換え、または設定画面での`kintone.plugin.app.setConfig()`のみで完結する
- [x] kintone以外の外部サーバーへの通信(fetch/XHR)を一切行わない
- [x] 外部ライブラリを一切使用していない(vanilla JSのみ、`js/lib/`配下は依存なしの純粋関数)

## 正規表現に関するリスク(本プラグイン固有、要注意)

- [x] **記号・文字モード(`CHARACTERS`)**: ユーザーが入力した区切り文字を正規表現へ変換する際、`js/lib/split.js`の`escapeRegExp()`で必ず正規表現の特殊文字(`. * + ? ^ $ { } ( ) | [ ] \`)をエスケープしてから結合している。エスケープを怠ると、区切り文字に`.`や`*`等を指定したときに意図しない文字にもマッチしてしまう(セキュリティ上の脆弱性ではないが、動作不正の原因になるため明記する)
- [x] **正規表現モード(`REGEX`)**: パターンはアプリ管理者(プラグイン設定を操作できる権限を持つユーザー)が設定画面で入力する文字列であり、レコードを入力する一般利用者からの入力ではない。したがって外部の未信頼な入力から正規表現を動的に組み立てる、いわゆる正規表現インジェクションのリスクはない
- [x] **ReDoS(破局的バックトラッキング)のリスク**: `REGEX`モードはアプリ管理者が任意の正規表現パターンを入力できるため、理論上は非効率なパターン(壊滅的バックトラッキングを起こすもの)を設定してしまう可能性がある。本プラグインの実行はブラウザ上でレコード保存時に1回限り走るクライアントサイド処理であり、サーバーリソースを消費する攻撃経路(DoS)にはならないため、パターンの複雑さを制限する実装は行っていない。ただし、想定外に長い処理時間で保存操作がフリーズする可能性はあるため、`idea.md`にも運用上の注意として記録する
- [x] `js/lib/config-validation.js`の`validateSplits()`で、`REGEX`モードのパターンが`new RegExp()`でコンパイルできない(構文として不正な)場合は保存させない

## XSS・CSSインジェクション対策

- [x] 設定画面(`js/config.js`)でフィールド一覧・エラーメッセージを描画する際、`innerHTML`ではなく`document.createElement()` + `textContent`のみを使用している。区切り文字・正規表現パターンの入力値も`input.value`の読み書きのみで、DOMへの直接埋め込み(`innerHTML`)は行わない
- [x] 設定行・出力先フィールド行のリスト再描画(`innerHTML = ''`)はリストをクリアするためだけの用途で、外部由来の文字列を差し込んでいない(`<template>`要素からの`cloneNode(true)`で行を組み立てる)
- [x] 出力先フィールドへの書き込み(`desktop.js`/`mobile.js`の`applySplits()`)は`event.record[...].value`への文字列代入と`event.record[...].disabled`の真偽値設定のみで、DOM操作(`innerHTML`等)を一切行わない

## 設定の妥当性検証

- [x] 保存前に`js/lib/config-validation.js`の`validateSplits()`でチェックし、不正な設定(元フィールド未選択、未知の区切りモード、`CHARACTERS`モードで区切り文字0件、`REGEX`モードでパターン未入力またはコンパイル不可、出力先フィールド0件、出力先フィールドの重複)は保存させない
- [x] `kintone.plugin.app.getConfig()`が`null`/`undefined`を返す場合(未設定のアプリ)でも、`js/lib/config-store.js`の`load()`は例外を投げず既定値(`{ splits: [] }`)を返す(`fiscal_year_numbering`/`wareki_date_format`/`subtable_lookup`で確認された「レコード画面で`getConfig()`が`null`を返す」事象への対策を踏襲)
- [x] レコード画面側(`desktop.js`/`mobile.js`)でも、設定に含まれる元フィールド・出力先フィールドが実際のレコードに存在しない場合(フィールド削除・設定の食い違い等)は早期リターンし、画面をクラッシュさせない

## 通信・認証情報の取り扱い

- N/A — 外部サービスとの認証・APIキーのやり取りを行わない。REST APIも使用しないため、認証情報の保存先を検討する必要自体がない

## 編集禁止(disabled化)の仕様(セキュリティというより運用上の注意)

- [x] 出力先フィールドの`disabled`化はJavaScript APIによるUIレベルの制御であり、REST API経由でのフィールド更新やアクセス権(フィールドのアクセス権設定)による制御ではない。悪意あるユーザーがブラウザの開発者ツールやREST APIを直接使えば出力先フィールドを書き換えられる可能性がある。「不正操作を防ぐ」機能ではなく「通常操作でのミスを防ぐUI上の制約」であることを`idea.md`に明記した

## 個別確認事項(利用ユーザーへ委ねる項目)

- 正規表現モードで非効率なパターンを設定した場合の保存時のブラウザフリーズ(上記ReDoSの項目参照)
- 出力先フィールドがREST API経由や他プラグインによって書き換えられた場合、本プラグインの`disabled`設定はUIレベルの制約に留まるため防げない

問題があれば、公開サイトのリポジトリのGitHub Issueで報告してもらい対応する。
