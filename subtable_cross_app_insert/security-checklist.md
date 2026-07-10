# subtable_cross_app_insert セキュリティチェックリスト

[secureCodingGuideline.md](../secureCodingGuideline.md)の一般項目(UTF-8/BOMなし・名前空間分離・`'use strict'`・
外部スクリプト不使用などは`fiscal_year_numbering/security-checklist.md`と同様に満たしている)は重複記載を省略し、
本プラグイン固有の項目のみ記載する。

最終確認日: 2026-07-09 / 対象: 初回実装時点

## クロスサイトスクリプティング(XSS)・`kintone.createDialog()`のサニタイズ

- [x] `kintone.createDialog()`の`config.body`は「そのままダイアログ本文の要素として組み込まれ、必要に応じて
      サニタイズ処理を行うこと」と公式ドキュメントに明記されている。本プラグインの`js/manual-dialog.js`
      (`buildDialogBody`)は、行のプレビュー文字列を含むすべての表示要素を`document.createElement` +
      `textContent`で組み立てており、`innerHTML`は一切使用していない。
- [x] `buildRowSummaryParts()`が読み取るサブテーブルの値は自アプリのレコードデータ(他ユーザーが入力した
      可能性のある文字列)だが、`textContent`経由でのみDOMに反映するため、`<script>`や`onerror=`等を
      埋め込まれてもHTMLとして解釈されない。
- [x] `js/desktop.js`の手動転送ボタンはテンプレート文字列やinnerHTMLではなく、`document.createElement('button')`
      + `textContent`で生成している。スペースフィールド要素への挿入前に`spaceEl.innerHTML = ''`で
      クリアしているが、これは自プラグインが生成した空文字列のクリアであり外部入力を書き込むものではない。

## REST API呼び出しは`kintone.api()`のみ

- [x] 転送先アプリへのUPSERT(`PUT /k/v1/records.json`)、自レコードへの成功時アクション書き込み
      (`PUT /k/v1/record.json`)、設定画面での転送先フィールド一覧取得(`GET /k/v1/app/form/fields.json`)は
      すべて`kintone.api()`(`kintone.api.url(path, true)`でURLを解決)経由で呼び出しており、生の
      `fetch`/`XHR`は使用していない(`js/rest-client.js`, `js/config.js`)。CLAUDE.md方針3
      (JavaScript APIをREST APIより優先)にしたがい、サブテーブル・フォームの読み取りは
      `kintone.app.getFormFields()`等のJavaScript APIを使い、クロスアプリのレコード書き込みという
      JavaScript APIで実現できない操作にのみRESTを用いている。
- [x] UPSERTリクエストは`for...of`で逐次実行しており、並列に大量のリクエストを送信していない
      (`js/rest-client.js`の`pushRows`)。kintoneセキュアコーディングガイドライン
      「短時間で大量のリクエスト送信を避ける」「並列で実行するのをなるべく避ける」に準拠。

## プラグイン設定に認証情報を保存しない

- [x] 本プラグインはユーザー自身のセッション(`kintone.api()`)のみで動作し、外部サービスとの連携や
      APIトークンの利用は一切ない。`kintone.plugin.app.setConfig()`に保存する値は、転送先アプリID・
      フィールドコード・条件式・スペース要素IDなど、いずれも「設定情報」であり認証・認可情報ではない
      (secureCodingGuideline.mdの「推奨しない保存先」に抵触しない)。
- [x] 設定画面で転送先アプリのフィールド一覧を取得する際も、設定画面を開いている管理者自身のセッションで
      `kintone.api()`を呼び出しており、別途の認証情報を発行・保存する設計にはなっていない。

## 発動条件エンジン(`condition-engine.js`)の入力値検証

- [x] `evaluate()`は未知の演算子を渡された場合、例外を投げず「一致しない」(`false`)を返す設計にしている
      (`js/lib/condition-engine.js`の`evaluateClause`)。設定データが将来のバージョン変更や手動編集で
      壊れていても、画面をクラッシュさせたり意図せず条件を素通りさせたりしない安全側の実装。
- [x] `record`や`node`が`null`/`undefined`、あるいは対象フィールドが存在しない場合でも、空文字列/空配列
      として扱い例外を投げない(`condition-engine.test.js`でカバー)。
- [x] 条件ツリー自体が未設定(`null`/`undefined`)の場合は「常に発動」として扱う(`config-store.js`の
      デフォルト値`{ type: 'group', conditionOperator: 'AND', children: [] }`と合わせて、
      「条件を1つも設定していない = 常に転送する」という一貫した挙動になる)。
- [x] 条件の値(`clause.value`)は比較にのみ使い、DOMやRESTクエリ文字列に直接埋め込むことはない
      (`OPERATORS`内で`String()`/`Number()`変換のみを行う)ため、条件値経由でのインジェクションは
      発生しない。

## UPSERT・更新キーの整合性

- [x] 更新キー(`updateKey`)は転送先アプリの重複禁止設定済みフィールドを前提とする設計であり、設定画面の
      説明文(`html/config.html`)にその旨を明記している。ただし、実際に転送先フィールドが重複禁止設定に
      なっているかどうかをプラグイン側から検証する手段はなく(フィールド設定REST APIのレスポンスで
      判定は可能だが本フェーズでは未実装)、設定ミスがあった場合はkintone側のUPSERT実行時にエラーとして
      返る想定(REST呼び出しの`try/catch`でエラーメッセージを表示し、保存を中止する)。
- [x] `js/lib/field-mapping.js`の`buildDestinationFields`は、更新キーの転送先フィールド値を常に
      サブテーブル列の値から再計算して上書きする設計にしており、`fieldMappings`の設定ミスで
      更新キー値とマッピング値が食い違う事態を避けている。

## 転送失敗時の扱い(重複転送・部分失敗)

- [x] 更新キーによるUPSERTを必須設定にすることで、同一レコードを複数回保存しても行が二重登録されない
      (`idea.md`の「転送失敗時の扱い」参照。plugin_idea_plan.mdで確定済みの仕様)。
- [x] 保存(submit)時の転送失敗は`event.error`で保存自体を中止し、「保存済みだが転送されていない」
      状態を防ぐ(plugin_idea_plan.mdで確定済みの仕様、`js/desktop.js`の`handleSubmit`)。
- [ ] 100件ずつに分割されたリクエストの一部失敗時、先行して成功した分のロールバックは行わない
      (`js/rest-client.js`のエラーメッセージに成功済み件数を含めて利用者に伝えるのみ)。
      plugin_idea_plan.mdの「未決事項」として明記済みの既知の制約であり、本フェーズでは対応しない。

## 個別確認事項(利用ユーザーへ委ねる項目、判断記録.md参照)

- 手動転送ボタンの設置に、スペースフィールドを事前に配置してもらう運用が許容できるか(判断記録.md 1)
- 手動転送ボタンを詳細画面のみに限定したことの是非(判断記録.md 2)
- 手動転送ダイアログのUI統合(一括/選択を1つのチェックボックス一覧に統合)の是非(判断記録.md 3)
- 発動条件のフラットUI(AND/ORの1階層のみ)で十分か(判断記録.md 4)
- 設定画面で転送先アプリの閲覧権限が必要になる制約が許容できるか(判断記録.md 5)
- 転送成功時アクションの書き込み先フィールド型の制限で十分か(判断記録.md 6)
- 手動転送後に画面全体をリロードするUXが許容できるか(判断記録.md 7)
- 発動条件を手動転送には適用しない設計の是非(判断記録.md 8)

問題があれば、公開サイトのリポジトリのGitHub Issueで報告してもらい対応する。
