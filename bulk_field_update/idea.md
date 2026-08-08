# 特定フィールド一括更新プラグイン(bulk_field_update)

レコード一覧画面のボタン押下で、設定画面であらかじめ指定した対象フィールドへ、**実行のたびに
確認ダイアログで入力した値**を、一覧画面の**現在の絞り込み条件**に一致する全レコードへ一括で
書き込むプラグイン。`age_grade_field_update`(年齢・学年フィールド計算用フィールド更新プラグイン)と
同じ設計方針(レコードカーソルAPIでの列挙・100件バッチ書き戻し・実行可能グループでのボタン表示制御・
`kintone.createDialog()`による編集可能な確認ダイアログ)を踏襲する。

## age_grade_field_updateとの違い(確定)

- 対象フィールド数: age_grade_field_updateは1フィールドのみ。本プラグインは**任意の複数フィールド**を
  対象にできる。
- 値の入力タイミング(確定・2026-08-08に方針転換): 当初は設定画面で「初期値」をあらかじめ
  固定するデザインを検討したが、**設定画面では対象フィールドのON/OFFのみを扱い、値は保存しない**
  方針に変更した。値は一覧画面のボタンを押すたびに、確認ダイアログの中の入力欄へその都度入力する
  (age_grade_field_updateの「今日の日付を初期値としつつ編集可能」をさらに進め、初期値自体を
  持たず常に空欄から入力させる)。
- 対象レコードの絞り込み: age_grade_field_updateは設定画面で固定したクエリ条件。
  本プラグインは**一覧画面の現在の絞り込み条件**(`kintone.app.getQueryCondition()`/
  `kintone.mobile.app.getQueryCondition()`)を使う(related_record_summaryの一括集計と同じ方式)。
  実行前の確認ダイアログにこのクエリ文字列をそのまま表示し、実行者が対象範囲を確認できるようにする。
- 必須フィールドのバリデーション(確定): 対象フィールドがkintoneのフォーム設定で必須(required)の
  場合、確認ダイアログでの入力も必須にする(空欄のまま実行しようとするとダイアログを閉じさせず
  エラーを表示する)。

## 対象フィールドの絞り込み(確定)

`kintone.app.getFormFields()`(JS API、CLAUDE.md方針3によりREST APIより優先。**一覧画面のボタン
押下時に対象フィールド定義を取得する処理も含め、REST APIではなく必ずこのJS APIを使う**)で取得した
フィールド定義から、次を対象外とする(`js/lib/field-eligibility.js`)。

- 値の取得・登録・更新ができない/システム管理のフィールド: レコード番号・作成者・作成日時・
  更新者・更新日時・計算・カテゴリー・ステータス・作業者・関連レコード一覧
  (kintoneドキュメントMCP「フィールド形式」の登録・更新可否表で確認済み)
- フォームを装飾するだけのフィールド: グループ(`getFormFields()`のpropertiesには含まれるが
  値を持たない)
- テーブル(SUBTABLE): ユーザーからの明示的な指定により対象外
- 組織選択・ユーザー選択・グループ選択: ユーザーからの明示的な指定により対象外
  (実在の組織/ユーザー/グループを選ぶ入力UIが必要になり実装が複雑になるための実務的な判断)
- 添付ファイル: 事前アップロードした`fileKey`が必要で、単純な文字列として入力できないため対象外
- ルックアップフィールド(`field.lookup`が設定されている): コピー元アプリからの自動転記と
  競合し得るため対象外(コピー先フィールドへの直接書き込みはコピー元との整合性を壊し得る)

## 選択肢系フィールドの値(確定)

- ラジオボタン・ドロップダウンは**必ず選択肢の中から選ぶ**(自由入力させない)。kintoneドキュメント
  MCP「フィールドの値を空に設定する場合」で、ラジオボタンは「空文字列を指定すると初期値が設定される」
  (=API経由で明示的に空にする方法が無い)ことを確認したため、ドロップダウンも含めて一貫して
  「必ず選択肢から選ぶ(空は許可しない)」仕様にした。フィールドの`required`設定に関わらず、
  常にこのルールを適用する(`js/lib/execution-validation.js`)。
