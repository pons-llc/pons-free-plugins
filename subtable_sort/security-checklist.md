# subtable_sort セキュリティチェックリスト

[secureCodingGuideline.md](../secureCodingGuideline.md)の一般項目([box_gdrive_iframe/security-checklist.md](../box_gdrive_iframe/security-checklist.md)参照、UTF-8/BOMなし・名前空間分離・`'use strict'`・外部スクリプト不使用などは同様に満たしている)は重複記載を省略し、本プラグイン固有の項目のみ記載する。

最終確認日: 2026-07-10 / 対象: 初回実装時点

## コーディング作法

- [x] 文字コードはUTF-8(BOMなし)
- [x] グローバル変数を作らず、即時関数(IIFE)+名前空間オブジェクト(`window.SubtableSort`)のみを公開している(`js/lib/sort-comparator.js`, `js/lib/flag-values.js`, `js/lib/config-store.js`, `js/lib/config-validation.js`)
- [x] 既存のkintoneグローバルオブジェクトを書き換え・参照していない
- [x] `'use strict'`を全JSファイルの先頭で使用している
- [x] kintone内部のid/class属性やDOM構造に依存せず、JavaScript API(`kintone.app.getFormFields()`, `kintone.app.record.getHeaderMenuSpaceElement()`, `kintone.app.record.get/set()`, `kintone.events.on()`)のみを使用している

## REST API・外部通信

- [x] 本プラグインはREST APIを一切使用しない(CLAUDE.md開発方針3に準拠)。サブテーブルのソート・値の書き換えはすべてJavaScript API(`event.record`の書き換え、または`kintone.app.record.get()`/`set()`)のみで完結する
- [x] kintone以外の外部サーバーへの通信(fetch/XHR)を一切行わない
- [x] 外部ライブラリを一切使用していない(vanilla JSのみ、`js/lib/`配下は依存なしの純粋関数)

## `kintone.app.record.set()`利用時の制約(本プラグイン固有の注意点)

- [x] `kintone.app.record.set()`は`kintone.events.on()`のイベントハンドラー内では使用できない(公式ドキュメント記載の制限事項)。本プラグインでは、`SUBMIT`モードのソートは`event.record`を直接書き換えてイベントオブジェクトをreturnする方式で実装し、`MANUAL`モードのソート(ボタンのクリックハンドラー、`kintone.events.on()`の外側で動く独自のDOMイベントリスナー)でのみ`kintone.app.record.get()`/`set()`を使用する、という使い分けを徹底している

## XSS対策

- [x] `MANUAL`モードのボタン(`desktop.js`)はラベル文字列を固定のリテラル(`textContent`で設定)のみで構成し、ユーザー入力やレコード値を描画に使わない
- [x] 設定画面(`js/config.js`)でフィールド一覧・エラーメッセージを描画する際、`innerHTML`ではなく`document.createElement()` + `textContent`のみを使用している
- [x] ルール・ソートキーのリスト再描画(`innerHTML = ''`)はリストをクリアするためだけの用途で、外部由来の文字列を差し込んでいない(`<template>`要素からの`cloneNode(true)`で行を組み立てる)

## 設定の妥当性検証

- [x] 保存前に`js/lib/config-validation.js`でチェックし、不正な設定(サブテーブル未選択、ソートキー0件、`MANUAL`モードでソート済フィールド未選択)は保存させない
- [x] `kintone.plugin.app.getConfig()`が`null`/`undefined`を返す場合でも、`js/lib/config-store.js`の`load()`は例外を投げず既定値(`{ rules: [] }`)を返す
- [x] レコード画面側(`desktop.js`/`mobile.js`)でも、設定に含まれる対象サブテーブル・ソート済フィールドが実際のレコードに存在しない場合(フィールド削除・設定の食い違い等)は早期リターンし、画面をクラッシュさせない

## 通信・認証情報の取り扱い

- N/A — 外部サービスとの認証・APIキーのやり取りを行わない。REST APIも使用しないため、認証情報の保存先を検討する必要自体がない

## `confirm_modal`との組み合わせに関する注記(セキュリティというより運用上の注意)

- [x] 本プラグインは`confirm_modal`プラグインとの技術的な連携コードを一切持たない(`判断記録.md`の3番)。両プラグインを同じアプリにインストールした場合の組み合わせ挙動は、それぞれが独立に同じkintoneイベント(`app.record.edit.submit`等)をフックすることによる副次的な効果であり、片方のプラグインだけでは成立しない前提条件がある旨を`idea.md`に明記した

## 個別確認事項(利用ユーザーへ委ねる項目)

- `MANUAL`モードのモバイル対応が必要な場合の拡張要否(`判断記録.md`の1番)
- ソート済フィールドの文字列(「済」/「未」)をカスタマイズしたい場合の拡張要否(`判断記録.md`の2番)

問題があれば、公開サイトのリポジトリのGitHub Issueで報告してもらい対応する。
