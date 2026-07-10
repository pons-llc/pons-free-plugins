((PLUGIN_ID) => {
  'use strict';
  const getconfig = kintone.plugin.app.getConfig(PLUGIN_ID);
  const config = JSON.parse(getconfig.configKey || "{}")
  /*const config = {
    "ラジオボタン" : {
      "チェックボックス":{
        "A":["A-1","A-2","A-3"],
        "B":["B-1","B-2","B-3"]
      },
    },
    "ドロップダウン_0":{
      "ラジオボタン_0":{
        "A":["A-1","A-2"],
        "B":["B-1","B-2"]
      }
    }
  }*/

  var changeEvents =[]
  Object.keys(config).forEach(element => {
    changeEvents.push("app.record.create.change." + element,"app.record.edit.change." + element);
  }); 

  kintone.events.on(changeEvents, (event) => {
    var changeField = event.type.split(".").pop(); // 変更されたフィールドのコード取得
    var targetField = Object.keys(config[changeField])[0];
    let record = event.record
    console.log(record)
    var overlay = makeOverLay();
    var content = makeContent(targetField);
    var closeButton = makeCloseButton(overlay);
    var OKbutton = makeOKbutton()
    var contentDescription = document.createElement("p")
    contentDescription.innerText = "複数選択の際はCtrl(command)を押しながら選択してください。"
    var changeValue = event.changes.field.value
    var changeType = event.record[targetField].type;
    var multiCheck = false;
    if (changeType === "CHECK_BOX" || changeType === "MULTI_SELECT"){
      multiCheck = true;
    }
    content.appendChild(closeButton);
    overlay.appendChild(content);
    content.appendChild(singleSelect(changeValue ,config[changeField][targetField][changeValue],multiCheck));
    content.appendChild(OKbutton);
    content.appendChild(contentDescription)
    
    document.body.appendChild(overlay);
    document.getElementsByName("pons-single-ok").forEach(elem =>elem.addEventListener("click",(e)=>{
      var ops = document.getElementById("pons-single-narrowdown")
      if (ops.multiple){
        var val = Array.from(ops.selectedOptions).map(option => option.value); // 修正点
        record[targetField].value = val;
        overlay.remove()
        console.log(val)
        kintone.app.record.set({record: record})
      }else{
        var val = ops.value;
        record[targetField].value = val;
        overlay.remove()
        console.log(val)
        kintone.app.record.set({record: record})
      }
      
    }))

    return event;

    function makeOverLay(){
      const overlay = document.createElement('div');
      overlay.id = 'loadingOverlay';
      overlay.style.position = 'fixed';
      overlay.style.top = '0';
      overlay.style.left = '0';
      overlay.style.width = '100%';
      overlay.style.height = '100%';
      overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)'; // 薄暗い背景
      overlay.style.zIndex = '9999';
      overlay.style.display = 'flex';
      overlay.style.justifyContent = 'center';
      overlay.style.alignItems = 'center';
      return overlay
    }
    

    // 中央に表示するコンテンツ
    function makeContent(tar){
      const content = document.createElement('div');
      const label = document.createElement("p")
      label.innerText = tar
      content.appendChild(label)
      console.log(event.changes.field)
      content.style.position = 'relative';
      content.style.backgroundColor = 'white';
      content.style.padding = '20px';
      content.style.borderRadius = '8px';
      content.style.width = "50%";
      content.style.height = "50%";
      content.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
      content.style.textAlign = 'center';
      content.style.color = 'black';
      content.style.display = "flex";
      content.style.flexDirection = "column";
      return content
    }    

    // ×ボタン
    function makeCloseButton(overlay){
      const closeButton = document.createElement('button');
      closeButton.textContent = '×';
      closeButton.style.position = 'absolute';
      closeButton.style.top = '10px';
      closeButton.style.right = '10px';
      closeButton.style.background = 'transparent';
      closeButton.style.border = '1';
      closeButton.style.fontSize = '24px';
      closeButton.style.cursor = 'pointer';
      closeButton.style.color = 'black';
      // ×ボタンのクリックでオーバーレイを閉じる
      closeButton.addEventListener('click', () => {
        overlay.remove();
      });
      return closeButton      
    }

    function makeOKbutton(){
      var okButton = document.createElement("button")
      okButton.classList.add("kintoneplugin-button-dialog-ok")
      okButton.innerText = "OK"
      okButton.name = "pons-single-ok"
      okButton.style.marginTop = "auto"
      return okButton
    }

    
    function singleSelect(condition,array,tf){
      const bl = document.createElement("div")
      bl.style.display = "flex"
      bl.style.justifyContent = "center"
      bl.style.alignItems = "center"
      bl.style.width = "center"
      bl.classList.add("kintoneplugin-dropdown-outer")
      const select = document.createElement("select");
      //select.classList.add("kintone-dropdown-list")
      select.id = "pons-single-narrowdown"
      if (tf){
        select.multiple = true
      }
      select.classList.add("kintoneplugin-dropdown-list")
      select.style.justifyContent = "center"
      select.style.fontSize = "20px"
      select.style.padding = "10px"
      array.forEach(target =>{
        var option = document.createElement("option");
        option.value = target;
        option.innerText = target;
        select.appendChild(option)
      })
      return select
    }

  });
})(kintone.$PLUGIN_ID);
