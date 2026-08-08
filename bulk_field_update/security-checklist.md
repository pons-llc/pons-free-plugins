# bulk_field_update セキュリティチェックリスト

[secureCodingGuideline.md](../secureCodingGuideline.md)の一般項目([age_grade_field_update/security-checklist.md](../age_grade_field_update/security-checklist.md)等の他プラグインと共通の内容、UTF-8/BOMなし・`'use strict'`・外部スクリプト不使用など)は
重複記載を省略し、本プラグイン固有の項目のみ記載する。

最終確認日: 2026-08-09 / 対象: 実装レビューとJestユニットテスト(99件)。Puppeteerによる実環境テスト
(`src/e2e/config-screen.e2e.test.js`で設定画面の対象外フィールド除外・ルックアップフィールドが
種類欄で見分けられる形で対象に含まれること・必須バッジ・ON/OFF保存確認、
`src/e2e/bulk-update-flow.e2e.test.js`で一覧画面ボタン→1つ目のダイアログでの絞り込み条件表示・
必須バリデーション・「更新する」チェックを外したフィールドが変更されないこと→最終確認ダイアログでの
確定値の表示→実行→実際のレコード書き込みまでの一連の流れ、`src/e2e/lookup-refresh-flow.e2e.test.js`で
ルックアップフィールドを対象にした場合に確認ダイアログへ値の入力欄が出ないこと・実行後にコピー先
フィールドが関連レコードの最新値へ実際に更新されることをPCで確認)を実施済み。モバイル側
(`kintone.mobile.createBottomSheet()`)は未実施(下記「個別確認事項」参照)。

## コーディング作法

- [x] 文字コードはUTF-8(BOMなし)
- [x] グローバル変数を作らず、`window.BulkFieldUpdate`という単一の名前空間オブジェクトのみを公開している(`js/lib/`配下・`js/bulk-update.js`・`js/desktop.js`・`js/mobile.js`・`js/config.js`共通)
- [x] 既存のkintoneグローバルオブジェクトを書き換え・参照していない
- [x] `'use strict'`を全JSファイルの先頭で使用している
- [x] kintone内部のid/class属性・DOM構造に依存せず、JavaScript API(`kintone.app.getHeaderMenuSpaceElement()`, `kintone.mobile.app.getHeaderSpaceElement()`)のみで要素を取得している

## REST API利用

- [x] REST API呼び出しはすべて`kintone.api()`経由であり、生の`fetch`/`XHR`は使用していない(`js/bulk-update.js`のみがREST APIを呼び出す)
- [x] URLは`kintone.api.url()`で組み立てている(secureCodingGuideline「URLの取得」)
- [x] CLAUDE.md方針3(JavaScript API優先)に従い、対象フィールドの選択肢・存在確認は`kintone.app.getFormFields()`(JS API)、絞り込み条件の取得は`kintone.app.getQueryCondition()`/`kintone.mobile.app.getQueryCondition()`(いずれもJS API)を使い、対象レコードの列挙(レコードカーソル)・書き戻しのみREST APIを使っている
- [x] 短時間の大量リクエスト・並列実行を避ける方針(secureCodingGuideline「短時間で大量のリクエスト送信を避ける」「並列で実行するのをなるべく避ける」)に従い、カーソルのページング・バッチ書き戻しはすべて逐次処理(`js/lib/cursor-enumerator.js`, `js/lib/batch-writer.js`)で、`Promise.all`等の並列実行は使用していない

## レコードカーソルAPI利用時の注意点(対象レコードの列挙)

対象レコードの列挙は`age_grade_field_update`/`related_record_summary`の実装を踏襲し、レコードカーソルAPI(`POST /k/v1/records/cursor.json` → `GET /k/v1/records/cursor.json`)を使う(idea.md「対象レコードの列挙とバッチ書き戻し」)。

