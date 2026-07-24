# グループフィールド開閉プラグイン

## 機能

レコード画面のグループフィールドの開閉状態を、レコードの値の条件によって自動的に切り替えるプラグイン
(元メモ「サイドバー開閉プラグインと同様。グループフィールドごとに設定。」)。`sidebar_toggle`
(サイドバー開閉プラグイン)と条件エンジン・ルール評価の考え方を共通化しつつ、対象がサイドバーではなく
グループフィールドである点、グループフィールドごとに独立してルールを設定できる点が異なる。

- ルールを複数持てる。ルールごとに、**対象グループフィールド**・条件(日時・ラジオボタン・
  ドロップダウン・チェックボックス・プロセス管理ステータスを組み合わせたAND/OR結合の複数条件、
  または「常に」)・動作(開く/閉じる)を持つ。
- 同じ対象グループフィールドに複数のルールを設定できる。ある対象グループフィールドについては、
  そのフィールドを対象とするルールを設定順に評価し、最初に一致したルールの動作を適用する
  (`sidebar_toggle`と同じ優先順位方式、対象グループフィールドが異なるルール同士は互いに独立)。
- 「常に」を選んだルールは条件を持たず常に一致する。同じ対象グループフィールドの他のどの条件にも
  一致しない場合の既定動作を設定する用途に使う想定。

## 使用するJavaScript API(kintone公式ドキュメントを直接確認済み)

`kintone_doc` MCPが本セッションでは未認証のため使用できなかった。代わりに、ユーザーから提示された
ドキュメントURLを含め、cybozu developer networkの該当ページをWebFetchで直接取得し、2回照合して
以下の仕様を確認した(推測実装ではない)。

