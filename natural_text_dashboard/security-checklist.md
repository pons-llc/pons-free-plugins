# natural_text_dashboard セキュリティチェックリスト

[secureCodingGuideline.md](../secureCodingGuideline.md)の各項目を、本プラグインの実装
(`engine/src/`、ビルド成果物`src/js/dashboard.bundle.js`)に照らして確認したもの。

最終確認日: 2026-08-15 / 対象: v7(接続設定モーダルへの開示・同意UI追加まで)

**結論: OSS化・`site/`公開の方針判断は完了した(2026-08-15、ユーザー確認済み)。
APIキーはBYOK(利用者ごとに入力)のまま維持し、より準拠した`setProxyConfig`ベースへの切り替え手順は
`idea.md`にドキュメント化するに留める。外部送信の開示は接続設定モーダルへの明示・同意UI追加で対応済み。
残る課題は文末の「今後の対応」を参照。**

## コーディング作法

- [x] 文字コードはUTF-8(BOMなし) — 全TSファイルはエディタ標準出力、BOM付与なし
- [x] グローバル変数を作らず、即時関数/名前空間オブジェクトを使っている — ビルド成果物はVite製の単一IIFE(`window.NaturalTextDashboard`という1個の名前空間のみ生成、ガイドラインが明示的に推奨する「ViteなどのJavaScriptバンドラーツールを使う」対策そのもの)
- [x] 既存のkintoneグローバルオブジェクトを書き換え・参照していない
- [x] kintone内部のid/class属性やDOM構造に依存せず、JavaScript API(`kintone.app.getFormFields()`, `kintone.app.getQueryCondition()`, `kintone.app.getHeaderMenuSpaceElement()`, `kintone.app.get()`, `kintone.app.getId()`)のみを使用している(`kintone/DataSourceKintone.ts`, `kintone/entry.ts`)
- [x] ビルド成果物(`dashboard.bundle.js`)の先頭に`"use strict"`が出力されている(esbuildの既定動作)ことを確認済み
- N/A — 複数ブラウザでの網羅的な動作確認は行わない方針。Chrome(kintoneの主要利用環境)でのE2Eテストのみ実施

## REST API利用

- [x] 主要な操作はJavaScript API(`getFormFields`/`getQueryCondition`/`getHeaderMenuSpaceElement`/`app.get`)を優先している
- [x] REST APIは「レコード一括取得(カーソルAPI)」「HTMLエクスポート」等、JavaScript APIでは実現できない部分のみ`kintone.api()`(内部向けラッパー)経由で使用。生の`fetch`/`XHR`でkintone自身へのURLを組み立てていない(`kintone/DataSourceKintone.ts`)
- [x] 短時間の大量リクエストを避けている — カーソルAPIは1回のGETごとに逐次await、並列実行はしていない。上限(`LIMITS.maxFetchRecords = 50,000`)で明示的に打ち切る
- [x] 並列でのレコード登録・更新・削除は行っていない(本プラグインは読み取り専用。書き込みはHTMLエクスポートのダウンロードのみでkintoneへの書き込みは一切ない)

## XSS・CSSインジェクション対策

- [x] AI由来・ユーザー入力由来の文字列を`innerHTML`で挿入している箇所はない。`innerHTML`の使用は3箇所のみで、いずれも`= ""`によるクリア(`kintone/setupModal.ts:55`, `kintone/dashboardPanel.ts:71,94`)。動的な値の挿入はすべて`textContent`または`document.createElement`(`render/`配下、`kintone/chatPanel.ts`)
- [x] `document.write`・`eval`は未使用(grep確認済み)
- [x] ダッシュボードのHTMLエクスポート(`export/exportHtml.ts`)でも、JSON埋め込みは`<`を`<`にエスケープして`</script>`によるコンテキスト脱出を防止(`escapeForInlineScript`)、タイトルは`&<>"`をHTMLエスケープ(`escapeHtmlText`)。エクスポートHTML自身のランタイム(`export/runtimeScript.ts`)も冒頭のコメント通り「AI由来の文字列は必ずtextContent/DOM要素で挿入し、innerHTMLには一切渡さない」を徹底(grep確認済み、`createElement`+`textContent`パターンのみ)
- [x] 外部サイトの生JavaScript/CSSをCDN等から読み込んでいない。chart.js/leaflet/leaflet.markercluster/zod/zod-to-json-schemaはすべてビルド時にバンドルへ静的に取り込み(`export/vendorAssets.ts`のコメント通り「CDNからは読み込まず、ビルド時にソースごと文字列としてバンドルへ取り込む」)。実行時に外部から新しいコードを取得することはない
- [x] `pnpm audit --prod`(engine/)で既知の脆弱性0件を確認済み(2026-08-15時点)。lockfile(`pnpm-lock.yaml`)でバージョン固定済み
- [ ] **依存パッケージの定期監査体制は未整備。** 現状は今回1回限りの手動確認。OSS化する場合、CIでの`pnpm audit`自動実行、または少なくとも定期的な手動確認の運用ルールが必要
- [ ] 地図ウィジェットは国土地理院タイル(`https://cyberjapandata.gsi.go.jp/...`)を画像として読み込む外部通信を伴う(`render/renderMap.ts`、無改変)。スクリプト実行のリスクはないが、外部通信である点は下記の開示の議論に含める

