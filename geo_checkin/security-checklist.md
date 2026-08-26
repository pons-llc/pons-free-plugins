# geo_checkin(位置情報強制登録プラグイン) セキュリティチェックリスト

[secureCodingGuideline.md](../secureCodingGuideline.md)の一般項目([box_gdrive_iframe/security-checklist.md](../box_gdrive_iframe/security-checklist.md)参照、UTF-8/BOMなし・名前空間分離・`'use strict'`・外部スクリプト不使用などは同様に満たしている)は重複記載を省略し、本プラグイン固有の項目のみ記載する。

最終確認日: 2026-08-26(モバイル対応の追加を反映)

## コーディング作法

- [x] 文字コードはUTF-8(BOMなし)
- [x] グローバル変数を作らず、即時関数(IIFE)+名前空間オブジェクト(`window.GeoCheckin`)のみを公開している(`js/lib/config-store.js`, `js/lib/config-validation.js`, `js/lib/geo-error-message.js`, `js/lib/map-embed-url.js`)
- [x] 既存のkintoneグローバルオブジェクトを書き換え・参照していない
- [x] `'use strict'`を全JSファイルの先頭で使用している
- [x] kintone内部のid/class属性やDOM構造に依存せず、JavaScript API(`kintone.app.getFormFields()`, `kintone.plugin.app.getConfig/setConfig()`, `kintone.app.record.setFieldShown()`/`kintone.mobile.app.record.setFieldShown()`, `kintone.app.record.isFieldVisible()`/`kintone.mobile.app.record.isFieldVisible()`, `kintone.app.record.getHeaderMenuSpaceElement()`(PC)/`kintone.mobile.app.getHeaderSpaceElement()`(モバイル))のみを使用している

## REST API・外部通信(CLAUDE.md開発方針3・9参照)

- [x] REST APIは一切使用しない。位置情報の取得はブラウザ標準のGeolocation API(`navigator.geolocation.getCurrentPosition()`)のみで、kintoneへの通信を伴わない
- [x] Googleマップの埋め込みはAPIキー不要の公開埋め込みURL(`https://www.google.com/maps?q=<lat>,<lng>&output=embed`)を`<iframe>`のsrcに設定するのみで、`fetch`/`XMLHttpRequest`による外部通信は一切行わない(`box_gdrive_iframe`と同じ「iframeでの外部サイト埋め込み」方針)
- [x] 埋め込みURLはフィールド値の生文字列を直接連結せず、`js/lib/map-embed-url.js`の`buildUrl()`が`Number()`でパースし、有限の数値かつ緯度(-90〜90)・経度(-180〜180)の有効範囲内であることを確認したうえで組み立てる。任意の文字列(スクリプト・追加のURLパラメーター等)がURLに混入する余地をコード上排除している(`__tests__/map-embed-url.test.js`で範囲外・非数値がすべて`null`になることを確認済み)
- [x] 外部ライブラリを一切使用していない(vanilla JSのみ、`js/lib/`配下は依存なしの純粋関数)

## XSS・CSSインジェクション対策

- [x] 設定画面(`js/config.js`)でフィールド一覧・エラーメッセージを描画する際、`innerHTML`ではなく`document.createElement()` + `textContent`のみを使用している
- [x] レコード画面(`js/desktop.js`)の地図メッセージ表示(`renderMapMessage`)も`textContent`のみを使用している
- [x] iframeのsrcに設定する値は上記の通り数値検証済みの緯度・経度のみから組み立てたURLで、利用者が自由入力できる文字列を直接埋め込んでいない

## 設定の妥当性検証

- [x] 保存前に`js/lib/config-validation.js`でチェックし、不正な設定(緯度・経度の未選択、数値フィールド以外の選択、緯度と経度に同じフィールドを選択)は保存させない
- [x] `kintone.plugin.app.getConfig()`が`null`/`undefined`を返す場合でも、`js/lib/config-store.js`の`load()`は例外を投げず既定値(緯度・経度未設定、地図表示OFF)を返す
- [x] レコード画面側(`desktop.js`/`mobile.js`)でも、緯度・経度フィールドが未設定(プラグイン未設定)の場合は各処理を早期リターンし、画面をクラッシュさせない

## 位置情報取得の失敗時の挙動(本プラグイン固有の設計判断)

- [x] Geolocation APIの取得に失敗しても`event.error`は設定せず、レコードの登録・更新自体は継続する(緯度・経度は空のまま保存される)。「証跡が取れない場合でも業務(出退勤の打刻等)自体は止めない」という利用者向けの仕様上の判断であり、`alert()`(同期的にブロックする)で保存前に必ず利用者へ通知する
- [x] `navigator.geolocation`が存在しないブラウザでも例外にせず、`GeolocationPositionError`と同様にエラーメッセージへ変換して`alert()`する(`js/lib/geo-error-message.js`)

## 表示・編集の制限(セキュリティというより運用上の注意)

- [x] 緯度・経度フィールドの非表示化(`setFieldShown(false)`)・編集画面/インライン編集でのdisabled化は、いずれもJavaScript APIによるUIレベルの制御であり、REST API経由でのフィールド更新やアクセス権による制御ではない。「不正な書き換えを技術的に防ぐ」機能ではなく「通常操作でのミス・不正な手動編集を画面上防ぐUI上の制約」であることをidea.md・設定画面の説明文に明記した
- [x] 上記の制約がUIレベルであることを踏まえ、位置情報を証跡として運用する場合はアプリの「レコードの変更履歴(リビジョン)」を有効にすることを設定画面上で案内している(いつ・誰が値を書き換えたかを事後追跡できるようにするため)

## 通信・認証情報の取り扱い

- [x] 外部サービス(Google)との認証・APIキーのやり取りは一切行わない(埋め込みURLはAPIキー不要の公開形式のみ)
- [x] `kintone.plugin.app.setConfig()`に保存しているのはフィールドコード・地図表示フラグのみで、認証情報や機密情報は含まれない

## 位置情報(個人の行動履歴)の取り扱いに関する注意(個別確認事項)

- 緯度・経度は個人の所在地を示す機微情報になり得るため、保存先フィールドのアクセス権設定(誰が閲覧できるか)はアプリ管理者が別途適切に設定する必要がある(プラグイン側では制御できない範囲であることをidea.mdに明記した)
- 位置情報の取得はブラウザの許可ダイアログを経由する(利用者が明示的に許可した場合のみ取得できる、Geolocation APIのブラウザ標準の挙動)。許可しない場合でもレコード登録・更新は継続する仕様であることを、設定画面・公開サイトのページで利用者に説明する

問題があれば、公開サイトのリポジトリのGitHub Issueで報告してもらい対応する。
