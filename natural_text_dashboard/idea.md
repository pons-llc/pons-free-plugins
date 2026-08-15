# natural_text_dashboard(公開名: AIダッシュボード for kintone)

**OSS化・`site/`(GovAppsプラグイン一覧)公開の方針に転換した(2026-08-15)。** 開発初期は非公開・
GitHub非連携のツールとして始め、ルートの`.gitignore`に`natural_text_dashboard`を追加していたが、
方針転換に伴い今後git管理下に戻す予定(詳細は[security-checklist.md](security-checklist.md)の
「今後の対応」参照。`.gitignore`の解除自体はまだ実施していない)。

## 目的

kintoneのレコード一覧画面で、現在の絞り込み条件(「現在のクエリ」)に一致するレコードを対象に、
AIとのチャットで自然言語からダッシュボード(KPI・棒グラフ・折れ線・円グラフ・表・クロス集計・地図)を組み立てる。

- 一覧画面のヘッダーに「現在のクエリでダッシュボードを作成」ボタンを追加
- ボタン押下 → 接続設定モーダル(AIプロバイダ選択: Gemini / OpenAI / Claude、モデル選択、APIキー入力)
- 設定モーダル送信 → メインのワークスペースモーダル(左: チャット、右: ダッシュボード)が開く
- チャットでの依頼に応じて、AIがツール呼び出しだけでダッシュボードを組み立てる(AIは生レコードもHTMLも直接扱わない)

## アーキテクチャ

`~/Documents/kintone-dashboard-mcp`(別リポジトリ、localhost:5173で開発中のWebMCPリファレンス実装)から
エンジン部分をポートして構築している。

```
natural_text_dashboard/
  idea.md                  … このファイル
  engine/                  … TypeScript製のビルド専用プロジェクト(kintone-dashboard-mcpからポート)
    src/
      config/ data/ engine/ export/ mcp/ render/ semantic/ spec/ types/
                            … kintone-dashboard-mcp からそのままコピー(エンジン本体、無改変)
      providers/            … 新規: Gemini/OpenAI/Claude 3プロバイダのtool-callingアダプタ
        types.ts             ProviderSession/ProviderDefinition共通インタフェース
        gemini.ts             generateContent API + functionDeclarations(Gemini独自のJSON Schema制限に対応)
        openai.ts             chat/completions API + tools(function calling)
        claude.ts              messages API + tools(anthropic-dangerous-direct-browser-access:true でブラウザから直接叩く)
        jsonSchema.ts          OpenAI/Claude共通のzod→JSON Schema変換
      kintone/               … 新規: kintone固有の配線
        DataSourceKintone.ts    DataSource実装。現在のクエリに一致するレコードをカーソルAPIで一括取得しメモリにキャッシュ、
                                 以降はkintone-dashboard-mcpのmatchesFilters()でAI由来のフィルタを適用する
        dashboardPanel.ts       kintone-dashboard-mcp/src/app/dashboardPanel.ts を無改変でコピー(プロバイダ非依存)
        chatPanel.ts            チャットUI本体。選んだProviderDefinitionのセッションを介してツール呼び出しループを回す
        setupModal.ts           接続設定モーダル(プロバイダ/モデル/APIキー)
        modal.ts                独自のフルスクリーン近いオーバーレイ(kintone.createDialog()は本文が手狭なため不使用)
        entry.ts                エントリポイント。app.record.index.show でボタン設置、クリックで上記を配線
    vite.config.ts          … IIFEバンドルを ../src/js/dashboard.bundle.{js,css} に直接出力
  src/                      … 実際のkintoneプラグイン(通常のプラグインディレクトリ構成)
    manifest.json, package.json, html/config.html, js/config.js, js/dashboard.bundle.{js,css}(ビルド成果物),
    image/icon.png(box_gdrive_iframeから流用), e2e/dashboard-workflow.e2e.test.js
```

### なぜローカル埋め込みか(リモートMCPにしない理由)

