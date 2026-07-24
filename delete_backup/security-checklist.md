# delete_backup セキュリティチェックリスト

[secureCodingGuideline.md](../secureCodingGuideline.md)の一般項目([box_gdrive_iframe/security-checklist.md](../box_gdrive_iframe/security-checklist.md)参照、UTF-8/BOMなし・名前空間分離・`'use strict'`・外部スクリプト不使用などは同様に満たしている)は重複記載を省略し、本プラグイン固有の項目のみ記載する。

最終確認日: 2026-07-24

## コーディング作法

- [x] 文字コードはUTF-8(BOMなし)
- [x] グローバル変数を作らず、即時関数(IIFE)+名前空間オブジェクト(`window.DeleteBackup`)のみを公開している(`js/lib/crc32.js`, `js/lib/build-zip.js`, `js/lib/collect-file-fields.js`, `js/lib/build-zip-entry-names.js`, `js/lib/backup-payload.js`, `js/lib/config-store.js`, `js/lib/config-validation.js`)
- [x] 既存のkintoneグローバルオブジェクトを書き換え・参照していない
- [x] `'use strict'`を全JSファイルの先頭で使用している

## REST API・fetch・外部通信(CLAUDE.md開発方針3・9参照)

- [x] レコード登録(アーカイブ方式、`POST /k/v1/record.json`)・アーカイブ先アプリのフィールド一覧取得(設定画面、`GET /k/v1/app/form/fields.json`)は、いずれも`kintone.api(kintone.api.url(path, true), method, params)`(kintone自身への呼び出し専用の内部ラッパー)のみを使用し、生の`fetch`でURLを直接組み立てていない
- [x] ファイルのダウンロード(`GET /k/v1/file.json`)・アップロード(`POST /k/v1/file.json`)の2APIのみ、公式ドキュメントに`kintone.api()`が明示的に非対応と記載されているため`fetch`を直接使用する。URLはいずれも相対パス(`/k/v1/file.json`)のみで、同一オリジン(kintone自身)以外への送信は一切発生しない
- [x] アップロード(POST)時のみ`kintone.getRequestToken()`をCSRFトークンとして付与している(公式ドキュメントのサンプル通り)。ダウンロード(GET)はCSRFトークン不要
- [x] kintone以外の外部サーバーへの通信(fetch/XHR)を一切行わない。`kintone.proxy`系APIも使用していない(外部通信自体が発生しないため不要)
- [x] 外部ライブラリを一切使用していない(vanilla JSのみ、ZIP生成〈`build-zip.js`〉・CRC-32〈`crc32.js`〉も自前実装)

## 添付ファイルの取り扱いに関する仕様確認(推測実装の防止)

- [x] レコード取得由来の`fileKey`(ダウンロード専用)とアップロードAPI由来の`fileKey`(登録用の一時キー)が別物であることをkintoneドキュメントMCP([フィールド形式](https://cybozu.dev/ja/kintone/docs/overview/field-types/)、[ファイルをアップロードするAPI](https://cybozu.dev/ja/kintone/docs/rest-api/files/upload-file/))で確認したうえで実装した。アーカイブ方式では「ダウンロード→再アップロード→新しい一時fileKeyで登録」の流れを必ず経由し、レコード取得由来の`fileKey`をアーカイブ先レコードへ直接指定することはない(`js/desktop.js`の`runArchiveBackup`)
- [x] zip方式では再アップロードは行わず、ダウンロードしたBlobをそのままzipへ格納する(不要な外部化を避ける)

## XSS・CSSインジェクション対策

- [x] 設定画面(`js/config.js`)でフィールド一覧・エラーメッセージ・フィールド取得状況を描画する際、`innerHTML`ではなく`document.createElement()` + `textContent`のみを使用している
- [x] アーカイブ先アプリのレコード登録時、JSON保存先フィールドへ書き込む値はkintone標準のフィールド値レンダリングを経由するため、レコード内の任意の文字列(HTML/スクリプトを含みうる)がそのまま書き込まれてもDOM上でHTMLとして解釈されない(kintoneの文字列フィールドは常にテキストとして表示される)
- [x] zipダウンロードは`Blob`+`<a download>`要素の生成のみで、レコードの値をDOM(innerHTML等)へ出力する処理を経由しない

## 設定の妥当性検証

- [x] 保存前に`js/lib/config-validation.js`でチェックし、不正な設定(バックアップ方式の指定不正、アーカイブ方式選択時のアプリID未入力/非正整数、JSON保存先・添付ファイル保存先の未選択、両フィールドの重複指定)は保存させない
- [x] `kintone.plugin.app.getConfig()`が`null`/`undefined`を返す場合でも、`js/lib/config-store.js`の`load()`は例外を投げず既定値(`{ mode: 'zip', archiveAppId: '', jsonFieldCode: '', attachmentFieldCode: '' }`)を返す
- [x] アーカイブ先アプリID・フィールドコードは、設定画面でアプリ管理者が選択した値のみを`kintone.api()`のパラメーター(オブジェクトのプロパティ)として渡しており、文字列結合でURLやリクエストボディを組み立てていない

## データ喪失防止(本プラグインの主目的に対する確認)

- [x] ファイルのダウンロード・再アップロード・アーカイブ先レコード登録のいずれかが失敗した場合、`event.error`を設定して`event`を返すことで削除処理自体をキャンセルする(`js/desktop.js`の`handleDeleteSubmit`)。「削除はできたがバックアップは失敗した」という状態を作らない
- [x] バックアップ処理中は`kintone.showLoading('VISIBLE'/'HIDDEN')`で操作をブロックし、処理完了前の二重削除操作を防ぐ

## 通信・認証情報の取り扱い

- [x] `kintone.api()`/`fetch`(同一オリジン)はいずれもログイン中のセッション情報を自動的に使用するため、APIトークンやパスワード等の認証情報をコード・設定に含めない(secureCodingGuideline.md準拠)

## アクセス権に関する注意(個別確認事項)

- 削除されるレコードの内容(添付ファイルを含む)がバックアップされる先(ブラウザのダウンロードフォルダ、またはアーカイブ先アプリ)は、元のレコードよりアクセス制御が緩い場合がある。zip方式はダウンロードしたローカルファイルの管理、アーカイブ方式はアーカイブ先アプリのアクセス権設定を、それぞれアプリ管理者が責任を持って設定する必要があることをidea.mdに明記した(プラグイン側では制御できない範囲)
- アーカイブ方式のレコード登録(`kintone.api()`)はログイン中のユーザー権限で実行されるため、アーカイブ先アプリへの追加権限が無いユーザーが削除操作を行うと登録に失敗し、上記の「データ喪失防止」の挙動により削除自体がキャンセルされる(想定内の安全側動作)
- JSON保存先フィールドの文字数制限(文字列(1行)を選んだ場合)を超えるレコードは登録APIがエラーを返し、同様に削除がキャンセルされる。設定画面・idea.mdで文字列(複数行)の使用を推奨している
- **アーカイブ先アプリに、JSON保存先・添付ファイル保存先以外の必須フィールドが存在する場合、登録が必ず失敗し削除が常にキャンセルされる。** E2Eテスト実装時に実際に踏んだ不具合(TEST_APP_ID_2の既存の必須・重複禁止フィールド「文字列__1行_」が未入力のためREST APIが400を返した)であり、机上の想定ではなく実機で確認済み。設定画面・idea.mdに「アーカイブ先はこのプラグイン専用の空アプリ、または他に必須フィールドの無いアプリを推奨する」旨を明記する

問題があれば、公開サイトのリポジトリのGitHub Issueで報告してもらい対応する。
