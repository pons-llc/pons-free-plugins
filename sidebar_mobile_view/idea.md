# サイドパネルモバイル表示プラグイン

[sidebar_toggle](../sidebar_toggle/idea.md)(サイドバー(コメント欄・変更履歴)の表示状態を自動制御するプラグイン)の応用。
「サイドパネルの表示先」自体を、コメント・変更履歴に加えて「モバイル版レコード画面(または
別アプリのモバイル版レコード一覧)のiframe」から選べるようにする。

## 機能

- レコード詳細・編集・新規作成画面(PC専用、後述)の右側に、コメント・変更履歴と同じ役割の
  「サイドパネル」を表示する。パネルの中身は次の2種類のいずれか。
  - **コメント・変更履歴**(kintone標準のサイドバー、`kintone.app.record.showSideBar()`。
    新規作成画面には存在しないため選択肢自体が意味を持たない、後述)
  - **モバイル版プレビュー**(自作パネル。iframeで次のいずれかを表示する)
    - 対象アプリが現在のアプリと同じ、かつレコードIDがある場合(詳細・編集画面): そのレコードの
      モバイル版詳細画面
    - それ以外(対象アプリが別アプリの場合、または新規作成画面でレコードIDがまだ無い場合):
      対象アプリのモバイル版レコード一覧
- 設定画面で、画面表示時にどちらを初期表示にするか選べる(「初期表示」)。
- レコード画面上部(パンくずとメニューの間、`kintone.app.record.getHeaderMenuSpaceElement()`)に
  切り替えボタンを設置し、閲覧中いつでも切り替えられる。
- 自作パネル(モバイル版プレビュー)の幅を設定画面で指定できる(240〜900px)。
- モバイル版URLの組み立てに使う対象アプリIDを設定画面で指定できる。設定画面を開いた時点で
  未設定なら現在のアプリID(`kintone.app.getId()`)を自動的に補完する(ユーザー要望「設定画面で
  初期のアプリIDを指定する」への対応)。**現在のアプリと異なるIDに変更すると、そのアプリの
  モバイル版レコード一覧を表示できる**(「顧客マスタを見ながら案件管理を更新する」のように、
  関連する別アプリを見ながら現在のアプリを操作したい用途に対応。ユーザー要望
  「別のアプリを見ながら、操作したいこともある」への対応。パネル内のiframeは実際に動作する
  kintoneのモバイル画面そのものなので、閲覧だけでなく別アプリ側のレコード編集等の操作も可能)。

## 対応画面(PC専用)

`kintone.app.record.showSideBar()`・`kintone.app.record.getHeaderMenuSpaceElement()`は
いずれもPC専用API(kintone公式ドキュメントで確認済み)。モバイル画面ではこの2つのAPIが
利用できないため、本プラグインは[sidebar_toggle](../sidebar_toggle/idea.md)と同様**PC専用**とし、
`js/mobile.js`は作成しない。

- 発動イベント: `app.record.detail.show` / `app.record.edit.show` / `app.record.create.show`
- 新規作成画面(`app.record.create.show`)は、`getHeaderMenuSpaceElement()`は利用できる
  (公式ドキュメントの「利用できる画面」にレコード追加画面が含まれる)が、
  `showSideBar()`・`getSideBarDisplayState()`・`kintone.app.record.getId()`は利用できない
  (これら3つのドキュメントには詳細・編集・印刷画面のみが記載され、追加画面が含まれない)。
  そのため新規作成画面では、これら3つのAPIを一切呼び出さず、モバイル版プレビューの表示/非表示
  切り替えのみを提供する(「コメント・変更履歴」という選択肢自体が新規作成画面には存在しない)。
  `kintone.events.on()`にイベント名の配列を渡した場合、ハンドラーの引数`event`の`type`プロパティ
  に実際に発火したイベント名が入る(本リポジトリの`research_and_answer`/`geo_checkin`等でも
  使われている確立されたパターン)ため、これで新規作成画面かどうかを判定する
  (`desktop.js`の`currentHasNativeSideBar`参照)。

## 使用するJavaScript API(kintone公式ドキュメントをkintone_doc MCPで確認済み)

