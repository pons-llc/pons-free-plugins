(function (global) {
  'use strict';

  const NS = global.FiscalYearNumbering;

  const RETRY_OPTIONS = { maxAttempts: 5, backoffMs: 150 };

  // 「次の番号を発行して、最終的な表示文字列を返す」までの一連の処理。
  const computeNext = async (config, sourceRecord, targetAppId) => {
    const date = NS.FiscalYear.resolveDate(config, sourceRecord);
    const fiscalYear = NS.FiscalYear.toFiscalYear(date);
    const era = NS.EraTable.matchingEra(config.eraTable, fiscalYear);
    const eraYear = NS.EraTable.eraYear(era, fiscalYear);
    const segments = NS.SegmentValue.resolve(config.segments, sourceRecord);
    const combinationKey = NS.CounterKey.build(targetAppId, fiscalYear, segments);

    const meta = {
      targetAppId,
      fiscalYear,
      era,
      eraYear,
      segments,
      segmentSummary: segments.map((s) => s.value).join(' / '),
    };

    const sequence = await NS.Retry.withRetry(
      () => NS.CounterClient.issueNext(config.counterAppId, combinationKey, meta),
      RETRY_OPTIONS
    );

    return NS.NumberTemplate.render(config, era, eraYear, segments, sequence);
  };

  NS.NumberingService = { computeNext };
})(window);
