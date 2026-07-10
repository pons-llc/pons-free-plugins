# ユーザー情報ルックアッププラグイン

## 機能

文字列1行またはユーザー選択フィールドに入力された「ユーザーコード(ログイン名)」をもとに、氏名・
メールアドレス・所属・グループなどのユーザー情報を取得し、別の文字列フィールドへ自動入力する。

- ルックアップ設定(以下「設定行」)を複数持てる。設定行ごとに、元フィールド・発動条件・出力先の
  編集可否・転記項目(複数)を持つ。
- 元フィールドはユーザーコードが入力される文字列1行、またはユーザー選択フィールド。ユーザー選択
  フィールドの場合は1人目の値のみを使う(元メモ「ユーザー選択フィールドは１人目の情報のみで良い」)。
- 出力先はすべて文字列フィールド(元メモ「挿入先は文字列フィールド」)。

## 取得できるユーザー情報項目(実機で応答を確認済み)

`kintone.api(kintone.api.url('/v1/users.json', true), 'GET', { codes: [code] })`(User API、
CLAUDE.md開発方針3参照)を実際に検証環境で呼び出し、`users[0]`の実際のプロパティ名を確認したうえで
以下の項目を実装した(推測ではなく実レスポンスを確認済み)。

| 項目キー | ラベル | 取得元 |
| :-- | :-- | :-- |
| `name` | 表示名 | REST(User API) |
| `email` | メールアドレス | REST |
| `phone` | 電話番号 | REST |
| `mobilePhone` | 携帯電話番号 | REST |
| `extensionNumber` | 内線番号 | REST |
| `employeeNumber` | 社員番号 | REST |
| `url` | URL | REST |
| `description` | 自己紹介 | REST |
| `organizations` | 所属(組織、複数は,区切り) | `kintone.user.getOrganizations(code)`(JavaScript API) |
| `groups` | グループ(複数は,区切り) | `kintone.user.getGroups(code)`(JavaScript API) |

所属・グループは元メモの「[所属](...)や[グループ](...)は,区切りで１フィールドに挿入する」の通り、
複数件を`,`(半角カンマ)で結合して1つの文字列フィールドへ格納する(`js/lib/user-attribute-mapping.js`)。

所属・グループはCLAUDE.md開発方針3(JavaScript API優先)に従い、REST(`/v1/user/organizations.json`等)を
使わず`kintone.user.getOrganizations()`/`kintone.user.getGroups()`のみで完結させている。kintone公式Tips
「アンチパターンから学ぶ ユーザーの組織情報とアイコンの取得」がこの実装方法を推奨している一方、
氏名・メールアドレス等の基本プロフィール項目には同等のJavaScript APIが存在しないため、これらのみ
REST(User API)を使う。

## 発動条件(元メモから変更・確定)

元メモは「発動条件はchangeまたはsubmitの選択式」だったが、以下の技術的制約により「ボタン押下時」に
変更した(ユーザー確認済み)。

- kintoneの`change`系イベント(`app.record.create.change.*`/`app.record.edit.change.*`)は
  [イベントオブジェクトで実行できる操作](kintone公式ドキュメント)のPromise対応表で「フィールドの値を
  変更するとき」がPromise非対応(✕)である。ユーザー情報の取得(`kintone.api()`によるREST呼び出し、
  `kintone.user.getOrganizations()`/`getGroups()`)は必ず非同期になるため、`change`イベント内で
  非同期処理の完了を待ってフィールド値をセットする正攻法が存在しない。
- 本リポジトリの`self_lookup`プラグインが同じ制約に実機テストで遭遇済みで(`... is not allowed to
  return "Thenable" object.`エラー)、「`change`イベントの自動発火」から「スペースに設置したボタンを
  クリックして反映」という方式に変更した実績がある(`self_lookup/判断記録.md`の8番)。本プラグインも
  同じ方式を踏襲する。

発動条件は設定行ごとに次の2択。

- **ボタン押下時**(`BUTTON`): 設定画面で指定したスペースフィールドに「ユーザー情報を取得して反映」
  ボタンが設置され、押下時に取得・反映する。ボタンのクリックイベントは`kintone.events.on()`の
  イベントハンドラーの外側なので、非同期処理・`kintone.app.record.get()`/`set()`の呼び出し制限を
  受けない(`self_lookup`と同じ理由)。
- **保存時**(`SUBMIT`): `app.record.create.submit`/`app.record.edit.submit`(Promise対応)で、
  保存直前に取得・反映する。取得に失敗した場合は`event.error`を設定して保存を中断する。

