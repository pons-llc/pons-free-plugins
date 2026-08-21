# report_prompt_builder(帳票ビルダープラグイン) セキュリティチェックリスト

[secureCodingGuideline.md](../secureCodingGuideline.md)の各項目を、本プラグインの実装(`src/js/`,
`src/html/config.html`)に照らして確認したもの。共通項目(文字コード・名前空間・`'use strict'`・
kintone内部DOM非依存など)は[box_gdrive_iframe/security-checklist.md](../box_gdrive_iframe/security-checklist.md)
を参照し、ここでは本プラグイン固有の項目のみを記載する。

最終確認日: 2026-08-21 / 対象: AIプロンプト生成方式から、プラグイン自身が直接帳票を描画する方式への
全面転換後の実装(idea.md「経緯」参照)、および、生成した帳票をPDFとして添付ファイルフィールドへ
保存する機能(任意)の追加(idea.md「追加機能: 生成した帳票をレコードの添付ファイルフィールドに
保存する」参照)。

## 方針転換に伴う変更点

当初(config画面のみで完結し、生成されるのはコピー用のプロンプト文字列だけだった版)は
`manifest.json`に`desktop`を持たなかったが、転換後は`desktop`(個別出力/一括出力ボタンと
実際のレコード値の描画)を持つ通常のkintoneカスタマイズプラグインになった。そのため、以前は
「AIが書くコードの安全性」という間接的な観点だったXSS対策が、**このプラグイン自身の実行コードの
安全性**として直接的なチェック対象になった。

## REST API利用

- [x] 出力(`desktop.js`)側は引き続きREST APIを一切使用せず、JavaScript API
  (`kintone.app.record.getHeaderMenuSpaceElement()`, `kintone.app.getHeaderMenuSpaceElement()`,
  `kintone.plugin.app.getConfig()`)のみで実装している(CLAUDE.md開発方針3)。
- [x] 一括出力は`app.record.index.show`の`event.records`(現在一覧に表示されている行)のみを使い、
  絞り込み条件に一致する全件をREST等で追加取得する機能を持たない(ユーザー指示、
  secureCodingGuideline.mdの「短時間で大量のリクエスト送信を避ける」にも合致)。
- [x] config画面(`js/config.js`)のみ、右側プレビュー用に最新レコード1件を`kintone.api()`
  (kintone自身への呼び出し専用の内部ラッパー、生の`fetch`/`XHR`は使わない)で取得する
  (`GET /k/v1/records.json`, `query: 'limit 1'`)。JavaScript APIには任意のレコードを取得する
  手段が無く(`kintone.app.record.get()`はレコード画面専用)、プラグイン設定画面には
  「現在のレコード」という概念自体が無いため、CLAUDE.md開発方針3の「REST APIはJavaScript APIで
  実現できない場合のみ」に該当する。1回のロードにつき最大1回・`limit 1`のみの読み取り専用リクエストで、
  短時間の大量リクエストには当たらない。取得失敗(権限不足・レコード0件)は例外を投げず
  `previewRecord = null`として扱い、プレビュー側で案内表示に切り替える。

## 通信

- [x] kintone以外のサーバーへの通信を一切行わない。生成AIへの送信も行わない(方針転換によりAI
  自体を使わなくなった)。
- [x] `window.open('', '_blank')`で開く帳票ウィンドウは、URLを指定せず空のドキュメントを
  `document.createElement`で組み立てるのみで、外部URLへの遷移は発生しない。
- [x] プレビュー用に取得した最新レコード1件は、config画面内の同一オリジンiframe
  (`js-preview-frame`、URLを持たない空のdocumentにレンダリング)にのみ描画され、
  それ以外の送信先には一切渡さない。

## XSS・CSSインジェクション対策(本プラグイン固有・最重要)

- [x] `js/lib/report-dom.js`は、レコードの値(フィールド値・テーブルの値)をDOMへ挿入する箇所を
  すべて`textContent`への代入のみで行い、文字列結合による`innerHTML`は一切使用していない
  (secureCodingGuideline.mdの「外部からの入力値を使った要素生成はinnerHTMLではなく
  textContent/innerText」に対応)。CSSも`<style>`要素の`textContent`にプラグイン内の固定文字列
  (`REPORT_CSS`)を設定しているのみで、レコード値がCSSとして解釈される経路は無い。
- [x] `js/config.js`も同様に、パレットのチップ・配置済み項目のラベル表示等はすべて
  `textContent`/`createElement`で組み立てており、`innerHTML`は再描画時の中身クリア
  (`el.innerHTML = ''`)以外に使用していない。
- [x] 配置した項目の「文字サイズ(pt)」「幅(1〜12)」はいずれも`Number()`でパースし、
  `Number.isFinite()`と範囲チェックを通ったものだけを採用する(`config-validation.js`の
  `MIN_FONT_SIZE_PT`〜`MAX_FONT_SIZE_PT`・1〜12列チェック)。数値以外の文字列がCSSの
  `style.fontSize`等に混入することはない。
- [x] 保存する設定値(`kintone.plugin.app.setConfig()`)は、このアプリ自身の
  `kintone.app.getFormFields()`から取得したフィールドコード・ラベル・型と、アプリ管理者自身が
  グリッド上で設定した数値・真偽値のみで、認証情報や機密情報は含まれない。
