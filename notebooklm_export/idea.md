# notebookLM用設計ファイルダウンロードプラグイン(notebooklm_export)

`plugin_idea.md`「notebookLM用設計ファイルダウンロードプラグイン」の詳細仕様。アプリ市民開発者が
別の担当者へアプリを引き継ぐ際に、kintoneの設計情報とカスタマイズファイルの中身をNotebookLMや
ChatGPTなどの外部AIツールに読み込ませられる形式(.txt/.md)でエクスポートするプラグイン。

## 機能概要

- プラグイン設定画面(config画面)にのみ機能を持つ。デスクトップ・モバイル(レコード一覧/詳細/追加/編集
  画面)には一切手を加えない(元メモ「特段アプリユーザー側に特別な機能は不要」)。
- config画面の「設計書をダウンロード」ボタンを押すと、そのアプリ(config画面を開いているアプリ、以下
  「起点アプリ」)を起点に、後述の設計情報をREST APIで取得する。
- 起点アプリのフィールドに含まれるルックアップ(LOOKUP)・関連レコード一覧(REFERENCE_TABLE)フィールドが
  参照している別アプリ(以下「関連アプリ」)についても、同じ設計情報を再帰的に取得する。関連アプリの
  さらに関連アプリも辿る(訪問済みアプリIDの集合で重複訪問を防ぐため、循環参照があっても無限ループには
  ならない)。
- 取得した情報をアプリごとに1ファイル(Markdown整形の.txtまたは.md)にまとめ、ファイル間の関係を示す
  メタデータファイルと合わせてzip(格納方式・無圧縮)でブラウザからダウンロードする。

## 取得する設計情報(kintoneドキュメントMCPで仕様確認済み)

CLAUDE.md開発方針1に従い、以下は実装前にすべてkintoneドキュメントMCPでレスポンス形式を確認済み。
起点アプリ・関連アプリのいずれも同じ12種類のAPIを呼ぶ(アプリごとに横並びで同じ構成のセクションを
作る)。**アプリIDを指定して任意のアプリの情報を取得できるJavaScript APIは存在しない
(`kintone.app.getFormFields()`等は「現在開いているアプリ」専用)ため、起点アプリを含め全アプリで
REST API(`kintone.api()`、kintone自身への呼び出し)に統一する**(CLAUDE.md開発方針3、
「JavaScript APIをREST APIより優先する」は現在開いているアプリに対してのみJS APIで代替可能だが、
関連アプリの取得と実装を共通化するため、起点アプリも含めてREST APIで統一する判断)。

| # | API | 用途 | 備考 |
| :-- | :-- | :-- | :-- |
| 1 | `GET /k/v1/preview/app/form/fields.json` | フィールド設定一覧 | LOOKUP/REFERENCE_TABLEの`relatedApp.app`を関連アプリ探索に使う |
| 2 | `GET /k/v1/preview/app/settings.json` | アプリ一般設定(名称・アイコン・テーマ等) | |
| 3 | `GET /k/v1/preview/app/status.json` | プロセス管理設定 | |
| 4 | `GET /k/v1/preview/app/customize.json` | JS/CSSカスタマイズ設定 | `file.fileKey`があるものは実ファイル本体も取得(下記) |
| 5 | `GET /k/v1/preview/app/notifications/general.json` | 条件通知(アプリ全体) | |
| 6 | `GET /k/v1/preview/app/notifications/perRecord.json` | 条件通知(レコード条件) | |
| 7 | `GET /k/v1/preview/app/notifications/reminder.json` | リマインダー通知 | |
| 8 | `GET /k/v1/preview/app/acl.json` | アプリのアクセス権 | |
| 9 | `GET /k/v1/preview/record/acl.json` | レコードのアクセス権 | |
| 10 | `GET /k/v1/field/acl.json` | フィールドのアクセス権 | **この項目のみ動作テスト環境(`/preview/`)のURLが存在しない**(kintoneドキュメントMCPで確認済み。フィールドACL APIのドキュメントには運用環境URLしか記載が無い)。よって現在の運用環境(反映済み)の設定を取得する。他の11項目との「反映済みかどうか」のズレはエッジケースに明記 |
| 11 | `GET /k/v1/preview/app/actions.json` | アプリアクション設定 | |
| 12 | `GET /k/v1/preview/app/plugins.json` | 導入プラグイン一覧(`id`/`name`/`enabled`) | 元メモに無かったがユーザー指摘で追加。カスタマイズJSだけでは分からない「プラグインによる拡張」を引き継ぎ資料に残すために必要 |

