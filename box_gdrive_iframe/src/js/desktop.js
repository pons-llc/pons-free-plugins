(function (PLUGIN_ID) {
  "use strict";

  const EVENTS = [
    "app.record.detail.show",
    "app.record.create.show",
    "app.record.edit.show",
  ];

  kintone.events.on(EVENTS, (event) => {
    const config = kintone.plugin.app.getConfig(PLUGIN_ID);
    window.BoxGdriveEmbed.renderAll(
      config,
      event.record,
      kintone.app.record.getSpaceElement
    );
    return event;
  });
})(kintone.$PLUGIN_ID);
