# 一覧強調プラグイン

## 機能

レコード一覧画面(表形式)で、指定した条件に一致する行を指定した色で強調表示する。強調ルールを複数設定でき、
ルールごとに異なる色を選べる。

- 強調ルール(以下「ルール」)を複数持てる。ルールごとに、条件(AND/OR結合の複数条件)と背景色を持つ。
- 1行が複数のルールに一致する場合、設定順で最初に一致したルールの色を採用する(優先順位、`判断記録.md`参照)。

## 技術アプローチ

`kintone.app.setRecordListStyle(config)`(JS API、PC/モバイル両対応、`app.record.index.show`イベント内で
呼ぶ)で行単位の背景色を設定する。このAPIは列(フィールド)ごとにスタイルを指定する仕様のため、行全体を
強調するには、そのレコードに含まれるフィールド列すべてに同じ背景色を設定する
(`js/lib/style-builder.js`の`buildStyleConfig()`)。

## 条件の演算子(確定・`subtable_cross_app_insert`と同じ演算子セット)

`EQ`(等しい)・`NEQ`(等しくない)・`GT`(より大きい)・`GTE`(以上)・`LT`(より小さい)・`LTE`(以下)・
`CONTAINS`(を含む)・`NOT_CONTAINS`(を含まない)・`IS_EMPTY`(空である)・`IS_NOT_EMPTY`(空でない)の
10種類(`js/lib/condition-engine.js`)。`GT`/`GTE`/`LT`/`LTE`は数値として比較し、それ以外は文字列として
比較する。

## 条件の結合(AND/OR、確定)

ルールごとに複数の条件(フィールド・演算子・値)を持て、`AND`または`OR`のどちらか一方で結合する
(`subtable_cross_app_insert`の発動条件と同じ、ネストしないフラットな結合)。

## 対象列(確定・スコープ限定)

`kintone.app.setRecordListStyle()`の制限事項に明記されている非対応フィールド(関連レコード・グループ・
罫線・ラベル・スペース・テーブル内フィールド)を除いた、レコードに含まれる列すべてに背景色を適用する。
操作UI列(詳細表示ボタン・編集/削除ボタン)は本プラグインのスコープ外とし、背景色を適用しない
(`判断記録.md`参照)。

## 発動する画面(確定)

`app.record.index.show`イベント(PC: `app.record.index.show`、モバイル: `mobile.app.record.index.show`)。
`viewType`が`list`(表形式)のときのみ動作する(カレンダー形式・カスタマイズビューは対象外、
`kintone.app.setRecordListStyle()`自体が表形式専用のため)。

## 設定画面

`kintone.plugin.app.setConfig()`にのみ保存する。

- ルールを追加・削除できる。ルールごとに:
  - 条件の結合方法(AND/OR)
  - 条件(フィールド・演算子・値を複数追加・削除できる)
  - 背景色(カラーピッカー、16進カラーコード)
- 保存時に`js/lib/config-validation.js`でチェックする(条件0件、色未指定等)。

## TDD

`src/js/lib/`配下の純粋ロジックはJestでユニットテストする(`pnpm test`)。

- `condition-engine.js` — レコード+条件(AND/OR結合の複数条件)から、条件を満たすかどうかを判定する
- `rule-matcher.js` — レコード+ルールの配列から、設定順で最初に一致したルールを返す
- `style-builder.js` — レコードの配列+ルールの配列+対象列コードの配列から、
  `kintone.app.setRecordListStyle()`に渡す`config.body`を組み立てる
- `config-store.js` — `kintone.plugin.app.getConfig()`/`setConfig()`のペイロードの読み書きとデフォルト値
- `config-validation.js` — 設定(ルールの配列)のバリデーション

kintone依存のグルーコード(`desktop.js`/`mobile.js`/`config.js`、`kintone.app.setRecordListStyle()`呼び出しを
含む)は今回のタスクスコープでは実環境テスト(Puppeteer)を行わない(別タスク、e2eは後回し)。

## 実装

kintoneドキュメントMCPを参照しながら実装した。`kintone.app.setRecordListStyle()`の`config.body[].style[]`が
列単位のスタイル指定であること、`app.record.index.show`の`event.records`から`$id`(レコードID)を取得できる
ことを確認済み。セキュアコーディングガイドラインでのリスクチェックは`security-checklist.md`を参照。
