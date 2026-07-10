(async (PLUGIN_ID) => {
    'use strict'
    const config = JSON.parse(kintone.plugin.app.getConfig(PLUGIN_ID).configKey || "{}");
    //const changeEvents = [];

    kintone.events.on(["app.record.create.submit","app.record.edit.submit"],(event)=>{
        Object.keys(config).forEach(condition  =>{
            var conditionValue = event.record[condition].value;
            if( config[condition].hasOwnProperty(conditionValue)){
                var targetFields = config[condition][conditionValue]
                if (targetFields){
                    targetFields.forEach(tar =>{
                        if(!event.record[tar].value){
                            event.record[tar].error = "未入力です"
                            event.error = "未入力項目があります"
                        }
                    })
                }
            }
        })
        return event
    })

})(kintone.$PLUGIN_ID);

