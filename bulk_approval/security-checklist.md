# bulk_approval セキュリティチェックリスト

[secureCodingGuideline.md](../secureCodingGuideline.md)の一般項目(UTF-8/BOMなし・`'use strict'`・外部スクリプト不使用など、
[age_grade_field_update/security-checklist.md](../age_grade_field_update/security-checklist.md)等の他プラグインと共通の内容)は
重複記載を省略し、本プラグイン固有の項目のみ記載する。

最終確認日: 2026-08-13 / 対象: 実装レビューとJestユニットテスト(39件)。Puppeteerによる実環境テストは
`src/e2e/`参照(下記「個別確認事項」に実施状況を記載)。

## コーディング作法

- [x] 文字コードはUTF-8(BOMなし)
- [x] グローバル変数を作らず、`window.BulkApproval`という単一の名前空間オブジェクトのみを公開している(`js/lib/`配下・`js/bulk-approval.js`・`js/desktop.js`・`js/mobile.js`・`js/config.js`共通)
- [x] 既存のkintoneグローバルオブジェクトを書き換え・参照していない
- [x] `'use strict'`を全JSファイルの先頭で使用している
- [x] kintone内部のid/class属性・DOM構造に依存せず、JavaScript API(`kintone.app.getHeaderMenuSpaceElement()`, `kintone.mobile.app.getHeaderSpaceElement()`, `kintone.app.getStatus()`, `kintone.app.getFormFields()`)のみで要素・情報を取得している

## REST API利用

- [x] REST API呼び出しはすべて`kintone.api()`経由であり、生の`fetch`/`XHR`は使用していない(`js/bulk-approval.js`のみがREST APIを呼び出す)
- [x] URLは`kintone.api.url()`で組み立てている(secureCodingGuideline「URLの取得」)
- [x] CLAUDE.md方針3(JavaScript API優先)に従い、プロセス管理の設定取得は`kintone.app.getStatus()`(JS API)、対象フィールド定義の取得は`kintone.app.getFormFields()`(JS API)を使う。**対象レコードの取得もREST APIを使わない**(2026-08-13改訂: ユーザー指示により`GET /k/v1/records.json`によるREST検索を廃止し、`app.record.index.show`/`mobile.app.record.index.show`イベントの`event.records`をそのまま使う設計に変更。idea.md「対象レコードの取得」参照)。REST APIを使うのはステータス更新(`PUT /k/v1/records/status.json` / `PUT /k/v1/record/status.json`)のみで、これはプロセス管理のアクション実行がREST APIでしか行えないため(`kintone.app.record.getStatusActions()`はレコード詳細画面専用でレコード一覧からの一括操作には使えないことをkintoneドキュメントMCPで確認済み)
- [x] `event.records`は現在ページに表示されているレコードの配列で、一覧の列(カラム)設定に含まれていないフィールドの値も含めて全フィールド分のデータを持つ(`calendar_view`プラグインの実装で確認済みの挙動を踏襲し、本プラグインでも実機で改めて確認済み)。これにより表示対象フィールドの値取得にREST APIの`fields`パラメーターの組み立てが不要になっている
- [x] 短時間の大量リクエスト・並列実行を避ける方針(secureCodingGuideline「短時間で大量のリクエスト送信を避ける」「並列で実行するのをなるべく避ける」)に従い、ステータス更新のバッチ・個別フォールバックはすべて逐次処理(`js/lib/batch-writer.js`)で、`Promise.all`はレコード一覧画面表示時の`kintone.app.getFormFields()`/`kintone.app.getStatus()`の並列取得のみに限定している(いずれも読み取り専用でレート制限の影響が小さい呼び出し)

## プロセス管理APIの戻り値の形とassignee必須判定(実装前にkintoneドキュメントMCPで確認済み)

