# time_band_aggregator セキュリティチェックリスト

[secureCodingGuideline.md](../secureCodingGuideline.md)の一般項目([box_gdrive_iframe/security-checklist.md](../box_gdrive_iframe/security-checklist.md)参照、UTF-8/BOMなし・名前空間分離・`'use strict'`・外部スクリプト不使用などは同様に満たしている)は重複記載を省略し、本プラグイン固有の項目のみ記載する。

最終確認日: 2026-07-12

## コーディング作法

- [x] 文字コードはUTF-8(BOMなし)
- [x] グローバル変数を作らず、即時関数(IIFE)+名前空間オブジェクト(`window.TimeBandAggregator`)のみを公開している(`js/lib/*.js`, `js/config.js`, `js/desktop.js`, `js/mobile.js`, `js/bulk-runner.js`)
- [x] 既存のkintoneグローバルオブジェクトを書き換え・参照していない
- [x] `'use strict'`を全JSファイルの先頭で使用している

## REST API・外部通信(CLAUDE.md開発方針3参照)

- [x] フィールドの追加(`POST /k/v1/preview/app/form/fields.json`)・アプリ設定の運用環境への反映(`POST /k/v1/preview/app/deploy.json`)・反映状況確認(`GET /k/v1/preview/app/deploy.json`)は、いずれもJavaScript APIに相当機能が無い(フィールド追加・デプロイはJS APIで提供されていない)ため、`kintone.api(kintone.api.url(path, true), method, body)`(kintone自身への呼び出し専用の内部ラッパー)のみを使用している。生の`fetch`/`XMLHttpRequest`でURLを直接組み立てていない
- [x] レコード一覧・詳細のフィールド情報取得(`kintone.app.getFormFields()`)はJavaScript APIを優先して使用しており、プラグイン設定画面でも利用可能であることをkintoneドキュメントMCPで確認済み(CLAUDE.mdの既知の落とし穴 — `{properties: {...}}`のようにラップされない点を`js/config.js`で踏まえて実装)
- [x] 一括実行(`js/bulk-runner.js`)のレコード列挙(`/k/v1/records/cursor.json`)・書き戻し(`/k/v1/records.json`, `/k/v1/record.json`)もすべて`kintone.api()`経由。kintone以外の外部サーバーへの通信は一切行わない
- [x] 外部ライブラリを一切使用していない(vanilla JSのみ、`js/lib/`配下は依存なしの純粋関数)

## フィールド自動作成・アプリ設定変更のリスク

- [x] フィールド追加・デプロイAPIは「アプリ管理権限」を要求する(kintoneドキュメントに明記)。プラグイン設定画面を開けるユーザーは通常アプリ管理権限を持つ想定だが、権限不足で失敗した場合は`js/config.js`でエラー内容を表示し、`kintone.plugin.app.setConfig()`を呼ばずに処理を中断する(フィールド作成に失敗したまま設定だけ保存される不整合を防ぐ)
- [x] 同じフィールドコードを二重作成しないよう、`js/lib/field-spec-builder.js`で既存フィールド(型込み)と突き合わせてから追加対象を決定する(冪等性、`__tests__/field-spec-builder.test.js`でテスト済み)。既存の別フィールドとコードが衝突した場合は連番を付けた別コードを採番し、ユーザーに警告した上で確認を求める(`window.confirm()`)
- [x] このプラグインが作成するのはDROP_DOWN・NUMBERのみで、REST APIドキュメントに記載の追加不可フィールド(ステータス・作業者・カテゴリー)には該当しない
- [x] フィールド追加後のデプロイは非同期APIのため、`js/lib/deploy-poller.js`でSUCCESSになるまでポーリングしてから`kintone.plugin.app.setConfig()`を呼ぶ。FAIL/CANCEL・タイムアウト時は例外を投げて保存させない

## 一括実行・グループ制限の限界(重要)

