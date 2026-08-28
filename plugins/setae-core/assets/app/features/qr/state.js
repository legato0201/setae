const today = () => new Date().toLocaleDateString('sv-SE');
const LABEL_CONFIG_KEY = 'setae.gui.v2.fieldLabelConfig';
const LABEL_SCHEMA_VERSION = 2;
const HISTORY_LIMIT = 20;
const TAPE_MIN_MM = 18;
const TAPE_MAX_MM = 120;

export const tapeLengthPresets = Object.freeze([18, 24, 36, 50, 70]);

export const labelTapeFormatMetrics = Object.freeze({
  'micro-id': Object.freeze({ digitalWidthMm: 15.6, minimumLengthMm: 18 }),
  compact: Object.freeze({ digitalWidthMm: 28, minimumLengthMm: 30 }),
  field: Object.freeze({ digitalWidthMm: 34, minimumLengthMm: 36 })
});

export const defaultLabelConfig = Object.freeze({
  schemaVersion: LABEL_SCHEMA_VERSION,
  output: 'a4',
  a4Size: 'standard',
  tapeLengthMm: 24,
  size: 'standard',
  format: 'field',
  handwriting: 'large',
  showQr: true,
  showSpecimenId: true,
  showScientificName: true,
  showStageSex: false,
  cropMarks: true,
  outerBorder: true,
  guideLine: false
});

const normalizeTapeLength = (value, fallback = defaultLabelConfig.tapeLengthMm) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(TAPE_MIN_MM, Math.min(TAPE_MAX_MM, Math.round(numeric)));
};

export function normalizeLabelConfig(value = {}) {
  const raw = value && typeof value === 'object' ? value : {};
  const legacySize = ['standard', 'large', 'compact'].includes(raw.size) ? raw.size : '';
  const a4Size = ['standard', 'large', 'compact'].includes(raw.a4Size)
    ? raw.a4Size
    : legacySize || defaultLabelConfig.a4Size;
  const legacyTapeLengths = { compact: 70, standard: 80, large: 90 };
  const legacyTapeLength = Number(raw.schemaVersion || 0) < LABEL_SCHEMA_VERSION
    && raw.output === 'tape'
    && legacySize
    ? legacyTapeLengths[legacySize]
    : defaultLabelConfig.tapeLengthMm;
  const tapeLengthMm = normalizeTapeLength(raw.tapeLengthMm, legacyTapeLength);

  return {
    schemaVersion: LABEL_SCHEMA_VERSION,
    output: ['a4', 'tape'].includes(raw.output) ? raw.output : defaultLabelConfig.output,
    a4Size,
    tapeLengthMm,
    size: a4Size,
    format: ['field', 'compact', 'micro-id'].includes(raw.format) ? raw.format : defaultLabelConfig.format,
    handwriting: ['large', 'medium', 'none'].includes(raw.handwriting) ? raw.handwriting : defaultLabelConfig.handwriting,
    showQr: raw.showQr !== false,
    showSpecimenId: raw.showSpecimenId !== false,
    showScientificName: raw.showScientificName !== false,
    showStageSex: Boolean(raw.showStageSex),
    cropMarks: raw.cropMarks !== false,
    outerBorder: raw.outerBorder !== false,
    guideLine: Boolean(raw.guideLine)
  };
}

export function loadLabelConfig(storage = globalThis.localStorage) {
  try {
    return normalizeLabelConfig(JSON.parse(storage?.getItem(LABEL_CONFIG_KEY) || '{}'));
  } catch {
    return normalizeLabelConfig();
  }
}

export function saveLabelConfig(storage = globalThis.localStorage, value = {}) {
  const normalized = normalizeLabelConfig(value);
  try { storage?.setItem(LABEL_CONFIG_KEY, JSON.stringify(normalized)); }
  catch {}
  return normalized;
}

