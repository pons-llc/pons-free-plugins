# bulk_record_creation セキュリティチェックリスト

[secureCodingGuideline.md](../secureCodingGuideline.md)の一般項目([box_gdrive_iframe/security-checklist.md](../box_gdrive_iframe/security-checklist.md)等の他プラグインと共通の内容、UTF-8/BOMなし・`'use strict'`・外部スクリプト不使用など)は重複記載を省略し、本プラグイン固有の項目のみ記載する。

最終確認日: 2026-08-12 / 対象: 実装レビューとJestユニットテスト(90件、`src/js/lib/`配下)、Puppeteerによる実環境テスト(`src/e2e/`3ファイル、設定画面・対象者×日付の作成フロー・DATETIME時間帯分割フロー)。

## コーディング作法

- [x] グローバル変数を作らず、`window.BulkRecordCreation`という単一の名前空間オブジェクトのみを公開している(`js/lib/`配下・`js/bulk-create.js`・`js/desktop.js`・`js/mobile.js`・`js/config.js`共通)
- [x] 既存のkintoneグローバルオブジェクトを書き換え・参照していない
- [x] kintone内部のid/class属性・DOM構造に依存せず、JavaScript API(`kintone.app.getHeaderMenuSpaceElement()`, `kintone.mobile.app.getHeaderSpaceElement()`)のみで要素を取得している

## REST API・User API利用

- [x] REST API/User APIの呼び出しはすべて`kintone.api()`経由であり、生の`fetch`/`XHR`は使用していない(`js/bulk-create.js`のみがAPI呼び出しを行う)
- [x] URLは`kintone.api.url()`で組み立てている(secureCodingGuideline「URLの取得」)
- [x] CLAUDE.md方針3(JavaScript API優先)に従い、フィールド一覧・種類の取得は`kintone.app.getFormFields()`(JS API)を使っている。ユーザー/組織/グループの一覧・所属メンバー取得はJavaScript APIに相当する手段が無い(`kintone.user.getGroups()`等は「ログインユーザー自身」の所属しか取得できず、対象者ピッカーに必要な「全ユーザー/全組織/全グループの一覧」「任意の組織/グループの所属メンバー」は取得できない)ため、REST API(User API)を`kintone.api()`経由で使用している。「kintone REST APIリクエストを送信する」のドキュメントで`kintone.api()`がUser APIも実行できることを確認済み(idea.md「実装で確認した仕様」)
- [x] レコード作成は`POST /k/v1/records.json`のみを使用し、REST APIで代替できないJavaScript APIは無いことを確認済み(レコード作成のJavaScript APIは存在しない)
- [x] 短時間の大量リクエスト・並列実行を避ける方針(secureCodingGuideline「短時間で大量のリクエスト送信を避ける」「並列で実行するのをなるべく避ける」)に従い、以下をすべて逐次処理(for...of/while、`Promise.all`等の並列実行は不使用)にしている
  - ユーザー/組織/グループ一覧のoffset/sizeページング(`js/bulk-create.js`の`fetchAllPages`)
  - 選択した組織/グループごとの所属メンバー取得(`fetchOrganizationMembers`/`fetchGroupMembers`の呼び出しループ)
  - レコード作成の100件バッチ送信(`js/lib/batch-creator.js`の`createAll`、`batch-creator.test.js`の「バッチを並列ではなく逐次で送信する」でテスト済み)

## レコード一括作成(POST)の挙動

- [x] `POST /k/v1/records.json`は1回最大100件で、**バッチ内で1件でも失敗すると、そのバッチに含めたレコードの登録はすべてキャンセルされる**(kintoneドキュメントMCP「複数のレコードを登録する」補足で確認済み)。`bulk_field_update`のPUTのような1件ずつのフォールバックは行わず、失敗したバッチはそのままFAILUREとして記録し、後続のバッチの送信は継続する(`js/lib/batch-creator.js`、先行して成功したバッチの内容は残る)
- [x] 実行結果は「何件目〜何件目の作成に失敗したか」を含めて`alert()`で表示し(`buildResultSummary`)、利用者が実際に作成されたレコードの範囲を把握できるようにしている
- [x] 生成予定件数が上限(`js/lib/record-count-estimator.js`の`DEFAULT_MAX_RECORDS`、500件)を超える場合は確認ダイアログの`beforeClose`でエラーとし、実行自体をブロックする(secureCodingGuideline「短時間で大量のリクエスト送信を避ける」を踏まえた安全弁、idea.md「生成されるレコード数(直積)」)
- [x] 作業者(STATUS_ASSIGNEE)・ステータス・カテゴリー・計算・ルックアップ元コピー・自動計算文字列1行はテンプレート対象フィールドの選択肢に出さない(`js/lib/field-eligibility.js`、REST APIドキュメントの制限事項・登録可否表で確認済み)

