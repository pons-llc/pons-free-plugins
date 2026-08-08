# 年齢・学年フィールド計算用フィールド更新プラグイン(age_grade_field_update)

`plugin_idea.md`「年齢・学年フィールド計算用フィールド更新プラグイン」の詳細仕様。年齢・学年を
`DATEDIF`等で計算するCALCフィールドの「基準日」のような、定期的に「今日の日付」へ更新したい
DATE/DATETIMEフィールドを、一覧画面のボタン押下で対象レコード全件まとめて更新するプラグイン。

## 機能概要

- レコード一覧画面(PC・モバイル両方)に「(対象フィールドのラベル)を更新」ボタンを設置する。
- ボタンは、設定で指定した実行可能グループ(ロール)に所属するユーザーにのみ表示する
  (`kintone.user.getGroups()`、PC/モバイル共通のJavaScript API)。
- ボタン押下時、確認ダイアログ(PC: `kintone.showConfirmDialog()`、モバイル:
  `kintone.mobile.showConfirmBottomSheet()`)で対象レコード数を示して実行確認する。
- 確認後、設定した**クエリ条件**(現在のレコード一覧の絞り込み状態とは無関係な、プラグイン設定で
  固定した条件)に一致する全レコードの対象フィールドへ、実行時点の「現在の値」
  (DATE型なら今日の日付、DATETIME型なら現在日時)を一括で書き込む。

## なぜこのプラグインが必要か(元メモの背景)

kintoneのCALCフィールドで`DATEDIF(生年月日, 基準日, "Y")`のように年齢・学年を計算する場合、
`基準日`をDATE/DATETIMEフィールド(固定値として保存される)にしていると、時間の経過とともに
古い基準日のままになり、年齢・学年の計算結果が更新されなくなる。本プラグインは、この`基準日`
フィールドを一覧画面のボタン1つで対象レコードすべて「今日の日付」に更新できるようにすることで、
定期的な一括更新作業を簡単にする。

## 対象レコードの列挙とバッチ書き戻し(確定・related_record_summaryの実装を踏襲)

書き戻し先・列挙元が同じレコード集合であり、列挙中に他ユーザーの同時編集でレコードが増減する
リスクがあるため、`related_record_summary`の「一覧画面からの一括集計」と同じ設計を踏襲する
(plugin_idea_plan.md「共通の前提・訂正事項」の例外規定、および`related_record_summary`の実装。
`$id`昇順ページングではなくレコードカーソルAPIを使う)。

- `js/lib/cursor-enumerator.js`: レコードカーソルAPI(`POST`→`GET`を`next:false`まで繰り返す)で
  対象レコードを列挙する(`related_record_summary`と同一実装、名前空間のみ変更)。
- `js/lib/batch-writer.js`: `PUT /k/v1/records.json`を100件ずつのバッチで書き戻す。バッチ全体が
  失敗した場合のみ1件ずつの個別送信にフォールバックし、リビジョン競合(409相当)のレコードだけを
  スキップする(`related_record_summary`と同一実装、名前空間のみ変更)。
- カーソル作成時の`fields`パラメーターは`$id`・`$revision`・対象フィールドコード・
  (あれば)レコード番号フィールドコードのみを指定し、不要なフィールドを取得しない。

## 現在の値のフォーマット(確定・実データに基づく実装)

`js/lib/current-value-formatter.js`(純粋関数、Jestでテスト)が担う。kintoneドキュメントMCP
「フィールド形式」で、DATE型の値は`"2012-01-11"`(タイムゾーンなしの暦日)、DATETIME型の値は
`"2012-01-11T11:30:00Z"`(UTC、ミリ秒なしのISO8601)であることを確認済み。

- DATE型: `Date`オブジェクトの**ローカルの**年・月・日から`YYYY-MM-DD`を組み立てる
  (`date.toISOString().slice(0, 10)`は使わない。これは`Date`をUTCとして切り出すため、
  UTCより西のタイムゾーンで夜間に実行すると1日ずれた日付になる典型的な誤り)。
- DATETIME型: `date.toISOString()`(UTC ISO8601、ミリ秒あり)からミリ秒部分を取り除いて
  `.replace(/\.\d{3}Z$/, 'Z')`する(`field_input_panel/src/js/lib/field-value-codec.js`の
  `encodeDatetimeLocal`と同じ手法、ミリ秒なしの形式に揃える)。

## 確認ダイアログ・実行(確定)

- 対象レコード数はカーソルAPI作成時のレスポンス`totalCount`から得る(列挙前に確認ダイアログへ
  表示するため、レコード本体を取得する前に件数だけ知りたい。カーソルは作成した時点でカーソルIDと
  `totalCount`が返るため、ここでは列挙〈GET〉はまだ行わず、確認後に列挙を始める)。
- ダイアログの本文には、対象レコード数・書き込み先フィールド名・書き込む値のプレビュー
  (例:「2026-08-05」)を表示する(`js/lib/build-confirm-message.js`)。
- 対象レコード0件の場合は確認ダイアログを出さず、その旨をalert(PC)/`kintone.mobile.showConfirmBottomSheet`
  を使わない同等の通知で伝える(0件時はOK/キャンセルの選択自体が無意味なため)。
- 実行中は`kintone.showLoading()`/`kintone.mobile.showLoading()`相当のローディング表示と、
  `beforeunload`でのページ離脱防止を行う(`related_record_summary`と同じ、secureCodingGuideline.md
  「短時間で大量のリクエスト送信を避ける」への配慮)。
