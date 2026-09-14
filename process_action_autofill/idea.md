# プロセスアクション自動入力プラグイン(process_action_autofill)

## 機能概要

プロセス管理を有効にしたアプリで、アクションボタンの実行(`app.record.detail.process.proceed`/
`mobile.app.record.detail.process.proceed`)をトリガーに、複数の「ルール」に従ってフィールドの値を
自動的に設定・クリアする。ルールごとに、どのアクション実行かを絞り込む「フィルター条件」(アクション名・
変更前ステータス・変更後ステータス)と、対象フィールド・動作(設定/クリア)・値のソースを設定する。

設計の詳細な検討過程(kintoneドキュメントMCPでの調査結果・ユーザーとの確認事項)は承認済みプラン
`/Users/tatsurohatori/.claude/plans/process-proceedevent-action-nextassigne-compiled-dolphin.md`
を参照。

## フィルター条件(確定)

`event.action.value`(実行したアクション名)・`event.status.value`(変更前ステータス)・
`event.nextStatus.value`(変更後ステータス)のうち、ルールごとに指定した項目のみをAND条件で
一致判定する。未指定の項目は「いずれでも」として扱う(ワイルドカード)。

- いずれもオブジェクトの`.value`プロパティ(ユーザーの言語設定に従った名称)であり、kintoneドキュメント
  MCP「プロセス管理でアクションを実行するときのイベント」で確認済み。
- 設定画面での選択肢構築には`kintone.app.getStatus()`(利用可能画面: レコード一覧/追加/編集/詳細/
  グラフのみで、プラグイン設定画面は非対応と確認済み)ではなく、REST API
  `GET /k/v1/preview/app/status.json`(`kintone.api()`経由、CLAUDE.md開発方針3の「JS APIで実現できない
  場合のみkintone.api()」に該当)を使う。設定画面はアプリ公開前の下書き(preview)に対する操作のため、
  プレビューの状態・アクション一覧を取得する。

## 対象フィールド型とソース種別(確定)

| 対象フィールド型 | 動作=設定のときのソース種別 |
| :-- | :-- |
| SINGLE_LINE_TEXT / MULTI_LINE_TEXT | 固定文字列 / 別の文字列系フィールド(SINGLE_LINE_TEXT・MULTI_LINE_TEXTのみ)のコピー |
| NUMBER | 固定数値 / 別のNUMBERフィールドのコピー |
| RADIO_BUTTON / DROP_DOWN | フィールド自身の選択肢から1つ選択(固定) |
| CHECK_BOX / MULTI_SELECT | フィールド自身の選択肢から複数選択(固定) |
| DATE / DATETIME | 実行時点(now) ± オフセット(単位: 日数/分の固定値。`date_offset_autofill`のFIXED方式を踏襲、フィールド参照オフセットは対象外) |
| USER_SELECT | アクション実行者(`kintone.getLoginUser()`) |
| ORGANIZATION_SELECT | 特定の組織コード(固定文字列入力) / アクション実行者の優先する組織(`kintone.user.getOrganizations()`の`organization.primary===true`) |
| GROUP_SELECT | 特定のグループコード(固定文字列入力) |

動作=クリアのときは型ごとの空値表現をセットする(kintoneドキュメントMCP「フィールド形式」の
「フィールドの値を空に設定する場合」表に準拠)。

| フィールド型 | クリア時の値 |
| :-- | :-- |
| SINGLE_LINE_TEXT / MULTI_LINE_TEXT / NUMBER | `""` |
| DATE / DATETIME | `null` |
| CHECK_BOX / MULTI_SELECT / USER_SELECT / ORGANIZATION_SELECT / GROUP_SELECT | `[]` |
| DROP_DOWN | `""`(真の空になる) |
| RADIO_BUTTON | `""`を指定すると**初期値に設定されている選択肢が選ばれる**(kintoneドキュメントMCP「イベントオブジェクトで実行できる操作」に明記の仕様。真の空にはならない)。設定画面のクリア選択時・実行時ともにこの制約を前提とする。 |

