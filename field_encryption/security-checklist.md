# field_encryption セキュリティチェックリスト

[secureCodingGuideline.md](../secureCodingGuideline.md)の一般項目([box_gdrive_iframe/security-checklist.md](../box_gdrive_iframe/security-checklist.md)参照、UTF-8/BOMなし・名前空間分離・`'use strict'`・外部スクリプト不使用などは同様に満たしている)は重複記載を省略し、本プラグイン固有の項目のみ記載する。

最終確認日: 2026-08-12(モバイル対応追加時に再確認)

## コーディング作法

- [x] 文字コードはUTF-8(BOMなし)
- [x] グローバル変数を作らず、即時関数(IIFE)+名前空間オブジェクト(`window.FieldEncryption`)のみを公開している(`js/lib/blob-codec.js`, `js/lib/crypto-codec.js`, `js/lib/passphrase-validator.js`, `js/lib/field-selection.js`, `js/lib/session-store.js`, `js/lib/config-store.js`, `js/ui.js`)
- [x] 既存のkintoneグローバルオブジェクトを書き換え・参照していない
- [x] `'use strict'`を全JSファイルの先頭で使用している
- [x] kintone内部のid/class属性やDOM構造に依存せず、JavaScript API(`kintone.app.record.getFieldElement()`, `kintone.app.record.getSpaceElement()`, `kintone.app.getFormFields()`, `kintone.app.getFormLayout()`, `kintone.plugin.app.getConfig/setConfig()`)のみを使用している。実装前にkintoneドキュメントMCPで`getFieldElement()`が詳細・印刷画面(PC)でしか使えないこと、`detail.show`はイベントオブジェクトでの値書き換えに対応していないこと、`getSpaceElement()`は詳細/追加/編集/印刷画面すべてで使えることを確認済み(idea.md参照)

## REST API・外部通信(CLAUDE.md開発方針3・9参照)

- [x] REST API・`kintone.api()`は一切使用しない。暗号化・復号はすべてブラウザ内蔵のWeb Crypto API(`crypto.subtle`)のみで完結する
- [x] kintone以外の外部サーバーへの通信(fetch/XHR)を一切行わない
- [x] 外部ライブラリを一切使用していない(vanilla JSのみ)

## パスフレーズの取り扱い(本プラグイン最大のリスク領域)

- [x] パスフレーズは`kintone.plugin.app.setConfig()`・`localStorage`・`sessionStorage`・Cookie・kintoneのいずれのフィールドにも一切保存しない。存在するのは(a)`type="password"`入力欄の一時的な値、(b)編集画面を開いてから保存/離脱するまでの間だけ有効なメモリ上のセッション状態(`js/lib/session-store.js`、モジュールのクロージャ変数`editSession`)のみで、いずれも永続化されない
- [x] 復号フォームの入力欄は、復号処理の成功・失敗を問わず処理完了後に必ず値をクリアする(`js/ui.js`の`renderDecryptForm`、`finally`節でDOM上に残さない)
- [x] `crypto.subtle.deriveKey()`で導出した鍵は`extractable: false`で生成しており、鍵オブジェクトから生の鍵データを取り出すことはできない(`js/lib/crypto-codec.js`)
- [x] パスフレーズ・導出鍵・復号結果を`console.*`や`alert()`に出力していない(復号結果はスペース要素のDOM表示のみ)
- [x] 設定画面(`html/config.html`)・`idea.md`の両方に「パスフレーズはどこにも保存されません。紛失した場合、暗号化されたデータは永久に復号できません」という警告文を明記している(既定の仕様であり隠さない)
- [x] パスワード入力欄には`autocomplete="new-password"`(新規作成時)/`autocomplete="current-password"`(復号時)を指定し、ブラウザのパスワードマネージャーで自動入力できるようにしている(`js/ui.js`)。実際にブラウザが自動入力・保存を提案するかはブラウザ側の実装依存であり、開発側での網羅的な検証は行わない方針(公開後の利用ユーザーからのフィードバックに委ねる)

## 暗号アルゴリズム・パラメータ

- [x] 暗号方式はAES-256-GCM(認証付き暗号。暗号文の改ざん検知を兼ねる)、鍵導出はPBKDF2-HMAC-SHA256を使用している(`js/lib/crypto-codec.js`)
- [x] PBKDF2の反復回数は600,000回(OWASP Password Storage Cheat Sheetの2023年改訂後の推奨値)を使用している(`js/desktop.js`の`PBKDF2_ITERATIONS`)
- [x] IV(12byte、AES-GCMにNIST SP 800-38Dが推奨する96bit)は暗号化のたびに`crypto.getRandomValues()`で新規生成しており、同一鍵での使い回しは発生しない。同じ平文・同じ鍵で2回暗号化した場合にIV・暗号文が異なることを`__tests__/crypto-codec.test.js`でユニットテストにより確認済み
- [x] salt(16byte)も暗号化のたびに新規生成している。1回の保存操作(新規作成時の一括暗号化、編集時の一括再暗号化)内では複数フィールドで同じsaltを使い回して鍵導出コストを1回にまとめているが、フィールドごとに独立したIVで暗号化するため暗号文自体は互いに異なる(`js/desktop.js`の`encryptFieldsWithSharedKey`)
- [x] 復号時は、対象フィールドが必ずしも同じ操作でまとめて暗号化されたとは限らない(レコード作成後に対象フィールドが設定へ追加され、別のタイミングで初めて暗号化された場合など)ため、saltの共有を前提にせずフィールドごとに個別に鍵を導出する(`js/desktop.js`の`decryptFieldsIndividually`)。正確さを優先し、パフォーマンスの最適化はしていない(復号はユーザー操作のたびに1回だけ行われるものであるため)
- [x] 正しいパスフレーズかどうかの判定は、AES-GCMの認証タグ検証失敗をそのまま利用しており、パスフレーズの正誤を判定するための別データを保存していない

