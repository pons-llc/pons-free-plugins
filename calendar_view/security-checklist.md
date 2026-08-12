# calendar_view セキュリティチェックリスト

[secureCodingGuideline.md](../secureCodingGuideline.md)の一般項目(UTF-8/BOMなし・即時関数によるグローバル汚染防止・`'use strict'`・外部スクリプト不使用など)は`box_gdrive_iframe/security-checklist.md`・`gantt_chart_view/security-checklist.md`と同様に満たしている。本プラグイン固有の項目のみ記載する。

最終確認日: 2026-08-12 / 対象: 表示専用プラグインとしての実装(ドラッグ&ドロップでの編集は当初実装したがスコープから外し、表示専用に変更した。判断記録.md参照)。Puppeteerによる実環境テスト(`pnpm run test:e2e`)を実施済み(設定画面の保存・反映、レコード一覧画面でのグループ分け・色分け・日表示/週表示描画を確認)。

## XSS対策(カレンダー描画: `js/calendar-render.js`)

レコードのフィールド値(タイトル・ホバー項目・グループラベル)を直接DOMへ挿入する箇所が多く、本プラグインで最もXSSリスクが高い部分。

- [x] レコード値に由来する文字列(イベントタイトル・グループラベル・週表示チップのラベル)は、すべて`textContent`への代入で挿入している(`js/calendar-render.js`の`el()`ヘルパーで生成した要素に対して行う)。`innerHTML`・`insertAdjacentHTML`・`document.write`は本プラグイン全体(`js/`・`html/`)で一切使用していない(`grep -rn "innerHTML\|insertAdjacentHTML\|document.write" js/ html/`で未使用を確認済み)
- [x] イベントブロック/チップの`title`属性(ブラウザ標準ツールチップ、`js/lib/format-field-value.js`で文字列化したタイトル・ホバー項目を改行区切りで格納)は、DOM APIの`element.title = text`によるプロパティ代入であり、HTML文字列の結合ではないため、ブラウザ側で属性値として適切にエスケープされる
- [x] `kintone.app.getHeaderSpaceElement()`で取得した要素へは、`clearElement()`(`removeChild`ループ、`innerHTML = ''`は使わない)でクリアしたうえで、`document.createElement`で組み立てたDOM要素のみを`appendChild`で追加している。独自クラス名(`cv-`プレフィックス)で見た目を明示的に指定し、kintoneの既存クラス名・DOM構造には依存していない

## 色分け(CSSインジェクション対策、`js/lib/color-assignment.js`)

自動割り当ての色(固定パレット)に加えて、管理者が値ごとに色を手動指定できる(`colorOverrides`)機能を持つため、REST/JSONの改ざんを想定した多層防御を行っている。

- [x] 自動割り当ての色は固定パレット配列`DEFAULT_PALETTE`のインデックス選択にのみ使い、フィールド値そのものをCSSの値として直接使用しない
- [x] 管理者指定の色(`colorOverrides`)は、自由入力のカラーピッカーではなく`<select>`(`js/lib/color-assignment.js`の`DEFAULT_PALETTE`から生成した固定選択肢のみ)経由でのみ設定画面から入力される(ユーザー指示により、UIをシンプルにするため自由入力から選択式に変更した。判断記録.md参照)。この入力経路からは既知の8色の`#rrggbb`文字列しか送出されない。それでも、保存済みのプラグイン設定JSON(`kintone.plugin.app.setConfig()`)が別の経路で直接改ざんされた場合に備え、`js/lib/color-assignment.js`の`assignColors()`で`#rgb`/`#rrggbb`形式(正規表現`/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/`)であることを検証してから`style.backgroundColor`へ設定し、不正な値(例: `javascript:alert(1)`のような文字列)は無視して自動割り当ての色にフォールバックする多層防御を維持している(単体テストで確認済み、`__tests__/color-assignment.test.js`)
- [x] `style.backgroundColor = value`はDOM APIのCSSプロパティ代入であり、文字列結合によるスタイル注入(`style="background:...".insertAdjacentHTML`等)ではない

## 設定画面のXSS対策(`js/config.js`)