export function labelDimensions(config = {}) {
  const normalized = normalizeLabelConfig(config);
  if (normalized.output === 'tape') {
    return {
      width: normalized.tapeLengthMm,
      height: 12,
      columns: 1,
      label: `${normalized.tapeLengthMm} × 12 mm`
    };
  }
  const preset = {
    compact: { width: 50, height: 20, columns: 3 },
    standard: { width: 65, height: 25, columns: 3 },
    large: { width: 80, height: 30, columns: 2 }
  }[normalized.a4Size];
  return { ...preset, label: `${preset.width} × ${preset.height} mm` };
}

export function labelConfigValidation(config = {}) {
  const normalized = normalizeLabelConfig(config);
  if (normalized.output !== 'tape') return '';
  const metric = labelTapeFormatMetrics[normalized.format];
  if (!metric || normalized.tapeLengthMm >= metric.minimumLengthMm) return '';
  const label = normalized.format === 'field' ? 'Field label' : normalized.format === 'compact' ? 'Compact ID' : 'Micro ID';
  return `${label}は${metric.minimumLengthMm}mm以上のテープ長が必要です。短いテープではMicro IDを使用してください。`;
}

export function createQrWorkspaceState(overrides = {}) {
  return {
    section: 'labels',
    resolved: null,
    targets: null,
    transfers: null,
    labelConfig: normalizeLabelConfig(),
    scannerMode: 'single',
    batchMode: 'queue',
    batchStep: 'scan',
    scanQueue: [],
    batchEventType: 'molt',
    batchRows: {},
    sameDate: today(),
    historyEditorOpen: false,
    historyRows: [],
    historyTargetCode: '',
    prefillCode: '',
    scanStatus: '',
    scanStatusTone: '',
    cameraState: 'idle',
    cameraActive: false,
    saving: false,
    error: null,
    ...overrides,
    historyRows: Array.isArray(overrides.historyRows) ? overrides.historyRows.slice(0, HISTORY_LIMIT) : [],
    labelConfig: normalizeLabelConfig(overrides.labelConfig)
  };
}

export function parseQrCode(value, base = 'https://setae.net/') {
  let raw = String(value || '').trim();
  try {
    const url = new URL(raw, base);
    const parts = url.pathname.split('/').filter(Boolean);
    raw = parts.at(-1) || url.searchParams.get('setae_qr') || raw;
  } catch {}
  raw = raw.toLowerCase();
  return /^[23456789abcdefghjkmnpqrstuvwxyz]{4,8}$/.test(raw) ? raw : '';
}

export function addQrQueueTarget(qr, target) {
  const code = parseQrCode(target?.code || target?.qr_code || target?.url || '');
  if (!code || (qr.scanQueue || []).some((item) => parseQrCode(item.code) === code)) return qr;
  const scanQueue = [...(qr.scanQueue || []), { ...target, code }].slice(0, 100);
  const batchRows = {
    ...(qr.batchRows || {}),
    [code]: { date: qr.sameDate || today(), note: '', prey_type: '' }
  };
  return { ...qr, scanQueue, batchRows, batchStep: qr.batchMode === 'capture' ? 'edit' : qr.batchStep };
}

export function removeQrQueueTarget(qr, codeValue) {
  const code = parseQrCode(codeValue);
  const batchRows = { ...(qr.batchRows || {}) };
  delete batchRows[code];
  return {
    ...qr,
    scanQueue: (qr.scanQueue || []).filter((item) => parseQrCode(item.code) !== code),
    batchRows
  };
}

export function applySameBatchDate(qr, date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))) return qr;
  const batchRows = Object.fromEntries((qr.scanQueue || []).map((item) => {
    const code = parseQrCode(item.code);
    return [code, { ...(qr.batchRows?.[code] || {}), date }];
  }));
  return { ...qr, sameDate: date, batchRows };
}

