# age_grade_field_update セキュリティチェックリスト

[secureCodingGuideline.md](../secureCodingGuideline.md)の一般項目([related_record_summary/security-checklist.md](../related_record_summary/security-checklist.md)等の他プラグインと共通の内容、UTF-8/BOMなし・`'use strict'`・外部スクリプト不使用など)は
重複記載を省略し、本プラグイン固有の項目のみ記載する。

最終確認日: 2026-08-08 / 対象: 実装レビューとJestユニットテスト(51件)。Puppeteerによる実環境テスト
(`src/e2e/config-screen.e2e.test.js`で設定画面の疎通・保存確認、`src/e2e/bulk-update-flow.e2e.test.js`で
一覧画面ボタン→確認ダイアログでの値編集→実行→実際のレコード書き込みまでの一連の流れをPCで確認)を
実施済み。モバイル側(`kintone.mobile.createBottomSheet()`)は未実施(下記「個別確認事項」参照)。

## コーディング作法

- [x] 文字コードはUTF-8(BOMなし)
- [x] グローバル変数を作らず、`window.AgeGradeFieldUpdate`という単一の名前空間オブジェクトのみを公開している(`js/lib/`配下・`js/bulk-update.js`・`js/desktop.js`・`js/mobile.js`・`js/config.js`共通)
- [x] 既存のkintoneグローバルオブジェクトを書き換え・参照していない
- [x] `'use strict'`を全JSファイルの先頭で使用している
- [x] kintone内部のid/class属性・DOM構造に依存せず、JavaScript API(`kintone.app.getHeaderMenuSpaceElement()`, `kintone.mobile.app.getHeaderSpaceElement()`)のみで要素を取得している

## REST API利用

- [x] REST API呼び出しはすべて`kintone.api()`経由であり、生の`fetch`/`XHR`は使用していない(`js/bulk-update.js`のみがREST APIを呼び出す)
- [x] URLは`kintone.api.url()`で組み立てている(secureCodingGuideline「URLの取得」)
- [x] CLAUDE.md方針3(JavaScript API優先)に従い、対象フィールドの選択肢・存在確認は`kintone.app.getFormFields()`(JS API)を使い、対象レコードの列挙(レコードカーソル)・書き戻しのみREST APIを使っている
- [x] 短時間の大量リクエスト・並列実行を避ける方針(secureCodingGuideline「短時間で大量のリクエスト送信を避ける」「並列で実行するのをなるべく避ける」)に従い、カーソルのページング・バッチ書き戻しはすべて逐次処理(`js/lib/cursor-enumerator.js`, `js/lib/batch-writer.js`)で、`Promise.all`等の並列実行は使用していない

## レコードカーソルAPI利用時の注意点(対象レコードの列挙)

対象レコードの列挙は`related_record_summary`の実装を踏襲し、レコードカーソルAPI(`POST /k/v1/records/cursor.json` → `GET /k/v1/records/cursor.json`)を使う(idea.md「対象レコードの列挙とバッチ書き戻し」)。実装前に`mcp__kintone-docs__get_page`で`/ja/kintone/docs/rest-api/records/create-cursor/`を確認済み。

- [x] `size`パラメーターは1〜500の範囲であることをドキュメントで確認済み、500を指定している(`js/bulk-update.js`の`createCursor`)
- [x] 同時に作成できるカーソルは1ドメイン10個までである旨を`js/bulk-update.js`にコメントで明記済み。本プラグインは1回の実行につき同時に1カーソルしか作成しない
- [x] カーソルの有効期限(最終アクセスから10分、作成自体は5分でタイムアウト)を踏まえ、`getCursor`のループは逐次実行にとどめている(`cursor-enumerator.js`)
- [x] `next: true`でも次のレスポンスの`records`が空になることがある点に対応し、ループの継続条件を`records.length`ではなく`next`で判定している(`cursor-enumerator.test.js`「keeps polling when next is true even if a page returns an empty records array」でテスト済み)
- [x] 全件取得完了でカーソルは自動削除されるが、途中で例外が発生した場合は`DELETE /k/v1/records/cursor.json`を呼び出して明示的に削除するようにしている(`cursor-enumerator.js`の`enumerateAll`、`deleteCursor`呼び出しとその失敗時のもみ消し処理をテスト済み)
- [x] `fields`パラメーターに`$id`・`$revision`・対象フィールドコード・(あれば)レコード番号フィールドコードのみを指定し、不要なフィールドを取得しないようにしている(`js/bulk-update.js`の`runBulk`。idea.md「対象レコードの列挙とバッチ書き戻し」)
- [x] 確認ダイアログ表示前に不要なレコード本体の取得(GET)を行わないよう、カーソル作成(POST)のPromiseをメモ化し、確認後の列挙で同じカーソルIDを使い回している(idea.md「確認ダイアログ・実行」)