- [x] フィールドラベル・一覧ID・選択肢ラベルなど、kintoneの管理者操作でのみ変更可能な値についても、`titleEl.textContent = ...`/`optionEl.textContent = ...`/`labelEl.textContent = ...`で挿入しており、`innerHTML`は使用していない(多層防御としてエスケープを徹底する方針)
- [x] `kintone.plugin.app.setConfig()`へ保存する値はすべて`JSON.stringify()`した文字列であり、保存時・読み込み時(`js/lib/config-store.js`)ともにDOMへの直接挿入は行わない
- [x] 対象一覧のID入力(`.js-view-id-input`)は数値/文字列として`viewId`にそのまま保存されるのみで、DOM挿入時は`viewLabelFor()`で`一覧ID: ${viewId}`という固定フォーマット文字列を組み立てたうえで`textContent`に代入しており、任意のHTML注入経路にはならない
- [x] 値ごとの色指定UI(`.js-color-override-input`、`<select>`)は、DROP_DOWN/RADIO_BUTTONの選択肢(`kintone.app.getFormFields()`の`options`、管理者操作でのみ変更可能)から生成する。選択肢のラベルは`optionEl.textContent = ...`で挿入しており、選べる色の値自体も固定パレット由来の8色+空文字列(自動)のみのため、この入力経路そのものから不正な値が入る余地はない

## REST API利用: なし

- [x] 本プラグインは表示専用であり、REST APIを一切使用しない。生の`fetch`/`XMLHttpRequest`・`kintone.api()`のいずれも使用していない(`grep -rn "kintone.api(\|fetch(\|XMLHttpRequest" js/`で未使用を確認済み)
- [x] レコードの**取得**は`app.record.index.show`の`event.records`のみを使用する(idea.md参照)。管理者が対象一覧を指定する設定画面でも、一覧列挙REST API(`GET /k/v1/app/views.json`)は使わず、一覧ID直接入力方式にしている(gantt_chart_viewとの設計差異、idea.md「判断記録」参照)
- [x] 色分けフィールドにSTATUSを選んだ場合の値ごとの色指定(選択肢の列挙にREST APIが必要)は、意図的に非対応としている(自動割り当てのみ使用可能。判断記録.md参照)。REST API不使用の方針を、機能を削ってでも徹底した

## 認証情報の取り扱い

- [x] 本プラグインは外部サービスとの連携を行わないため、APIキー・パスワード等の認証情報を一切保持しない(`kintone.plugin.app.setConfig()`に保存するのは表示設定情報のみ)
- [x] APIトークン・`kintone.plugin.app.setProxyConfig()`/`getProxyConfig()`は使用していない

## URLの取り扱い

- [x] レコード詳細画面へのURLは`kintone.buildPageUrl('APP_DETAIL', { appId, recordId })`(JavaScript API)で組み立てており、URLを文字列結合で組み立てていない(secureCodingGuideline.md「URLの取得」に準拠)
- [x] `recordId`・`appId`は`kintone.app.getId()`・レコードの`$id`(システム項目、ユーザー入力に由来しない)から取得しており、外部入力値をURL生成に使わない

## 権限モデル

- [x] レコードの取得・表示は`event.records`(一覧のレコード閲覧権限の範囲内でkintoneが返す値)に依拠し、権限のないレコード・フィールドは表示されない(kintone自体のアクセス権制御に委譲)
- [x] 本プラグインはレコードの作成・更新・削除を一切行わない(表示専用)

## 最大表示件数(100件)の制限について

- [x] レコード取得件数の上限(100件)はUIの制約であり、セキュリティ境界ではない。あくまで「REST APIを使わずJavaScript APIのみで実現する」という設計方針(idea.md)から生じる技術的な制限を、ユーザーに明示するための仕様である

## 個別確認事項(利用ユーザーへ委ねる項目・将来の実環境テストで確認する項目)

- `kintone.app.getHeaderSpaceElement()`への実際の描画結果、`app.record.index.show`の実発火タイミング、グループ分け・色分け(値ごとの色指定含む)・凡例表示・週表示のグループ×曜日グリッド・日表示/週表示の切り替え・日付ジャンプ入力は、Puppeteerで実機確認済み(`calendar_view/src/e2e/full-flow.e2e.test.js`)
- 横デザインの日表示で発生していた表示崩れ(利用者からの指摘により修正)は、実機での目視確認で修正を確認済み
- 大量データ(100件近い規模)を表示した際の実ブラウザでの描画性能は未検証
- 問題があれば、公開サイトのリポジトリのGitHub Issueで報告してもらい対応する
