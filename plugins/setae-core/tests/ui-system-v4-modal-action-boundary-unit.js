const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const overlayPath = path.join(root, 'assets/app/components/overlay-controller.js');
const primitivePath = path.join(root, 'assets/app/components/primitives.js');
const overlaySource = fs.readFileSync(overlayPath, 'utf8')
  .replace(/\bexport\s+(?=(?:const|function|class)\b)/g, '');
const context = {};
vm.createContext(context);
vm.runInContext(`${overlaySource}\nthis.resolveActionInvocation = resolveActionInvocation;`, context);

const explicit = { dataset: { action: 'save' } };
const backdrop = { dataset: { backdropAction: 'close-modal' } };
const panelTarget = {
  closest(selector) {
    if (selector === '[data-action]') return null;
    if (selector.includes('data-overlay-backdrop')) return backdrop;
    return null;
  }
};
const backdropTarget = {
  dataset: backdrop.dataset,
  closest(selector) {
    if (selector === '[data-action]') return null;
    if (selector.includes('data-overlay-backdrop')) return this;
    return null;
  }
};
const explicitTarget = {
  closest(selector) {
    return selector === '[data-action]' ? explicit : backdrop;
  }
};

const explicitResult = context.resolveActionInvocation({ target: explicitTarget });
assert.equal(explicitResult.element, explicit);
assert.equal(explicitResult.action, 'save');
assert.equal(context.resolveActionInvocation({ target: panelTarget }), null, 'panel descendants must not inherit backdrop actions');
const backdropResult = context.resolveActionInvocation({ target: backdropTarget });
assert.equal(backdropResult.element, backdropTarget);
assert.equal(backdropResult.action, 'close-modal');

const primitives = fs.readFileSync(primitivePath, 'utf8');
assert.match(primitives, /data-overlay-backdrop/);
assert.match(primitives, /data-backdrop-action/);
assert.doesNotMatch(primitives, /class="modal-backdrop[^`]*data-action=/);
assert.doesNotMatch(primitives, /class="\$\{escapeHtml\(backdropClasses\)\}"[^`]*data-action=/);
assert.match(primitives, /const resolvedBackdropAction = busy \? '' : backdropAction/);

console.log('Modal action boundary unit checks passed');