- [x] `size`パラメーターは1〜500の範囲であることをドキュメントで確認済み、500を指定している(`js/bulk-update.js`の`createCursor`)
- [x] 同時に作成できるカーソルは1ドメイン10個までである旨を`js/bulk-update.js`にコメントで明記済み。本プラグインは1回の実行につき同時に1カーソルしか作成しない
- [x] カーソルの有効期限(最終アクセスから10分、作成自体は5分でタイムアウト)を踏まえ、`getCursor`のループは逐次実行にとどめている(`cursor-enumerator.js`)
- [x] `next: true`でも次のレスポンスの`records`が空になることがある点に対応し、ループの継続条件を`records.length`ではなく`next`で判定している(`cursor-enumerator.test.js`でテスト済み)
- [x] 全件取得完了でカーソルは自動削除されるが、途中で例外が発生した場合は`DELETE /k/v1/records/cursor.json`を呼び出して明示的に削除するようにしている(`cursor-enumerator.js`の`enumerateAll`)
- [x] `fields`パラメーターに`$id`・`$revision`・(あれば)レコード番号フィールドコードのみを指定している。書き込む値は確認ダイアログで確定した固定値であり対象フィールド自体の現在値は不要なため、対象フィールドすらfieldsに含めない(age_grade_field_updateより踏み込んだ最小化。idea.md参照)
- [x] 確認ダイアログ表示前に不要なレコード本体の取得(GET)を行わないよう、カーソル作成(POST)のPromiseをメモ化し、確認後の列挙で同じカーソルIDを使い回している

## 書き戻し(PUT)時のrevision競合対応

- [x] `PUT /k/v1/records.json`は「1件でも失敗すると、そのリクエストに含めた全レコードの更新がキャンセルされる」仕様であることを踏まえ、100件バッチでの一括送信が失敗した場合のみ、そのバッチ内を1件ずつ`PUT /k/v1/record.json`で個別送信し直すフォールバック方式にしている(`js/lib/batch-writer.js`、age_grade_field_update/related_record_summaryと同一実装)
- [x] revision競合の判定(`isRevisionConflictError`)は、実環境のエラーレスポンスを未確認のため、既知の候補コード(`GAIA_CO02`)とメッセージ文言(「リビジョン」/「revision」を含む)によるヒューリスティック判定にとどめている(既存プラグインと同じ限界、下記「個別確認事項」参照)
- [x] 競合以外のエラー(権限エラー等)は競合として扱わずそのまま再スローし、想定外の状態で処理を継続しない(`batch-writer.test.js`でテスト済み)
- [x] スキップしたレコードは、件数だけでなくレコード番号一覧も結果表示する(`js/lib/batch-writer.js`の`buildResultSummary`)
- [x] 全レコードに対して同一のrecordパッチを使い回す設計のため、レコードごとに異なる計算を行わない(値の取り違えのリスクが構造的に無い)

## 対象フィールドの絞り込み・値の正規化・バリデーション