- [x] IMAGE項目(社印・ロゴ)の`<img src="...">`は、アプリ管理者が選択したファイルをconfig.js内で
  `FileReader`+`<canvas>`により自前で再生成したdata URLのみを使う。選択時に`file.type`が
  `image/`で始まることを確認し、canvas経由で再エンコードすることで、任意のバイト列がそのまま
  `src`に渡ることはない(data URLは実際に画像として復号できなければブラウザは描画しないため、
  仮に非画像ファイルが紛れ込んでも実行される経路は無い)。外部URLを`src`に使うことは一切ない。

## プラグイン設定保存の容量制限への対応(IMAGE機能追加時に確認)

- [x] kintone公式ドキュメントで確認済み: `kintone.plugin.app.setConfig()`は「1つの値につき最大
  65,535文字」「プラグイン全体で合計256KBまで」の制限がある。画像は`pages`とは別の
  `image_<imageId>`という専用キーへ画像ごとに保存し(`config-store.js`)、アップロード時に
  canvasで最大240×240pxへ圧縮する(idea.md「圧縮方針」参照)ことで、通常の社印・ロゴ用途では
  この制限に収まるよう設計している。
- [x] 保存前に`config-validation.js`で合計サイズの簡易チェック(概算200,000文字)を行い、
  超過時は保存自体を止めてエラーメッセージを表示する(kintone側のエラーに委ねきらず、
  自前でも安全マージンを設けている)。
- [x] 削除・差し替えで参照されなくなった画像(孤立したエントリ)は保存時に取り除き、
  容量を無駄に消費し続けないようにしている。

## 一覧のビュー形式に関する防御的な扱い

- [x] `app.record.index.show`の`event.records`は、ビュー形式(表形式/カレンダー形式/カスタマイズ)
  によって配列でない場合があることをkintone公式ドキュメント(MCP)で確認済み。`Array.isArray()`で
  ガードし、配列でない場合は一括出力の対象を0件として扱う(例外を投げてカスタマイズ全体が
  壊れることを防ぐ)。

## リダイレクト

- [x] `window.location.href`に渡す値は`kintone.app.getId()`など内部値のみで、外部入力を含まない
  (キャンセル時・保存後の画面遷移)。

## 添付ファイルフィールドへの保存機能(任意)について

- [x] **外部パッケージ・外部通信を使わない(CLAUDE.md開発方針9)の例外**: この機能に限り、
  vanilla JSだけでのHTML→PDF変換(特に日本語フォント埋め込み)が非現実的なため、ユーザーの
  明示的な承認を得てjsPDF/html2canvasを利用する。ただし両ライブラリはCDN等の外部URLから
  実行時に読み込むのではなく、`js/vendor/`配下にUMDビルドをリポジトリへ同梱しており、
  他のプラグインコードと同様に`<script>`タグで読み込むだけで、追加のネットワーク通信は
  発生しない(「外部通信をしない」という方針自体は維持している。idea.md参照)。
- [x] **ファイルアップロードAPI(`fetch('/k/v1/file.json')`)を直接使うことについて**:
  kintone公式ドキュメントに「このAPIは`kintone.api()`から利用できない」と明記されているため、
  この1箇所に限り`fetch()`を直接使う(CLAUDE.md開発方針3「REST APIはJavaScript APIで実現
  できない場合のみ」に合致する、公式ドキュメントで裏付けられた正当な例外)。送信先は相対パス
  `/k/v1/file.json`(kintone自身の同一オリジン)のみで、外部サーバーへは送らない。CSRF対策として
  公式サンプルどおり`kintone.getRequestToken()`をFormDataに含める。
- [x] レコード更新(添付ファイルフィールドへの`fileKey`の反映)は通常どおり`kintone.api()`
  (PUT `/k/v1/record.json`)を使う。更新する`record`にはアップロード対象の添付ファイル
  フィールド1つのみを指定し、他のフィールドは指定しない(省略したフィールドは変更されない
  仕様のため、意図しない他フィールドの上書きは起きない)。
- [x] PDF生成用に帳票を描画するオフスクリーン`<iframe>`は、`src`を持たない(常に空の同一オリジン
  ドキュメント)ため、外部URLへの遷移・クロスオリジンの通信は発生しない。描画処理自体は
  `report-dom.js`(既存のXSS対策・`textContent`のみ使用)をそのまま再利用している。
- [x] この機能は既定で無効(config画面のチェックボックスで管理者が明示的に有効化した場合のみ、
  詳細画面にボタンが表示される。ユーザー指示「添付ファイルフィールドに保存するかは選択制に
  してね」)。

## 個別確認事項(利用ユーザーへ委ねる項目)

- 各ブラウザでのHTML5 Drag and Drop API・CSSの`zoom`プロパティの対応状況(config画面の
  ドラッグ&ドロップ配置、キャンバスのズーム表示)。`zoom`は主要ブラウザで広くサポートされて
  いるが、極端に古いブラウザでは倍率100%相当の表示になるだけで機能上の破綻はない。
- ポップアップブロック設定によって帳票ウィンドウが開けない場合の挙動(該当時はアラート表示のみ
  行い、それ以上の自動リトライ等は行わない)。
