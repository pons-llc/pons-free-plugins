# RIGHT・LEFT・MID関数プラグイン

## 機能

Excel等の表計算ソフトにある`LEFT`・`RIGHT`・`MID`関数のような文字列の部分取得を、kintoneの基本機能
(計算フィールドの文字列関数)にない形で行うプラグイン。元となる文字列フィールドから指定した位置・文字数の
部分文字列を取り出し、別の文字列フィールドへ格納する。

- 設定行(ルール)を複数持てる。1つの元フィールドに対して複数のルールを作ることも、複数の異なる
  元フィールドに対してそれぞれ設定することもできる。
- ルールごとに、元フィールド・関数の種類・パラメータ・出力先フィールド(1つ)を持つ。

## 関数の種類とパラメータ(3種類、Excelの仕様に準拠・1始まりのインデックス)

| 関数 | パラメータ | 動作 |
| :-- | :-- | :-- |
| `LEFT` | 文字数(`length`、1以上の整数) | 先頭から`length`文字を取り出す |
| `RIGHT` | 文字数(`length`、1以上の整数) | 末尾から`length`文字を取り出す |
| `MID` | 開始位置(`start`、1以上の整数)・文字数(`length`、1以上の整数) | `start`文字目(1始まり)から`length`文字を取り出す |

Excelの`LEFT`/`RIGHT`/`MID`と同様、指定した文字数が元の文字列の長さを超える場合は、存在する分だけを
返す(エラーにしない)。`start`が元の文字列の長さを超える場合は空文字列を返す。

## パラメータは固定値のみ(確定・スコープ限定)

`start`・`length`は設定画面で入力する固定の整数値とする。他レコードのフィールド値を動的なパラメータとして
参照する機能(`records_to_subtable_import`の検索条件のような「自レコードのフィールド参照」)は本プラグインの
元メモに記載がなく、スコープ外とした(`判断記録.md`参照)。

## 発動タイミング・編集禁止の仕様(元メモの記載通り、`text_split`と同じ方針)

- `app.record.create.submit` / `app.record.edit.submit`イベントでのみ切り出し処理を実行する。
- 出力先フィールドは追加・編集画面(`create.show`/`edit.show`)で`disabled`にし、直接編集を禁止する
  (元メモ「挿入先の編集を禁止」)。
- 元フィールドはレコード一覧のインライン編集(`app.record.index.edit.show`)で`disabled`にし、
  一覧からの直接編集を禁止する(元メモ「元フィールドは一覧からの編集を禁止」)。通常の追加・編集画面では
  元フィールドは編集可能なまま残す。

(2026-07-10時点の判断: `number_extract`はユーザーレビューにより「change発動・disabledなし」に変更
されたが、本プラグインへの遡及適用はユーザーが明示的に見送っている。`判断記録.md`参照)

## 設定画面

`kintone.plugin.app.setConfig()`にのみ保存する。

- ルールを追加・削除できる。ルールごとに:
  - 元フィールド(`SINGLE_LINE_TEXT`/`MULTI_LINE_TEXT`型から選択)
  - 関数の種類(`LEFT`/`RIGHT`/`MID`)
  - パラメータ(`LEFT`/`RIGHT`は文字数、`MID`は開始位置+文字数)
  - 出力先フィールド(1つ)
- 保存時に`js/lib/config-validation.js`でチェックする(パラメータが1以上の整数でない、出力先フィールド
  未選択、出力先フィールドの重複、元フィールドと出力先フィールドの重複等)。

## TDD

`src/js/lib/`配下の純粋ロジックはJestでユニットテストする(`pnpm test`)。

- `slice.js` — 元の文字列値+関数の種類+パラメータから、切り出した部分文字列を返す
  (`LEFT`/`RIGHT`/`MID`の3関数、文字数超過時の丸め処理を含む)
- `config-store.js` — `kintone.plugin.app.getConfig()`/`setConfig()`のペイロードの読み書きとデフォルト値
- `config-validation.js` — 設定(ルールの配列)のバリデーション

kintone依存のグルーコード(`desktop.js`/`mobile.js`/`config.js`)は今回のタスクスコープでは実環境テスト
(Puppeteer)を行わない(別タスク、e2eは後回し)。

## 実装

kintoneドキュメントMCPを参照しながら実装した(`app.record.create.submit`/`app.record.edit.submit`、
`app.record.create.show`/`app.record.edit.show`、`app.record.index.edit.show`の各イベントで
「フィールドの編集可否を設定する」操作(`record[fieldCode].disabled`)が利用できることを`text_split`実装時に
確認済み)。セキュアコーディングガイドラインでのリスクチェックは`security-checklist.md`を参照。