## 編集画面の再暗号化ロジック(データ破壊防止、最重要ロジック)

- [x] 編集画面で復号しなかった暗号化済みフィールドは、保存時に必ず元の暗号文へ復元する(`js/lib/session-store.js`の`resolveSubmitAction`が`restore-original`を返す)。これを怠るとマスク用プレースホルダー文字列がそのまま保存されデータが失われるため、この判定ロジックを`js/lib/`に切り出し`__tests__/session-store.test.js`でkintone非依存にユニットテストしている
- [x] 復号して値を変更した可能性のあるフィールドは、復号に使ったのと同じパスフレーズ・新しいsalt/IVで再暗号化する(`reencrypt`)
- [x] 保存直前にセッションが存在しない(通常発生しないが、何らかの理由で`edit.show`を経ずに`edit.submit`が呼ばれた場合)は、対象フィールドを一切変更しない安全側の挙動にしている

## XSS・CSSインジェクション対策

- [x] `innerHTML`は一切使用していない。動的なUI要素(`js/ui.js`, `js/config.js`)はすべて`document.createElement()` + `textContent`で構築している。リストのクリア(`el.innerHTML = ''`)のみ、空文字列を代入するだけの用途で外部由来の文字列を差し込むものではない
- [x] `kintone.app.record.getFieldElement()`で取得した要素には、暗号化済みかどうかに応じた固定の静的文字列(「🔒 暗号化されています」)を`textContent`で1回書き込む用途のみに限定しており、動的な値やユーザー入力・復号結果を書き込むことはない。復号結果は必ずスペース要素側の専用エリア(プラグインが完全に所有するDOM)に表示し、`getFieldElement()`で取得した要素へ二重に書き込むことはしない(`idea.md`の設計根拠参照)。これにより「取得した要素の内部構造を変更しない」というkintoneガイドラインを機械的に守れる設計にしている

## 設定の妥当性検証

- [x] 保存前に`js/config.js`でチェックし、暗号化対象フィールド未選択・スペースフィールド未選択・最小文字数が1未満の場合は保存させない
- [x] `kintone.plugin.app.getConfig()`が`null`/`undefined`を返す場合でも、`js/lib/config-store.js`の`load()`は例外を投げず既定値を返す。`targetFields`のJSONが壊れている場合も既定値(空配列)にフォールバックする
- [x] `kintone.app.getFormFields()`/`kintone.app.getFormLayout()`の戻り値がプロパティ名でラップされない(CLAUDE.mdの既知の落とし穴)点を踏まえ、`js/config.js`の呼び出し箇所にコメントを残している

## モバイル対応

- [x] `kintone.mobile.showConfirmBottomSheet()`(公式API)はタイトル・本文・ボタンのみでテキスト入力欄を持てないため使用せず、パスフレーズ入力用に自前のボトムシート風UI(`js/ui.js`の`openBottomSheet()`)を実装した。これは通常のDOM要素(`document.createElement`+`textContent`のみ、`innerHTML`不使用)であり、上記のXSS対策方針をそのまま満たす
- [x] ボトムシートを閉じる際(成功・失敗・キャンセルいずれの経路でも)、入力欄の値をクリアしてからDOM自体を`document.body`から除去する(`js/ui.js`の`openBottomSheet`内`close()`)。パスフレーズがDOM上や変数に残り続けることはない
- [x] `kintone.mobile.app.record.getFieldElement()`はモバイルの詳細画面でのみ利用可能であることをkintoneドキュメントMCPで確認済み(PCの詳細・印刷画面限定と同様の制約)。モバイルには印刷画面のカスタマイズイベント自体が存在しないため、PC版の`app.record.print.show`に相当する対応は不要と判断した
- [x] `kintone.mobile.app.record.getSpaceElement()`はモバイルの詳細/追加/編集画面で利用できることを確認済み。スペース要素にはトリガーボタンのみを置き(パスフレーズ入力欄は置かない)、実際の入力はボトムシート側で行う設計にしているため、スペース要素のDOM自体には機微情報が一切乗らない
- [x] モバイルの編集画面(`js/mobile.js`)は、PC版と異なり「復号フォーム由来か設定フォーム由来か」で読み取り先を分岐せず、ボトムシートの成功コールバックが必ず`js/lib/session-store.js`の`markDecrypted()`/`setPassphrase()`経由でセッションへパスフレーズを書き込み、`edit.submit`は`getSharedPassphrase()`から一律に取得する。分岐が減った分、実装ミスによる分岐漏れのリスクも下がっている
- [x] モバイルの暗号化・復号ロジック(`encryptFieldsWithSharedKey`/`decryptFieldsIndividually`)はPC版(`js/desktop.js`)と同じ実装(このリポジトリの方針でdesktop.js/mobile.jsは独立しており、`js/lib/`配下の共有ロジック(鍵導出・暗号化・復号そのもの)は共通、画面ごとのグルーコードのみ重複させている)

## アクセス権に関する注意(個別確認事項)

- 対象フィールドの`disabled`化(編集画面で復号前は編集不可にする)はJavaScript APIによるUIレベルの制御であり、REST API経由でのフィールド更新やアクセス権による制御ではない。暗号化された値そのものはREST API経由でも暗号文のまま取得されるため保護されるが、「復号後の平文をUI上で誰が編集できるか」はkintone標準のフィールドアクセス権設定に委ねられる。この区別を`idea.md`に明記した
- ブラウザのパスワードマネージャーによる自動入力・保存の実際の挙動はブラウザ実装に依存するため、開発側では網羅的な検証を行わない。問題があれば公開サイトのリポジトリのGitHub Issueで報告してもらい対応する
