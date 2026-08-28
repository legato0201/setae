const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const pluginRoot = path.resolve(__dirname, '..');

function read(relativePath) {
    return fs.readFileSync(path.join(pluginRoot, relativePath), 'utf8');
}

function assertBalancedCss(source, label) {
    const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, '');
    assert.equal(
        (withoutComments.match(/\{/g) || []).length,
        (withoutComments.match(/\}/g) || []).length,
        `${label} must have balanced braces.`
    );
}

const template = read('templates/partials/modals.php');
const modalCss = read('assets/css/modules/modals.css');
const globalCss = read('assets/css/setae-global.css');
const publicHomeCss = read('assets/css/public-home.css');
const darkCss = read('assets/css/modules/dark-mode.css');
const addSpiderSource = read('assets/js/modules/ui/add-spider.js');

assert.match(template, /class="setae-modal-content setae-add-spider-dialog"/);
assert.match(template, /class="setae-add-spider-header"/);
assert.match(template, /class="setae-add-spider-layout"/);
assert.match(template, /class="setae-add-spider-form-pane"/);
assert.match(template, /class="setae-add-spider-preview-pane"/);
assert.match(template, /id="add-spider-card-preview" class="setae-add-card-preview"/);
assert.match(template, /id="add-spider-preview-image"/);
assert.match(template, /id="add-spider-preview-species"/);
assert.match(template, /id="add-spider-preview-name"/);
assert.match(template, /class="setae-add-spider-footer"/);
assert.match(template, /class="setae-btn setae-btn-primary setae-add-spider-submit"/);
assert.match(template, /data-label="<\?php echo esc_attr\(\$term->name\); \?>"/);
assert.match(template, /data-mark="<\?php echo esc_attr\(\$icon\); \?>"/);
assert.doesNotMatch(
    template,
    /id="btn-trigger-upload-add"[^>]*style=/
);

assert.match(
    modalCss,
    /#modal-add-spider \.setae-add-spider-dialog\s*\{[\s\S]*?max-width:\s*980px;[\s\S]*?border-radius:\s*16px;/
);
assert.match(
    modalCss,
    /\.setae-add-spider-layout\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1\.12fr\) minmax\(300px, 0\.88fr\);/
);
assert.match(
    modalCss,
    /\.setae-add-card-preview\s*\{[\s\S]*?border-radius:\s*16px;[\s\S]*?box-shadow:/
);
assert.match(
    modalCss,
    /@media \(max-width: 767px\)[\s\S]*?\.setae-add-spider-layout\s*\{[\s\S]*?display:\s*block;/
);
assert.match(
    modalCss,
    /@media \(max-width: 767px\)[\s\S]*?#form-add-spider \.setae-add-spider-submit\s*\{[\s\S]*?width:\s*100%;/
);

assert.match(
    publicHomeCss,
    /\.setae-register-heading\s*\{[\s\S]*?padding:\s*4px 48px 4px 12px;/
);
assert.match(
    publicHomeCss,
    /\.setae-register-dialog > \.setae-register-heading\s*\{[\s\S]*?padding:\s*32px 68px 0 32px;/
);

assert.match(addSpiderSource, /function updateAddSpiderCardPreview\(\)/);
assert.match(addSpiderSource, /function setAddSpiderCardPreviewImage\(source\)/);
assert.match(addSpiderSource, /#spider-species-search, #spider-custom-species, #spider-name/);
assert.match(addSpiderSource, /#add-spider-preview-primary-label/);
assert.match(addSpiderSource, /#add-spider-preview-secondary-label/);
assert.match(addSpiderSource, /const originalContent = \$btn\.html\(\);/);
assert.match(addSpiderSource, /\.removeClass\('is-loading'\)\.html\(originalContent\)/);
assert.doesNotMatch(addSpiderSource, /\$btn\.prop\('disabled', false\)\.text\(originalText\)/);

assert.match(
    darkCss,
    /#modal-add-spider \.setae-add-spider-dialog\s*\{[\s\S]*?background:\s*var\(--setae-surface-raised\) !important;/
);
assert.match(
    darkCss,
    /#modal-add-spider \.setae-add-card-preview\s*\{[\s\S]*?color:\s*var\(--setae-ink\) !important;/
);
assert.match(
    darkCss,
    /#modal-add-spider #form-add-spider \.setae-add-spider-submit\s*\{[\s\S]*?color:\s*#102218 !important;/
);

assertBalancedCss(modalCss, 'Modal CSS');
assertBalancedCss(globalCss, 'Global CSS');
assertBalancedCss(publicHomeCss, 'Public home CSS');
assertBalancedCss(darkCss, 'Dark CSS');

console.log('Add-spider registration experience tests passed');
