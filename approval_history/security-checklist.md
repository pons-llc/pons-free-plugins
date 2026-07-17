# approval_history セキュリティチェックリスト

[secureCodingGuideline.md](../secureCodingGuideline.md)の一般項目([box_gdrive_iframe/security-checklist.md](../box_gdrive_iframe/security-checklist.md)参照、UTF-8/BOMなし・名前空間分離・`'use strict'`・外部スクリプト不使用などは同様に満たしている)は重複記載を省略し、本プラグイン固有の項目のみ記載する。

最終確認日: 2026-07-17

## コーディング作法

- [x] 文字コードはUTF-8(BOMなし)
- [x] グローバル変数を作らず、即時関数(IIFE)+名前空間オブジェクト(`window.ApprovalHistory`)のみを公開している(`js/lib/approval-table-spec.js`, `js/lib/title-resolver.js`, `js/lib/history-row.js`, `js/lib/config-store.js`, `js/lib/deploy-poller.js`)
- [x] 既存のkintoneグローバルオブジェクトを書き換え・参照していない
- [x] `'use strict'`を全JSファイルの先頭で使用している

## REST API・外部通信(CLAUDE.md開発方針3参照)

- [x] フィールドの追加(`POST /k/v1/preview/app/form/fields.json`)・アプリ設定の運用環境への反映(`POST /k/v1/preview/app/deploy.json`)・反映状況確認(`GET /k/v1/preview/app/deploy.json`)・プロセス管理の設定確認(`GET /k/v1/preview/app/status.json`)は、いずれもJavaScript APIに相当機能が無いため、`kintone.api(kintone.api.url(path, true), method, body)`(kintone自身への呼び出し専用の内部ラッパー)のみを使用している。生の`fetch`/`XMLHttpRequest`でURLを直接組み立てていない
- [x] フィールド一覧の取得(`kintone.app.getFormFields()`)、実行ユーザー情報の取得(`kintone.getLoginUser()`)、所属組織・役職の取得(`kintone.user.getOrganizations()`)は、いずれもJavaScript APIを優先して使用している(CLAUDE.md開発方針3)
- [x] 外部ライブラリを一切使用していない(vanilla JSのみ、`js/lib/`配下は依存なしの純粋関数)。kintone以外の外部サーバーへの通信は一切行わない

## フィールド自動作成・アプリ設定変更のリスク

- [x] フィールド追加・デプロイAPIは「アプリ管理権限」を要求する(kintoneドキュメントに明記)。プラグイン設定画面を開けるユーザーは通常アプリ管理権限を持つ想定だが、権限不足で失敗した場合は`js/config.js`でエラー内容を表示し、`kintone.plugin.app.setConfig()`を呼ばずに処理を中断する(フィールド作成に失敗したまま設定だけ保存される不整合を防ぐ)
- [x] 同じフィールドコードを二重作成しないよう、`js/lib/approval-table-spec.js`で既存フィールド(型・内包フィールドの型込み)と突き合わせてから追加対象を決定する(冪等性、`__tests__/approval-table-spec.test.js`でテスト済み)。既存の別内容のフィールドとコードが衝突した場合は、既存フィールドの構造は書き換えず、連番を付けた別コードで新規作成し、設定画面に警告を表示する
- [x] フィールド追加後のデプロイは非同期APIのため、`js/lib/deploy-poller.js`でSUCCESSになるまでポーリングしてから`kintone.plugin.app.setConfig()`を呼ぶ。FAIL/CANCEL・タイムアウト時は例外を投げて保存させない(`time_band_aggregator`と同じ実装、`__tests__/deploy-poller.test.js`でテスト済み)

## 決裁履歴の記録内容(個人情報の取り扱い)

