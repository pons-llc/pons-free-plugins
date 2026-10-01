# record_review セキュリティチェックリスト

[secureCodingGuideline.md](../secureCodingGuideline.md)の一般項目([box_gdrive_iframe/security-checklist.md](../box_gdrive_iframe/security-checklist.md)参照、UTF-8/BOMなし・名前空間分離・`'use strict'`・外部スクリプト不使用などは同様に満たしている)は重複記載を省略し、本プラグイン固有の項目のみ記載する。

最終確認日: 2026-10-02(v4: 公式APIでの強調表示・kintone内部DOMへの依存の廃止)

## コーディング作法

- [x] 文字コードはUTF-8(BOMなし)
- [x] グローバル変数を作らず、即時関数(IIFE)+名前空間オブジェクト(`window.RecordReview`)のみを公開している(`js/lib/*.js`)。画面に追加するDOMのクラス名・IDは`rr-`/`rrc-`接頭辞で衝突を避けている
- [x] 既存のkintoneグローバルオブジェクトを書き換えていない
- [x] `'use strict'`を全JSファイルの先頭で使用している

## REST API・外部通信(CLAUDE.md開発方針3参照)

- [x] フィールド一覧・レイアウトの取得は`kintone.app.getFormFields()`/`kintone.app.getFormLayout()`、ログインユーザーは`kintone.getLoginUser()`と、JavaScript APIを優先している。詳細画面の表示だけではREST APIを1回も呼ばない
- [x] JavaScript APIに相当機能が無い次の処理のみ、`kintone.api(kintone.api.url(path, true), ...)`(kintone自身への呼び出し専用の内部ラッパー)で実行している。生の`fetch`/`XMLHttpRequest`でURLを組み立てていない
  - 設定画面: フィールド追加(`POST /k/v1/preview/app/form/fields.json`)・デプロイ(`POST`/`GET /k/v1/preview/app/deploy.json`)
  - 詳細画面: 指摘の登録・解決時の最新レコード取得(`GET /k/v1/record.json`)と更新(`PUT /k/v1/record.json`)
- [x] 外部ライブラリを一切使用していない(vanilla JSのみ)。kintone以外の外部サーバーへの通信は一切行わない

## レコード更新の安全性

- [x] (v3)指摘・解決のまとめて登録では、画面表示時のレコードの`$revision`を必ず`PUT`に指定する(楽観ロック)。表示後に他のユーザーが更新していた場合はkintoneが`GAIA_CO02`で拒否するため上書きは起きない。その場合のみ最新を`GET`して組み立て直し、そのリビジョンで再度`PUT`する。組み立て直しの結果、解決対象が既に解決済み・削除済みならエラーにして更新しない。再試行でも競合した場合は再読み込みを促すメッセージを表示する(E2Eで、別の利用者の更新が消えないことを確認済み)
- [x] (v3)再試行は1回だけ(無限に再試行してAPIを消費しない)。入力チェックはAPI呼び出しの前に行う
- [x] `PUT`ではテーブルの変更しない行を`{ id }`のみで送る(kintoneドキュメント「idだけを指定した行は値が保持される/指定しない行は削除される」)。これにより、他の行の値を古い値で上書きしたり、行を消したりしない(`__tests__/review-model.test.js`・E2E`review-flow.e2e.test.js`で、2件目追加後も1件目の解決内容が保持されることを確認済み)
- [x] 更新するのは指摘履歴テーブルのみで、他のフィールドは`record`に含めない
- [x] (v2/v3)まとめて登録は、下書きの指摘・解決全件を1回の`PUT`で反映する(途中まで登録されて残りが失敗する、という中途半端な状態にならない)。内容が空の下書きは送らず、全件空なら`PUT`しない(`__tests__/review-model.test.js`)
- [x] (v2)下書きはページ内のメモリ(`Map`)にのみ保持し、`localStorage`等には保存しない(指摘内容がブラウザに残らない)。未保存の下書きがある場合はページ離脱時に確認を出し、別レコードへ移動したときは破棄する
- [x] 指摘内容・解決内容が空(空白のみ)の場合、既に解決済みの指摘を再度解決しようとした場合、対象行が削除済みの場合は、`PUT`前に例外にして更新しない
- [x] レコード・フィールドの編集権限が無いユーザーの場合、`PUT`がkintone側で拒否され、エラーメッセージを表示する(プラグイン独自の権限判定は持たず、kintoneのアクセス権に従う)