| API | 用途 | 利用できる画面 | 備考 |
| :-- | :-- | :-- | :-- |
| `kintone.app.record.showSideBar(state)` | コメント・変更履歴の開閉 | PC: 詳細・編集画面 | `'OPEN'/'CLOSED'/'COMMENTS'/'HISTORY'`。戻り値はPromise(値なし)。新規作成画面では呼び出さない |
| `kintone.app.record.getHeaderMenuSpaceElement()` | 切り替えボタンの設置場所 | PC: 詳細・追加・編集画面 | パンくずとメニューの間の要素を返す |
| `kintone.app.record.getId()` | モバイル版URLに使うレコードID | PC: 詳細・編集・印刷画面 | 戻り値は数値。新規作成画面では呼び出さない(未保存のレコードにはIDが存在しない) |
| `kintone.app.getId()` | 現在のアプリID(対象アプリID未指定時のフォールバック・設定画面の初期値補完・別アプリ判定) | PC: 一覧・詳細・編集・追加・印刷・グラフ・プラグイン設定画面 | 戻り値は数値。新規作成画面・プラグイン設定画面でも利用可能なことを確認済み |
| `kintone.plugin.app.getConfig()` / `setConfig()` | 設定の読み書き | プラグイン設定画面 | 標準パターン |

戻り値がREST APIのプロパティ名でラップされない、という既知の落とし穴(CLAUDE.md参照)が
該当するAPI(`getFormFields()`/`getFormLayout()`)は本プラグインでは使用していない。

## モバイル版URLの形式(実機で確認済み・推測実装ではない)

公式ドキュメントにモバイル版URLの形式の記載が無かったため、検証環境
(`lp950u96r3uk.cybozu.com`)にPuppeteerで実際にログインし、複数の候補URLへ直接アクセスして
挙動を確認した。

- **レコード詳細**: `https://{domain}/k/m/{appId}/show?record={recordId}` (クエリ文字列)
  - ステータス200でモバイル版のレコード詳細が描画されることを確認済み。
  - 誤った形式`https://{domain}/k/m/{appId}/show#record={recordId}`(PC版と同じハッシュ形式)は
    ステータス400、`CB_VA01`(「入力内容が正しくありません」)エラーになることを確認済み。
    PC版とモバイル版でルーティング方式(ハッシュ/クエリ文字列)が異なる点に注意。
- **レコード一覧**: `https://{domain}/k/m/{appId}/`(PC版一覧`https://{domain}/k/{appId}/`の
  モバイル版)。ステータス200で一覧(レコード番号ごとの行)が描画されることを実機で確認済み。
  別アプリの一覧をiframe埋め込みした状態でも(現在のアプリの詳細・編集・新規作成画面から)
  正しく描画されることを確認済み。

`js/lib/mobile-url.js`が組み立てを担当する。

- `buildRecordUrl({origin, appId, recordId})` — レコード詳細URLを組み立てる純粋関数
- `buildListUrl({origin, appId})` — レコード一覧URLを組み立てる純粋関数
- `resolve({origin, currentAppId, targetAppId, recordId})` — 対象アプリIDが現在のアプリと
  同じ(または未指定)かつレコードIDがある場合は`buildRecordUrl()`、それ以外(対象アプリが
  別アプリ、またはレコードIDが無い新規作成画面)は`buildListUrl()`を使う、という切り替えロジック
  (`__tests__/mobile-url.test.js`でテスト済み)

`origin`は`location.origin`(実行中のkintoneサイトそのもの)を使うため、ドメインを設定項目
として持つ必要はない。

## iframe埋め込み時のX-Frame-Options(実機で確認済み)

モバイル版画面(詳細・一覧いずれも)のレスポンスヘッダーは`X-Frame-Options: SAMEORIGIN`。
kintoneの通常画面(`https://{domain}/k/{appId}/...`)から同じ`{domain}`のモバイル版URLを
iframeで埋め込む場合は同一オリジンのため許可される(対象アプリが別アプリでも、同じkintone
サイト〈同一ドメイン〉である限り同一オリジン判定になるため問題ない)。実際にPuppeteerで
検証環境のレコード詳細・編集画面上に`<iframe src="https://{domain}/k/m/{appId}/...">`を生成し、
`iframe.contentDocument`から内容を取得できることを確認済み。

このURLは`location.origin`(実行中のkintoneサイト自身)と、数値であることを検証済みの
アプリID・レコードIDのみから組み立てており、外部入力やレコードの値をURLに含めないため、
box_gdrive_iframeのような埋め込み先ホストの許可リストは不要と判断した(security-checklist.md参照)。
対象アプリIDは設定画面でアプリ管理者自身が入力する値であり、外部入力ではない。

