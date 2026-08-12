# 一括承認プラグイン(bulk_approval)

## 機能概要

- レコード一覧画面のヘッダーに「一括承認」ボタンを設置する(`age_grade_field_update`/`bulk_field_update`
  と同じく`kintone.app.getHeaderMenuSpaceElement()`〈PC〉/
  `kintone.mobile.app.getHeaderSpaceElement()`〈モバイル〉に配置)。
- ボタン押下で、**現在の一覧の絞り込み条件**(`kintone.app.getQueryCondition()`)に一致するレコードを
  最大500件取得し、モーダルにチェックボックス付きの一覧として表示する。
- モーダル内でチェックボックスにより対象レコードを選択し、実行するプロセスアクション(名前)を
  ドロップダウンから選択する。選択中のレコードの「現在のステータス」から実行可能なアクション名だけを
  候補にする(チェックボックスの選択が変わるたびに候補を再計算する)。
- 「次へ」を押すと最終確認画面(2つ目のダイアログ)に遷移し、実行対象件数・対象外件数(理由付き)・
  実行するアクション名を表示してから実行する。
- コンフィグ画面では、モーダルの一覧に表示する項目(フィールド)を選択できる。

## 対象とする「自分の一覧」について(確定)

「作業者が自分の一覧に一括承認ボタンを配置」は、**作業者自身が普段見ている絞り込み済みの一覧
(例: 「自分が作業者」で絞り込んだビュー)にこのプラグインのボタンを表示する**という意味であり、
プラグイン自身が「作業者=自分」の絞り込みを行うわけではない。ボタン押下時に取得する対象レコードは、
その時点で画面に適用されている絞り込み条件(`kintone.app.getQueryCondition()`)にそのまま従う
(`bulk_field_update`と同じ設計方針)。

## 取得・参照するプロセス管理情報(kintoneドキュメントMCPで確認済み)

- `kintone.app.getStatus()`(JS API): プロセス管理の設定(`enable`/`states`/`actions`)を取得する。
  レコード一覧画面で利用可能。戻り値はREST API`GET /k/v1/app/status.json`の`revision`を除いた値と
  **同様の値がそのまま返る**(`{ states: {...} }`のようにプロパティ名でラップされない。
  `resp.states`のようなアクセスは誤り)。`js/bulk-approval.js`の呼び出し箇所にこの旨のコメントを残す。
- `actions[].name`/`.from`/`.to`/`.filterCond`/`.type`(`PRIMARY`/`SECONDARY`)/`.executableUser`:
  「現在のステータス(`from`)からアクション`name`を実行すると`to`に遷移する」の定義一覧。
  同一`from`内でアクション名が重複することは無い(REST APIドキュメントに「現在のステータスに同名の
  アクションが複数設定されている場合、そのアクションを指定するとエラーになる」と明記)。
- `states.ステータス名.assignee.type`(`ONE`/`ALL`/`ANY`)・`.entities`: 遷移先ステータスの作業者設定。
  `type === 'ONE'`かつ`entities.length > 0`(次のユーザーから作業者を選択、かつ選択可能なユーザーが
  存在する)の場合、REST API実行時に`assignee`(ログイン名)の指定が必須になる。本プラグインは
  実行時に作業者を選ばせるUIを持たないため、**assignee指定が必須になる遷移は対象外**とし、
  「次の作業者の選択が必要なため対象外」として一覧に表示する(v1のスコープ外、`js/lib/status-actions.js`
  の`isAssigneeRequired()`で判定)。同様に「最初のステータス(`index === '0'`)に作業者が設定されており、
  最初のステータスへ戻すアクション」も対象外にする。
- レコードの「現在のステータス」は、`kintone.app.getFormFields()`で`type === 'STATUS'`のフィールドの
  フィールドコードを特定し(通常は`ステータス`だが変更されている場合があるため型で探す)、
  取得したレコードの当該フィールドの`.value`を使う。

## 対象レコードの取得(確定)

- `kintone.app.getQueryCondition()`で現在の一覧の絞り込み・ソート条件を取得し、
  `kintone.api(kintone.api.url('/k/v1/records.json', true), 'GET', { app, query, fields, totalCount: true })`
  で1回だけ取得する(`limit`は既定500件)。
- 500件を超える場合は先頭500件のみを対象にし、モーダル上部に
  「絞り込み条件に一致する◯件のうち、先頭500件のみを表示しています」と明記する
  (`related_record_summary`等と異なりカーソルAPIで全件処理する設計にはしない。モーダルに
  チェックボックス一覧としてすべて表示・選択させるUIである以上、数千件規模の全件表示自体が
  実用的でないため、500件を実務上の上限として明示する設計判断)。
- 取得するフィールドは `$id` / `$revision` / ステータスフィールドコード / コンフィグで選択した
  表示対象フィールドコード。
- 表形式(`viewType === 'list'`)以外(カレンダー形式・カスタマイズ一覧)ではボタンを表示しない
  (`kintone.app.getQueryCondition()`が意味を持つのは表形式の一覧のため)。

## アクション選択とレコードの振り分け(確定)

- `js/lib/status-actions.js`
  - `listActionsForStatus(actions, statusName)`: 現在のステータスから実行可能なアクション定義の配列。
  - `isAssigneeRequired(states, toStatusName)`: 遷移先ステータスへの遷移がREST API実行時に
    `assignee`必須かどうか。
