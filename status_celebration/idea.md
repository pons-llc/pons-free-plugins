# お祝いプラグイン

## 機能概要

レコードのステータス(ドロップダウン/ラジオボタン、またはプロセス管理のステータス)が、設定画面で
指定した値になった(遷移した)ときに、レコード画面上でお祝い演出(くす玉・クラッカー・紙吹雪)を表示する。
`status_arrow`(矢羽プラグイン)と対象フィールドの考え方(ドロップダウン/ラジオボタン or プロセス管理の
ステータス)を共有するが、以下の点が異なる。

- 矢羽根のような常時表示のUIではなく、遷移した瞬間にだけ数秒間の演出を表示する(元メモ「ステータスが
  特定の値になった時、くす玉やクラッカーなどでお祝いが表示される」)。
- 1つのウィジェット(以下「ルール」)につき、お祝い対象の値を**複数選択**できる(元メモの追加要望
  「ステータスの選択は設定よんでドロップダウンにしてね。複数ステータスに設定できるように」)。
- 演出パターンは「くす玉」「クラッカー」「紙吹雪」の3種、またはランダム。派手すぎず、達成感がある程度の
  規模・時間(2〜3秒、画面全体を覆わない)に抑える(元メモの追加要望「派手すぎず、でも達成感がある感じで」)。

## 対象フィールド(status_arrowを踏襲、確定)

- **ドロップダウン(DROP_DOWN)・ラジオボタン(RADIO_BUTTON)**: `kintone.app.getFormFields()`で列挙する。
- **プロセス管理のステータス**: `sourceType: 'STATUS'`を選ぶと、固定のフィールド名`ステータス`ではなく
  プロセス管理専用のイベント(後述)経由で値を扱う。設定画面ではJavaScript API(`kintone.app.getStatus()`)が
  プラグイン設定画面では使えないため、`status_arrow`と同じ理由でREST API(`GET /k/v1/app/status.json`)を
  `kintone.api()`経由で呼び、選択肢一覧(ドロップダウン)を作る。

## お祝い対象の値は複数選択(確定・status_arrowとの違い)

`status_arrow`のステップは「並び順」を持つ配列(矢羽根の描画順が意味を持つ)だが、本プラグインの
お祝い対象値は「このどれかになったら発火する」という集合(順序に意味がない)なので、`triggerValues: string[]`
として複数選択のチェックボックス一覧(設定画面でフィールド・ステータスの選択肢を`kintone.app.getFormFields()`
/ REST APIから取得し、動的にチェックボックスを描画)で持たせる。空集合は保存時エラーとする。

## 発火条件(「なった」= 遷移の検出、確定)

「値がすでにその状態であるとき」ではなく「値がその状態に**変わった**とき」にだけ発火させる(元メモの
「ステータスが特定の値になった時」、レコードを開くたびに毎回演出されると煩わしいため)。ソース種別によって
遷移の検出方法が異なる。

### ドロップダウン/ラジオボタン(`sourceType: 'FIELD'`)

`app.record.create.change.<フィールドコード>` / `app.record.edit.change.<フィールドコード>`
(モバイルは`mobile.`プレフィックス)を使う。このイベントは変更後の値(`event.changes.field.value`)は
渡すが、変更前の値を渡さないため、`app.record.create.show` / `app.record.edit.show`時点の値を
モジュール内の状態(ルールごとの直近値)として保持しておき、changeイベントのたびに
「直近値 → 新しい値」の組で比較・発火判定した後、直近値を更新する(`js/lib/celebration-trigger.js`の
`resolveTrigger(rule, previousValue, currentValue)`)。

### プロセス管理のステータス(`sourceType: 'STATUS'`)

`app.record.detail.process.proceed`(モバイルは`mobile.app.record.detail.process.proceed`、
アクション実行前に発火)の`event.status.value`(変更前)・`event.nextStatus.value`(変更後)を
そのまま`resolveTrigger`の`previousValue`/`currentValue`に渡す。ドキュメントに「アクションの実行に
よってレコードのステータスが変わらないときでもこのイベントが発生する」と明記されているため、
`status`と`nextStatus`が同じ場合は発火しないようにする(`resolveTrigger`が値の一致判定を担う)。
イベントハンドラーでは何もreturnしない(アクション自体の実行をブロックしない、演出はアクション実行前の
時点で表示する)。

