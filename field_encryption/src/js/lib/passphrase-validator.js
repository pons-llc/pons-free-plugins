(function (root) {
  'use strict';

  // パスフレーズの最小文字数チェックと、確認用入力との一致チェック。
  // Array.from(str).lengthでコードポイント単位の文字数を数える(str.lengthだとサロゲートペア
  // (絵文字等)を2文字として数えてしまい、見た目の文字数より厳しい判定になってしまうため)。

  const codePointLength = (str) => Array.from(str || '').length;

  const validate = (passphrase, minLength) => {
    if (!passphrase) {
      return { valid: false, reason: 'パスフレーズを入力してください。' };
    }
    if (codePointLength(passphrase) < minLength) {
      return {
        valid: false,
        reason: `パスフレーズは${minLength}文字以上で入力してください。`,
      };
    }
    return { valid: true };
  };

  const validateConfirmation = (passphrase, confirmPassphrase) => {
    if (passphrase !== confirmPassphrase) {
      return { valid: false, reason: 'パスフレーズ(確認用)が一致しません。' };
    }
    return { valid: true };
  };

  const PassphraseValidator = { validate, validateConfirmation };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = PassphraseValidator;
  } else {
    root.FieldEncryption = root.FieldEncryption || {};
    root.FieldEncryption.PassphraseValidator = PassphraseValidator;
  }
})(typeof window !== 'undefined' ? window : globalThis);
