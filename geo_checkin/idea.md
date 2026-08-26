# 位置情報強制登録プラグイン

## 機能

レコードの追加・更新を保存するタイミングで、端末のブラウザ位置情報(Geolocation API)を自動取得し、
設定画面で指定した2つの数値フィールド(緯度・経度)へ書き込む。出退勤の打刻や、現場作業の証跡
(「本当にその場所で操作したか」)を残す用途を想定している。緯度・経度フィールドは常に非表示に
なり、フォーム上からは直接見えない・触れない(一覧の列・CSVエクスポート・REST API経由では
参照できる)。

設定で「地図を表示する」を有効にすると、追加・編集・詳細画面のヘッダーメニュースペース
(パンくずリストの下)にGoogleマップをiframeで埋め込み、登録済みの緯度・経度にピンを立てる。

## 設定画面

- 緯度を保存するフィールド(数値フィールドのみ選択可)
- 経度を保存するフィールド(数値フィールドのみ選択可、緯度と同じフィールドは選択不可)
- 地図を表示する(チェックボックス)

保存前に`js/lib/config-validation.js`でチェックする(緯度・経度の未選択、数値フィールド以外の
選択、緯度と経度の重複選択)。

## 位置情報の取得(確定)

- `navigator.geolocation.getCurrentPosition()`(ブラウザ標準のGeolocation API、kintone固有ではない)
  を、`app.record.create.submit`/`app.record.edit.submit`(Promise対応)で保存直前に呼び出す。
  `enableHighAccuracy: true`・`maximumAge: 0`(キャッシュされた古い位置情報を使わず、常に
  その場で取得する。「保存の瞬間の証跡」という目的上、追加・編集どちらの保存でも都度フレッシュに
  取得し、既存の緯度・経度を保存の都度上書きする)。
- **取得に失敗してもレコードの登録・更新は継続する(`event.error`は設定しない)。** 緯度・経度は
  空のまま保存され、`alert()`で利用者にエラー内容を通知する(`js/lib/geo-error-message.js`が
  `GeolocationPositionError.code`に応じた日本語メッセージを組み立てる: 1=許可されなかった、
  2=取得不可、3=タイムアウト、その他=汎用メッセージ)。`alert()`は同期的にブロックするため、
  保存処理(kintoneへの実際の登録・更新)が先に進む前に必ず利用者に通知できる。
- 緯度・経度フィールドの値は`String(position.coords.latitude)`/`String(position.coords.longitude)`
  として書き込む(数値フィールドは文字列表現の数値を受け付ける、kintoneドキュメントMCP
  「数値フィールド」参照)。

## 表示・編集の制限(確定)

- **緯度・経度フィールドは、追加・編集・詳細のすべての画面で常に非表示にする**
  (`kintone.app.record.setFieldShown(fieldCode, false)`、`app.record.create.show`/
  `app.record.edit.show`/`app.record.detail.show`で毎回実行)。
- **編集画面・レコード一覧のインライン編集では、非表示に加えてdisabledにもする**
  (`record[fieldCode].disabled = true`、`app.record.edit.show`/`app.record.index.edit.show`)。
  非表示のフィールドは編集画面でも実質操作できないが、二重の防御として明示的にdisabled化もして
  いる。
- **これらはすべてJavaScript APIによる画面表示上の制限であり、REST API経由の更新やアクセス権に
  よる制御ではない。** 悪意のある利用者がREST APIで直接値を書き換えることを防ぐものではないため、
  位置情報を証跡として運用する場合は、**アプリの設定で「レコードの変更履歴(リビジョン)」を有効に
  することを設定画面上で案内している**(いつ・誰が値を書き換えたかを事後追跡できるようにする)。

## 地図表示(確定)

- 設定で「地図を表示する」が有効な場合、PCでは`kintone.app.record.getHeaderMenuSpaceElement()`
  (レコード詳細・追加・編集画面で利用可能)、モバイルでは`kintone.mobile.app.getHeaderSpaceElement()`
  (レコード一覧・詳細・追加・編集画面で利用可能)にiframeでGoogleマップを埋め込む(**PC・モバイル両対応**)。
- 埋め込みURLはAPIキー不要の公開埋め込み形式(`https://www.google.com/maps?q=<lat>,<lng>&z=17&output=embed`)
  を使う。`box_gdrive_iframe`と同じ「iframeでの外部サイト埋め込み」方針で、外部ライブラリ・
  fetch/XHRでの外部通信は行わない(CLAUDE.md開発方針9)。
- URLはフィールド値の生文字列を直接連結せず、`js/lib/map-embed-url.js`が`Number()`でパースし
  有限の数値・緯度(-90〜90)経度(-180〜180)の有効範囲であることを確認したうえで組み立てる
  (任意の文字列がURLに混入する余地を無くしている)。PC・モバイルとも同じ`js/lib/map-embed-url.js`
  を共有する。
