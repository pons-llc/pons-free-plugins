# kanban_view セキュリティチェックリスト

[secureCodingGuideline.md](../secureCodingGuideline.md)の一般項目(UTF-8/BOMなし・即時関数によるグローバル汚染防止・`'use strict'`・外部スクリプト不使用など)は`box_gdrive_iframe/security-checklist.md`・`calendar_view/security-checklist.md`と同様に満たしている。本プラグイン固有の項目のみ記載する。

最終確認日: 2026-08-13 / 対象: 表示専用プラグイン(ドラッグ&ドロップでの編集は行わない)。ユニットテスト(`pnpm test`、65件)と`grep`によるコード全数確認を実施済み。Puppeteerによる実環境テストは別途実施予定(下記「個別確認事項」参照)。

## XSS対策(カンバンボード描画: `js/kanban-render.js`)

レコードのフィールド値(タイトル・ホバー詳細・バッジ・期限・担当者名)を直接DOMへ挿入する箇所が多く、本プラグインで最もXSSリスクが高い部分。

- [x] レコード値に由来する文字列(カードタイトル・バッジ・期限表示・担当者名・列ラベル)は、すべて`textContent`への代入で挿入している(`js/kanban-render.js`の`renderCard`/`renderColumn`)。`innerHTML`・`insertAdjacentHTML`・`document.write`は本プラグイン全体(`js/`・`html/`)で一切使用していない(`grep -rn "innerHTML\|insertAdjacentHTML\|document.write" js/ html/`で未使用を確認済み。コード内コメントにのみ「innerHTML」という語がヒットする)
- [x] カード要素の`title`属性(ブラウザ標準ツールチップ、`js/lib/card-model.js`の`buildHoverText()`で組み立てたホバー詳細を改行区切りで格納)は、`cardEl.title = card.hoverText`というDOM APIのプロパティ代入であり、HTML文字列の結合ではないため、ブラウザ側で属性値として適切にエスケープされる
- [x] `kintone.app.getHeaderSpaceElement()`で取得した要素へは`container.textContent = ''`でクリアしたうえで、`document.createElement`で組み立てたDOM要素のみを`appendChild`で追加している。独自クラス名(`kb-`プレフィックス)で見た目を明示的に指定し、kintoneの既存クラス名・DOM構造には依存していない
- [x] 期限超過時の🔥マークは固定の絵文字リテラル(`'🔥 ' + card.dueLabel`)であり、レコード側の入力値ではない

## 設定画面のXSS対策(`js/config.js`)

- [x] フィールドラベル・一覧ID・選択肢ラベルなど、kintoneの管理者操作でのみ変更可能な値についても`titleEl.textContent = ...`/`optionEl.textContent = ...`/`labelEl.textContent = ...`で挿入しており、`innerHTML`は使用していない(多層防御としてエスケープを徹底する方針)
- [x] `kintone.plugin.app.setConfig()`へ保存する値はすべて`JSON.stringify()`した文字列であり、保存時・読み込み時(`js/lib/config-store.js`)ともにDOMへの直接挿入は行わない
- [x] 対象一覧のID入力(`.js-view-id-input`)は文字列として`viewId`にそのまま保存されるのみで、DOM挿入時は`viewLabelFor()`で`一覧ID: ${viewId}`という固定フォーマット文字列を組み立てたうえで`textContent`に代入しており、任意のHTML注入経路にはならない
- [x] グループ分けフィールド・担当者フィールド・期限フィールド・バッジフィールド・ホバー項目の選択肢は、いずれも`kintone.app.getFormFields()`(管理者操作でのみ変更可能なフォーム定義)から生成した`<select>`/チェックボックスのみで、自由入力のテキストフィールドではない

## REST API利用: なし

- [x] 本プラグインは表示専用であり、REST APIを一切使用しない。生の`fetch`/`XMLHttpRequest`・`kintone.api()`のいずれも使用していない(`grep -rn "kintone.api(\|fetch(\|XMLHttpRequest" js/ html/`で未使用を確認済み)
- [x] レコードの**取得**は`app.record.index.show`の`event.records`のみを使用する(idea.md参照、bulk_approvalと同じ設計方針)。管理者が対象一覧を指定する設定画面でも、一覧列挙REST API(`GET /k/v1/app/views.json`)は使わず、一覧ID直接入力方式にしている(calendar_viewと同じ設計判断、idea.md参照)
- [x] プロセス管理が有効かどうかの判定は、設定画面では`kintone.app.getFormFields()`にSTATUS/STATUS_ASSIGNEE型フィールドが含まれるかで行い、レコード一覧画面では`kintone.app.getStatus()`(JavaScript API)で行う。どちらもREST APIではない

## 認証情報の取り扱い

- [x] 本プラグインは外部サービスとの連携を行わないため、APIキー・パスワード等の認証情報を一切保持しない(`kintone.plugin.app.setConfig()`に保存するのは表示設定情報のみ)
- [x] APIトークン・`kintone.plugin.app.setProxyConfig()`/`getProxyConfig()`は使用していない

## URLの取り扱い

- [x] レコード詳細画面へのURLは`kintone.buildPageUrl('APP_DETAIL', { appId, recordId })`(JavaScript API)で組み立てており、URLを文字列結合で組み立てていない(secureCodingGuideline.md「URLの取得」に準拠)
- [x] カード押下時は別タブで開く(`window.open(url, '_blank', 'noopener')`、ユーザー指示)。第3引数`noopener`により、開いたタブから`window.opener`経由で元のタブ(一覧画面)を操作できないようにしている(同一オリジンのURLだが、外部遷移時の多層防御としてsecureCodingGuideline.mdの注意に準拠)
- [x] `recordId`・`appId`は`kintone.app.getId()`・レコードの`$id`(システム項目、ユーザー入力に由来しない)から取得しており、外部入力値をURL生成に使わない

## 権限モデル

- [x] レコードの取得・表示は`event.records`(一覧のレコード閲覧権限の範囲内でkintoneが返す値)に依拠し、権限のないレコード・フィールドは表示されない(kintone自体のアクセス権制御に委譲)
- [x] 本プラグインはレコードの作成・更新・削除を一切行わない(表示専用・ドラッグ&ドロップでの編集も行わない)

## 個別確認事項(利用ユーザーへ委ねる項目・将来の実環境テストで確認する項目)

- `kintone.app.getHeaderSpaceElement()`への実際の描画結果、`app.record.index.show`の実発火タイミング、グループ分け(ラジオ/ドロップダウン・プロセスステータス)・担当者表示(ユーザー選択/作業者)・期限超過ファイアマークの表示は、Puppeteerで実機確認予定(`kanban_view/src/e2e/`)
- 大量データ(一覧の1ページあたり最大500件)を表示した際の実ブラウザでの描画性能は未検証(calendar_viewと異なり自主的な件数上限を設けていないため)
- 問題があれば、公開サイトのリポジトリのGitHub Issueで報告してもらい対応する