## 対象者(ユーザー/組織/グループ)展開

- [x] 対象者フィールド(USER_SELECT/ORGANIZATION_SELECT/GROUP_SELECT)は設定画面で1つだけ選択でき、テンプレート対象フィールドのチェックボックス一覧には出さない(`js/lib/field-eligibility.js`のENTITY_SELECT_TYPES除外)。対象者フィールドの型と、実行時に選べる展開方法(組織絞り込み後の個別選択/組織メンバー全員展開/グループメンバー全員展開 for USER_SELECT、組織単位 for ORGANIZATION_SELECT、グループ単位 for GROUP_SELECT)を一致させることで、書き込み値の型不整合が起きない設計にしている(`js/bulk-create.js`の`buildAssigneeSection`)
- [x] USER_SELECT/ORGANIZATION_SELECT/GROUP_SELECTの登録時の値は`{ value: [{ code }] }`(kintoneドキュメントMCP「フィールド形式」で確認済み)。`js/lib/record-payload-builder.js`はcodeのみを書き込み、UI表示用の`name`はAPIペイロードに含めない
- [x] 組織/グループのメンバー展開で、複数の組織/グループにまたがって所属する同一ユーザーが選ばれた場合、レコードが重複して作成されないようユーザーコードで重複除去している(`js/lib/assignee-normalizer.js`の`dedupeByCode`、`assignee-normalizer.test.js`でテスト済み)
- [x] 対象者を1人も選ばずに実行することはできない(対象者フィールドを設定している場合、確認ダイアログの`beforeClose`で対象者0件をエラーにする)
- [x] **(2026-08-12改訂)** USER_SELECT型での個別選択は、`/v1/users.json`による環境の全ユーザー一覧表示をやめ、`js/bulk-create.js`の`buildScopedUserPicker`で「組織を選んで絞り込んでから、その所属メンバーの中から選ぶ」2段階UIにした(ユーザーからのフィードバック「全ユーザーが一覧表示されると使いづらい・大規模環境で重い」に対応)。組織を1件も選んでいない状態ではユーザー一覧そのものを取得・表示しない
- [x] 組織選択(対象者フィールド=ORGANIZATION_SELECTの直接選択・「組織を選んで所属ユーザーに展開」・上記の絞り込みモードのいずれも共通)は、`parentCode`による親子階層をツリー表示する`buildOrganizationPicker`を使っている(ユーザーからのフィードバック「大きな組織もあるので階層式で選べるように」)。フラットな一覧に大量の組織が並ぶことを避け、絞り込みキーワードに一致するノードは祖先ノードごと自動展開する

## 繰り返し(定例)日程展開

- [x] 日付展開ロジック(`js/lib/recurrence-expander.js`)はkintoneに依存しない純粋関数としてJestで単体テストしている(毎日/毎週(複数曜日)/毎月(複数日付指定)、終了条件(回数/終了日)、存在しない日(2/30等)のスキップを含む18件のテスト)
- [x] 無限ループ対策として、日送り探索に約20年分の上限(`MAX_DAY_STEPS`)を設けている(終了条件が正しく機能していれば到達しない保険的な上限)
- [x] 開始日・展開結果の日付はいずれもタイムゾーン変換を行わない単純な暦日文字列(`YYYY-MM-DD`)として扱い、`<input type="date">`の値とkintoneのDATEフィールド値の形式(いずれも`YYYY-MM-DD`)がそのまま一致するようにしている(ローカルタイムゾーンによるズレが発生しない)
- [x] 時刻展開ロジック(`js/lib/time-slot-expander.js`)も同様にkintoneに依存しない純粋関数としてJestで単体テストしている(終了時刻を含まない境界・間隔で割り切れない場合の打ち切り・不正な時刻/間隔のバリデーションを含む7件のテスト)。生成する時刻の範囲は1日(1440分)以内で、`intervalMinutes`は1以上の整数のみ許可するため反復回数は最大1440回に収まり、無限ループのリスクは無い
- [x] DATETIME型の繰り返し用フィールドで日付×時刻を組み合わせる際、`js/lib/datetime-local-codec.js`の`encodeDatetimeLocal`(テンプレート対象のDATETIME型フィールドと共通のロジック)でローカル日時文字列をUTCのISO8601文字列に変換してから書き込んでいる。最終確認ダイアログのプレビューには変換前のローカル表記(`labels`)を、実際のAPI送信には変換後のUTC表記(`values`)を使い分けており、両者を混同しない(`js/bulk-create.js`の`buildRecurrenceSection`の`getValues()`)
- [x] 終了日時フィールド(任意、DATETIME型のみ)は、対象者×日付のような独立した直積の次元を増やさず、開始日時と同じ添字で対になった値として書き込む(`js/lib/record-payload-builder.js`の`dates.endFieldCode`/`endValues`、`record-payload-builder.test.js`でテスト済み)。時間帯を一定間隔で分割するモードでは、終了時刻は開始時刻+間隔として`js/lib/time-slot-expander.js`の`shiftTime()`で自動計算し、利用者が別途入力する項目を増やさない設計にしている。`shiftTime()`は結果が24:00を超える場合(日をまたぐ枠)を例外にしてブロックする