- [x] `kintone.app.getFormFields()`のレスポンスを基に、値の登録・更新ができないフィールド(レコード番号・作成者・作成日時・更新者・更新日時・計算・カテゴリー・ステータス・作業者・関連レコード一覧)、装飾用のグループ、テーブル、組織選択・ユーザー選択・グループ選択、添付ファイルを対象外にしている(`js/lib/field-eligibility.js`、kintoneドキュメントMCP「フィールド形式」で登録・更新可否を確認済み)
- [x] ルックアップの「ほかのフィールドのコピー」設定で**コピー先**に指定されているフィールド(`lookup.fieldMappings[].field`、コピー先フィールド自体は`.lookup`を持たないため型による判定だけでは除外できない)は対象外にしている。`js/lib/field-eligibility.js`の`collectLookupCopyDestinationCodes()`で全フィールドのlookup設定を走査してコピー先フィールドコードを集め、`listEligibleFields()`で除外する(`field-eligibility.test.js`でテスト済み)。設定画面(`js/config.js`)・実行時(`js/bulk-update.js`の`resolveTargetFields`)のいずれも同じ`listEligibleFields()`を使うため判定基準が一致している。REST APIドキュメント「1件のレコードを更新する」の制限事項でも、ルックアップ元からコピーされるフィールドは更新不可と明記されている
- [x] **(2026-08-09仕様変更)** ルックアップフィールド自体(`field.lookup`が設定されているフィールド)は対象フィールドに含めている。ただし通常のフィールドと異なり、確認ダイアログには値の入力欄を出さず(`FieldEligibility.inputKindOf()`が`'LOOKUP_REFRESH'`を返す)、書き戻し時は共有の固定パッチ値ではなく**レコードごとに、そのレコード自身が現在持っている値**をそのまま書き戻す(`js/bulk-update.js`の`runBulk`、カーソルで取得した`record[コード].value`を使用)。この挙動はkintone公式Tips「ルックアップの更新を自動で行う」で確認した「ルックアップフィールドへの書き込みがコピー先フィールドの自動転記を再実行させる」性質を利用したものであり、任意の値を書き込めるわけではない(常に自分自身の現在値のみ)ため、コピー元アプリとの整合性を壊すリスクは無い。`src/e2e/lookup-refresh-flow.e2e.test.js`で、コピー先フィールドが古い値のレコードに対して実行すると実際に関連レコードの最新値へ更新されることを実環境で確認済み
- [x] 選択肢系フィールド(ラジオボタン・ドロップダウン)の値には、`options`オブジェクトの**キー**(表示ラベルではなくAPIでの登録・更新に使う識別子)を使っている(`js/bulk-update.js`の確認ダイアログ入力欄構築)。表示ラベルが変更されてもキー自体は変わらないため、選択肢の名称変更で書き込み内容が変わってしまうことを防ぐ
- [x] 型ごとの空値の表現(日付/時刻はnull、チェックボックス/複数選択は`[]`、それ以外は`''`)をkintoneドキュメントMCP「フィールドの値を空に設定する場合」で確認し、`js/lib/record-patch-builder.js`の`normalizeValue`で正規化している(`record-patch-builder.test.js`でテスト済み)
- [x] ラジオボタン・ドロップダウンはAPI経由で明示的に空にする方法が無い(空文字列を指定すると初期値が設定される仕様)ため、フィールドの`required`設定に関わらず常に選択肢から値を選ばせている(`js/lib/execution-validation.js`、確認ダイアログのOK確定時=`beforeClose`で検証)
- [x] 対象フィールドがkintoneのフォーム設定で必須(`required: true`)の場合、確認ダイアログでの入力も必須にしている。空欄のまま実行しようとするとダイアログを閉じさせずエラーメッセージを表示する(`js/lib/execution-validation.js`の`validateTargetValues`、`execution-validation.test.js`でテスト済み)
- [x] 値そのものは設定画面(プラグイン設定として`kintone.plugin.app.setConfig()`に永続化される領域)には一切保存しない。実行のたびに確認ダイアログで入力し、その場でPUT APIへ渡すのみで終わる(`js/lib/config-store.js`は対象フィールドコードとグループコードのみを保存)
- [x] 1つ目のダイアログの「更新する」チェックを外したフィールドはrecordパッチから完全に除外し(`js/bulk-update.js`の`beforeClose`、`includedFields`でフィルタしてから`ExecutionValidation`・`RecordPatchBuilder`に渡す)、空文字列や既存値相当の値を明示的に書き込むような処理は行わない。kintoneのPUT APIはリクエストに含めないフィールドをそのまま変更しない仕様であるため、除外=不変更であることをAPI呼び出しレベルでも保証している
- [x] 実行前に「最終確認」ダイアログをもう1段階挟み、1つ目のダイアログで確定した値(選択肢はラベル表示に変換、`js/lib/value-summary.js`)を一覧で見直してからでないと実際の書き戻し(カーソル列挙・PUT)が始まらないようにしている(`js/bulk-update.js`の`showFinalConfirmDialog`)。最終確認ダイアログでキャンセルした場合は`beforeunload`ガードの有効化やレコードカーソルの列挙(GET)も一切行わない

## 実行可能グループによる表示制御の限界(重要・idea.mdにも明記)

- [x] 一覧画面ボタンの表示条件は`kintone.user.getGroups()`が設定画面で指定したグループコード(複数可、カンマ区切り)のいずれかを含むかどうかで判定している(`js/bulk-update.js`の`renderButtonIfAuthorized`)
- [x] 上記はクライアント側の表示ゲートに過ぎず、真の権限境界ではないことをidea.md・`html/config.html`の設定画面本文の両方に明記済み。真の権限境界は対象アプリ・対象フィールド自体のkintoneのアクセス権設定であり、それに依存する設計であることを明示している
- [x] `kintone.user.getGroups()`は一覧表示イベントごとに高々1回しか呼び出しておらず、ドキュメント記載のレート制限に抵触しない
- [x] 設定画面では対象フィールド・実行可能グループをそれぞれ1件以上指定しないと保存できないバリデーションを追加している(`js/lib/config-validation.js`)

## エッジケースの扱い