- チェックボックス・複数選択は、0件選択の状態を許可する(`required`でなければ、対象フィールドを
  空にする正当な操作として扱う。ただし`required`の場合は必須バリデーションの対象になる)。
- 選択肢の値は`options`オブジェクトの**キー**を使う(表示ラベルではない)。表示ラベルは
  選択肢の名称変更で変わり得るが、キー自体はAPIでの登録・更新に使う識別子であるため。

## 対象フィールドの型ごとの確認ダイアログの入力欄・値の正規化(確定)

`js/lib/field-eligibility.js`の`inputKindOf()`で型を分類し、`js/bulk-update.js`が確認ダイアログの
中に対応する入力欄を組み立てる。書き戻し時の値の正規化は`js/lib/record-patch-builder.js`が担う
(kintoneドキュメントMCP「フィールドの値を空に設定する場合」で確認した、型ごとの空値の表現に合わせる)。

| 分類 | 対象型 | 確認ダイアログの入力欄 | 空欄時の書き込み値(非必須の場合) |
| :-- | :-- | :-- | :-- |
| SINGLE_CHOICE | ラジオボタン・ドロップダウン | `<select>`(選択必須、`required`に関わらず) | (該当なし、空欄禁止) |
| MULTI_CHOICE | チェックボックス・複数選択 | チェックボックス群 | `[]` |
| DATE | 日付 | `<input type="date">` | `null` |
| TIME | 時刻 | `<input type="time">` | `null` |
| DATETIME | 日時 | `<input type="datetime-local">`(ローカル時刻⇔UTC変換は`js/lib/datetime-local-codec.js`) | `''` |
| NUMBER | 数値 | `<input type="text">` | `''` |
| TEXTAREA | 文字列(複数行)・リッチエディター | `<textarea>` | `''` |
| TEXT | 文字列(1行)・リンク | `<input type="text">` | `''` |

対象フィールドが`required: true`の場合、上記の「空欄時」を許容せず、確認ダイアログの
`beforeClose`でOK確定時に検証し、空欄なら閉じさせずエラーメッセージを表示する
(`js/lib/execution-validation.js`の`validateTargetValues`)。

## 対象レコードの列挙とバッチ書き戻し(確定・age_grade_field_updateの実装を踏襲)

書き戻し先・列挙元が同じレコード集合であり、列挙中に他ユーザーの同時編集でレコードが増減する
リスクがあるため、`age_grade_field_update`/`related_record_summary`と同じ設計を踏襲する。

- `js/lib/cursor-enumerator.js`: レコードカーソルAPI(`POST`→`GET`を`next:false`まで繰り返す)で
  対象レコードを列挙する(既存プラグインと同一実装、名前空間のみ変更)。
- `js/lib/batch-writer.js`: `PUT /k/v1/records.json`を100件ずつのバッチで書き戻す。バッチ全体が
  失敗した場合のみ1件ずつの個別送信にフォールバックし、リビジョン競合(409相当)のレコードだけを
  スキップする(既存プラグインと同一実装、名前空間のみ変更)。
- カーソル作成時の`fields`パラメーターは`$id`・`$revision`・(あれば)レコード番号フィールドコードの
  みを指定する。書き込む値は確認ダイアログで確定した固定値であり対象フィールド自体の現在値は
  不要なため、対象フィールドはfieldsに含めない。
- 全レコードに対して**同一のrecordパッチ**(確認ダイアログでの入力確定後に1回だけ組み立てる)を
  適用する(レコードごとに異なる値を計算する必要が無いため、age_grade_field_updateより単純)。

## 確認ダイアログ・実行(確定)

- 対象レコード数はカーソルAPI作成時のレスポンス`totalCount`から得る(列挙前に確認ダイアログへ
  表示するため、レコード本体を取得する前に件数だけ知りたい)。
- 書き込む値は空欄から都度入力する入力欄として表示し、既定値は持たない。DATE型は
  `<input type="date">`、DATETIME型は`<input type="datetime-local">`のように、対象フィールドの
  型ごとに適切な入力欄を並べる(`js/bulk-update.js`の`buildConfirmDialogBody`)。
