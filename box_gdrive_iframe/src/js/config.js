(async (PLUGIN_ID) => {
  "use strict";

  const URL_FIELD_TYPES = ["SINGLE_LINE_TEXT", "LINK"];

  const formEl = document.querySelector(".js-submit-settings");
  const cancelButtonEl = document.querySelector(".js-cancel-button");
  const tabListEl = document.getElementById("js-tab-list");
  const tabPanelsEl = document.getElementById("js-tab-panels");
  const addTabButtonEl = document.getElementById("js-add-tab");
  const panelTemplateEl = document.getElementById("js-panel-template");
  const noSpaceWarningEl = document.getElementById("js-no-space-warning");

  if (
    !(
      formEl &&
      cancelButtonEl &&
      tabListEl &&
      tabPanelsEl &&
      addTabButtonEl &&
      panelTemplateEl &&
      noSpaceWarningEl
    )
  ) {
    throw new Error("Required elements do not exist.");
  }

  // フォームのレイアウトから「スペース」フィールドと、URLの入力元にできるフィールドを収集する
  const collectFormFields = (layout) => {
    const spaces = [];
    const urlFields = [];

    const walk = (rows) => {
      (rows || []).forEach((row) => {
        if (row.type === "GROUP") {
          walk(row.layout);
          return;
        }
        if (row.type === "SUBTABLE") {
          // テーブル内のフィールドは埋め込み先／埋め込み元として利用できない
          return;
        }
        (row.fields || []).forEach((field) => {
          if (field.type === "SPACER" && field.elementId) {
            spaces.push(field.elementId);
          } else if (URL_FIELD_TYPES.includes(field.type) && field.code) {
            urlFields.push(field.code);
          }
        });
      });
    };

    walk(layout);
    return { spaces, urlFields };
  };

  // kintone.app.getFormLayout() は REST APIのレスポンスではなく、
  // その `layout` プロパティと同様の値（レイアウト配列そのもの）を解決する
  const layout = await kintone.app.getFormLayout();
  const { spaces, urlFields } = collectFormFields(layout);

  if (spaces.length === 0) {
    noSpaceWarningEl.style.display = "block";
  }

  let embeds = [];
  try {
    const savedConfig = kintone.plugin.app.getConfig(PLUGIN_ID);
    embeds = savedConfig.embeds ? JSON.parse(savedConfig.embeds) : [];
  } catch (e) {
    embeds = [];
  }
  if (!Array.isArray(embeds)) {
    embeds = [];
  }

  let activeIndex = embeds.length > 0 ? 0 : -1;

  const createEmbedData = () => ({
    title: "",
    spaceElementId: spaces[0] || "",
    urlFieldCode: urlFields[0] || "",
    service: "box",
    width: "600",
    height: "400",
  });

  const buildSelectOptions = (selectEl, values, selectedValue) => {
    selectEl.innerHTML = "";
    if (values.length === 0) {
      const optionEl = document.createElement("option");
      optionEl.value = "";
      optionEl.textContent = "(利用可能なフィールドがありません)";
      selectEl.appendChild(optionEl);
      selectEl.disabled = true;
      return;
    }
    selectEl.disabled = false;
    values.forEach((value) => {
      const optionEl = document.createElement("option");
      optionEl.value = value;
      optionEl.textContent = value;
      optionEl.selected = value === selectedValue;
      selectEl.appendChild(optionEl);
    });
  };

  const renderTabs = () => {
    tabListEl.innerHTML = "";
    embeds.forEach((embed, index) => {
      const tabButtonEl = document.createElement("button");
      tabButtonEl.type = "button";
      tabButtonEl.className =
        "embed-tab-button" + (index === activeIndex ? " is-active" : "");
      tabButtonEl.textContent = embed.title || `埋め込み${index + 1}`;
      tabButtonEl.addEventListener("click", () => {
        activeIndex = index;
        render();
      });
      tabListEl.appendChild(tabButtonEl);
    });
  };

  const renderPanel = () => {
    tabPanelsEl.innerHTML = "";
    if (activeIndex < 0 || !embeds[activeIndex]) {
      const emptyEl = document.createElement("p");
      emptyEl.className = "kintoneplugin-desc";
      emptyEl.textContent =
        "「＋ 埋め込みを追加」ボタンから設定を追加してください。";
      tabPanelsEl.appendChild(emptyEl);
      return;
    }

    const embed = embeds[activeIndex];
    const fragment = panelTemplateEl.content.cloneNode(true);
    const panelEl = fragment.querySelector(".embed-panel");

    const titleEl = panelEl.querySelector(".js-embed-title");
    const spaceEl = panelEl.querySelector(".js-embed-space");
    const fieldEl = panelEl.querySelector(".js-embed-field");
    const serviceEls = panelEl.querySelectorAll(".js-embed-service");
    const widthEl = panelEl.querySelector(".js-embed-width");
    const heightEl = panelEl.querySelector(".js-embed-height");
    const removeButtonEl = panelEl.querySelector(".js-remove-tab");

    titleEl.value = embed.title || "";
    buildSelectOptions(spaceEl, spaces, embed.spaceElementId);
    buildSelectOptions(fieldEl, urlFields, embed.urlFieldCode);

    const radioGroupName = `js-embed-service-${activeIndex}`;
    serviceEls.forEach((radioEl) => {
      radioEl.name = radioGroupName;
      radioEl.checked = radioEl.value === (embed.service || "box");
    });

    widthEl.value = embed.width || "600";
    heightEl.value = embed.height || "400";

    titleEl.addEventListener("input", () => {
      embed.title = titleEl.value;
      const tabButtonEls = tabListEl.querySelectorAll(".embed-tab-button");
      if (tabButtonEls[activeIndex]) {
        tabButtonEls[activeIndex].textContent =
          embed.title || `埋め込み${activeIndex + 1}`;
      }
    });
    spaceEl.addEventListener("change", () => {
      embed.spaceElementId = spaceEl.value;
    });
    fieldEl.addEventListener("change", () => {
      embed.urlFieldCode = fieldEl.value;
    });
    serviceEls.forEach((radioEl) => {
      radioEl.addEventListener("change", () => {
        if (radioEl.checked) {
          embed.service = radioEl.value;
        }
      });
    });
    widthEl.addEventListener("input", () => {
      embed.width = widthEl.value;
    });
    heightEl.addEventListener("input", () => {
      embed.height = heightEl.value;
    });
    removeButtonEl.addEventListener("click", () => {
      embeds.splice(activeIndex, 1);
      activeIndex = embeds.length > 0 ? Math.max(0, activeIndex - 1) : -1;
      render();
    });

    tabPanelsEl.appendChild(panelEl);
  };

  const render = () => {
    renderTabs();
    renderPanel();
  };

  addTabButtonEl.addEventListener("click", () => {
    embeds.push(createEmbedData());
    activeIndex = embeds.length - 1;
    render();
  });

  render();

  formEl.addEventListener("submit", (e) => {
    e.preventDefault();

    for (const embed of embeds) {
      if (!embed.spaceElementId || !embed.urlFieldCode || !embed.service) {
        alert(
          "すべての埋め込み設定で、スペースフィールド・URLフィールド・サービスを選択してください。"
        );
        return;
      }
    }

    kintone.plugin.app.setConfig({ embeds: JSON.stringify(embeds) }, () => {
      alert("プラグインの設定を保存しました。アプリを更新してください。");
      window.location.href = "../../flow?app=" + kintone.app.getId();
    });
  });

  cancelButtonEl.addEventListener("click", () => {
    window.location.href = "../../" + kintone.app.getId() + "/plugin/";
  });
})(kintone.$PLUGIN_ID);
