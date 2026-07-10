# related_record_summary セキュリティチェックリスト

[secureCodingGuideline.md](../secureCodingGuideline.md)の一般項目(UTF-8/BOMなし・名前空間分離・`'use strict'`・
外部スクリプト不使用などは[box_gdrive_iframe/security-checklist.md](../box_gdrive_iframe/security-checklist.md)、
[fiscal_year_numbering/security-checklist.md](../fiscal_year_numbering/security-checklist.md)と同様に満たしている)は
重複記載を省略し、本プラグイン固有の項目のみ記載する。

最終確認日: 2026-07-11 / 対象: Puppeteerによる実環境テスト(`src/e2e/config-screen.e2e.test.js`・
`src/e2e/aggregation.e2e.test.js`。詳細画面ボタン経由の集計・書き込みまで)を追加実施。
保存時トリガー・一覧画面の一括集計トリガーの実環境テストは未実施(判断記録.md「8.」参照)。

## コーディング作法

- [x] 文字コードはUTF-8(BOMなし)
- [x] グローバル変数を作らず、`window.RelatedRecordSummary`という単一の名前空間オブジェクトのみを公開している(全js/lib配下・グルーコード共通)
- [x] 既存のkintoneグローバルオブジェクトを書き換え・参照していない
- [x] `'use strict'`を全JSファイルの先頭で使用している
- [x] kintone内部のid/class属性・DOM構造に依存せず、JavaScript API(`kintone.app.record.getHeaderMenuSpaceElement()`, `kintone.app.getHeaderMenuSpaceElement()`, `kintone.mobile.app.getHeaderSpaceElement()`)のみで要素を取得している

## REST API利用(本プラグインの中核機能)

- [x] REST API呼び出しはすべて`kintone.api()`経由であり、生の`fetch`/`XHR`は使用していない(`js/related-record-client.js`, `js/bulk-summary.js`, `js/config.js`, `js/desktop.js`, `js/mobile.js`)
- [x] URLは`kintone.api.url()`で組み立てている(secureCodingGuideline「URLの取得」)
- [x] CLAUDE.md方針3(JavaScript API優先)に従い、自アプリのフィールド設定取得は`kintone.app.getFormFields()`(JS API)を使い、他アプリ(参照先アプリ)のレコード取得・自アプリの他レコードへの書き戻し・レコードカーソル操作のみREST APIを使っている。plugin_idea_plan.mdの原文は「フォーム設定APIで読む」だが実装ではJS APIに置き換えている(idea.md・判断記録.md参照)
- [x] 短時間の大量リクエスト・並列実行を避ける方針(secureCodingGuideline「短時間で大量のリクエスト送信を避ける」「並列で実行するのをなるべく避ける」)に従い、一括集計・ページング・書き戻しはすべて`for...of`による逐次処理(`js/bulk-summary.js`, `js/lib/paged-fetch.js`, `js/lib/batch-writer.js`)で、並列(`Promise.all`等)は使用していない

## レコードカーソルAPI利用時の注意点(一括集計の対象レコード列挙)

一覧画面からの一括集計は、対象レコード集合を実行開始時点で固定するため、`$id`昇順ページングではなく
レコードカーソルAPI(`POST /k/v1/records/cursor.json` → `GET /k/v1/records/cursor.json`)を使う
(plugin_idea_plan.mdの確定事項)。実装(`js/lib/cursor-enumerator.js`, `js/bulk-summary.js`)は以下の制限事項を
踏まえている(`mcp__claude_ai_kintone_doc__get_page`で`/ja/kintone/docs/rest-api/records/create-cursor/`・
`/ja/kintone/docs/rest-api/records/get-cursor/`・`/ja/kintone/docs/rest-api/records/delete-cursor/`を実装前に確認済み)。

