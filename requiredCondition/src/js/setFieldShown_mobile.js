(async (PLUGIN_ID) => {
    var config = JSON.parse(kintone.plugin.app.getConfig(PLUGIN_ID).configKey || "{}");
    var changeEvents = [];

    // イベントを収集
    Object.keys(config).forEach(element => {
        changeEvents.push("mobile.app.record.create.change." + element,"mobile.app.record.edit.change." + element);
    });

    kintone.events.on(["mobile.app.record.create.submit","mobile.app.record.edit.submit"],(event)=>{
        Object.keys(config).forEach(condition  =>{
            var conditionValue = event.record[condition].value;
            if( config[condition].hasOwnProperty(conditionValue)){
                var targetFields = config[condition][conditionValue]
                if (targetFields){
                    targetFields.forEach(tar =>{
                        event.record[tar].error = "未入力です"
                    })
                }
            }
        })

        return event
    })

})(kintone.$PLUGIN_ID);

