/** §7.4 上限値 */
export const LIMITS = {
  maxFetchRecords: 50_000,
  maxGroupsPerWidget: 1_000,
  maxReadAggregateCells: 200,
  maxMapMarkers: 5_000,
  maxWidgetsPerDashboard: 24,
} as const;

/** §4.4 suggestedQuestions の既定上限 */
export const MAX_SUGGESTED_QUESTIONS = 20;

/** §7.2 週の開始曜日（既定：月曜） */
export const WEEK_START_DAY = 1;
