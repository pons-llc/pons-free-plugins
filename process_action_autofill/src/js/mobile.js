(function (global, kintone) {
  'use strict';

  const NS = global.ProcessActionAutofill;
  const PLUGIN_ID = kintone.$PLUGIN_ID;

  const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  const needsPrimaryOrg = (rules) =>
    rules.some(
      (rule) =>
        rule.operation === 'SET' &&
        rule.source &&
        rule.source.type === 'ACTOR_PRIMARY_ORG',
    );

  // desktop.jsと同じ適用ロジック(recordオブジェクトの形式はPC・モバイルで共通)。
  const applyMatchedRules = (record, matchedRules, resolverContext) => {
    matchedRules.forEach((rule) => {
      const targetField = record[rule.targetFieldCode];
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
      if (newValue !== null) {
        targetField.value = newValue;
      }
    });
  };

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

    const now = new Date();
    const computeNowOffsetValue = (targetFieldType, magnitude, unit) =>
      NS.NowOffsetCalculator.computeNowOffsetValue(
        now,
        targetFieldType,
        magnitude,
        unit,
      );
    const loginUser = kintone.getLoginUser();

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
            computeNowOffsetValue,
          });
          return event;
        });
    }

    applyMatchedRules(event.record, matched, {
      record: event.record,
      loginUserCode: loginUser.code,
      primaryOrgCode: null,
      computeNowOffsetValue,
    });
    return event;
  };

  kintone.events.on(
    'mobile.app.record.detail.process.proceed',
    handleProcessProceed,
  );
})(window, kintone);
