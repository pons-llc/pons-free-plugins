# wareki_date_format セキュリティチェックリスト

[secureCodingGuideline.md](../secureCodingGuideline.md)の一般項目([box_gdrive_iframe/security-checklist.md](../box_gdrive_iframe/security-checklist.md)参照、UTF-8/BOMなし・名前空間分離・`'use strict'`・外部スクリプト不使用などは同様に満たしている)は重複記載を省略し、本プラグイン固有の項目のみ記載する。

最終確認日: 2026-07-09 / 対象: 初回実装時点

## コーディング作法

- [x] 文字コードはUTF-8(BOMなし)
- [x] グローバル変数を作らず、即時関数(IIFE)+名前空間オブジェクト(`window.WarekiDateFormat`)のみを公開している(`js/lib/zenkaku.js`, `js/lib/wareki.js`, `js/lib/config-store.js`, `js/lib/config-validation.js`)
- [x] 既存のkintoneグローバルオブジェクトを書き換え・参照していない
- [x] `'use strict'`を全JSファイルの先頭で使用している
- [x] kintone内部のid/class属性やDOM構造に依存せず、JavaScript API(`kintone.app.getFormFields()`, `kintone.plugin.app.getConfig/setConfig()`, `kintone.events.on()`のイベントオブジェクト経由の値書き換え)のみを使用している

## REST API・外部通信

- [x] 本プラグインはREST APIを一切使用しない(CLAUDE.md開発方針3に準拠)。`kintone.app.getFormFields()`(JS API)でフィールド一覧を取得するのみで、レコードの読み書きはすべて`kintone.events.on()`のイベントオブジェクト(`event.record`)の書き換え、または設定画面での`kintone.plugin.app.setConfig()`のみで完結する
- [x] kintone以外の外部サーバーへの通信(fetch/XHR)を一切行わない。和暦変換はブラウザ標準の`Intl.DateTimeFormat`のみで完結する
- [x] 外部ライブラリを一切使用していない(vanilla JSのみ、`js/lib/`配下は依存なしの純粋関数)

## XSS・CSSインジェクション対策

- [x] 設定画面(`js/config.js`)でフィールド一覧・エラーメッセージを描画する際、`innerHTML`ではなく`document.createElement()` + `textContent`のみを使用している(`buildOptions()`のoption要素、`errorsEl.textContent`でのバリデーションエラー表示)。フィールドラベルはアプリ管理者が設定した文字列であり利用者からの直接入力ではないが、念のため`textContent`で統一している
- [x] `pairListEl.innerHTML = ''`/`eraListEl.innerHTML = ''`は再描画のたびにリストをクリアするためだけの用途で、外部由来の文字列を差し込んでいない(`<template>`要素からの`cloneNode(true)`で行を組み立てる)
- [x] 元号テーブルの元号名(管理者がテキスト入力する自由記述)は`<input>`要素の`value`プロパティへの読み書きのみで扱っており、`innerHTML`への差し込みは行っていない(`renderEraList()`)。`Wareki.format()`が組み立てる和暦文字列(元号名を含む)も出力先フィールドへは`event.record[...].value`への代入のみで、DOM描画はkintone本体に委ねられる(既存の「出力先フィールドへの書き込み」の項と同様)
- [x] プレビュー表示(`updatePreview()`)は固定のサンプル日付(`2024-07-09`)を`Wareki.format()`に通した結果を`textContent`で表示するのみで、ユーザー入力をそのまま描画する箇所はない
- [x] 出力先フィールドへの書き込み(`desktop.js`/`mobile.js`の`recomputeAll()`)は`event.record[...].value`への文字列代入のみで、DOM操作(`innerHTML`等)を一切行わない。kintone側のフィールド描画(テキストボックスへの値表示)はkintone自身が担うため、XSS対策はkintone本体のレンダリングに委ねられる
- [x] 外部サイトへのリダイレクト・URL生成を行っていない。`window.location.href`に渡す値は`kintone.app.getId()`など信頼できる内部値のみ(`js/config.js`の保存後・キャンセル時の画面遷移)

## 設定の妥当性検証

- [x] 保存前に`js/lib/config-validation.js`の`validatePairs()`でチェックし、不正な設定(変換元/出力先未選択、未知のプリセット値、`zenkaku`が真偽値でない、変換元と出力先が同一フィールド、複数ペアが同じ出力先フィールドへ書き込む重複設定)は保存させない
- [x] 元号テーブルも同様に`validateEras()`でチェックし、元号名未入力・改元日がYYYY-MM-DD形式でない・改元日が複数行で重複、のいずれかがあれば保存させない
- [x] `kintone.plugin.app.getConfig()`が`null`/`undefined`を返す場合(未設定のアプリ)でも、`js/lib/config-store.js`の`load()`は例外を投げず既定値(`{ pairs: [] }`)を返す(`fiscal_year_numbering`で確認された「レコード画面で`getConfig()`が`null`を返す」事象への対策を踏襲)
- [x] レコード画面側(`desktop.js`/`mobile.js`)でも、設定に含まれる変換元/出力先フィールドコードが実際のレコードに存在しない場合(フィールド削除・設定の食い違い等)は`recomputeAll()`内で早期リターンし、画面をクラッシュさせない
- [x] 保存する設定(`kintone.plugin.app.setConfig()`)にはフィールドコード・プリセット名・真偽値のみを含み、認証情報や個人情報は一切含まれない

## 通信・認証情報の取り扱い

- N/A — 外部サービスとの認証・APIキーのやり取りを行わない。REST APIも使用しないため、認証情報の保存先を検討する必要自体がない

## 出力先フィールドの上書き方針(仕様上の注意、セキュリティというより運用上のリスク)

- [x] 出力先フィールドはプラグインが常に上書きする設計であることを`idea.md`に明記した。ユーザーが出力先フィールドへ手入力しても、次の変換元フィールド変更または保存操作で上書きされる。この仕様により「出力先フィールドを自由記述に使えない」という運用制約が生じるが、意図した挙動である

## タイムゾーンの扱い(要確認・暫定対応、判断記録.md参照)

- [ ] DATETIME/CREATED_TIME/UPDATED_TIME型の値(UTCのISO文字列)を和暦の暦日に変換する際、`Asia/Tokyo`固定のタイムゾーンで計算している(`js/lib/wareki.js`の`DEFAULT_TIME_ZONE`)。kintoneのユーザーごとのタイムゾーン設定を取得するJS APIが見当たらなかったための暫定対応であり、日本国内利用(Asia/Tokyo)以外のタイムゾーンを使っているユーザーでは、画面表示の日時と本プラグインが計算する和暦の暦日が別の日にずれる可能性がある。セキュリティ上のリスクではなく計算結果の正確性の問題だが、業務データ(帳票の日付表記等)に影響し得るため未解決事項として記録する

## 個別確認事項(利用ユーザーへ委ねる項目)

- 改元当日をまたぐタイミングでの実運用での挙動確認。既定では`Intl`のICUデータに依存するため、ブラウザの更新状況によっては新元号への追従が遅れる可能性がある。新元号公表〜ICU側の対応が行き渡るまでの期間は、設定画面の元号テーブルに元号名・改元日を手動登録することで回避できる(`idea.md`「元号の判定方法」参照)
- タイムゾーンがAsia/Tokyo以外のユーザーでの、DATETIME系フィールドの和暦変換結果と画面表示の日付のずれ

問題があれば、公開サイトのリポジトリのGitHub Issueで報告してもらい対応する。
