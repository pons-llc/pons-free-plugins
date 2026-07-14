# org_lookup セキュリティチェックリスト

[secureCodingGuideline.md](../secureCodingGuideline.md)の一般項目([box_gdrive_iframe/security-checklist.md](../box_gdrive_iframe/security-checklist.md)参照、UTF-8/BOMなし・名前空間分離・`'use strict'`・外部スクリプト不使用などは同様に満たしている)は重複記載を省略し、本プラグイン固有の項目のみ記載する。

最終確認日: 2026-07-11

## コーディング作法

- [x] 文字コードはUTF-8(BOMなし)
- [x] グローバル変数を作らず、即時関数(IIFE)+名前空間オブジェクト(`window.OrgLookup`)のみを公開している(`js/lib/org-attributes.js`, `js/lib/source-value.js`, `js/lib/resolve-org-info.js`, `js/lib/org-attribute-mapping.js`, `js/lib/config-store.js`, `js/lib/config-validation.js`)
- [x] 既存のkintoneグローバルオブジェクトを書き換え・参照していない
- [x] `'use strict'`を全JSファイルの先頭で使用している
- [x] kintone内部のid/class属性やDOM構造に依存せず、JavaScript API・`kintone.api()`(内部向けラッパー)のみを使用している

## REST API・外部通信(CLAUDE.md開発方針3参照)

- [x] 組織コードから組織そのものを取得するJavaScript APIが存在しない(`kintone.user.getOrganizations()`はユーザーコードからそのユーザーの所属組織一覧を取得するAPIであり、目的が異なる)ため、Organization API(`GET /v1/organizations.json`)をREST経由で呼び出す。呼び出しは必ず`kintone.api(kintone.api.url('/v1/organizations.json', true), 'GET', { codes: [code] })`(kintone自身への呼び出し専用の内部ラッパー)のみを使用し、生の`fetch`/`XMLHttpRequest`でURLを直接組み立てていない
- [x] `kintone.api.url(path, true)`の第2引数`true`によりドメイン部分を自動解決させ、外部ドメインへのリクエストになる余地をコード上排除している
- [x] `codes`パラメータには、設定画面で選択されたフィールドから読み取った1件の組織コード(または`resolveOrgInfo`が追加取得する親組織のコード)のみを渡す
- [x] 親組織の取得は`org.parentCode`が存在する場合に1回だけ行い、親組織自身の`parentCode`を使ってさらに祖父にあたる組織を取得することは無い(`js/lib/resolve-org-info.js`、`__tests__/resolve-org-info.test.js`でモックにより確定的に検証済み。無制限に遡ると組織階層が深い環境でAPI呼び出し数が想定より膨らむリスクがあるため、意図的に1階層に制限している)
- [x] kintone以外の外部サーバーへの通信(fetch/XHR)を一切行わない
- [x] 外部ライブラリを一切使用していない(vanilla JSのみ、`js/lib/`配下は依存なしの純粋関数)

## 実データに基づく実装(推測実装の防止)

- [x] Organization API(`/v1/organizations.json`)のレスポンス形式はkintoneドキュメントMCPのcorpusに該当ページが無かったため、検証環境へ実際にリクエストして`organizations[0]`の実プロパティ名(`id`/`code`/`name`/`localName`/`localNameLocale`/`parentCode`/`description`)を確認したうえで転記項目を実装した(推測実装をしていない、idea.md参照)

## XSS・CSSインジェクション対策

- [x] 設定画面(`js/config.js`)でフィールド一覧・エラーメッセージを描画する際、`innerHTML`ではなく`document.createElement()` + `textContent`のみを使用している
- [x] 設定行・転記項目行のリスト再描画(`innerHTML = ''`)はリストをクリアするためだけの用途で、外部由来の文字列を差し込んでいない(`<template>`要素からの`cloneNode(true)`で行を組み立てる)
- [x] 出力先フィールドへの書き込み(`desktop.js`/`mobile.js`)は`kintone.app.record.get()`で取得したレコードオブジェクトの`[...].value`への値代入のみで、DOM操作(`innerHTML`等)を一切行わない。Organization APIレスポンスに含まれる組織名・説明等の値がそのままフィールド値として書き込まれるが、kintone標準のフィールド値レンダリングを経由するためHTMLとして解釈されない

## 設定の妥当性検証

- [x] 保存前に`js/lib/config-validation.js`でチェックし、不正な設定(元フィールド未選択・型不正、発動条件不正、ボタン押下時のスペース未選択・重複、転記項目0件・属性キー不正・出力先未選択・型不正、出力先フィールドの重複、出力先と元フィールドの重複)は保存させない
- [x] `kintone.plugin.app.getConfig()`が`null`/`undefined`を返す場合でも、`js/lib/config-store.js`の`load()`は例外を投げず既定値(`{ rows: [] }`)を返す
- [x] レコード画面側(`desktop.js`/`mobile.js`)でも、設定に含まれるフィールドが実際のレコードに存在しない場合は早期リターンし、画面をクラッシュさせない。REST呼び出しが失敗した場合(権限エラー・ネットワークエラー等)も例外を握りつぶさずログに残しつつ、画面全体をクラッシュさせない(ボタン押下時のalert/保存時のevent.errorで利用者に明示する)

## 通信・認証情報の取り扱い

- [x] `kintone.api()`はログイン中のセッション情報を自動的に使用するため、APIトークンやパスワード等の認証情報をコード・設定に含めない(secureCodingGuideline.md準拠)

## クリアボタン(誤操作防止)

- [x] クリアボタン(元フィールド・転記項目をまとめて空にする)は押下時に`confirm()`でユーザーに再確認させ、キャンセルした場合は何もクリアしない(`js/desktop.js`/`js/mobile.js`)
- [x] 組織選択(`ORGANIZATION_SELECT`)フィールドをクリアする際は値の型(配列)に合わせて空配列(`[]`)にしており、文字列フィールドと型を混同していない
- [x] `kintone.app.record.set()`でフィールド値を空文字列にクリアすると`value`キー自体が消える(`undefined`になる)というkintoneの実挙動(`biz_code_search`の開発時に検証環境で確認済み、idea.md参照)を踏まえ、クリア後の値を扱う既存コード(`extractOrgCode`)は`typeof`判定のみで影響を受けないことを確認済み

## 編集禁止(disabled化)の仕様(セキュリティというより運用上の注意)

- [x] 出力先フィールド・元フィールドの`disabled`化はJavaScript APIによるUIレベルの制御であり、REST API経由でのフィールド更新やアクセス権による制御ではない。「不正操作を防ぐ」機能ではなく「通常操作でのミスを防ぐUI上の制約」であることをidea.mdに明記した

## アクセス権に関する注意(個別確認事項)

- 組織名・説明等はユーザー個人の機微情報と比べれば影響は小さいが、非公開の内部組織名や説明文が含まれる場合もあるため、出力先フィールドのアクセス権設定(誰が閲覧できるか)はアプリ管理者が別途適切に設定する必要がある(プラグイン側では制御できない範囲であることをidea.mdに明記した)
- `kintone.api()`はログイン中のユーザー権限で実行されるため、Organization APIの利用がcybozu.com共通管理側で制限されている環境では取得に失敗する(想定内、上記の失敗時挙動で対処済み)

問題があれば、公開サイトのリポジトリのGitHub Issueで報告してもらい対応する。