- **`kintone.app.record.setGroupFieldOpen(fieldCode, isOpen)`**(PC、
  <https://cybozu.dev/ja/kintone/docs/js-api/record/open-field-group/>)
  - 引数: `fieldCode`(文字列・対象グループのフィールドコード)、`isOpen`(真偽値・`true`で展開、
    `false`で折畳み)
  - 戻り値: なし(同期API)
  - 対応画面: レコード詳細・追加・編集・**印刷**画面(PC)
- **`kintone.mobile.app.record.setGroupFieldOpen(fieldCode, isOpen)`**(モバイル、同ページ)
  - 対応画面: レコード詳細・追加・編集画面(モバイル、印刷画面は対象外)
- 開閉状態を取得する`isGroupFieldOpen(fieldCode)`も存在するが、本プラグインは常に一方的に開閉状態を
  設定するだけで現在の状態を読み取る必要がないため使用しない。

`sidebar_toggle`と異なり、このAPIは**PC・モバイル両対応**のため、本プラグインはモバイル用の
グルーコード(`js/mobile.js`)も用意する。印刷画面はPC専用の追加対応(`app.record.print.show`)。

## ルールの条件(sidebar_toggleと共通、確定)

`sidebar_toggle`の`js/lib/condition-engine.js`をそのまま流用する(フィールド種別ごとの演算子・
値の比較方法は同一)。

| フィールド種別 | 演算子 | 値の入力方式 |
| :-- | :-- | :-- |
| 日時(DATETIME)・日付(DATE)・時刻(TIME) | `GT`/`GTE`/`LT`/`LTE`/`EQ`/`NEQ`/`IS_EMPTY`/`IS_NOT_EMPTY` | 日時入力欄 |
| ラジオボタン(RADIO_BUTTON)・ドロップダウン(DROP_DOWN) | `EQ`/`NEQ`/`IS_EMPTY`/`IS_NOT_EMPTY` | `<select>`(選択肢から選択) |
| チェックボックス(CHECK_BOX) | `CONTAINS`/`NOT_CONTAINS`/`IS_EMPTY`/`IS_NOT_EMPTY` | `<select>`(選択肢から1つ選択) |
| プロセス管理ステータス(STATUS) | `EQ`/`NEQ`/`IS_EMPTY`/`IS_NOT_EMPTY` | `<select>`(ステータス名一覧) |

条件の対象フィールドと、ルールが開閉を制御する対象グループフィールドは別概念である(例:
「ステータスが完了のとき、"詳細情報"グループを閉じる」という設定で、条件フィールドはステータス、
制御対象はグループフィールド"詳細情報")。

## 対象グループフィールド(ルールごとに1つ選択、確定)

`kintone.app.getFormFields()`で`type === 'GROUP'`のフィールドを列挙し、ルールごとに1つ選択する。
グループフィールドが1つも無いアプリでは設定画面にその旨を表示し、ルール追加を促さない。

## ルールの動作(ルールごとに1つ選択)

- `OPEN` — 対象グループフィールドを開く(展開)
- `CLOSED` — 対象グループフィールドを閉じる(折畳み)

## 発動する画面・タイミング(確定)

- PC: `app.record.detail.show` / `app.record.create.show` / `app.record.edit.show` /
  `app.record.print.show`
- モバイル: `mobile.app.record.detail.show` / `mobile.app.record.create.show` /
  `mobile.app.record.edit.show`(印刷画面はモバイルに存在しないため対象外)
- いずれの画面でも、設定済みの対象グループフィールドごとに、そのフィールドを対象とするルールを
  設定順に評価し、最初に一致したルールの動作を`setGroupFieldOpen()`に渡す。一致するルールが無い
  対象グループフィールドは何もしない(kintone既定の開閉状態のまま)。
- 追加・編集画面(PC・モバイル共通)では、条件に使われているフィールド(日時・ラジオボタン・
  ドロップダウン・チェックボックス)の値変更イベント(`app.record.create.change.*` /
  `app.record.edit.change.*`、モバイルは`mobile.app.record.create.change.*` /
  `mobile.app.record.edit.change.*`)でも再評価する。プロセス管理ステータスは
  `sidebar_toggle`と同じ理由で変更時の再評価対象に含めない。
- 印刷画面(`app.record.print.show`)には対応する`change`イベントが無いため、表示時の一度きりの
  適用のみ。

## 設定画面

`kintone.plugin.app.setConfig()`にのみ保存する。

- ルールを追加・削除・並び替えできる。ルールごとに:
  - 対象グループフィールド(`kintone.app.getFormFields()`のGROUP型フィールドから選択)
  - 条件モード(常に/条件を満たすとき)
  - 条件を満たすときのみ: 条件の結合方法(AND/OR)、条件(フィールド種別・フィールド・演算子・値を
    複数追加・削除できる)
  - 動作(開く/閉じる)
- 保存時に`js/lib/config-validation.js`でチェックする(対象グループフィールド未選択、条件モード不正、
  条件0件、フィールド未選択、演算子不正、値未入力、動作の指定不正)。

## TDD

`src/js/lib/`配下の純粋ロジックはJestでユニットテストする(`pnpm test`)。

- `condition-engine.js` — `sidebar_toggle`と同一(コピー)
- `rule-matcher.js` — レコード+ルールの配列+対象グループフィールドコードから、その対象フィールドを
  持つルールに絞り込んだうえで、設定順で最初に一致したルールを返す(`sidebar_toggle`との違いは
  対象フィールドによる絞り込みが増える点)
- `group-field-action.js` — 一致したルール(またはルール無し)から`setGroupFieldOpen()`に渡す
  `isOpen`(真偽値)を組み立てる(`sidebar_toggle`の`sidebar-action.js`に相当)
- `config-store.js` — `kintone.plugin.app.getConfig()`/`setConfig()`のペイロードの読み書きと
  デフォルト値
- `config-validation.js` — 設定(ルールの配列)のバリデーション(対象グループフィールド必須の分が
  `sidebar_toggle`との差分)

kintone依存のグルーコード(`desktop.js`/`mobile.js`/`config.js`、`kintone.app.record.setGroupFieldOpen()`
呼び出しを含む)は`src/e2e/*.e2e.test.js`(Puppeteer、`pnpm run test:e2e`)で実環境テストする。

## 実装

`kintone_doc` MCPが未認証のため使用できず、代わりにユーザー提示のURLを含むcybozu developer network
の該当ページをWebFetchで直接取得し2回照合のうえ実装した(上記「使用するJavaScript API」参照)。
セキュアコーディングガイドラインでのリスクチェックは`security-checklist.md`を参照。
