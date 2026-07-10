# subtable_lookup セキュリティチェックリスト

[secureCodingGuideline.md](../secureCodingGuideline.md)の一般項目([box_gdrive_iframe/security-checklist.md](../box_gdrive_iframe/security-checklist.md)参照、UTF-8/BOMなし・名前空間分離・`'use strict'`・外部スクリプト不使用などは同様に満たしている)は重複記載を省略し、本プラグイン固有の項目のみ記載する。

最終確認日: 2026-07-09 / 対象: 初回実装時点

## コーディング作法

- [x] 文字コードはUTF-8(BOMなし)
- [x] グローバル変数を作らず、即時関数(IIFE)+名前空間オブジェクト(`window.SubtableLookup`)のみを公開している(`js/lib/row-finder.js`, `js/lib/row-mapper.js`, `js/lib/config-store.js`, `js/lib/config-validation.js`)
- [x] 既存のkintoneグローバルオブジェクトを書き換え・参照していない
- [x] `'use strict'`を全JSファイルの先頭で使用している
- [x] kintone内部のid/class属性やDOM構造に依存せず、JavaScript API(`kintone.app.getFormFields()`, `kintone.plugin.app.getConfig/setConfig()`, `kintone.events.on()`のイベントオブジェクト経由の値書き換え)のみを使用している

## REST API・外部通信

- [x] 本プラグインはREST APIを一切使用しない(CLAUDE.md開発方針3に準拠)。`kintone.app.getFormFields()`(JS API)でフィールド一覧(サブテーブルとサブテーブル内フィールドを含む)を取得するのみで、レコードの読み書きはすべて`kintone.events.on()`のイベントオブジェクト(`event.record`)の書き換え、または設定画面での`kintone.plugin.app.setConfig()`のみで完結する
- [x] kintone以外の外部サーバーへの通信(fetch/XHR)を一切行わない
- [x] 外部ライブラリを一切使用していない(vanilla JSのみ、`js/lib/`配下は依存なしの純粋関数)

## XSS・CSSインジェクション対策

- [x] 設定画面(`js/config.js`)でフィールド一覧・エラーメッセージを描画する際、`innerHTML`ではなく`document.createElement()` + `textContent`のみを使用している(選択肢の`option`要素、`errorsEl.textContent`でのバリデーションエラー表示)。フィールドラベルはアプリ管理者が設定した文字列であり利用者からの直接入力ではないが、念のため`textContent`で統一している
- [x] 設定行・フィールドマッピング行のリスト再描画(`innerHTML = ''`)はリストをクリアするためだけの用途で、外部由来の文字列を差し込んでいない(`<template>`要素からの`cloneNode(true)`で行を組み立てる)
- [x] 出力先フィールドへの書き込み(`desktop.js`/`mobile.js`の`applyLookups()`)は`event.record[...].value`への値代入のみで、DOM操作(`innerHTML`等)を一切行わない。kintone側のフィールド描画(テキストボックス等への値表示)はkintone自身が担うため、XSS対策はkintone本体のレンダリングに委ねられる
- [x] 「一致させる値」(`matchValue`)は設定画面でアプリ管理者が入力する文字列で、`js/lib/row-finder.js`内の比較(`String#includes`/`===`)にのみ使われ、DOMへ描画されることはない
- [x] 外部サイトへのリダイレクト・URL生成を行っていない。`window.location.href`に渡す値は`kintone.app.getId()`など信頼できる内部値のみ(`js/config.js`の保存後・キャンセル時の画面遷移)

## 設定の妥当性検証

- [x] 保存前に`js/lib/config-validation.js`の`validateLookups()`でチェックし、不正な設定(対象サブテーブル未選択、未知の検索モード、モードに応じて必須の検索対象列/一致させる値の未入力、フィールドマッピング0件、マッピングの列/出力先未選択、出力先フィールドの重複)は保存させない
- [x] `kintone.plugin.app.getConfig()`が`null`/`undefined`を返す場合(未設定のアプリ)でも、`js/lib/config-store.js`の`load()`は例外を投げず既定値(`{ lookups: [] }`)を返す(`fiscal_year_numbering`/`wareki_date_format`で確認された「レコード画面で`getConfig()`が`null`を返す」事象への対策を踏襲)
- [x] レコード画面側(`desktop.js`/`mobile.js`)でも、設定に含まれる対象サブテーブル・出力先フィールドが実際のレコードに存在しない場合(フィールド削除・設定の食い違い等)は早期リターンし、画面をクラッシュさせない
- [x] 保存する設定(`kintone.plugin.app.setConfig()`)にはフィールドコード・検索モード・一致させる値(アプリ管理者が入力した業務上の検索キーワード)のみを含み、認証情報や個人情報は含まれない。ただし「一致させる値」に管理者が誤って機微な文字列を入力した場合、プラグイン設定はアプリ管理権限を持つユーザーなら閲覧可能な点は一般的なkintoneプラグイン設定の性質として利用者に委ねる

## 通信・認証情報の取り扱い

- N/A — 外部サービスとの認証・APIキーのやり取りを行わない。REST APIも使用しないため、認証情報の保存先を検討する必要自体がない

## 一致しなかった場合の上書き方針(仕様上の注意、セキュリティというより運用上のリスク)

- [x] 出力先フィールドはプラグインが常に上書き(一致しない場合は空文字列でクリア)する設計であることを`idea.md`に明記した。ユーザーが出力先フィールドへ手入力しても、次の保存操作で上書きされる。この仕様により「出力先フィールドを自由記述に使えない」という運用制約が生じるが、意図した挙動である(`判断記録.md`の3番)

## 個別確認事項(利用ユーザーへ委ねる項目)

- サブテーブルの行数が非常に多い場合の`submit`時の計算コスト(全設定行×全行を1回ずつ走査する程度のO(n)処理であり、実用上の件数では問題にならない想定だが、極端に大きいサブテーブルでの実測はしていない)
- CHECK_BOX等の配列値をサブテーブル外の非配列フィールド(文字列等)へマッピングした場合の表示のされ方(kintone側の型不一致時の挙動に委ねる。`判断記録.md`の4番で言及した型互換性チェックを行わない設計上の制約)

問題があれば、公開サイトのリポジトリのGitHub Issueで報告してもらい対応する。
