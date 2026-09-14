(function (global, kintone) {
  'use strict';

  const NS = global.ProcessActionAutofill;
  const PLUGIN_ID = kintone.$PLUGIN_ID;

  // このプラグインの設定はレコード画面の表示中には変わらないため、画面読み込み時に一度だけ読み込む。
  const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  const needsPrimaryOrg = (rules) =>
    rules.some(
      (rule) =>
        rule.operation === 'SET' &&
        rule.source &&
        rule.source.type === 'ACTOR_PRIMARY_ORG',
    );

  // 一致したルールをrecordへ適用する。resolverContextはValueResolver.resolveSetValueへ
  // そのまま渡される(record/loginUserCode/primaryOrgCode/nowMs/
  // computeInstantOffsetValue/computeFieldOffsetValue)。
  const applyMatchedRules = (record, matchedRules, resolverContext) => {
    matchedRules.forEach((rule) => {
      const targetField = record[rule.targetFieldCode];
      // 対象フィールドがフォームから削除された場合は何もせず、画面をクラッシュさせない
      // (date_offset_autofillのエッジケース対応を踏襲)。
      if (!targetField) {
        return;
      }
      if (rule.operation === 'CLEAR') {
        const emptyValue = NS.ClearValue.resolveClearValue(targetField.type);
        if (emptyValue !== undefined) {
          targetField.value = emptyValue;
        }
        return;
      }
      const newValue = NS.ValueResolver.resolveSetValue(
        targetField.type,
        rule.source,
        resolverContext,
      );
      // 解決できなかった場合(コピー元フィールドが存在しない、優先する組織が無い等)は
      // 対象フィールドを変更しない(idea.md「エッジケース」参照)。
      if (newValue !== null) {
        targetField.value = newValue;
      }
    });
  };

  // event.action.value/event.status.value/event.nextStatus.valueは、いずれもユーザーの言語設定に
  // 従った名称(kintoneドキュメントMCP「プロセス管理でアクションを実行するときのイベント」で
  // 確認済み)。
  const handleProcessProceed = (event) => {
    const eventContext = {
      actionName: event.action && event.action.value,
      fromStatus: event.status && event.status.value,
      toStatus: event.nextStatus && event.nextStatus.value,
    };
    const matched = NS.RuleMatcher.matchRules(config.rules, eventContext);
    if (matched.length === 0) {
      return event;
    }

    // value-resolver.jsは基準となる瞬間(実行時点/作成日時/更新日時)ごとに異なるinstantMsで
    // computeInstantOffsetValueを呼び分けるため、ここではnowMsに束縛せず関数そのものを渡す。
    const nowMs = Date.now();
    const computeInstantOffsetValue =
      NS.DateOffsetCalculator.computeInstantOffsetValue;
    const computeFieldOffsetValue =
      NS.DateOffsetCalculator.computeFieldOffsetValue;
    // kintone.getLoginUser()は同期API。アクション実行者(USER_SELECTのACTORソース)に使う。
    const loginUser = kintone.getLoginUser();

    // ORGANIZATION_SELECTの「アクション実行者の優先する組織」ソースを使うルールが1件でもあれば、
    // kintone.user.getOrganizations()(非同期API)で解決してから適用する。この場合のみPromiseを
    // returnする(event-handlingドキュメントのPromise対応パターン)。
    if (needsPrimaryOrg(matched)) {
      return kintone.user
        .getOrganizations(loginUser.code)
        .then((organizations) => {
          const primaryEntry = (organizations || []).find(
            (entry) => entry.organization && entry.organization.primary,
          );
          applyMatchedRules(event.record, matched, {
            record: event.record,
            loginUserCode: loginUser.code,
            primaryOrgCode: primaryEntry
              ? primaryEntry.organization.code
              : null,
            nowMs,
            computeInstantOffsetValue,
            computeFieldOffsetValue,
          });
          return event;
        });
    }

    applyMatchedRules(event.record, matched, {
      record: event.record,
      loginUserCode: loginUser.code,
      primaryOrgCode: null,
      nowMs,
      computeInstantOffsetValue,
      computeFieldOffsetValue,
    });
    return event;
  };

  kintone.events.on('app.record.detail.process.proceed', handleProcessProceed);
})(window, kintone);