- [x] 対象フィールドがフォームから削除された、対象外の型に変更された、または新たにルックアップのコピー先に指定された場合、そのフィールドは確認ダイアログの入力欄自体を表示しない(`js/bulk-update.js`の`resolveTargetFields`が`kintone.app.getFormFields()`の最新値と`FieldEligibility.listEligibleFields()`で都度突き合わせて判定)。対象フィールドが全滅した場合はエラーメッセージを表示して実行を中止する
- [x] 一覧画面の絞り込み条件(`kintone.app.getQueryCondition()`)が削除済みのユーザー/組織/グループ/選択肢/ステータスを含みエラーになる場合、そのままエラーメッセージを表示して処理を中止する(推測でクエリを補正しない)
- [x] 対象レコード0件の場合は確認ダイアログを出さず、`alert()`で「対象レコードがありません。」と通知して終了する
- [x] 実行中は`beforeunload`でのページ離脱防止を行う(secureCodingGuideline「短時間で大量のリクエスト送信を避ける」への配慮)

## クロスサイトスクリプティング(XSS)・CSSインジェクション対策

- [x] `document.write`/`innerHTML`によるユーザー入力の動的HTML生成を行っていない。ラベル等の表示はすべて`textContent`(`js/config.js`の各行の描画、`js/bulk-update.js`のボタンラベル・確認ダイアログの各行)を使用。`innerHTML = ''`は既存要素のクリア用途のみ
- [x] 確認ダイアログ(`kintone.createDialog()`/`kintone.mobile.createBottomSheet()`)の`config.body`は、ドキュメントに「そのままダイアログ本文の要素として組み込まれるため必要に応じてサニタイズ処理を行うこと」と明記されている。`js/bulk-update.js`の`buildConfirmDialogBody`/各`build*Control`関数は`document.createElement`/`textContent`のみでDOMを組み立てており、ユーザー入力(対象フィールドの値そのもの)を`body`のHTML構造として解釈させる経路が無い(値は`<input>`/`<select>`要素の`.value`としてのみ保持される)
- [x] クエリ条件(一覧画面の絞り込み)・確認ダイアログで入力した値等のユーザー入力は、kintoneのクエリ文字列またはREST API/JS APIの値としてのみ使用し、HTML要素として出力していない
- [x] 外部サイトのJavaScript/CSSを読み込んでいない(`manifest.json`はローカルファイルのみを参照)
- [x] プラグインの実行コード(js/css)に外部パッケージ・外部ライブラリを一切使用しない方針(vanilla JSのみ)。ビルド用の`@kintone/cli` / `eslint` / `@cybozu/eslint-config` / `jest` / `puppeteer`はローカル開発用のdevDependencyでありプラグイン本体には含まれない

## 通信・認証情報の取り扱い

- [x] kintone以外の外部サーバーへの通信を一切行わない(全通信は`kintone.api()`経由でkintone自身に対してのみ)
- [x] `kintone.plugin.app.setConfig()`に保存しているのは対象フィールドコード・グループコードのみで、認証情報や機密情報は含まれない。書き込む値自体は保存せず実行のたびに入力するため、設定に値が残ることもない(`js/lib/config-store.js`)
- [x] `setProxyConfig()`は使用していない(外部認証情報を扱わない設計のため)

## リダイレクト

- [x] `window.location.href`に渡す値は`kintone.app.getId()`など信頼できる内部値のみで、外部入力を含まない(`js/config.js`の保存後・キャンセル時の画面遷移)

## 個別確認事項(利用ユーザーへ委ねる項目・Puppeteerによる実環境テストが今後必要な項目)

- revision競合時の実際のエラーレスポンス(`code`/`message`)を実環境で確認し、`isRevisionConflictError`の判定条件が正しいか検証する
- 一覧画面ボタンのクリックから確認ダイアログ表示・実行・実際の書き込みまでの一連の流れは、PCについてはPuppeteerで実環境確認済み(`src/e2e/bulk-update-flow.e2e.test.js`)。モバイル(`kintone.mobile.createBottomSheet()`経由)は未確認
- 絞り込み条件に`like`/`not like`を含むキーワード検索が設定されていた場合の、カーソルAPIの10万件打ち切り・`X-Cybozu-Warning`ヘッダーの実際の挙動(現状は警告の明示的な検知・表示までは実装していない)
- 対象フィールドの編集権限が無いユーザーが実行した場合の、PUT APIの実際のエラーメッセージとユーザー体験
- リッチエディター(RICH_TEXT)フィールドを対象にした場合、プレーンテキストとして入力した値がkintone側でどう扱われるか(HTMLタグを含まない文字列であれば単なるテキストとして表示される想定だが未検証)

問題があれば、公開サイトのリポジトリのGitHub Issueで報告してもらい対応する。
