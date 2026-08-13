# カンバンボードプラグイン(kanban_view)

## 機能概要

レコード一覧画面(**表形式**, `viewType: 'list'`)に、カンバン形式のボード(列=グループ、カード=レコード)を表示する、**PC専用・表示専用**のプラグイン(ドラッグ&ドロップでの編集は行わない。表示専用という方針は`calendar_view`/`gantt_chart_view`/`hierarchy_view`と揃える)。

- 対象は通常の一覧(表形式)。`app.record.index.show`イベントの`event.viewType === 'list'`のときのみ対象と判定する。
- `event.viewId`で**一覧ごとに表示設定を切り替えられる**(`calendar_view`と同じ方式。一覧IDが未設定〈空欄〉の設定は「すべて」のデフォルト設定として使う)。REST API(`GET /k/v1/app/views.json`)による一覧の列挙は行わず、一覧IDは管理者がブラウザURLの`view=`パラメータから直接入力する(`calendar_view`の判断を踏襲)。
- ボードは`kintone.app.getHeaderSpaceElement()`(「一覧メニュー」と「レコード一覧(表)」の間、フル幅)に描画する。**ネイティブの表(一覧本体)はそのまま残し、非表示にはしない**(`calendar_view`と同じ理由。判断記録.md参照)。

## データ取得方針(JavaScript APIのみ・event.recordsのみ)

**REST APIは一切使わない。** 一括承認プラグイン(`bulk_approval`)と同じ設計方針で、`app.record.index.show`イベントの`event.records`(現在ページの一覧に表示されているレコード配列)のみを対象とする。ボタン押下等の追加アクションは無く、一覧表示時にそのまま描画するため、`bulk_approval`のような「ボタン押下時に最新の`event.records`を参照する」仕組みは不要(表示専用のため、一覧が再描画されるたびに`app.record.index.show`が再発火してボードも再描画される)。

- 対象件数の上限は一覧側の「1ページあたりの表示件数」設定(最大500件)にそのまま従う。`calendar_view`のような自主的な100件打ち切りは行わない(カンバンは列ごとにスクロールする前提のUIであり、カレンダーの時間軸描画のような性能上の制約が無いため)。
- レコードの識別子(`id`)は`event.records`の各要素が持つ`$id`(REST APIと同じ形式)から取り出す。

## グループ分け(ボードの列)

設定画面で、一覧ごとにグループ分け方法を選択する(**確定・ユーザー指示**: ラジオボタン/ドロップダウンフィールド、またはプロセス管理のステータスのいずれか)。

- `groupMode: 'FIELD'`: `RADIO_BUTTON`または`DROP_DOWN`フィールドを1つ選択(`groupFieldCode`)。列の並び順はフィールドの選択肢の並び順(`getFormFields()`の`options[].index`昇順)に従う。選択肢に存在しない値(削除された選択肢等)を持つレコードは「その他」列にまとめ、値が空のレコードは「未設定」列にまとめる(いずれも末尾)。
- `groupMode: 'STATUS'`: プロセス管理の現在のステータスでグループ分けする。ステータスフィールドは`getFormFields()`で`type === 'STATUS'`のフィールドを探して特定する(`bulk_approval`と同じ方式。通常は`ステータス`という名前だが変更されている場合があるため型で探す)。列の並び順は`kintone.app.getStatus()`の`states[ステータス名].index`昇順(`bulk_approval`の`groupRecordsByStatus`を移植)。プロセス管理が無効なアプリでは、この一覧設定自体が使用不能である旨を設定画面に表示する。

## 担当者の表示(カードごと)

設定画面で、一覧ごとに担当者の表示元を選択する(**確定・ユーザー指示**: ユーザー選択フィールドの先頭の1人、またはプロセス管理の作業者)。