## 通信・認証情報の取り扱い(要判断)

- [ ] **APIキーの保存先はガイドラインの推奨から外れているが、方針判断済みでBYOKのまま維持する
      (2026-08-15、ユーザー確認)。** 現在の設計はユーザーがボタン押下のたびにAPIキーを入力し、
      ブラウザのJS変数(メモリ)にのみ保持、`localStorage`/`sessionStorage`/
      `kintone.plugin.app.setConfig()`のいずれにも書き込まない。「推奨しない保存先」に挙がっている
      Web Storageやプラグイン設定は使っていない点は良いが、そもそも**フロントエンドのプログラム自体が
      「推奨しない」に明記されている**(ガイドライン「認証/認可情報の保存先」)。キーは各AIプロバイダへの
      `fetch()`のヘッダー/URLに直接載るため、その通信が行われている間はブラウザの開発者ツール
      (ネットワークタブ)から見える。より準拠した`setProxyConfig`ベースへの切り替え手順は
      `idea.md`の「公開方針」節に記載した(今回は作り直さない、フォーク時の参考として残す)
- [x] 取得したkintoneデータの外部保存はしていない(SpecStore/ResultStoreはブラウザタブのメモリ上のみ、
      ページを閉じると消える。永続化はユーザーが明示的にエクスポートボタンを押した場合のローカル
      ダウンロードのみ)
- [x] **外部送信の開示を強化済み(2026-08-15)。** 選択したAIプロバイダには、フィールド名・絞り込み条件・
      チャット入力・集計値(件数・合計・平均等)が送信される(生レコードは送信しない、これは設計上の
      P1原則で担保)。従来はconfig.html(管理者向け設定画面)に一段落あるのみだったが、実際に
      ボタンを押す一般利用者自身が確認できるよう、接続設定モーダル(`setupModal.ts`)に送信内容の
      一覧と同意チェックボックス(未チェックだとネイティブのHTML5 `required`検証で送信不可)を追加した
- N/A — HTTPS通信: Gemini/OpenAI/Claude各社のAPIエンドポイントはすべてHTTPS
- N/A — ユーザーID識別: 本プラグインは独自のユーザー識別・認可ロジックを持たない

## リダイレクト

- [x] `window.location.href`等への代入は`config.js`の`kintone.app.getId()`ベースの内部URLのみで、外部入力を含まない

## クロスドメイン通信について

- ガイドラインには「クロスドメイン制約のため、XHRを使用したcybozu.comと外部サイトとの通信はできません」
  との記載があるが、これはcybozu.com側が自身のレスポンスにCORSヘッダーを付与しない(＝外部サイトが
  cybozu.comのデータを読み取れない)という説明であり、kintoneのカスタマイズJSが外部のCORS対応API
  (今回のGemini/OpenAI/Claude API)へ発信すること自体を妨げるものではないと解釈している。実際、
  Gemini APIへのブラウザからの直接呼び出しは参照実装(`kintone-dashboard-mcp`)側で実機確認済み。
  OpenAI/Claudeについては未確認(idea.mdの既知の未検証事項と同じ)

## 個別確認事項(利用ユーザーへ委ねる項目)

- 各ブラウザ(Chrome以外)での表示差異
- OpenAI/Claude APIをブラウザから直接呼んだ場合のCORS許可状況の実機確認

## 方針判断の結果(2026-08-15確定)

1. **APIキーの取り扱いモデル: BYOKのまま維持。** `setProxyConfig`ベースへの切り替え手順は
   `idea.md`の「公開方針」節にドキュメント化済み(今回は作り直さない)。
2. **外部通信の開示: 接続設定モーダルへの明示・同意UI追加で対応済み。**(`setupModal.ts`)
3. **公開先: このリポジトリの`site/`(GovAppsプラグイン一覧)経由で公開する。**
   CLAUDE.mdの「外部パッケージ・外部通信を使わない」という他プラグイン共通方針との違いは、
   このプラグインの機能(AIと会話してダッシュボードを作る)上、外部AI通信が本質的に必要である旨を
   明示して差別化する(`idea.md`参照)。

## 今後の対応(未着手)

- `.gitignore`から`natural_text_dashboard`を除外し、git管理下に戻す(現時点では未実施)
- OSS公開に向けたLICENSE・README等の整備
- `site/`公開の通常フロー(`.claude/skills/publish-site/SKILL.md`)に沿った
  `plugins.json`エントリ・個別ページ・スクリーンショット等の追加
- 依存パッケージの定期監査体制(CIでの`pnpm audit`自動実行など)の整備
- 実際のAPIキーでのAI往復・ダッシュボード生成・ドリルダウン・ダウンロードボタン・地図ウィジェットの
  手動動作確認(`idea.md`の現状のステータス参照)
- OpenAI/Claude APIをブラウザから直接呼んだ場合のCORS許可状況の実機確認
