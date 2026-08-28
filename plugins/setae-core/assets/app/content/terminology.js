const labelFrom = (labels, value, fallback = '') => labels[String(value ?? '').toLowerCase()] || fallback;

const recordTypes = Object.freeze({
  feed: '給餌',
  molt: '脱皮',
  observation: '観察',
  growth: '成長',
  pairing: 'ペアリング',
  count_check: '個体数確認',
  environment_check: '環境確認',
  maintenance: 'メンテナンス',
  watering: '給水',
  misting: '霧吹き',
  substrate_change: '床材交換',
  note: '容器メモ',
  animal_move_in: '入居',
  animal_move_out: '退居',
  dead: '死亡',
  alive: '生存へ復帰',
  rehomed: '譲渡',
  transferred: '通常個体へ移動',
  other: 'その他'
});

const taskTypes = Object.freeze({
  ...recordTypes,
  count: '個体数確認',
  environment: '環境確認',
  substrate: '床材交換'
});

const taskOutcomes = Object.freeze({
  completed: '完了',
  attempted: '試行済み',
  deferred: '延期',
  skipped: '見送り'
});

const animalStatuses = Object.freeze({
  normal: '通常',
  fasting: '拒食',
  pre_molt: '脱皮前',
  post_molt: '脱皮後',
  unknown: '不明'
});

const babyStatuses = Object.freeze({
  alive: '生存',
  dead: '死亡',
  rehomed: '譲渡済み',
  transferred: '通常個体へ移動済み'
});

const nurseryEvents = Object.freeze({
  ...recordTypes,
  feed: '群給餌'
});

const enclosureEvents = Object.freeze({
  environment_check: '環境確認',
  maintenance: 'メンテナンス',
  watering: '給水',
  misting: '霧吹き',
  substrate_change: '床材交換',
  note: '容器メモ',
  animal_move_in: '入居',
  animal_move_out: '退居'
});

const qrVisibilities = Object.freeze({
  private: '非公開',
  basic: '基本情報を公開',
  life_history: '生活史を公開'
});

const qrTransferStatuses = Object.freeze({
  pending: '申請中',
  approved: '承認済み',
  accepted: '承認済み',
  rejected: '見送り',
  completed: '完了',
  cancelled: '取消済み'
});

const cardModes = Object.freeze({ photo: '写真', hybrid: '写真＋情報', data: 'データ' });
const cardDensities = Object.freeze({ compact: 'コンパクト', standard: '標準', detailed: '詳細' });

const offlineActions = Object.freeze({
  create_spider: '個体を登録',
  update_spider: '個体情報を更新',
  delete_spider: '個体を削除',
  create_log: '飼育記録を追加',
  update_log: '飼育記録を更新',
  delete_log: '飼育記録を削除',
  create_qr_records: 'QR一括記録を追加',
  save_task_action: '作業結果を保存',
  save_task_actions_batch: '作業結果をまとめて保存'
});

export const recordTypeLabel = (type) => labelFrom(recordTypes, type, '記録');
export const taskTypeLabel = (type) => labelFrom(taskTypes, type, '作業');
export const taskOutcomeLabel = (outcome) => labelFrom(taskOutcomes, outcome, '対応済み');
export const animalStatusLabel = (status) => labelFrom(animalStatuses, String(status || 'unknown').replaceAll('-', '_'), '不明');
export const babyStatusLabel = (status) => labelFrom(babyStatuses, status, '不明');
export const nurseryEventLabel = (type) => labelFrom(nurseryEvents, type, '群の記録');
export const enclosureEventLabel = (type) => labelFrom(enclosureEvents, type, '容器の記録');
export const qrVisibilityLabel = (value) => labelFrom(qrVisibilities, value, '公開範囲未設定');
export const qrTransferStatusLabel = (value) => labelFrom(qrTransferStatuses, value, '状態未確認');
export const cardModeLabel = (value) => labelFrom(cardModes, value, '写真＋情報');
export const cardDensityLabel = (value) => labelFrom(cardDensities, value, '標準');
export const offlineActionLabel = (action) => labelFrom(offlineActions, action, '未対応の操作');

export function countLabel(count, unit = '件') {
  const value = Number(count);
  return `${Number.isFinite(value) ? value : 0}${String(unit || '件')}`;
}

export const terminologyMaps = Object.freeze({
  recordTypes,
  taskTypes,
  taskOutcomes,
  animalStatuses,
  babyStatuses,
  nurseryEvents,
  enclosureEvents,
  qrVisibilities,
  qrTransferStatuses,
  cardModes,
  cardDensities,
  offlineActions
});
