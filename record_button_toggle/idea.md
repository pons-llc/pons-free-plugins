# 追加・編集・コピーボタン非表示プラグイン

## 機能

レコードの状態によって、追加(新規作成)・編集・コピー(再利用)ボタンの表示/非表示を自動的に切り替える
プラグイン(元メモ「サイドバーと同様で追加編集コピーを制御する」)。`sidebar_toggle`
(サイドバー開閉プラグイン)・`group_field_toggle`(グループフィールド開閉プラグイン)と条件エンジン・
ルール評価の考え方を共通化しつつ、対象がサイドバーやグループフィールドではなく画面ボタンである点、
ボタンの種類によって「レコードの文脈(現在表示中の1件のレコード)」を持つ画面と持たない画面が
混在する点が異なる。

**重要な注意(セキュリティ上の性質)**: 本プラグインが提供するのはUIレベルの表示/非表示のみであり、
レコードの追加・編集・複製操作そのものを禁止するアクセス制御機能ではない。ボタンを非表示にしても、
アプリの権限設定で操作権限があるユーザーはURLの直接操作等で該当操作を行うことが技術的に可能なため、
本当に操作を禁止したい場合はkintoneアプリの「アクセス権」設定を使うべきである
(詳細は`security-checklist.md`参照)。

- ルールを複数持てる。ルールごとに、**対象ボタン**(追加/編集/コピー)・条件(日時・ラジオボタン・
  ドロップダウン・チェックボックス・プロセス管理ステータスを組み合わせたAND/OR結合の複数条件、
  または「常に」)・動作(表示/非表示)を持つ。
- 同じ対象ボタンに複数のルールを設定できる。ある対象ボタンについては、そのボタンを対象とする
  ルールを設定順に評価し、最初に一致したルールの動作を適用する(`sidebar_toggle`/`group_field_toggle`
  と同じ優先順位方式)。

## 使用するJavaScript API(kintone公式ドキュメントを直接確認済み)

`kintone_doc` MCPが本セッションでは未認証のため使用できなかった。代わりに、cybozu developer network
の該当ページをWebSearch(検索結果のURLはcybozu.dev公式ドメインのみ)+WebFetchで直接取得し、
原文に近い形で照合して以下の仕様を確認した(推測実装ではない)。

| 対象ボタン | PC | モバイル | 対応画面(PC) | 対応画面(モバイル) |
| :-- | :-- | :-- | :-- | :-- |
| 追加(新規作成) | `kintone.app.showAddRecordButton(state)` | `kintone.mobile.app.showAddRecordButton(state)` | レコード一覧・詳細・グラフ画面 | レコード一覧画面のみ |
| 編集 | `kintone.app.record.showEditRecordButton(state)` | `kintone.mobile.app.record.showEditRecordButton(state)` | レコード詳細画面 | レコード詳細画面 |
| コピー(再利用) | `kintone.app.record.showDuplicateRecordButton(state)` | (モバイル版は未確認。ドキュメントにPC向け関数名のみ記載でモバイル関数名の言及が無かったため、本プラグインはコピーボタンをPC専用として扱う) | レコード詳細画面 | 対象外 |

いずれも引数は`'VISIBLE'`(表示)/`'HIDDEN'`(非表示)の文字列で、戻り値はPromise(解決時に値なし)。

参照ページ(cybozu developer network):
<https://cybozu.dev/ja/kintone/docs/js-api/record/show-or-hide-add-record-button/>、
<https://cybozu.dev/ja/kintone/docs/js-api/record/show-or-hide-edit-record-button/>、
<https://cybozu.dev/ja/kintone/docs/js-api/record/show-or-hide-duplicate-record-button/>

## ルールの条件(sidebar_toggle/group_field_toggleと共通、確定)

`js/lib/condition-engine.js`をそのまま流用する(フィールド種別ごとの演算子・値の比較方法は同一。
日時/日付/時刻・ラジオボタン/ドロップダウン・チェックボックス・プロセス管理ステータス)。

## レコードの文脈が無い画面での条件評価(確定・重要な制約)

