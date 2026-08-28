const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const source = read('assets/app/features/qr/state.js').replace(/\bexport\s+(?=(?:const|function|class)\b)/g, '');
const context = {};
vm.createContext(context);
vm.runInContext(`${source}\nthis.exports = { createQrWorkspaceState, addQrHistoryRow, removeQrHistoryRow, updateQrHistoryRow, qrHistoryEntries, qrHistoryOfflinePayload, qrTaskCompletionCandidates };`, context);

const {
  createQrWorkspaceState,
  addQrHistoryRow,
  removeQrHistoryRow,
  updateQrHistoryRow,
  qrHistoryEntries,
  qrHistoryOfflinePayload,
  qrTaskCompletionCandidates
} = context.exports;

let qr = createQrWorkspaceState({ historyEditorOpen: true, historyTargetCode: 'k7mp3x' });
qr = addQrHistoryRow(qr, 'molt', { id: 'm1', date: '2026-06-01', prey_type: 'ignored' });
qr = addQrHistoryRow(qr, 'molt', { id: 'm2', date: '2026-06-20' });
qr = addQrHistoryRow(qr, 'molt', { id: 'm3', date: '2026-07-10' });
qr = addQrHistoryRow(qr, 'feed', { id: 'f1', date: '2026-07-15', prey_type: 'D. hydei' });
let entries = qrHistoryEntries(qr);
assert.equal(entries.length, 4);
assert.equal(new Set(entries.map((entry) => entry.code)).size, 1);
assert.equal(entries[0].code, 'k7mp3x');
assert.equal(entries[0].prey_type, '');
assert.equal(entries[3].prey_type, 'D. hydei');
assert.deepEqual([...qrHistoryOfflinePayload(qr).entries], [...entries]);

qr = updateQrHistoryRow(qr, 'm2', { date: '' });
assert.equal(qrHistoryEntries(qr).length, 3);
qr = removeQrHistoryRow(qr, 'm2');
assert.equal(qr.historyRows.length, 3);

let limited = createQrWorkspaceState({ historyTargetCode: 'k7mp3x' });
for (let index = 0; index < 25; index += 1) limited = addQrHistoryRow(limited, 'observation', { id: `r${index}` });
assert.equal(limited.historyRows.length, 20);

const taskEntries = [
  { code: 'k7mp3x', type: 'molt', date: '2026-08-23' },
  { code: 'k7mp3x', type: 'molt', date: '2026-08-23' },
  { code: 'k7mp3x', type: 'feed', date: '2026-08-23' },
  { code: 'k7mp3x', type: 'feed', date: '2026-07-15' }
];
const targets = new Map([['k7mp3x', { target_type: 'spider', object_id: 44 }]]);
const candidates = qrTaskCompletionCandidates(taskEntries, targets, '2026-08-23');
assert.deepEqual([...candidates.map((item) => item.key)].sort(), ['44:feed', '44:molt']);

const app = read('assets/app/app.js');
const persistStart = app.indexOf('async function persistQrRecordEntries');
const persistEnd = app.indexOf('\nasync function submitQrBatchRecord', persistStart);
const persistSource = app.slice(persistStart, persistEnd);
assert.match(persistSource, /services\.qr\.records\(\{ entries \}\)/);
assert.match(persistSource, /enqueueOffline\('create_qr_records', 0, \{ entries \}, \{ notify: false \}\)/);
assert.match(app, /submitQrBatchRecord[\s\S]*?persistQrRecordEntries\(entries, targetsByCode\)/);
assert.match(app, /submitQrHistoryRecord[\s\S]*?persistQrRecordEntries\(entries, targetsByCode\)/);

console.log('QR multi-record tests passed');
