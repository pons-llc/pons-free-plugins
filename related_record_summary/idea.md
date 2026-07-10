# 関連レコード集計プラグイン

## 機能

- 関連レコード一覧フィールド(REFERENCE_TABLE)を選択し、その参照先アプリのレコードの「件数・合計・平均」を、
  このアプリの指定フィールド(数値)へ書き込む。
- 集計設定は複数行登録できる。行ごとに「関連レコード一覧フィールド / 集計種別 / 集計対象フィールド(合計・平均時) /
  書き込み先フィールド / 除外条件」を指定する。
- 発動条件は3つあり、それぞれON/OFFを独立して切り替えられる。
  - (a) 保存時(作成・編集の`submit`イベント)に自動集計する。
  - (b) 詳細画面にボタンを表示し、クリック時にオンデマンドで集計・保存する。
  - (c) 一覧画面に一括集計ボタンを表示し、現在の絞り込み条件に該当する全レコードを対象に一括集計する。
- 一括集計は、実行可能なユーザーをグループ(複数指定可)で制限できる。
  ただし、これは**ボタンの表示・非表示を切り替えるだけの制御であり、真の権限制御ではない**
  (詳細は下記「グループ制限の限界」およびsecurity-checklist.md参照)。
- 一括集計の実行前には、API実行回数の見積もり(計算式込み)を`kintone.showConfirmDialog()`で表示して確認を求め、
  実行中は`kintone.showLoading()`表示+`beforeunload`によるページ離脱防止を行う。

## 中核制約: 関連レコード一覧フィールドの値はAPIで取得できない

kintoneのドキュメントに明記されている通り、REFERENCE_TABLE(関連レコード一覧)フィールドの値は
JavaScript API・REST APIのいずれでも取得・登録・更新できない。そのため本プラグインは、

1. 自アプリのフィールド設定(`kintone.app.getFormFields()`。REST APIの`GET /k/v1/app/form/fields.json`の
   `properties`と同一の値が返る)から、対象のREFERENCE_TABLEフィールドの`referenceTable`設定
   (`relatedApp.app`・`condition.field`/`condition.relatedField`・`filterCond`)を読み取り、
2. 自レコードの`condition.field`の値を使って、参照先アプリへ`GET /k/v1/records.json`で
   自分でクエリを組み立てて集計する

という方式を取る。除外条件(設定画面で指定)は、`filterCond`(フィールド設定側の絞り込み条件)と
AND結合して合成する(`js/lib/query-builder.js`、TDD済み)。

### JavaScript API優先の適用範囲(CLAUDE.md方針3との整合)

- **自アプリのフィールド設定を読む**部分は`kintone.app.getFormFields()`(JS API)を使う。
  このAPIはREST APIの`properties`と同一の値を返す(`referenceTable`を含む)ため、REST APIを使う必要がない。
  plugin_idea_plan.mdの「4. 関連レコード集計プラグイン」には「フォーム設定API(GET /k/v1/app/form/fields.json)で
  読み」と書かれているが、これはCLAUDE.md方針3(JS APIで実現できるならJS APIを優先)に従い、
  実装では`kintone.app.getFormFields()`に置き換えている(判断記録.md参照)。
- **参照先アプリのレコード取得・自アプリ他レコードへの書き戻し**は、別アプリ・別レコードの読み書きに対応する
  JavaScript APIが存在しないため、REST API(`kintone.api()`)を使う。
- **一覧画面からの一括集計における対象レコード列挙**は、レコードカーソルAPI(REST専用、JS API相当なし)を使う。

## 集計方法

- **件数(COUNT)**: `totalCount: true`のみを指定し、レコード本体は取得しない(`fields: []`)ことで取得コストを抑える。
- **合計(SUM)・平均(AVERAGE)**: 集計対象フィールドの値が必要なため、`$id`昇順ページング
  (`order by $id asc` + 2回目以降は`$id > 直前取得分の最大$id`、500件ずつ)で参照先アプリの全該当レコードを取得し、
  `js/lib/aggregator.js`(TDD済み)で計算する。空文字列・数値変換できない値は集計から除外する
  (件数には影響しない)。
  - このページングは「共通の前提・訂正事項」の**通常の全件取得方針**(`$id`昇順ページング)に従う。
    一括集計の対象レコード列挙(下記)とは別物であることに注意。

