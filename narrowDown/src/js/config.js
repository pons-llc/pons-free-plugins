(async (PLUGIN_ID) => {
    var cancelDOM = document.getElementById("cancel")
    cancelDOM.addEventListener("click",()=>{
        window.location.href = '../../flow?app=' + kintone.app.getId();
    })

  const buttonelm = document.getElementById("mr-button")

  const body = {app: kintone.app.getId()};
  const resp = await kintone.api(kintone.api.url('/k/v1/app/form/fields', true), 'GET', body)
  
  const form = resp.properties
  
  var conditionFields = []
  var targetFields = []
  
  Object.keys(form).forEach(prop =>{
      if (form[prop].type === "DROP_DOWN" || form[prop].type === "RADIO_BUTTON"){
          var insertJson = {code : form[prop].code , label : form[prop].label , options : Object.keys(form[prop].options)}
          conditionFields.push(insertJson)
          targetFields.push(insertJson)
      }else if(form[prop].type === "CHECK_BOX" || form[prop].type === "MULTI_SELECT"){
          var insertJson = {code : form[prop].code , label : form[prop].label , options : Object.keys(form[prop].options)}
          targetFields.push(insertJson)
      }
  })

  const conf = kintone.plugin.app.getConfig(PLUGIN_ID)

  if (conf && conf.configKey){
    try{
        const getConfig = JSON.parse(conf.configKey)
        firstSet(getConfig)}catch(e){alert("フォームに変更があったようです。再設定してください。")}
  }
  
  buttonelm.addEventListener("click",(e)=>{
    //行を追加
      var rowElement =document.createElement("div")
      rowElement.style.display = "flex"
      rowElement.className = "row-element"
      var FieldGroup = document.createElement("div")
      var ValueGroup = document.createElement("div")
      ValueGroup.className = "value-group"
  
      //条件となるフィールド名選択欄を追加
      var conditionFieldElement = document.createElement("select")
      conditionFieldElement.style.display = "block"
      conditionFieldElement.className = "kintoneplugin-dropdown"
      makeOptions(conditionFieldElement,"","絞込条件となるフィールドを選択")
      conditionFields.forEach(con =>{
          makeOptions(conditionFieldElement, con.code , con.label,false)
      })
      conditionFieldElement.id = "condition-field"
  
      //値の追加設定ボタンを追加
      var addValueButton = document.createElement("button")
      addValueButton.setAttribute("name","addValue")
      addValueButton.className = "add-value-button"
      addValueButton.innerText = "+"
      addValueButton.addEventListener("click",(e)=> addValueRow(e, form))
    
      var targetFieldElement = document.createElement("select")
      targetFieldElement.id = "target-field"
      conditionFieldElement.style.display = "block"
      targetFieldElement.className ="kintoneplugin-dropdown"
      makeOptions(targetFieldElement,"","絞込対象となるフィールドを選択")
      targetFields.forEach(tar =>{
          makeOptions(targetFieldElement,tar.code,tar.label,false)
      })
  
      var deleteCondition = document.createElement("button")
      deleteCondition.addEventListener("click", (e)=>{
          e.target.closest(".row-element").remove()
      })
      deleteCondition.className = "delbutton"
      deleteCondition.innerText = "×"
  
      rowElement.appendChild(deleteCondition)
  
      FieldGroup.appendChild(conditionFieldElement)
      FieldGroup.appendChild(targetFieldElement)
  
      rowElement.appendChild(FieldGroup)
      rowElement.appendChild(addValueButton)
      rowElement.appendChild(ValueGroup)
  
      document.getElementById("form").appendChild(rowElement)  
  })
  
  function makeOptions(elem, optionValue , optionLabel , bool){
      var optionElement = document.createElement("option")
      optionElement.value = optionValue;
      optionElement.innerText = optionLabel;
      if (bool === true){
        optionElement.selected = true
      }
      elem.appendChild(optionElement)
  }

  function firstSet(config) {
    Object.keys(config).forEach(c => {
        var tarCode = Object.entries(config[c])[0][0]; // 設定対象フィールド
        var values = Object.entries(config[c])[0][1]; // 条件と対象値のマッピング

        // **1. 行を追加する**
        var rowElement = document.createElement("div");
        rowElement.style.display = "flex";
        rowElement.className = "row-element";
        var FieldGroup = document.createElement("div");
        var ValueGroup = document.createElement("div");
        ValueGroup.className = "value-group";

        // **2. 条件フィールドの作成**
        var conditionFieldElement = document.createElement("select");
        conditionFieldElement.style.display = "block";
        conditionFieldElement.className = "kintoneplugin-dropdown";
        makeOptions(conditionFieldElement, "", "絞込条件となるフィールドを選択");
        conditionFields.forEach(con => {
            makeOptions(conditionFieldElement, con.code, con.label, con.code === c);
        });
        conditionFieldElement.id = "condition-field";

        // **3. 値の追加ボタン**
        var addValueButton = document.createElement("button");
        addValueButton.setAttribute("name", "addValue");
        addValueButton.className = "add-value-button";
        addValueButton.innerText = "+";
        addValueButton.addEventListener("click",(e)=> addValueRow(e, form))

        // **4. 対象フィールドの作成**
        var targetFieldElement = document.createElement("select");
        targetFieldElement.id = "target-field";
        targetFieldElement.className = "kintoneplugin-dropdown";
        makeOptions(targetFieldElement, "", "絞込対象となるフィールドを選択");
        targetFields.forEach(tar => {
            makeOptions(targetFieldElement, tar.code, tar.label, tar.code === tarCode);
        });

        // **5. 削除ボタン**
        var deleteCondition = document.createElement("button");
        deleteCondition.className = "delbutton";
        deleteCondition.innerText = "×";
        deleteCondition.addEventListener("click", (e) => {
            e.target.closest(".row-element").remove();
        });

        // **6. 初期データから値を追加**
        Object.keys(values).forEach(conVal => {
            var targetValues = values[conVal]; // 設定された対象の値リスト

            var valueRow = document.createElement("div");
            valueRow.style.display = "flex";
            valueRow.className = "value-row";

            var conditionValueDiv = document.createElement("div");
            var conditionValueSelect = document.createElement("select");
            conditionValueSelect.id = "condition-value";
            conditionValueSelect.className = "kintoneplugin-dropdown";
            makeOptions(conditionValueSelect, "", "条件となる値を選択");
            Object.keys(form[c].options).forEach(op => {
                makeOptions(conditionValueSelect, op, op, op === conVal);
            });

            var targetValueDiv = document.createElement("div");
            var targetValueSelect = document.createElement("select");
            targetValueSelect.id = "target-value";
            targetValueSelect.multiple = "true";
            targetValueSelect.style.fontSize = "20px";
            targetValueSelect.style.padding = "10px";

            Object.keys(form[tarCode].options).forEach(op => {
                makeOptions(targetValueSelect, op, op, targetValues.includes(op));
            });

            var deleteValueButton = document.createElement("button");
            deleteValueButton.className = "delbutton";
            deleteValueButton.innerText = "×";
            deleteValueButton.addEventListener("click", (e) => {
                e.target.closest(".value-row").remove();
            });

            conditionValueDiv.appendChild(conditionValueSelect);
            targetValueDiv.appendChild(targetValueSelect);

            valueRow.appendChild(conditionValueDiv);
            valueRow.appendChild(targetValueDiv);
            valueRow.appendChild(deleteValueButton);
            ValueGroup.appendChild(valueRow);
        });

        // **7. フォームに追加**
        rowElement.appendChild(deleteCondition);
        FieldGroup.appendChild(conditionFieldElement);
        FieldGroup.appendChild(targetFieldElement);
        rowElement.appendChild(FieldGroup);
        rowElement.appendChild(addValueButton);
        rowElement.appendChild(ValueGroup);

        document.getElementById("form").appendChild(rowElement);
    });
}

// 既存の値を反映させて行を追加
function addValueRowWithConfig(valElement, conditionCode, conditionValue, targetValues, form) {
    const valueRow = document.createElement("div");
    valueRow.style.display = "flex";
    valueRow.className = "value-row";

    var conditionValueDiv = document.createElement("div");
    var conditionValueSelect = document.createElement("select");
    conditionValueSelect.id = "condition-value";
    conditionValueSelect.className = "kintoneplugin-dropdown";
    makeOptions(conditionValueSelect, "", "条件となる値を選択");
    Object.keys(form[conditionCode].options).forEach(op => {
        makeOptions(conditionValueSelect, op, op, op === conditionValue);
    });

    conditionValueDiv.appendChild(conditionValueSelect);

    var targetValueDiv = document.createElement("div");
    var targetValueSelect = document.createElement("select");
    targetValueSelect.id = "target-value";
    targetValueSelect.multiple = "true";
    targetValueSelect.style.fontSize = "20px";
    targetValueSelect.style.padding = "10px";
    Object.keys(form[conditionCode].options).forEach(op => {
        makeOptions(targetValueSelect, op, op, targetValues.includes(op));
    });

    targetValueDiv.appendChild(targetValueSelect);

    const deleteValueButton = document.createElement("button");
    deleteValueButton.addEventListener("click", (e) => {
        e.target.closest(".value-row").remove();
    });
    deleteValueButton.className = "delbutton";
    deleteValueButton.innerText = "×";

    valueRow.appendChild(conditionValueDiv);
    valueRow.appendChild(targetValueDiv);
    valueRow.appendChild(deleteValueButton);
    valElement.appendChild(valueRow);
}

function addValueRow(e, form) {
    const rowElement = e.target.closest(".row-element");
    const valElement = rowElement.querySelector(".value-group");
    
    const valueRow = document.createElement("div");
    valueRow.style.display = "flex";
    valueRow.className = "value-row";

    // 選択された条件フィールドの値を取得
    const selectedConditionField = rowElement.querySelector("#condition-field").value;
    const selectedConditionValues = Object.keys(form[selectedConditionField].options);

    var conditionValueDiv = document.createElement("div");
    var conditionValueSelect = document.createElement("select");
    conditionValueSelect.id = "condition-value";
    conditionValueSelect.className = "kintoneplugin-dropdown";
    makeOptions(conditionValueSelect, "", "条件となる値を選択");

    selectedConditionValues.forEach(op => {
        makeOptions(conditionValueSelect, op, op, false);
    });

    conditionValueDiv.appendChild(conditionValueSelect);

    var targetValueDiv = document.createElement("div");
    var targetValueSelect = document.createElement("select");
    targetValueSelect.id = "target-value";
    targetValueSelect.multiple = "true";
    targetValueSelect.style.fontSize = "20px";
    targetValueSelect.style.padding = "10px";

    // 選択された対象フィールドの値を取得
    const selectedTargetField = rowElement.querySelector("#target-field").value;
    const selectedTargetValues = Object.keys(form[selectedTargetField].options);

    selectedTargetValues.forEach(op => {
        makeOptions(targetValueSelect, op, op, false);
    });

    targetValueDiv.appendChild(targetValueSelect);

    const deleteValueButton = document.createElement("button");
    deleteValueButton.className = "delbutton";
    deleteValueButton.innerText = "×";
    deleteValueButton.addEventListener("click", (e) => {
        e.target.closest(".value-row").remove();
    });

    valueRow.appendChild(conditionValueDiv);
    valueRow.appendChild(targetValueDiv);
    valueRow.appendChild(deleteValueButton);
    valElement.appendChild(valueRow);
}



  document.getElementById("saveButton").addEventListener("click",()=>{
      var config = {}
      var rows = document.getElementsByClassName("row-element")
      Array.from(rows).forEach(row =>{
          var configConditionCode = row.querySelector("#condition-field").value
          var configTargetCode = row.querySelector("#target-field").value
          var valueRows = row.getElementsByClassName("value-row")
          var vals ={}
          for (i =0; i < valueRows.length ; i++){
              var conVal = valueRows[i].querySelector("#condition-value").value
              var targetSelect = valueRows[i].querySelector("#target-value")
              var talVal = Array.from(targetSelect.selectedOptions).map(option => option.value)
              vals[conVal] = talVal
          }
          config[configConditionCode] = {[configTargetCode]: vals}
      })
      console.log(config)

      const configVal = JSON.stringify(config);

      kintone.plugin.app.setConfig({ "configKey": configVal }, () => {
        alert('設定を一時保存しました。アプリを更新して、設定を反映してください。');
        window.location.href = '../../flow?app=' + kintone.app.getId();
      });
  })

})(kintone.$PLUGIN_ID);
