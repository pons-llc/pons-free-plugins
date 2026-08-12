(function (global, kintone) {
  'use strict';

  const NS = global.FieldEncryption;
  const PLUGIN_ID = kintone.$PLUGIN_ID;

  const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  // OWASP Password Storage Cheat Sheet(2023年改訂後)のPBKDF2-HMAC-SHA256推奨反復回数。
  const PBKDF2_ITERATIONS = 600000;
  const KDF = 'PBKDF2-SHA256';
  const CIPHER = 'AES-256-GCM';

  const DETAIL_MASK_TEXT = '🔒 暗号化されています';
  const EDIT_MASK_TEXT =
    '🔒 暗号化されています(下の「復号」ボタンで復号してください)';

  const getSpaceEl = () =>
    config.spaceElementId
      ? kintone.app.record.getSpaceElement(config.spaceElementId)
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

  // 複数フィールドを「同じ操作」でまとめて暗号化する場合は、salt/鍵導出を1回だけにして使い回す
  // (フィールド数だけPBKDF2コストが乗算されるのを防ぐ)。同じ操作内で生成された暗号文は同じsaltを
  // 持つが、フィールドごとに独立したIVで暗号化するため、暗号文自体は互いに異なる。
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

  // 復号は、対象フィールドが必ずしも同じ操作でまとめて暗号化されたとは限らない
  // (レコード作成後に対象フィールドが設定に追加され、別のタイミングで初めて暗号化された場合など)
  // ため、saltの共有を前提にできない。そのためフィールドごとに(同じパスフレーズから)個別に鍵を
  // 導出する。復号はユーザー操作(ボタン押下)のたびに1回だけ行われるものなので、正確さを優先する。
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

  // ===== 新規作成画面 =====

  kintone.events.on('app.record.create.show', (event) => {
    const spaceEl = getSpaceEl();
    if (spaceEl) {
      NS.UI.renderSetupForm(spaceEl, { minLength: config.minPassphraseLength });
    }
    return event;
  });

  kintone.events.on('app.record.create.submit', async (event) => {
    const nonEmptyFieldCodes = config.targetFields.filter(
      (code) => event.record[code] && event.record[code].value,
    );
    if (nonEmptyFieldCodes.length === 0) {
      return event;
    }

    const spaceEl = getSpaceEl();
    const passphrase = spaceEl ? NS.UI.getSetupPassphrase(spaceEl) : '';
    const confirmPassphrase = spaceEl
      ? NS.UI.getSetupConfirmPassphrase(spaceEl)
      : '';

    const lengthCheck = NS.PassphraseValidator.validate(
      passphrase,
      config.minPassphraseLength,
    );
    if (!lengthCheck.valid) {
      event.error = lengthCheck.reason;
      return event;
    }
    const matchCheck = NS.PassphraseValidator.validateConfirmation(
      passphrase,
      confirmPassphrase,
    );
    if (!matchCheck.valid) {
      event.error = matchCheck.reason;
      return event;
    }

    const pairs = nonEmptyFieldCodes.map((code) => [
      code,
      event.record[code].value,
    ]);
    const encoded = await encryptFieldsWithSharedKey(
      window.crypto,
      passphrase,
      pairs,
    );
    nonEmptyFieldCodes.forEach((code) => {
      event.record[code].value = encoded[code];
    });

    return event;
  });

  // ===== 編集画面 =====

  // edit.show〜edit.submitの間だけ有効なセッション状態(パスフレーズはここにのみ一時保持し、
  // どこにも永続化しない)。次にedit.showが呼ばれると上書きされる。
  let editSession = null;

  const handleEditDecrypt = async (
    spaceEl,
    encryptedFieldCodes,
    passphrase,
  ) => {
    let envelopePairs;
    try {
      envelopePairs = encryptedFieldCodes.map((code) => [
        code,
        NS.BlobCodec.decode(editSession.fields[code].originalValue),
      ]);
    } catch {
      NS.UI.showResult(spaceEl, {
        status: 'error',
        message: 'データの形式が不正です。',
      });
      return;
    }

    let decrypted;
    try {
      decrypted = await decryptFieldsIndividually(
        window.crypto,
        passphrase,
        envelopePairs,
      );
    } catch {
      NS.UI.showResult(spaceEl, {
        status: 'error',
        message: 'パスフレーズが正しくないか、データが壊れています。',
      });
      return;
    }

    const current = kintone.app.record.get().record;
    encryptedFieldCodes.forEach((code) => {
      const field = current[code];
      if (field) {
        field.value = decrypted[code];
        field.disabled = false;
      }
      NS.SessionStore.markDecrypted(editSession, code, passphrase);
    });
    kintone.app.record.set({ record: current });
    NS.UI.showResult(spaceEl, {
      status: 'success',
      message: '復号しました。値を編集して保存できます。',
    });
  };

  kintone.events.on('app.record.edit.show', (event) => {
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
        NS.UI.renderDecryptForm(spaceEl, {
          onSubmit: (passphrase) =>
            handleEditDecrypt(spaceEl, encryptedFieldCodes, passphrase),
        });
      } else {
        NS.UI.renderSetupForm(spaceEl, {
          minLength: config.minPassphraseLength,
        });
      }
    }

    return event;
  });

  kintone.events.on('app.record.edit.submit', async (event) => {
    // ローカル変数に固定してから使う(モジュール変数editSessionをawaitを挟んで読み書きすると
    // require-atomic-updatesの警告対象になるため)。
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
      const hadEncryptedFieldAtShow = Object.values(session.fields).some(
        (entry) => entry.wasEncrypted,
      );

      let passphrase;
      if (hadEncryptedFieldAtShow) {
        // 既に暗号化済みのフィールドがあったレコード: 復号フォームで正しいパスフレーズが
        // 入力され復号に成功していない限り、再暗号化に使えるパスフレーズは存在しない。
        passphrase = NS.SessionStore.getSharedPassphrase(session);
        if (!passphrase) {
          event.error =
            '先に「復号」ボタンでパスフレーズを解除してから保存してください。';
          return event;
        }
      } else {
        // まだ暗号化済みのフィールドが無かったレコード: create.submitと同じく、
        // パスフレーズ設定フォームの入力値をそのまま使う。
        const spaceEl = getSpaceEl();
        const candidate = spaceEl ? NS.UI.getSetupPassphrase(spaceEl) : '';
        const confirmCandidate = spaceEl
          ? NS.UI.getSetupConfirmPassphrase(spaceEl)
          : '';
        const lengthCheck = NS.PassphraseValidator.validate(
          candidate,
          config.minPassphraseLength,
        );
        if (!lengthCheck.valid) {
          event.error = lengthCheck.reason;
          return event;
        }
        const matchCheck = NS.PassphraseValidator.validateConfirmation(
          candidate,
          confirmCandidate,
        );
        if (!matchCheck.valid) {
          event.error = matchCheck.reason;
          return event;
        }
        passphrase = candidate;
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

    // editSessionは明示的にクリアしない: 次にedit.showが呼ばれたときに必ず上書きされるため、
    // ここでnullに戻す必要は無い(むしろawaitを挟んだ後の書き換えはrequire-atomic-updatesの
    // 対象になる)。
    return event;
  });

  // ===== 詳細画面・印刷画面 =====

  // detail.showはイベントオブジェクトでの値の書き換えに対応していないため(Promise対応のみ)、
  // 表示のマスクはgetFieldElement()で取得した要素へのDOM操作(textContentのみ)で行う。
  const maskEncryptedFieldElements = (record) => {
    const decryptableFieldCodes = [];
    config.targetFields.forEach((code) => {
      const field = record[code];
      if (!field || !NS.BlobCodec.isEncrypted(field.value)) {
        return;
      }
      decryptableFieldCodes.push(code);
      const el = kintone.app.record.getFieldElement(code);
      if (el) {
        el.textContent = DETAIL_MASK_TEXT;
        el.style.whiteSpace = 'pre-wrap';
      }
    });
    return decryptableFieldCodes;
  };

  const handleDetailDecrypt = async (
    spaceEl,
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
      NS.UI.showResult(spaceEl, {
        status: 'error',
        message: 'データの形式が不正です。',
      });
      return;
    }

    let decrypted;
    try {
      decrypted = await decryptFieldsIndividually(
        window.crypto,
        passphrase,
        envelopePairs,
      );
    } catch {
      NS.UI.showResult(spaceEl, {
        status: 'error',
        message: 'パスフレーズが正しくないか、データが壊れています。',
      });
      return;
    }

    NS.UI.clearDecryptedFields(spaceEl);
    decryptableFieldCodes.forEach((code) => {
      NS.UI.showDecryptedField(spaceEl, {
        label: code,
        plaintext: decrypted[code],
      });
    });
    NS.UI.showResult(spaceEl, { status: 'success', message: '復号しました。' });
  };

  kintone.events.on('app.record.detail.show', (event) => {
    const decryptableFieldCodes = maskEncryptedFieldElements(event.record);

    const spaceEl = getSpaceEl();
    if (spaceEl && decryptableFieldCodes.length > 0) {
      NS.UI.renderDecryptForm(spaceEl, {
        onSubmit: (passphrase) =>
          handleDetailDecrypt(
            spaceEl,
            event.record,
            decryptableFieldCodes,
            passphrase,
          ),
      });
    }

    return event;
  });

  // 印刷画面はマスクのみ行う(復号UIは設置しない。印刷物に暗号文の生データをそのまま出さないための
  // 最低限の対応であり、印刷画面で復号する用途は想定していない)。
  kintone.events.on('app.record.print.show', (event) => {
    maskEncryptedFieldElements(event.record);
    return event;
  });
})(window, kintone);