- ダイアログの本文(テキスト部分、`js/lib/build-confirm-message.js`)には対象レコード数と
  **現在の絞り込み条件(クエリ文字列そのもの)**を表示する。ユーザーからの要望「更新前に
  ダイアログでクエリを確認できるように」に対応する。
  - 実測(実環境): `kintone.app.getQueryCondition()`はURLの`?query=$id = 23`のような指定を
    そのまま返すのではなく、「レコード番号 = 23」のようにUI上の絞り込み表現へ正規化して返す
    (アプリコード未設定時はレコード番号=レコードIDのため、実質的に同じ絞り込みだが文字列としては
    書き換わる)。これはkintone側の挙動であり、本プラグインはそのまま表示するだけで補正しない。
- 書き込む値をHTML文字列として組み立てず、`document.createElement`/`textContent`のみで
  ダイアログ本文のDOMを構築する(secureCodingGuideline「外部からの入力値を使用した要素の生成を
  避ける」)。
- ダイアログは値の入力を伴うため、テキストのみの`kintone.showConfirmDialog()`/
  `kintone.mobile.showConfirmBottomSheet()`ではなく、本文をElementとして自由に組み立てられる
  `kintone.createDialog()`(PC)/`kintone.mobile.createBottomSheet()`(モバイル)を使う
  (age_grade_field_updateの2026-08-08改訂と同じ理由)。
- OK確定時(`beforeClose`)に、対象フィールドごとの入力値を`js/lib/execution-validation.js`で
  検証する。選択肢系フィールドの未選択、または`required`フィールドの空欄が1つでもあれば、
  ダイアログを閉じさせずエラーメッセージを表示する。
- 対象レコード0件の場合は確認ダイアログを出さず、その旨をalertで伝える。
- 実行中は`kintone.showLoading()`/`kintone.mobile.showLoading()`相当のローディング表示と、
  `beforeunload`でのページ離脱防止を行う。
- 完了後、`js/lib/batch-writer.js`の`buildResultSummary`で結果(対象件数・成功件数・
  リビジョン競合によるスキップ件数)をalert表示する。

## 実行可能グループによる表示制御(UI上の絞り込みに過ぎないことの明記)

`kintone.user.getGroups()`によるボタンの表示/非表示切り替えは、`age_grade_field_update`等と
同じく**UI上の絞り込みに過ぎず、真の権限境界ではない**。実際に書き込みできるかどうかは、
対象アプリ・対象フィールドのkintone標準のアクセス権設定に委ねられる(security-checklist.mdに明記)。

## 設定画面(確定)

`kintone.plugin.app.setConfig()`にのみ保存する。`kintone.app.getFormFields()`(JS API、CLAUDE.md
方針3)でフィールド一覧を取得し、対象にできるフィールドをテーブルで一覧表示する。**値はここでは
一切扱わない**(上記の通り、値は実行のたびに確認ダイアログで入力する)。

- 各行: 対象ON/OFFのチェックボックス・フィールド名(コード、`required`なら「必須」バッジ付き)・
  フィールド型。
- 実行可能グループコード(カンマ区切り、**最低1つ必須**)。0件のまま保存させると、保存はできるが
  ボタンが誰にも表示されず機能が使えない状態になってしまうため、age_grade_field_updateと同じく
  保存時バリデーションで弾く。
- 対象フィールドを1つ以上ONにしないと保存できない(何も対象にしない設定を保存させても
  意味が無いため)。

## 対応画面(確定・スコープ)

- PC: レコード一覧画面のみ(`app.record.index.show`、`kintone.app.getHeaderMenuSpaceElement()`)。
- モバイル: レコード一覧画面のみ(`mobile.app.record.index.show`、
  `kintone.mobile.app.getHeaderSpaceElement()`)。
- 詳細・作成・編集・印刷画面では何もしない。

## エッジケース

- 対象フィールドのフィールドコードがフォームから削除された、または対象外の型に変更された場合:
  そのフィールドは確認ダイアログの入力欄・recordパッチから除外される(`js/bulk-update.js`の
  `runBulk`、`kintone.app.getFormFields()`で都度突き合わせる)。対象フィールドが全滅した場合は
  ボタン押下時にエラーメッセージを表示して実行を中止する。
