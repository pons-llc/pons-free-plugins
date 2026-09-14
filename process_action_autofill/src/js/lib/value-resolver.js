(function (root) {
  'use strict';

  const TEXT_TYPES = ['SINGLE_LINE_TEXT', 'MULTI_LINE_TEXT'];
  const NUMBER_TYPES = ['NUMBER'];
  const CHOICE_TYPES = ['RADIO_BUTTON', 'DROP_DOWN'];
  const MULTI_CHOICE_TYPES = ['CHECK_BOX', 'MULTI_SELECT'];
  const DATE_TIME_TYPES = ['DATE', 'DATETIME'];

  const isNonEmpty = (v) => v !== undefined && v !== null && v !== '';

  // recordの中から、指定した型(CREATED_TIME/UPDATED_TIME)を持つフィールドを1件探す。
  // これらはアプリに必ず1つだけ存在するシステムフィールドだが、フィールドコード自体は
  // アプリごとに変更可能(既定値はラベルと同じ)なため、コード決め打ちにせずrecordの各エントリの
  // typeで探す(kintoneドキュメントMCP「フィールド形式」で、システムフィールドもtype情報を
  // 持つことを確認済み)。
  const findFieldByType = (record, fieldType) =>
    Object.values(record || {}).find((f) => f && f.type === fieldType) || null;

  // ルール(動作=設定)の対象フィールド型・ソース設定・実行時コンテキストから、書き込む値を解決する。
  // 解決できない場合はnullを返し、呼び出し側はそのルールをスキップする(対象フィールドを変更しない)。
  //
  // context:
  //   record — event.record相当(フィールドコード→{type, value}のオブジェクト)。COPY_FIELD・
  //     CREATED_TIME_OFFSET・UPDATED_TIME_OFFSET・FIELD_OFFSETで使う。
  //   loginUserCode — アクション実行者のログイン名(kintone.getLoginUser().code)。USER_SELECTで使う。
  //   primaryOrgCode — アクション実行者の優先する組織コード(kintone.user.getOrganizations()の
  //     organization.primary===trueの1件)。無ければnull。ORGANIZATION_SELECTで使う。
  //   nowMs — 実行時点のエポックミリ秒。NOW_OFFSETで使う。
  //   computeInstantOffsetValue(instantMs, targetFieldType, magnitude, unit) — DateOffsetCalculator.
  //     computeInstantOffsetValue。NOW_OFFSET/CREATED_TIME_OFFSET/UPDATED_TIME_OFFSETで使う。
  //   computeFieldOffsetValue(baseValue, baseFieldType, magnitude, unit) — DateOffsetCalculator.
  //     computeFieldOffsetValue。FIELD_OFFSETで使う。
  //   (計算関数自体を呼び出し側〈desktop.js/mobile.js〉から注入する設計にすることで、この関数を
  //   kintone非依存に保ち、Jestで日時をモックしやすくしている)
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
        typeof ctx.computeInstantOffsetValue !== 'function' ||
        typeof ctx.computeFieldOffsetValue !== 'function'
      ) {
        return null;
      }

      if (src.type === 'NOW_OFFSET') {
        return ctx.computeInstantOffsetValue(
          ctx.nowMs,
          targetFieldType,
          src.magnitude,
          src.unit,
        );
      }

      if (
        src.type === 'CREATED_TIME_OFFSET' ||
        src.type === 'UPDATED_TIME_OFFSET'
      ) {
        const systemType =
          src.type === 'CREATED_TIME_OFFSET' ? 'CREATED_TIME' : 'UPDATED_TIME';
        const baseField = findFieldByType(record, systemType);
        if (!baseField) {
          return null;
        }
        const instantMs = new Date(baseField.value).getTime();
        return ctx.computeInstantOffsetValue(
          instantMs,
          targetFieldType,
          src.magnitude,
          src.unit,
        );
      }

      if (src.type === 'FIELD_OFFSET') {
        const baseField = record[src.fieldCode];
        if (!baseField) {
          return null;
        }
        return ctx.computeFieldOffsetValue(
          baseField.value,
          baseField.type,
          src.magnitude,
          src.unit,
        );
      }

      return null;
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
