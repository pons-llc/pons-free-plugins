# fiscal_year_numbering セキュリティチェックリスト

[secureCodingGuideline.md](../secureCodingGuideline.md)の一般項目([box_gdrive_iframe/security-checklist.md](../box_gdrive_iframe/security-checklist.md)参照、UTF-8/BOMなし・名前空間分離・`'use strict'`・外部スクリプト不使用などは同様に満たしている)は重複記載を省略し、本プラグイン固有の項目のみ記載する。

最終確認日: 2026-07-09 / 対象: 初回実装時点

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

## 未解決の重大な検証結果: レコード画面での`getConfig()`が`null`を返す事象

実環境(Puppeteer)での検証で、以下を確認した。

- プラグイン設定画面(`config.js`)では`kintone.plugin.app.getConfig(PLUGIN_ID)`が保存済みの設定を正しく返す(保存→リロード→内容保持を確認済み)。
- 同一の`PLUGIN_ID`・同一アプリにもかかわらず、レコード一覧・詳細・作成画面(`desktop.js`)では`kintone.plugin.app.getConfig(PLUGIN_ID)`が一貫して`null`を返す。
- `PLUGIN_ID`自体は正しい値が取得できていること、アプリの「アプリを更新」(デプロイ)が完了していること、プラグインが「有効」であることは確認済みで、原因を特定できていない。

このままではレコード画面での自動採番が一切発動しない。原因不明の状態で画面全体をクラッシュさせないよう、`js/lib/config-store.js`の`load()`は`saved`が`null`/`undefined`でも例外を投げず既定値を返すようにし、`desktop.js`/`mobile.js`は「採番結果を保存するフィールド」「カウンター専用アプリID」のいずれかが未設定(＝設定不可な状態)なら何もせず抜けるガード(`isConfigured()`)を入れた。

- [ ] レコード画面での`getConfig()`が`null`を返す原因を特定し、修正する(現状は未解決。CLAUDE.md方針1に基づき、kintoneドキュメントMCPや検証環境の他の要因をさらに調査する必要がある)
- [x] 原因不明のまま放置せず、`isConfigured()`ガードにより画面クラッシュは防止済み(ただし採番機能そのものが動作しない状態は未解決)

## 個別確認事項(利用ユーザーへ委ねる項目)

- 官公庁側の会計年度定義(4月始まり固定)が例外的な会計年度設定を持つ組織で問題にならないか
- 改元当日をまたぐタイミングでの実運用での挙動確認
- カウンター専用アプリの一意制約違反エラーの実際のレスポンス形式(上記参照)

問題があれば、公開サイトのリポジトリのGitHub Issueで報告してもらい対応する。
