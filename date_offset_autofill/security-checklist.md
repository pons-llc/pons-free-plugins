# date_offset_autofill セキュリティチェックリスト

[secureCodingGuideline.md](../secureCodingGuideline.md)の一般項目([box_gdrive_iframe/security-checklist.md](../box_gdrive_iframe/security-checklist.md)参照、UTF-8/BOMなし・名前空間分離・`'use strict'`・外部スクリプト不使用などは同様に満たしている)は重複記載を省略し、本プラグイン固有の項目のみ記載する。`text_slice`と設計方針が共通する項目(submit限定発動、disabled化の範囲、設定バリデーション方針)は理由の重複記載を省略する。

最終確認日: 2026-08-21 / 対象: 一覧インライン編集(`app.record.index.edit.submit`)対応の追加、および設定画面へのCALCオフセットcaution追加

## コーディング作法

- [x] 文字コードはUTF-8(BOMなし)
- [x] グローバル変数を作らず、即時関数(IIFE)+名前空間オブジェクト(`window.DateOffsetAutofill`)のみを公開している(`js/lib/offset-calculator.js`, `js/lib/config-store.js`, `js/lib/config-validation.js`)
- [x] 既存のkintoneグローバルオブジェクトを書き換え・参照していない
- [x] `'use strict'`を全JSファイルの先頭で使用している
- [x] kintone内部のid/class属性やDOM構造に依存せず、JavaScript API(`kintone.app.getFormFields()`, `kintone.plugin.app.getConfig/setConfig()`, `kintone.events.on()`のイベントオブジェクト経由の値書き換え・`disabled`設定)のみを使用している

## REST API・外部通信

- [x] 本プラグインはREST APIを一切使用しない(CLAUDE.md開発方針3に準拠)。CALC(計算)フィールドの値も含め、`event.record`(submitイベントのイベントオブジェクト)からブラウザ上で既に計算済みの値を読み取るだけで完結する
- [x] kintone以外の外部サーバーへの通信(fetch/XHR)を一切行わない
- [x] 外部ライブラリを一切使用していない(vanilla JSのみ、`js/lib/`配下は依存なしの純粋関数。`Date`等の標準APIのみ使用)

## XSS・CSSインジェクション対策

- [x] 設定画面(`js/config.js`)でフィールド一覧・エラーメッセージを描画する際、`innerHTML`ではなく`document.createElement()` + `textContent`のみを使用している
- [x] ルール行のリスト再描画(`innerHTML = ''`)はリストをクリアするためだけの用途で、外部由来の文字列を差し込んでいない(`<template>`要素からの`cloneNode(true)`で行を組み立てる)
- [x] 出力先フィールドへの書き込み(`desktop.js`/`mobile.js`の`applyRules()`)は`event.record[...].value`への文字列代入と`event.record[...].disabled`の真偽値設定のみで、DOM操作(`innerHTML`等)を一切行わない

## 設定の妥当性検証

- [x] 保存前に`js/lib/config-validation.js`の`validateRules()`でチェックし、不正な設定(基準/出力先フィールド未選択、基準フィールドと出力先フィールドの型不一致、単位「分数」とDATE型の組み合わせ、出力先フィールドと基準フィールドの重複、出力先フィールドの重複、固定値が数値でない、フィールド参照時の参照フィールド未選択・数値以外のフィールドの選択)は保存させない
- [x] `kintone.plugin.app.getConfig()`が`null`/`undefined`を返す場合(未設定のアプリ)でも、`js/lib/config-store.js`の`load()`は例外を投げず既定値(`{ rules: [] }`)を返す
- [x] レコード画面側(`desktop.js`/`mobile.js`)でも、設定に含まれる基準・出力先・オフセット参照フィールドが実際のレコードに存在しない場合は早期リターンし、画面をクラッシュさせない
- [x] オフセット値が数値として解決できない場合(固定値が不正、フィールド参照先の値が空/非数値)は、そのルールをスキップして出力先フィールドを変更しない(`js/lib/offset-calculator.js`の`resolveOffsetMagnitude()`が`null`を返す設計。不正な入力で保存処理全体を止めたり、意図しない値を書き込んだりしない)

## 日付演算の妥当性

- [x] DATE型フィールドの演算は常にUTCタイムスタンプで行い、ローカルタイムゾーン・DST(夏時間)の影響を受けない(idea.md「日付演算の実装方針」参照。`age_grade_field_update`のローカル日付切り出しの教訓を踏まえ、より安全なUTC一本化にした)
- [x] `Date`が表現できない極端な値(`Invalid Date`)になった場合、`js/lib/offset-calculator.js`の`applyOffset()`は`null`を返し、出力先フィールドを変更しない(例外を投げて画面をクラッシュさせない)

