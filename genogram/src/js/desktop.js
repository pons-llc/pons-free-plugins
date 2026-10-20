((PLUGIN_ID) => {
  'use strict';

  const NS = window.Genogram;
  const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));
  if (!NS.ConfigStore.isConfigured(config)) {
    return;
  }

  // 追加・編集画面で表示中のエディター。保存イベントで、このモデルをJSONにしてevent.recordに入れる。
  // JSONとして読めない値だった場合はnullのままにし、保存時に値を上書きしない(元のデータを消さないため)。
  let editor = null;

  const fieldValue = (record) =>
    record[config.jsonField] ? record[config.jsonField].value : '';

  const getAuthor = () => {
    const user = kintone.getLoginUser();
    return { code: user.code, name: user.name };
  };

  const filenameFor = (event) =>
    `genogram_${event.appId}_${event.recordId || 'new'}.png`;

  const showParseError = (space, error) => {
    space.textContent = '';
    space.appendChild(
      NS.Renderer.h('div', { className: 'gng-root' }, [
        NS.Renderer.h('div', { className: 'gng-error' }, [
          `ジェノグラムのデータ(JSON)を読み込めませんでした(${error})。データを消さないよう、図の表示・編集を止めています。` +
            `フィールド「${config.jsonField}」の値を修正するか、空にしてから保存し直してください。`,
        ]),
      ]),
    );
    // 手で修正できるよう、データのフィールドを表示する
    kintone.app.record.setFieldShown(config.jsonField, true);
  };

  // 図を描く準備。スペース・フィールドが無い(設定後にフォームから削除された)場合はnull。
  const prepare = (event) => {
    const space = kintone.app.record.getSpaceElement(config.spaceId);
    if (!space || !event.record[config.jsonField]) {
      return null;
    }
    const parsed = NS.Model.parse(fieldValue(event.record));
    if (!parsed.ok) {
      showParseError(space, parsed.error);
      return null;
    }
    if (config.hideJsonField) {
      kintone.app.record.setFieldShown(config.jsonField, false);
    }
    return { space, model: parsed.model };
  };

  kintone.events.on(
    ['app.record.create.show', 'app.record.edit.show'],
    (event) => {
      editor = null;
      const prepared = prepare(event);
      if (prepared) {
        editor = NS.Editor.mountEditor(prepared.space, prepared.model, {
          getAuthor,
          filename: filenameFor(event),
        });
      }
      return event;
    },
  );

  kintone.events.on(
    ['app.record.create.submit', 'app.record.edit.submit'],
    (event) => {
      if (editor && event.record[config.jsonField]) {
        event.record[config.jsonField].value = NS.Model.serialize(
          editor.getModel(),
        );
      }
      return event;
    },
  );

  kintone.events.on('app.record.detail.show', (event) => {
    const prepared = prepare(event);
    if (!prepared) {
      return event;
    }
    const revision = event.record.$revision.value;
    NS.Viewer.mountViewer(prepared.space, prepared.model, {
      filename: filenameFor(event),
      onAddMemo: async ({ targetId, text }) => {
        await NS.MemoSaver.appendMemo({
          api: (path, method, body) =>
            kintone.api(kintone.api.url(path, true), method, body),
          appId: event.appId,
          recordId: event.recordId,
          revision,
          fieldCode: config.jsonField,
          currentValue: fieldValue(event.record),
          memo: {
            targetId,
            text,
            author: getAuthor(),
            at: new Date().toISOString(),
          },
        });
        // 画面上のレコード(リビジョン・他のフィールドの表示)を最新にするため再読み込みする
        window.location.reload();
      },
    });
    return event;
  });

  kintone.events.on('app.record.print.show', (event) => {
    const prepared = prepare(event);
    if (prepared) {
      NS.Viewer.mountViewer(prepared.space, prepared.model, { print: true });
    }
    return event;
  });

  // 一覧のインライン編集では、データのフィールドを手で書き換えて壊さないよう編集不可にする。
  kintone.events.on('app.record.index.edit.show', (event) => {
    if (event.record[config.jsonField]) {
      event.record[config.jsonField].disabled = true;
    }
    return event;
  });
})(kintone.$PLUGIN_ID);