- [x] `kintone.app.getStatus()`の戻り値は、REST API「プロセス管理の設定を取得する」の`revision`を除いたものと**同様の値がそのまま返る**(`{ states: {...} }`のようにプロパティ名でラップされない)ことをkintoneドキュメントMCPで確認し、`js/bulk-approval.js`の呼び出し箇所にコメントを残している(CLAUDE.md「既知の落とし穴」)
- [x] `PUT /k/v1/records/status.json`実行時に`assignee`指定が必須になる条件(遷移先ステータスの作業者が「次のユーザーから作業者を選択」かつ選択可能なユーザーが存在する場合、または最初のステータスへ戻す場合)をREST APIドキュメントで確認し、該当するアクションはそもそも選択肢に出さない(`js/lib/status-actions.js`の`isAssigneeRequired`/`listExecutableActionNames`)。本プラグインは実行時に作業者を選ばせるUIを持たないため、assignee必須の遷移はセクションのアクション選択肢から除外するにとどめ、推測でassigneeを補って実行することはしない
- [x] モーダルはレコードを現在のステータスごとにグループ化して表示し(`js/lib/record-grouping.js`の`groupRecordsByStatus`)、グループ(=ステータス)ごとに1つのアクションを選ばせる設計にしたため、「現在のステータスに同名のアクションが複数設定されている場合エラーになる」というREST APIの制約(グループ内の全レコードが同一ステータスであり、そのステータスから見て一意なアクション名しか選択肢に出ないため、この制約に抵触しうる組み合わせ自体が発生しない)を構造的に回避している(`js/lib/record-grouping.test.js`でテスト済み)

## 書き戻し(PUT)時のエラー処理(他プラグインとの相違点)

- [x] `PUT /k/v1/records/status.json`も他の複数件書き込みAPIと同様「1件でも失敗するとリクエスト全体が失敗する」前提で設計し、バッチ送信が失敗した場合のみ`PUT /k/v1/record/status.json`で1件ずつ個別送信にフォールバックしている(`js/lib/batch-writer.js`、`age_grade_field_update`と同型)
- [x] **他プラグイン(`age_grade_field_update`等)との意図的な相違点**: 個別送信時、revision競合以外のエラー(権限不足・想定外のアクション実行条件不一致など)も「スキップして続行」の対象にしている(`writeChunkWithFallback`)。承認作業では「一部のレコードだけ他ユーザーに先に処理された」状況が正常な業務エラーとして起こりうるため、1件のエラーで全体を中断せず、実行できた分だけ進める設計を意図的に選んでいる(idea.md「実行」参照)。この結果、意図しない種類のエラー(ネットワークエラー等)もスキップ扱いになりうるが、結果表示にスキップ理由(`err.message`)を含めて利用者が判別できるようにしている
- [x] 実行完了後、成功件数・スキップ件数(理由付き)をalert表示する(`js/lib/batch-writer.js`の`buildResultSummary`)

## ボタンの表示制御について(意図的に「実行可能グループ」制御を持たず、代わりに一覧名で限定する)

