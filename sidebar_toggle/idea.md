# サイドバー（コメント欄・履歴）開閉プラグイン

## 機能

レコード詳細・編集画面のサイドバー(コメント欄・変更履歴)の表示状態を、レコードの値の条件によって
自動的に切り替えるプラグイン(元メモ「レコードの状態によってレコード詳細画面のコメント欄を最小化する」)。

- ルールを複数持てる。ルールごとに、条件(日時・ラジオボタン・ドロップダウン・チェックボックス・
  プロセス管理ステータスを組み合わせたAND/OR結合の複数条件、または「常に」)と、サイドバーの
  動作(閉じる/コメントを開く/履歴を開く)を持つ。
- ルールは設定順に評価し、最初に一致したルールの動作を適用する(`list_highlight`の一覧強調ルールと
  同じ優先順位方式、[[判断記録]]参照)。
- 「常に」を選んだルールは条件を持たず常に一致する。主に「他のどの条件にも一致しない場合の既定動作」
  を設定するための、優先順位最後の待受ルールとして使う想定(元メモ「常にという選択肢もあり」)。

## 使用するJavaScript API(kintone公式ドキュメントを直接確認済み)

`kintone_doc` MCPが本セッションでは未認証のため使用できなかった。代わりに、ユーザーから提示された
ドキュメントURLを含め、cybozu developer networkの該当ページをWebFetchで直接取得し、原文に近い形で
2回照合して以下の仕様を確認した(推測実装ではない)。

- **`kintone.app.record.showSideBar(state)`**(<https://cybozu.dev/ja/kintone/docs/js-api/record/show-or-hide-side-bar/>)
  - 引数`state`: `'OPEN'`(開く) / `'CLOSED'`(閉じる) / `'COMMENTS'`(コメント欄を表示) /
    `'HISTORY'`(変更履歴を表示)の4種類の文字列
  - 戻り値: Promise(解決時に値なし)
  - 対応画面: レコード詳細画面・レコード編集画面。**PC専用**(モバイル非対応)。
  - `'OPEN'`指定時、コメント・履歴の両タブが利用可能な場合はコメント欄が既定で開く。コメント機能が
    アプリ設定で無効な場合は履歴が開く。

モバイル非対応のAPIであるため、本プラグインは**PC専用**とする([[判断記録]]参照)。

## ルールの条件(確定)

`list_highlight`の`condition-engine.js`(AND/OR結合・複数条件)を土台に、対象フィールド種別ごとに
演算子と値の入力方式を変えた拡張版を実装する(`js/lib/condition-engine.js`)。

| フィールド種別 | 演算子 | 値の入力方式 | 備考 |
| :-- | :-- | :-- | :-- |
| 日時(DATETIME)・日付(DATE)・時刻(TIME) | `GT`/`GTE`/`LT`/`LTE`/`EQ`/`NEQ`/`IS_EMPTY`/`IS_NOT_EMPTY` | 日時入力欄(`<input type="datetime-local">`等、種別に応じて切替) | `Date.parse()`で比較する。管理者が設定した固定の日時としきい値比較する([[判断記録]]参照、「現在時刻」との比較ではない) |
| ラジオボタン(RADIO_BUTTON)・ドロップダウン(DROP_DOWN) | `EQ`/`NEQ`/`IS_EMPTY`/`IS_NOT_EMPTY` | `<select>`(`kintone.app.getFormFields()`の`options`から選択肢を列挙) | |
| チェックボックス(CHECK_BOX) | `CONTAINS`/`NOT_CONTAINS`/`IS_EMPTY`/`IS_NOT_EMPTY` | `<select>`(選択肢一覧から1つ選択、値の配列に含まれるかを判定) | 値は配列なので`Array.includes()`で判定 |
| プロセス管理ステータス(STATUS) | `EQ`/`NEQ`/`IS_EMPTY`/`IS_NOT_EMPTY` | `<select>`(ステータス名一覧) | `status_arrow`と同じくフィールドコードではなく固定名`record['ステータス']`でアクセスする(フィールド形式の仕様、[[判断記録]]参照)。ステータス名一覧はプラグイン設定画面で`kintone.app.getStatus()`が使えないため、`status_arrow`と同様`kintone.api()`経由の`GET /k/v1/app/status.json`で取得する |

## サイドバーの動作(ルールごとに1つ選択)

- `CLOSED` — サイドバーを閉じる(元メモの「最小化」に対応)
- `OPEN_COMMENTS` — サイドバーを開き、コメント欄を表示(`showSideBar('OPEN')`または`'COMMENTS'`)
- `OPEN_HISTORY` — サイドバーを開き、変更履歴を表示(`showSideBar('HISTORY')`)

## 発動する画面・タイミング(確定)

- `app.record.detail.show` / `app.record.edit.show`(いずれもPC専用イベント)で、設定済みルールを
  設定順に評価し、最初に一致したルールの動作を`kintone.app.record.showSideBar()`に渡す。一致する
  ルールが無い場合は何もしない(kintone既定の表示のまま)。
- 編集画面では、条件に使われているフィールド(日時・ラジオボタン・ドロップダウン・チェックボックス)の
  `app.record.edit.change.<fieldCode>`イベントでも再評価する。プロセス管理ステータスは編集画面中に
  値が変わることがない(ステータス変更はプロセスの実行操作によって画面遷移を伴う)ため、変更時の
  再評価対象に含めない。

## 設定画面

`kintone.plugin.app.setConfig()`にのみ保存する。

- ルールを追加・削除・並び替えできる。ルールごとに:
  - 条件モード(常に/条件を満たすとき)
  - 条件を満たすときのみ: 条件の結合方法(AND/OR)、条件(フィールド種別・フィールド・演算子・値を
    複数追加・削除できる)
  - サイドバーの動作(閉じる/コメントを開く/履歴を開く)
- 保存時に`js/lib/config-validation.js`でチェックする(条件モード不正、条件0件、フィールド未選択、
  演算子不正、日時値の形式不正等)。

## TDD

`src/js/lib/`配下の純粋ロジックはJestでユニットテストする(`pnpm test`)。

- `condition-engine.js` — レコード+条件(フィールド種別ごとの演算子・AND/OR結合)から、条件を満たすか
  どうかを判定する。日時系はDate.parseで比較、プロセス管理ステータスは固定名`ステータス`で読む
- `rule-matcher.js` — レコード+ルールの配列(常に/条件付き混在)から、設定順で最初に一致したルールを
  返す
- `sidebar-action.js` — 一致したルール(またはルール無し)から`kintone.app.record.showSideBar()`に
  渡す`state`引数を組み立てる(`CLOSED`/`OPEN`/`COMMENTS`/`HISTORY`のどれを渡すか)
- `config-store.js` — `kintone.plugin.app.getConfig()`/`setConfig()`のペイロードの読み書きと
  デフォルト値
- `config-validation.js` — 設定(ルールの配列)のバリデーション

kintone依存のグルーコード(`desktop.js`/`config.js`、`kintone.app.record.showSideBar()`呼び出しを含む)は
`src/e2e/*.e2e.test.js`(Puppeteer、`pnpm run test:e2e`)で実環境テストする。PC専用のためモバイル用
グルーコード(`mobile.js`)は作成しない。

## 実装

`kintone_doc` MCPが未認証のため使用できず、代わりにユーザー提示のURLを含むcybozu developer network
の該当ページをWebFetchで直接取得し2回照合のうえ実装した(上記「使用するJavaScript API」参照)。
セキュアコーディングガイドラインでのリスクチェックは`security-checklist.md`を参照。
