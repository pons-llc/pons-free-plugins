(function (root) {
  'use strict';

  // 起点アプリから、ルックアップ/関連レコード一覧フィールドが参照する関連アプリを
  // 幅優先で辿るオーケストレーションロジック。
  //
  // - kintone依存の実処理(REST APIでの1アプリ分の設計情報取得)は`fetchAppDesign(appId)`として
  //   呼び出し側から注入する(org_lookupの`resolveOrgInfo`と同じ設計。Jestで確定的にテストできる)。
  // - 訪問済みアプリIDの集合で重複訪問を防ぐため、循環参照(AがBを参照しBがAを参照する等、
  //   自己参照を含む)があっても無限ループにはならない。
  // - 探索するアプリの総数(訪問済み+探索待ちの合計)に上限(maxApps)を設け、環境全体への
  // 過大なAPI呼び出しを防ぐ(idea.md「エッジケース」参照)。上限超過で辿れなかった関連アプリIDは
  // `skippedCap`に記録する。
  // - 1アプリの取得に失敗しても(`fetchAppDesign`が例外を投げても)、そのアプリの結果に
  //   エラーを記録するだけで探索全体は継続する(部分的失敗の許容、idea.md参照)。
  const traverseApps = async ({
    rootAppId,
    fetchAppDesign,
    extractRelatedAppIds,
    maxApps,
    onAppProcessed,
  }) => {
    const cap = typeof maxApps === 'number' ? maxApps : 30;
    const visited = new Set();
    const queue = [String(rootAppId)];
    const apps = [];
    const edges = [];
    const skippedCap = new Set();

    while (queue.length > 0) {
      const appId = queue.shift();
      if (visited.has(appId)) {
        continue;
      }
      visited.add(appId);

      let design = null;
      let error = null;
      try {
        design = await fetchAppDesign(appId);
      } catch (err) {
        error = (err && err.message) || String(err);
      }
      apps.push({ appId, design, error });
      if (typeof onAppProcessed === 'function') {
        onAppProcessed(appId, apps.length);
      }

      const relatedFields =
        design && design.fields ? extractRelatedAppIds(design.fields) : [];
      relatedFields.forEach(({ fieldCode, fieldType, relatedAppId }) => {
        edges.push({
          fromAppId: appId,
          fieldCode,
          fieldType,
          toAppId: relatedAppId,
        });
        if (visited.has(relatedAppId) || queue.includes(relatedAppId)) {
          return;
        }
        if (visited.size + queue.length >= cap) {
          skippedCap.add(relatedAppId);
          return;
        }
        queue.push(relatedAppId);
      });
    }

    return { apps, edges, skippedCap: Array.from(skippedCap) };
  };

  const TraverseApps = { traverseApps };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = TraverseApps;
  } else {
    root.NotebooklmExport = root.NotebooklmExport || {};
    root.NotebooklmExport.TraverseApps = TraverseApps;
  }
})(typeof window !== 'undefined' ? window : globalThis);
