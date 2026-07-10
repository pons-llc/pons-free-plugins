(async (PLUGIN_ID) => {
    'use strict';
    const config = JSON.parse(kintone.plugin.app.getConfig(PLUGIN_ID).configKey || "{}");
    const changeEvents = [];

    // イベントを収集
    Object.keys(config).forEach(element => {
        changeEvents.push("app.record.create.change." + element,"app.record.edit.change." + element);
    });

    // イベント登録
    kintone.events.on(changeEvents, (event) => {
        var changeField = event.type.split(".").pop(); // 変更されたフィールドのコード取得
        if (config.hasOwnProperty(changeField)) {
            var changeFieldValue = event.changes.field.value;
            var targetFields = config[changeField][changeFieldValue];

            // すべての関連フィールドを表示
            Object.values(config[changeField]).forEach(fieldArray => {
                fieldArray.forEach(fieldCode => {
                    kintone.app.record.setFieldShown(fieldCode, true);
                });
            });

            // 対象のフィールドを非表示
            if (targetFields) {
                targetFields.forEach(tar => {
                    kintone.app.record.setFieldShown(tar, false);
                });
            }
        }
        return event;
    });

    kintone.events.on(["app.record.detail.show","app.record.create.show","app.record.edit.show"],(event)=>{
        Object.keys(config).forEach(condition  =>{
            var conditionValue = event.record[condition].value;
            if( config[condition].hasOwnProperty(conditionValue)){
                var targetFields = config[condition][conditionValue]
                if (targetFields){
                    targetFields.forEach(tar =>{
                        kintone.app.record.setFieldShown(tar, false)
                    })
                }
            }
        })
    })

})(kintone.$PLUGIN_ID);