export function qrBatchEntries(qr) {
  const requestedType = ['feed', 'molt', 'observation', 'other'].includes(qr.batchEventType)
    ? qr.batchEventType
    : 'observation';
  return (qr.scanQueue || []).map((item) => {
    const code = parseQrCode(item.code);
    const row = qr.batchRows?.[code] || {};
    const other = requestedType === 'other';
    const type = other ? 'observation' : requestedType;
    let note = String(row.note || '').trim();
    if (other) note = note ? `その他: ${note}` : 'その他の記録';
    if (type === 'observation' && !note) note = '状態確認';
    return {
      code,
      type,
      date: row.date || qr.sameDate || today(),
      prey_type: type === 'feed' ? String(row.prey_type || '').trim() : '',
      note
    };
  }).filter((entry) => entry.code && /^\d{4}-\d{2}-\d{2}$/.test(entry.date));
}

let historyRowSequence = 0;

export function addQrHistoryRow(qr, type = 'observation', values = {}) {
  const rows = Array.isArray(qr.historyRows) ? qr.historyRows : [];
  if (rows.length >= HISTORY_LIMIT) return qr;
  const normalizedType = ['feed', 'molt', 'observation'].includes(type) ? type : 'observation';
  historyRowSequence += 1;
  const row = {
    id: String(values.id || `qr-history-${Date.now()}-${historyRowSequence}`),
    type: normalizedType,
    date: String(values.date || today()),
    prey_type: normalizedType === 'feed' ? String(values.prey_type || '') : '',
    note: String(values.note || '')
  };
  return { ...qr, historyEditorOpen: true, historyRows: [...rows, row], error: null };
}

export function removeQrHistoryRow(qr, rowId) {
  return {
    ...qr,
    historyRows: (qr.historyRows || []).filter((row) => String(row.id) !== String(rowId)),
    error: null
  };
}

export function updateQrHistoryRow(qr, rowId, patch = {}) {
  const allowed = ['type', 'date', 'prey_type', 'note'];
  const values = Object.fromEntries(Object.entries(patch).filter(([key]) => allowed.includes(key)));
  return {
    ...qr,
    historyRows: (qr.historyRows || []).map((row) => {
      if (String(row.id) !== String(rowId)) return row;
      const type = ['feed', 'molt', 'observation'].includes(values.type) ? values.type : row.type;
      return {
        ...row,
        ...values,
        type,
        prey_type: type === 'feed' ? String(values.prey_type ?? row.prey_type ?? '') : ''
      };
    }),
    error: null
  };
}

export function resetQrHistory(qr, targetCode = '') {
  return {
    ...qr,
    historyEditorOpen: false,
    historyRows: [],
    historyTargetCode: parseQrCode(targetCode),
    error: null
  };
}

export function qrHistoryEntries(qr) {
  const code = parseQrCode(qr.historyTargetCode || qr.resolved?.code || qr.resolved?.url || '');
  return (qr.historyRows || []).slice(0, HISTORY_LIMIT).map((row) => {
    const type = ['feed', 'molt', 'observation'].includes(row.type) ? row.type : 'observation';
    return {
      code,
      type,
      date: String(row.date || ''),
      prey_type: type === 'feed' ? String(row.prey_type || '').trim() : '',
      note: String(row.note || '').trim()
    };
  }).filter((entry) => entry.code && /^\d{4}-\d{2}-\d{2}$/.test(entry.date));
}

export function qrHistoryOfflinePayload(qr) {
  return { entries: qrHistoryEntries(qr) };
}

export function qrTaskCompletionCandidates(entries = [], targetsByCode = new Map(), actedOn = today()) {
  const targets = typeof targetsByCode?.get === 'function'
    ? targetsByCode
    : new Map(Object.entries(targetsByCode || {}));
  const candidates = new Map();
  entries.forEach((entry) => {
    if (entry.date !== actedOn) return;
    const target = targets.get(parseQrCode(entry.code));
    if (target?.target_type !== 'spider' || !target.object_id) return;
    const key = `${target.object_id}:${entry.type}`;
    if (!candidates.has(key)) candidates.set(key, { target, type: entry.type, key });
  });
  return [...candidates.values()];
}
