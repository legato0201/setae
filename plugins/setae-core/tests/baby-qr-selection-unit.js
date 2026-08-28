const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'assets/app/features/nursery/code-selection.js'), 'utf8')
  .replace(/^import[^;]+;\s*/m, "const babyStatusLabel = (status) => ({ alive: '生存', dead: '死亡', rehomed: '譲渡済み', transferred: '通常個体へ移動済み' })[status] || '不明';\n")
  .replace(/\bexport\s+(?=(?:async\s+)?(?:const|function|class)\b)/g, '');
const context = {};
vm.createContext(context);
vm.runInContext(`${source}\nthis.exports = { babyQrCodesFromSelection, babyQrSelectionResult, chunkBabyQrCodes, loadBabyQrTargets };`, context);

const { babyQrCodesFromSelection, babyQrSelectionResult, chunkBabyQrCodes, loadBabyQrTargets } = context.exports;
const group = {
  items: Array.from({ length: 120 }, (_, index) => ({
    code: `B${String(index + 1).padStart(3, '0')}`,
    number: index + 1,
    status: index < 78 ? 'alive' : index < 90 ? 'dead' : 'rehomed'
  }))
};

assert.equal(babyQrCodesFromSelection(group, { mode: 'alive' }).length, 78);
assert.equal(babyQrCodesFromSelection(group, { mode: 'all' }).length, 120);
assert.deepEqual([...babyQrCodesFromSelection(group, { mode: 'range', start: 1, end: 10 })], Array.from({ length: 10 }, (_, index) => `B${String(index + 1).padStart(3, '0')}`));
assert.deepEqual([...babyQrCodesFromSelection(group, { mode: 'range', start: 10, end: 1 })], Array.from({ length: 10 }, (_, index) => `B${String(index + 1).padStart(3, '0')}`));
assert.deepEqual([...babyQrCodesFromSelection(group, { mode: 'individual', selectedCodes: ['B023', 'B001', 'B005', 'B005'] })], ['B001', 'B005', 'B023']);
assert.match(babyQrSelectionResult(group, { mode: 'range', start: 0, end: 20 }).error, /1〜120/);

const unsorted = { items: [
  { code: 'B010', number: 10, status: 'alive' },
  { code: 'B002', number: 2, status: 'alive' },
  { code: 'B001', number: 1, status: 'alive' },
  { code: 'B002', number: 2, status: 'alive' }
] };
assert.deepEqual([...babyQrCodesFromSelection(unsorted, { mode: 'all' })], ['B001', 'B002', 'B010']);
assert.deepEqual([...chunkBabyQrCodes(group.items.map((item) => item.code)).map((chunk) => chunk.length)], [100, 20]);
assert.deepEqual([...chunkBabyQrCodes(Array.from({ length: 500 }, (_, index) => `C${index + 1}`)).map((chunk) => chunk.length)], [100, 100, 100, 100, 100]);

(async () => {
  const calls = [];
  const service = {
    targets: async ({ codes }) => {
      calls.push([...codes]);
      return { items: codes.map((babyCode, index) => ({ baby_code: babyCode, manage_code: babyCode, code: `k7mp${String(index).padStart(2, '2')}` })) };
    }
  };
  const response = await loadBabyQrTargets(service, 17, group.items.map((item) => item.code));
  assert.deepEqual(calls.map((chunk) => chunk.length), [100, 20]);
  assert.equal(response.count, 120);
  assert.equal(response.items[0].manage_code, 'B001');
  assert.equal(response.items.at(-1).manage_code, 'B120');
  console.log('Baby QR selection tests passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
