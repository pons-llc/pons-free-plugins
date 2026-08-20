'use strict';

// TEST_APP_ID_1にはDATE/DATETIME/NUMBER型のフィールドは標準搭載されているが、表示書式が
// 数値のCALC(計算)フィールドは無い(オフセット参照フィールドの選択肢を検証するために必要)。
// CLAUDE.md開発方針7: 本当に不足しているフィールドのみensureFormFields()で追加する。

const kintoneAdmin = require('../../../scripts/kintone-admin');

const CALC_NUMBER_FIELD_CODE = 'doa_calc_number';

const ensureCalcNumberField = (env, appId) =>
  kintoneAdmin.ensureFormFields(env, appId, {
    [CALC_NUMBER_FIELD_CODE]: {
      type: 'CALC',
      code: CALC_NUMBER_FIELD_CODE,
      label: '計算(数値、date_offset_autofillテスト用)',
      expression: '数値',
      format: 'NUMBER',
    },
  });

module.exports = { CALC_NUMBER_FIELD_CODE, ensureCalcNumberField };
