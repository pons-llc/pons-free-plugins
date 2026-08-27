# template_insert セキュリティチェックリスト

[secureCodingGuideline.md](../secureCodingGuideline.md)の一般項目([box_gdrive_iframe/security-checklist.md](../box_gdrive_iframe/security-checklist.md)参照、UTF-8/BOMなし・名前空間分離・`'use strict'`・外部スクリプト不使用などは同様に満たしている)は重複記載を省略し、本プラグイン固有の項目のみ記載する。

最終確認日: 2026-08-27(繰り返しブロック([[ ]]構文)、追加/上書き選択、テンプレート本文の
HTMLタグ許容への設計変更後に再確認)

## コーディング作法

- [x] 文字コードはUTF-8(BOMなし)
- [x] グローバル変数を作らず、即時関数(IIFE)+名前空間オブジェクト(`window.TemplateInsert`)のみを公開している(`js/lib/field-value-formatter.js`, `js/lib/field-catalog.js`, `js/lib/placeholder-resolver.js`, `js/lib/subtable-template.js`, `js/lib/template-body-resolver.js`, `js/lib/insert-composer.js`, `js/lib/radio-template-mapping.js`, `js/lib/config-store.js`, `js/lib/config-validation.js`)
- [x] 既存のkintoneグローバルオブジェクトを書き換え・参照していない
- [x] `'use strict'`を全JSファイルの先頭で使用している
- [x] kintone内部のid/class属性やDOM構造に依存せず、JavaScript API(`kintone.app.record.get()`/`set()`、`kintone.app.record.getHeaderMenuSpaceElement()`、`kintone.mobile.app.getHeaderSpaceElement()`、`kintone.app.getFormFields()`)のみを使用している。REST APIは一切使用していない

## 外部通信

- [x] kintone以外の外部サーバーへの通信(fetch/XHR)を一切行わない
- [x] 外部ライブラリを一切使用していない(vanilla JSのみ、`js/lib/`配下は依存なしの純粋関数)
- [x] REST APIも使用していない(すべてJavaScript APIで完結する。CLAUDE.md開発方針3)

## XSS対策(本プラグイン最大の固有リスク)

テンプレートのプレースホルダーは、レコードの実データ(他ユーザーが入力した可能性がある値)を
文字列として展開し、リッチエディター(HTMLとして描画されるフィールド)へ書き込む機能のため、
値のエスケープ漏れは直接XSSにつながる。

**信頼境界の設計判断**: テンプレート本文自体はエスケープしない(=本文に書いたHTMLタグは
そのままリッチエディターへ反映される)。本文はkintoneのプラグイン設定画面(アプリ管理権限を
持つユーザーのみ編集可能)で入力する、アプリ管理者にとって信頼できる文字列だからであり、
一般的なテンプレートエンジンの「テンプレートは信頼し、差し込むデータは信頼しない」という
区別と同じ考え方(idea.md「設計変更の経緯」参照)。一方、置換される各プレースホルダーの値は
他ユーザーが入力しうるレコードの実データであるため、こちらは必ずエスケープする。

- [x] 挿入先がリッチエディター(`RICH_TEXT`)の場合、`js/lib/placeholder-resolver.js`の
  `resolveTemplate()`が、置換される各プレースホルダーの値のみを
  `escapeHtml()`(`&`/`<`/`>`/`"`/`'`をエンティティ化)してから本文に埋め込む(本文自体は
  エスケープしない)。値に`<script>`・`onerror=`等が含まれていてもタグとして解釈されない
  (`__tests__/placeholder-resolver.test.js`「プレースホルダーの値に含まれるHTMLタグは
  エスケープされる(本文とは異なる扱い、XSS対策)」で確定的に検証済み)。`[[ ]]`の繰り返し
  ブロック内も`js/lib/template-body-resolver.js`が同じ`resolveTemplate()`を行ごとに呼び出す
  ため、同じ扱いになる(`__tests__/template-body-resolver.test.js`「本文のHTMLタグ(ブロック
  内外とも)はそのまま反映され、プレースホルダーの値だけHTMLエスケープされる」で検証済み)
- [x] テンプレート本文への書き込みはkintoneのプラグイン設定画面(`kintone.plugin.app.setConfig()`)
  経由のみで、アプリ管理権限を持つユーザーしか到達できない(kintone標準の権限モデル)。
  レコードのフィールド値(通常権限のユーザーが入力しうる)が本文自体に混入する経路は無い