`kintone-dashboard-mcp`側は将来リモートMCPサーバとして公開する計画があるが、このプラグインの
ツール呼び出し(`describe_app`/`add_widget`/…)は `kintone.api()` 経由でブラウザのログインセッションを
使ってkintoneデータを読む。リモートサーバ化するとサーバー側に別途APIトークンを保管する必要が生じ、
secureCodingGuideline.mdの「認証情報の保存先」方針や常時稼働インフラを避けたいため、このプラグインでは
`mcp/tools.ts` の `tools` オブジェクトをページ内で直接呼ぶ(WebMCP登録=`navigator.modelContext`も使わない、
`kintone-dashboard-mcp/src/app/chat.ts`と同じin-process呼び出し方式)。

## ビルド手順

```bash
cd natural_text_dashboard/engine
pnpm install            # 初回のみ(chart.js/leaflet/zod/vite等)
pnpm run typecheck      # tsc --noEmit
pnpm run build          # vite build → ../src/js/dashboard.bundle.{js,css} を更新

cd ../src
pnpm install            # 初回のみ(@kintone/cli, jest, puppeteer)
pnpm run keygen         # 初回のみ
pnpm run build          # cli-kintone plugin pack → dist/plugin.zip
```

`pnpm run upload`(`--watch`)はプロセスが終了しないため、一度きりの検証アップロードには
`./node_modules/.bin/cli-kintone plugin upload --input dist/plugin.zip -y` を
`KINTONE_BASE_URL`/`KINTONE_USERNAME`/`KINTONE_PASSWORD` を環境変数で渡して直接使う。

## 公開方針(2026-08-15更新: 非公開→OSS化に転換)

当初は非公開・GitHub非連携のツールとして作り始めたが、OSS化して`site/`(GovAppsプラグイン一覧)に
掲載する方針に転換した。詳細なレビュー結果は[security-checklist.md](security-checklist.md)を参照。
以下は公開に向けた方針判断の結果(2026-08-15、ユーザー確認済み):

- **APIキーの取り扱いは現行のBYOK(利用者ごとに毎回自分のキーを入力)のまま公開する。**
  secureCodingGuideline.mdは「認証情報をフロントエンドのプログラムに置くこと」自体を推奨しない
  としており、より準拠した構成は`kintone.plugin.app.setProxyConfig()`/`getProxyConfig()`
  (管理者が1つのAPIキーをkintone側に登録し、実際のAI呼び出しはcybozu.comのプロキシ経由で
  サーバーサイドから行う。キーがブラウザに一切渡らない)を使う「管理者が1つのキーを設定し
  全利用者が共有する」モデルへの作り直しである。**今回はこの作り直しは行わず、必要に応じて
  フォークして`setProxyConfig`ベースに修正して使うことを想定した説明を残すに留める。**
  切り替える場合の要点: `manifest.json`に`config.js`から呼べる`kintone.plugin.app.setProxyConfig()`用の
  UIを追加(プロキシ先ホストの許可設定含む)、`providers/*.ts`の`fetch()`呼び出しを
  `kintone.proxy()`(または`kintone.proxy.upload`)経由に置き換え、接続設定モーダル
  (`setupModal.ts`)からAPIキー入力欄自体を削除する。
- **選んだAIプロバイダへの外部送信は、接続設定モーダル自体に開示・同意UIを追加して対応済み。**
  以前はconfig.html(管理者向け設定画面)に一段落あるだけだったが、実際にボタンを押す一般利用者
  自身が確認できるよう、`setupModal.ts`に送信内容の一覧(フィールド名・絞り込み条件・チャット入力・
  集計値。レコードの生データは含まない)と、同意チェックボックス(未チェックだと送信不可、
  ネイティブのHTML5 `required`検証を利用)を追加した。
- 地図ウィジェットは国土地理院タイル(`https://cyberjapandata.gsi.go.jp/...`)への外部通信を伴う
  (`render/renderMap.ts`、kintone-dashboard-mcp由来、無改変)。地図を使わなければ発生しない。
- ビルドにVite+TypeScript+chart.js+leafletを使っており、リポジトリ共通の「バンドラーを導入しない」
  「外部パッケージ・外部通信を使わない」方針(CLAUDE.md開発方針9、他の全公開プラグイン共通)からは
  意図的に外れている。site/への掲載時は、この点を他プラグインとの差別化ポイントとして明示し
  (「AIと会話してダッシュボードを作る」という機能上、外部AI通信が本質的に必要である旨)、
  利用者に事前周知することが前提となる。