## 発動条件ごとの挙動

### (a) 保存時(submit)

`app.record.create.submit` / `app.record.edit.submit`(モバイルは`mobile.app.record.*`)で、
保存前に集計を実行し、書き込み先フィールドへ値を反映してから保存する。
参照先アプリの閲覧権限が無い等で集計に失敗した場合は、`false`をreturnして**保存自体をキャンセル**する
(集計結果が実態とズレたまま保存されることを防ぐ)。

### (b) 詳細画面ボタン

`kintone.app.record.getHeaderMenuSpaceElement()`(PC)/`kintone.mobile.app.getHeaderSpaceElement()`(モバイル)に
「関連レコードを集計」ボタンを表示する。クリック時のみ集計を実行し、`kintone.api()`のPUTで即座に永続化してから
画面表示(`kintone.app.record.set()`)にも反映する。

### (c) 一覧画面からの一括集計

- 対象レコードは、現在の一覧画面の絞り込み条件(`kintone.app.getQueryCondition()`)を使い、
  **レコードカーソルAPI**(`POST /k/v1/records/cursor.json` → `GET /k/v1/records/cursor.json`を
  `next: false`になるまで繰り返し)で列挙する。**`$id`昇順ページングではなくカーソルAPIを使う**
  (対象レコード集合を作成時点で固定でき、実行中の他ユーザーの同時編集による対象の増減ズレを防げるため。
  plugin_idea_plan.mdの確定事項)。
- 実行前に、API実行回数の見積もり(下記)を`kintone.showConfirmDialog()`の本文に表示し、実行確認を取る。
- 実行中は`kintone.showLoading('VISIBLE')` + `beforeunload`でページ離脱を防止する
  (`kintone.showLoading()`表示中はユーザー操作自体もブロックされる)。
- 対象レコードごとに集計 → `PUT /k/v1/records.json`で100件ずつ書き戻す。
- **参照先アプリの閲覧権限が無いユーザーが実行した場合**: 集計(参照先アプリへのGET)が失敗するため、
  例外をそのまま伝播させて**書き込みは1件も行わずに処理全体を中止**する
  (集計結果が実態とズレたまま書き込まれることを防ぐ。確定事項)。
- **書き戻し時のrevision競合(409相当)**: 該当レコードのみ**スキップ**して次のレコードへ進み、
  完了後に「対象レコード数・成功件数・スキップ件数・スキップしたレコード番号一覧」を結果表示する(確定事項)。
  - 注意: `PUT /k/v1/records.json`は**1件でも失敗すると、そのリクエストに含めた全レコードの更新がキャンセルされる**
    仕様のため(REST APIドキュメント「複数のレコードを更新する」の制限事項に明記)、100件バッチのPUTが失敗した
    場合のみ、そのバッチ内のレコードを1件ずつ`PUT /k/v1/record.json`で個別送信し直し、実際に競合したレコードだけを
    スキップとして扱うフォールバック方式にしている(`js/lib/batch-writer.js`、TDD済み。判断記録.md参照)。

### API実行回数の見積もり(確認ダイアログに表示)

```
参照先アプリへの取得API回数(見積り) = ceil(対象レコード数 × 集計設定数 ÷ 500)
書き戻しAPI回数(見積り)           = ceil(対象レコード数 ÷ 100)
合計API実行回数(見積り)           = 上記2つの合計
```

(`js/lib/api-estimate.js`、TDD済み。plugin_idea_plan.mdに明記の計算式そのまま)

## グループ制限の限界(重要)

一括集計ボタンの表示は`kintone.user.getGroups()`(所属グループの取得、キャッシュあり・50回/分の制限)で
判定するが、**これはクライアント側でボタンを出し分けているだけであり、真の権限制御ではない**。

- ボタンを非表示にしても、対象グループに属さないユーザーが直接REST APIを呼び出せば同じ操作は可能である。
- 実際にレコードを書き換えられるかどうかを最終的に決めるのは、参照先アプリ・自アプリ自体のkintoneの
  レコード編集権限設定である。本プラグインはそれに依存する設計であり、グループ制限は運用上の補助に過ぎない。

