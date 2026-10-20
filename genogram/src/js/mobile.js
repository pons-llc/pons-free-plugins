((PLUGIN_ID) => {
  'use strict';

  // モバイルは閲覧のみ(図・凡例・メモ一覧)。追加・編集画面でもデータのフィールドの値には触れないため、
  // PCで作成したデータはそのまま保持される。

  const NS = window.Genogram;
  const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));
  if (!NS.ConfigStore.isConfigured(config)) {
    return;
  }

  const render = (event, editing) => {
    const space = kintone.mobile.app.record.getSpaceElement(config.spaceId);
    const field = event.record[config.jsonField];
    if (!space || !field) {
      return;
    }
    const parsed = NS.Model.parse(field.value);
    if (!parsed.ok) {
      space.textContent = '';
      space.appendChild(
        NS.Renderer.h('div', { className: 'gng-root' }, [
          NS.Renderer.h('div', { className: 'gng-error' }, [
            'ジェノグラムのデータ(JSON)を読み込めませんでした。PC版の編集画面で確認してください。',
          ]),
        ]),
      );
      return;
    }
    if (config.hideJsonField) {
      kintone.mobile.app.record.setFieldShown(config.jsonField, false);
    }
    NS.Viewer.mountViewer(space, parsed.model, {
      compact: true,
      filename: `genogram_${event.appId}_${event.recordId || 'new'}.png`,
      emptyMessage: editing
        ? 'ジェノグラムの編集はPC版の画面で行ってください。'
        : undefined,
    });
    if (editing && parsed.model.persons.length > 0) {
      space.insertBefore(
        NS.Renderer.h('p', { className: 'gng-hint' }, [
          'ジェノグラムの編集はPC版の画面で行ってください(この画面では表示のみです)。',
        ]),
        space.firstChild,
      );
    }
  };

  kintone.events.on('mobile.app.record.detail.show', (event) => {
    render(event, false);
    return event;
  });

  kintone.events.on(
    ['mobile.app.record.create.show', 'mobile.app.record.edit.show'],
    (event) => {
      render(event, true);
      return event;
    },
  );
})(kintone.$PLUGIN_ID);