対象外(非対応フィールド、kintoneドキュメントMCP「イベントオブジェクトで実行できる操作」の
レコード詳細画面イベントの「フィールドの値を書き換える」非対応フィールド一覧に準拠): レコード番号・
作成者・作成日時・更新者・更新日時・ステータス・作業者・計算・自動計算にした文字列1行・添付ファイル・
ルックアップ・ルックアップコピー先フィールド。さらに、フィールド形式ドキュメントで「値の登録または
更新はできません」とされるカテゴリー・関連レコード一覧も対象外とする。テーブル(SUBTABLE)内の
フィールドは今回のスコープ外(v1では対応しない)。

## 将来拡張候補: USER_SELECTの「次の作業者(nextAssignee)」(v1では対応しない)

`process.proceed`イベント自体には「次の作業者」の情報が含まれない(イベントオブジェクトのプロパティは
`action`/`nextStatus`/`status`のみ)。実現するには、実行時に`kintone.app.getStatus()`でプロセス管理の
作業者設定を取得し、`event.nextStatus.value`に対応するステータスの`assignee`設定を解決する必要がある。

- `assignee.type`が`ONE`/`ALL`/`ANY`のいずれか、`assignee.entities[]`の`entity.type`が
  `USER`/`GROUP`/`ORGANIZATION`/`FIELD_ENTITY`/`CREATOR`/`CUSTOM_FIELD`のいずれかという組み合わせで
  構成される(kintoneドキュメントMCP「プロセス管理の設定を変更する」で構造確認済み)。
- `entities`が単一の`USER`エンティティ、または単一の`FIELD_ENTITY`(参照先が作成者・更新者・
  ユーザー選択フィールドで、かつレコード上に現在値がある)であれば1人のユーザーに一意に絞り込める
  可能性があるが、`ORGANIZATION`/`GROUP`丸ごと指定、複数エンティティ指定(`ALL`/`ANY`で候補が複数)、
  `CUSTOM_FIELD`(cybozu.com共通管理のカスタマイズ項目)は「1人のユーザー」に一意に絞り込めない。
- ユーザーとの確認の結果、v1では実装せず、USER_SELECTのソースは「アクション実行者」のみとする。
  将来対応する場合は、上記の限定的なケース(単一USER/単一FIELD_ENTITYで解決可能な場合のみ処理し、
  それ以外は該当ルールをスキップ)から着手するのが現実的。

## 設定画面(確定)

`kintone.plugin.app.setConfig()`にのみ保存する。`kintone.app.getFormFields()`(JavaScript API、
戻り値がREST APIの`properties`と同様の値でラップされない既知の落とし穴に注意)でフィールド一覧・型・
選択肢を取得し、`kintone.api()`でプレビューのプロセス管理設定(状態・アクション一覧)を取得する。

ルールを複数追加・削除できる。ルールごとに:

1. フィルター条件: アクション名/変更前ステータス/変更後ステータスの3セレクト(それぞれ先頭に
   「(いずれでも)」の空選択肢)
2. 対象フィールド(上表の対応型のみ列挙)
3. 動作: 値を設定/値をクリア(ラジオ)
4. 動作が「値を設定」のときのみ、対象フィールドの型に応じたソース入力欄を表示する
   (`[hidden]`属性で出し分け。`bulk_record_creation`で実際に踏んだ`[hidden]`属性とCSSの`display`
   指定の詳細度衝突バグを避けるため、`css/config.css`の先頭に
   `[hidden] { display: none !important; }`を入れる)

保存時に`js/lib/config-validation.js`でチェックする(対象フィールド未選択、非対応型選択、
SET時のソース必須値欠落、コピー元フィールドの型不一致、固定選択肢が現在の選択肢一覧に存在しない、等)。

## 実行時ロジック(確定)

`app.record.detail.process.proceed`(PC)/`mobile.app.record.detail.process.proceed`(モバイル)。

1. 設定読み込み。
2. `event.action.value`/`event.status.value`/`event.nextStatus.value`を取得。
3. `js/lib/rule-matcher.js`で各ルールのフィルター条件と照合(未指定条件はワイルドカード、
   指定項目はAND一致)。
4. 一致したルールごとに、`event.record`に対象フィールドコードが存在するか確認(存在しなければ
   スキップ。フォームからフィールドが削除された場合のクラッシュ防止、`date_offset_autofill`の
   エッジケース対応を踏襲)。
