# プロセスアクション自動入力プラグイン(process_action_autofill)

## 機能概要

プロセス管理を有効にしたアプリで、アクションボタンの実行(`app.record.detail.process.proceed`/
`mobile.app.record.detail.process.proceed`)をトリガーに、複数の「ルール」に従ってフィールドの値を
自動的に設定・クリアする。ルールごとに、どのアクション実行かを絞り込む「フィルター条件」(アクション名・
変更前ステータス・変更後ステータス)と、対象フィールド・動作(設定/クリア)・値のソースを設定する。

設計の詳細な検討過程(kintoneドキュメントMCPでの調査結果・ユーザーとの確認事項)は承認済みプラン
`/Users/tatsurohatori/.claude/plans/process-proceedevent-action-nextassigne-compiled-dolphin.md`
を参照。

## フィルター条件(確定・2026-09-14改訂: OR/AND方式に変更)

`event.action.value`(実行したアクション名)・`event.status.value`(変更前ステータス)・
`event.nextStatus.value`(変更後ステータス)の3種類。ルールごとに、**それぞれ複数選択できる**
(`filter.actionNames`/`filter.fromStatuses`/`filter.toStatuses`はいずれも文字列の配列)。

- **同じ種類の中では「いずれかに一致(OR)」、異なる種類の間では「すべてに一致(AND)」**という、
  ファセット検索(絞り込みUI)で一般的な意味論にしている。空配列/未指定はその種類を判定に使わない
  (=いずれでも)。
- 当初は各項目を単一選択(未指定=ワイルドカード、指定した項目同士は常にAND)にしていたが、
  ユーザーから「フィルター条件がANDなのかORなのかわかりにくい」とのフィードバックを受けて改訂した。
  単一選択のままだと「同じ対象へ複数のアクションで同じ値を設定したい」場合にルールを複数作る必要が
  あり、かつAND/ORの意味論自体もUIから読み取りにくかった。チェックボックスによる複数選択+
  「(いずれかにOR一致)」ラベル+「上の3項目はすべてAND判定です」という明示的な注記に変更したことで、
  両方の問題を解消した(`js/config.js`の`renderCheckboxGroup`)。
- いずれもオブジェクトの`.value`プロパティ(ユーザーの言語設定に従った名称)であり、kintoneドキュメント
  MCP「プロセス管理でアクションを実行するときのイベント」で確認済み。
- 設定画面での選択肢構築には`kintone.app.getStatus()`(利用可能画面: レコード一覧/追加/編集/詳細/
  グラフのみで、プラグイン設定画面は非対応と確認済み)ではなく、REST API
  `GET /k/v1/preview/app/status.json`(`kintone.api()`経由、CLAUDE.md開発方針3の「JS APIで実現できない
  場合のみkintone.api()」に該当)を使う。設定画面はアプリ公開前の下書き(preview)に対する操作のため、
  プレビューの状態・アクション一覧を取得する。

## 既知の落とし穴: `<template>`をルール行ごとにcloneNode()する際、ラジオボタンのname属性が衝突する

設定画面のルール一覧は`<template>`+`content.cloneNode(true)`で行を複製する(auto_lookupと同じ
パターン)。この際、テンプレート内のラジオボタン(`name="operation"`等)の`name`属性はクローンしても
そのまま複製されるため、複数のルール行を同じ`<form>`内に並べると、**別々の行にある同名のラジオボタン
同士が1つの排他グループとして扱われてしまう**(ブラウザの標準仕様: ラジオボタンの排他はDOM階層ではなく
同じ`<form>`内での`name`の一致で決まる)。

実際に発生した不具合: 1件目のルールで「値をクリア」を選んだ状態で2件目のルールを追加し「値を設定」を
選ぶと、1件目の「値をクリア」チェックが見た目上外れる(2件目の「値を設定」と同じ`name="operation"`を
共有しているため)。「動作が同じnameだからか複数条件つくると他のがリセットされるときがある」という
フィードバックで判明した。

