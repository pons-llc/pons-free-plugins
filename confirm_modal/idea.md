# モーダル確認プラグイン

## 機能

指定したイベントの発火時に確認ダイアログを表示し、ユーザーがキャンセルを選んだ場合はそのイベント本来の
処理(保存・削除・プロセス管理のアクション実行)を中止する。OK/キャンセルボタンのテキストを変更できる。

- 確認ルール(以下「ルール」)を複数持てる。ルールごとに、対象イベント・ダイアログの文言
  (タイトル・本文・OKボタン・キャンセルボタンのテキスト)を持つ。

## 対象イベント(4種類、確定)

| 対象イベント | 内部名 | イベントタイプ | キャンセル方法 |
| :-- | :-- | :-- | :-- |
| レコード追加の保存 | `CREATE_SUBMIT` | `app.record.create.submit` | ハンドラーで`false`をreturn |
| レコード編集の保存 | `EDIT_SUBMIT` | `app.record.edit.submit` | ハンドラーで`false`をreturn |
| レコード一覧からの削除 | `INDEX_DELETE_SUBMIT` | `app.record.index.delete.submit` | ハンドラーで`false`をreturn |
| プロセス管理のアクション実行 | `PROCESS_PROCEED` | `app.record.detail.process.proceed` | ハンドラーで`false`をreturn |

いずれのイベントも「ハンドラーで`false`をreturnすると処理をキャンセルできる」という共通の仕様であることを
kintoneドキュメントMCPで確認済み。本プラグインは`kintone.showConfirmDialog()`の結果が`'OK'`以外
(`'CANCEL'`または`'CLOSE'`)のとき`false`をreturnする。

## プロセス管理アクションのプレースホルダー(元メモ「アクションの名前やネクストステータス…」への対応、確定)

`PROCESS_PROCEED`向けのダイアログ本文には、`{action}`(実行したアクション名)・`{nextStatus}`
(変更後のステータス名)のプレースホルダーを埋め込める。`app.record.detail.process.proceed`イベントの
`event.action.value`・`event.nextStatus.value`で置換する(`js/lib/template.js`の`renderTemplate()`)。

「次の作業者」はスコープ外とした。`app.record.detail.process.proceed`イベントオブジェクトには作業者情報が
含まれておらず、取得するには`kintone.app.getStatusAssignees()`という別のAPI呼び出しが追加で必要になる。
確認ダイアログの表示のためだけに毎回追加のAPI呼び出しを行うコストと、プレースホルダーとしての実用性を
天秤にかけ、今回のスコープでは見送った(`判断記録.md`参照)。

## PC専用(確定・スコープ限定)

`kintone.showConfirmDialog()`はPC専用のJavaScript APIであり、モバイルには`kintone.showConfirmBottomSheet()`
という別のAPI(設定項目がやや異なる)が必要になる。本プラグインはPC専用とした(`判断記録.md`参照)。

## 設定画面

`kintone.plugin.app.setConfig()`にのみ保存する。

- ルールを追加・削除できる。ルールごとに:
  - 対象イベント(上記4種類から選択)
  - ダイアログのタイトル(省略可)
  - ダイアログの本文(必須。`PROCESS_PROCEED`選択時は`{action}`/`{nextStatus}`のプレースホルダーが
    使える旨を説明文に明記)
  - OKボタンのテキスト(省略可、既定は各言語の「OK」)
  - キャンセルボタンのテキスト(省略可、既定は各言語の「Cancel」)
- 同じ対象イベントに複数のルールを設定した場合、設定順で最初のルールのみを使用する
  (`判断記録.md`参照)。
- 保存時に`js/lib/config-validation.js`でチェックする(対象イベント未選択、本文未入力)。

## TDD

`src/js/lib/`配下の純粋ロジックはJestでユニットテストする(`pnpm test`)。

- `template.js` — 本文テンプレート文字列+コンテキストオブジェクトから、`{key}`形式のプレースホルダーを
  置換した文字列を返す(未知のキーはそのまま残す)
- `rule-lookup.js` — ルールの配列+対象イベントから、設定順で最初に一致するルールを返す
- `config-store.js` — `kintone.plugin.app.getConfig()`/`setConfig()`のペイロードの読み書きとデフォルト値
- `config-validation.js` — 設定(ルールの配列)のバリデーション

kintone依存のグルーコード(`desktop.js`/`config.js`、`kintone.showConfirmDialog()`呼び出しを含む。
モバイル非対応のため`mobile.js`は作成しない)は今回のタスクスコープでは実環境テスト(Puppeteer)を
行わない(別タスク、e2eは後回し)。

## 実装

kintoneドキュメントMCPを参照しながら実装した。`kintone.showConfirmDialog()`の`config.okButtonText`/
`config.cancelButtonText`によるボタンテキストのカスタマイズ、`app.record.create.submit`/
`app.record.edit.submit`/`app.record.index.delete.submit`/`app.record.detail.process.proceed`の
いずれも「ハンドラーで`false`をreturnすると処理をキャンセルできる」という共通仕様であることを確認済み。
セキュアコーディングガイドラインでのリスクチェックは`security-checklist.md`を参照。