- `assigneeMode: 'USER_FIELD'`: `USER_SELECT`フィールドを1つ選択(`assigneeFieldCode`)。値(配列)の**先頭の1人**の`name`をカードに表示する。
- `assigneeMode: 'STATUS_ASSIGNEE'`: `getFormFields()`で`type === 'STATUS_ASSIGNEE'`のフィールドを探して特定する(ステータスフィールドと同じ方式)。値は配列(`ONE`/`ALL`/`ANY`の設定によらず配列形式。[フィールド形式ドキュメント](kintoneドキュメントMCPで確認済み)参照)で、**先頭の1人**の`name`を表示する。作業者が未設定のレコードは「(未割当)」と表示する。
- どちらの場合も担当者が0人のときはカードに担当者チップを表示しない。

## カードの表示項目

- タイトルフィールド(必須、1つ、`titleFieldCode`): `SUBTABLE`以外の全フィールド型を選択可能。カード上部に太字で表示する。値は`js/lib/format-field-value.js`の`formatFieldValue()`で文字列化し、`textContent`でDOMへ挿入する(`innerHTML`不使用)。
- ホバー詳細(任意、複数選択可、`hoverFieldCodes`): カード要素の`title`属性(ブラウザ標準のツールチップ、DOM APIのプロパティ代入でHTMLエスケープの心配がない)に、ラベルと値を改行区切りで設定する(`calendar_view`と同じ方式)。
- 期限フィールド(任意、`dueFieldCode`、`DATE`または`DATETIME`): カードに期限日を表示する(`DATETIME`の場合は日付部分のみ表示)。未設定のレコードは期限行を表示しない。
- バッジフィールド(任意、`badgeFieldCode`): `SUBTABLE`以外の任意のフィールド型を選択可能。値をタグ(チップ)として表示する(複数値を持つフィールド型の場合は`formatFieldValue()`でカンマ区切りに結合してから1つのチップに表示する)。
- 担当者チップ(上記「担当者の表示」参照): カード右下に表示する。
- **期限超過のファイアマーク**(**確定・ユーザー指示**): 期限フィールドが設定されており、かつ値が「今日」より前(日付のみで比較。`DATETIME`は日付部分のみを比較し、時刻は見ない)の場合、期限表示の先頭に🔥を付ける。「今日」は実行時のブラウザのローカル日付とする。

## レコード詳細画面への遷移

- カードをクリックすると、`kintone.buildPageUrl('APP_DETAIL', { appId, recordId })`(JavaScript API)でURLを組み立て、**別タブ**で開く(`window.open(url, '_blank', 'noopener')`。確定・2026-08-13。同じタブで遷移すると、ボードを表示していた一覧の絞り込み・スクロール位置が失われるため、`calendar_view`の「同じタブ遷移」から変更した)。

## 設定画面

対象一覧(view)ごとに、以下を設定する(`kintone.plugin.app.setConfig()`にのみ保存)。

- 対象一覧ID(空欄で「すべて(デフォルト)」)
- グループ分け方法: `FIELD`(ラジオ/ドロップダウンから1つ選択) / `STATUS`
- 担当者の表示元: `USER_FIELD`(ユーザー選択フィールドから1つ選択) / `STATUS_ASSIGNEE`
- タイトルフィールド(必須)
- 期限フィールド(任意、DATE/DATETIME)
- バッジフィールド(任意)
- ホバー項目(複数選択可)

保存時は`js/lib/config-validation.js`でバリデーションする(タイトル未選択、`groupMode: 'FIELD'`なのに`groupFieldCode`未選択、`assigneeMode: 'USER_FIELD'`なのに`assigneeFieldCode`未選択、同一一覧IDの重複登録などをチェック)。

## TDD

`src/js/lib/`配下の以下の純粋ロジックをJestでユニットテストする(`pnpm test`)。

