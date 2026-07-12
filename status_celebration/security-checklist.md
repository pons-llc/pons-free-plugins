# status_celebration(お祝いプラグイン) セキュリティチェックリスト

[secureCodingGuideline.md](../secureCodingGuideline.md)の一般項目([box_gdrive_iframe/security-checklist.md](../box_gdrive_iframe/security-checklist.md)参照、UTF-8/BOMなし・名前空間分離・`'use strict'`・外部スクリプト不使用などは同様に満たしている)は重複記載を省略し、本プラグイン固有の項目のみ記載する。

最終確認日: 2026-07-12

## コーディング作法

- [x] 文字コードはUTF-8(BOMなし)
- [x] グローバル変数を作らず、即時関数(IIFE)+名前空間オブジェクト(`window.StatusCelebration`)のみを公開している(`js/lib/celebration-trigger.js`, `js/lib/config-store.js`, `js/lib/config-validation.js`, `js/effects.js`)
- [x] 既存のkintoneグローバルオブジェクトを書き換え・参照していない
- [x] `'use strict'`を全JSファイルの先頭で使用している
- [x] kintone内部のid/class属性やDOM構造に依存せず、JavaScript API・`kintone.api()`(内部向けラッパー)のみを使用している

## REST API・外部通信(CLAUDE.md開発方針3参照)

- [x] `kintone.app.getStatus()`(JavaScript API)はプラグイン設定画面では利用できない(status_arrowで実機確認済みの制約)ため、設定画面でのプロセス管理ステータス選択肢一覧の取得のみ、REST API(`GET /k/v1/app/status.json`)を`kintone.api(kintone.api.url('/k/v1/app/status.json', true), 'GET', { app: kintone.app.getId() })`(kintone自身への呼び出し専用の内部ラッパー)経由で呼び出している。レコード画面側(`desktop.js`/`mobile.js`)の発火判定はJavaScript APIのイベントオブジェクト(`event.status`/`event.nextStatus`)のみで完結しており、REST呼び出しを行わない
- [x] `kintone.api.url(path, true)`の第2引数`true`によりドメイン部分を自動解決させ、外部ドメインへのリクエストになる余地をコード上排除している
- [x] kintone以外の外部サーバーへの通信(fetch/XHR)を一切行わない
- [x] 外部ライブラリを一切使用していない(vanilla JSのみ、演出は`<canvas>`のCanvas 2D APIのみで描画し、外部の紙吹雪ライブラリ等は組み込んでいない)

## XSS・CSSインジェクション対策

- [x] 設定画面(`js/config.js`)でフィールド一覧・選択肢一覧・エラーメッセージを描画する際、`innerHTML`ではなく`document.createElement()` + `textContent`のみを使用している(リスト再描画の`innerHTML = ''`はクリア専用で、外部由来の文字列を差し込んでいない)
- [x] レコード画面の演出(`js/effects.js`)で表示するバナーメッセージ(`showBanner()`)は、アプリ管理者が設定画面で入力した任意の文字列(`rule.message`、最大60文字)だが、`innerHTML`ではなく`textContent`のみで描画しており、HTMLとして解釈されない
- [x] 演出オーバーレイ(`<canvas>`・バナー)は`stc-`プレフィックスの専用id/classのみを使用し、`pointer-events: none`(バナーは`fixed`配置かつクリック領域を持たない)にすることで、演出中にレコード画面の他の操作(ボタン・入力欄のクリック)を妨げない設計にしている
- [x] 演出終了時に`<canvas>`要素・バナー要素を確実にDOMから除去する(`removeById()`、`setTimeout`によるバナー除去、アニメーション終了時の`canvas.remove()`)。連続して発火した場合も、直前の演出要素を`play()`冒頭で明示的に除去してから新しい演出を開始するため、要素が蓄積し続けることはない

## 設定の妥当性検証

- [x] 保存前に`js/lib/config-validation.js`の`validateRules()`でチェックし、不正な設定(ルール0件、対象種別不正、FIELDで対象フィールド未選択、お祝い対象の値が0件または空文字混入、演出パターン不正)は保存させない
- [x] `kintone.plugin.app.getConfig()`が`null`/`undefined`を返す場合でも、`js/lib/config-store.js`の`load()`は例外を投げず既定値(`{ rules: [] }`)を返す
- [x] レコード画面側(`desktop.js`/`mobile.js`)は、設定に含まれるフィールドが実際のレコードに存在しない場合(`record[fieldCode]`が`undefined`)でも空文字列にフォールバックし例外を投げない。プロセス管理が無効なアプリでは`statusRules`があってもイベント発火時に`event.status`/`event.nextStatus`が空値扱いになるだけで、画面をクラッシュさせない

## 発火条件・演出の設計上の注意(セキュリティというより誤動作防止)

- [x] `shouldCelebrate()`(`js/lib/celebration-trigger.js`)で「値が変化した場合のみ」発火するようにしており、レコードを開くたびに毎回演出が出る、あるいはプロセス管理のアクションでステータスが変わらない場合(kintone公式ドキュメントに記載の仕様)にも誤って発火する、という不具合をユニットテストで防止している(`__tests__/celebration-trigger.test.js`)
- [x] 演出は2.4秒程度で自動的に終了し、`pointer-events: none`により背後の入力・ボタン操作をブロックしない(派手すぎる演出による誤操作・作業妨害を避ける設計、idea.md参照)
- [x] 効果音を一切鳴らさない(kintoneの他の通知音・環境音との衝突、意図しない音量でのユーザー体験悪化を避けるため)

## 通信・認証情報の取り扱い

- [x] `kintone.api()`はログイン中のセッション情報を自動的に使用するため、APIトークンやパスワード等の認証情報をコード・設定に含めない(secureCodingGuideline.md準拠)

問題があれば、公開サイトのリポジトリのGitHub Issueで報告してもらい対応する。