- [x] 一覧画面ボタンの表示条件は、対象アプリでプロセス管理が有効かどうか(`kintone.app.getStatus().enable`)と、現在開いている一覧の名前(`event.viewName`)が、kintoneがプロセス管理有効化時に自動生成する標準の一覧名「（作業者が自分）」(全角括弧、`js/bulk-approval.js`の`SELF_ASSIGNED_VIEW_NAME`)と完全一致するかどうかで判定している(2026-08-13改訂。ユーザー指摘「作業者が自分以外でもボタンが出ちゃう」への対応)。この一覧名は[kintone公式ヘルプ](https://jp.kintone.help/k/ja/app/process/process_tips)で確認済みで、全角括弧である点を検証環境の`GET /k/v1/app/views.json`レスポンスで実際に確認している(ヘルプページのテキスト表示だけでは半角/全角の判別を誤りやすい落とし穴だった)
- [x] `kintone.user.getGroups()`によるグループ制限は行っていない(実行可能グループの撤廃はユーザーからの明示的な指示「一括承認は実行ユーザー絞らなくていい」に基づく意図的な設計であり、idea.md「ボタンの表示制御について」に理由を明記している)
- [x] 実行できるかどうかの真の権限境界は、ボタンを押した後の実際のアクション実行(`PUT /k/v1/records/status.json` / `PUT /k/v1/record/status.json`)時に、対象アプリのプロセス管理の設定(作業者・「作業者以外でも実行できるアクション」の実行可能ユーザー)へkintone自身が問い合わせて検証する。ボタンが誰にでも見える状態でも、実行権限のないユーザーが実行しようとすればkintone側がエラーを返すため、意図しない実行は起きない
- [x] `age_grade_field_update`/`bulk_field_update`のような「任意のフィールドへ任意の値を書き込む」プラグインとは異なり、本プラグインが実行するのはプロセス管理のアクションそのものであるため、フィールドアクセス権とは独立したクライアント側のユーザーグループ表示ゲートを追加する実益が薄いと判断した(idea.md参照)。一覧名による限定は「誰が」ではなく「どの画面で」ボタンを見せるかの制御であり、実行可能グループの撤廃とは矛盾しない

## エッジケースの扱い

- [x] 対象アプリでプロセス管理が無効な場合、一覧画面ボタン自体を表示しない(`renderButtonIfEligible`が`kintone.app.getStatus().enable`を確認)。実行時にも二重チェックしている(`runBulkApproval`)
- [x] 「（作業者が自分）」以外の一覧(カレンダー・カスタマイズ形式の一覧も含む)ではボタンを表示しない(`app.record.index.show`の`event.viewName`で判定)
- [x] 現在の一覧にレコードが0件(`event.records`が空)の場合はモーダルを開かず、`alert()`で「対象レコードがありません。」と通知して終了する
- [x] チェックボックスが0件、またはアクション未選択のまま「次へ」を押した場合は、`beforeClose`でダイアログを閉じさせず、エラーメッセージを表示する(`js/bulk-approval.js`)
- [x] コンフィグ削除後にフォームから消えたフィールドコードは、表示項目の解決時に無視する(`resolveDisplayFields`、エラーにしない)

## クロスサイトスクリプティング(XSS)・CSSインジェクション対策

- [x] `document.write`/`innerHTML`によるユーザー入力の動的HTML生成を行っていない。ステータスグループごとのセクション・レコード一覧テーブル・確認ダイアログの本文はすべて`document.createElement`/`textContent`で組み立てている(`js/bulk-approval.js`の`buildGroupSection`/`buildGroupTable`/`buildFinalConfirmBody`、`js/config.js`のチェックボックス一覧)。フィールド値・ステータス名・アクション名等のユーザー入力はいずれも`textContent`/`value`プロパティ経由でのみDOMに反映しており、HTML文字列として組み立てていない
- [x] 確認ダイアログ(`kintone.createDialog()`/`kintone.mobile.createBottomSheet()`)の`config.body`は、ドキュメントに「そのままダイアログ本文の要素として組み込まれるため必要に応じてサニタイズ処理を行うこと」と明記されている。本プラグインは上記の通り`createElement`/`textContent`のみでDOMを組み立てているため、サニタイズが必要な外部入力の混入経路は無い
- [x] 外部サイトのJavaScript/CSSを読み込んでいない(`manifest.json`はローカルファイルのみを参照)
- [x] プラグインの実行コード(js/css)に外部パッケージ・外部ライブラリを一切使用しない方針(vanilla JSのみ)。ビルド用の`@kintone/cli` / `eslint` / `@cybozu/eslint-config` / `jest` / `puppeteer`はローカル開発用のdevDependencyでありプラグイン本体には含まれない

## 通信・認証情報の取り扱い

- [x] kintone以外の外部サーバーへの通信を一切行わない(全通信は`kintone.api()`経由でkintone自身に対してのみ)
- [x] `kintone.plugin.app.setConfig()`に保存しているのは表示項目のフィールドコード一覧のみで、認証情報や機密情報は含まれない(`js/lib/config-store.js`)
- [x] `setProxyConfig()`は使用していない(外部認証情報を扱わない設計のため)

## リダイレクト

- [x] `window.location.href`に渡す値は`kintone.app.getId()`など信頼できる内部値のみで、外部入力を含まない(`js/config.js`の保存後・キャンセル時の画面遷移)

## 個別確認事項(利用ユーザーへ委ねる項目・Puppeteerによる実環境テストが今後必要な項目)

以下はまだPuppeteerによる実環境テストで検証できていない、または検証環境の制約上限定的にしか確認していない。
今後の実装で確認するか、公開後に利用ユーザーからのGitHub Issue報告で対応する。

- モバイル(`kintone.mobile.createBottomSheet()`経由)での一連の操作は未確認(PCのみ実環境確認)
- assignee必須と判定したレコードを実際に実行しようとした場合の、REST APIの実際のエラーメッセージ(本プラグインはクライアント側で事前に対象外としているため、通常はこの経路のエラーは発生しない想定だが、実行直前に他ユーザーがプロセス設定を変更した場合等のレースは考慮していない)
- revision競合時の実際のエラーレスポンス(`code`/`message`)を実環境で確認していない(本プラグインは競合以外のエラーも一律スキップ扱いにする設計のため、`age_grade_field_update`のような`isRevisionConflictError`ヒューリスティックは不要と判断し実装していない)
- アプリ管理者が「（作業者が自分）」一覧の名前を変更した場合の挙動は未検証(理論上はボタンが表示されなくなる。この一覧はkintoneの標準一覧のため通常は名前変更されない想定だが、実際に変更された場合のユーザー体験は公開後のフィードバックに委ねる)

問題があれば、公開サイトのリポジトリのGitHub Issueで報告してもらい対応する。