追加ボタンは、レコード一覧画面(PC・モバイル共通)・グラフ画面(PC)にも表示され、これらの画面には
「今表示している1件のレコード」という概念が無い(一覧は複数レコード、グラフは集計結果)。
そのため、これらの画面では**条件付き(「条件を満たすとき」)ルールは評価できず、「常に」ルードのみが
適用される**(`js/lib/rule-matcher.js`の`findMatchingRule(record, rules, targetButton)`に
`record`として`null`を渡すと、`mode: 'MATCH'`のルールは無条件でスキップされ、`mode: 'ALWAYS'`の
ルールのみが対象になる)。レコード詳細画面(追加・編集・コピーボタンすべてが表示されうる画面)では、
表示中のレコードの値を使って条件付きルールも通常どおり評価する。

## ボタンの動作(ルールごとに1つ選択)

- `SHOW` — ボタンを表示する(`'VISIBLE'`)
- `HIDE` — ボタンを非表示にする(`'HIDDEN'`)

## 発動する画面・タイミング(確定)

- PC: `app.record.index.show`(追加ボタンのみ、`record`は`null`扱い)、
  `app.record.detail.show`(追加・編集・コピーボタンすべて、表示中のレコードで条件評価)、
  `app.record.graph.show`(追加ボタンのみ、`record`は`null`扱い)
- モバイル: `mobile.app.record.index.show`(追加ボタンのみ、`record`は`null`扱い)、
  `mobile.app.record.detail.show`(編集ボタンのみ。モバイルの追加ボタンAPIは一覧画面専用、
  コピーボタンはモバイル非対応のため対象外)
- レコード詳細画面は表示専用(フィールドが編集できない)であり`change`系イベントが発生しないため、
  `sidebar_toggle`/`group_field_toggle`のような値変更時の再評価は不要(表示時の一度きりの適用で足りる)。

## 設定画面

`kintone.plugin.app.setConfig()`にのみ保存する。

- ルールを追加・削除・並び替えできる。ルールごとに:
  - 対象ボタン(追加/編集/コピー)
  - 条件モード(常に/条件を満たすとき)
  - 条件を満たすときのみ: 条件の結合方法(AND/OR)、条件(フィールド種別・フィールド・演算子・値を
    複数追加・削除できる)。対象ボタンが「追加」の場合、この条件は詳細画面表示時にのみ効果を持ち、
    一覧・グラフ画面では無視される旨を設定画面に注記する
  - 動作(表示/非表示)
- 保存時に`js/lib/config-validation.js`でチェックする(対象ボタン不正、条件モード不正、条件0件、
  フィールド未選択、演算子不正、値未入力、動作の指定不正)。

## TDD

`src/js/lib/`配下の純粋ロジックはJestでユニットテストする(`pnpm test`)。

- `condition-engine.js` — `sidebar_toggle`/`group_field_toggle`と同一(コピー)
- `rule-matcher.js` — レコード(またはレコード文脈が無い画面ではnull)+ルールの配列+対象ボタンから、
  対象ボタンで絞り込んだうえで設定順に最初に一致したルールを返す。`record`が`null`の場合は
  `mode: 'MATCH'`のルールを一致させない(`group_field_toggle`の`rule-matcher.js`をベースに、
  レコード文脈の有無の分岐を追加)
- `button-action.js` — 一致したルール(またはルール無し)から`showAddRecordButton()`等に渡す
  `state`(`'VISIBLE'`/`'HIDDEN'`)を組み立てる
- `config-store.js` — `kintone.plugin.app.getConfig()`/`setConfig()`のペイロードの読み書きと
  デフォルト値
- `config-validation.js` — 設定(ルールの配列)のバリデーション(対象ボタン必須の分が
  `sidebar_toggle`との差分)

kintone依存のグルーコード(`desktop.js`/`mobile.js`/`config.js`、`showAddRecordButton()`等の呼び出しを
含む)は`src/e2e/*.e2e.test.js`(Puppeteer、`pnpm run test:e2e`)で実環境テストする。

## 実装

`kintone_doc` MCPが未認証のため使用できず、代わりにWebSearch(cybozu.devドメインに限定)+WebFetchで
cybozu developer networkの該当ページを直接取得して実装した(上記「使用するJavaScript API」参照)。
セキュアコーディングガイドラインでのリスクチェックは`security-checklist.md`を参照。
