(async (PLUGIN_ID) => {
    var config = JSON.parse(kintone.plugin.app.getConfig(PLUGIN_ID).configKey || "{}");
    var changeEvents = [];

    // イベントを収集
    Object.keys(config).forEach(element => {
        changeEvents.push("mobile.app.record.create.change." + element,"mobile.app.record.edit.change." + element);
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
                    kintone.mobile.app.record.setFieldShown(fieldCode, true);
                });
            });

            // 対象のフィールドを非表示
            if (targetFields) {
                targetFields.forEach(tar => {
                    kintone.mobile.app.record.setFieldShown(tar, false);
                });
            }
        }
        return event;
    });

    kintone.events.on(["mobile.app.record.detail.show","mobile.app.record.create.show","app.record.edit.show"],(event)=>{
        Object.keys(config).forEach(condition  =>{
            var conditionValue = event.record[condition].value;
            if( config[condition].hasOwnProperty(conditionValue)){
                var targetFields = config[condition][conditionValue]
                if (targetFields){
                    targetFields.forEach(tar =>{
                        kintone.mobile.app.record.setFieldShown(tar, false)
                    })
                }
            }
        })
    })

})(kintone.$PLUGIN_ID);