## 書き戻し(PUT)時のrevision競合対応

- [x] `PUT /k/v1/records.json`は「1件でも失敗すると、そのリクエストに含めた全レコードの更新がキャンセルされる」仕様であることを踏まえ、100件バッチでの一括送信が失敗した場合のみ、そのバッチ内を1件ずつ`PUT /k/v1/record.json`で個別送信し直すフォールバック方式にしている(`js/lib/batch-writer.js`、`related_record_summary`と同一実装)
- [x] revision競合の判定(`isRevisionConflictError`)は、実環境のエラーレスポンスを未確認のため、既知の候補コード(`GAIA_CO02`)とメッセージ文言(「リビジョン」/「revision」を含む)によるヒューリスティック判定にとどめている(`related_record_summary`と同じ限界、下記「個別確認事項」参照)
- [x] 競合以外のエラー(権限エラー等)は競合として扱わずそのまま再スローし、想定外の状態で処理を継続しない(`batch-writer.test.js`「rethrows a non-conflict error」でテスト済み)
- [x] スキップしたレコードは、件数だけでなくレコード番号一覧も結果表示する(`js/lib/batch-writer.js`の`buildResultSummary`、`js/bulk-update.js`でRECORD_NUMBER型フィールドを検出して表示)
- [x] 「計算」フィールドはPUTで値を更新できない旨をREST APIドキュメントで確認済みだが、本プラグインの書き込み対象はDATE/DATETIMEのみのため無関係(idea.md「実装」参照)

## 現在の値のフォーマット(タイムゾーンの取り扱い)

- [x] DATE型は`Date`オブジェクトの**ローカルの**年・月・日から`YYYY-MM-DD`を組み立てており、`toISOString().slice(0, 10)`は使用していない(UTCとして切り出すため、UTCより西のタイムゾーンで夜間に実行すると1日ずれる誤りを回避。`current-value-formatter.js`、日付境界のケースをテスト済み)
- [x] DATETIME型は`toISOString()`(UTC ISO8601)からミリ秒部分のみを取り除いており、日時自体の変換は標準の`Date`変換に委ねている

## 実行可能グループによる表示制御の限界(重要・idea.mdにも明記)

- [x] 一覧画面ボタンの表示条件は`kintone.user.getGroups()`が設定画面で指定したグループコード(複数可、カンマ区切り)のいずれかを含むかどうかで判定している(`js/bulk-update.js`の`renderButtonIfAuthorized`)
- [x] 上記はクライアント側の表示ゲートに過ぎず、真の権限境界ではないことをidea.md・`html/config.html`の設定画面本文の両方に明記済み。真の権限境界は対象アプリ・対象フィールド自体のkintoneのアクセス権設定であり、それに依存する設計であることを明示している
- [x] `kintone.user.getGroups()`は一覧表示イベントごとに高々1回しか呼び出しておらず、ドキュメント記載のレート制限に抵触しない
- [x] 設定画面では実行可能グループを1件以上指定しないと保存できないバリデーションを追加している(`js/lib/config-validation.js`)。0件のまま保存させると誰にもボタンが表示されず機能が使えなくなるため、`related_record_summary`(任意)とは異なり必須にしている(idea.md「設定画面」で確定事項として明記)

## エッジケースの扱い