- [x] 実行ユーザーの氏名・ログインコード(`kintone.getLoginUser()`)、所属組織の役職名(`kintone.user.getOrganizations()`)を決裁履歴テーブルへ記録するが、いずれも対象アプリ自身のフィールド値として保存するのみで、kintone以外の外部サーバーへは一切送信しない
- [x] 記録した決裁履歴(実行ユーザー・役職を含む)は、対象アプリ自体のフィールドアクセス権・レコードアクセス権に従って閲覧が制御される。決裁履歴テーブルを誰が閲覧できるかは、アプリ管理者がフィールドのアクセス権設定で別途適切に設定する必要がある(プラグイン側では制御できない範囲であることをidea.mdに明記した)
- [x] `kintone.user.getOrganizations()`は1分あたり50回を超えるとPromiseがreject されうる仕様(kintoneドキュメントに明記)のため、失敗時は例外を握りつぶして役職を空文字列にする。役職が記録されないことより、決裁履歴の記録自体が失敗してプロセスアクションがブロックされることの方が業務上のリスクが大きいと判断した(idea.md参照)

## 編集禁止(disabled化)の仕様(セキュリティというより運用上の注意)

- [x] 決裁履歴テーブルの`disabled`化(作成画面・編集画面・一覧インライン編集)はJavaScript APIによるUIレベルの制御であり、REST API経由でのフィールド更新やアクセス権による制御ではない。「不正操作を防ぐ」機能ではなく「通常操作でのミスを防ぐUI上の制約」であることをidea.mdに明記した。テーブルの内容を本当に改ざんされたくない場合は、対象アプリのフィールドアクセス権設定(閲覧のみ許可等)を別途行う必要がある
- [x] `app.record.detail.process.proceed`イベント内での行追記(`event.record`の書き換え)は、`disabled`状態に関わらず反映される(kintoneドキュメント「フィールドの値を書き換える」の仕様どおり)。UIからの手入力のみを塞ぎ、プラグイン自身の自動記録は妨げない設計とした
- [x] **実機E2Eテストで判明した実装修正**: 当初`table.disabled = true`(SUBTABLEフィールド自体への設定)で実装していたが、実機検証(`config-save-and-field-creation.e2e.test.js`)でレコード作成画面に一切反映されないことが判明した(kintoneの`disabled`はSUBTABLE自体ではなく行内の個々のフィールドにのみ有効なため)。`js/lib/table-disabler.js`を追加し、既存行の内包フィールドを1つずつdisabledにする実装に修正した。行追加・削除ボタン自体を非表示にするAPIはkintoneに存在しないため、手動での空行追加自体は防げないが、追加された行のフィールドは`change.フィールドコード`イベントで即座に編集不可になる(idea.md参照)

## 設定の妥当性検証・エラー処理

- [x] `kintone.plugin.app.getConfig()`が`null`/`undefined`を返す場合でも、`js/lib/config-store.js`の`load()`は例外を投げず既定値(`{ fieldCodes: null }`)を返す
- [x] レコード画面側(`desktop.js`/`mobile.js`)でも、設定保存後に決裁履歴テーブルのフィールドが手動で削除された場合など、実際のレコードに存在しない場合は早期リターンし、画面をクラッシュさせない(プロセスアクション自体は妨げない)
- [x] プロセス管理の状態確認(`GET /k/v1/preview/app/status.json`)に失敗した場合(権限不足等)も、設定画面はクラッシュさせず「確認できませんでした」の表示に留め、保存自体はブロックしない

## 通信・認証情報の取り扱い

- [x] `kintone.api()`/`kintone.user.getOrganizations()`はログイン中のセッション情報を自動的に使用するため、APIトークンやパスワード等の認証情報をコード・設定に含めない(secureCodingGuideline.md準拠)

## XSS・CSSインジェクション対策

- [x] 設定画面(`js/config.js`)でプロセス管理の状態・作成済みフィールドコード・警告メッセージを描画する際、`innerHTML`ではなく`textContent`のみを使用している
- [x] レコード画面への値の書き込み(`desktop.js`/`mobile.js`)は`event.record[...].value`への代入のみで、DOM操作(`innerHTML`等)を一切行わない。実行ユーザーの氏名・役職はkintone標準のフィールド値レンダリングを経由するためHTMLとして解釈されない

問題があれば、公開サイトのリポジトリのGitHub Issueで報告してもらい対応する。
