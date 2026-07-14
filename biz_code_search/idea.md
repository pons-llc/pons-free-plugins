# 法人番号検索プラグイン(biz_code_search)

## 機能

経済産業省が提供する[gBizINFO](https://info.gbiz.go.jp/) REST API v2を利用し、次の2方向の入力補助を行う。

1. **法人番号 → 法人情報入力**: 法人番号フィールドの値をもとに`GET /v2/hojin/{corporate_number}`を呼び、
   代表者名・資本金・所在地等の法人基本情報を取得して、設定した転記項目に反映する。
2. **法人名 → 法人番号入力**: 法人名フィールドの値をもとに`GET /v2/hojin?name=...`(部分一致検索)を呼び、
   候補が複数件ある場合はモーダルで一覧表示してユーザーに選ばせる(`self_lookup`の候補選択モーダルと
   同じUXパターンを踏襲)。選択した候補の法人番号を法人番号フィールドへ反映したうえで、続けて1の
   詳細取得処理を実行し、転記項目もまとめて埋める。

いずれもボタン押下時に実行する(レコード追加・編集画面にボタンを設置)。`self_lookup`/`org_lookup`と
同じ理由(外部通信は必ず非同期になり、`change`系イベントがPromise非対応なため)で、発動条件は
「ボタン押下時」のみとする(保存時発動は本プラグインでは提供しない)。

## なぜgBizINFOか(国税庁法人番号公表サイトAPIとの違い)

法人番号を使った企業情報取得プラグインは国税庁の「法人番号公表サイトWeb-API」を使うものが多いが、
そちらは法人番号・商号・所在地等の登記情報に限られる。gBizINFOは経済産業省が同じ法人番号を軸に、
資本金・従業員数・代表者名・財務情報・特許・補助金・調達実績等の**より広い企業情報**を無料で提供して
おり、かつ法人名の部分一致検索にも対応する。API利用申請から**即日〜数時間程度でAPIトークンが届く**
(申請直後に使える国税庁側より早いことが多い)点も、BYODプラグインとして案内する利点として明記する。

## 技術アプローチ(kintone.proxyの例外的許可)

CLAUDE.md開発方針9「外部サーバーへの通信を行わない」の**意図的な例外**として、本プラグインのみ
`kintone.plugin.app.proxy()`(kintone.proxyのプラグイン専用版)を使いgBizINFOへ通信する。APIトークンは
`kintone.plugin.app.setProxyConfig()`で秘匿領域に保存し、`kintone.plugin.app.getConfig()`では取得
できない(プラグイン設定screen再訪時も値は復元されず、「設定済みかどうか」のフラグのみ通常の
`setConfig()`側に保持する)。詳細は[外部APIの実行に必要な情報をプラグインへ保存する](https://cybozu.dev/ja/kintone/docs/js-api/plugins/set-config-for-proxy/)・
[プラグインから外部APIを実行する](https://cybozu.dev/ja/kintone/docs/js-api/plugins/kintone-plug-in-proxy/)
(kintone_doc MCPで確認済み)。

- `setProxyConfig(url, method, headers, data, successCallback)`: 設定画面の保存時、APIトークン欄に
  値が入力されている場合のみ呼ぶ(空欄のまま保存した場合は既存のトークンを維持する。値を再表示・
  再送信することはできないため)。
- `proxy(pluginId, url, method, headers, data, successCallback, failureCallback)`: `desktop.js`/
  `mobile.js`から実際にAPIを呼ぶ際に使う。
- 保存条件は「アプリ・プラグイン・HTTPメソッド・URL前方一致」がすべて一致すること。本プラグインでは
  `setProxyConfig`/`proxy`とも`https://api.info.gbiz.go.jp/hojin/v2/hojin`をURLに使う(詳細取得は
  末尾に`/{corporate_number}`、検索は`?name=...`が続くが、いずれも前方一致するため同じ設定1件で
  両方カバーできる)。

## gBizINFO API仕様(実際にOpenAPI仕様を取得して確認済み、推測実装ではない)

`https://api.info.gbiz.go.jp/hojin/v3/api-docs?group=v2`から実際のOpenAPI(v3)仕様を取得し、
`biz_code_search/gbiz-v2-openapi.json`として保存した(パス・パラメータ・レスポンススキーマを
このファイルから直接確認できる)。ユーザー提供のswagger UI参照(`gbiz-reference.html`、
`GET /v2/hojin/{corporate_number}`のDOM断片)と一致することも確認済み。

- ベースURL: `https://api.info.gbiz.go.jp/hojin`(OpenAPIの`servers`はこのホストからの相対パス`/hojin`)
- 認証ヘッダー: `X-hojinInfo-api-token`(必須)
- **詳細取得**: `GET /v2/hojin/{corporate_number}` — 法人番号(13桁)完全一致。レスポンスは
  `{ "hojin-infos": [HojinInfoV2, ...], "message": "...", "errors": [...] }`。
  `hojin-infos`が空配列の場合は該当法人なし。
- **法人名検索**: `GET /v2/hojin?name=...&limit=...` — 法人名部分一致。他にも`corporate_type`
  ・`prefecture`・`capital_stock_from/to`等多数の絞り込みパラメータがあるが、本プラグインでは
  `name`と`limit`のみ使う(過剰な設定項目を持たせない)。レスポンス内の各法人情報
  (`HojinInfoSearchV2`)は`corporate_number`/`name`/`name_en`/`location`/`postal_code`/`status`/
  `update_date`/`number_of_activity`のみを持つ**簡略版**であり、詳細フィールド(資本金・代表者名等)
  は含まれない。そのため名前検索で候補を選んだあとは、選ばれた法人番号で改めて詳細取得APIを
  呼び、転記項目を埋める(2回のAPI呼び出しになるが、UI上は1回の操作として見せる)。
- `page`は1〜10、`limit`は0〜5000(既定1000)まで指定できるが、本プラグインでは大量ヒットを
  避けるため`limit=50`固定・ページングは実装しない(50件を超える一致がある場合は検索語句を
  絞り込むよう促す。`self_lookup`が500件上限を明記しているのと同種の割り切り)。

### 転記できる項目(`js/lib/gbiz-attributes.js`)

`HojinInfoV2`(詳細取得のレスポンス)のスカラー値のみを対象にする。配列・入れ子オブジェクトの項目
(特許・補助金・届出認定・表彰・調達・財務・職場情報・事業所情報等)は転記対象に含めない
(1フィールド=1値という kintone のフィールドマッピングの性質上、配列は素直に転記できないため。
必要であれば将来の別プラグインで扱う)。

| 項目キー | ラベル |
| :-- | :-- |
| `name` | 法人名 |
| `kana` | 法人名フリガナ |
| `name_en` | 法人名(英語) |
| `postal_code` | 郵便番号 |
| `location` | 本社所在地 |
| `representative_name` | 代表者名 |
| `capital_stock` | 資本金 |
| `employee_number` | 従業員数 |
| `founding_year` | 創業年 |
| `date_of_establishment` | 設立年月日 |
| `business_summary` | 事業概要 |
| `company_url` | 企業ホームページ |
| `kind` | 法人種別 |
| `status` | ステータス |
| `update_date` | 更新年月日 |

出力先フィールドは(`org_lookup`と同じ方針で)**文字列(1行)のみ**選択可とする。数値・整数系の項目
(資本金・従業員数・創業年)も文字列フィールドへ文字列化して書き込む(桁数の大きい資本金を数値
フィールドの精度・書式設定に合わせ込む複雑さを避けるため)。

## 法人番号のバリデーション(`js/lib/corporate-number.js`)

日本の法人番号は13桁の数字(チェックディジット付き)。本プラグインではAPIへの無駄なリクエストを
防ぐための簡易チェックとして`/^\d{13}$/`の形式チェックのみ行い、チェックディジットの計算検証までは
実装しない(過剰実装を避ける。形式が合っていればAPI側で存在確認できる)。

## 設定画面

`kintone.plugin.app.setConfig()`に保存する項目は次の2つ。

- `apiTokenConfigured`(真偽値文字列): APIトークンが1度でも保存されたことがあるかのフラグ。
  トークンの値自体は保持しない(`setProxyConfig`側にのみ保存され、JavaScriptからは読み出せない)。
- `lookups`(配列、JSON文字列): 設定行。設定行を複数持てる(1アプリに法人番号を持つ項目が複数ある
  ケースを想定)。設定行ごとに:
  - 法人番号フィールド(文字列(1行)のみ選択可、必須) — ボタン1の入出力・ボタン2で選択後の反映先
  - 法人名フィールド(文字列(1行)のみ選択可、必須) — ボタン2の検索キー
  - 法人番号から取得ボタンの設置スペース(`kintone.app.getFormLayout()`のSPACER一覧、必須、
    全設定行を通してユニーク)
  - 法人名から検索ボタンの設置スペース(同上、必須、全設定行・全ボタンを通してユニーク)
  - 転記項目(複数追加・削除。属性キー→出力先フィールドの組み合わせ。出力先は全設定行を通して
    重複不可、かつ法人番号・法人名フィールド自体とも重複不可)

保存時に`js/lib/config-validation.js`でチェックする。

## エッジケース(確定)

- **APIトークン未設定でボタン押下**: `kintone.plugin.app.proxy()`は401等のエラーレスポンスを返す
  (`failureCallback`で捕捉)。「gBizINFO APIの呼び出しに失敗しました」+エラー内容をalert表示する。
  事前のトークン設定チェックは行わない(設定済みかを正確に判定する手段がJS側にないため、実際に
  呼んでエラーを見る方針)。
- **法人番号の形式が不正**(13桁の数字でない): APIを呼ばずにalertで即エラー表示。
- **法人番号詳細取得で0件**(該当法人なし): 転記項目をすべて空文字列でクリアし、alert表示
  (`self_lookup`/`org_lookup`と同じ「該当なしはクリア」方針)。
- **法人名検索で0件**: 法人番号フィールド・転記項目をすべて空文字列でクリアし、alert表示。
- **法人名検索で1件以上**: 件数によらず必ずモーダルで確認させてから反映する(`self_lookup`の
  「常にモーダル経由、自動即時反映はしない」方針を踏襲)。
- **法人名検索で50件超のヒット**: `limit=50`で取得できた分のみモーダルに表示する(超過分は
  取得しない。より絞り込んだ法人名での再検索を促す)。
- **通信エラー**(存在しないドメイン・ネットワーク瞬断等): `failureCallback`で捕捉しalert表示。
  レコードへの反映は行わない(中途半端な上書きを避ける)。

## クリアボタン(確定、ユーザーフィードバック反映)

本プラグインは値取得系のボタンのみで、取得済みの値を取り消す手段が無かったため「クリア」ボタンを
追加した。専用の設定項目(スペースフィールド選択)は設けず、「法人番号から取得」「法人名から検索」
ボタンと同じスペースフィールドの中にそれぞれ自動的に追加表示される(ユーザーが新たにスペース
フィールドを配置する手間を増やさないため)。主ボタンより一回り小さいスタイル(`bcs-button-small`)
にし、視覚的な優先度を下げている。

押すと`confirm()`で確認したうえで、法人番号フィールド・法人名フィールド・転記項目の出力先フィールドを
すべて空文字列にクリアする。

### 既知の落とし穴: kintone.app.record.set()で値を空文字列にクリアすると、valueキー自体が消える

実際に検証環境で確認した挙動として、`kintone.app.record.set()`でフィールドの`value`に空文字列を
渡すと、その後の`kintone.app.record.get()`では`value`キー自体が存在しなくなり(`undefined`)、
`''`にはならない(数値・チェックボックス等でも同様の可能性がある。文字列(1行)フィールドで確認済み)。
このため:

- クリア後の値を判定する際は`value === ''`ではなく、`!value`(偽値)で判定する
  (E2Eテストの待機条件・アサーションもこれに合わせている)。
- `field.value.trim()`のように`.value`に対してメソッドを直接呼ぶ箇所は、`field.value`が
  `undefined`になり得る前提で`field && field.value ? field.value.trim() : ''`のように
  ガードする(`desktop.js`/`mobile.js`の法人名読み取り箇所で対応済み)。
- 法人番号詳細取得・法人名検索の「該当なし」時に転記項目を空文字列でクリアする処理
  (`applyHojinInfoToRecord(null, lookup)`)も同じ挙動の影響を受けるが、クリア後にその
  フィールド値を読み返す処理が無いため実害はない。

## 出力先フィールドの編集禁止(`self_lookup`と同じ方針)

転記項目の出力先フィールドは、レコード追加・編集画面で常に`disabled`にする(手動編集不可)。
法人番号フィールド・法人名フィールドはユーザーが入力する元データなので`disabled`にしない。

## TDD

`src/js/lib/`配下の純粋ロジックをJestでテストする(`pnpm test`)。

- `corporate-number.js` — `isValidCorporateNumber(value)`(13桁数字の形式チェック)
- `gbiz-attributes.js` — 転記できる項目キー・ラベルの一覧
- `gbiz-api.js` — ベースURL定数・詳細取得URL/検索URLの組み立て(`buildDetailUrl`/`buildSearchUrl`)
- `gbiz-field-mapping.js` — 詳細情報(またはnull)+転記項目の配列から、出力先フィールドへ書き込む
  値のオブジェクトを組み立てる(`buildFieldValues`。数値項目は文字列化、null/undefinedは空文字列)
- `config-store.js` — `getConfig()`/`setConfig()`のペイロードの読み書きとデフォルト値
- `config-validation.js` — 設定(設定行の配列)のバリデーション

kintone依存のグルーコード(`desktop.js`/`mobile.js`/`config.js`、`kintone.plugin.app.proxy()`呼び出しを
含む)とDOM専用の`result-modal.js`(モーダル描画、jsdom未導入のためJestのnode環境ではテストできない)は
`src/e2e/*.e2e.test.js`(Puppeteer)で実環境テストする。

**実運用APIキーが必要なE2Eシナリオの制約**: gBizINFOのAPIトークンはBYOD(利用者が自分で申請・取得)
のため、開発・CI環境には実トークンが存在しない。そのためPuppeteer E2Eでは、設定画面が開けること・
プルダウンの絞り込みが効くこと(`config-screen.e2e.test.js`、公開サイト用スクリーンショットもここで
撮影)・法人番号の形式バリデーションでAPIを呼ばずにエラー表示することを確認し、実際にgBizINFOへ
リクエストが成功する経路(トークン設定済み前提)は自動テストの対象外とする(利用者が自分のトークンを
設定した実機での動作確認に委ねる)。

## 実装

kintoneドキュメントMCPで`kintone.proxy()`/`kintone.plugin.app.setProxyConfig()`/
`kintone.plugin.app.proxy()`の仕様を確認済み(公式Tips「kintoneプラグインで秘匿情報を隠す〜実践編〜」
のSlack連携サンプルコードと同じ呼び出しパターンを採用)。gBizINFOのAPI仕様は公式サイトの
OpenAPI仕様(`https://api.info.gbiz.go.jp/hojin/v3/api-docs?group=v2`)を実際に取得して確認した
(推測実装ではない。取得したJSONは`biz_code_search/gbiz-v2-openapi.json`として保存)。
セキュアコーディングガイドラインでのリスクチェックは`security-checklist.md`を参照。