5. `operation==="SET"`: `js/lib/value-resolver.js`で型別に値を解決する。
   - TEXT/NUMBER: 固定値、またはコピー元フィールドの現在値(`event.record[コピー元].value`)。
   - CHOICE/MULTI_CHOICE: 固定選択肢。
   - DATE/DATETIME: `js/lib/now-offset-calculator.js`(`date_offset_autofill`の
     `offset-calculator.js`を基準値`new Date()`固定にした派生版)で計算。
   - USER_SELECT: `kintone.getLoginUser()`(同期API)の`code`を`[{code}]`形式で設定。
   - ORGANIZATION_SELECT: 固定コード、または`kintone.user.getOrganizations()`(非同期API)の結果から
     `organization.primary===true`の1件を`[{code}]`形式で設定(該当なしならスキップ)。
   - GROUP_SELECT: 固定コードを`[{code}]`形式で設定。
6. `operation==="CLEAR"`: `js/lib/clear-value.js`の型別空値表を適用。
7. `kintone.user.getOrganizations()`を使うルールが1件でもあれば、handlerはPromiseを返す。
8. `return event`。

## エッジケース(確定)

- 対象フィールドがフォームから削除された場合: スキップ(クラッシュさせない)。
- コピー元フィールドの値が空: 空文字列をそのまま書き込む(基準フィールドの値が無い場合と区別しない、
  シンプルな挙動)。
- 複数のルールが同一のフィルター条件・対象フィールドに一致する場合: 設定順に上書きされる
  (`date_offset_autofill`の「複数のルールが設定順に処理される」仕様を踏襲)。
- `kintone.user.getOrganizations()`で優先する組織が見つからない(該当エンティティなし)場合: その
  ルールをスキップし、対象フィールドは変更しない。
- RADIO_BUTTONのクリア: 前述の通り初期値の選択肢に戻る(真の空にはならない)。

## TDD

`src/js/lib/`配下の純粋ロジックをJestでユニットテストする(`pnpm test`)。

- `rule-matcher.js` — フィルター条件とaction/status/nextStatusの照合(ワイルドカード・AND一致)
- `now-offset-calculator.js` — 実行時点(now)基準のDATE/DATETIME UTC演算(`date_offset_autofill`の
  `offset-calculator.js`踏襲)
- `value-resolver.js` — SET時の型別値解決(kintone API呼び出し結果は引数として受け取り、関数自体は
  kintone非依存)
- `clear-value.js` — CLEAR時の型別空値表
- `field-eligibility.js` — 対象フィールド型の絞り込み
- `config-store.js` — `kintone.plugin.app.getConfig()`/`setConfig()`のペイロードの読み書き
- `config-validation.js` — ルール配列のバリデーション

kintone依存のグルーコード(`desktop.js`/`mobile.js`/`config.js`)は`src/e2e/*.e2e.test.js`
(Puppeteer、`pnpm run test:e2e`)で実環境テストする。

## 実装で確認した仕様(kintoneドキュメントMCP)

- `app.record.detail.process.proceed`のイベントオブジェクトの`action`/`nextStatus`/`status`は
  いずれも`{ value: "<名称>" }`形式(ユーザーの言語設定に従う)。
- このイベントでのフィールド値書き換え非対応リストにレコード番号・作成者・作成日時・更新者・
  更新日時・ステータス・作業者・計算・自動計算文字列1行・添付ファイル・ルックアップ・
  ルックアップコピー先フィールドが明記されている。
- `kintone.app.getStatus()`はプラグイン設定画面では利用不可(利用可能画面: レコード一覧/追加/編集/
  詳細/グラフ画面のみ)。
- `kintone.user.getOrganizations(code)`は組織の`primary`(優先する組織かどうか)を返す。利用可能画面に
  検索画面・アプリストア・プラグイン設定画面は含まれない(ランタイムでのみ使用)。
- USER_SELECT/ORGANIZATION_SELECT/GROUP_SELECTへの書き込みは`{ value: [{ code: "xxx" }, ...] }`。
- DATE型は`"YYYY-MM-DD"`(タイムゾーンなしの暦日)、DATETIME型は`"YYYY-MM-DDTHH:MM:SSZ"`
  (UTC、ミリ秒なしISO8601)。

セキュアコーディングガイドラインでのリスクチェックは`security-checklist.md`を参照。
