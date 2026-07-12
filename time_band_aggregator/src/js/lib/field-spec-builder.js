(function (root) {
  'use strict';

  const TimeBand =
    typeof module !== 'undefined' && module.exports
      ? require('./time-band')
      : root.TimeBandAggregator.TimeBand;

  // 設定行から実際に作成するフィールド(DROP_DOWN・NUMBER)のcode/labelを決定し、
  // フィールド追加REST API(POST /k/v1/preview/app/form/fields.json)のpropertiesを組み立てる。
  // 既存フィールド(existingFields: { フィールドコード: { type } })と型が一致するものはそのまま
  // 再利用し(needsCreate: false)、作成対象から除外する(冪等)。コードが衝突するが型が異なる場合は
  // 末尾に連番を付けて新しいコードを採番し、warningsに記録する。

  const buildDropdownProperties = (code, label, bands) => {
    const options = {};
    bands.forEach((band, index) => {
      options[band.label] = { label: band.label, index: String(index) };
    });
    return {
      type: 'DROP_DOWN',
      code,
      label,
      noLabel: false,
      required: false,
      options,
      defaultValue: '',
    };
  };

  const buildNumberProperties = (code, label) => ({
    type: 'NUMBER',
    code,
    label,
    noLabel: false,
    required: false,
    unique: false,
    defaultValue: '',
    digit: false,
  });

  const buildFieldSpecs = (
    rows,
    { existingFields = {}, fieldLabelByCode = {} } = {},
  ) => {
    const warnings = [];
    const propertiesToAdd = {};
    const reserved = new Set();

    const isTaken = (code) => !!existingFields[code] || reserved.has(code);
    const typeOf = (code) =>
      existingFields[code] ? existingFields[code].type : null;

    const resolveCode = (baseCode, expectedType) => {
      if (!isTaken(baseCode)) {
        reserved.add(baseCode);
        return { code: baseCode, needsCreate: true };
      }
      if (typeOf(baseCode) === expectedType && !reserved.has(baseCode)) {
        reserved.add(baseCode);
        return { code: baseCode, needsCreate: false };
      }
      let n = 2;
      let candidate = `${baseCode}_${n}`;
      while (isTaken(candidate)) {
        n += 1;
        candidate = `${baseCode}_${n}`;
      }
      reserved.add(candidate);
      warnings.push(
        `フィールドコード「${baseCode}」は既に別の型のフィールドで使われているため、代わりに「${candidate}」を作成します。`,
      );
      return { code: candidate, needsCreate: true };
    };

    const resolvedRows = rows.map((row) => {
      const sourceLabel =
        fieldLabelByCode[row.sourceFieldCode] || row.sourceFieldCode;
      const bands = TimeBand.generateBands(row.bandWidthMinutes);

      const dropdown = resolveCode(
        `${row.sourceFieldCode}_timeband`,
        'DROP_DOWN',
      );
      const dropdownLabel = `${sourceLabel}(時間帯)`;
      if (dropdown.needsCreate) {
        propertiesToAdd[dropdown.code] = buildDropdownProperties(
          dropdown.code,
          dropdownLabel,
          bands,
        );
      }

      const number = resolveCode(
        `${row.sourceFieldCode}_timeband_num`,
        'NUMBER',
      );
      const numberLabel = `${sourceLabel}(時間帯・数値)`;
      if (number.needsCreate) {
        propertiesToAdd[number.code] = buildNumberProperties(
          number.code,
          numberLabel,
        );
      }

      return {
        ...row,
        dropdownFieldCode: dropdown.code,
        numberFieldCode: number.code,
      };
    });

    return { resolvedRows, propertiesToAdd, warnings };
  };

  const FieldSpecBuilder = { buildFieldSpecs };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = FieldSpecBuilder;
  } else {
    root.TimeBandAggregator = root.TimeBandAggregator || {};
    root.TimeBandAggregator.FieldSpecBuilder = FieldSpecBuilder;
  }
})(typeof window !== 'undefined' ? window : globalThis);
