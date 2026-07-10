# タブ表示プラグイン

## 機能

スペースフィールドにタブUIを描画し、タブを切り替えることでフォーム内の任意のフィールド(通常のフィールド・
ラベル・スペース・罫線を含む)の表示/非表示を切り替える。

- タブ設定(以下「タブグループ」)を複数持てる。1フォームに複数のスペースフィールドがあれば、
  それぞれに別々のタブUIを設置できる。
- タブグループごとに、アンカーとなるスペースフィールド(要素ID)・タブの並び(複数)を持つ。
- タブごとに、ラベル(タブに表示する見出し文字列)と、そのタブがアクティブなときに表示する項目
  (フィールドコード、またはラベル/スペース/罫線の要素ID)の一覧を持つ。

## ラベルフィールドへの対応(元メモ「最近ラベルにも要素IDがついたため対応すること」への対応、確定)

`kintone.app.getFormLayout()`のレスポンス(`layout[].fields[]`)では、ラベル・スペース・罫線フィールドに
`elementId`が含まれる(通常のフィールドは`code`のみ)。本プラグインは設定画面でこの`elementId`を使って
ラベル・スペース・罫線もタブの表示/非表示切り替え対象として選択できるようにする。表示/非表示の切り替え自体は
`kintone.app.record.setFieldShown(fieldCodeまたは要素ID, isShown)`で行う(このAPIは「フィールドコードまたは
要素ID」のどちらも受け付けるとドキュメントに明記されている)。

## 表示/非表示のモデル(確定・スコープの明確化)

各タブに割り当てた項目の集合は、そのタブがアクティブなときにのみ表示され、**他のタブに割り当てられている
間は非表示**になる。タブに割り当てられていない項目(フォーム上のその他のフィールド)はプラグインの管理外で
あり、常に通常通り表示されたまま変化しない。

同じ項目を複数のタブに重複して割り当てることも可能で、その場合はアクティブなタブにその項目が含まれていれば
表示する(`js/lib/tab-visibility.js`の`computeVisibility()`参照)。

## タブUIの描画位置(確定)

`kintone.app.getFormLayout()`(JS API)で`SPACER`型フィールドの`elementId`を列挙し、設定画面でアンカーとする
スペースフィールドを選ぶ。実行時は`kintone.app.record.getSpaceElement(elementId)`でスペースフィールドの
要素を取得し、その中にタブボタン(`<button>`要素の並び)をvanilla JSで描画する。

## 発動する画面(確定)

`kintone.app.record.getSpaceElement()`/`setFieldShown()`がPCで利用できる画面(レコード詳細・追加・編集・
印刷画面)すべてで発動する。モバイルは印刷画面がないため、詳細・追加・編集画面で発動する。

## デフォルトタブ(確定)

タブグループごとに既定で表示するタブのインデックス(`defaultTabIndex`)を設定できる。未設定/範囲外の値は
先頭のタブ(インデックス0)にフォールバックする(`js/lib/tab-visibility.js`の`resolveDefaultTabIndex()`)。

## 設定画面

`kintone.plugin.app.setConfig()`にのみ保存する。

- タブグループを追加・削除できる。タブグループごとに:
  - アンカーとなるスペースフィールド(`kintone.app.getFormLayout()`で列挙した`SPACER`型の`elementId`から選択)
  - 既定タブのインデックス
  - タブを追加・削除できる。タブごとに:
    - ラベル(タブの見出し文字列)
    - 表示対象の項目(通常フィールドのフィールドコード、またはラベル/スペース/罫線の要素ID。複数選択)
- 保存時に`js/lib/config-validation.js`でチェックする(アンカー未選択、タブ0件、タブラベル未入力等)。

## TDD

`src/js/lib/`配下の純粋ロジックはJestでユニットテストする(`pnpm test`)。

- `tab-visibility.js` — タブの配列+アクティブなタブのインデックスから、管理対象の各項目
  (フィールドコード/要素ID)を表示するかどうかのマップを組み立てる。既定タブインデックスの解決も含む
- `config-store.js` — `kintone.plugin.app.getConfig()`/`setConfig()`のペイロードの読み書きとデフォルト値
- `config-validation.js` — 設定(タブグループの配列)のバリデーション

kintone依存のグルーコード(`desktop.js`/`mobile.js`/`config.js`、タブボタンのDOM描画・
`kintone.app.getFormLayout()`/`setFieldShown()`/`getSpaceElement()`呼び出しを含む)は今回のタスクスコープでは
実環境テスト(Puppeteer)を行わない(別タスク、e2eは後回し)。

## 実装

kintoneドキュメントMCPを参照しながら実装した。`kintone.app.record.setFieldShown(fieldCode, isShown)`が
フィールドコードと要素IDの両方を受け付けること、`kintone.app.getFormLayout()`のレスポンスでラベル・
スペース・罫線に`elementId`が含まれること、`kintone.app.record.getSpaceElement(id)`でスペースフィールドの
DOM要素を取得できることを確認済み。セキュアコーディングガイドラインでのリスクチェックは
`security-checklist.md`を参照。