- [x] 同時に作成できるカーソルは1ドメイン10個までであることをコメントに明記済み(`js/lib/cursor-enumerator.js`)。本プラグインは1回の一括集計につき同時に1カーソルしか作成しないため、通常の利用では上限に抵触しにくいが、複数ユーザーが同時に一括集計を実行した場合は上限に達し得る旨の注意はコード上に残している
- [x] カーソルの有効期限(最終アクセスから10分、作成自体は5分でタイムアウト)を踏まえ、`getCursor`のループは逐次実行(並列化しない)にとどめ、無用な待機を挟まない実装にしている
- [x] `next: true`でも次のレスポンスの`records`が空になることがある点に対応し、ループの継続条件を`records.length`ではなく`next`で判定している(`cursor-enumerator.test.js`「keeps polling when next is true even if a page returns an empty records array」でテスト済み)
- [x] `like`/`not like`を含む条件は10万件で打ち切られ`X-Cybozu-Warning`ヘッダーが付く制限がある旨をコメントに明記済み。ただし本プラグインは絞り込み条件をそのまま(`kintone.app.getQueryCondition()`の値を)使うため、`like`/`not like`を含む条件をユーザーが設定した場合はこの制限の影響を受け得る。応答ヘッダーの明示的なチェック・警告表示は未実装(個別確認事項として下記に記載)
- [x] 全件取得完了でカーソルは自動削除されるが、途中で例外が発生した場合は`DELETE /k/v1/records/cursor.json`を呼び出して明示的に削除するようにしている(`cursor-enumerator.js`の`enumerateAll`、`deleteCursor`呼び出しとその失敗時のもみ消し処理をテスト済み)

## 書き戻し(PUT)時のrevision競合対応

- [x] `PUT /k/v1/records.json`は「1件でも失敗すると、そのリクエストに含めた全レコードの更新がキャンセルされる」仕様(REST APIドキュメント「複数のレコードを更新する」の制限事項に明記)であることを踏まえ、100件バッチでの一括送信が失敗した場合のみ、そのバッチ内を1件ずつ`PUT /k/v1/record.json`で個別送信し直すフォールバック方式にしている(`js/lib/batch-writer.js`)
- [x] revision競合の判定(`isRevisionConflictError`)は、kintone REST APIの実際のエラーレスポンスをPuppeteerでの実環境テストで確認できていない状態のため、既知の候補コード(`GAIA_CO02`)とメッセージ文言(「リビジョン」/「revision」を含む)によるヒューリスティック判定にとどめている。fiscal_year_numberingの`isUniqueConstraintViolation`と同様の限界がある(未解決・下記「個別確認事項」参照)
- [x] 競合以外のエラー(権限エラー等)は競合として扱わずそのまま再スローし、想定外の状態で処理を継続しない(`batch-writer.test.js`「rethrows a non-conflict error」でテスト済み)
- [x] スキップしたレコードは、件数だけでなくレコード番号一覧も結果表示する(`js/lib/batch-writer.js`の`buildResultSummary`、`js/bulk-summary.js`でRECORD_NUMBER型フィールドを検出して表示)

## 参照先アプリの権限不足時の扱い

- [x] 参照先アプリの閲覧権限が無いユーザーが実行した場合、`GET /k/v1/app/form/fields.json`相当の`referenceTable`設定が`null`になる(REST APIドキュメントに明記: 「参照先のアプリにレコード閲覧権限、レコード追加権限、アプリ管理権限のいずれもない場合は`null`が返る」)ため、`js/summary-service.js`の`computeRow`はこれを検出して例外を投げ、呼び出し元(submit時・詳細画面ボタン・一括集計のいずれも)で書き込みを中止する設計にしている(idea.md「実行前提」参照)
- [x] 一括集計では、対象レコードの集計(READ)を全件終えてから書き戻し(WRITE)を開始する2段階構成にしており、集計フェーズで例外が発生した場合は1件も書き戻さずに処理を中止する(`js/bulk-summary.js`の`runBulk`)

## グループ制限の限界(重要・idea.mdにも明記)

