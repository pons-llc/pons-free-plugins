# plugin_catalog_builder セキュリティチェックリスト

[secureCodingGuideline.md](../secureCodingGuideline.md)の一般項目([box_gdrive_iframe/security-checklist.md](../box_gdrive_iframe/security-checklist.md)参照、UTF-8/BOMなし・名前空間分離・`'use strict'`・`kintone.api()`のみ使用などは同様に満たしている)は重複記載を省略し、本プラグイン固有の項目のみ記載する。

最終確認日: 2026-07-19

## 【最重要】外部CDNライブラリの動的読み込み(CLAUDE.md開発方針9の例外)

- [x] 本プラグインは、簡易AI検索(設定でON時のみ)に限り、CLAUDE.md開発方針9(外部パッケージ・外部通信を一切使わない)の**例外**として、`@huggingface/transformers`をCDN(`https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0/+esm`)から`import()`で動的読み込みしている(`js/desktop.js`の`AI_SEARCH_CDN_URL`)。`excel_report_export`の前例(外部通信そのものを禁止し、ビルド時バンドルを選択)とは**異なる判断**であり、ユーザー承認済み(idea.md参照)
- [x] バージョンは`@4.2.0`と完全固定しており、`@latest`のような可変指定を使っていない。バージョンを上げる場合は本チェックリストを再監査すること
- [x] AI検索OFF(既定値)の場合、`js/desktop.js`の`renderAiSearchButton`が早期リターンし、`loadExtractor`(CDN読み込みを行う関数)は一切呼び出されない。CDN通信はAI検索ボタンを実際にクリックした場合のみ発生する
- [x] ダウンロード機能(`runDownload`)・同期機能(`runSync`)はAI検索の設定に関わらず、CDN等の外部通信を一切行わない(`kintone.api()`によるkintone自身への通信のみ)
- リスクとして残る点(idea.md・config.htmlの注意書きに明記済み):
  - CDN(jsdelivr)側が侵害・改ざんされた場合、台帳アプリのレコード一覧を開いたユーザーのブラウザで任意コードが実行され得る(サプライチェーンリスク)。完全な排除は「AI検索機能自体を提供しない」以外に無いため、機能価値とのトレードオフとしてユーザーが受け入れた
  - CDNが利用不可・低速な環境ではAI検索が使えない(`openAiSearchDialog`のcatchでエラー表示し、画面をクラッシュさせない。ダウンロード機能を代替手段として案内)
  - 重大な脆弱性が`@huggingface/transformers`側で報告された場合は、`AI_SEARCH_CDN_URL`のバージョン更新または本機能自体の無効化(config.htmlのチェックボックスOFF)で対応する

## REST API・権限境界(idea.md「使用するREST API」「権限の実効的な境界」参照)

- [x] `GET /k/v1/plugins.json`・`GET /k/v1/plugin/apps.json`・`GET /k/v1/apps.json`・`PUT /k/v1/records.json`・`GET`/`POST /k/v1/preview/app/form/fields.json`・`POST`/`GET /k/v1/preview/app/deploy.json`・`GET /v1/groups.json`は、いずれもJavaScript APIで代替不可(環境全体・クロスアプリの情報のため)なことをkintoneドキュメントMCPで確認済み。すべて`kintone.api()`(内部向けラッパー)経由で呼び出しており、生の`fetch`/`XMLHttpRequest`でURLを直接組み立てていない
- [x] `GET /k/v1/plugin/apps.json`は**cybozu.com共通管理者権限を必須**とするAPIであることをドキュメントで確認済み。この権限を持たないユーザーが同期を実行した場合、APIが403エラーを返し例外がそのまま`runSync`に伝播、`alert`でユーザーに通知して処理を中止する(部分的な書き込みは発生しない、`SyncOrchestrator.gather`は読み取りのみで完結するため)
- [x] **「同期ボタンを表示するグループ」設定(`kintone.user.getGroups()`によるボタン表示制御)は、あくまでUI上の絞り込みであり真の権限境界ではない**ことをidea.md・config.html・コード内コメントの3箇所に明記した(`related_record_summary`と同じ設計・同じ限界)。真の権限境界は上記のcybozu.com共通管理者権限、および台帳アプリ自体のレコード追加・編集権限である
- [x] `GET /k/v1/apps.json`は閲覧・追加権限が無いアプリの情報を返さない(ドキュメント記載の仕様)。この場合、該当アプリの`app_detail`は固定文言(`PluginRecordMapper.NO_APP_INFO_DETAIL`)にフォールバックし、存在しないデータを捏造しない

## フィールド自動作成・アプリ設定の運用環境反映(config.js)

