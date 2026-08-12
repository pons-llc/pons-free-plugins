'use strict';

const PassphraseValidator = require('../js/lib/passphrase-validator');

describe('PassphraseValidator', () => {
  describe('validate()', () => {
    test('最小文字数未満は不正', () => {
      const result = PassphraseValidator.validate('1234567', 8);
      expect(result.valid).toBe(false);
      expect(result.reason).toBeTruthy();
    });

    test('最小文字数ちょうどは有効', () => {
      const result = PassphraseValidator.validate('12345678', 8);
      expect(result.valid).toBe(true);
    });

    test('空文字列は最小文字数によらず不正', () => {
      expect(PassphraseValidator.validate('', 0).valid).toBe(false);
    });

    test('サロゲートペア(絵文字)を含む文字列はコードポイント単位で数える', () => {
      // 「🔒」はUTF-16では2コードユニットだが1コードポイント。8個並べても
      // JavaScriptの.lengthでは16、コードポイント換算では8。
      const passphrase = '🔒'.repeat(8);
      expect(passphrase.length).toBe(16);
      expect(PassphraseValidator.validate(passphrase, 8).valid).toBe(true);
      expect(PassphraseValidator.validate('🔒'.repeat(7), 8).valid).toBe(false);
    });
  });

  describe('validateConfirmation()', () => {
    test('一致していれば有効', () => {
      expect(
        PassphraseValidator.validateConfirmation('abcdefgh', 'abcdefgh').valid,
      ).toBe(true);
    });

    test('不一致なら不正', () => {
      const result = PassphraseValidator.validateConfirmation(
        'abcdefgh',
        'abcdefgx',
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toBeTruthy();
    });
  });
});
