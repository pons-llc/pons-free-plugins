# budget_meter セキュリティチェックリスト

[secureCodingGuideline.md](../secureCodingGuideline.md)の一般項目([box_gdrive_iframe/security-checklist.md](../box_gdrive_iframe/security-checklist.md)参照、UTF-8/BOMなし・名前空間分離(`window.BudgetMeter`)・`'use strict'`・外部スクリプト不使用などは同様に満たしている)は重複記載を省略し、本プラグイン固有の項目のみ記載する。

最終確認日: 2026-08-13

## コーディング作法

- [x] 文字コードはUTF-8(BOMなし)
- [x] グローバル変数を作らず、即時関数(IIFE)+名前空間オブジェクト(`window.BudgetMeter`)のみを公開している(`js/lib/aggregator.js`, `js/lib/aggregatable-fields.js`, `js/lib/paged-fetch.js`, `js/lib/config-store.js`, `js/lib/view-matcher.js`, `js/lib/meter.js`, `js/lib/row-validator.js`, `js/lib/group-authorization.js`, `js/lib/view-filter-index.js`)
- [x] 既存のkintoneグローバルオブジェクトを書き換え・参照していない
- [x] `'use strict'`を全JSファイルの先頭で使用している
- [x] kintone内部のid/class属性やDOM構造に依存していない。プラグイン自身が描画したボタン・ダイアログ本文の要素を再取得する際は、`kintone.app.getHeaderMenuSpaceElement()`が返す要素の子から自プラグイン専用のクラス名(`.bm-check-button`/`.bm-all-button`)で検索しており、kintone内部のクラス名には依存していない

## REST API・外部通信(CLAUDE.md開発方針3参照)

- [x] 全一覧(view)の設定を取得するJavaScript APIは存在しないため、以下2つのREST APIを`kintone.api()`(kintone自身への呼び出し専用の内部ラッパー)経由で使う。生の`fetch`/`XMLHttpRequest`でURLを直接組み立てていない
  - `GET /k/v1/preview/app/views.json`(`js/config.js`): 設定画面(管理者のみが開く)が動作テスト環境の一覧一覧を読むために使う。アプリ管理権限が必要
  - `GET /k/v1/app/views.json`(`js/desktop.js`の`fetchProductionViewFilterConds`): 「すべての予算を確認」ボタン(一般利用者が押す)が運用環境の一覧のfilterCondを読むために使う。レコード閲覧/追加権限で足りる(アプリ管理権限は不要)。**config画面用のpreview版と実行時用の運用環境版を混同しないこと**(idea.md「API仕様確認」参照)
- [x] 自アプリのレコードを「クエリ条件に該当する全件」の単位で合計するJavaScript APIは存在しないため、`GET /k/v1/records.json`をREST(`kintone.api()`)で使う。書き込みは一切行わない(読み取り専用の集計)
- [x] `kintone.api.url(path, true)`の第2引数`true`によりドメイン部分を自動解決させ、外部ドメインへのリクエストになる余地をコード上排除している(`js/config.js`, `js/desktop.js`いずれも)
- [x] kintone以外の外部サーバーへの通信(fetch/XHR)を一切行わない
- [x] 外部ライブラリを一切使用していない(vanilla JSのみ、`js/lib/`配下は依存なしの純粋関数)

## XSS・CSSインジェクション対策

- [x] `kintone.createDialog()`のドキュメント注意事項(`config.body`に渡したElementはそのままダイアログ本文に組み込まれるため要サニタイズ)を踏まえ、ダイアログ本文(`js/desktop.js`の`buildMeterRow`/`openAllBudgetsDialog`)は`document.createElement()` + `textContent`のみで組み立てており、`innerHTML`へ動的な値(合計額・一覧名・ラベル・エラーメッセージ)を差し込んでいない
- [x] 設定画面(`js/config.js`)のドロップダウン選択肢・行の再描画も同様に`document.createElement()` + `textContent`のみを使用し、`innerHTML = ''`はリストをクリアする用途のみに限定している

## 設定の妥当性検証

- [x] 保存前に`js/lib/row-validator.js`でチェックし、不正な行(対象の一覧・集計対象フィールド未選択、予算額が0以下、しきい値が数値でない、警告しきい値が危険しきい値を超える)は保存させない(具体的な行番号とエラー内容をalertで示す)
- [x] `kintone.plugin.app.getConfig()`が`null`/`undefined`を返す場合でも、`js/lib/config-store.js`の`load()`は例外を投げず既定値(`{ rows: [], allViewsGroupCodes: [] }`)を返す
- [x] 予算額が0以下の行を保存させないことで、`js/lib/meter.js`の`compute()`内での0除算・無意味な100%表示を設計時点で防いでいる(`compute()`自体も防御的に`budget > 0`でない場合は例外を投げる二重の防御)

## 通信・認証情報の取り扱い

- [x] `kintone.api()`はログイン中のセッション情報を自動的に使用するため、APIトークンやパスワード等の認証情報をコード・設定に含めない
- [x] `kintone.plugin.app.setConfig()`に保存しているのは一覧ID・フィールドコード・予算額・しきい値・グループコードなどの設定値のみで、認証情報や機微なレコードデータそのものは含まれない

## 「すべての予算を確認」ボタンのグループ制限の限界(重要)

`kintone.user.getGroups()`(所属グループの取得。画面遷移までキャッシュ、1分50回超でreject)で判定した許可グループに基づき、`js/lib/group-authorization.js`の`isAuthorized()`がボタンの表示・非表示を切り替えるが、**これはクライアント側の表示ゲートに過ぎず、真の権限制御ではない**(`related_record_summary`の一括集計ボタンと同じ注意点、idea.md「グループ制限の限界」参照)。

- ボタンを非表示にしても、対象グループに属さないユーザーが直接REST APIを呼び出せば同じ集計は可能である。
- 本プラグインは読み取り専用の集計であり、レコード自体の閲覧・編集権限を変更するものではないため、実害は「本来見せたくない集計結果をUI上見せてしまう」という範囲に限られる(レコードの改ざん・削除等のリスクは無い)。
- 許可グループコードが1件も設定されていない場合は誰にも表示しない(「空 = 全員許可」ではなく「空 = 誰も許可しない」という安全側のデフォルト、`js/lib/group-authorization.js`でTDD済み)。
- この限界を許容できない場合は、アプリ自体のレコード閲覧権限・フィールドのアクセス権設定で、集計対象フィールドの値を見せたくないユーザーへの閲覧自体を制限する運用が必要になる。

## 一覧に紐づく設定が古くなった場合の挙動(セキュリティというより堅牢性)

- [x] 予算設定行が参照する一覧が削除・未デプロイ等で運用環境の一覧設定に見つからない場合、`js/desktop.js`の`openAllBudgetsDialog`はその行をエラーにせずスキップし、スキップ件数をダイアログ内に表示する(画面をクラッシュさせない)
- [x] 集計対象フィールドがアプリ設定変更で削除された場合、レコード取得時に該当フィールドのプロパティが存在せず`undefined`になるが、`js/lib/aggregator.js`の数値変換ガードで自動的に集計から除外され(0扱い)、例外にはしない

問題があれば、公開サイトのリポジトリのGitHub Issueで報告してもらい対応する。
