# 組織ルックアッププラグイン

## 機能

文字列1行または組織選択フィールドに入力された「組織コード」をもとに、組織名・説明・親組織の情報を
取得し、別の文字列フィールドへ自動入力する。`user_info_lookup`(ユーザー情報ルックアッププラグイン)と
同様の仕様で実装するが、以下の点が異なる。

- 組織に所属するユーザーの情報は取得しない(元メモ「所属するユーザーは不要で組織テーブルだけ取得
  できればいい」)。
- 親組織が設定されている場合は、親組織の情報も1階層分だけ追加取得する。親のさらに親(祖父にあたる
  組織)までは遡らない(元メモ「親組織があった場合は親組織もルックアップする。祖父以上までは遡らない」)。

## 取得できる組織情報項目(実機で応答を確認済み)

`kintone.api(kintone.api.url('/v1/organizations.json', true), 'GET', { codes: [code] })`(User APIと
同じ系統のOrganization API、CLAUDE.md開発方針3参照)を実際に検証環境で呼び出し、
`organizations[0]`の実際のプロパティ名(`id`/`code`/`name`/`localName`/`localNameLocale`/
`parentCode`/`description`)を確認したうえで以下の項目を実装した(推測ではなく実レスポンスを確認済み)。

| 項目キー | ラベル | 取得元 |
| :-- | :-- | :-- |
| `name` | 組織名 | 自組織 |
| `localName` | 組織名(別言語) | 自組織 |
| `description` | 組織の説明 | 自組織 |
| `parentCode` | 親組織コード | 自組織(`parentCode`の生値、親組織の取得可否によらず表示できる) |
| `parentName` | 親組織名 | 親組織(親組織が無い/取得できない場合は空文字列) |
| `parentLocalName` | 親組織名(別言語) | 親組織 |
| `parentDescription` | 親組織の説明 | 親組織 |

組織を取得するJavaScript APIは存在しない。`kintone.user.getOrganizations(userCode)`は「ユーザーコードから
そのユーザーが所属する組織一覧を取得する」API であり、本プラグインが必要とする「組織コードから組織
そのものを取得する」用途には使えないため、CLAUDE.md開発方針3に従いkintone自身への`kintone.api()`呼び出し
(Organization API)のみを使用する。

## 親組織を1階層だけ遡るロジック(確定)

`js/lib/resolve-org-info.js`の`resolveOrgInfo(code, fetchOrgByCode)`が担う。

1. `code`が空文字列なら、REST呼び出しを行わずに`{ org: null, parentOrg: null }`を返す。
2. `code`で組織を1件取得する(`fetchOrgByCode(code)`)。見つからなければ
   `{ org: null, parentOrg: null }`を返す(該当組織なし)。
3. 取得できた組織(`org`)が`parentCode`を持つ場合のみ、`fetchOrgByCode(org.parentCode)`を1回だけ
   追加実行して`parentOrg`とする。`parentOrg`自身の`parentCode`は一切参照しない(祖父にあたる組織を
   取得するAPI呼び出しは発生しない)。

`fetchOrgByCode`を呼び出し側(`desktop.js`/`mobile.js`)から注入する設計にすることで、この「1階層だけ
遡る」というオーケストレーションロジック自体をkintone依存なしにJestで確定的にテストできるようにした
(祖父にあたる組織のコードでは`fetchOrgByCode`が呼ばれないことをモックで検証、
`__tests__/resolve-org-info.test.js`参照)。検証環境には親子関係を持つ組織が存在しない
(手動での組織作成はcybozu.com共通管理へのアプリ横断的な変更のため今回は行わなかった)ため、
この階層制御ロジックはユニットテストのみで検証し、E2E(Puppeteer)では「親組織を持たない組織」の
ケース(実際の検証環境データ)のみを実機確認している。

## 発動条件(user_info_lookupと同じ理由で「ボタン押下時/保存時」)

`kintone`の`change`系イベント(`app.record.create.change.*`/`app.record.edit.change.*`)はPromise非対応
(kintone公式ドキュメントのPromise対応表で「フィールドの値を変更するとき」が✕)であり、組織情報の取得
(`kintone.api()`によるREST呼び出し)は必ず非同期になるため、`change`イベント内で完了を待ってフィールド
値をセットする正攻法が存在しない。`user_info_lookup`・`self_lookup`と同じ理由・同じユーザー確認の結果、
発動条件は設定行ごとに次の2択とした。