## 対象フィールドの絞り込み・値の正規化・バリデーション

- [x] `kintone.app.getFormFields()`のレスポンスを基に、値の登録ができないフィールド・装飾用のグループ・テーブル・添付ファイルを対象外にしている(`js/lib/field-eligibility.js`、kintoneドキュメントMCP「フィールド形式」で登録可否を確認済み)
- [x] **ルックアップフィールドは型を問わず常にテンプレート対象外**にしている。`bulk_field_update`は既存レコードの「現在の値をそのまま書き戻す」ことでルックアップの自動転記を再利用できたが、本プラグインは新規作成のため「現在の値」という概念が存在せず、任意の値を書き込むとルックアップ元アプリとの整合性が壊れるリスクがあるための安全側の判断(`field-eligibility.test.js`でテスト済み)
- [x] 選択肢系フィールド(ラジオボタン・ドロップダウン)の値には、`options`オブジェクトの**キー**(表示ラベルではなくAPIでの登録に使う識別子)を使っている(`js/bulk-create.js`の`buildSingleChoiceControl`)
- [x] 対象フィールドがkintoneのフォーム設定で必須(`required: true`)の場合、確認ダイアログでの入力も必須にしている。空欄のまま実行しようとするとダイアログを閉じさせずエラーメッセージを表示する(`js/bulk-create.js`の`beforeClose`、各コントロールの`isEmpty`判定)
- [x] 値そのものは設定画面(`kintone.plugin.app.setConfig()`)には一切保存しない。実行のたびに確認ダイアログで入力し、その場でPOST APIへ渡すのみで終わる(`js/lib/config-store.js`は対象者/日付フィールドコード・テンプレート対象フィールドコード・グループコードのみを保存)

## 実行可能グループによる表示制御の限界

- [x] 一覧画面ボタンの表示条件は`kintone.user.getGroups()`が設定画面で指定したグループコードのいずれかを含むかどうかで判定している(`js/bulk-create.js`の`renderButtonIfAuthorized`)
- [x] 上記はクライアント側の表示ゲートに過ぎず、真の権限境界ではないことをidea.md・`html/config.html`の設定画面本文の両方に明記済み。真の権限境界は対象アプリのレコード追加権限・フィールド編集権限であり、それに依存する設計であることを明示している
- [x] 設定画面ではテンプレート対象フィールド・実行可能グループをそれぞれ1件以上指定しないと保存できないバリデーションを追加している(`js/lib/config-validation.js`)。対象者フィールド・繰り返し用日付フィールドは任意項目のため検証対象にしていない

## クロスサイトスクリプティング(XSS)・CSSインジェクション対策