- [x] `POST /k/v1/preview/app/form/fields.json`は動作テスト環境にのみ反映されるため、`kintone.plugin.app.setConfig()`のあとに`POST /k/v1/preview/app/deploy.json`で運用環境へのデプロイを明示的に実行し、`GET /k/v1/preview/app/deploy.json`のstatusが`SUCCESS`になるまでポーリングする(`js/lib/deploy-poller.js`でテスト済みのオーケストレーション)。デプロイが`FAIL`/`CANCEL`/`TIMEOUT`の場合はエラー表示し、ユーザーに再保存を促す
- [x] **(実環境E2Eテストで発見・修正済み・重要)** `kintone.plugin.app.setConfig()`で保存した値自体も動作テスト環境(preview)にのみ反映され、デプロイするまでレコード一覧等の画面(`desktop.js`側の`getConfig()`)からは古い値のまま見えることを実際の検証環境で確認した(`GET/PUT /k/v1/preview/app/plugin/config.json`というURLからも推測できる)。初期実装はフィールド追加が無い場合(2回目以降の保存)にデプロイを省略していたため、「許可グループを外して保存したのに同期ボタンが表示されたまま」という実害のある不具合になっていた。修正後は**フィールド追加の有無に関わらず`setConfig()`のたびに必ずデプロイする**(idea.md「プラグイン設定はフィールドと同じくデプロイが必要」参照)
- [x] フィールド追加は`js/lib/field-diff.js`の`diffMissingFields`で既存フィールドとの差分のみを対象にしており、2回目以降の設定保存で既存フィールドを再作成しようとして`add-form-fields` APIが400エラーになることはない(`__tests__/field-diff.test.js`で冪等性を確認済み)
- [x] 作成対象は`plugin_id`/`plugin_name`/`plugin_version`/`plugin_detail`/`pcb_apps_table`の5項目のみ。ステータス・作業者・カテゴリー等のシステムフィールドは`add-form-fields` APIのドキュメントで追加不可と明記されているため作成対象から除外している(idea.md「フィールド自動作成」参照。誤って作成しようとしてAPIエラーになることを防ぐ)
- [x] **(実環境E2Eテストで発見・修正済み)** SUBTABLEのフィールドコードは元メモの`テーブル`という汎用的な名前のまま実装すると、対象アプリに同名の既存フィールドがあった場合に衝突し、本来のテーブル(`app_name`/`app_id`/`app_detail`)が永久に作成されない不具合になることが実際の検証環境(`TEST_APP_ID_1`)で確認された。フィールドコードを一意な`pcb_apps_table`に変更して解消した(idea.md「フィールドコードの訂正」参照)
- [x] フィールド追加は`revision`を指定しており、他の管理者が同時にアプリ設定を変更していた場合はリビジョン不一致でエラーになる(意図しない設定の上書きを防ぐ、kintone標準の楽観的排他制御に委ねている)。最終デプロイは`revision`を省略しており検証をスキップする(直前の`setConfig()`・フィールド追加が確実に反映されることを優先した)

## XSS対策(kintone.createDialog()のサニタイズ注意事項)

- [x] `kintone.createDialog()`の`config.body`は「そのままダイアログ本文の要素として組み込まれ、必要に応じてサニタイズ処理を行ってください」とドキュメントに明記されているAPIである。`js/desktop.js`の`renderAiSearchForm`・`renderAiSearchResults`は`innerHTML`を一切使わず、`document.createElement()` + `textContent`のみでAI検索結果(プラグイン名・説明・利用アプリ名。いずれもkintone環境内のデータ由来で、悪意ある第三者が直接書き込める経路ではないが念のため)を描画している
- [x] 設定画面(`js/config.js`)のグループ一覧・エラーメッセージ・進捗メッセージも同様に`textContent`のみで描画し、`innerHTML`へ外部由来の文字列を差し込んでいない(グループ一覧は`<template>`要素からの`cloneNode(true)`で行を組み立てる)

## 実データ・ドキュメントに基づく実装(推測実装の防止)

- [x] 上記REST APIすべての仕様(必要なアクセス権・レスポンス形式・1リクエストあたりの上限件数)をkintoneドキュメントMCPで確認したうえで実装した(idea.md「実データ・ドキュメントに基づく実装方針」参照)
- [x] `add-form-fields`が動作テスト環境にのみ反映され、別途デプロイAPIが必要な点は、ドキュメントの「補足」欄の記載を確認したうえで実装した(推測実装ではない)

## 認証情報の取り扱い

- [x] `kintone.api()`はログイン中のセッション情報を自動的に使用するため、APIトークンやパスワード等の認証情報をコード・設定に含めない(secureCodingGuideline.md準拠)
- [x] `.env`の検証環境接続情報(`KINTONE_USERNAME`/`KINTONE_PASSWORD`)はE2Eテストの実行時のみ使用し、プラグイン設定(`kintone.plugin.app.setConfig()`)には一切含めない

## 未削除ポリシー(データ整合性、セキュリティというより運用上の注意)

- [x] 同期(UPSERT)はプラグインの追加・更新のみを行い、環境から削除・アンインストールされたプラグインの既存レコードを自動削除しない(idea.md「環境に存在しなくなったプラグインのレコードの扱い」参照)。誤検知による意図しないレコード削除のリスクを避けるための意図的な設計であることをidea.mdに明記した

## アクセス権に関する注意(個別確認事項)

- 台帳アプリのレコードにはプラグイン名・説明・社内アプリ名が含まれる。機密情報ではないが、社内の業務アプリ構成が推測できる情報ではあるため、台帳アプリ自体のレコード閲覧権限はアプリ管理者が組織の方針に応じて設定する必要がある(プラグイン側では制御できない範囲であることをidea.mdに明記した)
- 簡易AI検索をONにする場合、台帳アプリのレコード内容(プラグイン名・説明・利用アプリ名)がCDN配信コードの処理対象(ブラウザメモリ上)になる。機密情報を含むフィールドをこのアプリに追加しないよう、config.htmlの注意書きで運用上の注意を促している

問題があれば、公開サイトのリポジトリのGitHub Issueで報告してもらい対応する。
