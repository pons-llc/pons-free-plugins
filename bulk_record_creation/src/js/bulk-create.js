(function (global, kintone) {
  'use strict';

  // 一覧画面からの一括作成のorchestrationロジック。PC・モバイル共通で使う
  // (kintone.createDialog/kintone.mobile.createBottomSheet、kintone.showLoading/
  // kintone.mobile.showLoadingはそれぞれPC専用/モバイル専用APIのため、platform引数として
  // 呼び出し元(desktop.js/mobile.js)から注入する)。
  const NS = global.BulkRecordCreation;
  const FieldEligibility = NS.FieldEligibility;
  const RecurrenceExpander = NS.RecurrenceExpander;
  const TimeSlotExpander = NS.TimeSlotExpander;
  const AssigneeNormalizer = NS.AssigneeNormalizer;
  const RecordPayloadBuilder = NS.RecordPayloadBuilder;
  const RecordCountEstimator = NS.RecordCountEstimator;
  const BatchCreator = NS.BatchCreator;
  const DatetimeLocalCodec = NS.DatetimeLocalCodec;

  const recordsUrl = () => kintone.api.url('/k/v1/records.json', true);
  // User API(kintone自身が提供するcybozu.com共通のユーザー/組織/グループ情報API)。
  // idea.md「実装で確認した仕様」の通り、kintone.api()はkintone REST APIだけでなくUser APIも
  // 実行できる(「kintone REST APIリクエストを送信する」で確認済み)。生のfetch/XHRは使わない。
  const organizationsUrl = () =>
    kintone.api.url('/v1/organizations.json', true);
  const groupsUrl = () => kintone.api.url('/v1/groups.json', true);
  // 所属メンバー取得はエンドポイント名が単数形(organization/group)である点に注意
  // (idea.md「実装で確認した仕様」参照、他のUser APIと違いcode1件ずつしか指定できない)。
  const organizationUsersUrl = () =>
    kintone.api.url('/v1/organization/users.json', true);
  const groupUsersUrl = () => kintone.api.url('/v1/group/users.json', true);

  const postRecordsBatch = (appId, records) =>
    kintone.api(recordsUrl(), 'POST', { app: appId, records });

  const PAGE_SIZE = 100;

  // offset/sizeによるページングを逐次(並列でない)実行し全件を集める汎用ヘルパー
  // (secureCodingGuideline「短時間で大量のリクエスト送信を避ける」「並列で実行するのを
  // なるべく避ける」に従う)。
  const fetchAllPages = async (fetchPage) => {
    let offset = 0;
    let all = [];

    while (true) {
      const page = await fetchPage(offset, PAGE_SIZE);
      all = all.concat(page);
      if (page.length < PAGE_SIZE) {
        break;
      }
      offset += PAGE_SIZE;
    }
    return all;
  };

  const fetchAllOrganizations = () =>
    fetchAllPages(async (offset, size) => {
      const resp = await kintone.api(organizationsUrl(), 'GET', {
        offset,
        size,
      });
      return resp.organizations;
    });
  const fetchAllGroups = () =>
    fetchAllPages(async (offset, size) => {
      const resp = await kintone.api(groupsUrl(), 'GET', { offset, size });
      return resp.groups;
    });
  const fetchOrganizationMembers = (code) =>
    kintone.api(organizationUsersUrl(), 'GET', { code });
  const fetchGroupMembers = (code) =>
    kintone.api(groupUsersUrl(), 'GET', { code });

  // 保存前に画面遷移・タブを閉じられて処理が中断されるのを防ぐ(bulk_field_updateと同じ対策)。
  let unloadGuard = null;
  const enableUnloadGuard = () => {
    unloadGuard = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    global.addEventListener('beforeunload', unloadGuard);
  };
  const disableUnloadGuard = () => {
    if (unloadGuard) {
      global.removeEventListener('beforeunload', unloadGuard);
      unloadGuard = null;
    }
  };

  // ---- 対象者(ユーザー/組織/グループ)ピッカー ----------------------------------------

  // entities(実行時に取得する{code,name}の配列)から、絞り込み欄付きの複数選択チェックボックス
  // リストを組み立てる。ユーザー/組織/グループのいずれも同じUIで扱える(idea.md「対象者フィールド
  // と展開方式」)。User APIには名前の部分一致検索が無いため、全件取得後にクライアント側で絞り込む。
  const buildEntityPicker = (loadEntities) => {
    const wrapperEl = document.createElement('div');
    wrapperEl.className = 'brc-entity-picker';

    const statusEl = document.createElement('p');
    statusEl.className = 'brc-picker-status';
    statusEl.textContent = '読み込み中...';
    wrapperEl.appendChild(statusEl);

    const filterEl = document.createElement('input');
    filterEl.type = 'text';
    filterEl.className = 'brc-picker-filter';
    filterEl.placeholder = '名前・コードで絞り込み';
    filterEl.hidden = true;
    wrapperEl.appendChild(filterEl);

    const listEl = document.createElement('div');
    listEl.className = 'brc-picker-list';
    wrapperEl.appendChild(listEl);

    let rows = [];

    const renderList = (entities) => {
      listEl.innerHTML = '';
      rows = entities.map((entity) => {
        const rowEl = document.createElement('label');
        rowEl.className = 'brc-picker-row';
        const checkboxEl = document.createElement('input');
        checkboxEl.type = 'checkbox';
        checkboxEl.value = entity.code;
        rowEl.appendChild(checkboxEl);
        rowEl.appendChild(
          document.createTextNode(
            `${entity.name || entity.code}(${entity.code})`,
          ),
        );
        listEl.appendChild(rowEl);
        return { entity, checkboxEl, rowEl };
      });
    };

    filterEl.addEventListener('input', () => {
      const keyword = filterEl.value.trim().toLowerCase();
      rows.forEach(({ entity, rowEl }) => {
        const haystack = `${entity.name || ''} ${entity.code}`.toLowerCase();
        rowEl.style.display = haystack.includes(keyword) ? '' : 'none';
      });
    });

    let loadPromise = null;
    const ensureLoaded = () => {
      if (!loadPromise) {
        loadPromise = loadEntities()
          .then((entities) => {
            statusEl.hidden = true;
            filterEl.hidden = false;
            renderList(entities);
            return entities;
          })
          .catch((err) => {
            statusEl.textContent = `一覧の取得に失敗しました: ${err.message}`;
            renderList([]);
            return [];
          });
      }
      return loadPromise;
    };

    const getSelectedEntities = () =>
      rows.filter((r) => r.checkboxEl.checked).map((r) => r.entity);

    return { el: wrapperEl, ensureLoaded, getSelectedEntities };
  };

  const sortByName = (entities) =>
    entities
      .slice()
      .sort((a, b) =>
        (a.entity.name || a.entity.code).localeCompare(
          b.entity.name || b.entity.code,
          'ja',
        ),
      );

  // 組織は親子階層(parentCode)を持ちうるため、大きな組織でもフラットな一覧に埋もれず
  // 目的の組織を辿れるよう、開閉式のツリーとして表示する(ユーザーからの要望「組織選択も
  // 階層式で選べるようにしたい、大きな組織もあるから」)。外部インターフェースは
  // buildEntityPicker()と同じ({ el, ensureLoaded, getSelectedEntities })にしているため、
  // 組織選択が必要などの箇所でもそのまま差し替えて使える。
  const buildOrganizationPicker = (loadOrganizations) => {
    const wrapperEl = document.createElement('div');
    wrapperEl.className = 'brc-entity-picker';

    const statusEl = document.createElement('p');
    statusEl.className = 'brc-picker-status';
    statusEl.textContent = '読み込み中...';
    wrapperEl.appendChild(statusEl);

    const filterEl = document.createElement('input');
    filterEl.type = 'text';
    filterEl.className = 'brc-picker-filter';
    filterEl.placeholder =
      '組織名・コードで絞り込み(一致すると自動的に展開します)';
    filterEl.hidden = true;
    wrapperEl.appendChild(filterEl);

    const treeEl = document.createElement('div');
    treeEl.className = 'brc-org-tree';
    wrapperEl.appendChild(treeEl);

    let allNodes = [];

    const buildForest = (organizations) => {
      const byCode = new Map(
        organizations.map((org) => [org.code, { entity: org, children: [] }]),
      );
      const roots = [];
      byCode.forEach((node) => {
        const parentNode = byCode.get(node.entity.parentCode);
        if (parentNode) {
          parentNode.children.push(node);
        } else {
          roots.push(node);
        }
      });
      return roots;
    };

    const matchesSelf = (node, keyword) =>
      `${node.entity.name || ''} ${node.entity.code}`
        .toLowerCase()
        .includes(keyword);

    // 自分自身が一致するか、子孫のいずれかが一致すれば真(祖先ノードを表示・自動展開するため
    // 再帰的に子孫全体を見る)。
    const matchesSelfOrDescendant = (node, keyword) =>
      matchesSelf(node, keyword) ||
      node.children.some((child) => matchesSelfOrDescendant(child, keyword));

    const applyFilter = () => {
      const keyword = filterEl.value.trim().toLowerCase();
      allNodes.forEach((node) => {
        if (!keyword) {
          node.rowEl.hidden = false;
          node.childrenEl.hidden = !node.expanded;
          if (node.toggleEl) {
            node.toggleEl.textContent = node.expanded ? '▼' : '▶';
          }
          return;
        }
        const hasMatch = matchesSelfOrDescendant(node, keyword);
        node.rowEl.hidden = !hasMatch;
        // 一致した子孫を見せるため、キーワード入力中は自動的に展開する。
        node.childrenEl.hidden = !hasMatch;
        if (node.toggleEl) {
          node.toggleEl.textContent = '▼';
        }
      });
    };

    const buildNodeEl = (node, depth) => {
      node.expanded = depth === 0;

      const rowEl = document.createElement('div');
      rowEl.className = 'brc-org-tree-row';
      rowEl.style.paddingLeft = `${depth * 1.25}em`;

      let toggleEl = null;
      if (node.children.length > 0) {
        toggleEl = document.createElement('button');
        toggleEl.type = 'button';
        toggleEl.className = 'brc-org-tree-toggle';
        toggleEl.textContent = node.expanded ? '▼' : '▶';
        toggleEl.addEventListener('click', () => {
          node.expanded = !node.expanded;
          applyFilter();
        });
        rowEl.appendChild(toggleEl);
      } else {
        const spacerEl = document.createElement('span');
        spacerEl.className = 'brc-org-tree-spacer';
        rowEl.appendChild(spacerEl);
      }

      const labelEl = document.createElement('label');
      labelEl.className = 'brc-picker-row';
      const checkboxEl = document.createElement('input');
      checkboxEl.type = 'checkbox';
      checkboxEl.value = node.entity.code;
      labelEl.appendChild(checkboxEl);
      labelEl.appendChild(
        document.createTextNode(
          `${node.entity.name || node.entity.code}(${node.entity.code})`,
        ),
      );
      rowEl.appendChild(labelEl);

      node.rowEl = rowEl;
      node.checkboxEl = checkboxEl;
      node.toggleEl = toggleEl;
      allNodes.push(node);

      const childrenEl = document.createElement('div');
      childrenEl.className = 'brc-org-tree-children';
      childrenEl.hidden = !node.expanded;
      sortByName(node.children).forEach((child) => {
        childrenEl.appendChild(buildNodeEl(child, depth + 1));
      });
      node.childrenEl = childrenEl;

      const containerEl = document.createElement('div');
      containerEl.appendChild(rowEl);
      containerEl.appendChild(childrenEl);
      return containerEl;
    };

    filterEl.addEventListener('input', applyFilter);

    let loadPromise = null;
    const ensureLoaded = () => {
      if (!loadPromise) {
        loadPromise = loadOrganizations()
          .then((organizations) => {
            statusEl.hidden = true;
            filterEl.hidden = false;
            allNodes = [];
            treeEl.innerHTML = '';
            const roots = buildForest(organizations);
            sortByName(roots).forEach((root) => {
              treeEl.appendChild(buildNodeEl(root, 0));
            });
            return organizations;
          })
          .catch((err) => {
            statusEl.textContent = `一覧の取得に失敗しました: ${err.message}`;
            return [];
          });
      }
      return loadPromise;
    };

    const getSelectedEntities = () =>
      allNodes.filter((n) => n.checkboxEl.checked).map((n) => n.entity);

    return { el: wrapperEl, ensureLoaded, getSelectedEntities };
  };

  // USER_SELECT型の対象者フィールドで「組織で絞り込んでユーザーを選択」モードに使う。
  // 全ユーザーを一度に一覧表示すると大規模な環境では使いづらい・重いという指摘を受け
  // (ユーザーからのフィードバック)、まず組織を選び、その所属メンバーの中からさらに個別に
  // ユーザーを選べる2段階のUIにしている(所属ユーザー全員を自動的に対象にする
  // 「組織を選んで所属ユーザーに展開」モードとは異なり、こちらは個別選択が前提)。
  const buildScopedUserPicker = () => {
    const wrapperEl = document.createElement('div');
    wrapperEl.className = 'brc-scoped-user-picker';

    wrapperEl.appendChild(buildSubHeading('① 組織で絞り込む'));
    const orgPicker = buildOrganizationPicker(fetchAllOrganizations);
    orgPicker.ensureLoaded();
    wrapperEl.appendChild(orgPicker.el);

    wrapperEl.appendChild(buildSubHeading('② 対象のユーザーを選択'));
    const memberStatusEl = document.createElement('p');
    memberStatusEl.className = 'brc-picker-status';
    memberStatusEl.textContent = '組織を選択してください。';
    wrapperEl.appendChild(memberStatusEl);

    const memberListWrapperEl = document.createElement('div');
    wrapperEl.appendChild(memberListWrapperEl);

    let memberPicker = null;

    const refreshMembers = async () => {
      const selectedOrgs = orgPicker.getSelectedEntities();
      memberListWrapperEl.innerHTML = '';
      memberPicker = null;
      if (selectedOrgs.length === 0) {
        memberStatusEl.hidden = false;
        memberStatusEl.textContent = '組織を選択してください。';
        return;
      }
      memberStatusEl.hidden = false;
      memberStatusEl.textContent = '読み込み中...';
      const responses = [];
      // 選択組織の件数分、逐次呼び出す(並列実行を避ける)。
      for (const org of selectedOrgs) {
        responses.push(await fetchOrganizationMembers(org.code));
      }
      const members = AssigneeNormalizer.flattenOrganizationMembers(responses);
      memberStatusEl.hidden = true;
      const picker = buildEntityPicker(() => Promise.resolve(members));
      memberListWrapperEl.appendChild(picker.el);
      await picker.ensureLoaded();
      memberPicker = picker;
    };
    // orgPicker.el配下のチェックボックスのchangeイベントが親要素までバブリングするのを利用する。
    orgPicker.el.addEventListener('change', () => {
      refreshMembers();
    });

    return {
      el: wrapperEl,
      getApproxCount: () =>
        memberPicker ? memberPicker.getSelectedEntities().length : 0,
      getEntries: async () =>
        memberPicker
          ? AssigneeNormalizer.normalizeUserSelection(
              memberPicker.getSelectedEntities(),
            )
          : [],
    };
  };

  // 対象者フィールドの型に応じたUIとgetEntries()(実行時の非同期展開)を組み立てる。
  const buildAssigneeSection = (assigneeField) => {
    const wrapperEl = document.createElement('div');
    wrapperEl.className = 'brc-section brc-assignee-section';
    const titleEl = document.createElement('h3');
    titleEl.textContent = `対象者(${assigneeField.label})`;
    wrapperEl.appendChild(titleEl);

    if (assigneeField.type === 'ORGANIZATION_SELECT') {
      const picker = buildOrganizationPicker(fetchAllOrganizations);
      picker.ensureLoaded();
      wrapperEl.appendChild(picker.el);
      return {
        el: wrapperEl,
        getApproxCount: () => picker.getSelectedEntities().length,
        getEntries: async () =>
          AssigneeNormalizer.normalizeOrganizationSelection(
            picker.getSelectedEntities(),
          ),
      };
    }

    if (assigneeField.type === 'GROUP_SELECT') {
      const picker = buildEntityPicker(fetchAllGroups);
      picker.ensureLoaded();
      wrapperEl.appendChild(picker.el);
      return {
        el: wrapperEl,
        getApproxCount: () => picker.getSelectedEntities().length,
        getEntries: async () =>
          AssigneeNormalizer.normalizeGroupSelection(
            picker.getSelectedEntities(),
          ),
      };
    }

    // USER_SELECT: 組織で絞り込んで個別選択/組織メンバー全員展開/グループメンバー全員展開の
    // 3方式から選べる(idea.md「対象者フィールドと展開方式」)。全ユーザーをそのまま一覧表示
    // すると大規模な環境では使いづらいため、個別選択したい場合もまず組織で絞り込む設計にしている
    // (ユーザーからのフィードバック、buildScopedUserPicker参照)。
    const modeWrapperEl = document.createElement('div');
    modeWrapperEl.className = 'brc-assignee-mode';
    const MODES = [
      { value: 'ORG_SCOPED_USERS', label: '組織で絞り込んでユーザーを選択' },
      { value: 'ORG_MEMBERS', label: '組織を選んで所属ユーザー全員に展開' },
      {
        value: 'GROUP_MEMBERS',
        label: 'グループを選んで所属ユーザー全員に展開',
      },
    ];
    const radioEls = MODES.map((mode, index) => {
      const labelEl = document.createElement('label');
      labelEl.className = 'brc-assignee-mode-option';
      const radioEl = document.createElement('input');
      radioEl.type = 'radio';
      radioEl.name = `brc-assignee-mode-${assigneeField.code}`;
      radioEl.value = mode.value;
      radioEl.checked = index === 0;
      labelEl.appendChild(radioEl);
      labelEl.appendChild(document.createTextNode(mode.label));
      modeWrapperEl.appendChild(labelEl);
      return radioEl;
    });
    wrapperEl.appendChild(modeWrapperEl);

    const scopedUserPicker = buildScopedUserPicker();
    const orgPicker = buildOrganizationPicker(fetchAllOrganizations);
    const groupPicker = buildEntityPicker(fetchAllGroups);
    orgPicker.el.hidden = true;
    groupPicker.el.hidden = true;
    wrapperEl.append(scopedUserPicker.el, orgPicker.el, groupPicker.el);

    const currentMode = () => radioEls.find((r) => r.checked).value;

    radioEls.forEach((radioEl) => {
      radioEl.addEventListener('change', () => {
        const mode = currentMode();
        scopedUserPicker.el.hidden = mode !== 'ORG_SCOPED_USERS';
        orgPicker.el.hidden = mode !== 'ORG_MEMBERS';
        groupPicker.el.hidden = mode !== 'GROUP_MEMBERS';
        if (mode === 'ORG_MEMBERS') {
          orgPicker.ensureLoaded();
        } else if (mode === 'GROUP_MEMBERS') {
          groupPicker.ensureLoaded();
        }
      });
    });

    return {
      el: wrapperEl,
      // 組織/グループのメンバー展開は実際にAPIを呼ぶまで正確な人数が分からないため、
      // ここでは選択した組織/グループの件数を近似値として表示する(実際の件数はOK確定時に
      // 所属メンバーAPIを呼び出して確定する。idea.md「実行時UX」参照)。
      getApproxCount: () => {
        const mode = currentMode();
        if (mode === 'ORG_SCOPED_USERS') {
          return scopedUserPicker.getApproxCount();
        }
        if (mode === 'ORG_MEMBERS') {
          return orgPicker.getSelectedEntities().length;
        }
        return groupPicker.getSelectedEntities().length;
      },
      getEntries: async () => {
        const mode = currentMode();
        if (mode === 'ORG_SCOPED_USERS') {
          return scopedUserPicker.getEntries();
        }
        if (mode === 'ORG_MEMBERS') {
          const responses = [];
          // 選択組織の件数分、逐次呼び出す(並列実行を避ける)。
          for (const org of orgPicker.getSelectedEntities()) {
            responses.push(await fetchOrganizationMembers(org.code));
          }
          return AssigneeNormalizer.flattenOrganizationMembers(responses);
        }
        const responses = [];
        for (const group of groupPicker.getSelectedEntities()) {
          responses.push(await fetchGroupMembers(group.code));
        }
        return AssigneeNormalizer.flattenGroupMembers(responses);
      },
    };
  };

  // ---- 繰り返し(定例)日程 -------------------------------------------------------------

  const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];
  const FREQUENCY_LABELS = {
    ONCE: '単発',
    DAILY: '毎日',
    WEEKLY: '毎週',
    MONTHLY: '毎月',
  };

  const parseMonthDays = (text) =>
    (text || '')
      .split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => Number.isInteger(n) && n >= 1 && n <= 31);

  const buildSubHeading = (text) => {
    const el = document.createElement('div');
    el.className = 'brc-sub-heading';
    el.textContent = text;
    return el;
  };

  const buildRecurrenceSection = (dateField, endDateField) => {
    const wrapperEl = document.createElement('div');
    wrapperEl.className = 'brc-section brc-recurrence-section';
    const titleEl = document.createElement('h3');
    titleEl.textContent = `繰り返し日程(${dateField.label})`;
    wrapperEl.appendChild(titleEl);
    wrapperEl.appendChild(
      buildSubHeading(
        dateField.type === 'DATETIME'
          ? '日付(まず、どの日を対象にするか決めます)'
          : '日付',
      ),
    );

    const startDateRowEl = document.createElement('label');
    startDateRowEl.className = 'brc-field-row';
    startDateRowEl.appendChild(document.createTextNode('開始日'));
    const startDateEl = document.createElement('input');
    startDateEl.type = 'date';
    startDateRowEl.appendChild(startDateEl);
    wrapperEl.appendChild(startDateRowEl);

    const frequencyRowEl = document.createElement('label');
    frequencyRowEl.className = 'brc-field-row';
    frequencyRowEl.appendChild(document.createTextNode('頻度'));
    const frequencyEl = document.createElement('select');
    Object.keys(FREQUENCY_LABELS).forEach((value) => {
      const optionEl = document.createElement('option');
      optionEl.value = value;
      optionEl.textContent = FREQUENCY_LABELS[value];
      frequencyEl.appendChild(optionEl);
    });
    frequencyRowEl.appendChild(frequencyEl);
    wrapperEl.appendChild(frequencyRowEl);

    const weekdaysWrapperEl = document.createElement('div');
    weekdaysWrapperEl.className = 'brc-weekdays';
    const weekdaysCaptionEl = document.createElement('span');
    weekdaysCaptionEl.className = 'brc-weekdays-caption';
    weekdaysCaptionEl.textContent = '曜日:';
    weekdaysWrapperEl.appendChild(weekdaysCaptionEl);
    const weekdayCheckboxEls = WEEKDAY_LABELS.map((label, value) => {
      const labelEl = document.createElement('label');
      const checkboxEl = document.createElement('input');
      checkboxEl.type = 'checkbox';
      checkboxEl.value = String(value);
      labelEl.appendChild(checkboxEl);
      labelEl.appendChild(document.createTextNode(label));
      weekdaysWrapperEl.appendChild(labelEl);
      return checkboxEl;
    });
    wrapperEl.appendChild(weekdaysWrapperEl);

    const monthDaysRowEl = document.createElement('label');
    monthDaysRowEl.className = 'brc-field-row';
    monthDaysRowEl.appendChild(
      document.createTextNode('毎月の何日か(カンマ区切りで複数可、例: 5, 20)'),
    );
    const monthDaysEl = document.createElement('input');
    monthDaysEl.type = 'text';
    monthDaysRowEl.appendChild(monthDaysEl);
    wrapperEl.appendChild(monthDaysRowEl);

    const endConditionCaptionEl = buildSubHeading('終了条件(どちらか一方)');
    wrapperEl.appendChild(endConditionCaptionEl);

    const endConditionWrapperEl = document.createElement('div');
    endConditionWrapperEl.className = 'brc-end-condition';
    const countRadioEl = document.createElement('input');
    countRadioEl.type = 'radio';
    countRadioEl.name = `brc-end-condition-${dateField.code}`;
    countRadioEl.value = 'COUNT';
    countRadioEl.checked = true;
    const countLabelEl = document.createElement('label');
    countLabelEl.appendChild(countRadioEl);
    countLabelEl.appendChild(document.createTextNode('回数'));
    const countInputEl = document.createElement('input');
    countInputEl.type = 'number';
    countInputEl.min = '1';
    countInputEl.value = '1';
    countLabelEl.appendChild(countInputEl);
    endConditionWrapperEl.appendChild(countLabelEl);

    const endDateRadioEl = document.createElement('input');
    endDateRadioEl.type = 'radio';
    endDateRadioEl.name = `brc-end-condition-${dateField.code}`;
    endDateRadioEl.value = 'END_DATE';
    const endDateLabelEl = document.createElement('label');
    endDateLabelEl.appendChild(endDateRadioEl);
    endDateLabelEl.appendChild(document.createTextNode('終了日'));
    const endDateInputEl = document.createElement('input');
    endDateInputEl.type = 'date';
    endDateLabelEl.appendChild(endDateInputEl);
    endConditionWrapperEl.appendChild(endDateLabelEl);

    wrapperEl.appendChild(endConditionWrapperEl);

    const applyVisibility = () => {
      const frequency = frequencyEl.value;
      weekdaysWrapperEl.hidden = frequency !== 'WEEKLY';
      monthDaysRowEl.hidden = frequency !== 'MONTHLY';
      endConditionWrapperEl.hidden = frequency === 'ONCE';
      endConditionCaptionEl.hidden = frequency === 'ONCE';
    };
    applyVisibility();
    frequencyEl.addEventListener('change', applyVisibility);

    const getDayRule = () => {
      const rule = {
        startDate: startDateEl.value,
        frequency: frequencyEl.value,
      };
      if (rule.frequency === 'WEEKLY') {
        rule.weekdays = weekdayCheckboxEls
          .filter((c) => c.checked)
          .map((c) => Number(c.value));
      }
      if (rule.frequency === 'MONTHLY') {
        rule.monthDays = parseMonthDays(monthDaysEl.value);
      }
      if (rule.frequency !== 'ONCE') {
        rule.endCondition = countRadioEl.checked
          ? { type: 'COUNT', count: parseInt(countInputEl.value, 10) }
          : { type: 'END_DATE', endDate: endDateInputEl.value };
      }
      return rule;
    };

    // DATETIME型の繰り返し用フィールドの場合のみ、日付の繰り返しに加えて時刻の指定方法
    // (固定の時刻 / 時間帯を一定間隔で分割)を選べるようにする(idea.md「時刻の繰り返し
    // (会議室予約枠等)」参照)。会議室予約枠のような「平日9-17時を1時間ごとに分割」という
    // 使い方は、この時刻セクションと上記の日付の繰り返し(毎週+曜日複数選択)を組み合わせて
    // 実現する。
    let timeSection = null;
    if (dateField.type === 'DATETIME') {
      const timeWrapperEl = document.createElement('div');
      timeWrapperEl.className = 'brc-time-section';
      timeWrapperEl.appendChild(
        buildSubHeading('時刻(次に、その日の何時に作るか決めます)'),
      );

      const timeModeWrapperEl = document.createElement('div');
      timeModeWrapperEl.className = 'brc-time-mode';
      const fixedModeRadioEl = document.createElement('input');
      fixedModeRadioEl.type = 'radio';
      fixedModeRadioEl.name = `brc-time-mode-${dateField.code}`;
      fixedModeRadioEl.value = 'FIXED';
      fixedModeRadioEl.checked = true;
      const fixedModeLabelEl = document.createElement('label');
      fixedModeLabelEl.appendChild(fixedModeRadioEl);
      fixedModeLabelEl.appendChild(document.createTextNode('固定の時刻'));
      timeModeWrapperEl.appendChild(fixedModeLabelEl);

      const rangeModeRadioEl = document.createElement('input');
      rangeModeRadioEl.type = 'radio';
      rangeModeRadioEl.name = `brc-time-mode-${dateField.code}`;
      rangeModeRadioEl.value = 'RANGE';
      const rangeModeLabelEl = document.createElement('label');
      rangeModeLabelEl.appendChild(rangeModeRadioEl);
      rangeModeLabelEl.appendChild(
        document.createTextNode('時間帯を一定間隔で分割'),
      );
      timeModeWrapperEl.appendChild(rangeModeLabelEl);
      timeWrapperEl.appendChild(timeModeWrapperEl);

      const fixedTimeRowEl = document.createElement('label');
      fixedTimeRowEl.className = 'brc-field-row';
      fixedTimeRowEl.appendChild(
        document.createTextNode(endDateField ? '開始時刻' : '時刻'),
      );
      const fixedTimeEl = document.createElement('input');
      fixedTimeEl.type = 'time';
      fixedTimeRowEl.appendChild(fixedTimeEl);
      timeWrapperEl.appendChild(fixedTimeRowEl);

      // 終了日時フィールドが設定されている場合、「固定の時刻」モードでは終了時刻も
      // 別途入力する(idea.md「終了日時フィールド」参照)。「時間帯を一定間隔で分割」モードは
      // 各枠の終了時刻を開始時刻+間隔から自動計算するため、入力欄は不要。
      let fixedEndTimeEl = null;
      let fixedEndTimeRowEl = null;
      if (endDateField) {
        fixedEndTimeRowEl = document.createElement('label');
        fixedEndTimeRowEl.className = 'brc-field-row';
        fixedEndTimeRowEl.appendChild(document.createTextNode('終了時刻'));
        fixedEndTimeEl = document.createElement('input');
        fixedEndTimeEl.type = 'time';
        fixedEndTimeRowEl.appendChild(fixedEndTimeEl);
        timeWrapperEl.appendChild(fixedEndTimeRowEl);
      }

      const rangeWrapperEl = document.createElement('div');
      rangeWrapperEl.className = 'brc-time-range';
      const startTimeRowEl = document.createElement('label');
      startTimeRowEl.appendChild(document.createTextNode('開始時刻'));
      const startTimeEl = document.createElement('input');
      startTimeEl.type = 'time';
      startTimeRowEl.appendChild(startTimeEl);
      rangeWrapperEl.appendChild(startTimeRowEl);

      const endTimeRowEl = document.createElement('label');
      endTimeRowEl.appendChild(
        document.createTextNode('終了時刻(この時刻は含みません)'),
      );
      const endTimeEl = document.createElement('input');
      endTimeEl.type = 'time';
      endTimeRowEl.appendChild(endTimeEl);
      rangeWrapperEl.appendChild(endTimeRowEl);

      const intervalRowEl = document.createElement('label');
      intervalRowEl.appendChild(document.createTextNode('間隔(分)'));
      const intervalEl = document.createElement('input');
      intervalEl.type = 'number';
      intervalEl.min = '1';
      intervalEl.value = '60';
      intervalRowEl.appendChild(intervalEl);
      rangeWrapperEl.appendChild(intervalRowEl);
      timeWrapperEl.appendChild(rangeWrapperEl);

      const applyTimeModeVisibility = () => {
        const isRange = rangeModeRadioEl.checked;
        fixedTimeRowEl.hidden = isRange;
        if (fixedEndTimeRowEl) {
          fixedEndTimeRowEl.hidden = isRange;
        }
        rangeWrapperEl.hidden = !isRange;
      };
      applyTimeModeVisibility();
      fixedModeRadioEl.addEventListener('change', applyTimeModeVisibility);
      rangeModeRadioEl.addEventListener('change', applyTimeModeVisibility);

      wrapperEl.appendChild(timeWrapperEl);

      const getStartTimes = () =>
        rangeModeRadioEl.checked
          ? TimeSlotExpander.expandTimeSlots({
              startTime: startTimeEl.value,
              endTime: endTimeEl.value,
              intervalMinutes: parseInt(intervalEl.value, 10),
            })
          : (() => {
              if (!fixedTimeEl.value) {
                throw new Error('時刻を指定してください。');
              }
              return [fixedTimeEl.value];
            })();

      // 終了日時フィールドが設定されている場合の、開始時刻ごとの終了時刻。
      // 「時間帯を一定間隔で分割」モードは各枠の開始時刻+間隔、「固定の時刻」モードは
      // 別途入力した終了時刻を使う(idea.md「終了日時フィールド」参照)。
      const getEndTimes = (startTimes) => {
        if (!endDateField) {
          return null;
        }
        if (rangeModeRadioEl.checked) {
          const intervalMinutes = parseInt(intervalEl.value, 10);
          return startTimes.map((t) =>
            TimeSlotExpander.shiftTime(t, intervalMinutes),
          );
        }
        if (!fixedEndTimeEl.value) {
          throw new Error('終了時刻を指定してください。');
        }
        if (fixedEndTimeEl.value <= fixedTimeEl.value) {
          throw new Error('終了時刻は開始時刻より後にしてください。');
        }
        return [fixedEndTimeEl.value];
      };

      timeSection = { getStartTimes, getEndTimes };
    }

    // dates: DATE型なら'YYYY-MM-DD'をそのまま、DATETIME型なら日付×時刻の直積をUTCの
    // ISO8601文字列に変換したものをvaluesとして返す(record-payload-builder.jsがそのまま
    // フィールド値として使う)。labelsは最終確認ダイアログのプレビュー表示専用で、DATETIME型
    // の場合はローカル時刻のまま人が読みやすい形式にしている(UTC表記だと入力した時刻と
    // ずれて見えて混乱するため)。endDateFieldが設定されている場合はendValues/endLabelsも
    // 同じ添字で対になった終了日時を返す(record-payload-builder.jsのdates.endValues参照)。
    const getValues = () => {
      const dates = RecurrenceExpander.expandRecurrence(getDayRule());
      if (!timeSection) {
        return { values: dates, labels: dates };
      }
      const startTimes = timeSection.getStartTimes();
      const endTimes = timeSection.getEndTimes(startTimes);

      const toLocalDatetimes = (times) =>
        dates.flatMap((date) => times.map((time) => `${date}T${time}`));

      const localStarts = toLocalDatetimes(startTimes);
      const result = {
        values: localStarts.map((local) =>
          DatetimeLocalCodec.encodeDatetimeLocal(local),
        ),
        labels: localStarts.map((local) => local.replace('T', ' ')),
      };
      if (endTimes) {
        const localEnds = toLocalDatetimes(endTimes);
        result.endValues = localEnds.map((local) =>
          DatetimeLocalCodec.encodeDatetimeLocal(local),
        );
        result.endLabels = localEnds.map((local) => local.replace('T', ' '));
      }
      return result;
    };

    return {
      el: wrapperEl,
      getApproxCount: () => {
        try {
          return getValues().values.length;
        } catch {
          return null;
        }
      },
      getValues,
    };
  };

  // ---- テンプレート対象フィールドの入力欄 -----------------------------------------------

  const sortedOptionEntries = (field) =>
    Object.entries(field.options || {}).sort(
      (a, b) => Number(a[1].index) - Number(b[1].index),
    );

  const buildSingleChoiceControl = (field) => {
    const selectEl = document.createElement('select');
    selectEl.className = 'kintoneplugin-select';
    const blankOptionEl = document.createElement('option');
    blankOptionEl.value = '';
    blankOptionEl.textContent = '(選択してください)';
    selectEl.appendChild(blankOptionEl);
    sortedOptionEntries(field).forEach(([key, opt]) => {
      const optionEl = document.createElement('option');
      optionEl.value = key;
      optionEl.textContent = opt.label;
      selectEl.appendChild(optionEl);
    });
    return {
      el: selectEl,
      read: () => selectEl.value,
      isEmpty: (v) => v === '',
    };
  };

  const buildMultiChoiceControl = (field) => {
    const wrapperEl = document.createElement('div');
    wrapperEl.className = 'brc-checkbox-group';
    const checkboxEls = [];
    sortedOptionEntries(field).forEach(([key, opt]) => {
      const labelEl = document.createElement('label');
      const checkboxEl = document.createElement('input');
      checkboxEl.type = 'checkbox';
      checkboxEl.value = key;
      checkboxEls.push(checkboxEl);
      labelEl.appendChild(checkboxEl);
      labelEl.appendChild(document.createTextNode(opt.label));
      wrapperEl.appendChild(labelEl);
    });
    return {
      el: wrapperEl,
      read: () => checkboxEls.filter((c) => c.checked).map((c) => c.value),
      isEmpty: (v) => v.length === 0,
    };
  };

  const buildTextareaControl = () => {
    const textareaEl = document.createElement('textarea');
    textareaEl.className = 'kintoneplugin-input-text';
    textareaEl.rows = 2;
    return {
      el: textareaEl,
      read: () => textareaEl.value,
      isEmpty: (v) => v === '',
    };
  };

  const buildDateOrTimeControl = (kind) => {
    const inputEl = document.createElement('input');
    inputEl.type = kind === 'DATE' ? 'date' : 'time';
    return { el: inputEl, read: () => inputEl.value, isEmpty: (v) => v === '' };
  };

  const buildDatetimeControl = () => {
    const inputEl = document.createElement('input');
    inputEl.type = 'datetime-local';
    return {
      el: inputEl,
      read: () => DatetimeLocalCodec.encodeDatetimeLocal(inputEl.value),
      isEmpty: (v) => v === '',
    };
  };

  const buildTextControl = () => {
    const inputEl = document.createElement('input');
    inputEl.type = 'text';
    inputEl.className = 'kintoneplugin-input-text';
    return { el: inputEl, read: () => inputEl.value, isEmpty: (v) => v === '' };
  };

  const CONTROL_BUILDERS = {
    SINGLE_CHOICE: buildSingleChoiceControl,
    MULTI_CHOICE: buildMultiChoiceControl,
    TEXTAREA: buildTextareaControl,
    DATE: () => buildDateOrTimeControl('DATE'),
    TIME: () => buildDateOrTimeControl('TIME'),
    DATETIME: buildDatetimeControl,
  };

  const buildTemplateControl = (field) => {
    const kind = FieldEligibility.inputKindOf(field);
    const builder = CONTROL_BUILDERS[kind] || buildTextControl;
    return { kind, ...builder(field) };
  };

  const buildTemplateRow = (field, readers) => {
    const rowEl = document.createElement('div');
    rowEl.className = 'brc-template-row';
    const labelEl = document.createElement('div');
    labelEl.className = 'brc-field-label';
    labelEl.textContent = field.required ? `${field.label}(必須)` : field.label;
    rowEl.appendChild(labelEl);

    const control = buildTemplateControl(field);
    readers[field.code] = { field, ...control };
    rowEl.appendChild(control.el);
    return rowEl;
  };

  // ---- Dialog 1: 一括作成の内容を入力 ---------------------------------------------------

  const showInputDialog = async (
    platform,
    templateFields,
    assigneeField,
    dateField,
    endDateField,
  ) => {
    const wrapperEl = document.createElement('div');
    wrapperEl.className = 'brc-dialog-body';

    const messageEl = document.createElement('p');
    messageEl.textContent =
      '作成するレコードの内容を入力してください。「次へ」を押すと、実際に作成されるレコードの一覧(件数・対象者・日時)を確認してから実行できます。';
    wrapperEl.appendChild(messageEl);

    const templateSectionEl = document.createElement('div');
    templateSectionEl.className = 'brc-section';
    if (templateFields.length > 0) {
      const templateHeadingEl = document.createElement('h3');
      templateHeadingEl.textContent = '入力する値(すべてのレコードに共通)';
      templateSectionEl.appendChild(templateHeadingEl);
    }
    const readers = {};
    templateFields.forEach((field) => {
      templateSectionEl.appendChild(buildTemplateRow(field, readers));
    });
    wrapperEl.appendChild(templateSectionEl);

    const assigneeSection = assigneeField
      ? buildAssigneeSection(assigneeField)
      : null;
    if (assigneeSection) {
      wrapperEl.appendChild(assigneeSection.el);
    }

    const recurrenceSection = dateField
      ? buildRecurrenceSection(dateField, endDateField)
      : null;
    if (recurrenceSection) {
      wrapperEl.appendChild(recurrenceSection.el);
    }

    const countEl = document.createElement('p');
    countEl.className = 'brc-count-display';
    wrapperEl.appendChild(countEl);

    const errorEl = document.createElement('p');
    errorEl.className = 'brc-error';
    errorEl.hidden = true;
    wrapperEl.appendChild(errorEl);

    const updateApproxCount = () => {
      const assigneeCount = assigneeSection
        ? assigneeSection.getApproxCount()
        : undefined;
      const dateCount = recurrenceSection
        ? recurrenceSection.getApproxCount()
        : undefined;
      if (dateCount === null) {
        countEl.textContent =
          '作成予定件数: 繰り返し日程の入力を確認してください';
        countEl.classList.remove('brc-count-over');
        return;
      }
      const estimate = RecordCountEstimator.estimateRecordCount({
        assigneeCount,
        dateCount,
      });
      countEl.textContent = `作成予定件数: ${estimate.count}件(上限${estimate.limit}件)`;
      countEl.classList.toggle('brc-count-over', !estimate.withinLimit);
    };
    updateApproxCount();
    wrapperEl.addEventListener('input', updateApproxCount);
    wrapperEl.addEventListener('change', updateApproxCount);

    let pendingResult = null;
    const dialog = await platform.createDialog({
      title: '一括作成の内容を入力',
      body: wrapperEl,
      showOkButton: true,
      okButtonText: '次へ',
      showCancelButton: true,
      cancelButtonText: 'キャンセル',
      showCloseButton: true,
      beforeClose: async (action) => {
        if (action !== 'OK') {
          return true;
        }
        const errors = [];
        const templatePatch = {};
        templateFields.forEach((field) => {
          const reader = readers[field.code];
          const rawValue = reader.read();
          if (field.required && reader.isEmpty(rawValue)) {
            errors.push(`${field.label}は必須です。`);
          }
          templatePatch[field.code] = { value: rawValue };
        });

        let assigneeSpec;
        if (assigneeSection) {
          const entries = await assigneeSection.getEntries();
          if (entries.length === 0) {
            errors.push('対象者を1人以上選択してください。');
          }
          assigneeSpec = { fieldCode: assigneeField.code, entries };
        }

        let datesSpec;
        if (recurrenceSection) {
          try {
            const { values, labels, endValues, endLabels } =
              recurrenceSection.getValues();
            datesSpec = { fieldCode: dateField.code, values, labels };
            if (endDateField) {
              datesSpec.endFieldCode = endDateField.code;
              datesSpec.endValues = endValues;
              datesSpec.endLabels = endLabels;
            }
          } catch (err) {
            errors.push(err.message);
          }
        }

        if (errors.length === 0) {
          const estimate = RecordCountEstimator.estimateRecordCount({
            assigneeCount: assigneeSpec
              ? assigneeSpec.entries.length
              : undefined,
            dateCount: datesSpec ? datesSpec.values.length : undefined,
          });
          if (!estimate.withinLimit) {
            errors.push(
              `作成予定件数(${estimate.count}件)が上限(${estimate.limit}件)を超えています。対象を絞り込んでください。`,
            );
          } else if (estimate.count === 0) {
            errors.push(
              '作成されるレコードが0件です。対象者・日付の指定を見直してください。',
            );
          }
        }

        if (errors.length > 0) {
          errorEl.textContent = errors.join('\n');
          errorEl.hidden = false;
          return false;
        }

        pendingResult = {
          templatePatch,
          assignee: assigneeSpec,
          dates: datesSpec,
        };
        return true;
      },
    });
    const result = await dialog.show();
    return result === 'OK' ? pendingResult : null;
  };

  // ---- Dialog 2: 最終確認 --------------------------------------------------------------

  const PREVIEW_LIMIT = 50;

  const buildPreviewList = (assigneeSpec, datesSpec) => {
    const assignees = assigneeSpec ? assigneeSpec.entries : [null];
    // labels/endLabelsは最終確認ダイアログでの表示専用(DATETIME型はローカル時刻表記)。
    // 実際にAPIへ送るvalues/endValuesとは別に持つ(getValues()のコメント参照)。
    const dates = datesSpec ? datesSpec.labels || datesSpec.values : [null];
    const endDates =
      datesSpec && datesSpec.endLabels ? datesSpec.endLabels : null;
    const rows = [];
    assignees.forEach((assignee) => {
      dates.forEach((date, dateIndex) => {
        const parts = [];
        if (assignee) {
          parts.push(`${assignee.name || assignee.code}(${assignee.code})`);
        }
        if (date) {
          parts.push(endDates ? `${date} 〜 ${endDates[dateIndex]}` : date);
        }
        rows.push(
          parts.length > 0 ? parts.join(' / ') : '(テンプレート値のみ)',
        );
      });
    });
    return rows;
  };

  const showFinalConfirmDialog = async (platform, totalCount, previewRows) => {
    const wrapperEl = document.createElement('div');
    wrapperEl.className = 'brc-dialog-body';

    const messageEl = document.createElement('p');
    messageEl.textContent = `${totalCount}件のレコードを作成します。よろしいですか?`;
    wrapperEl.appendChild(messageEl);

    const listEl = document.createElement('ul');
    listEl.className = 'brc-preview-list';
    previewRows.slice(0, PREVIEW_LIMIT).forEach((row) => {
      const itemEl = document.createElement('li');
      itemEl.textContent = row;
      listEl.appendChild(itemEl);
    });
    wrapperEl.appendChild(listEl);

    if (previewRows.length > PREVIEW_LIMIT) {
      const moreEl = document.createElement('p');
      moreEl.textContent = `...他${previewRows.length - PREVIEW_LIMIT}件`;
      wrapperEl.appendChild(moreEl);
    }

    const dialog = await platform.createDialog({
      title: '最終確認',
      body: wrapperEl,
      showOkButton: true,
      okButtonText: '作成',
      showCancelButton: true,
      cancelButtonText: 'キャンセル',
      showCloseButton: true,
    });
    const result = await dialog.show();
    return result === 'OK';
  };

  // ---- 実行本体 ------------------------------------------------------------------------

  const resolveTemplateFields = (config, formFields, excludeFieldCodes) => {
    const eligibleByCode = {};
    FieldEligibility.listEligibleFields(formFields, {
      excludeFieldCodes,
    }).forEach((field) => {
      eligibleByCode[field.code] = field;
    });
    return config.templateFieldCodes
      .map((code) => eligibleByCode[code])
      .filter(Boolean);
  };

  const resolveAssigneeField = (config, formFields) => {
    if (!config.assigneeFieldCode) {
      return null;
    }
    const field = formFields[config.assigneeFieldCode];
    if (field && FieldEligibility.ENTITY_SELECT_TYPES.includes(field.type)) {
      return field;
    }
    return null;
  };

  const resolveDateField = (config, formFields) => {
    if (!config.dateFieldCode) {
      return null;
    }
    const field = formFields[config.dateFieldCode];
    return field && FieldEligibility.RECURRENCE_FIELD_TYPES.includes(field.type)
      ? field
      : null;
  };

  // 終了日時フィールドは、繰り返し用フィールドがDATETIME型の場合のみ有効(idea.md
  // 「終了日時フィールド」参照)。dateFieldがnull、またはDATE型の場合はendDateFieldCodeが
  // 設定されていても使わない(設定画面側でもDATETIME型でなければ選べないようにしている)。
  const resolveEndDateField = (config, formFields, dateField) => {
    if (
      !config.endDateFieldCode ||
      !dateField ||
      dateField.type !== 'DATETIME'
    ) {
      return null;
    }
    const field = formFields[config.endDateFieldCode];
    return field && field.type === 'DATETIME' && field.code !== dateField.code
      ? field
      : null;
  };

  // config: { assigneeFieldCode, dateFieldCode, endDateFieldCode, templateFieldCodes, groupCodes }
  // platform: {
  //   createDialog(config): Promise<{show, close}>
  //     (kintone.createDialog/kintone.mobile.createBottomSheetと同一シグネチャ),
  //   showLoading(): void, hideLoading(): void,
  // }
  const runBulkCreate = async (config, appId, platform) => {
    const formFields = await kintone.app.getFormFields();
    const dateField = resolveDateField(config, formFields);
    const endDateField = resolveEndDateField(config, formFields, dateField);
    const templateFields = resolveTemplateFields(
      config,
      formFields,
      [dateField, endDateField].filter(Boolean).map((f) => f.code),
    );
    const assigneeField = resolveAssigneeField(config, formFields);

    if (templateFields.length === 0 && !assigneeField && !dateField) {
      global.alert(
        '対象フィールドがすべてフォームから削除されているため、実行できません。プラグインの設定を見直してください。',
      );
      return;
    }

    const dialogResult = await showInputDialog(
      platform,
      templateFields,
      assigneeField,
      dateField,
      endDateField,
    );
    if (!dialogResult) {
      return;
    }

    const records = RecordPayloadBuilder.buildRecords(dialogResult);
    const previewRows = buildPreviewList(
      dialogResult.assignee,
      dialogResult.dates,
    );
    const confirmed = await showFinalConfirmDialog(
      platform,
      records.length,
      previewRows,
    );
    if (!confirmed) {
      return;
    }

    enableUnloadGuard();
    platform.showLoading();
    try {
      const result = await BatchCreator.createAll(records, {
        postBatch: (chunk) => postRecordsBatch(appId, chunk),
      });
      global.alert(BatchCreator.buildResultSummary(result));
    } catch (err) {
      global.alert(`作成を中止しました: ${err.message}`);
    } finally {
      platform.hideLoading();
      disableUnloadGuard();
    }
  };

  // 一覧画面ヘッダーに、対象グループのメンバーにだけボタンを表示する。
  // kintone.user.getGroups()はクライアント側の表示ゲートに過ぎず、真の権限境界ではない
  // (真の境界は対象アプリのレコード追加権限・フィールド編集権限。security-checklist.md参照)。
  const renderButtonIfAuthorized = async (
    headerEl,
    config,
    appId,
    platform,
  ) => {
    if (!headerEl || headerEl.dataset.brcButtonRendered) {
      return;
    }
    if (
      !config.templateFieldCodes ||
      config.templateFieldCodes.length === 0 ||
      !config.groupCodes ||
      config.groupCodes.length === 0
    ) {
      return;
    }

    const groups = await kintone.user.getGroups();
    const isAuthorized = groups.some((g) => config.groupCodes.includes(g.code));
    if (!isAuthorized) {
      return;
    }

    // eslint-disable-next-line require-atomic-updates
    headerEl.dataset.brcButtonRendered = '1';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'kintoneplugin-button-normal brc-bulk-button';
    button.textContent = 'レコードを一括作成';
    button.addEventListener('click', () => {
      button.disabled = true;
      runBulkCreate(config, appId, platform).finally(() => {
        button.disabled = false;
      });
    });
    headerEl.appendChild(button);
  };

  NS.BulkCreate = { runBulkCreate, renderButtonIfAuthorized };
})(window, kintone);
