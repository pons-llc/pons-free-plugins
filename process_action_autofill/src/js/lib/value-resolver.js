(function (root) {
  'use strict';

  const TEXT_TYPES = ['SINGLE_LINE_TEXT', 'MULTI_LINE_TEXT'];
  const NUMBER_TYPES = ['NUMBER'];
  const CHOICE_TYPES = ['RADIO_BUTTON', 'DROP_DOWN'];
  const MULTI_CHOICE_TYPES = ['CHECK_BOX', 'MULTI_SELECT'];
  const DATE_TIME_TYPES = ['DATE', 'DATETIME'];

  const isNonEmpty = (v) => v !== undefined && v !== null && v !== '';

  // ルール(動作=設定)の対象フィールド型・ソース設定・実行時コンテキストから、書き込む値を解決する。
  // 解決できない場合はnullを返し、呼び出し側はそのルールをスキップする(対象フィールドを変更しない)。
  //
  // context:
  //   record — event.record相当(フィールドコード→{type, value}のオブジェクト)。COPY_FIELDで使う。
  //   loginUserCode — アクション実行者のログイン名(kintone.getLoginUser().code)。USER_SELECTで使う。
  //   primaryOrgCode — アクション実行者の優先する組織コード(kintone.user.getOrganizations()の
  //     organization.primary===trueの1件)。無ければnull。ORGANIZATION_SELECTで使う。
  //   computeNowOffsetValue(targetFieldType, magnitude, unit) — NowOffsetCalculator.
  //     computeNowOffsetValueを「今」に束縛した関数。呼び出し側(desktop.js/mobile.js)が注入する
  //     (この関数自体をkintone非依存に保ち、Jestで日時をモックしやすくするための依存性注入)。
  const resolveSetValue = (targetFieldType, source, context) => {
    const src = source || {};
    const ctx = context || {};
    const record = ctx.record || {};

    if (
      TEXT_TYPES.includes(targetFieldType) ||
      NUMBER_TYPES.includes(targetFieldType)
    ) {
      if (src.type === 'FIXED') {
        return isNonEmpty(src.value) ? String(src.value) : null;
      }
      if (src.type === 'COPY_FIELD') {
        const sourceField = record[src.fieldCode];
        if (!sourceField) {
          return null;
        }
        return sourceField.value;
      }
      return null;
    }

    if (CHOICE_TYPES.includes(targetFieldType)) {
      if (src.type === 'FIXED' && typeof src.value === 'string') {
        return src.value;
      }
      return null;
    }

    if (MULTI_CHOICE_TYPES.includes(targetFieldType)) {
      if (src.type === 'FIXED' && Array.isArray(src.values)) {
        return src.values.slice();
      }
      return null;
    }

    if (DATE_TIME_TYPES.includes(targetFieldType)) {
      if (
        src.type !== 'NOW_OFFSET' ||
        typeof ctx.computeNowOffsetValue !== 'function'
      ) {
        return null;
      }
      return ctx.computeNowOffsetValue(
        targetFieldType,
        src.magnitude,
        src.unit,
      );
    }

    if (targetFieldType === 'USER_SELECT') {
      if (src.type === 'ACTOR') {
        return isNonEmpty(ctx.loginUserCode)
          ? [{ code: ctx.loginUserCode }]
          : null;
      }
      return null;
    }

    if (targetFieldType === 'ORGANIZATION_SELECT') {
      if (src.type === 'FIXED_CODE') {
        return isNonEmpty(src.value) ? [{ code: src.value }] : null;
      }
      if (src.type === 'ACTOR_PRIMARY_ORG') {
        return isNonEmpty(ctx.primaryOrgCode)
          ? [{ code: ctx.primaryOrgCode }]
          : null;
      }
      return null;
    }

    if (targetFieldType === 'GROUP_SELECT') {
      if (src.type === 'FIXED_CODE') {
        return isNonEmpty(src.value) ? [{ code: src.value }] : null;
      }
      return null;
    }

    return null;
  };

  const ValueResolver = { resolveSetValue };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ValueResolver;
  } else {
    root.ProcessActionAutofill = root.ProcessActionAutofill || {};
    root.ProcessActionAutofill.ValueResolver = ValueResolver;
  }
})(typeof window !== 'undefined' ? window : globalThis);