補足として `GET /k/v1/app.json`(1件のアプリ情報。`name`/`description`/`spaceId`等)も各アプリにつき
1回呼び、ファイル名・メタデータ表示用のアプリ名を得る(運用環境の情報。レコード閲覧/追加権限があれば
取得可能)。

### カスタマイズファイル本体の取得(customize.jsonから)

`customize.json`の`desktop.js`/`desktop.css`/`mobile.js`/`mobile.css`配列のうち`type: "FILE"`の要素は
`file.fileKey`を持つ。この`fileKey`を`GET /k/v1/file.json?fileKey=...`でダウンロードし、ファイル内容を
該当アプリの.txt/.md内に埋め込む(コードブロックとして)。`type: "URL"`の要素はURL文字列のみ記載する
(外部URLへのアクセスはしない)。

**`file.json`は`kintone.api()`で実行できない**(公式ドキュメント「kintone REST APIリクエストを送信する」
の制限事項に明記、および「ファイルをダウンロードする」ページの「制限事項」に明記)。
`excel_report_export/src/js/template-source.js`・`delete_backup/src/js/desktop.js`の既存実装と同じく、
`fetch(kintone.api.url('/k/v1/file.json', true) + '?fileKey=...', { headers: { 'X-Requested-With':
'XMLHttpRequest' } })`を使う(宛先は常にkintone自身、外部サーバー通信ではないため開発方針9の
「外部通信禁止」には抵触しない)。

## ルックアップ/関連レコード一覧フィールドからの関連アプリ探索(確定)

- `properties`を(SUBTABLEの`fields`も含めて)走査し、`lookup`が truthy なフィールド、または
  `type === 'REFERENCE_TABLE'`かつ`referenceTable`が truthy なフィールドを集める
  (`lookup.relatedApp.app`/`referenceTable.relatedApp.app`が関連アプリID)。
- ルックアップフィールドは「コピー元のフィールドのフィールドタイプ」で`type`が返る
  (例: コピー元が文字列1行なら`type: "SINGLE_LINE_TEXT"`)ため、`type`ではなく`lookup`プロパティの
  有無で判定する(kintoneドキュメントMCPで確認済み、フィールド取得APIの仕様書に明記)。
- `lookup`/`referenceTable`が`null`の場合(参照先アプリにレコード閲覧/追加/アプリ管理権限のいずれも
  無い)は、そのフィールドからは関連アプリを辿れない。メタデータファイルに
  「参照先の権限が無いため探索できませんでした」と記録する。
- 自アプリを参照するフィールド(`self_lookup`のような自己参照)は関連アプリIDが自分自身になるため、
  訪問済み集合により自然に除外される(無限ループにならない)。
- 探索する関連アプリの総数には上限(**30アプリ**)を設ける。超えた場合はそこで探索を打ち切り、
  未処理のアプリIDをメタデータファイルに列挙する(kintoneには数百アプリ規模の環境もあり、
  アプリ管理権限を持つユーザーが起点になった場合の暴走的なAPI呼び出し・レート制限抵触を防ぐための
  安全弁。ユーザーからの追加指示は無いが、CLAUDE.md開発方針9の趣旨〈個別プラグインが環境全体に
  過大な負荷をかけない〉に沿った設計判断)。

## 権限に関する重要な制約(エッジケース)