`resolveTrigger`は共通の純粋関数として実装し、ソース種別による「変更前の値の取得方法の違い」だけを
呼び出し側(`desktop.js`/`mobile.js`)で吸収する。

## 演出パターン(確定)

- `KUSUDAMA`(くす玉): 画面上部中央でくす玉が割れ、紙吹雪が短く舞い、達成メッセージのバナーが浮かぶ。
- `CRACKER`(クラッカー): 画面下部の左右2箇所からクラッカーの紙テープ・紙吹雪が放たれる。
- `CONFETTI`(紙吹雪): 画面上部全体から紙吹雪が静かに降る(3パターンの中で最も控えめ)。
- `RANDOM`: ルールごとに上記3パターンからランダムに1つを選ぶ(`js/lib/celebration-trigger.js`の
  `resolvePattern(pattern, pickRandom)`。`pickRandom`を注入可能にし、Jestで決定的にテストする)。

派手すぎない基準として、(1) 演出は2.5秒程度で自動的に消える、(2) 画面全体を覆う演出は紙吹雪のみで
不透明な要素を置かない、(3) 音声・効果音は鳴らさない(kintoneの他の操作音・通知と衝突しない、
ユーザーの環境音量設定に配慮)、の3点を採用した。

## 描画位置・実装方式(確定)

`kintone.app.record.getHeaderMenuSpaceElement()`はPC専用のため使わず、`position: fixed`の
オーバーレイ要素を`document.body`に追加してCSSアニメーション(`transform`/`opacity`)で描画する。
これによりPC・モバイル両方で同じDOM構造を使い回せる。オーバーレイは`pointer-events: none`にして、
演出中も背後のフォーム操作を妨げない。

## 対応画面・モバイル対応(確定・status_arrowより広い)

`getHeaderMenuSpaceElement()`のようなPC専用APIに依存しないため、モバイルにも対応する
(`manifest.json`の`mobile`に`mobile.js`を追加)。対応イベントは以下の通り。

- PC: `app.record.create.change.<field>` / `app.record.edit.change.<field>` /
  `app.record.detail.process.proceed`、および直近値を初期化するための
  `app.record.create.show` / `app.record.edit.show`
- モバイル: 上記の`mobile.`プレフィックス版

レコード一覧画面のインライン編集(`app.record.index.edit.change.*`)は対象外とする(セルの小さな
インライン編集画面でフルスクリーン演出を出すのは煩わしく、元メモのスコープにも含まれないため)。

## 設定画面

`kintone.plugin.app.setConfig()`にのみ保存する。ルールを複数持てる。ルールごとに:

- 対象種別(ドロップダウン/ラジオボタン or プロセス管理のステータス)
- 対象フィールド(対象種別がドロップダウン/ラジオボタンの場合のみ、`kintone.app.getFormFields()`の
  結果から選ぶドロップダウン)
- お祝い対象の値(対象フィールド/ステータスの選択肢一覧から複数選択するチェックボックス一覧)
- 演出パターン(くす玉/クラッカー/紙吹雪/ランダム のドロップダウン)
- メッセージ(任意の文字列、演出中に表示するバナーテキスト。未入力時は既定文言「達成しました!」)

保存時に`js/lib/config-validation.js`でチェックする(対象種別不正、対象フィールド未選択、お祝い対象の値が
0件、演出パターン不正)。

## セキュリティ上の考慮

- 設定画面・レコード画面ともに、アプリ管理者が設定した文字列(メッセージ)を描画する箇所は
  `innerHTML`ではなく`textContent`のみを使用する(secureCodingGuideline.md参照)。
- 演出のDOM要素はプラグイン専用の名前空間クラス(`stc-`プレフィックス)を使い、演出終了時に確実に
  除去する(残留したオーバーレイがクリックを奪わないようにする、`pointer-events: none`と合わせた
  二重の対策)。

## TDD

`src/js/lib/`配下の純粋ロジック(`celebration-trigger.js`・`config-store.js`・`config-validation.js`)を
Jestでユニットテストする(`pnpm test`)。演出そのもの(DOM操作・CSSアニメーション)はユニットテストの
対象外とし、Puppeteer E2Eでの目視・スクリーンショット確認とする。
