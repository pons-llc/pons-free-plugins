# fiscal_year_numbering セキュリティチェックリスト

[secureCodingGuideline.md](../secureCodingGuideline.md)の一般項目([box_gdrive_iframe/security-checklist.md](../box_gdrive_iframe/security-checklist.md)参照、UTF-8/BOMなし・名前空間分離・`'use strict'`・外部スクリプト不使用などは同様に満たしている)は重複記載を省略し、本プラグイン固有の項目のみ記載する。

最終確認日: 2026-07-14 / 対象: 採番タイミング機能(保存時/ボタン押下時/ステータス変化時)追加時点

## カウンター専用アプリの権限モデル

- [x] カウンター専用アプリの一般権限は「閲覧+作成のみ許可(編集・削除は不可)」であり、`provisioning/seed-counter-app.js`がこの設定を自動化している(`recordEditable: false`, `recordDeletable: false`)
- [x] カウンター専用アプリへの操作は`kintone.api()`(ログインユーザー自身のセッション)のみで行い、APIトークン・`kintone.plugin.app.setProxyConfig()`・`kintone.plugin.app.proxy()`は一切使用していない(`js/counter-client.js`)
- [ ] 「アプリを作成するAPI」はAPIトークン認証が使えない仕様のため、`provisioning/seed-counter-app.js`はパスワード認証(`.env`の`KINTONE_USERNAME`/`KINTONE_PASSWORD`)を使っている。この`.env`は`.gitignore`対象であることを確認する

## 排他制御(カウンターの追記型ログ設計)

- [x] カウンター専用アプリはレコードを更新せず、新規作成(追記)のみで運用する設計になっている(`js/counter-client.js`に`PUT`呼び出しが存在しない)
- [x] 排他制御は一意制約フィールド(`key_sequence`)への違反検知+再試行(`js/lib/retry.js`)によって行い、無限リトライにならないよう最大試行回数を設けている(`retry.test.js`で保証)
- [ ] 一意制約違反の判定(`js/counter-client.js`の`isUniqueConstraintViolation`)は、kintone REST APIの実際のエラーレスポンス(`code`/`message`)をPuppeteerでの実環境テストで確認し、必要であれば判定条件を調整する(ドキュメント上でエラーコードが網羅的に一覧化されていないため、現状は`CB_VA01`および文言に「重複」を含むことで判定している)

## 対象アプリへの書き込み

- [x] 対象アプリへの番号の書き込みは`kintone.api()`のみで行い、対象アプリの編集権限が「関係者は全レコード編集可」という広めの運用であることを前提にしている(`idea.md`に明記)。この前提が崩れる(特定レコードのみ編集可、等)運用に変わった場合、詳細画面・一覧画面・一括採番での書き込みが権限エラーになり得るため、設計の見直しが必要になる旨をidea.mdに記載済み
- [x] 一覧画面・一括採番でのAPI呼び出しは逐次実行であり、並列に大量リクエストを送っていない(`js/desktop.js`/`js/mobile.js`/`js/bulk-numbering.js`はいずれも`for...of`でのシーケンシャル処理)

## 一括採番の権限制御

- [x] 一括採番ボタンの表示条件は`kintone.user.getGroups()`が設定画面で指定したグループコードを含むかどうかで判定している(`js/bulk-numbering.js`)
- [ ] 上記はクライアント側の表示ゲートに過ぎず、真の権限境界ではないことを認識している。真の権限境界は対象アプリ自体のkintone権限設定(レコード編集権限)であり、それに依存する設計であることをidea.mdに明記済み
- [x] `kintone.user.getGroups()`は一覧表示イベントごとに高々1回しか呼び出しておらず(レコード単位では呼び出していない)、ドキュメントに記載のレート制限(50回/ユーザー/分)に抵触しない

## REST API利用(本プラグインの核心機能)

- [x] REST API呼び出しはすべて`kintone.api()`経由であり、生の`fetch`/`XHR`は使用していない(`provisioning/seed-counter-app.js`・`scripts/kintone-admin.js`はNode環境からの管理用スクリプトのため例外的にNode標準の`https`モジュールを使用しており、ブラウザで動くプラグイン本体のコードではない)
- [x] CLAUDE.md方針3(JavaScript API優先)の中で、フィールド発見(`kintone.app.getFormFields()`)はJavaScript APIを使い、採番の実処理(カウンター参照・作成、対象アプリへの書き込み)のみREST APIを使う設計であることをidea.mdに明記している