- [x] 一括集計ボタンの表示条件は`kintone.user.getGroups()`が設定画面で指定したグループコード(複数可、カンマ区切り)のいずれかを含むかどうかで判定している(`js/bulk-summary.js`の`renderButtonIfAuthorized`)
- [x] 上記はクライアント側の表示ゲートに過ぎず、真の権限境界ではないことをidea.md・config.htmlの設定画面本文の両方に明記済み。真の権限境界は参照先アプリ・自アプリ自体のkintoneレコード権限設定であり、それに依存する設計であることを明示している
- [x] `kintone.user.getGroups()`は一覧表示イベントごとに高々1回しか呼び出しておらず(レコード単位では呼び出していない)、ドキュメント記載のレート制限(50回/ユーザー/分)に抵触しない

## クロスサイトスクリプティング(XSS)・CSSインジェクション対策

- [x] `document.write`/`innerHTML`によるユーザー入力の動的HTML生成を行っていない。ラベル等の表示はすべて`textContent`(`config.js`の`buildOptions`)を使用。`innerHTML = ''`は既存要素のクリア用途のみで、ユーザー入力を挿入する用途では使っていない
- [x] `<template>`要素+`cloneNode`+`querySelector`でDOM構造を組み立てており(`html/config.html`)、ユーザー入力を直接HTML文字列として結合していない
- [x] 除外条件・グループコード等のユーザー入力は、kintoneのクエリ文字列(`js/lib/query-builder.js`が生成するクエリ)としてkintone REST APIに渡されるのみで、HTML要素として出力していない
- [x] 外部サイトのJavaScript/CSSを読み込んでいない(`manifest.json`はローカルファイルのみを参照)
- [x] プラグインの実行コード(js/css)に外部パッケージ・外部ライブラリを一切使用しない方針(vanilla JSのみ)。ビルド用の`@kintone/cli` / `eslint` / `@cybozu/eslint-config` / `jest` / `puppeteer`はローカル開発用のdevDependencyでありプラグイン本体には含まれない

## 通信・認証情報の取り扱い

- [x] kintone以外の外部サーバーへの通信を一切行わない(全通信は`kintone.api()`経由でkintone自身に対してのみ)
- [x] `kintone.plugin.app.setConfig()`に保存しているのはフィールドコード・集計種別・除外条件文字列・グループコードのみで、認証情報や機密情報は含まれない(`js/lib/config-store.js`)
- [x] `setProxyConfig()`は使用していない(外部認証情報を扱わない設計のため)

## リダイレクト

- [x] `window.location.href`に渡す値は`kintone.app.getId()`など信頼できる内部値のみで、外部入力を含まない(`config.js`の保存後・キャンセル時の画面遷移)

## 個別確認事項(利用ユーザーへ委ねる項目・Puppeteerによる実環境テストが今後必要な項目)

以下はPuppeteerによる実環境テストでもまだ検証できていない。今後の実装で確認するか、
公開後に利用ユーザーからのGitHub Issue報告で対応する。

- revision競合時の実際のエラーレスポンス(`code`/`message`)を実環境で確認し、`isRevisionConflictError`の判定条件が正しいか検証する(保存時トリガー・一括集計トリガー自体も実環境未検証。判断記録.md「8.」参照)
- 一覧画面の絞り込み条件に`like`/`not like`を含むキーワード検索が設定されていた場合の、カーソルAPIの10万件打ち切り・`X-Cybozu-Warning`ヘッダーの実際の挙動と、その際のユーザー体験(現状は警告の明示的な検知・表示までは実装していない)
- 条件フィールド(関連付けフィールド)がNUMBER型の場合、および「さらに絞り込む条件」に`or`を含む場合のクエリ組み立て(単体テストのみで実環境未検証。判断記録.md「8.」参照)
- `filterCond`に`LOGINUSER()`等の動的条件が含まれる場合の、一括集計実行者のコンテキストでの評価結果が意図通りか(idea.md「実装時の未決事項の暫定対応」参照)
- 参照先アプリの数値フィールドの表示形式(桁区切り・単位記号等)が、書き込み先フィールドへの反映(単純な数値文字列としての書き込み)で意図通りに扱われるか

問題があれば、公開サイトのリポジトリのGitHub Issueで報告してもらい対応する。