- [x] 挿入先が文字列複数行(`MULTI_LINE_TEXT`)の場合はプレーンテキストとして扱われ、kintone標準の
  フィールド値レンダリングを経由するためHTMLとして解釈されない(エスケープ不要)
- [x] `desktop.js`/`mobile.js`から`js/lib`への値の受け渡しはすべて`record.get()`で取得した
  フィールドオブジェクトの`value`(文字列)であり、DOM操作(`innerHTML`等)を経由しない
- [x] 挿入先フィールドへの書き込みは`kintone.app.record.set()`のみで行い、`document.write`や
  `innerHTML`への直接代入は一切行わない

## 設定画面(config.js)のDOM構築

- [x] エラーメッセージ(`js-errors`)・警告メッセージ(`js-warnings`)の表示は`textContent`のみで
  行い、`innerHTML`は使用していない(設定画面はアプリ管理者自身が選んだ値の検証結果のみを表示する
  ため外部由来の文字列ではないが、念のため)
- [x] テンプレート行・ラジオ対応行のリスト再描画(`innerHTML = ''`)はリストをクリアするためだけの
  用途で、外部由来の文字列を差し込んでいない(`<template>`要素からの`cloneNode(true)`で行を組み立て、
  テンプレート名・本文はすべて`input.value`/`textarea.value`への直接代入)

## 設定の妥当性検証

- [x] 保存前に`js/lib/config-validation.js`でチェックし、不正な設定(テンプレート名・本文の未入力、
  挿入先フィールドが文字列複数行/リッチエディター以外、本文中の`[[`と`]]`の対応が崩れている、
  繰り返しブロック内のプレースホルダーがどのテーブルの列も指していない(または複数の異なる
  テーブルにまたがる)ため対象テーブルを一意に決定できない、ラジオボタン連動モードで連動
  フィールド未選択またはRADIO_BUTTON型以外、ラジオ対応が削除済みテンプレートIDを参照)は
  保存させない
- [x] `kintone.plugin.app.getConfig()`が`null`/`undefined`を返す場合でも、`js/lib/config-store.js`の
  `load()`は例外を投げず既定値を返す(`__tests__/config-store.test.js`で検証済み)。保存済みの
  JSON文字列が壊れている場合も既定値にフォールバックする
- [x] レコード画面側(`desktop.js`/`mobile.js`)でも、設定に含まれる挿入先フィールド・サブテーブルが
  実際のレコードに存在しない場合は早期リターンし(`if (!targetField)`)、画面をクラッシュさせない

## 追加/上書きモードについて(セキュリティへの影響なし)

- [x] ヘッダーの「追加」/「上書き」セレクトは、`js/lib/insert-composer.js`の
  `composeInsertedValue()`内で最終的な文字列の組み立て方(既存値に連結するか、置き換えるか)を
  変えるだけで、テンプレートの解決・エスケープ処理(`resolveInsertText`)は共通のパイプラインを
  経由する。そのためモードの選択自体が新たなエスケープ漏れ・注入経路を生むことはない
  (`__tests__/insert-composer.test.js`で両モードを確定的に検証済み)

## 通信・認証情報の取り扱い

- [x] REST APIを使用しないため、APIトークン等の認証情報自体を一切扱わない(secureCodingGuideline.md準拠)

## プレースホルダーの未解決トークンの扱い(セキュリティというより仕様上の注意)

- [x] 値マップに存在しないフィールドコードを指定した場合、`{フィールドコード}`のトークンをそのまま
  残す(サイレントに空文字列へ置換しない)。誤字や削除済みフィールドの参照に気付けるようにする
  意図的な仕様であり、idea.mdに明記した

## アクセス権に関する注意(個別確認事項)

- プレースホルダーで参照した値(他フィールドの内容)が、挿入先フィールドのアクセス権設定次第では
  元のフィールドより広い範囲のユーザーに見えるようになる可能性がある(例: 限定公開フィールドの値を
  全社員が見られる文字列複数行フィールドへ挿入する、等)。この点はプラグイン側では制御できないため、
  アプリ管理者がテンプレート本文・挿入先フィールドのアクセス権を設計する際に留意する必要がある
  (idea.mdには未記載のため、公開時のREADME等でも触れることが望ましい)

問題があれば、公開サイトのリポジトリのGitHub Issueで報告してもらい対応する。
