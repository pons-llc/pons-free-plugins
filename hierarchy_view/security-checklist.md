# hierarchy_view セキュリティチェックリスト

[secureCodingGuideline.md](../secureCodingGuideline.md)の一般項目([box_gdrive_iframe/security-checklist.md](../box_gdrive_iframe/security-checklist.md)参照、UTF-8/BOMなし・名前空間分離・`'use strict'`・外部スクリプト不使用などは同様に満たしている)は重複記載を省略し、本プラグイン固有の項目のみ記載する。

最終確認日: 2026-07-10 / 対象: 初回実装時点

## コーディング作法

- [x] 文字コードはUTF-8(BOMなし)
- [x] グローバル変数を作らず、即時関数(IIFE)+名前空間オブジェクト(`window.HierarchyView`)のみを公開している(`js/lib/tree-builder.js`, `js/lib/cycle-check.js`, `js/lib/pending-changes.js`, `js/lib/config-store.js`, `js/lib/config-validation.js`)
- [x] 既存のkintoneグローバルオブジェクトを書き換え・参照していない
- [x] `'use strict'`を全JSファイルの先頭で使用している
- [x] kintone内部のid/class属性やDOM構造に依存せず、JavaScript API・`kintone.api()`(内部向けラッパー)のみを使用している

## REST API・外部通信(CLAUDE.md開発方針3参照)

- [x] 「全件表示」(現在のクエリに一致する全レコード取得)・「保存」(保留中の親変更の一括反映)はいずれもJavaScript APIで実現できないため、REST必須。呼び出しは必ず`kintone.api(kintone.api.url(path, true), method, params)`(kintone自身への呼び出し専用の内部ラッパー)のみを使用し、生の`fetch`/`XMLHttpRequest`でURLを直接組み立てていない
- [x] `app`パラメータは常に`kintone.app.getId()`(自アプリのID、信頼できる内部値)を使用する
- [x] 全件取得は`plugin_idea_plan.md`の全件取得方針(`$id`昇順+`$id > 直前最大$id`によるページング、500件ずつ)に従い、`offset`・カーソルAPIは使用しない
- [x] 一括更新(`PUT /k/v1/records.json`)は1リクエストあたり100件を上限に分割する(`js/lib/pending-changes.js`の`buildUpdateRequestBodies()`、kintone REST APIの仕様上限)
- [x] kintone以外の外部サーバーへの通信(fetch/XHR)を一切行わない
- [x] 外部ライブラリを一切使用していない(vanilla JSのみ。ドラッグ&ドロップも標準のHTML5 Drag and Drop APIのみで実装し、外部UIライブラリは使用しない)

## 循環参照・データ整合性(本プラグイン固有の重要項目)

- [x] ドラッグ&ドロップによる親変更は、`js/lib/cycle-check.js`の`wouldCreateCycle()`で移動先が移動元レコード自身の子孫でないことを事前に検証し、循環参照を生む移動はUI上で拒否する(保留リストに追加させない)
- [x] `js/lib/tree-builder.js`のツリー構築処理は訪問済みノードを記録し、既存データに循環参照がある場合でも無限ループでブラウザをフリーズさせない(`判断記録.md`の2番)

## XSS対策

- [x] ツリーノードのラベル(レコードの表示用フィールド値)をDOMへ描画する際、`innerHTML`ではなく`document.createElement()` + `textContent`のみを使用する
- [x] 設定画面(`js/config.js`)でフィールド一覧・エラーメッセージを描画する際も同様に`innerHTML`ではなく`document.createElement()` + `textContent`のみを使用している

## 設定の妥当性検証

- [x] 保存前に`js/lib/config-validation.js`でチェックし、不正な設定(親フィールド未選択、照合対象フィールド未選択)は保存させない
- [x] `kintone.plugin.app.getConfig()`が`null`/`undefined`を返す場合でも、`js/lib/config-store.js`の`load()`は例外を投げず既定値(`{ parentFieldCode: '', matchFieldCode: '' }`)を返す
- [x] 一覧画面側(`desktop.js`)でも、設定に含まれるフィールドが実際のアプリに存在しない場合(フィールド削除・設定の食い違い等)はツリー描画をスキップし、画面をクラッシュさせない

## 通信・認証情報の取り扱い

- [x] `kintone.api()`はログイン中のセッション情報を自動的に使用するため、APIトークンやパスワード等の認証情報をコード・設定に含めない(secureCodingGuideline.md準拠)

## 保存の仕様に関する注意(セキュリティというより運用上の注意)

- [x] ドラッグ&ドロップ操作自体はサーバーへの通信を伴わず、明示的に「保存」ボタンを押すまでレコードは更新されないことを`idea.md`に明記した。ブラウザを閉じる・リロードすると保留中の変更は失われる(未保存の変更を保持する仕組みは実装しない、スコープ外)

## アクセス権に関する注意(個別確認事項)

- 一括更新はログイン中のユーザー権限で実行されるため、編集権限のないレコードへの親変更は失敗する。部分失敗時にどのレコードが更新できなかったかを結果表示する必要がある(未実装のグルーコード側で今後対応、`idea.md`のスコープ外)

問題があれば、公開サイトのリポジトリのGitHub Issueで報告してもらい対応する。
