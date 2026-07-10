# サブテーブル別アプリ挿入プラグイン

## 機能

- このアプリのサブテーブルの各行を、別アプリへ「1行=1レコード」としてUPSERT(更新キーによる登録/更新)で転送する。
- 転送先フィールドには、サブテーブル内の列に加えて、元レコードのテーブル外フィールド(全行共通の値)も割り当てられる。
- サブテーブルの特定列と、転送先アプリの重複禁止設定済みフィールド(文字列1行または数値)のペアを更新キーとして
  **必須設定**にする。保存を繰り返しても同じ行が二重登録されない(重複転送防止)。
- 実行タイミングは2種類。
  - **保存(submit)時**: レコードの値に対するAND/OR複合条件で発動可否を判定し、条件を満たせば自動転送する。
  - **手動(詳細画面のボタン)**: 詳細画面に設置したボタンから`kintone.createDialog()`のモーダルを開き、
    サブテーブルの行を選択して(既定は全行選択済み=一括転送)転送を実行できる。
- 転送成功時に、元レコードの指定フィールドへ指定した値を書き込める(転送済みフラグ等の用途)。

## 転送失敗時の扱い(確定仕様)

- **保存(submit)時に転送先へのREST書き込みが失敗した場合、`event.error`を設定して保存自体を中止する**。
  「保存済みだが転送されていない」状態を作らないための仕様。
- 100件ずつに分割されたUPSERTリクエストの一部が失敗した場合、既に成功したリクエスト分は転送先に反映済みのまま
  残る(ロールバックはしない)。エラーメッセージには何件分のリクエストが成功済みだったかを含める。

## モバイル非対応

`kintone.createDialog()`はPC専用APIのため、本プラグインはPC専用機能として実装する。`manifest.json`に
`mobile`セクションは含めていない(モバイル端末ではプラグイン自体が読み込まれない)。

## 画面ごとの挙動

- **レコード追加・編集画面(保存時)**: `app.record.create.submit` / `app.record.edit.submit`イベント内で
  発動条件(AND/OR)を判定し、満たしていればサブテーブルの全行を転送先アプリへUPSERTする。
  転送に成功し「転送成功時アクション」が有効なら、同一の`event.record`を書き換えて同じ保存に含める
  (追加のREST呼び出しは不要)。転送に失敗した場合は`event.error`をセットして保存を中止する。
- **レコード詳細画面**: プラグイン設定で「手動転送ボタンを表示する」が有効な場合、設定で指定した
  スペースフィールド要素(`kintone.app.record.getSpaceElement()`)にボタンを設置する。対応するスペース
  フィールドがフォーム上に見つからない場合は何も表示しない(判断記録.md 1参照)。
  ボタン押下で`kintone.createDialog()`のモーダルを開き、対象サブテーブルの行一覧(チェックボックス付き、
  既定で全行チェック済み)を表示する。チェックされた行のみを転送し、成功時アクションが有効なら
  REST(`PUT /k/v1/record.json`)で自レコードへ反映した後、画面をリロードして表示に反映する
  (判断記録.md 7参照)。手動転送では発動条件(AND/OR)は評価しない(判断記録.md 8参照)。
  編集画面には手動転送ボタンを設置しない(判断記録.md 2参照。revision競合リスクを避けるため)。
- **一覧画面**: 本プラグインでは一覧画面への機能追加は行わない(対象は常に自レコード1件分のサブテーブル)。

## 設定画面

`kintone.plugin.app.setConfig()`にのみ保存する(認証情報を扱わないため`setProxyConfig()`は使わない)。

- 対象サブテーブル(フィールドコード)
- 転送先アプリID + 「転送先アプリのフィールドを取得」ボタン(`kintone.api()`で
  `GET /k/v1/app/form/fields.json`を呼び出し、以降のマッピング・更新キーの選択肢に使う。判断記録.md 5参照)
- フィールドマッピング(サブテーブル列 or テーブル外フィールド → 転送先フィールド。複数行、1件以上必須)
- 更新キー(サブテーブル列 と 転送先の重複禁止フィールド のペア。必須)
- 発動条件(フィールド・演算子・値の組をAND/ORで複数。保存時のみ適用。1階層のフラット構成。判断記録.md 4参照)
- 実行タイミング(保存時の自動転送 ON/OFF、手動転送ボタンの表示 ON/OFF + 設置先スペースフィールド要素ID)
- 転送成功時アクション(有効化 + 書き込み先フィールド + 書き込む値。書き込み先は`SINGLE_LINE_TEXT` /
  `MULTI_LINE_TEXT` / `NUMBER` / `DROP_DOWN` / `RADIO_BUTTON`のみ選択可。判断記録.md 6参照)

## TDD

`src/js/lib/`配下の純粋ロジックはJestでユニットテストする(`pnpm test`)。

- `condition-engine.js` — AND/OR複合条件(任意のネストに対応)でレコードが発動条件を満たすか判定する純粋関数。
- `field-mapping.js` — サブテーブルの1行(rowValue) + テーブル外フィールド(sourceRecord)から、
  転送先レコードのフィールド値を組み立てる純粋関数。
- `upsert-batch.js` — サブテーブルの行配列から、`PUT /k/v1/records.json`(`upsert: true`)用の
  リクエストボディを100件ずつに分割して組み立てる純粋関数。
- `config-store.js` — `kintone.plugin.app.getConfig()`/`setConfig()`のペイロード(文字列)と
  構造化された設定オブジェクトの相互変換、および設定完了判定(`isComplete`)。

kintone依存のグルーコード(`rest-client.js`, `transfer-service.js`, `manual-dialog.js`, `desktop.js`, `config.js`)は
Puppeteerによる実環境テスト(CLAUDE.md項目6、別フェーズで実施)で検証する。

## 実装メモ

- REST APIはすべて`kintone.api()`経由(生の`fetch`/`XHR`は使用しない。CLAUDE.md方針3)。
- 転送先へのUPSERTリクエストは`for...of`で逐次実行し、並列実行はしない
  (kintoneセキュアコーディングガイドライン「並列で実行するのをなるべく避ける」に準拠)。
- `kintone.createDialog()`の`config.body`に挿入するDOM要素は、すべて`document.createElement`/
  `textContent`で構築し、`innerHTML`は一切使用しない(security-checklist.md参照)。
- kintoneドキュメントMCPで実装前に確認済みのAPI: `kintone.createDialog()`, `PUT /k/v1/records.json`の
  UPSERT仕様(`upsert: true` + `records[].updateKey`)、`app.record.create.submit` /
  `app.record.edit.submit`のPromise対応と`event.error`による保存中止、`kintone.app.record.getSpaceElement()`
  (詳細/追加/編集/印刷画面で利用可、`kintone.app.record.set()`は追加/編集画面限定で詳細画面では使えない)、
  `kintone.showLoading()` / `kintone.showNotification()`。
