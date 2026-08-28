import { babyStatusLabel } from '../../content/terminology.js';

const itemNumber = (item, index = 0) => {
  const explicit = Number(item?.number);
  if (Number.isInteger(explicit) && explicit > 0) return explicit;
  const matched = String(item?.code || '').match(/(\d+)$/);
  return matched ? Number(matched[1]) : index + 1;
};

const normalizedItems = (group = {}) => {
  const seen = new Set();
  return (Array.isArray(group.items) ? group.items : []).map((item, index) => ({
    ...item,
    number: itemNumber(item, index),
    code: String(item?.code || '').trim()
  })).filter((item) => {
    const key = item.code.toLocaleUpperCase('en-US');
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((left, right) => left.number - right.number || left.code.localeCompare(right.code));
};

export const babyQrStatusLabels = Object.freeze(Object.fromEntries(
  ['alive', 'dead', 'rehomed', 'transferred'].map((status) => [status, babyStatusLabel(status)])
));

export function createBabyQrSelection(group = {}) {
  const items = normalizedItems(group);
  const numbers = items.map((item) => item.number);
  return {
    mode: 'alive',
    start: numbers.length ? Math.min(...numbers) : 1,
    end: numbers.length ? Math.max(...numbers) : 1,
    selectedCodes: items.filter((item) => (item.status || 'alive') === 'alive').map((item) => item.code),
    search: ''
  };
}

export function babyQrSelectionResult(group = {}, selection = {}) {
  const items = normalizedItems(group);
  const mode = ['alive', 'all', 'range', 'individual'].includes(selection.mode) ? selection.mode : 'alive';
  if (!items.length) return { codes: [], error: 'このベビー群に番号がありません。', items };

  let selected = [];
  let error = '';
  if (mode === 'all') {
    selected = items;
  } else if (mode === 'range') {
    let start = Number(selection.start);
    let end = Number(selection.end);
    if (!Number.isInteger(start) || !Number.isInteger(end)) {
      error = '開始番号と終了番号を入力してください。';
    } else {
      if (start > end) [start, end] = [end, start];
      const minimum = items[0].number;
      const maximum = items.at(-1).number;
      if (start < minimum || end > maximum) {
        error = `番号は${minimum}〜${maximum}の範囲で入力してください。`;
      } else {
        selected = items.filter((item) => item.number >= start && item.number <= end);
      }
    }
  } else if (mode === 'individual') {
    const requested = new Set((selection.selectedCodes || []).map((code) => String(code).toLocaleUpperCase('en-US')));
    selected = items.filter((item) => requested.has(item.code.toLocaleUpperCase('en-US')));
  } else {
    selected = items.filter((item) => (item.status || 'alive') === 'alive');
  }

  return { codes: selected.map((item) => item.code), error, items };
}

export function babyQrCodesFromSelection(group = {}, selection = {}) {
  return babyQrSelectionResult(group, selection).codes;
}

export function filterBabyQrItems(group = {}, search = '') {
  const query = String(search || '').trim().toLocaleLowerCase('ja');
  if (!query) return normalizedItems(group);
  return normalizedItems(group).filter((item) => (
    item.code.toLocaleLowerCase('ja').includes(query)
    || String(item.number).includes(query)
  ));
}

export function chunkBabyQrCodes(codes = [], chunkSize = 100) {
  const size = Math.max(1, Math.min(100, Number(chunkSize) || 100));
  const unique = [...new Set(codes.map((code) => String(code || '').trim()).filter(Boolean))];
  const chunks = [];
  for (let index = 0; index < unique.length; index += size) chunks.push(unique.slice(index, index + size));
  return chunks;
}

export async function loadBabyQrTargets(qrService, groupId, codes = [], options = {}) {
  const requestedCodes = chunkBabyQrCodes(codes).flat();
  // A label job must reach the server as one batch; splitting would bypass its plan limit.
  const chunks = options.purpose === 'labels' ? (requestedCodes.length ? [requestedCodes] : []) : chunkBabyQrCodes(requestedCodes);
  const responses = await Promise.all(chunks.map((chunk) => (
    qrService.targets({ source: 'baby', groupId, codes: chunk, ...options })
  )));
  const byBabyCode = new Map();
  responses.forEach((response) => {
    const items = Array.isArray(response?.items) ? response.items : Array.isArray(response?.targets) ? response.targets : [];
    items.forEach((item) => {
      const key = String(item?.baby_code || item?.manage_code || '').toLocaleUpperCase('en-US');
      if (key && !byBabyCode.has(key)) byBabyCode.set(key, item);
    });
  });
  const items = requestedCodes.map((code) => byBabyCode.get(code.toLocaleUpperCase('en-US'))).filter(Boolean);
  return { items, count: items.length };
}