## 一覧インライン編集(`app.record.index.edit.submit`)固有のリスク

- [x] kintoneドキュメントMCPで確認した制限事項(一覧に配置していないCALCフィールドの値は「再計算前の値」のまま返る)により、インライン編集コンテキストでCALCフィールドをオフセット参照に使うルールをそのまま計算すると、誤った日付を無言で書き込んでしまうリスクがあった。`js/lib/offset-calculator.js`の`isUnreliableInlineEditOffset()`でこの組み合わせを検出し、`app.record.index.edit.submit`ではそのルールの計算自体をスキップする設計にした(ユニットテストで確定的に検証済み)
- [x] 同じ制限事項の「一覧に配置している場合は空文字列になる」ケースは、既存の「オフセット値が数値として解決できない場合はスキップする」ロジック(`resolveOffsetMagnitude()`)がそのまま安全に機能する(誤った値を書き込むことはない)
- [x] 固定値(`FIXED`)ルール、およびNUMBER型フィールドを参照するルールはこの制限を受けないため、一覧インライン編集でも通常の追加・編集画面と同じロジックで再計算される
- [x] 2026-08-21追加: このスキップ自体は意図通り正しく機能しているが(ユーザーによる実機検証`app 736`で`event.record`のダンプを確認、出力先フィールドは正しく含まれておりCALCフィールドの値だけが信頼できないことを確認済み)、ユーザーが設定時にこの制限を知る手段が無かったため、設定画面(`js/config.js`)でオフセット参照フィールドに計算(CALC)フィールドを選んだ場合にcaution(注意書き)を表示するようにした(`OffsetCalculator.isUnreliableInlineEditOffset()`を再利用、ロジック自体の変更はしていない)
- [x] 2026-08-21追加(再改訂): 設定時のcautionに加え、レコード一覧でこのルールに実際に触れた時点でも気づけるよう、`app.record.index.edit.show`(インライン編集を**開始した時点**)で`collectUnreliableCalcTargets()`により対象を判定し`alert()`で通知するようにした(当初は`app.record.index.edit.submit`〈保存時〉に出していたが、基準フィールドを変更する前に気づけるよう開始時に変更)。`event.error`(保存をキャンセルする画面上部エラー)ではなく`alert()`を使うことで、表示・保存自体は妨げない設計にしている
- [x] 2026-08-21追加(再々改訂): 一覧画面のインライン編集(`app.record.index.edit.show`)では、CALCフィールドをオフセット参照に使うルールの出力先フィールド**だけ**を`disabled`化の対象から除外するようにした(`disableTargetFields(record, excludeTargetFieldCodes)`に除外リストを渡す設計に変更)。固定値・NUMBERフィールド参照のルールの出力先フィールドは、この画面でも通常どおり再計算されるため、引き続き`disabled`のままにする(全ルール一律でdisabled解除にはしない)

## 通信・認証情報の取り扱い

- N/A — 外部サービスとの認証・APIキーのやり取りを行わない

## 編集禁止(disabled化)の仕様(セキュリティというより運用上の注意)

- [x] 出力先フィールドの`disabled`化(通常の追加・編集画面は全ルール一律。一覧インライン編集では、2026-08-21改訂によりCALCフィールド参照ルールの出力先だけを除外し、それ以外は引き続きdisabled化)はJavaScript APIによるUIレベルの制御であり、REST API経由でのフィールド更新やアクセス権による制御ではない。「不正操作を防ぐ」機能ではなく「基準フィールドから自動計算される値を手動編集で不整合にさせないためのUI上の制約」であることを`idea.md`に明記した(`text_slice/security-checklist.md`と同じ注意事項)

## 個別確認事項(利用ユーザーへ委ねる項目)

- 出力先フィールドを手直ししたいという使い勝手上の指摘があれば、`number_extract`と同様の「disabledなし」への変更を検討する([feedback_autofill_field_editability]参照、プラグインごとの判断)
- 一覧画面のインライン編集(`app.record.index.edit`)で基準フィールドを直接変更して保存した場合は本プラグインも再計算する(2026-08-21対応)。ただしCALCフィールドをオフセット参照に使うルールは、上記「一覧インライン編集固有のリスク」の理由により計算をスキップし出力先フィールドが古い値のまま残り得る(意図的な安全策であり、設定画面のcautionでユーザーに明示済み)

問題があれば、公開サイトのリポジトリのGitHub Issueで報告してもらい対応する。
