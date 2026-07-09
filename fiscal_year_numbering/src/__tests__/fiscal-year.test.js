const FiscalYear = require('../js/lib/fiscal-year');

describe('FiscalYear.toFiscalYear', () => {
  test('April 1st belongs to the fiscal year of the same calendar year', () => {
    expect(FiscalYear.toFiscalYear(new Date(2024, 3, 1))).toBe(2024);
  });

  test('March 31st belongs to the fiscal year of the previous calendar year', () => {
    expect(FiscalYear.toFiscalYear(new Date(2024, 2, 31))).toBe(2023);
  });

  test('boundary: April 1st 00:00 vs March 31st 23:59', () => {
    expect(FiscalYear.toFiscalYear(new Date(2024, 3, 1, 0, 0, 0))).toBe(2024);
    expect(FiscalYear.toFiscalYear(new Date(2024, 2, 31, 23, 59, 59))).toBe(2023);
  });

  test('a month clearly inside the fiscal year (e.g. December) maps to the fiscal year already started in April', () => {
    expect(FiscalYear.toFiscalYear(new Date(2024, 11, 25))).toBe(2024);
  });
});

describe('FiscalYear.resolveDate', () => {
  test('CREATED_TIME source reads the record system field', () => {
    const config = { fiscalYearDateSource: 'CREATED_TIME' };
    const record = { 作成日時: { value: '2024-05-10T01:00:00Z' } };
    const date = FiscalYear.resolveDate(config, record);
    expect(date.getUTCFullYear()).toBe(2024);
    expect(date.getUTCMonth()).toBe(4); // May, 0-indexed
  });

  test('FIELD source reads the configured date/datetime field', () => {
    const config = { fiscalYearDateSource: 'FIELD', fiscalYearDateField: 'shorui_bi' };
    const record = { shorui_bi: { value: '2023-04-02' } };
    const date = FiscalYear.resolveDate(config, record);
    expect(date.getUTCFullYear()).toBe(2023);
    expect(date.getUTCMonth()).toBe(3); // April, 0-indexed
  });

  test('FIELD source with an empty value throws a descriptive error', () => {
    const config = { fiscalYearDateSource: 'FIELD', fiscalYearDateField: 'shorui_bi' };
    const record = { shorui_bi: { value: '' } };
    expect(() => FiscalYear.resolveDate(config, record)).toThrow();
  });
});