- AIに渡るのはスキーマ・集計結果の要約・エラーメッセージのみで、レコードの生データそのものは
  送信しない(P1、`kintone-dashboard-mcp`の設計原則を継承)。

## 現状のステータス(2026-08-15時点)

- [x] エンジン移植(型チェック・vite buildとも成功、bundle.js 935KB / bundle.css 17KB)
- [x] KintoneDataSource(カーソルAPIでの全件取得、現在のクエリ、getFormFields/getQueryConditionの挙動をkintone_doc MCPで確認済み)
- [x] Gemini/OpenAI/Claude 3プロバイダのtool-callingアダプタ実装
- [x] 接続設定モーダル→チャット+ダッシュボードのワークスペースの配線
- [x] 実環境(検証環境アプリTEST_APP_ID_1・ARTICLE_APP_ID=635)でのE2Eスモークテスト成功(ボタン表示→設定モーダル→ワークスペース表示、コンソールエラーなし)。`src/e2e/dashboard-workflow.e2e.test.js`
- [x] Gemini既定モデルを`gemini-3.5-flash-lite`に変更(2.5-flashが分間レート制限に引っかかったため)
- [x] チャット送信はShift+Enterのみに変更(IME変換確定のEnterと送信が衝突する問題を根本的に回避)
- [x] `export_html`をAIに渡すツールから除外し、ダッシュボード欄に常設の「ダウンロード」ボタンを追加
      (AIの気まぐれな自動ダウンロードを防止。地図ウィジェットを含む場合は確認ダイアログを挟む)
- [x] ドリルダウン(チャート/表クリックでの絞り込み・粒度変更)が独自モーダルオーバーレイ(`.ntd-overlay`,
      z-index:100000)の下に隠れて押せなくなっていたバグを修正。`.kdm-drill-menu`のz-indexを
      `entry.ts`のEXTRA_CSSで100010に上書き(ユーザー報告「月別グラフをクリックしても時系列絞り込みが
      できない」から発覚。時系列バケットのキー生成・解析経路自体は問題なく、z-indexのみが原因と確認済み)
- [x] ドリルダウンメニューの背景が透明でグラフに文字が重なって読めなかったバグを修正。
      `.kdm-drill-menu`の`background: var(--kdm-surface)`は`.kdm-root`スコープでしか定義されない
      CSS変数だが、メニュー自体は`document.body`直下(`.kdm-root`の外)に追加されるため変数が
      解決できていなかった。`entry.ts`のEXTRA_CSSで`--kdm-surface`等を`:root`にも複製して解消
      (値はrender/theme.tsのCHROME定数と同じものを転記、ライト/ダーク両対応)
- [x] secureCodingGuideline.mdに基づくセキュリティレビュー実施([security-checklist.md](security-checklist.md))。
      APIキー保存・XSS対策・依存パッケージ監査等を確認。OSS化にあたっての方針判断(APIキー方式・
      外部送信の開示・公開先)をユーザーと確認し、接続設定モーダルへの開示・同意UI追加で対応済み
- [ ] **実際のAPIキーでのAI往復・ダッシュボード生成は未検証。** ダミーキーでの配線確認のみ。
      Gemini/OpenAI/Claudeそれぞれ実キーでの動作確認と、ブラウザからの直接呼び出しのCORS許可状況の
      実機確認が必要(特にOpenAI/Claudeは未確認。Geminiはkintone-dashboard-mcp側で実機確認済み)。
- [ ] `export_html`(ダウンロードボタン)・地図ウィジェット・ドリルダウンの実際のクリック動作は、
      実際のAPIキーでダッシュボードを作成しての手動確認がまだ済んでいない(E2Eスモークテストの範囲外)。
- [ ] エンジン側の既存ユニットテスト(`kintone-dashboard-mcp/tests/`)はこちらには移植していない
      (無改変でコピーしたモジュールの回帰はkintone-dashboard-mcp側で担保する想定)。