## フィールド自動作成・アプリ設定変更のリスク

- [x] (v2)v1で作成済みのテーブルには、不足している「対象行ID」列だけをフィールド追加API(`POST`)で追加する。v1からある項目がすべて型まで一致するテーブルのみを対象とし(`isUpgradable()`、`__tests__/review-table-spec.test.js`)、既存の列・データは変更しない。テーブルのラベルは必須のため既存のラベルをそのまま指定し、名前を変えない。保存済みのテーブルコードを最優先で照合し、再保存で別のテーブルを増やさない
- [x] `approval_history`と同じ方式。アプリ管理権限が無く失敗した場合は`setConfig()`を呼ばずに中断する。既存フィールドと突き合わせて冪等に作成し(`__tests__/review-table-spec.test.js`)、別内容の同名フィールドがあれば既存は書き換えず連番コードで新規作成する。デプロイ完了をポーリングで待ってから設定を保存する(`js/lib/deploy-poller.js`)

## 指摘履歴テーブルの編集禁止(運用上の注意)

- [x] 追加・編集画面・一覧インライン編集での指摘履歴テーブルの`disabled`化はUIレベルの制約であり、REST API経由の更新やアクセス権による制御ではない(`approval_history`と同じ)。改ざんを確実に防ぎたい場合はフィールドのアクセス権設定を別途行う必要がある(idea.md参照)
- [x] 再利用(`event.reuse`)でレコードを追加する際は、コピー元の指摘を引き継がないよう指摘履歴テーブルを空にする

## 個人情報の取り扱い

- [x] 指摘者・対応者として`kintone.getLoginUser()`のログインコードをユーザー選択フィールドに保存するのみで、外部へは送信しない。閲覧範囲は対象アプリのレコード・フィールドのアクセス権に従う
- [x] 指摘モードのON/OFFのみ`localStorage`(キー`recordReview.mode.<アプリID>`)に保存する。個人情報・レコードの値は保存しない。`localStorage`が使えない環境でも例外を握りつぶして動作を継続する

## XSS・CSSインジェクション対策

- [x] 指摘内容・解決内容・ユーザー名・フィールド名など、利用者が入力した値やアプリ設定由来の値は、すべて`textContent`/`createTextNode`で描画している。`innerHTML`・`insertAdjacentHTML`・`outerHTML`は一切使用していない(設定画面・詳細画面・編集画面・モバイルすべて)
- [x] 利用者入力をCSS(`style`属性やクラス名)に埋め込んでいない。(v4)未解決の指摘があるフィールドの強調は、kintone公式の「フィールドのスタイルの設定」API(`setFieldStyle()`)に固定のカラーコードを渡して行い、`getFieldElement()`の要素の`style`は直接変更しない(`__tests__/field-highlight.test.js`、E2Eで`getFieldStyle()`により確認)
- [x] `getFieldElement()`で取得した要素の内部構造は変更も参照もしない(ドキュメント上、内部構造の変更は非推奨)。使うのは要素の位置(`getBoundingClientRect()`)だけで、バッジは`document.body`直下の独立したオーバーレイ層に配置している。固定ヘッダーに隠れたかどうかの判定に`elementFromPoint()`を使うが、これも位置の当たり判定のみでDOMは変更しない
- [x] (v4)テーブルの行ごとのバッジ(v2・v3でkintone内部の`<tr>`を読み取っていた)は廃止した。行への指摘はテーブルのバッジにまとめて表示し、行の一覧は`event.record`のテーブル値から作る。kintone内部のDOM構造には依存しない
- [x] 利用者入力を`data-*`属性に入れるのはフィールドコード・行IDのみで、`querySelector`のセレクター文字列には連結していない

## 設定の妥当性検証・エラー処理

- [x] `kintone.plugin.app.getConfig()`が`null`を返す・壊れたJSONの場合でも、`js/lib/config-store.js`は既定値を返す(`__tests__/config-store.test.js`)
- [x] 指摘できるフィールドが1つも選ばれていない場合は保存させない(E2E`config-screen.e2e.test.js`で確認)
- [x] 設定保存後に指摘履歴テーブルや対象フィールドが削除された場合も、早期リターン/候補からの除外で画面をクラッシュさせない

## 通信・認証情報の取り扱い

- [x] `kintone.api()`はログイン中のセッションを使用するため、APIトークン・パスワード等の認証情報をコード・設定に含めない

問題があれば、公開サイトのリポジトリのGitHub Issueで報告してもらい対応する。