- `view-resolution.js`: `event.viewId`と設定配列から対象の一覧設定を引き当てる(`calendar_view`からそのまま移植・同一ロジック)
- `config-store.js`: 設定の読み書き・既定値フォールバック
- `config-validation.js`: 設定画面のバリデーション
- `format-field-value.js`: フィールド型ごとの表示用文字列化(`calendar_view`からそのまま移植)
- `record-grouping.js`: `groupRecordsByField()`(選択肢順・その他/未設定フォールバック)、`groupRecordsByStatus()`(`bulk_approval`から移植、ステータスのindex順)
- `assignee-resolver.js`: `resolveAssignee()`(`USER_FIELD`/`STATUS_ASSIGNEE`いずれのモードでも配列の先頭1人を取り出す。0人なら`null`)
- `due-date.js`: `isOverdue()`(`DATE`/`DATETIME`値と基準日〈今日〉の日付部分のみの比較)、`formatDueDate()`
- `card-model.js`: `buildCard()`(レコード1件と設定・フォームフィールド情報から、タイトル・ホバー文字列・期限表示〈超過フラグ含む〉・バッジ・担当者チップをまとめたカード表示用オブジェクトへ変換する統合ロジック)

kintone依存のグルーコード(`js/kanban-render.js`、`js/desktop.js`、`js/config.js`)は、Puppeteerによる実環境テスト(`pnpm run test:e2e`)で別途検証する。

## 実装で確認したkintone API仕様(kintoneドキュメントMCPで確認済み)

- `app.record.index.show`: `event.viewId`・`event.viewName`・`event.viewType`(`list`/`calendar`/`custom`)・`event.records`(`list`のときは現在ページのレコード配列、REST不要)を持つ。
- フィールド値の形式(REST APIと共通、[フィールド形式ドキュメント](kintoneドキュメントMCP `overview/field-types`で確認済み)):
  - `USER_SELECT`: `{ type: 'USER_SELECT', value: [{ code, name }, ...] }`(未選択時は`value: []`)
  - `STATUS_ASSIGNEE`(作業者): `{ type: 'STATUS_ASSIGNEE', value: [{ code, name }, ...] }`(`ONE`/`ALL`/`ANY`のいずれの設定でも配列形式。未割当時は`value: []`)
  - `STATUS`: `{ type: 'STATUS', value: 'ステータス名(文字列)' }`
  - `DATE`: `{ type: 'DATE', value: 'YYYY-MM-DD' }`(未入力時は`value: null`、REST API経由)
  - `DROP_DOWN`/`RADIO_BUTTON`: `{ value: '選択肢の文字列' }`
- `kintone.app.getFormFields()`(JS API): REST版`GET /k/v1/app/form/fields.json`の`properties`と同等の値を返す(戻り値自体が`properties`の中身であり、`{ properties: {...} }`のようにラップされない。CLAUDE.mdの既知の落とし穴)。`DROP_DOWN`/`RADIO_BUTTON`の`options`(選択肢と`index`)もここから取得できる。
- `kintone.app.getStatus()`(JS API): プロセス管理の設定(`enable`/`states`/`actions`)を取得する。戻り値はREST API`GET /k/v1/app/status.json`の`revision`を除いた値と同様の値がそのまま返る(`bulk_approval`で確認済み)。
- `kintone.app.getHeaderSpaceElement()`(PC専用): 「一覧メニュー」と「レコード一覧」の間の、フル幅の要素を取得できる。利用できる画面はレコード一覧画面のみ(`calendar_view`で確認済み)。
- `kintone.buildPageUrl('APP_DETAIL', { appId, recordId })`: レコード詳細画面のURLを非同期で組み立てる(`calendar_view`で確認済み)。

## 既知の制約・将来課題

- ドラッグ&ドロップでの編集は行わない(表示専用)。
- モバイル版は初期スコープ外(PC専用)。
- 一覧IDをURLから手動確認する運用は`calendar_view`と同じトレードオフ(REST不使用の設計判断)。
- カード内の複数バッジ表示(バッジフィールドは1つのみ)は初期スコープ外。
