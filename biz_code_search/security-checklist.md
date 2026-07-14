# biz_code_search セキュリティチェックリスト

[secureCodingGuideline.md](../secureCodingGuideline.md)の一般項目([box_gdrive_iframe/security-checklist.md](../box_gdrive_iframe/security-checklist.md)参照、UTF-8/BOMなし・名前空間分離・`'use strict'`・外部スクリプト不使用などは同様に満たしている)は重複記載を省略し、本プラグイン固有の項目のみ記載する。

最終確認日: 2026-07-14

## コーディング作法

- [x] グローバル変数を作らず、即時関数(IIFE)+名前空間オブジェクト(`window.BizCodeSearch`)のみを公開している(`js/lib/*.js`, `js/result-modal.js`)
- [x] 既存のkintoneグローバルオブジェクトを書き換え・参照していない
- [x] `'use strict'`を全JSファイルの先頭で使用している

## 外部通信(CLAUDE.md開発方針9の意図的な例外)

本プラグインは、CLAUDE.md開発方針9「kintone以外のサーバーへの通信を行わない」の**意図的な例外**として、
経済産業省の公開API(gBizINFO REST API v2)にのみ通信する(`plugin_idea.md`で当初から計画済みの仕様)。

- [x] 外部通信は`kintone.plugin.app.proxy()`(プラグイン専用のクロスドメイン許可API)経由のみで行い、生の`fetch`/`XMLHttpRequest`を一切使用していない(`js/desktop.js`/`js/mobile.js`の`callGBiz`)
- [x] 通信先URLは`js/lib/gbiz-api.js`の`BASE_URL`定数(`https://api.info.gbiz.go.jp/hojin/v2/hojin`)から組み立てられる固定ホストのみで、ユーザー入力やレコード値をURLのホスト部分に使用していない(パスに使うのは検証済みの法人番号・クエリに使う法人名のみで、`encodeURIComponent()`でエスケープしている)
- [x] gBizINFOのAPI仕様(エンドポイント・パラメータ・レスポンス形式)は実際にOpenAPI仕様(`https://api.info.gbiz.go.jp/hojin/v3/api-docs?group=v2`)を取得し、さらに実際に取得したAPIトークンで検索・詳細取得の両エンドポイントを試行して実データで確認済み(推測実装ではない、idea.md参照)
- [x] 外部ライブラリを一切使用していない(vanilla JSのみ、`js/lib/`配下は依存なしの純粋関数)

## APIトークンの秘匿(secureCodingGuideline.mdの認証情報の保存先に対応)

- [x] APIトークンは`kintone.plugin.app.setProxyConfig()`でプラグインの秘匿領域に保存し、`kintone.plugin.app.getConfig()`(通常のプラグイン設定)には一切含めない。通常の設定に保存するのは「設定済みか」の真偽値フラグ(`apiTokenConfigured`)のみで、トークンの値自体は保存しない(`js/lib/config-store.js`)
- [x] 保存したトークンがリクエストに付加される条件は「アプリ・プラグイン・HTTPメソッド・URL前方一致」がすべて一致する場合のみ(kintone側の仕様)。本プラグインの`setProxyConfig`/`proxy`はどちらも`GBizApi.BASE_URL`を使うため、この条件を満たすリクエストは本プラグイン自身が発行するリクエストに限られる
- [x] 設定画面(`js/config.js`)のAPIトークン入力欄は`type="password"`で、既存のトークンを再表示・事前入力することはない(kintone側の仕様上、保存済みの値を読み出す手段が無いため)。空欄のまま保存した場合は既存のトークンを維持し、`setProxyConfig()`を呼び直さない
- [x] トークン欄の値は送信(`setProxyConfig()`)後、画面上のどこにも保持・ログ出力しない

## XSS・CSSインジェクション対策

- [x] 法人名検索の結果一覧モーダル(`js/result-modal.js`)は、gBizINFOから取得した法人名・所在地等の値を`textContent`のみで描画し、`innerHTML`を一切使用していない(外部APIレスポンスに悪意ある文字列が含まれていてもDOM構造に影響しない)
- [x] 設定画面(`js/config.js`)のフィールド一覧・エラーメッセージの描画も`textContent`のみを使用している(プルダウン選択肢の組み立ては`document.createElement()` + `<template>`の`cloneNode(true)`)
- [x] 出力先フィールドへの書き込み(`js/desktop.js`/`js/mobile.js`の`applyHojinInfoToRecord`)は`kintone.app.record.get()`で取得したレコードオブジェクトの`[...].value`への値代入のみで、DOM操作(`innerHTML`等)を一切行わない。kintone標準のフィールド値レンダリングを経由するためHTMLとして解釈されない

## 設定の妥当性検証

- [x] 保存前に`js/lib/config-validation.js`でチェックし、不正な設定(法人番号・法人名フィールド未選択/型不正、ボタン設置スペース未選択/重複、転記項目0件/属性キー不正/出力先未選択/型不正、出力先フィールドの重複、出力先と法人番号・法人名フィールドの重複)は保存させない
- [x] `kintone.plugin.app.getConfig()`が`null`/`undefined`を返す場合でも、`js/lib/config-store.js`の`load()`は例外を投げず既定値(`{ lookups: [], apiTokenConfigured: false }`)を返す
- [x] 法人番号は`js/lib/corporate-number.js`の`isValidCorporateNumber()`で13桁の数字であることを確認してからAPIを呼ぶ(不正な形式のまま外部へリクエストを送らない)

## 通信エラー・該当なし時の挙動

- [x] `kintone.plugin.app.proxy()`が失敗(ネットワークエラー・認証エラー等)した場合はレコードへの反映を行わず、alertでエラー内容を利用者に明示する(中途半端な上書きを避ける)
- [x] 該当する法人が見つからない場合(詳細取得0件・名前検索0件)は、転記項目・法人番号フィールドをすべて空文字列でクリアしてからalert表示する(`org_lookup`/`self_lookup`と同じ「該当なしはクリア」方針)

## 編集禁止(disabled化)の仕様(セキュリティというより運用上の注意)

- [x] 転記項目の出力先フィールドの`disabled`化はJavaScript APIによるUIレベルの制御であり、REST API経由でのフィールド更新やアクセス権による制御ではない。「不正操作を防ぐ」機能ではなく「通常操作でのミスを防ぐUI上の制約」であることをidea.mdに明記した

## 個別確認事項(利用ユーザーへ委ねる項目)

- gBizINFOのAPIトークンはBYOD(利用者が自分で申請・取得)のため、開発側では実利用者のトークンの安全な管理(共有範囲・失効等)まで関与できない。プラグイン側は前述の通り秘匿領域への保存のみを担保する
- gBizINFOから取得できる法人情報(資本金・従業員数等)は経済産業省が公開している情報だが、転記先フィールドのアクセス権設定(誰が閲覧できるか)はアプリ管理者が別途適切に設定する必要がある(プラグイン側では制御できない範囲)

問題があれば、公開サイトのリポジトリのGitHub Issueで報告してもらい対応する。