- 完了後、`js/lib/batch-writer.js`の`buildResultSummary`で結果(対象件数・成功件数・
  リビジョン競合によるスキップ件数)をalert表示する。

## 実行可能グループによる表示制御(UI上の絞り込みに過ぎないことの明記)

`kintone.user.getGroups()`によるボタンの表示/非表示切り替えは、`related_record_summary`・
`plugin_catalog_builder`と同じく**UI上の絞り込みに過ぎず、真の権限境界ではない**。実際に
書き込みできるかどうかは、対象アプリ・対象フィールドのkintone標準のアクセス権設定に委ねられる
(security-checklist.mdに明記)。

## 設定画面

`kintone.plugin.app.setConfig()`にのみ保存する。

- 対象フィールド(必須、DATE/DATETIME型のみ選択可。`kintone.app.getFormFields()`で絞り込む)
- クエリ条件(任意、クエリ形式の文字列。空文字列なら全レコードが対象)
- 実行可能グループコード(カンマ区切り、**最低1つ必須**)。0件のまま保存させると、保存はできるが
  ボタンが誰にも表示されず機能が使えない状態になってしまうため、`related_record_summary`とは
  異なり保存時バリデーションで弾く(確定・使い勝手上の判断)。

## 対応画面(確定・スコープ)

- PC: レコード一覧画面のみ(`app.record.index.show`、`kintone.app.getHeaderMenuSpaceElement()`
  〈集計アイコンの右側〉にボタンを設置。`related_record_summary`と同じ配置)。
- モバイル: レコード一覧画面のみ(`mobile.app.record.index.show`、
  `kintone.mobile.app.getHeaderSpaceElement()`にボタンを設置)。元メモの「モバイル版でもできる
  ように」に対応。
- 詳細・作成・編集・印刷画面では何もしない(一覧画面からの一括更新のみが本プラグインの機能)。

## エッジケース

- 対象フィールドのフィールドコードがフォームから削除された場合: 一覧画面ボタン自体を表示しない
  (`kintone.app.getFormFields()`で存在確認、`isConfigured`相当のガード)。
- クエリ条件が不正(存在しないフィールドコードを指定している等): カーソル作成APIがエラーを返すため、
  そのままエラーメッセージを表示して処理を中止する(推測でクエリを補正しない)。
- 対象レコード0件: 確認ダイアログを出さず「対象レコードがありません」と通知して終了する。
- 書き戻し中にリビジョン競合が発生したレコード: `batch-writer.js`の個別送信フォールバックで
  スキップし、結果表示にスキップ件数・レコード番号を含める(他のレコードの処理は継続する)。
- 対象フィールドの編集権限が無いユーザーが実行した場合: kintone側のフィールドアクセス権により
  書き込みAPI自体がエラーになる(想定内、そのままエラー表示して中止する)。

## TDD

`src/js/lib/`配下の純粋ロジックをJestでユニットテストする。

- `cursor-enumerator.js`: `related_record_summary`と同一(カーソルAPIでの全件列挙、依存性注入)。
- `batch-writer.js`: `related_record_summary`と同一(100件バッチ書き戻し、リビジョン競合フォールバック)。
- `current-value-formatter.js`: DATE型はローカル日付の`YYYY-MM-DD`、DATETIME型はミリ秒なしUTC
  ISO8601を返すこと。日付をまたぐ境界(例: ローカルでは23時台でもUTC変換すると日付が変わる
  ケース)を明示的にテストする。
- `build-confirm-message.js`: 対象件数・フィールド名・書き込む値プレビューを含む本文組み立て。
- `config-store.js`: 設定(targetFieldCode/query/groupCodes)の読み書きと既定値。
- `config-validation.js`: 対象フィールド未選択・実行可能グループ0件のバリデーション。

kintone依存のグルーコード(`js/desktop.js`・`js/mobile.js`・`js/config.js`、確認ダイアログ・
REST呼び出し)は`src/e2e/*.e2e.test.js`(Puppeteer)で実環境テストする。

## 実装

kintoneドキュメントMCPを参照しながら実装した。確認済み事項:

- `kintone.showConfirmDialog()`(PC専用)/`kintone.mobile.showConfirmBottomSheet()`(モバイル専用)
  は同じ`config`引数の形・同じ戻り値(`'OK'`/`'CANCEL'`/`'CLOSE'`)であること。
- 一覧画面のボタン設置先: PCは`kintone.app.getHeaderMenuSpaceElement()`(集計アイコンの右側、
  レコード一覧画面のみで利用可能)、モバイルは`kintone.mobile.app.getHeaderSpaceElement()`
  (一覧を切り替えるメニューの下、レコード一覧・詳細・追加・編集画面で利用可能)。
- `app.record.index.show`(PC)/`mobile.app.record.index.show`(モバイル)のイベント仕様
  (Promise対応、`viewType`等)。
- `kintone.user.getGroups(code)`はPC/モバイル共通のJavaScript API。
- `PUT /k/v1/records.json`の制限事項に「計算」フィールドが値を更新できない旨が明記されている
  (本プラグインの書き込み対象はDATE/DATETIMEのみのため無関係だが、確認済み)。
- レコードカーソル作成API(`POST /k/v1/records/cursor.json`)のレスポンスに`totalCount`が
  含まれ、列挙(GET)前に対象件数を確認できること。

セキュアコーディングガイドラインでのリスクチェックは`security-checklist.md`を参照。