- 緯度・経度が未登録(新規作成画面など)の場合はメッセージを表示し、iframeは埋め込まない。
- モバイルにはレコード一覧のインライン編集が存在しないため、`app.record.index.edit.show`相当の
  処理はPCのみ(`js/mobile.js`参照)。それ以外(常に非表示・編集画面でのdisabled化・保存時の
  位置情報取得・地図表示)はPC・モバイルで共通の挙動にしている。

## 実機での既知の挙動(確認済み)

- **kintoneのNUMBERフィールドは、`displayScale`(小数点以下の表示桁数)を未設定のままでも、
  内部的な精度丸めが発生する。** 検証環境で緯度`35.681236`を書き込んだところ、REST APIで
  読み出すと`35.6812`になっていた(小数第4位までに丸められる)。プラグインの実装自体は
  `String(position.coords.latitude)`をそのまま書き込んでおり、丸めはkintone側のNUMBER
  フィールドの仕様(推測ではなく実機で確認済み)。地図表示・E2Eテストの期待値は、この丸めを
  前提にした比較(実際に保存された値との突き合わせ、または誤差許容)にしている。
- `kintone.app.record.get()`で読み出せるフィールドオブジェクトに`disabled`プロパティは
  含まれない(`disabled`はイベントオブジェクトに対する「書き込み専用の指示」であり、読み出し用の
  状態ではない。kintoneドキュメントMCPの「イベントオブジェクトで実行できる操作」にも
  読み出しAPIの記載はない、実機で確認済み)。そのためE2Eテストでは`disabled`化の読み戻し検証は
  行わず、非表示化(`isFieldVisible()`)のみを検証している。

## TDD

`src/js/lib/`配下の純粋ロジックはJestでユニットテストする(`pnpm test`)。

- `config-store.js` — `kintone.plugin.app.getConfig()`/`setConfig()`のペイロードの読み書きと
  デフォルト値
- `config-validation.js` — 設定(緯度・経度フィールド・地図表示)のバリデーション
- `geo-error-message.js` — `GeolocationPositionError`(またはGeolocation非対応時の`Error`)から
  利用者向け日本語メッセージを組み立てる
- `map-embed-url.js` — 緯度・経度からGoogleマップの埋め込みURLを組み立てる(範囲外・非数値は
  `null`を返す)

kintone依存のグルーコード(`desktop.js`/`mobile.js`/`config.js`)は`src/e2e/*.e2e.test.js`
(Puppeteer、`pnpm run test:e2e`)で実環境テストする。`e2e/config-screen.e2e.test.js`(設定画面)・
`e2e/record-behavior.e2e.test.js`(PC)・`e2e/mobile-record-behavior.e2e.test.js`(モバイル)の3本で、
非表示化・保存時の位置情報反映・地図表示・取得失敗時の継続をPC/モバイル両方で検証している。
Geolocationは実機のGPSに依存させず、Puppeteerのブラウザコンテキスト権限(`overridePermissions`)と
`page.setGeolocation()`で決定的な座標を返すようにしている。「取得失敗」ケースは
`overridePermissions(origin, [])`(geolocationを含まない許可リストを明示的に設定し、即座に
PERMISSION_DENIEDとして確定させる)で再現する(`clearPermissionOverrides()`で「未設定」に
戻すだけだと、ヘッドレスChromeでは確定せず待機し続けることがあった、実機で確認済み)。

モバイル画面のURLは`/k/m/{appId}/edit`(新規作成)・`/k/m/{appId}/show?record={id}`(詳細)で、
PCと異なりSPA内部状態の問題が発生しないため`page.goto()`で直接遷移してよい(field_encryptionの
モバイルE2Eテストと同じ知見)。新規作成の保存完了は、PCの「`mode=edit`が外れるまで待つ」判定
(新規作成のURLはもともと`mode=edit`を含まないため常に真になってしまい無意味)ではなく、
`location.href.includes('/show')`で判定する。

## 実装

kintoneドキュメントMCPを参照しながら実装した。`kintone.app.record.getHeaderMenuSpaceElement()`
(PC専用)・`kintone.app.record.setFieldShown()`・`kintone.app.record.isFieldVisible()`
(非同期API)・`app.record.index.edit.show`イベント・イベントオブジェクトの`disabled`
プロパティによる編集可否制御は、いずれもドキュメントで戻り値の形・利用可能画面・Promise対応を
確認したうえで実装した(CLAUDE.md開発方針1参照)。セキュアコーディングガイドラインでの
リスクチェックは`security-checklist.md`を参照。
