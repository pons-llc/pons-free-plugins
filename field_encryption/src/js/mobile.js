(function (global, kintone) {
  'use strict';

  // PC版(js/desktop.js)と同じ暗号化ロジック・イベント構成だが、パスフレーズの入力手段だけが
  // 異なる。kintone.mobile.showConfirmBottomSheet()は確認ダイアログ専用でテキスト入力欄を
  // 持てないため(kintoneドキュメントMCPで確認済み)、パスフレーズ入力にはNS.UI.openBottomSheet()
  // (自前で構築したボトムシート風UI、js/ui.js参照)を使う。スペース要素にはトリガーボタンだけを
  // 置き、実際の入力はボトムシートの中で行う(idea.md「モバイル対応」参照)。

  const NS = global.FieldEncryption;
  const PLUGIN_ID = kintone.$PLUGIN_ID;

  const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  const PBKDF2_ITERATIONS = 600000;
  const KDF = 'PBKDF2-SHA256';
  const CIPHER = 'AES-256-GCM';

  const DETAIL_MASK_TEXT = '🔒 暗号化されています';
  const EDIT_MASK_TEXT = '🔒 暗号化されています(下のボタンで復号してください)';

  const getSpaceEl = () =>
    config.spaceElementId
      ? kintone.mobile.app.record.getSpaceElement(config.spaceElementId)
      : null;

  const buildEnvelope = ({ saltBase64, ivBase64, ctBase64 }) => ({
    v: 1,
    kdf: KDF,
    iter: PBKDF2_ITERATIONS,
    cipher: CIPHER,
    salt: saltBase64,
    iv: ivBase64,
    ct: ctBase64,
  });

  // desktop.jsのencryptFieldsWithSharedKeyと同じロジック(1回の操作につき鍵導出は1回だけ)。
  const encryptFieldsWithSharedKey = async (
    cryptoObj,
    passphrase,
    fieldCodePlaintextPairs,
  ) => {
    const saltBase64 = NS.CryptoCodec.generateSaltBase64(cryptoObj);
    const key = await NS.CryptoCodec.deriveKey({
      cryptoObj,
      passphrase,
      saltBase64,
      iterations: PBKDF2_ITERATIONS,
    });
    const results = {};
    for (const [code, plaintext] of fieldCodePlaintextPairs) {
      const { ivBase64, ctBase64 } = await NS.CryptoCodec.encryptField({
        cryptoObj,
        key,
        plaintext,
      });
      results[code] = NS.BlobCodec.encode(
        buildEnvelope({ saltBase64, ivBase64, ctBase64 }),
      );
    }
    return results;
  };

  // desktop.jsのdecryptFieldsIndividuallyと同じロジック(フィールドごとに個別に鍵を導出する理由も
  // 同じ。同じ操作でまとめて暗号化されたとは限らないため)。
  const decryptFieldsIndividually = async (
    cryptoObj,
    passphrase,
    fieldCodeEnvelopePairs,
  ) => {
    const results = {};
    for (const [code, envelope] of fieldCodeEnvelopePairs) {
      const key = await NS.CryptoCodec.deriveKey({
        cryptoObj,
        passphrase,
        saltBase64: envelope.salt,
        iterations: envelope.iter,
      });
      results[code] = await NS.CryptoCodec.decryptField({
        cryptoObj,
        key,
        ivBase64: envelope.iv,
        ctBase64: envelope.ct,
      });
    }
    return results;
  };

  // パスフレーズ設定用ボトムシート(新規作成時、および編集画面でまだ何も暗号化されていない
  // レコードに初めてパスフレーズを設定する場合の両方で使う)。バリデーションに成功したら
  // onValidated(passphrase)を呼び出す。
  const openSetupSheet = (onValidated) =>
    NS.UI.openBottomSheet({
      title: 'パスフレーズを設定',
      note:
        'このレコードの暗号化対象フィールドを保護するパスフレーズを設定してください。' +
        'パスフレーズはどこにも保存されません。紛失すると暗号化されたデータは復号できなくなります。',
      fields: [
        {
          key: 'passphrase',
          placeholder: `パスフレーズ(${config.minPassphraseLength}文字以上)`,
          autocomplete: 'new-password',
        },
        {
          key: 'confirm',
          placeholder: 'パスフレーズ(確認用)',
          autocomplete: 'new-password',
        },
      ],
      submitLabel: '設定する',
      onSubmit: async (values) => {
        const lengthCheck = NS.PassphraseValidator.validate(
          values.passphrase,
          config.minPassphraseLength,
        );
        if (!lengthCheck.valid) {
          return { success: false, message: lengthCheck.reason };
        }
        const matchCheck = NS.PassphraseValidator.validateConfirmation(
          values.passphrase,
          values.confirm,
        );
        if (!matchCheck.valid) {
          return { success: false, message: matchCheck.reason };
        }
        onValidated(values.passphrase);
        return { success: true };
      },
    });

  // 復号用ボトムシート。decryptFn(passphrase)が{success, message?}を返す想定
  // (成功時の後処理は呼び出し側でdecryptFn内に閉じ込める)。
  const openDecryptSheet = (decryptFn) =>
    NS.UI.openBottomSheet({
      title: '復号',
      note: 'パスフレーズを入力してください。',
      fields: [
        {
          key: 'passphrase',
          placeholder: 'パスフレーズ',
          autocomplete: 'current-password',
        },
      ],
      submitLabel: '復号する',
      onSubmit: (values) => decryptFn(values.passphrase),
    });

  // ===== 新規作成画面 =====

  let createPassphrase; // ボトムシートで設定したパスフレーズをsubmitまでの間だけ保持する。

  kintone.events.on('mobile.app.record.create.show', (event) => {
    const spaceEl = getSpaceEl();
    if (spaceEl) {
      NS.UI.renderTrigger(spaceEl, {
        label: '🔐 パスフレーズを設定',
        onTap: () =>
          openSetupSheet((passphrase) => {
            createPassphrase = passphrase;
            NS.UI.setTriggerLabel(
              spaceEl,
              '✅ パスフレーズを設定済み(タップして変更)',
            );
          }),
      });
    }
    return event;
  });

  kintone.events.on('mobile.app.record.create.submit', async (event) => {
    const nonEmptyFieldCodes = config.targetFields.filter(
      (code) => event.record[code] && event.record[code].value,
    );
    if (nonEmptyFieldCodes.length === 0) {
      return event;
    }

    if (!createPassphrase) {
      event.error =
        '暗号化対象フィールドに値があります。先に「パスフレーズを設定」ボタンでパスフレーズを設定してください。';
      return event;
    }

    const pairs = nonEmptyFieldCodes.map((code) => [
      code,
      event.record[code].value,
    ]);
    const encoded = await encryptFieldsWithSharedKey(
      window.crypto,
      createPassphrase,
      pairs,
    );
    nonEmptyFieldCodes.forEach((code) => {
      event.record[code].value = encoded[code];
    });

    return event;
  });

  // ===== 編集画面 =====

  let editSession = null;

  const handleEditDecrypt = async (encryptedFieldCodes, passphrase) => {
    let envelopePairs;
    try {
      envelopePairs = encryptedFieldCodes.map((code) => [
        code,
        NS.BlobCodec.decode(editSession.fields[code].originalValue),
      ]);
    } catch {
      return { success: false, message: 'データの形式が不正です。' };
    }

    let decrypted;
    try {
      decrypted = await decryptFieldsIndividually(
        window.crypto,
        passphrase,
        envelopePairs,
      );
    } catch {
      return {
        success: false,
        message: 'パスフレーズが正しくないか、データが壊れています。',
      };
    }

    const current = kintone.mobile.app.record.get().record;
    encryptedFieldCodes.forEach((code) => {
      const field = current[code];
      if (field) {
        field.value = decrypted[code];
        field.disabled = false;
      }
      NS.SessionStore.markDecrypted(editSession, code, passphrase);
    });
    kintone.mobile.app.record.set({ record: current });
    return { success: true };
  };

  kintone.events.on('mobile.app.record.edit.show', (event) => {
    editSession = NS.SessionStore.createSession();

    const encryptedFieldCodes = [];

    config.targetFields.forEach((code) => {
      const field = event.record[code];
      if (!field) {
        return;
      }
      const wasEncrypted = NS.BlobCodec.isEncrypted(field.value);
      NS.SessionStore.captureField(editSession, code, {
        originalValue: field.value,
        wasEncrypted,
      });
      if (wasEncrypted) {
        encryptedFieldCodes.push(code);
        field.value = EDIT_MASK_TEXT;
        field.disabled = true;
      }
    });

    const spaceEl = getSpaceEl();
    if (spaceEl) {
      if (encryptedFieldCodes.length > 0) {
        NS.UI.renderTrigger(spaceEl, {
          label: '🔓 復号する',
          onTap: () =>
            openDecryptSheet(async (passphrase) => {
              const result = await handleEditDecrypt(
                encryptedFieldCodes,
                passphrase,
              );
              if (result.success) {
                NS.UI.setTriggerLabel(spaceEl, '✅ 復号済み');
                NS.UI.showResult(spaceEl, {
                  status: 'success',
                  message: '復号しました。値を編集して保存できます。',
                });
              }
              return result;
            }),
        });
      } else {
        NS.UI.renderTrigger(spaceEl, {
          label: '🔐 パスフレーズを設定',
          onTap: () =>
            openSetupSheet((passphrase) => {
              NS.SessionStore.setPassphrase(editSession, passphrase);
              NS.UI.setTriggerLabel(
                spaceEl,
                '✅ パスフレーズを設定済み(タップして変更)',
              );
            }),
        });
      }
    }

    return event;
  });

  kintone.events.on('mobile.app.record.edit.submit', async (event) => {
    const session = editSession;
    if (!session) {
      // edit.showを経ずにsubmitが呼ばれることは通常無いが、セッションが無ければ対象フィールドを
      // 一切変更しない(安全側に倒す)。
      return event;
    }

    const actions = config.targetFields
      .filter((code) => event.record[code])
      .map((code) => ({
        code,
        ...NS.SessionStore.resolveSubmitAction(
          session,
          code,
          event.record[code].value,
        ),
      }));

    actions
      .filter((a) => a.action === 'restore-original')
      .forEach((a) => {
        event.record[a.code].value = a.value;
        event.record[a.code].disabled = false;
      });

    const toEncrypt = actions.filter(
      (a) => a.action === 'reencrypt' || a.action === 'encrypt-new',
    );

    if (toEncrypt.length > 0) {
      // PCのdesktop.jsと異なり、モバイルは「復号する」「パスフレーズを設定」いずれのボトムシートも
      // 成功時に必ずSessionStoreへパスフレーズを書き込む(markDecrypted/setPassphrase)ため、
      // ここでは分岐せずgetSharedPassphrase()を1箇所で参照すればよい。
      const passphrase = NS.SessionStore.getSharedPassphrase(session);
      if (!passphrase) {
        event.error =
          '先に「復号する」または「パスフレーズを設定」ボタンをタップしてください。';
        return event;
      }

      const pairs = toEncrypt.map((a) => [a.code, a.plaintext]);
      const encoded = await encryptFieldsWithSharedKey(
        window.crypto,
        passphrase,
        pairs,
      );
      toEncrypt.forEach((a) => {
        event.record[a.code].value = encoded[a.code];
        event.record[a.code].disabled = false;
      });
    }

    return event;
  });

  // ===== 詳細画面 =====

  // kintone.mobile.app.record.getFieldElement()はモバイルの詳細画面でのみ利用可能
  // (kintoneドキュメントMCPで確認済み)。モバイルには印刷画面のカスタマイズ対象イベントが
  // 存在しないため、PC版のapp.record.print.showに相当する対応は不要。
  const maskEncryptedFieldElements = (record) => {
    const decryptableFieldCodes = [];
    config.targetFields.forEach((code) => {
      const field = record[code];
      if (!field || !NS.BlobCodec.isEncrypted(field.value)) {
        return;
      }
      decryptableFieldCodes.push(code);
      const el = kintone.mobile.app.record.getFieldElement(code);
      if (el) {
        el.textContent = DETAIL_MASK_TEXT;
        el.style.whiteSpace = 'pre-wrap';
      }
    });
    return decryptableFieldCodes;
  };

  const handleDetailDecrypt = async (
    record,
    decryptableFieldCodes,
    passphrase,
  ) => {
    let envelopePairs;
    try {
      envelopePairs = decryptableFieldCodes.map((code) => [
        code,
        NS.BlobCodec.decode(record[code].value),
      ]);
    } catch {
      return { success: false, message: 'データの形式が不正です。' };
    }

    let decrypted;
    try {
      decrypted = await decryptFieldsIndividually(
        window.crypto,
        passphrase,
        envelopePairs,
      );
    } catch {
      return {
        success: false,
        message: 'パスフレーズが正しくないか、データが壊れています。',
      };
    }
    return { success: true, decrypted };
  };

  kintone.events.on('mobile.app.record.detail.show', (event) => {
    const decryptableFieldCodes = maskEncryptedFieldElements(event.record);

    const spaceEl = getSpaceEl();
    if (spaceEl && decryptableFieldCodes.length > 0) {
      NS.UI.renderTrigger(spaceEl, {
        label: '🔓 復号する',
        onTap: () =>
          openDecryptSheet(async (passphrase) => {
            const result = await handleDetailDecrypt(
              event.record,
              decryptableFieldCodes,
              passphrase,
            );
            if (!result.success) {
              return result;
            }
            NS.UI.clearDecryptedFields(spaceEl);
            decryptableFieldCodes.forEach((code) => {
              NS.UI.showDecryptedField(spaceEl, {
                label: code,
                plaintext: result.decrypted[code],
              });
            });
            NS.UI.showResult(spaceEl, {
              status: 'success',
              message: '復号しました。',
            });
            return { success: true };
          }),
      });
    }

    return event;
  });
})(window, kintone);
