# 神エクセル帳票印刷プラグイン

Excelテンプレートのセル番地とkintoneフィールドを対応付け、レコードの値を流し込んだExcelファイル(xlsx)を
生成・ダウンロードするプラグイン。6案中もっとも不確実性が高い案件で、唯一「外部ライブラリの利用」が
CLAUDE.md開発方針9の例外として認められている。

## 確定しているスコープ

- **PDF出力は行わない。xlsxのみ。**(初期スコープから除外・確定)
- 一括ダウンロードは複数のxlsxをその場でzip化し、1ファイルとしてダウンロードする(連続個別ダウンロードにはしない)。
- テンプレートは、**対象アプリに限らない任意のアプリの添付ファイルフィールド**にあるファイルを参照する。
  プラグイン設定へのbase64保存は行わない(256KB制限を受けないための設計)。
- サブテーブルは別シートに、行範囲を指定してカラム範囲ごとに繰り返し挿入する。
- モバイルは非対応(PCのみ)。詳細は[判断記録.md](判断記録.md)参照。

## ライブラリ選定(スパイク結果)

secureCodingGuideline.mdの「外部ライブラリ利用時はリスクを考慮する」、および
plugin_idea_plan.mdの「安全が確認された」の具体化に従い、Excel操作ライブラリとzip操作ライブラリを
それぞれ実装前に検証した。

### Excel操作ライブラリ: ExcelJS 4.4.0 を採用

候補は ExcelJS と SheetJS(xlsx, Community Edition)。判断基準は「テンプレートの書式(罫線・結合セル・
列幅)を保持したまま読み書きできるか」。

**スパイク方法**: 結合セル(タイトル行・明細見出し)・罫線(セル全体/太罫線)・背景色(塗りつぶし)・
列幅を含む簡易テンプレート(`template.xlsx`)をExcelJSで作成し、これを両ライブラリでそれぞれ
「読み込み→値差し込み→書き出し→再読み込みして書式を検証」した(スパイクスクリプトは本タスクの
作業用スクラッチに作成し、リポジトリには含めていない)。

**結果**:

| 項目 | ExcelJS | SheetJS(xlsx) Community Edition |
| :-- | :-- | :-- |
| 結合セル(merge) | 保持される | 保持される |
| 列幅 | 保持される | 保持される |
| セルの罫線(border) | 保持される | **失われる**(書き出し後、全セルの罫線情報が消える) |
| セルの背景色(fill) | 保持される | **失われる**(`patternType: 'none'`に上書きされる) |

SheetJS Community Editionは、結合セルや列幅は保持するものの、罫線・塗りつぶしなどのスタイル情報を
書き出し時に保持できないことを実機検証で確認した(スタイルの完全な書き出しはSheetJS Pro版の機能)。
神エクセル(罫線を多用した複雑な帳票テンプレート)の用途では、罫線が消えるのは致命的であるため、
**ExcelJSを採用する**。

### 依存関係・監査

- `npm view exceljs dependencies` で確認した直接依存は9件(`archiver`, `unzipper`, `jszip`, `dayjs`,
  `uuid`, `tmp`, `saxes`, `fast-csv`, `readable-stream`)で、SheetJSより依存が多い。この点は
  plugin_idea_plan.mdが事前に指摘していた「依存とサイズが大きい」というトレードオフどおりだが、
  書式保持という要件を満たせないSheetJSより、書式保持を優先してExcelJSを選んだ。
- `npm audit`(スパイク環境)で、`xlsx`(SheetJS)は**修正版が存在しない既知の高深刻度脆弱性**
  (Prototype Pollution: GHSA-4r6h-8v6p-xvw6、ReDoS: GHSA-5pgg-2g8v-p4x9)を持つことが判明した。
  これも不採用の決め手の一つ。
- ExcelJSは推移的依存の`uuid`(`^8.3.0`)に既知の脆弱性(GHSA-w5hq-g745-h8pq)があったため、
  `pnpm-workspace.yaml`の`overrides`で`uuid: 11.1.1`に固定し解消した(詳細はsecurity-checklist.md参照)。
- npmの週間ダウンロード数(2026-07-09時点): exceljs 約996万、xlsx 約1,103万、fflate 約5,158万。
  いずれも広く使われているが、xlsxは前述の未修正脆弱性があるため不採用。

### zip操作ライブラリ: fflate 0.8.3 を採用

一括ダウンロードのzip化には fflate を採用した。理由:

- 依存パッケージが0件(推移的依存も含めて完全にゼロ)。plugin_idea_plan.mdが挙げていた候補(fflate等)
  のうち、依存最小の要件を最も強く満たす。
- 週間ダウンロード数が5,000万超と、この規模のユーティリティライブラリとして広く使われている。
- 2026年5月時点でも更新が続いている(最終公開日が直近)。
- ブラウザ向けのUMDビルド(`umd/index.js`, 約33KB)を単体で配布しており、バンドラーを使わない
  本リポジトリの方針(CLAUDE.md)にそのまま乗せやすい。

### バンドル方式(ビルド時コピー)

