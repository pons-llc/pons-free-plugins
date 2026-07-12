'use strict';

// このプラグインのe2eテストで使う、TEST_APP_ID_1に既存のフィールド。
// TEST_APP_ID_1には主要なフィールドタイプが用意済み(CLAUDE.md開発方針7参照)で、本プラグインが
// 対応する型(文字列1行・数値・ラジオボタン・日付など)はいずれも既存フィールドでカバーできるため、
// ensureFormFields()での新規作成は行わない(LINK・MULTI_SELECT型のフィールドはTEST_APP_ID_1に
// 存在しないが、フィールド型ごとの値の変換ロジック自体は__tests__/field-value-codec.test.jsで
// 網羅的にユニットテスト済みのため、e2eでは代表的な型のみ実機確認すれば十分と判断した)。

const TEXT_FIELD_CODE = '文字列__1行__0';
const NUMBER_FIELD_CODE = '数値_0';
const RADIO_FIELD_CODE = 'ラジオボタン_0';
const DATE_FIELD_CODE = '日付_0';

// このプラグイン用に保存するボタン設定を、他の手動検証済み設定と区別するためのラベル。
const E2E_BUTTON_LABEL = 'E2Eテスト入力';

module.exports = {
  TEXT_FIELD_CODE,
  NUMBER_FIELD_CODE,
  RADIO_FIELD_CODE,
  DATE_FIELD_CODE,
  E2E_BUTTON_LABEL,
};