- **ボタン押下時**(`BUTTON`): 設定画面で指定したスペースフィールドに「組織情報を取得して反映」ボタンが
  設置され、押下時に取得・反映する。ボタンのクリックイベントは`kintone.events.on()`のイベント
  ハンドラーの外側なので、非同期処理・`kintone.app.record.get()`/`set()`の呼び出し制限を受けない。
- **保存時**(`SUBMIT`): `app.record.create.submit`/`app.record.edit.submit`(Promise対応)で、保存直前に
  取得・反映する。取得に失敗した場合は`event.error`を設定して保存を中断する。

## 該当組織が見つからない場合(確定)

元フィールドが空、またはOrganization APIで該当組織が見つからない(`organizations`が空配列)場合、その
設定行の転記項目はすべて空文字列でクリアする。親組織が設定されていない、または親組織自体が取得できない
場合、親組織系の項目(`parentName`/`parentLocalName`/`parentDescription`)のみ空文字列にする
(`parentCode`は自組織の生値なので、親組織の取得可否に関わらずそのまま表示される)。

## 編集禁止の仕様(user_info_lookupと同じ、確定)

- 出力先フィールドは、設定行ごとの「出力先フィールドを編集可能にするか」がオフの場合のみ、追加・
  編集画面で`disabled`にする。
- 元フィールドは、レコード一覧のインライン編集(`app.record.index.edit.show`)で常に`disabled`にし、
  一覧からの直接編集を禁止する。モバイルにはインライン編集自体が存在しないため対応不要。

## 設定画面

`kintone.plugin.app.setConfig()`にのみ保存する。設定行を複数持てる。設定行ごとに:

- 元フィールド(文字列1行または組織選択のみ選択可)
- 発動条件(ボタン押下時/保存時)。ボタン押下時を選ぶと、設置するスペースフィールド
  (`kintone.app.getFormLayout()`で取得したSPACERフィールドの`elementId`一覧から選択)が必須になる。
- 出力先フィールドを編集可能にするか(チェックボックス)
- 転記項目(複数追加・削除できる。取得する項目キー→出力先フィールド(文字列1行のみ選択可)の組み合わせ)

保存時に`js/lib/config-validation.js`でチェックする(元フィールド未選択・型不正、発動条件不正、
ボタン押下時のスペース未選択・重複、転記項目0件・属性不正・出力先未選択・型不正・出力先の重複、
出力先と元フィールドの重複を含む)。

## TDD

`src/js/lib/`配下の純粋ロジックはJestでユニットテストする(`pnpm test`)。

- `org-attributes.js` — 転記できる組織情報項目の一覧(キー・ラベル)
- `source-value.js` — 元フィールド(文字列1行/組織選択)の値から組織コードを取り出す
  (`extractOrgCode`)
- `resolve-org-info.js` — 組織コード+`fetchOrgByCode`(注入される取得関数)から、自組織+
  (あれば)直属の親組織のみを解決する(`resolveOrgInfo`)。祖父にあたる組織へは絶対に遡らないことを
  モックで確定的にテストしている
- `org-attribute-mapping.js` — 自組織+親組織+転記項目の配列から、出力先フィールドへ書き込む値の
  オブジェクトを組み立てる(`buildFieldValues`)
- `config-store.js` — `kintone.plugin.app.getConfig()`/`setConfig()`のペイロードの読み書きと
  デフォルト値
- `config-validation.js` — 設定(設定行の配列)のバリデーション

kintone依存のグルーコード(`desktop.js`/`mobile.js`/`config.js`、`kintone.api()`呼び出しを含む)は
`src/e2e/*.e2e.test.js`(Puppeteer、`pnpm run test:e2e`)で実環境テストする。

## 実装

kintoneドキュメントMCPを参照しながら実装した。Organization API(`/v1/organizations.json`)のレスポンス
形式は、kintoneドキュメントMCPのcorpusに該当ページが無かったため、検証環境(`.env`の
`KINTONE_DOMAIN`)へ実際にリクエストして`organizations[0]`のプロパティ名を確認した(推測で実装しない、
CLAUDE.md開発方針1参照)。セキュアコーディングガイドラインでのリスクチェックは
`security-checklist.md`を参照。
