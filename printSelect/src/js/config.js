(async (PLUGIN_ID) => {
    const reqbody = {
        app : kintone.app.getId(),
        lang: "ja"
    }

    const fields = await kintone.api(kintone.api.url('/k/v1/app/form/fields.json', true), 'GET', reqbody);
    const arr = []
    const configVal = []

    Object.keys(fields.properties).forEach(key =>{
        arr.push({label:fields.properties[key].label,code:key})
    })

    const getDiv = document.getElementById("checks")

    arr.forEach(ar =>{
        var container = document.createElement("div")
        container.classList.add("kintoneplugin-input-checkbox")
        var span = document.createElement("span")
        span.classList.add("kintone-input-checkbox-item")
        var label = document.createElement("label")
        label.innerText = ar.label
        label.setAttribute("for",ar.code)
        var inp = document.createElement("input")
        inp.type = "checkbox"
        inp.name = "checkbox"
        inp.id = ar.code
        span.appendChild(inp)
        span.appendChild(label)
        container.appendChild(span)
        getDiv.appendChild(container)
    })
    
    var config = JSON.parse(kintone.plugin.app.getConfig(PLUGIN_ID).configKey || "[]");

    for(let i =0; i < config.length ; i++){
        try{
            document.getElementById(config[i]).checked = true
        }catch{
            alert("フォームの情報に変更がありました。設定を見直してください。")
        }
    }

    document.getElementById("savebutton").addEventListener("click", ()=>{
        const boxes = document.getElementsByName("checkbox")
        for (let i = 0; i<boxes.length ; i++){
            if(boxes[i].checked){
                configVal.push(boxes[i].getAttribute("id"))
                console.log(boxes[i].getAttribute("id"))
            }
        }
        console.log(configVal)
        kintone.plugin.app.setConfig( {"configKey": JSON.stringify(configVal)},() => {
            alert('設定を一時保存しました。アプリを更新して、設定を反映してください。');
            window.location.href = '../../flow?app=' + kintone.app.getId();
        })
    })
})(kintone.$PLUGIN_ID);