この限界を許容できない場合は、参照先アプリ・自アプリのアプリ権限設定自体で編集可能なユーザーを絞り込む
運用が必要になる。

## 設定画面

`kintone.plugin.app.setConfig()`にのみ保存する(`setProxyConfig()`は使わない。認証情報を扱わない設計のため)。

- 集計設定の行(複数追加可能): 関連レコード一覧フィールド / 集計種別(件数・合計・平均) /
  集計対象フィールド(合計・平均時のみ、参照先アプリの数値フィールドから選択。参照先アプリのフィールド一覧は
  `GET /k/v1/app/form/fields.json`をREST APIで取得して候補を出す。他アプリのフィールド一覧を読むだけの用途で
  レコードの読み書きではない) / 書き込み先フィールド(自アプリの数値フィールド) / 除外条件(クエリの断片)
- 発動条件: 保存時 ON/OFF、詳細画面ボタン ON/OFF、一覧画面一括集計ボタン ON/OFF
- 一括集計を許可するグループコード(カンマ区切りで複数指定可)

## TDD

`src/js/lib/`配下の以下の純粋ロジックをJestでユニットテストする(`pnpm test`)。

- `query-builder.js`: 関連レコードフィールド設定(参照先アプリ・関連付けフィールド・絞り込み条件)+除外条件から
  集計用クエリ文字列を合成する(AND結合、ダブルクォートのエスケープ、数値/文字列の判定を含む)。
- `aggregator.js`: 件数・合計・平均を、取得したレコード配列から計算する。
- `api-estimate.js`: 対象レコード数・集計設定数からAPI実行回数見積もり文字列を組み立てる。
- `batch-writer.js`: 書き戻し用リクエストの100件分割、バッチ失敗時の個別送信フォールバック、
  revision競合(409相当)のスキップ集計。
- `cursor-enumerator.js`: レコードカーソルAPIでの全件列挙(`next`判定、空ページでも継続、
  中断時の`deleteCursor`呼び出し)のorchestrationロジック(API呼び出しは依存性注入でテスト可能にしている)。
- `paged-fetch.js`: 参照先アプリのSUM/AVERAGE集計用の`$id`昇順ページング。
- `config-store.js`: `kintone.plugin.app.setConfig()`/`getConfig()`のペイロードの読み書きと既定値。

kintone依存のグルーコード(`related-record-client.js`, `summary-service.js`, `bulk-summary.js`,
`desktop.js`/`mobile.js`, `config.js`)は、Puppeteerによる実環境テスト(CLAUDE.md項目6)で検証する
(今回のタスクスコープには含まない。今後追加予定)。

## 実装時の未決事項の暫定対応

plugin_idea_plan.mdで未決事項として残っていた以下2点は、暫定対応を決めて実装した。詳細は`判断記録.md`を参照。

- **submit時集計の途中失敗時の再開**: 再開機能は持たない。失敗時は保存自体をキャンセルし、ユーザーに
  再度保存操作をやり直してもらう(idea.md本文の「(a) 保存時」参照)。一括集計についても、進捗の永続化・再開は
  実装せず、完了後に成功/スキップ件数とスキップしたレコード番号一覧を結果表示するのみとする。
- **関連レコードのfilterCondに動的条件(`LOGINUSER()`等)が含まれる場合のクエリ再現互換性**:
  `filterCond`はクエリ文字列としてそのまま(内容を解釈・置換せず)AND結合する。`LOGINUSER()`等の関数呼び出しは
  参照先アプリへのクエリ実行時にkintone側で評価されるため、実行ユーザーのコンテキストで正しく評価されることを
  期待する(`js/lib/query-builder.js`のテスト「dynamic conditions such as LOGINUSER() through verbatim」参照)。
  ただし、一括集計は「実行者」が集計対象レコードの本来の所有者と異なる場合があり、`LOGINUSER()`が
  「一括集計を実行した人」に解決される点には注意が必要(運用上の注意点としてsecurity-checklist.mdにも記載)。

## 実装

kintoneドキュメントMCPを参照しながら実装。特にセキュアコーディングガイドラインでリスクチェックを行うこと
(security-checklist.md参照)。