対処: `js/config.js`の`renderRuleList()`で、各行をクローンした直後に`rowUid`(そのレンダリング時点の
配列インデックス)を使って、ラジオボタングループの`name`属性を行ごとに一意な値(`op-${rowUid}`,
`text-src-${rowUid}`, `number-src-${rowUid}`, `org-src-${rowUid}`, `date-src-${rowUid}`)へ上書きする。
`renderRuleList()`は削除・追加のたびに全行を再構築するため、インデックスは常にその時点で一意。

なお、フィルター条件(アクション名/ステータス)やCHECK_BOX/MULTI_SELECT対象フィールドの複数選択は
チェックボックスで実装しており、チェックボックスは(ラジオボタンと異なり)同じ`name`を共有しても
互いの選択状態に影響しないため、この問題は起きない(`name`属性自体を付与していない)。

## 対象フィールド型とソース種別(確定)

| 対象フィールド型 | 動作=設定のときのソース種別 |
| :-- | :-- |
| SINGLE_LINE_TEXT / MULTI_LINE_TEXT | 固定文字列 / 別の文字列系フィールド(SINGLE_LINE_TEXT・MULTI_LINE_TEXTのみ)のコピー |
| NUMBER | 固定数値 / 別のNUMBERフィールドのコピー |
| RADIO_BUTTON / DROP_DOWN | フィールド自身の選択肢から1つ選択(固定) |
| CHECK_BOX / MULTI_SELECT | フィールド自身の選択肢から複数選択(固定) |
| DATE / DATETIME | 基準(実行時点/作成日時/更新日時/特定の日付・日時フィールド) ± オフセット(単位: 日数/分の固定値) |
| USER_SELECT | アクション実行者(`kintone.getLoginUser()`) |
| ORGANIZATION_SELECT | 特定の組織コード(固定文字列入力) / アクション実行者の優先する組織(`kintone.user.getOrganizations()`の`organization.primary===true`) |
| GROUP_SELECT | 特定のグループコード(固定文字列入力) |

## 日付/日時のソース種別(確定・2026-09-14拡張: 実行時点以外の基準に対応)

当初は「実行時点(now)からのオフセットのみ」だったが、ユーザーから「日付や日時のときは、実行時点
からだけじゃなくて、作成日時や更新日時、特定の日付や日時フィールドからも加減できるようにする」との
要望を受けて、基準を4種類から選べるように拡張した(`source.type`)。

| ソース種別 | 基準 | 設定に必要な項目 |
| :-- | :-- | :-- |
| `NOW_OFFSET` | 実行時点(アクション実行時刻) | 単位・オフセット値 |
| `CREATED_TIME_OFFSET` | レコードの作成日時 | 単位・オフセット値のみ(基準フィールドの指定は不要) |
| `UPDATED_TIME_OFFSET` | レコードの更新日時 | 単位・オフセット値のみ(基準フィールドの指定は不要) |
| `FIELD_OFFSET` | 指定した日付/日時フィールドの値 | 基準フィールド(対象フィールドと**同じ型**のみ選択可)・単位・オフセット値 |

- 作成日時・更新日時はアプリに必ず1つだけ存在するシステムフィールドだが、フィールドコード自体は
  アプリごとに変更可能(既定値はラベルと同じ)なため、設定にフィールドコードを持たせず、実行時に
  `event.record`の各エントリを`type`(`CREATED_TIME`/`UPDATED_TIME`)で検索して見つける
  (`js/lib/value-resolver.js`の`findFieldByType`)。
- `FIELD_OFFSET`の基準フィールドは、対象フィールドと**同じ型(DATE同士、またはDATETIME同士)**のみ
  選択できる(`date_offset_autofill`と同じ制約。DATE→DATETIMEやその逆はタイムゾーンの扱いが曖昧に
  なるため)。対象フィールド自身を基準に選ぶこと(自己参照)も許可している
  (`event.record`から書き換え前の値を読むため一意に定義でき、「実行のたびに期限日を1日延ばす」
  といった用途に使える)。
