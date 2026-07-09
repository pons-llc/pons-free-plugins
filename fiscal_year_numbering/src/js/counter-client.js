(function (global) {
  'use strict';

  const NS = global.FiscalYearNumbering;

  // カウンター専用アプリのフィールドコード(provisioning/seed-counter-app.jsで作成する固定スキーマ)。
  const FIELD = {
    keySequence: 'key_sequence',
    combinationKey: 'combination_key',
    sequenceNumber: 'sequence_number',
    targetAppId: 'target_app_id',
    fiscalYear: 'fiscal_year',
    eraCode: 'era_code',
    eraYear: 'era_year',
    segmentSummary: 'segment_summary',
  };

  const recordsUrl = () => kintone.api.url('/k/v1/records.json', true);
  const recordUrl = () => kintone.api.url('/k/v1/record.json', true);

  // NOTE: kintone REST APIの検証エラーの`code`値はドキュメント上で網羅的に一覧化されていないため、
  // Puppeteerでの実環境テスト(CLAUDE.md項目6)で実際のレスポンスを確認し、
  // 必要であればこの判定条件を調整すること(security-checklist.mdにも記載)。
  const isUniqueConstraintViolation = (error) => {
    if (!error) {
      return false;
    }
    if (error.code === 'CB_VA01') {
      return true;
    }
    return typeof error.message === 'string' && error.message.includes('重複');
  };

  const findMaxSequence = async (counterAppId, combinationKey) => {
    const escaped = combinationKey.replace(/"/g, '\\"');
    const query = `${FIELD.combinationKey} = "${escaped}" order by ${FIELD.sequenceNumber} desc limit 1`;
    const resp = await kintone.api(recordsUrl(), 'GET', { app: counterAppId, query });
    if (resp.records.length === 0) {
      return 0;
    }
    return Number(resp.records[0][FIELD.sequenceNumber].value);
  };

  const createCounterRecord = (counterAppId, combinationKey, sequence, meta) => {
    const record = {
      [FIELD.keySequence]: { value: NS.CounterKey.withSequence(combinationKey, sequence) },
      [FIELD.combinationKey]: { value: combinationKey },
      [FIELD.sequenceNumber]: { value: String(sequence) },
      [FIELD.targetAppId]: { value: String(meta.targetAppId) },
      [FIELD.fiscalYear]: { value: String(meta.fiscalYear) },
      [FIELD.eraCode]: { value: meta.era.code },
      [FIELD.eraYear]: { value: String(meta.eraYear) },
      [FIELD.segmentSummary]: { value: meta.segmentSummary },
    };
    // 位置ベースの汎用列(segment_N_code/segment_N_value)にも展開する。
    // MAX_SEGMENTSを超える分はcombination_key/segment_summaryにのみ含まれ、個別列には出ない。
    const segments = meta.segments || [];
    const sorted = [...segments].sort((a, b) => a.order - b.order);
    sorted.slice(0, NS.CounterKey.MAX_SEGMENTS).forEach((segment, index) => {
      const n = index + 1;
      record[`segment_${n}_code`] = { value: segment.code };
      record[`segment_${n}_value`] = { value: segment.value };
    });
    return kintone.api(recordUrl(), 'POST', { app: counterAppId, record });
  };

  // 「次の番号を発行する」1回分の処理。衝突検知時は ConflictError を投げ、呼び出し側(retry.js)に委ねる。
  const issueNext = async (counterAppId, combinationKey, meta) => {
    const nextSequence = (await findMaxSequence(counterAppId, combinationKey)) + 1;
    try {
      await createCounterRecord(counterAppId, combinationKey, nextSequence, meta);
    } catch (err) {
      if (isUniqueConstraintViolation(err)) {
        throw new NS.Retry.ConflictError(err.message || 'key_sequence conflict');
      }
      throw err;
    }
    return nextSequence;
  };

  NS.CounterClient = { FIELD, issueNext };
})(window);
