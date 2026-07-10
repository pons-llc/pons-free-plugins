(function (PLUGIN_ID) {
  'use strict';

  const EVENTS = [
    'mobile.app.record.detail.show',
    'mobile.app.record.create.show',
    'mobile.app.record.edit.show',
  ];

  kintone.events.on(EVENTS, (event) => {
    const config = kintone.plugin.app.getConfig(PLUGIN_ID);
    window.BoxGdriveEmbed.renderAll(
      config,
      event.record,
      kintone.mobile.app.record.getSpaceElement,
    );
    return event;
  });
})(kintone.$PLUGIN_ID);
