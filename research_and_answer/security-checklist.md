# セキュリティチェックリスト — 照会回答パッケージプラグイン (research_and_answer)

共通項目(UTF-8/BOMなし・即時実行関数による名前空間分離・`'use strict'`・外部スクリプト不使用・
`https`のみ等)は [box_gdrive_iframe/security-checklist.md](../box_gdrive_iframe/security-checklist.md)
を参照。ここでは本プラグイン固有の確認項目のみ記載する。

最終確認日: 2026-07-19

## 1. XSS対策

- [x] **仮想フォーム・仮想一覧・分析ダッシュボードのユーザー由来データはすべて`textContent`/
  `createTextNode`/`new Option()`経由で挿入**している(`form-ui.js`、`desktop-answer-list.js`、
  `desktop-answer-analysis.js`の`el()`ヘルパー)。`innerHTML`を使うのは分析ダッシュボードの
  静的な骨組みHTML(`desktop-answer-analysis.js`の`initDashboard`)のみで、変数を一切埋め込んで
  いない。タイトル等の動的値は骨組み生成後に`textContent`で設定している。
- [x] **関連リンクのリッチテキスト生成**(`form-model.js`の`buildRelatedLinksHtml`)は、
  旧カスタマイズの「未エスケープHTML連結」を廃止し、(1) URLは`http(s)://`スキームのみ許可
  (`javascript:`等を拒否)、(2) URL・表示ラベルともHTML属性/テキストとしてエスケープ、
  (3) `rel="noopener noreferrer"`付与、とした。ユニットテストで担保
  (`__tests__/form-model.test.js`のXSSケース)。
- [x] **リッチテキストの一覧表示**はタグを除去したプレーンテキストに変換して`textContent`で出力
  (`analysis-core.js`の`formatFieldValue`)。
- [x] SVGチャートは`createElementNS`+`setAttribute`で構築し、文字列HTML/SVGの組み立てをしない
  (`chart-lite.js`)。
- [x] フィールドコードをCSSセレクターに埋め込む箇所は`CSS.escape()`を使用(`form-ui.js`)。

## 2. CSSインジェクション対策

- [x] ユーザー入力値をstyle属性・CSSに展開する箇所はない。色・レイアウトはすべて固定のCSSクラス。

## 3. 認証情報・秘密情報の扱い

- [x] 認証情報は一切扱わない。`kintone.plugin.app.setConfig()`に保存するのは役割・アプリID・
  スペース要素ID・一覧名のみ(すべて秘密情報ではない)。
- [x] `localStorage`に保存するのは分析画面の表示設定(表示列・グラフ種別など)のみ。個人情報・
  認証情報・レコードデータは保存しない。
- [x] 署名鍵`private.ppk`はgit管理外(`.gitignore`)。

## 4. 外部通信・外部スクリプト

- [x] 旧カスタマイズにあった **Chart.jsのCDN読み込み(`cdn.jsdelivr.net`)を廃止**し、SVG描画を
  自前実装(`chart-lite.js`)。プラグイン実行コードからkintone以外への通信は一切ない。
- [x] kintoneへのAPI呼び出しはすべて`kintone.api()`(内部向けラッパー)経由。生の`fetch`/`XHR`で
  URLを組み立てる箇所はない。

## 5. REST API利用の妥当性(JavaScript API優先の原則)

| 呼び出し | 理由 |
| --- | --- |
| `GET /k/v1/app/form/fields.json`(回答アプリ・自アプリ) | 別アプリのフィールド取得は`kintone.app.getFormFields()`(自アプリ専用)では不可。集計リスト/分析では一覧画面から全フィールド情報が必要 |
| `POST/GET /k/v1/records/cursor` | 全件取得はJavaScript APIに存在しない |
| `preview`系(`form/fields`・`form/layout`・`views`) | 設定画面の「必要な項目・一覧の自動作成」。アプリ管理権限を持つ管理者が設定画面から実行し、反映は通常の「アプリを更新」フローに乗せる |

## 6. 設定値の妥当性検証

- [x] 設定画面の保存前に`ConfigStore.validate()`で役割の選択・アプリID(正の整数のみ)・
  スペースID/一覧名の入力を検証。エラー表示は`textContent`。
- [x] 依頼アプリの保存時に、`insert_column`が回答アプリに実在するフィールドコードかをREST APIで
  検証(存在しない場合は保存をブロック)。
- [x] フォーム定義JSON・動的条件JSONのパースはすべて`safeParseJson`でtry/catchし、不正なJSONでも
  例外で画面を壊さない(空配列扱い)。

## 7. 権限・操作範囲

- [x] 項目の自動作成は動作テスト環境(preview API)のみを変更し、運用環境への反映(デプロイ)は
  ユーザー自身の「アプリを更新」操作に委ねる(勝手にデプロイしない)。
- [x] 自動作成は不足分の追加のみ(冪等)。既存フィールド・既存一覧の設定変更・削除は行わない
  (`diffMissingFields`・`buildViewsPayload`はユニットテストで担保)。
- [x] カスタマイズ形式一覧の作成にkintoneシステム管理権限が必要な点は、失敗時にエラーメッセージで
  手動作成手順を案内(権限昇格を試みない)。
