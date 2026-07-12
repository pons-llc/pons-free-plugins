((PLUGIN_ID) => {
      kintone.events.on("app.record.print.show", (event) => {
        var config = JSON.parse(kintone.plugin.app.getConfig(PLUGIN_ID).configKey || "[]");
        var conf = confirm("印刷時に特定のフィールドを隠しますか？")
        if (conf){
          config.forEach(con =>{
            kintone.app.record.setFieldShown(con, false)
          })
        }
        return event        
      })
    }
)(kintone.$PLUGIN_ID)