## カスタムサイドパネルの実装方式(kintoneに公式APIが無いための設計判断)

kintoneには「サイドバー領域へ任意のHTML/iframeを差し込む」公式APIが存在しない
(`kintone.app.record.showSideBar()`は`OPEN`/`CLOSED`/`COMMENTS`/`HISTORY`の4状態を
切り替えるのみ)。そのため、モバイル版プレビュー表示時は次の方式で実現する。

1. モバイル版プレビュー表示時: レコード詳細・編集画面では`kintone.app.record.showSideBar('CLOSED')`
   でネイティブのサイドバーを閉じ、画面右端に`position: fixed`の自作パネル(`div#smv-panel`、
   幅は設定値)を重ねて表示する。ネイティブ側を閉じることで、実質的に同じ「右端の領域」を
   明け渡す形になる。新規作成画面にはそもそもネイティブのサイドバーが無いため、この呼び出し
   自体を行わない。
2. コメント・変更履歴表示時(詳細・編集画面のみ): 自作パネルを`hidden`にし、
   `kintone.app.record.showSideBar()`で設定済みのタブ(`COMMENTS`/`HISTORY`)を開く。
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
5. 新規作成画面での切り替えボタンは、コメント・変更履歴という選択肢が無いため単純な
   表示/非表示のトグルとして機能する(`js/lib/panel-state.js`の`resolveToggleButtonLabel()`の
   `hasNativeSideBar`引数で分岐)。

## 設定画面

`kintone.plugin.app.setConfig()`にのみ保存する。

- 初期表示: `NATIVE`(コメント・変更履歴) / `IFRAME`(モバイル版)
- 「コメント・変更履歴」選択時に開くタブ: `COMMENTS` / `HISTORY`(新規作成画面では使われない)
- パネルの幅(px): 240〜900の範囲(`js/lib/config-validation.js`でチェック)
- 対象アプリID: 空文字を許可(実行時に`kintone.app.getId()`へフォールバック)。設定画面を開いた
  時点で未設定なら現在のアプリIDを自動入力する。保存時は正の整数文字列であることのみ検証する
  (存在しないアプリIDが指定された場合はモバイル版側が独自にエラー画面を表示するため、
  プラグイン側での存在確認は行わない)。現在のアプリと異なるIDを指定した場合の挙動は
  「モバイル版URLの形式」節の`resolve()`を参照。

## TDD

`src/js/lib/`配下の純粋ロジックをJestでユニットテストする(`pnpm test`、43件)。

- `config-store.js` — `kintone.plugin.app.getConfig()`/`setConfig()`のペイロードの読み書きと
  デフォルト値
- `config-validation.js` — 設定の妥当性検証(初期表示・タブ種別・パネル幅の範囲・対象アプリIDの形式)
- `mobile-url.js` — `buildRecordUrl()`/`buildListUrl()`/`resolve()`(対象アプリ・レコードIDの
  有無からレコード詳細/一覧のどちらのURLを使うか決める)
- `panel-state.js` — 表示モード(`NATIVE`/`IFRAME`)の初期値解決・トグル・ネイティブ側の
  タブ解決・ボタンラベル解決(`hasNativeSideBar`引数で新規作成画面向けラベルに分岐)

kintone依存のグルーコード(`desktop.js`/`config.js`、DOM操作・`showSideBar()`呼び出しを含む)は
`src/e2e/*.e2e.test.js`(Puppeteer、`pnpm run test:e2e`)で実環境テストする(詳細画面での切り替え・
新規作成画面での切り替え・対象アプリIDを別アプリに変更した場合の一覧表示、の3パターンを検証済み)。

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
- 対象アプリIDを別アプリに変更した場合、現在のレコードとは連動しない一覧表示になる
  (対象アプリのどのレコードが「対応する」レコードかを機械的に判定する手段が無いため、
  意図的に一覧表示に倒している)。特定の1レコードを常に表示したい場合の設定項目は用意していない
  (個別確認事項として後述)。

## 個別確認事項(利用ユーザーへ委ねる項目)

- 対象アプリを別アプリに変更した場合、常に一覧表示になり特定のレコードを指定できない点の
  仕様変更要否(ユーザーへのヒアリングで「一覧表示でよい」との回答を得て採用した設計)。
