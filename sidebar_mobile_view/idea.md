# サイドパネルモバイル表示プラグイン

[sidebar_toggle](../sidebar_toggle/idea.md)(サイドバー(コメント欄・変更履歴)の表示状態を自動制御するプラグイン)の応用。
「サイドパネルの表示先」自体を、コメント・変更履歴に加えて「モバイル版レコード画面のiframe」から
選べるようにする。

## 機能

- レコード詳細・編集画面(PC専用、後述)の右側に、コメント・変更履歴と同じ役割の「サイドパネル」を
  表示する。パネルの中身は次の2種類のいずれか。
  - **コメント・変更履歴**(kintone標準のサイドバー、`kintone.app.record.showSideBar()`)
  - **モバイル版プレビュー**(自作パネル。同じレコードのモバイル版画面をiframeで表示する)
- 設定画面で、画面表示時にどちらを初期表示にするか選べる(「初期表示」)。
- レコード画面上部(パンくずとメニューの間、`kintone.app.record.getHeaderMenuSpaceElement()`)に
  切り替えボタンを設置し、閲覧中いつでも「コメント・変更履歴」⇔「モバイル版プレビュー」を
  切り替えられる。
- 自作パネル(モバイル版プレビュー)の幅を設定画面で指定できる(240〜900px)。
- モバイル版URLの組み立てに使うアプリID(通常は現在のアプリと同じ)を設定画面で指定できる。
  設定画面を開いた時点で未設定なら現在のアプリID(`kintone.app.getId()`)を自動的に補完する
  (ユーザー要望「設定画面で初期のアプリIDを指定する」への対応)。

## 対応画面(PC専用)

`kintone.app.record.showSideBar()`・`kintone.app.record.getHeaderMenuSpaceElement()`は
いずれもPC専用API(kintone公式ドキュメントで確認済み)。モバイル画面ではこの2つのAPIが
利用できないため、本プラグインは[sidebar_toggle](../sidebar_toggle/idea.md)と同様**PC専用**とし、
`js/mobile.js`は作成しない。

- 発動イベント: `app.record.detail.show` / `app.record.edit.show`
- `app.record.create.show`(新規作成画面)は対象外(レコードIDが存在せず、モバイル版URL・
  コメント欄・変更履歴のいずれも意味を持たないため)。

## 使用するJavaScript API(kintone公式ドキュメントをkintone_doc MCPで確認済み)

| API | 用途 | 利用できる画面 | 備考 |
| :-- | :-- | :-- | :-- |
| `kintone.app.record.showSideBar(state)` | コメント・変更履歴の開閉 | PC: 詳細・編集画面 | `'OPEN'/'CLOSED'/'COMMENTS'/'HISTORY'`。戻り値はPromise(値なし) |
| `kintone.app.record.getHeaderMenuSpaceElement()` | 切り替えボタンの設置場所 | PC: 詳細・追加・編集画面 | パンくずとメニューの間の要素を返す |
| `kintone.app.record.getId()` | モバイル版URLに使うレコードID | PC: 詳細・編集・印刷画面 | 戻り値は数値 |
| `kintone.app.getId()` | 対象アプリID(未指定時)・設定画面の初期値補完 | PC: 一覧・詳細・編集・追加・印刷・グラフ・プラグイン設定画面 | 戻り値は数値。プラグイン設定画面でも利用可能なことを確認済み |
| `kintone.plugin.app.getConfig()` / `setConfig()` | 設定の読み書き | プラグイン設定画面 | 標準パターン |

戻り値がREST APIのプロパティ名でラップされない、という既知の落とし穴(CLAUDE.md参照)が
該当するAPI(`getFormFields()`/`getFormLayout()`)は本プラグインでは使用していない。

## モバイル版URLの形式(実機で確認済み・推測実装ではない)

公式ドキュメントにモバイル版レコード詳細のURL形式の記載が無かったため、検証環境
(`lp950u96r3uk.cybozu.com`)にPuppeteerで実際にログインし、複数の候補URLへ直接アクセスして
挙動を確認した。

- **正しい形式**: `https://{domain}/k/m/{appId}/show?record={recordId}` (クエリ文字列)
  - ステータス200でモバイル版のレコード詳細が描画されることを確認済み。
- **誤った形式**: `https://{domain}/k/m/{appId}/show#record={recordId}`(PC版と同じハッシュ形式)
  - ステータス400、`CB_VA01`(「入力内容が正しくありません」)エラーになることを確認済み。
    PC版とモバイル版でルーティング方式(ハッシュ/クエリ文字列)が異なる点に注意。

`js/lib/mobile-url.js`の`build()`がこの形式を組み立てる(純粋関数、`__tests__/mobile-url.test.js`
でテスト済み)。`origin`は`location.origin`(実行中のkintoneサイトそのもの)を使うため、
ドメインを設定項目として持つ必要はない。

## iframe埋め込み時のX-Frame-Options(実機で確認済み)

モバイル版画面のレスポンスヘッダーは`X-Frame-Options: SAMEORIGIN`。kintoneの通常画面
(`https://{domain}/k/{appId}/...`)から同じ`{domain}`のモバイル版URLをiframeで埋め込む場合は
同一オリジンのため許可される。実際にPuppeteerで検証環境のレコード詳細画面上に
`<iframe src="https://{domain}/k/m/{appId}/show?record={recordId}">`を生成し、
`iframe.contentDocument`からモバイル版の内容(フィールド値を含む本文)を取得できることを
確認済み。

