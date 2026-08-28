const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const actionsSource = read('assets/app/features/records/actions.js')
  .replace(/^import .*;\n/gm, '')
  .replace(/\bexport\s+(?=(?:const|function|class|async function)\b)/g, '');
const context = { FormData, runCollectionBatch: async () => ({}) };
vm.createContext(context);
vm.runInContext(`${actionsSource}\nthis.exports = { resolveRecordType, recordDataFromForm, createRecordRequest, applyRecordToAnimals };`, context);
const actions = context.exports;

assert.equal(actions.resolveRecordType('pairing'), 'pairing');
assert.equal(actions.resolveRecordType(''), null);
assert.equal(actions.resolveRecordType('unknown'), null);

const formData = new FormData();
formData.set('partner_name', 'C021');
formData.set('result', 'successful');
formData.set('note', '交接を確認');
const data = actions.recordDataFromForm(formData, 'pairing');
assert.equal(data.partner_name, 'C021');
assert.equal(data.result, 'successful');
assert.equal(data.note, '交接を確認');
assert.equal(Object.hasOwn(data, 'label'), false);
const request = actions.createRecordRequest({ type: 'pairing', date: '2026-08-27', data });
assert.equal(request.jsonPayload.type, 'pairing');
assert.deepEqual(JSON.parse(JSON.stringify(request.jsonPayload.data)), {
  note: '交接を確認',
  partner_name: 'C021',
  result: 'successful',
  share_to_feed: false,
  is_best_shot: false
});
assert.equal(actions.applyRecordToAnimals([{ id: 14 }], [14], 'pairing', '2026-08-27')[0].last_pairing, '2026-08-27');

const specimen = read('assets/app/features/specimen/view.js');
assert.match(specimen, /data: \{ 'animal-id': animal\.id, 'record-type': 'pairing' \}/);
assert.match(specimen, /recordMenuItem\('ペアリング', 'pairing', 'pairing', animal\.id\)/);
assert.match(specimen, /events\.filter\(\(event\) => event\.type === 'pairing'\)/);
assert.match(specimen, /公開中の募集[\s\S]*ペアリング履歴[\s\S]*子孫・ベビー群/);

const formView = read('assets/app/features/records/record-form-view.js');
['animal_id', 'date', 'partner_name', 'result', 'note', 'image', 'share_to_feed', 'is_best_shot']
  .forEach((field) => assert.match(formView, new RegExp(`(?:name[:=] ['\"]${field}['\"]|hiddenField\\(['\"]${field}['\"])`), `${field} field missing`));
assert.match(formView, /if \(type === 'pairing'\)/);

const app = read('assets/app/app.js');
assert.doesNotMatch(app, /dataset\.recordType \|\| 'observation'/);
assert.doesNotMatch(app, /quickRecord\.type \|\| 'observation'/);
assert.match(app, /requestedRecordType\(actionElement\.dataset\.recordType, action\)/);
assert.match(app, /state\.selectedEvents = \[[\s\S]{0,500}savedEvents/);

console.log('Specimen breeding routing unit checks passed');