## 解決済み: レコード画面での`getConfig()`が`null`を返す事象

実環境(Puppeteer)での再検証で原因を特定し、修正した。

- プラグイン設定画面(`config.js`)では`kintone.plugin.app.getConfig(PLUGIN_ID)`が保存済みの設定を正しく返す。
- レコード画面(`desktop.js`)では、**画面表示直後の最初の呼び出し**でkintone側の内部準備が間に合わず`null`が
  返ることがある(プラグインが本当に未設定の場合の`null`と区別がつかない)。同一ページ内で2つ目以降の
  イベントが発生する頃には正しい値が返ることを実機で確認した(例: 新規作成の保存直後に発生する
  `create.submit`→`detail.show`の連続イベントで、1回目は`null`・2回目は正しい値、というケースを確認)。
  デプロイ未完了が原因ではないことも、REST API(`kintoneAdmin.deployApp()`)による確実なデプロイ後も
  再現することから切り分け済み。
- 対策として、`desktop.js`/`mobile.js`の`loadConfig()`を非同期化し、`getConfig()`が`null`を返した場合は
  200ms刻み(最大5回、合計最大3000ms)でリトライしてから「未設定」と判断するようにした。

- [x] レコード画面での`getConfig()`が`null`を返す原因(画面表示直後のタイミング問題)を特定し、リトライにより修正した(`js/desktop.js`/`js/mobile.js`の`loadConfig()`)。「保存時」「ボタン押下時」「ステータス変化時」いずれの採番タイミングも実機(Puppeteer)で実際に番号が保存されることを確認済み
- [x] 原因不明のまま放置せず、`isConfigured()`ガードにより画面クラッシュは防止されていた(リトライを使い切って`null`のままだった場合の最終防御として引き続き有効)

## 採番タイミング機能(保存時/ボタン押下時/ステータス変化時)

- [x] 「ボタン押下時」の`js/numbering-button.js`は、成功時のみ`kintone.api()`のPUTで永続化してから画面表示を更新する(`kintone.app.record.set()`/`kintone.mobile.app.record.set()`)。この呼び出しはボタンの`click`ハンドラー(`kintone.events.on()`のイベントハンドラーではない)からのみ行っており、公式ドキュメントの「イベントハンドラー内では実行できません」という制限には抵触しない
- [x] 「ステータス変化時」の`app.record.detail.process.proceed`ハンドラーは、`event.record`を書き換えて`return`する公式にサポートされた方法のみを使い、`record.set()`は使わない。この操作にはレコード/フィールドの編集権限が必要という仕様上、対象アプリの編集権限が広い運用であることが前提になる(idea.md「対象アプリへの書き込み」と同じ前提)
- [x] プラグイン設定画面での「採番トリガーとなるステータス」選択肢は、`kintone.api()`経由で`/k/v1/app/status.json`(REST API)を取得して作る。`kintone.app.getStatus()`(JavaScript API)は「利用できる画面」にプラグイン設定画面が含まれておらず`is not a function`エラーになることを実機で確認したため使用していない
- [x] 一括採番実行前に、対象アプリでプロセス管理が有効な場合は`kintone.app.getStatus()`で判定し、「一括採番はステータスに関わらず未採番のレコードすべてを対象とする」旨を確認ダイアログで警告する(`js/bulk-numbering.js`)。検索クエリ自体(`${numberFieldCode} is empty ...`)は変更していない

## 個別確認事項(利用ユーザーへ委ねる項目)

- 官公庁側の会計年度定義(4月始まり固定)が例外的な会計年度設定を持つ組織で問題にならないか
- 改元当日をまたぐタイミングでの実運用での挙動確認
- カウンター専用アプリの一意制約違反エラーの実際のレスポンス形式(上記参照)

問題があれば、公開サイトのリポジトリのGitHub Issueで報告してもらい対応する。