## 該当ユーザーが見つからない場合(確定)

元フィールドが空、またはUser APIで該当ユーザーが見つからない(`users`が空配列)場合、その設定行の
転記項目はすべて空文字列でクリアする(`wareki_date_format`等の既存プラグインと同じ上書き方針)。
所属・グループの取得(`kintone.user.getOrganizations()`/`getGroups()`)に個別に失敗した場合は、その
項目のみ空文字列にしてログに残し、他の転記項目の反映は継続する(1つのAPI呼び出しの失敗で全体を
失敗させない)。User API(REST)自体の呼び出しに失敗した場合は、ボタン押下時はアラート表示、保存時は
`event.error`で保存を中断する(氏名・メール等の主要項目が欠けたまま保存されることを防ぐため)。

## 編集禁止の仕様(元メモ通り、確定)

- 出力先フィールドは、設定行ごとの「出力先フィールドを編集可能にするか」がオフの場合のみ、追加・
  編集画面で`disabled`にする(元メモ「挿入先の編集可不可を選べる」)。オンの場合は編集可能なまま
  残す。
- 元フィールドは、レコード一覧のインライン編集(`app.record.index.edit.show`)で常に`disabled`にし、
  一覧からの直接編集を禁止する(元メモ「一覧画面では元フィールドの編集を不可にする」)。モバイルには
  インライン編集自体が存在しないため対応不要(`self_lookup`と同じ)。

## 設定画面

`kintone.plugin.app.setConfig()`にのみ保存する。設定行を複数持てる。設定行ごとに:

- 元フィールド(文字列1行またはユーザー選択のみ選択可)
- 発動条件(ボタン押下時/保存時)。ボタン押下時を選ぶと、設置するスペースフィールド
  (`kintone.app.getFormLayout()`で取得したSPACERフィールドの`elementId`一覧から選択)が必須になる。
- 出力先フィールドを編集可能にするか(チェックボックス)
- 転記項目(複数追加・削除できる。取得する項目キー→出力先フィールド(文字列1行のみ選択可)の組み合わせ)

保存時に`js/lib/config-validation.js`でチェックする(元フィールド未選択・型不正、発動条件不正、
ボタン押下時のスペース未選択・重複、転記項目0件・属性不正・出力先未選択・型不正・出力先の重複、
出力先と元フィールドの重複を含む)。

## TDD

`src/js/lib/`配下の純粋ロジックはJestでユニットテストする(`pnpm test`)。

- `user-attributes.js` — 転記できるユーザー情報項目の一覧(キー・ラベル・取得元API系統)
- `source-value.js` — 元フィールド(文字列1行/ユーザー選択)の値からユーザーコードを取り出す
  (`extractUserCode`)
- `user-attribute-mapping.js` — User APIのレスポンス(`users[0]`)+所属+グループ+転記項目の配列から、
  出力先フィールドへ書き込む値のオブジェクトを組み立てる(`buildFieldValues`)。所属・グループの
  カンマ結合を含む
- `config-store.js` — `kintone.plugin.app.getConfig()`/`setConfig()`のペイロードの読み書きと
  デフォルト値
- `config-validation.js` — 設定(設定行の配列)のバリデーション

kintone依存のグルーコード(`desktop.js`/`mobile.js`/`config.js`、`kintone.api()`/
`kintone.user.getOrganizations()`/`getGroups()`呼び出しを含む)は`src/e2e/*.e2e.test.js`
(Puppeteer、`pnpm run test:e2e`)で実環境テストする。

## 実装

kintoneドキュメントMCPを参照しながら実装した。`kintone.user.getOrganizations()`/`getGroups()`の
戻り値の形、`change`系イベントのPromise対応表、`kintone.app.record.set()`が`kintone.events.on()`の
イベントハンドラー内で実行できない制約、レコードのフィールド形式で`type`プロパティが常に含まれること
(元フィールドの型判定に`kintone.app.getFormFields()`を別途呼ばずに済ませるため)を確認済み。User
API(`/v1/users.json`)のレスポンス形式は、kintoneドキュメントMCPの corpus に該当ページが無かったため、
検証環境(`.env`の`KINTONE_DOMAIN`)へ実際にリクエストして`users[0]`のプロパティ名を確認した
(推測で実装しない、CLAUDE.md開発方針1参照)。セキュアコーディングガイドラインでのリスクチェックは
`security-checklist.md`を参照。
