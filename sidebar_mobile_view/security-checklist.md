# sidebar_mobile_view セキュリティチェックリスト

[secureCodingGuideline.md](../secureCodingGuideline.md)の一般項目([box_gdrive_iframe/security-checklist.md](../box_gdrive_iframe/security-checklist.md)参照、UTF-8/BOMなし・名前空間分離・`'use strict'`・外部スクリプト不使用などは同様に満たしている)は重複記載を省略し、本プラグイン固有の項目のみ記載する。

最終確認日: 2026-09-15 / 対象: 新規作成画面対応・対象アプリを別アプリに変更できる機能の追加時

## コーディング作法

- [x] 文字コードはUTF-8(BOMなし)
- [x] グローバル変数を作らず、即時関数(IIFE)+名前空間オブジェクト(`window.SidebarMobileView`)のみを公開している(`js/lib/config-store.js`, `js/lib/config-validation.js`, `js/lib/mobile-url.js`, `js/lib/panel-state.js`)
- [x] 既存のkintoneグローバルオブジェクトを書き換え・参照していない
- [x] `'use strict'`を全JSファイルの先頭で使用している

## REST API・外部通信

- [x] `desktop.js`・`config.js`のいずれもREST API・`kintone.api()`を一切使用せず、JavaScript API(`kintone.app.record.showSideBar()`, `kintone.app.record.getHeaderMenuSpaceElement()`, `kintone.app.record.getId()`, `kintone.app.getId()`, `kintone.plugin.app.getConfig()`/`setConfig()`)のみで完結する
- [x] kintone以外の外部サーバーへの通信(fetch/XHR)を一切行わない
- [x] 外部ライブラリを一切使用していない(vanilla JSのみ)
- [x] iframeで読み込むURLは`location.origin`(実行中のkintoneサイト自身)のみを使い、外部ドメインへの通信は発生しない(idea.md「iframe埋め込み時のX-Frame-Options」参照)

## XSS・CSSインジェクション対策

- [x] iframeのURL(`js/lib/mobile-url.js`の`buildRecordUrl()`/`buildListUrl()`/`resolve()`)は`location.origin`・**数値であることを検証済みの**アプリID・レコードIDのみから組み立てており、レコードの値やユーザー入力を一切URLに含めない(正規表現`^[1-9][0-9]*$`または`Number.isInteger`で検証し、不正な場合は`null`を返してiframeを描画しない)。この理由により、box_gdrive_iframeのような「埋め込み先ホストの許可リスト」は不要(埋め込み先は常に実行中のkintoneサイト自身に限定されるため)
- [x] iframeに`sandbox`属性を付与していない。これは埋め込み先が常に同一オリジンのkintone自身のモバイル画面であり(ユーザー入力の任意URLを埋め込むbox_gdrive_iframeとは異なり信頼できるコンテンツ)、モバイル版の通常の操作(フォーム操作等)を妨げないための意図的な判断
- [x] 設定画面(`js/config.js`)でエラーメッセージを描画する際、`innerHTML`ではなく`errorsEl.textContent`のみで出力している(表示するのはアプリ管理者自身が入力した値の検証結果であり、外部由来の文字列ではない)
- [x] 自作パネル(`desktop.js`の`getOrCreatePanel()`)のDOM構築は`document.createElement()` + `textContent`のみで行い、`innerHTML`は使用していない

## 設定の妥当性検証

- [x] 保存前に`js/lib/config-validation.js`の`validateConfig()`でチェックし、不正な設定(初期表示の値が不正、コメント/履歴タブの指定が不正、パネル幅が240〜900pxの範囲外、対象アプリIDが正の整数でない)は保存させない
- [x] `kintone.plugin.app.getConfig()`が`null`/`undefined`を返す場合でも、`js/lib/config-store.js`の`load()`は例外を投げず既定値(`defaultView: 'NATIVE'`, `panelWidth: 400`等)を返す
- [x] `js/lib/mobile-url.js`の`buildRecordUrl()`/`buildListUrl()`は、アプリID・レコードIDが数値として不正な場合に例外を投げず`null`を返し、`desktop.js`側は`null`の場合パネルを表示しない(画面をクラッシュさせない)
- [x] 新規作成画面では`kintone.app.record.getId()`・`kintone.app.record.showSideBar()`・`kintone.app.record.getSideBarDisplayState()`(いずれも公式ドキュメント上、新規作成画面が「利用できる画面」に含まれないAPI)を一切呼び出さない。`desktop.js`は`kintone.events.on()`のイベント配列に渡した`event.type`で新規作成画面かどうかを判定し(`currentHasNativeSideBar`)、呼び出しを分岐する

## 通信・認証情報の取り扱い

- N/A — 外部サービスとの認証・APIキーのやり取りを行わない。iframeが読み込むのはkintone自身のモバイル画面であり、ログインセッション(Cookie)はブラウザが同一オリジンとして自動的に扱う。プラグイン側で認証情報を保存・送信することはない

## 表示専用機能である旨の注記(セキュリティというより運用上の注意)

- [x] サイドパネルの表示切り替えはUIレベルの表示状態の切り替えであり、レコードデータそのものやアクセス権には一切影響しない。コメント・変更履歴のデータ自体はパネルを閉じても削除・変更されない
- [x] モバイル版プレビューのiframeは、そのレコード・アプリに対する現在のユーザーのアクセス権の範囲内でのみ内容が表示される(kintone自身のモバイル画面をそのまま表示するだけであり、プラグインが権限チェックを迂回することはない)
- [x] 対象アプリIDを別アプリに変更する機能について: 表示されるのはログイン中のユーザー自身が元々アクセス権を持つ範囲のみ(閲覧権限が無いアプリ・レコードを指定した場合はkintone自身のアクセス拒否画面がiframe内に表示されるだけで、プラグインが権限を昇格させることはない)。対象アプリIDはプラグイン設定を変更できるアプリ管理者のみが指定できる値であり、一般ユーザーが任意のアプリを閲覧できるようになるわけではない

## 個別確認事項(利用ユーザーへ委ねる項目)

- 自作パネルの縦位置(`top`)がヘッダーの高さを初期表示時に一度だけ測定する簡略仕様である点(idea.md「カスタムサイドパネルの実装方式」4点目、スクロールでヘッダーが隠れた場合の追従は行わない)の仕様変更要否
- パネル幅が画面の横幅に対して自動的に縮小されない(小さいウィンドウでは管理者側で幅設定の調整が必要)点の仕様変更要否

問題があれば、公開サイトのリポジトリのGitHub Issueで報告してもらい対応する。