- [x] 対象フィールドのフィールドコードがフォームから削除された場合、またはDATE/DATETIME以外の型に変更された場合は、一覧画面ボタン自体を表示しない(`js/bulk-update.js`の`renderButtonIfAuthorized`、`kintone.app.getFormFields()`で都度存在確認)
- [x] クエリ条件が不正な場合はカーソル作成APIのエラーをそのまま表示して処理を中止し、推測でクエリを補正しない(`js/bulk-update.js`の`runBulk`)
- [x] 対象レコード0件の場合は確認ダイアログを出さず、`alert()`で「対象レコードがありません。」と通知して終了する(idea.md「確認ダイアログ・実行」)
- [x] 実行中は`beforeunload`でのページ離脱防止を行う(secureCodingGuideline「短時間で大量のリクエスト送信を避ける」への配慮、`related_record_summary`と同じ実装)

## クロスサイトスクリプティング(XSS)・CSSインジェクション対策

- [x] `document.write`/`innerHTML`によるユーザー入力の動的HTML生成を行っていない。ラベル等の表示はすべて`textContent`(`js/config.js`の`buildTargetFieldOptions`、`js/bulk-update.js`のボタンラベル)を使用。`innerHTML = ''`は既存要素のクリア用途のみ
- [x] 確認ダイアログ(`kintone.createDialog()`/`kintone.mobile.createBottomSheet()`)の`config.body`は、ドキュメントに「そのままダイアログ本文の要素として組み込まれるため必要に応じてサニタイズ処理を行うこと」と明記されている。本プラグインの`js/bulk-update.js`の`buildConfirmDialogBody`は`document.createElement`/`textContent`のみでDOMを組み立てており、ユーザー入力(クエリ条件・グループコード等)を`body`に含めていないため、サニタイズが必要な外部入力の混入経路は無い
- [x] クエリ条件・グループコード等のユーザー入力は、kintoneのクエリ文字列またはグループコード比較としてkintone REST API/JS APIに渡されるのみで、HTML要素として出力していない
- [x] 外部サイトのJavaScript/CSSを読み込んでいない(`manifest.json`はローカルファイルのみを参照)
- [x] プラグインの実行コード(js/css)に外部パッケージ・外部ライブラリを一切使用しない方針(vanilla JSのみ)。ビルド用の`@kintone/cli` / `eslint` / `@cybozu/eslint-config` / `jest` / `puppeteer`はローカル開発用のdevDependencyでありプラグイン本体には含まれない

## 通信・認証情報の取り扱い

- [x] kintone以外の外部サーバーへの通信を一切行わない(全通信は`kintone.api()`経由でkintone自身に対してのみ)
- [x] `kintone.plugin.app.setConfig()`に保存しているのは対象フィールドコード・クエリ条件文字列・グループコードのみで、認証情報や機密情報は含まれない(`js/lib/config-store.js`)
- [x] `setProxyConfig()`は使用していない(外部認証情報を扱わない設計のため)

## リダイレクト

- [x] `window.location.href`に渡す値は`kintone.app.getId()`など信頼できる内部値のみで、外部入力を含まない(`js/config.js`の保存後・キャンセル時の画面遷移)

## 個別確認事項(利用ユーザーへ委ねる項目・Puppeteerによる実環境テストが今後必要な項目)

以下はまだPuppeteerによる実環境テストで検証できていない。今後の実装で確認するか、公開後に利用ユーザーからの
GitHub Issue報告で対応する。

- revision競合時の実際のエラーレスポンス(`code`/`message`)を実環境で確認し、`isRevisionConflictError`の判定条件が正しいか検証する
- 一覧画面ボタンのクリックから確認ダイアログ表示・値の編集・実行・結果表示・実際の書き込みまでの一連の流れは、PCについてはPuppeteerで実環境確認済み(`src/e2e/bulk-update-flow.e2e.test.js`)。モバイル(`kintone.mobile.createBottomSheet()`経由)は未確認
- クエリ条件に`like`/`not like`を含むキーワード検索が設定されていた場合の、カーソルAPIの10万件打ち切り・`X-Cybozu-Warning`ヘッダーの実際の挙動(現状は警告の明示的な検知・表示までは実装していない)
- 対象フィールドの編集権限が無いユーザーが実行した場合の、PUT APIの実際のエラーメッセージとユーザー体験

問題があれば、公開サイトのリポジトリのGitHub Issueで報告してもらい対応する。