CLAUDE.mdの開発方針(バンドラー不使用、`manifest.json`が列挙する各jsファイルを素の`<script>`として
読み込む構成)を維持するため、webpack/rollup等のバンドラーは導入しない。代わりに、ExcelJSとfflateが
それぞれ配布しているブラウザ向けビルド済みファイル(`exceljs/dist/exceljs.min.js`,
`fflate/umd/index.js`)を、`pnpm run build`実行時に`scripts/copy-vendor.js`が`js/vendor/`へコピーし、
`manifest.json`から通常のローカルファイルとして参照する。CDN読み込みは行わず、常に`pnpm install`で
取得したロックファイル固定バージョンのファイルをコピーする(plugin_idea_plan.mdの「ビルド時にバンドルし、
CDN読み込みや外部変換サービスは使わない」を、バンドラーなしで実現する方式)。`js/vendor/`配下は
`dist/`と同様にビルド生成物として`.gitignore`対象にしている。

## テンプレート参照先(確定仕様)

- 設定は「アプリID + レコードID + フィールドコード(添付ファイルフィールド)」の3点。
- 実行時に`GET /k/v1/record.json`(`kintone.api()`経由)でレコードを取得し、対象フィールドの
  **1番目のファイル**の`fileKey`を取得後、`GET /k/v1/file.json`でダウンロードする。
- `GET /k/v1/file.json`は公式ドキュメント上「`kintone.api()`では実行できないAPI」と明記されているため、
  ドキュメントのサンプルコードに倣い`fetch()`を使う(URLは`kintone.api.url()`で組み立て、宛先は常に
  kintone自身の`/k/v1/file.json`のみ)。詳細は[判断記録.md](判断記録.md)参照。

## セルマッピング・サブテーブル

- セルマッピング: `{ sheetName, cellAddress, fieldCode }` の配列。設定画面ではこのアプリの
  `kintone.app.getFormFields()`から取得したフィールド一覧をプルダウンで選択する(セル番地は手入力)。
- サブテーブル: `{ tableFieldCode, sheetName, startRow, maxRows, columns: [{ column, fieldCode }] }`。
  対象テーブルの列挙・列(テーブル内フィールド)の列挙も`kintone.app.getFormFields()`で取得する。
  `maxRows`を超える行は書き込まず、超過した旨を警告としてユーザーに表示する(サイレントに切り捨てない)。
- 出力ファイル名: `{フィールドコード}`を含むテンプレート文字列にレコード値を差し込み、OS上使用できない
  文字を除去し、`.xlsx`拡張子を付与する。一括ダウンロード時に同名が発生した場合は`(2)`,`(3)`...を
  付与して衝突を解消する。
- 一括ダウンロード上限件数: 設定画面で必須の数値(既定100件)。一覧画面の現在の絞り込み条件
  (`kintone.app.getQueryCondition()`)に一致する件数が上限を超える場合は実行しない。

## データ取得方針

- 自レコード(単体ダウンロード)は`kintone.app.record.get()`(JavaScript API)。
- 一括ダウンロードは`kintone.app.getQueryCondition()`で現在の絞り込み条件を取得し、
  `GET /k/v1/records.json`(`kintone.api()`)を`$id`昇順+`$id > 直前取得分の最大$id`で
  500件ずつページングして全件取得する(offset・カーソルAPIは使わない。plugin_idea_plan.mdの
  共通前提どおり)。

## 実装構成

```
src/js/lib/            # 純粋関数(TDD対象)
  cell-address.js         # セル番地の検証・分解・組み立て
  field-value-format.js   # kintoneフィールド値→Excelセル値への変換
  cell-mapping.js         # マッピング検証 + マッピング定義→書き込み命令リスト
  subtable-layout.js      # サブテーブル行範囲展開→書き込み命令リスト
  filename-template.js    # 出力ファイル名の組み立て・サニタイズ・重複解消
  record-values.js        # ファイル名テンプレート用の値マップ組み立て
  bulk-limit.js           # 一括ダウンロード上限件数の判定
  config-store.js         # プラグイン設定の読み書き

src/js/                # kintoneグルーコード(結合的、e2eで検証)
  template-source.js      # テンプレート参照先からファイル実体を取得
  record-fetcher.js       # 一括ダウンロード用の複数レコード取得($idページング)
  workbook-builder.js     # ExcelJSでテンプレートに書き込み命令を適用
  zip-bundle.js           # fflateでのzip化
  download-file.js        # Blob + a[download]ダウンロード
  single-export.js        # 1件ダウンロードの一連処理
  bulk-export.js          # 一括ダウンロードの一連処理
  desktop.js               # イベント配線(詳細画面・一覧画面のボタン設置)
  config.js                # 設定画面ロジック
```

## TDD

`src/js/lib/`配下の純粋ロジックはJestでユニットテストする(`pnpm test`)。特に「マッピング定義→
書き込み命令リスト」への変換(`cell-mapping.js`の`buildCellWrites`、`subtable-layout.js`の
`expandSubtableRows`)は、ExcelJS自体を使わずに検証できる形に切り出している。
ExcelJSでの実際の読み書き(`workbook-builder.js`)は結合的にならざるを得ないため、Puppeteerによる
実環境テスト(CLAUDE.md項目6、本タスクのスコープ外)で別途検証する。

## 未解決事項・今後の対応

- テンプレート参照先レコード・フィールドが削除/変更された場合のエラーハンドリングは暫定対応
  (取得失敗時にエラーメッセージを表示し処理を中断する)にとどめている。[判断記録.md](判断記録.md)参照。
- モバイル非対応(判断記録.md参照)。
- ExcelJSまたはfflateに重大な脆弱性が報告された場合の対応手順は security-checklist.md に記載。
- 複雑なテンプレート(多段結合セル・図形・印刷設定)がExcelJSの読み書きで崩れるリスクは、
  実際の利用者テンプレートでの検証(Puppeteer e2e、本タスクのスコープ外)で確認する。