- クエリ条件(一覧画面の絞り込み)が不正(削除されたユーザー/組織/グループ/選択肢/ステータスを
  含む等): `kintone.app.getQueryCondition()`自体がエラーになり得る(kintoneドキュメントMCP
  「レコード一覧のクエリ文字列を取得する」の注意事項参照)。カーソル作成APIのエラーも含め、
  そのままエラーメッセージを表示して処理を中止する。
- 対象レコード0件: 確認ダイアログを出さず「対象レコードがありません」と通知して終了する。
- 必須フィールドが空欄のまま実行しようとした場合: ダイアログを閉じさせずエラー表示する
  (上記「確認ダイアログ・実行」参照)。
- 書き戻し中にリビジョン競合が発生したレコード: `batch-writer.js`の個別送信フォールバックで
  スキップし、結果表示にスキップ件数・レコード番号を含める(他のレコードの処理は継続する)。
- 対象フィールドの編集権限が無いユーザーが実行した場合: kintone側のフィールドアクセス権により
  書き込みAPI自体がエラーになる(想定内、そのままエラー表示して中止する)。

## TDD

`src/js/lib/`配下の純粋ロジックをJestでユニットテストする。

- `field-eligibility.js`: 対象外フィールドの判定・型ごとの入力欄分類。
- `execution-validation.js`: 確認ダイアログでの入力値の検証(選択肢系フィールドの未選択、
  `required`フィールドの空欄)。
- `record-patch-builder.js`: recordパッチの組み立て・型ごとの空値正規化。
- `config-store.js`: 設定(targetFieldCodes/groupCodes、値は含まない)の読み書きと既定値。
- `config-validation.js`: 対象フィールド0件・実行可能グループ0件のバリデーション。
- `build-confirm-message.js`: 対象件数・クエリを含む本文組み立て(値は含まない)。
- `datetime-local-codec.js`: `<input type="datetime-local">`用のローカル時刻文字列とkintoneの
  UTC ISO8601文字列の相互変換。
- `cursor-enumerator.js`/`batch-writer.js`: age_grade_field_updateと同一(カーソルAPIでの全件列挙、
  100件バッチ書き戻し、依存性注入)。

kintone依存のグルーコード(`js/desktop.js`・`js/mobile.js`・`js/config.js`・`js/bulk-update.js`、
確認ダイアログの構築・REST呼び出し)は`src/e2e/*.e2e.test.js`(Puppeteer)で実環境テストする。

## 実装

kintoneドキュメントMCPを参照しながら実装した。確認済み事項:

- `kintone.app.getFormFields()`のフィールド形式(`properties.フィールドコード.type`/`.options`/
  `.lookup`/`.required`等)、および各型の登録・更新可否・空値の表現(「フィールド形式」ページ)。
- `kintone.app.getQueryCondition()`(PC)/`kintone.mobile.app.getQueryCondition()`(モバイル)は
  同じ引数無し・同じ戻り値(絞り込み中のクエリ文字列、絞り込みなしは空文字列)であること。
  削除済みのユーザー/組織/グループ/選択肢/ステータスを含む場合はエラーになる注意事項、および
  `$id`指定のクエリが「レコード番号 = ...」に正規化されて返る実環境での挙動を確認済み。
- `kintone.createDialog()`(PC専用)/`kintone.mobile.createBottomSheet()`(モバイル専用)は
  同じ`config`引数の形(`body`はElement、`beforeClose`で閉じる前の値検証が可能)・同じ戻り値
  (`show()`が解決する`'OK'`/`'CANCEL'`/`'CLOSE'`/`'FUNCTION'`)であること。
- `PUT /k/v1/records.json`の制限事項(1件でも失敗すると全体がキャンセルされる)、
  レコードカーソルAPIの制限事項(同時10個まで・有効期限10分・作成自体5分でタイムアウト等)は
  age_grade_field_update/related_record_summaryで確認済みの内容を踏襲。

セキュアコーディングガイドラインでのリスクチェックは`security-checklist.md`を参照。
