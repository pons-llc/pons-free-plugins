# records_to_subtable_import セキュリティチェックリスト

[secureCodingGuideline.md](../secureCodingGuideline.md)の一般項目([box_gdrive_iframe/security-checklist.md](../box_gdrive_iframe/security-checklist.md)参照、UTF-8/BOMなし・名前空間分離・`'use strict'`・外部スクリプト不使用などは同様に満たしている)は重複記載を省略し、本プラグイン固有の項目のみ記載する。

最終確認日: 2026-07-09 / 対象: 初回実装時点

## 取得元アプリのフィールド値をサブテーブルに書き込む際の扱い(本プラグイン固有のリスク)

- [x] 取得元アプリのレコード値は、`kintone.app.record.set()`のvalue配列(`{type, value}`)としてのみ
      書き込んでおり、`innerHTML`や`document.write`等でDOMに直接挿入していない
      (`js/lib/row-mapper.js`、`js/subtable-writer.js`)。kintoneのフォームレンダリングは
      フィールド値をエスケープして描画するため、値そのものにHTML特殊文字が含まれていても
      XSSは発生しない(kintone JavaScript APIの標準的なフィールド値セットの仕組みに従っているため)。
- [x] 設定画面(`html/config.html`、`js/config.js`)側で、取得元アプリのフィールドラベル・
      選択肢名・エラーメッセージなどを画面に表示する箇所は、すべて`textContent`でのみ出力しており
      `innerHTML`に外部由来の文字列を差し込んでいない。`selectEl.innerHTML = ''`は要素を
      空にするためだけに使っており(空文字列の代入のみ)、外部入力の注入経路にはならない
      (`js/config.js`の`buildOptions()`/`populateOperatorSelect()`)。
- [x] フィールドマッピングの型互換性チェック(`js/lib/type-compatibility.js`)により、
      添付ファイル(FILE)フィールドの値コピーは取得元・取り込み先のいずれにも許可していない。
      添付ファイルの`fileKey`は本来ダウンロード専用の一時キーであり、単純コピーすると
      意図しない参照や情報漏えいにつながりうるため、実装レベルで経路そのものを塞いでいる。
- [x] 検索条件の値をクエリ文字列へ埋め込む際は、`js/lib/query-builder.js`の
      `escapeStringLiteral()`でダブルクオート・バックスラッシュをエスケープしている
      (kintoneクエリの書き方: エスケープ処理の節に準拠)。固定値(管理者入力)・自レコードの
      フィールド値(エンドユーザーが編集可能な値を含みうる)のどちらの値ソースでも同じ
      エスケープ処理を通るため、クエリインジェクション(意図しない条件式の注入)を防いでいる。

## REST API利用

- [x] 取得元アプリ(別アプリ)へのアクセスはすべて`kintone.api()`(内部向けラッパー)経由で行い、
      生の`fetch`/`XHR`は使用していない(`js/records-client.js`、`js/config.js`のフィールド一覧取得)。
      CLAUDE.md開発方針3のとおり、JavaScript APIで完結する部分(このアプリ自身のフィールド一覧
      `kintone.app.getFormFields()`、このアプリのレコード値の取得/設定`kintone.app.record.get()/set()`)は
      JavaScript APIを優先し、別アプリのレコード取得のみREST APIを使っている。
- [x] レコード取得のページングは`$id`昇順(`$id > 直前取得分の最大$id`)で行っており、`offset`の
      上限(10,000件)に達して取得が止まる、といった問題が起きない設計になっている
      (`js/lib/id-paging.js`、plugin_idea_plan.mdの共通の前提・訂正事項に準拠)。
- [x] レコード取得ループは`for`文による逐次実行(`await`を都度待つ)であり、並列に大量リクエストを
      送信していない(`js/records-client.js`の`fetchAllRecords()`)。secureCodingGuideline.mdの
      「短時間で大量のリクエスト送信を避ける」「並列で実行するのをなるべく避ける」に対応。
- [x] 取り込み件数に上限(既定300件、設定可能)を設け、ページ取得も上限到達後は打ち切っている
      (`js/lib/limit-guard.js`)。kintone公式ドキュメントの「1つのテーブルに大量の行を
      追加しないでください」という注意事項に対応している。

## 認証情報・外部通信

- N/A — 外部サービスとの認証・APIキーのやり取りは行わない。`kintone.plugin.app.setConfig()`に
      保存しているのは取得元アプリID・検索条件・フィールドマッピング・上限件数・ボタン文言のみで、
      認証情報や機密情報は含まれない(secureCodingGuideline.mdの「認証情報や認可情報を適切に
      取り扱う」の「推奨しない保存先」に抵触しない)。
- [x] kintone以外のサーバーへの外部通信は一切行わない(取得元アプリもcybozu.com上の別アプリであり、
      通信はkintone REST API/JavaScript APIの範囲に閉じている)。

## 実行タイミング・権限

- [x] 実行はレコード追加/編集画面のボタン押下起点のみで、レコード表示時の自動実行は行わない
      (plugin_idea_plan.mdの確定判断「ボタン起点が安全」を採用)。
- [x] 設定未完了(取得元アプリID・書き込み先サブテーブル・フィールドマッピングのいずれかが空)の
      アプリでは、ボタン自体を設置せず画面をクラッシュさせない(`js/desktop.js`/`js/mobile.js`の
      `isConfigured()`ガード。`kintone.plugin.app.getConfig()`が`null`を返すケースは
      `js/lib/config-store.js`の`load()`が既定値にフォールバックすることで吸収している)。
- N/A — 取得元アプリのレコード閲覧権限・このアプリのレコード編集権限は、kintone自体の
      アプリ権限設定に依存する(本プラグインが独自の権限制御を行っているわけではない)。
      権限がない場合はkintone REST API側がエラーを返し、実行時にアラート表示される。

## リダイレクト

- [x] `window.location.href`に渡す値は`kintone.app.getId()`など信頼できる内部値のみで、
      外部入力を含まない(`js/config.js`の保存後・キャンセル時の画面遷移)。

## 個別確認事項(利用ユーザーへ委ねる項目)

以下は開発側での事前検証は行わず、公開後に利用ユーザーからのフィードバックに委ねる。
問題があればGitHub Issueで報告してもらい対応する。

- 取得元アプリの選択肢名・ユーザー名などに、想定外の特殊文字(制御文字等)が含まれる場合の
  サブテーブル表示崩れ
- 各ブラウザ(Chrome/Edge/Safari等)での設定画面・ボタンの表示差異
- 大量件数(上限に近い数百件規模)取り込み時の実行時間・体感速度
