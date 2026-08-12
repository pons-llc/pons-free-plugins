# calendar_view セキュリティチェックリスト

[secureCodingGuideline.md](../secureCodingGuideline.md)の一般項目(UTF-8/BOMなし・即時関数によるグローバル汚染防止・`'use strict'`・外部スクリプト不使用など)は`box_gdrive_iframe/security-checklist.md`・`gantt_chart_view/security-checklist.md`と同様に満たしている。本プラグイン固有の項目のみ記載する。

最終確認日: 2026-08-12 / 対象: 初回実装時点。Puppeteerによる実環境テスト(`pnpm run test:e2e`)を実施済み(設定画面の保存・反映、レコード一覧画面でのグループ分け・日表示描画を確認)。ドラッグ&ドロップ自体の実機自動テストは今回のスコープ外(下記「個別確認事項」参照)。

## XSS対策(カレンダー描画: `js/calendar-render.js`)

レコードのフィールド値(タイトル・ホバー項目・グループラベル)を直接DOMへ挿入する箇所が多く、本プラグインで最もXSSリスクが高い部分。

- [x] レコード値に由来する文字列(イベントタイトル・グループラベル・週表示チップのラベル)は、すべて`textContent`への代入で挿入している(`js/calendar-render.js`の`el()`ヘルパーで生成した要素に対して行う)。`innerHTML`・`insertAdjacentHTML`・`document.write`は本プラグイン全体(`js/`・`html/`)で一切使用していない(`grep -rn "innerHTML\|insertAdjacentHTML\|document.write" js/ html/`で未使用を確認済み)
- [x] イベントブロック/チップの`title`属性(ブラウザ標準ツールチップ、`js/lib/format-field-value.js`で文字列化したタイトル・ホバー項目を改行区切りで格納)は、DOM APIの`element.title = text`によるプロパティ代入であり、HTML文字列の結合ではないため、ブラウザ側で属性値として適切にエスケープされる
- [x] 色分けに使う値(グループキー、`js/lib/color-assignment.js`の`assignColors`)は、色パレット配列のインデックス選択にのみ使うキーであり、CSSやHTMLへ値そのものを埋め込むことはない(CSSインジェクション対策。パレットは固定配列`DEFAULT_PALETTE`のみを使用し、フィールド値をCSSの値として直接使用しない)
- [x] `kintone.app.getHeaderSpaceElement()`で取得した要素へは、`clearElement()`(`removeChild`ループ、`innerHTML = ''`は使わない)でクリアしたうえで、`document.createElement`で組み立てたDOM要素のみを`appendChild`で追加している。独自クラス名(`cv-`プレフィックス)で見た目を明示的に指定し、kintoneの既存クラス名・DOM構造には依存していない

## 設定画面のXSS対策(`js/config.js`)

- [x] フィールドラベル・一覧IDなど、kintoneの管理者操作でのみ変更可能な値についても、`titleEl.textContent = ...`/`optionEl.textContent = ...`で挿入しており、`innerHTML`は使用していない(多層防御としてエスケープを徹底する方針)
- [x] `kintone.plugin.app.setConfig()`へ保存する値はすべて`JSON.stringify()`した文字列であり、保存時・読み込み時(`js/lib/config-store.js`)ともにDOMへの直接挿入は行わない
- [x] 対象一覧のID入力(`.js-view-id-input`)は数値/文字列として`viewId`にそのまま保存されるのみで、DOM挿入時は`viewLabelFor()`で`一覧ID: ${viewId}`という固定フォーマット文字列を組み立てたうえで`textContent`に代入しており、任意のHTML注入経路にはならない

## REST API利用(ドラッグ&ドロップ更新のみ)