- 計算方法は`js/lib/date-offset-calculator.js`(旧`now-offset-calculator.js`を汎用化して改名)の
  2関数に集約した。
  - `computeInstantOffsetValue(instantMs, targetFieldType, magnitude, unit)` — 「瞬間」(実行時点・
    作成日時・更新日時はいずれも絶対時刻の1点)を基準にする。対象がDATE型の場合は、その瞬間を
    **ブラウザのローカルタイムゾーンでの年月日**に変換してから加減算する(実行時点をそのままUTCの
    日付に変換すると、日本のようなUTC+の地域では日付がずれるため。加減算自体はDate.UTC()による
    UTC演算でDSTの影響を受けないようにする)。対象がDATETIME型の場合はタイムゾーンの概念が無いため、
    瞬間(エポックミリ秒)へそのまま加減算する。
  - `computeFieldOffsetValue(baseValue, baseFieldType, magnitude, unit)` — 「DATE/DATETIME型
    フィールドの値そのもの」を基準にする(`FIELD_OFFSET`用)。`date_offset_autofill`の
    `applyOffset`と同じ手法: baseFieldTypeがDATEならタイムゾーンなしの暦日としてUTC演算、
    DATETIMEなら絶対時刻としてそのまま加減算する。
- `desktop.js`/`mobile.js`は上記2関数を(`nowMs`に束縛せず)そのままvalue-resolver.jsへ注入する
  (value-resolver.js側で基準となる瞬間・値を都度決めて呼び出すため)。

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

1. フィルター条件: アクション名/変更前ステータス/変更後ステータスの3項目をそれぞれチェックボックスの
   複数選択で指定する(同一項目内はOR、項目間はAND。すべて未チェックの項目は「いずれでも」)
2. 対象フィールド(上表の対応型のみ列挙)
3. 動作: 値を設定/値をクリア(ラジオ)
4. 動作が「値を設定」のときのみ、対象フィールドの型に応じたソース入力欄を表示する
   (`[hidden]`属性で出し分け。`bulk_record_creation`で実際に踏んだ`[hidden]`属性とCSSの`display`
   指定の詳細度衝突バグを避けるため、`css/config.css`の先頭に
   `[hidden] { display: none !important; }`を入れる)。DATE/DATETIME型の場合はさらに基準
   (実行時点/作成日時/更新日時/特定のフィールド)をラジオで選ぶ(「特定のフィールド」選択時のみ
   基準フィールドのセレクトを表示)

保存時に`js/lib/config-validation.js`でチェックする(対象フィールド未選択、非対応型選択、
SET時のソース必須値欠落、コピー元フィールドの型不一致、固定選択肢が現在の選択肢一覧に存在しない、等)。

## 実行時ロジック(確定)

`app.record.detail.process.proceed`(PC)/`mobile.app.record.detail.process.proceed`(モバイル)。

1. 設定読み込み。
2. `event.action.value`/`event.status.value`/`event.nextStatus.value`を取得。
3. `js/lib/rule-matcher.js`で各ルールのフィルター条件と照合(各項目内はOR、項目間はAND、
   未指定〈空配列〉の項目はワイルドカード)。
4. 一致したルールごとに、`event.record`に対象フィールドコードが存在するか確認(存在しなければ
   スキップ。フォームからフィールドが削除された場合のクラッシュ防止、`date_offset_autofill`の
   エッジケース対応を踏襲)。
5. `operation==="SET"`: `js/lib/value-resolver.js`で型別に値を解決する。
   - TEXT/NUMBER: 固定値、またはコピー元フィールドの現在値(`event.record[コピー元].value`)。
   - CHOICE/MULTI_CHOICE: 固定選択肢。
   - DATE/DATETIME: `js/lib/date-offset-calculator.js`の`computeInstantOffsetValue`(実行時点/
     作成日時/更新日時が基準)または`computeFieldOffsetValue`(特定フィールドが基準)で計算
     (前セクション「日付/日時のソース種別」参照)。
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

- `rule-matcher.js` — フィルター条件とaction/status/nextStatusの照合(項目内OR・項目間AND・
  ワイルドカード)
- `date-offset-calculator.js` — 「瞬間」基準(`computeInstantOffsetValue`)/「フィールド値」基準
  (`computeFieldOffsetValue`)のDATE/DATETIME UTC演算(`date_offset_autofill`の
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
