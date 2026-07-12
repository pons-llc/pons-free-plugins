(function (global, kintone) {
  'use strict';

  const NS = global.StatusCelebration;
  const PLUGIN_ID = kintone.$PLUGIN_ID;
  const DEFAULT_MESSAGE = '達成しました!';

  // このプラグインの設定はレコード画面の表示中には変わらないため、画面読み込み時に一度だけ読み込む。
  const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));
  const fieldRules = config.rules.filter(
    (rule) => rule.sourceType === 'FIELD' && rule.fieldCode,
  );
  const statusRules = config.rules.filter(
    (rule) => rule.sourceType === 'STATUS',
  );

  // ドロップダウン/ラジオボタン用ルールの「直近値」。change系イベントは変更前の値を渡さないため、
  // create.show/edit.show時点の値で初期化し、changeイベントのたびに自前で更新する
  // (idea.md「発火条件」参照)。ルールオブジェクト自身をキーにすることで、同じフィールドコードを
  // 使う複数ルールがあっても値を混同しない。
  const lastFieldValues = new Map();

  const celebrate = (rule) => {
    const pattern = NS.CelebrationTrigger.resolvePattern(rule.pattern);
    NS.Effects.play(pattern, { message: rule.message || DEFAULT_MESSAGE });
  };

  const initLastFieldValues = (record) => {
    fieldRules.forEach((rule) => {
      const field = record[rule.fieldCode];
      lastFieldValues.set(rule, field ? field.value : '');
    });
  };

  const handleFieldChange = (fieldCode, record) => {
    const currentValue = record[fieldCode] ? record[fieldCode].value : '';
    fieldRules
      .filter((rule) => rule.fieldCode === fieldCode)
      .forEach((rule) => {
        const previousValue = lastFieldValues.get(rule);
        if (
          NS.CelebrationTrigger.shouldCelebrate(
            rule,
            previousValue,
            currentValue,
          )
        ) {
          celebrate(rule);
        }
        lastFieldValues.set(rule, currentValue);
      });
  };

  kintone.events.on(
    ['app.record.create.show', 'app.record.edit.show'],
    (event) => {
      initLastFieldValues(event.record);
      return event;
    },
  );

  const uniqueFieldCodes = Array.from(
    new Set(fieldRules.map((rule) => rule.fieldCode)),
  );
  uniqueFieldCodes.forEach((fieldCode) => {
    kintone.events.on(
      [
        'app.record.create.change.' + fieldCode,
        'app.record.edit.change.' + fieldCode,
      ],
      (event) => {
        handleFieldChange(fieldCode, event.record);
        return event;
      },
    );
  });

  // プロセス管理のステータスは、変更前(event.status)・変更後(event.nextStatus)の値をイベント自身が
  // 渡してくれるため、change系イベントのような直近値の自前管理が不要(idea.md「発火条件」参照)。
  // アクションの実行によってステータスが変わらない場合もこのイベントは発生するため、
  // shouldCelebrate側の「値が変わっていなければ発火しない」判定に委ねる。
  if (statusRules.length > 0) {
    kintone.events.on('app.record.detail.process.proceed', (event) => {
      const previousValue = event.status ? event.status.value : '';
      const currentValue = event.nextStatus ? event.nextStatus.value : '';
      statusRules.forEach((rule) => {
        if (
          NS.CelebrationTrigger.shouldCelebrate(
            rule,
            previousValue,
            currentValue,
          )
        ) {
          celebrate(rule);
        }
      });
      return event;
    });
  }
})(window, kintone);