- [x] REST API呼び出しは`js/record-update.js`の1箇所のみ(`PUT /k/v1/record.json`、`kintone.api()`経由)。生の`fetch`/`XHR`は使用していない
- [x] レコードの**取得**にはREST APIを一切使用しない(`app.record.index.show`の`event.records`のみを使用、idea.md参照)。管理者が一覧の対象一覧を指定する設定画面でも、一覧列挙REST API(`GET /k/v1/app/views.json`)は使わず、一覧ID直接入力方式にしている(gantt_chart_viewとの設計差異、idea.md「判断記録」参照)
- [x] レコード**更新**(ドラッグ&ドロップ)は、既定で無効(`enableDragDrop: false`)。一覧ごとに管理者が明示的に有効化した場合のみ動作する
- [x] 更新時は取得済みレコードの`$revision`を`revision`パラメータとして指定し、競合時(他ユーザーが同時に更新した場合)はエラーとして扱い、`kintone.showNotification('ERROR', ...)`で通知したうえで元の表示を維持する(楽観的排他制御。楽観ロックが効かない`-1`指定は行わない)
- [x] グループ軸へのドラッグ移動は、グループフィールドが実際に更新可能な型(`USER_SELECT`/`ORGANIZATION_SELECT`/`GROUP_SELECT`/`DROP_DOWN`/`RADIO_BUTTON`)の場合のみ許可し、`STATUS`等の更新不可フィールドをグループに指定した場合は時刻のみ変更可能とする(`js/lib/grouping.js`の`isGroupDragUpdatable`、`PUT /k/v1/record.json`の「制限事項: ステータスは更新不可」に対応)
- [x] 短時間の大量リクエスト送信は発生しない。ドラッグ&ドロップは1操作につき1件の逐次更新のみで、ループでの連続送信は行わない

## 認証情報の取り扱い

- [x] 本プラグインは外部サービスとの連携を行わないため、APIキー・パスワード等の認証情報を一切保持しない(`kintone.plugin.app.setConfig()`に保存するのは表示設定情報のみ)
- [x] `kintone.api()`はログインユーザー自身のセッションのみを使用しており、APIトークン・`kintone.plugin.app.setProxyConfig()`/`getProxyConfig()`は使用していない

## URLの取り扱い

- [x] レコード詳細画面へのURLは`kintone.buildPageUrl('APP_DETAIL', { appId, recordId })`(JavaScript API)で組み立てており、URLを文字列結合で組み立てていない(secureCodingGuideline.md「URLの取得」に準拠)
- [x] `kintone.api.url('/k/v1/record.json', true)`を使用しており、REST APIのURLも文字列結合で組み立てていない
- [x] `recordId`・`appId`は`kintone.app.getId()`・レコードの`$id`(システム項目、ユーザー入力に由来しない)から取得しており、外部入力値をURL生成に使わない

## 権限モデル

- [x] レコードの取得・表示は`event.records`(一覧のレコード閲覧権限の範囲内でkintoneが返す値)に依拠し、権限のないレコード・フィールドは表示されない(kintone自体のアクセス権制御に委譲)
- [x] レコードの更新(ドラッグ&ドロップ)は`PUT /k/v1/record.json`のアクセス権チェック(レコード編集権限・フィールド編集権限)にそのまま従う。ドラッグ操作自体はクライアント側の表示上可能でも、権限がなければkintone側でエラーになり、更新は反映されない
- [x] ドラッグ&ドロップの有効/無効は設定画面(管理者操作)でのみ切り替えられ、一般ユーザーの操作では変更できない

## 最大表示件数(100件)の制限について

- [x] レコード取得件数の上限(100件)はUIの制約であり、セキュリティ境界ではない。あくまで「REST APIを使わずJavaScript APIのみで実現する」という設計方針(idea.md)から生じる技術的な制限を、ユーザーに明示するための仕様である

## 個別確認事項(利用ユーザーへ委ねる項目・将来の実環境テストで確認する項目)

- `kintone.app.getHeaderSpaceElement()`への実際の描画結果、`app.record.index.show`の実発火タイミング、グループ分け・日表示/週表示の切り替えはPuppeteerで実機確認済み(`calendar_view/src/e2e/full-flow.e2e.test.js`)
- ドラッグ&ドロップ自体(HTML5 Drag and Dropイベントの発火順序、実際のレコード更新)はPuppeteerでの自動テストが技術的に難しく(ネイティブHTML5 DnDイベントの合成が困難)、今回は自動テストのスコープ外とした。手動での実機確認を推奨する
- 大量データ(100件近い規模)を表示した際の実ブラウザでの描画性能は未検証
- 問題があれば、公開サイトのリポジトリのGitHub Issueで報告してもらい対応する
