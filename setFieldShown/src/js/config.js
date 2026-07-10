(async (PLUGIN_ID) => {
    var cancelDOM = document.getElementById("cancel")
    cancelDOM.addEventListener("click",()=>{
        window.location.href = '../../flow?app=' + kintone.app.getId();
    })

    var conditions = {};
    var targets;
    var conditionType = ["DROP_DOWN", "RADIO_BUTTON"];
    var config = JSON.parse(kintone.plugin.app.getConfig(PLUGIN_ID).configKey || "[]");
    // フォームフィールドの取得
    kintone.api(kintone.api.url('/k/v1/app/form/fields', true), 'GET', {
        app: kintone.app.getId()
    }).then(function(resp) {
        targets = Object.keys(resp.properties);
        targets.forEach(code => {
            if (conditionType.includes(resp.properties[code].type)) {
                conditions[code] = Object.keys(resp.properties[code].options);
            }
        });

        // 初期値の設定
        if (config ) {
                Object.keys(config).forEach(fieldCode => {
                    const conditionDiv = createConditionGroup();
                    document.getElementById('form-container').appendChild(conditionDiv);
                    console.log(fieldCode)
                    const conditionFieldSelect = conditionDiv.querySelector('.condition-field');
                    populateConditionFieldOptions(conditionFieldSelect);

                    conditionFieldSelect.value = fieldCode;
                    populateConditionValues(conditionFieldSelect, conditionDiv.querySelector('.values-container'), config[fieldCode]);
                });
        }
    }).catch(function(error) {
        console.error('Error:', error);
    });

    // 条件フィールドの選択肢を追加
    function populateConditionFieldOptions(selectElement) {
        Object.keys(conditions).forEach(con => {
            const op = document.createElement("option");
            op.value = con;
            op.textContent = con;
            selectElement.appendChild(op);
        });
    }

    // 条件値の選択肢を追加
    function populateConditionValues(conditionFieldSelect, valuesContainer, selectedValues = {}) {
        const selectedField = conditionFieldSelect.value;
        if (!selectedField) return;

        Object.keys(selectedValues).forEach(value => {
            const valueRow = createValueRow();
            const conditionValueSelect = valueRow.querySelector('.condition-value');

            conditions[selectedField].forEach(sele => {
                const option = document.createElement("option");
                option.value = sele;
                option.textContent = sele;
                if (value === sele) option.selected = true;
                conditionValueSelect.appendChild(option);
            });

            const targetSelect = valueRow.querySelector('.target-fields');
            targets.forEach(tar => {
                const tarOption = document.createElement("option");
                tarOption.value = tar;
                tarOption.textContent = tar;
                if (selectedValues[value].includes(tar)) tarOption.selected = true;
                targetSelect.appendChild(tarOption);
            });

            valuesContainer.insertBefore(valueRow, valuesContainer.querySelector('button[name="addConditionValue"]').nextSibling);
        });
    }

    function createConditionGroup() {
        const conditionDiv = document.createElement('div');
        conditionDiv.className = 'condition-group';

        conditionDiv.innerHTML = `
        <div class="condition-row">
            <button class="delete-condition-group">×</button>
            <div class="column">
                <select class="kintoneplugin-dropdown condition-field">
                    <option value="">条件となるフィールドコードを選択してください。</option>
                </select>
            </div>
            <div class="column">
                <div class="values-container">
                    <button name="addConditionValue" style="font-size: 12px;">条件値を追加</button>
                </div>
            </div>
        </div>
        `;
        return conditionDiv;
    }

    function createValueRow() {
        const valueRow = document.createElement('div');
        valueRow.className = 'value-row';

        valueRow.innerHTML = `
        <select class="kintoneplugin-dropdown condition-value" name="conditionValue">
            <option value="">条件となる値を選択してください</option>
        </select>
        <select class="target-fields" name="targetCode" multiple size="3"></select>
        <button class="delete-value-row" style="font-size: 12px; margin-left: 10px;">削除</button>
        `;
        return valueRow;
    }

    document.getElementById("addCondition").addEventListener("click", () => {
        const container = document.getElementById('form-container');
        const conditionDiv = createConditionGroup();
        container.appendChild(conditionDiv);

        populateConditionFieldOptions(conditionDiv.querySelector('.condition-field'));
    });

    document.getElementById('form-container').addEventListener('change', (e) => {
        if (e.target && e.target.classList.contains('condition-field')) {
            const valuesContainer = e.target.closest('.condition-group').querySelector('.values-container');
            valuesContainer.innerHTML = '<button name="addConditionValue" style="font-size: 12px;">条件値を追加</button>';
            populateConditionValues(e.target, valuesContainer);
        }
    });

    document.getElementById('form-container').addEventListener("click", (e) => {
        if (e.target && e.target.name === "addConditionValue") {
            const conditionGroup = e.target.closest('.condition-group');
            const selectedField = conditionGroup.querySelector('.condition-field').value;
            if (selectedField) {
                const valuesContainer = conditionGroup.querySelector('.values-container');
                const valueRow = createValueRow();
                valuesContainer.insertBefore(valueRow, e.target.nextSibling);

                conditions[selectedField].forEach(sele => {
                    const conditionValueOptions = document.createElement("option");
                    conditionValueOptions.value = sele;
                    conditionValueOptions.textContent = sele;
                    valueRow.querySelector(".condition-value").appendChild(conditionValueOptions);
                });

                targets.forEach(tar => {
                    const tarOption = document.createElement("option");
                    tarOption.value = tar;
                    tarOption.textContent = tar;
                    valueRow.querySelector(".target-fields").appendChild(tarOption);
                });
            } else {
                alert("条件フィールドコードを選択してください");
            }
        }

        if (e.target && e.target.classList.contains('delete-value-row')) {
            e.target.closest('.value-row').remove();
        }

        if (e.target && e.target.classList.contains('delete-condition-group')) {
            e.target.closest('.condition-group').remove();
        }
    });

    document.getElementById("generateJSON").addEventListener("click", () => {
        const conditionGroups = document.querySelectorAll('.condition-group');
        const result = {};
        let hasError = false;

        conditionGroups.forEach(group => {
            const conditionField = group.querySelector('.condition-field').value;
            if (!conditionField) {
                alert("すべての条件フィールドコードを選択してください");
                hasError = true;
                return;
            }

            const values = group.querySelectorAll('.value-row');
            const conditionObj = {};

            values.forEach(value => {
                const conditionValue = value.querySelector('.condition-value').value;
                const targetFields = Array.from(value.querySelector('.target-fields').selectedOptions).map(option => option.value);

                if (!conditionValue || targetFields.length === 0) {
                    alert("すべての条件値とターゲットフィールドを入力してください");
                    hasError = true;
                    return;
                }

                conditionObj[conditionValue] = targetFields;
            });

            result[conditionField] = conditionObj;
        });

        if (!hasError) {
            const configVal = JSON.stringify(result, null, 2);

            kintone.plugin.app.setConfig({ "configKey": configVal }, () => {
                alert('設定を一時保存しました。アプリを更新して、設定を反映してください。');
                window.location.href = '../../flow?app=' + kintone.app.getId();
            });
        }
    });
})(kintone.$PLUGIN_ID);