- [x] `document.write`/`innerHTML`によるユーザー入力の動的HTML生成を行っていない。ラベル等の表示はすべて`textContent`(`js/config.js`の各行の描画、`js/bulk-create.js`の対象者ピッカーの行・確認ダイアログの各行)を使用。`innerHTML = ''`は既存要素のクリア用途のみ(`js/bulk-create.js`の`renderList`、`js/config.js`の`renderTemplateRows`)
- [x] 確認ダイアログ(`kintone.createDialog()`/`kintone.mobile.createBottomSheet()`)の`config.body`は、ドキュメントに「そのままダイアログ本文の要素として組み込まれるため必要に応じてサニタイズ処理を行うこと」と明記されている。`js/bulk-create.js`の各`build*`関数は`document.createElement`/`textContent`のみでDOMを組み立てており、ユーザー入力(テンプレート値・ユーザー/組織/グループの名前やコード)を`body`のHTML構造として解釈させる経路が無い(値は`<input>`/`<select>`要素の`.value`、または`textContent`としてのみ保持される)
- [x] User APIから取得したユーザー/組織/グループの`name`はすべて`textContent`/`document.createTextNode`でのみ表示しており、HTML要素として出力していない
- [x] 外部サイトのJavaScript/CSSを読み込んでいない(`manifest.json`はローカルファイルのみを参照)
- [x] プラグインの実行コード(js/css)に外部パッケージ・外部ライブラリを一切使用しない方針(vanilla JSのみ)。ビルド用の`@kintone/cli` / `eslint` / `@cybozu/eslint-config` / `jest` / `puppeteer`はローカル開発用のdevDependencyでありプラグイン本体には含まれない

## 通信・認証情報の取り扱い

- [x] kintone以外の外部サーバーへの通信を一切行わない(全通信は`kintone.api()`経由でkintone自身/cybozu.com共通のUser APIに対してのみ)
- [x] `kintone.plugin.app.setConfig()`に保存しているのはフィールドコード・グループコードのみで、認証情報や機密情報は含まれない。テンプレート値・対象者の選択結果自体は保存せず実行のたびに入力/選択するため、設定に個人情報が残ることもない(`js/lib/config-store.js`)
- [x] `setProxyConfig()`は使用していない(外部認証情報を扱わない設計のため)

## リダイレクト

- [x] `window.location.href`に渡す値は`kintone.app.getId()`など信頼できる内部値のみで、外部入力を含まない(`js/config.js`の保存後・キャンセル時の画面遷移)

## レコード作成時の必須フィールド(実環境で確認済み)

- [x] フォーム内の他の必須フィールド(対象者/日付/テンプレート対象のいずれにも含まれていないもの)がある場合、`POST /k/v1/records.json`はそのフィールドが初期値(空)のまま送信され、kintone側のバリデーション(`CB_VA01`)でバッチ全体が失敗することを実環境で確認した(idea.md「エッジケース」参照、`bulk_field_update`のPUT更新とは異なり新規作成ではフォーム上の必須フィールドをすべて埋める必要がある)。設定画面(`html/config.html`)にこの制約を明記する注意書きを追加している。エラー発生時も`js/lib/batch-creator.js`がバッチ単位で失敗を検知し、`buildResultSummary`でエラーメッセージ(`CB_VA01`のmessage)をそのまま利用者に提示するため、原因不明のまま失敗することはない

## 個別確認事項(利用ユーザーへ委ねる項目・Puppeteerによる実環境テストが今後必要な項目)

- User API(`/v1/organizations.json`等)の呼び出しに実際に必要な権限(ドキュメント上は「必要なアクセス権: なし」だが、ゲストスペースメンバーやcybozu.comの管理設定によって挙動が変わる可能性がある)を実環境で確認する
- 全組織/全グループ数が多い環境(例: 数千件規模)で、`fetchAllPages`の逐次ページングと組織ツリー・チェックボックス一覧の描画がどの程度の待ち時間になるか(パフォーマンスの上限は未検証。全ユーザーの一覧表示は「組織で絞り込んでユーザーを選択」モードへの変更〈2026-08-12〉で解消済みだが、組織/グループ自体の件数が非常に多い環境は未検証。将来的に必要であれば仮想スクロール等の改善を検討する)
- 一覧画面ボタンのクリックから確認ダイアログ表示・最終確認・実際のレコード作成までの一連の流れは、PCはPuppeteerでの実環境確認済み(`src/e2e/bulk-create-flow.e2e.test.js`・`time-slot-flow.e2e.test.js`)。モバイル(`kintone.mobile.createBottomSheet()`経由)は未確認
- 対象アプリのレコード追加権限・フィールド編集権限が無いユーザーが実行した場合の、POST APIの実際のエラーメッセージとユーザー体験
- 組織/グループの所属メンバー展開(`/v1/organization/users.json`・`/v1/group/users.json`)で、退職者・無効化されたユーザー(`valid: false`)が含まれた場合の扱い(現状は除外せずそのまま対象者に含める)
- 組織階層(`parentCode`)が循環参照や極端に深い階層になっている場合の`buildOrganizationPicker`の挙動(通常のkintone環境では発生しない想定だが未検証)

問題があれば、公開サイトのリポジトリのGitHub Issueで報告してもらい対応する。