- 起点アプリはプラグイン設定画面を開けている時点でアプリ管理権限を持つ。しかし**関連アプリについては
  同じユーザーがアプリ管理権限を持つとは限らない**(`lookup`/`referenceTable`が非nullになる条件は
  「レコード閲覧・追加・アプリ管理権限のいずれか1つ」であり、アプリ管理権限を含意しない)。
  動作テスト環境の設定取得(表中#1-9, #11, #12)・カスタマイズ・ACL系APIはすべて「アプリ管理権限」を
  要求するため、関連アプリで403エラーになるケースが通常運用で頻発する。
- そのため関連アプリ単位でAPI呼び出しを`try/catch`し、1つのアプリの取得が失敗しても他のアプリの
  処理・zip全体の生成は継続する(部分的失敗を許容するオーケストレーション。
  `plugin_catalog_builder`の「グループ制限はUI上の絞り込みに過ぎない」という設計判断と同様、
  真の権限境界はkintone自身に委ねる)。失敗したアプリは、そのアプリの.txt/.mdファイル内に
  「取得できませんでした(権限不足の可能性: 403等)」という趣旨のセクションを残す。
- フィールドACL(#10)だけ動作テスト環境のURLが無いため、他の項目が「保存されているが未反映の設定」を
  表すのに対し、フィールドACLだけは「現在運用環境に反映済みの設定」になる。プラグイン設定変更直後
  (デプロイ前)にダウンロードすると、この1項目だけ他と食い違う可能性がある旨を出力ファイルの先頭に
  注記する。

## 出力ファイルの構成

- zipファイル名: `design_export_app{起点アプリID}_{YYYYMMDDhhmmss}.zip`
- `metadata.{ext}` — 起点アプリ・処理日時・処理したアプリの一覧(アプリID/アプリ名/ファイル名)、
  アプリ間の関係(どのアプリのどのフィールドがどのアプリを参照しているか)、権限不足で取得できなかった
  アプリ、30アプリの上限に達したため未処理のアプリ、を記載する。
- `app_{アプリID}.{ext}` — アプリごとに1ファイル。上記12項目それぞれを見出し+コードブロックで記載し、
  カスタマイズファイル本体(JS/CSS)も対応するコードブロックとして埋め込む。
- `{ext}`は設定画面での選択によって`txt`または`md`になる(内容は同一、拡張子のみ異なる。
  NotebookLMは`.md`/`.json`を受け付けないため`.txt`、ChatGPTなど`.md`を扱えるツール向けに`.md`も
  選べるようにする、という元メモの要件)。

## 設定画面

保存が必要な項目は「出力形式」(ラジオボタン: `.txt`(NotebookLM向け、既定)/`.md`)のみ。
`kintone.plugin.app.setConfig()`に保存する(プラグインを有効化するには少なくとも1度保存が必要という
kintoneの仕様のためでもある)。保存とは別に「設計書をダウンロード」ボタン(type="button"、保存ボタンとは
独立)を用意し、押した時点のラジオボタンの選択値(未保存でも可)でその場でダウンロードを実行する。

ダウンロード中は`kintone.showLoading()`で待機表示し、処理中のアプリ名を進捗表示する
(`plugin_catalog_builder`のconfig画面にある`#js-progress`と同様のUIパターンを踏襲)。

## TDD

kintoneに依存しない純粋ロジックを`src/js/lib/`に切り出し、`src/__tests__/`でテストする。

- `extract-related-app-ids.js` — フィールド設定(`properties`、SUBTABLE内も含む)からLOOKUP/
  REFERENCE_TABLEフィールドを見つけ、関連アプリID一覧を返す(`lookup`/`referenceTable`が`null`の
  場合を除外することを含めてテスト)
- `traverse-apps.js` — 起点アプリIDから、注入された`fetchAppDesign`(1アプリ分の12項目取得を担う
  関数)と`extractRelatedAppIds`を使い、訪問済み集合・30アプリ上限・部分失敗の許容を担う
  オーケストレーションロジック(循環参照・上限到達をモックで確定的にテスト)
- `render-app-document.js` — 1アプリ分の取得結果(成功/一部失敗を含む)から.txt/.md本文を組み立てる
  純粋関数
- `render-metadata-document.js` — 探索結果(処理済み/失敗/上限超過)からメタデータファイル本文を
  組み立てる純粋関数
- `build-zip.js`/`crc32.js` — `delete_backup`の実装をコピーして流用(外部ライブラリを使わない
  格納方式のみのZIP自前実装、CLAUDE.md開発方針9)
- `config-store.js`/`config-validation.js` — 出力形式(txt/md)の設定の読み書き・検証

kintone依存のグルーコード(`config.js`、`kintone.api()`呼び出し・`fetch()`によるファイルダウンロード)は
`src/e2e/*.e2e.test.js`(Puppeteer)で実環境テストする。

## エッジケース

- ルックアップ/関連レコード一覧フィールドが1つも無いアプリ: 関連アプリ探索は行わず、起点アプリ1つ分の
  .txt/.mdとメタデータのみのzipになる。
- 循環参照(AがBを参照し、BがAを参照する): 訪問済み集合により2度目の訪問はスキップされ、
  メタデータに「既に処理済みのため探索を打ち切り」と記録する。
- カスタマイズファイルが`type: "URL"`(外部URL指定)のみで添付ファイルが無い場合:
  ファイル本体のダウンロードは発生せず、URL文字列のみ記載する。
- 添付ファイルダウンロード(`file.json`)がエラーになった場合(削除済みファイル等): そのファイルだけ
  「ダウンロードできませんでした」と記載し、他の処理は継続する。
- 起点アプリ自体がプロセス管理未設定(`states`が`null`)・条件通知未設定など、項目自体が空/nullの場合:
  「設定なし」と明記する(空のセクションを暗黙に省略しない。引き継ぎ資料としては「未設定であること」
  自体が情報のため)。

## 実装

kintoneドキュメントMCPを参照しながら実装した。REST APIレスポンス形式は本ファイルに記載の通りすべて
確認済み(推測実装はしない)。セキュアコーディングガイドラインでのリスクチェックは
`security-checklist.md`を参照。