- `js/lib/selection-partitioner.js`
  - `collectAvailableActionNames(records, statusField, statusSettings)`: 選択中レコードの現在の
    ステータスから実行可能な(かつassignee必須でない)アクション名の和集合(ドロップダウンの選択肢)。
  - `partitionForAction(records, statusField, actionName, statusSettings)`: レコードを
    `eligible`(そのアクションを実行できる)と`ineligible`(理由付き: `STATUS_MISMATCH`/
    `ASSIGNEE_REQUIRED`)に振り分ける。
- チェックボックスの選択状態が変わるたびに`collectAvailableActionNames`でドロップダウンの選択肢を
  再計算する(選択肢が変わりそれまでの選択値が無効になった場合は選択を解除する)。

## 実行(確定)

- `js/lib/batch-writer.js`: `PUT /k/v1/records/status.json`で最大100件ずつバッチ実行する。
  `age_grade_field_update`/`bulk_field_update`と同じく、バッチ全体が失敗した場合のみ
  `PUT /k/v1/record/status.json`で1件ずつ個別実行にフォールバックする(このAPIも他の複数件書き込み
  APIと同様に「1件でも失敗するとリクエスト全体が失敗する」前提で設計する。実機で異なる挙動が
  確認された場合は`.claude/skills/e2e-test/SKILL.md`の方針に従い調整する)。
  - **他プラグイン(age_grade_field_update等)との相違点**: 個別実行時、revision競合以外のエラー
    (権限不足・アクション実行条件の作業者不一致など、承認作業では起こりうる正常な業務エラー)も
    「スキップして続行」の対象にする(エラー内容をそのままスキップ理由として記録する)。
    一括承認は「一部のレコードだけ他ユーザーに先に処理された」状況が普通に起こりうるため、
    1件のエラーで全体を中断せずできる分だけ進める方が実務上望ましいと判断した(確定)。
  - `revision`はモーダル表示時に取得した値をそのまま使い、他ユーザーによる同時更新を検出する。
- 実行完了後、成功件数・スキップ件数(理由の内訳)をalert表示する(自動リロードはしない、
  `age_grade_field_update`と同じ)。

## 設定画面(確定)

`kintone.plugin.app.setConfig()`にのみ保存する(サブテーブルやフィールドの自動作成は行わない)。

- 表示項目(モーダルの一覧に表示するフィールド、複数選択、`kintone.app.getFormFields()`から
  SUBTABLE・添付ファイルを除いた候補を提示。任意項目、0件でも保存可 = ステータスのみの表示になる)
- 実行可能グループコード(カンマ区切り、**最低1つ必須**。`age_grade_field_update`と同じ理由で
  保存時バリデーションにより0件を弾く)

## 実行可能グループによる表示制御(UI上の絞り込みに過ぎないことの明記)

`kintone.user.getGroups()`によるボタンの表示/非表示切り替えは、`age_grade_field_update`/
`related_record_summary`と同じく**UI上の絞り込みに過ぎず、真の権限境界ではない**。実際に
アクションを実行できるかどうかは、対象アプリのプロセス管理の設定(作業者・実行できるユーザー)に
委ねられる(security-checklist.mdに明記)。

## 対応画面(確定・スコープ)

- PC: レコード一覧画面のみ(`app.record.index.show`)。
- モバイル: レコード一覧画面のみ(`mobile.app.record.index.show`)。
- 詳細・作成・編集・印刷画面では何もしない。

## エッジケース

- 対象アプリでプロセス管理が無効(`kintone.app.getStatus()`の`enable === false`): ボタンを表示しない。
- 実行可能グループ0件: 保存時バリデーションで弾く。
- 表形式以外の一覧(カレンダー・カスタマイズ): ボタンを表示しない。
- 絞り込み条件に一致するレコードが0件: モーダルを開かず「対象レコードがありません」と通知して終了する。
- チェックボックスが0件のまま「次へ」: ボタンを無効化して押せないようにする。
- 選択中の全レコードが対象外(ステータス不一致・assignee必須): アクション選択肢が空になり
  「次へ」を無効化、その旨をメッセージ表示する。
- 実行中にrevision競合が発生したレコード: スキップし、結果表示にスキップ件数・理由を含める。
- 500件超: 上限に達した旨をモーダル上部に明記する(上記「対象レコードの取得」参照)。
- コンフィグ削除後にフォームから消えたフィールドコードが残っている場合: 表示項目取得時に
  存在しないフィールドコードを無視する(エラーにしない)。

## TDD

`src/js/lib/`配下の純粋ロジックをJestでユニットテストする。

- `status-actions.js`: `listActionsForStatus`(該当なし/複数該当)、`isAssigneeRequired`
  (ONE+entities有り/ONE+entities無し/ALL/ANY/最初のステータスへ戻すケース)。
- `selection-partitioner.js`: `collectAvailableActionNames`(和集合の計算、assignee必須アクションの
  除外)、`partitionForAction`(ステータス不一致・assignee必須・正常系の振り分け)。
- `field-value-formatter.js`: フィールド型ごとの表示用文字列化(ユーザー選択・組織選択・グループ選択・
  チェックボックス・複数選択・空値)。
- `batch-writer.js`: `age_grade_field_update`と同型のバッチ分割・revision競合フォールバック
  ロジック(移植)に加え、非競合エラーもスキップ対象にする本プラグイン固有の分岐をテストする。
- `config-store.js` / `config-validation.js`: 設定の読み書き・実行可能グループ0件のバリデーション。