このURLは`location.origin`(実行中のkintoneサイト自身)と、数値であることを検証済みの
アプリID・レコードIDのみから組み立てており、外部入力やレコードの値をURLに含めないため、
box_gdrive_iframeのような埋め込み先ホストの許可リストは不要と判断した(security-checklist.md参照)。

## カスタムサイドパネルの実装方式(kintoneに公式APIが無いための設計判断)

kintoneには「サイドバー領域へ任意のHTML/iframeを差し込む」公式APIが存在しない
(`kintone.app.record.showSideBar()`は`OPEN`/`CLOSED`/`COMMENTS`/`HISTORY`の4状態を
切り替えるのみ)。そのため、モバイル版プレビュー表示時は次の方式で実現する。

1. モバイル版プレビュー表示時: `kintone.app.record.showSideBar('CLOSED')`でネイティブの
   サイドバーを閉じ、画面右端に`position: fixed`の自作パネル(`div#smv-panel`、幅は設定値)を
   重ねて表示する。ネイティブ側を閉じることで、実質的に同じ「右端の領域」を明け渡す形になる。
2. コメント・変更履歴表示時: 自作パネルを`hidden`にし、`kintone.app.record.showSideBar()`で
   設定済みのタブ(`COMMENTS`/`HISTORY`)を開く。
3. パネルの縦方向の開始位置(`top`)は、HTML5セマンティックな`<header>`要素の
   `getBoundingClientRect().bottom`を初期表示時に一度だけ測定して使う。実機確認では
   `<header>`要素はkintoneの構成上`position: fixed`の祖先要素の中にあり、スクロール時に
   隠れる(要素自体のバウンディングボックスが変化する)ことを確認した。この「スクロール時に
   ヘッダーが隠れた場合の追従」は本プラグインでは行わない簡略仕様とする(パネル自体は
   `position: fixed`で画面に留まり続けるため、実害はヘッダー分の隙間が一瞬空く程度)。
   kintone内部のクラス名(`sc-xxxx`のようなstyled-componentsのハッシュ値)には依存せず、
   HTML5標準の`<header>`タグのみに依存する設計とし、内部実装変更への耐性を高めている。
4. 上記の理由により、自作パネルは「ネイティブのサイドバーの中身を差し替える」のではなく
   「ネイティブを閉じて別の要素を重ねる」方式である点に注意(判断記録として本節に明記)。

## 設定画面

`kintone.plugin.app.setConfig()`にのみ保存する。

- 初期表示: `NATIVE`(コメント・変更履歴) / `IFRAME`(モバイル版)
- 「コメント・変更履歴」選択時に開くタブ: `COMMENTS` / `HISTORY`
- パネルの幅(px): 240〜900の範囲(`js/lib/config-validation.js`でチェック)
- 対象アプリID: 空文字を許可(実行時に`kintone.app.getId()`へフォールバック)。設定画面を開いた
  時点で未設定なら現在のアプリIDを自動入力する。保存時は正の整数文字列であることのみ検証する
  (存在しないアプリIDが指定された場合はモバイル版側が独自にエラー画面を表示するため、
  プラグイン側での存在確認は行わない)。

## TDD

`src/js/lib/`配下の純粋ロジックをJestでユニットテストする(`pnpm test`、33件)。

- `config-store.js` — `kintone.plugin.app.getConfig()`/`setConfig()`のペイロードの読み書きと
  デフォルト値
- `config-validation.js` — 設定の妥当性検証(初期表示・タブ種別・パネル幅の範囲・対象アプリIDの形式)
- `mobile-url.js` — origin・アプリID・レコードIDからモバイル版URLを組み立てる純粋関数
  (不正なアプリID/レコードIDでは`null`を返す)
- `panel-state.js` — 表示モード(`NATIVE`/`IFRAME`)の初期値解決・トグル・ネイティブ側の
  タブ解決・ボタンラベル解決

kintone依存のグルーコード(`desktop.js`/`config.js`、DOM操作・`showSideBar()`呼び出しを含む)は
`src/e2e/*.e2e.test.js`(Puppeteer、`pnpm run test:e2e`)で実環境テストする。

## エッジケース・既知の制約

- レコードにコメント機能が無効化されている場合: `showSideBar('OPEN'/'COMMENTS')`は
  kintone公式仕様により何も起こらない(サイドバーが開かない)。本プラグインはこの挙動を
  そのまま利用し、特別なハンドリングは行わない。
- 対象アプリIDに存在しない値・アクセス権のないアプリIDが指定された場合: モバイル版URLへの
  アクセス自体はkintone側のエラー画面(認証・権限エラー)がiframe内に表示されるのみで、
  プラグインやレコードデータには影響しない。
- スクロールでヘッダーが隠れた場合のパネル位置追従は行わない(上記「実装方式」4点目参照)。
- 画面の横幅が狭い場合(小さいウィンドウ等)でも、パネル幅は設定値のまま固定(レスポンシブな
  自動縮小は行わない)。極端に幅が狭い環境では管理者側でパネル幅設定を調整することを想定する。