- [x] 一覧画面の一括実行ボタンの表示は`kintone.user.getGroups()`(所属グループの取得)で判定するが、これは**クライアント側でボタンを出し分けているだけであり、真の権限制御ではない**(`js/lib/group-permission.js`, `js/bulk-runner.js`のコメント参照)。ボタンを非表示にしても、対象グループに属さないユーザーが直接REST APIを呼び出せば同じ操作は可能である。実際にレコードを書き換えられるかどうかを最終的に決めるのは自アプリ自体のkintoneレコード編集権限設定であり、本プラグインはそれに依存する設計(`related_record_summary`と同じ方針、idea.md参照)
- [x] 一括実行前にAPI実行回数の見積もり(`js/lib/api-estimate.js`)を`kintone.showConfirmDialog()`で表示し、実行確認を取る。実行中は`kintone.showLoading()`表示+`beforeunload`によるページ離脱防止を行う(`js/bulk-runner.js`)
- [x] 書き戻し(`PUT /k/v1/records.json`)でrevision競合(409相当)が発生したレコードは、`js/lib/batch-writer.js`でスキップして処理を継続し、完了後に成功件数・スキップ件数・レコード番号を表示する(`related_record_summary`と同じ設計、`__tests__/batch-writer.test.js`でテスト済み)

## タイムゾーンの扱い(実行ユーザー依存であることの明示)

- [x] DATETIMEフィールドの時間帯変換は`kintone.getLoginUser().timezone`(実行ユーザーのタイムゾーン、IANA名)を使う。同じレコードでも実行ユーザーのタイムゾーン設定によって算出される時間帯が変わりうることをidea.mdに明記した。一括実行時は「実行した人」のタイムゾーンで算出される(通常時と同じ挙動、`js/bulk-runner.js`のコメント参照)
- [x] TIME型フィールドはタイムゾーンを持たない時刻文字列のため、変換を行わずそのままパースする(`js/lib/time-band.js`)

## XSS・CSSインジェクション対策

- [x] 設定画面(`js/config.js`)でフィールド一覧・エラーメッセージ・作成済みフィールドコードを描画する際、`innerHTML`ではなく`document.createElement()` + `textContent`のみを使用している(`<template>`要素からの`cloneNode(true)`で行を組み立てる)
- [x] ドロップダウンの選択肢ラベル(`js/lib/field-spec-builder.js`の`options`)はプラグイン側で機械的に生成した時刻文字列("HH:MM〜HH:MM")のみで、外部入力・レコード値を含まない
- [x] レコード画面への値の書き込み(`desktop.js`/`mobile.js`/`bulk-runner.js`)は`record[...].value`への代入のみで、DOM操作(`innerHTML`等)を一切行わない

## 設定の妥当性検証

- [x] 保存前に`js/lib/config-validation.js`でチェックし、不正な設定(変換元フィールド未選択・型不正〈DATETIME/TIME以外〉、区切り幅不正、変換元フィールドの重複、発動タイミング不正、一括実行有効時のグループコード未指定)は保存させない
- [x] `kintone.plugin.app.getConfig()`が`null`/`undefined`を返す場合でも、`js/lib/config-store.js`の`load()`は例外を投げず既定値を返す
- [x] レコード画面側(`desktop.js`/`mobile.js`)でも、設定に含まれるフィールドが実際のレコードに存在しない場合は早期リターン(値の代入をスキップ)し、画面をクラッシュさせない

## 通信・認証情報の取り扱い

- [x] `kintone.api()`はログイン中のセッション情報を自動的に使用するため、APIトークンやパスワード等の認証情報をコード・設定に含めない(secureCodingGuideline.md準拠)

## 非表示・disabled化の仕様(セキュリティというより運用上の注意)

- [x] 作成した2フィールドの`setFieldShown(..., false)`によるレコード画面での非表示、および一覧インライン編集での`disabled`化は、いずれもJavaScript APIによるUIレベルの制御であり、REST API経由でのフィールド更新やアクセス権による制御ではない。「不正操作を防ぐ」機能ではなく「通常操作でのミスを防ぐUI上の制約」であることをidea.mdに明記した

問題があれば、公開サイトのリポジトリのGitHub Issueで報告してもらい対応する。
