const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const passportSelector = /\.setae-qr-(?:public-[\w-]+|profile(?:-[\w-]+)?|header-(?:inner|actions|label|share)|media-caption|identity-(?:details|heading|status)|scientific-name|owner-(?:row|toolbar|only|status)|private-(?:state|mark)|primary-action|secondary-action|(?:share|context)-actions|claim-form|requested-state|transfer-(?:state|form)|care-(?:summary|journal|timeline|entry|icon|number)|history(?:-[\w-]+)?|gallery-[\w-]+|photo-(?:count|open|dialog(?:-[\w-]+)?)|section-heading)\b/;

// Read rule boundaries without mistaking commas/braces in functions, strings or
// comments for selector separators. Media-query extensions are separate scopes.
function splitSelectors(value) {
    const selectors = [];
    let start = 0;
    let depth = 0;
    let quote = '';
    for (let i = 0; i < value.length; i += 1) {
        const ch = value[i];
        if (quote) {
            if (ch === '\\') i += 1;
            else if (ch === quote) quote = '';
        } else if (ch === '"' || ch === "'") quote = ch;
        else if (ch === '(' || ch === '[') depth += 1;
        else if (ch === ')' || ch === ']') depth -= 1;
        else if (ch === ',' && depth === 0) {
            selectors.push(value.slice(start, i).trim());
            start = i + 1;
        }
    }
    selectors.push(value.slice(start).trim());
    return selectors.filter(Boolean);
}

function parseCss(source, begin = 0, end = source.length, context = []) {
    const rules = [];
    let start = begin;
    let quote = '';
    let comment = false;
    for (let i = begin; i < end; i += 1) {
        const ch = source[i];
        if (comment) {
            if (ch === '*' && source[i + 1] === '/') { comment = false; i += 1; }
            continue;
        }
        if (quote) {
            if (ch === '\\') i += 1;
            else if (ch === quote) quote = '';
            continue;
        }
        if (ch === '/' && source[i + 1] === '*') { comment = true; i += 1; continue; }
        if (ch === '"' || ch === "'") { quote = ch; continue; }
        if (ch === ';') { start = i + 1; continue; }
        if (ch !== '{') continue;
        const open = i;
        let depth = 1;
        let innerQuote = '';
        let innerComment = false;
        for (i += 1; i < end; i += 1) {
            const inner = source[i];
            if (innerComment) {
                if (inner === '*' && source[i + 1] === '/') { innerComment = false; i += 1; }
            } else if (innerQuote) {
                if (inner === '\\') i += 1;
                else if (inner === innerQuote) innerQuote = '';
            } else if (inner === '/' && source[i + 1] === '*') { innerComment = true; i += 1; }
            else if (inner === '"' || inner === "'") innerQuote = inner;
            else if (inner === '{') depth += 1;
            else if (inner === '}' && --depth === 0) break;
        }
        assert.equal(depth, 0, 'CSS rule braces must balance.');
        const prelude = source.slice(start, open).replace(/\/\*[\s\S]*?\*\//g, '').trim();
        if (/^@(media|supports|layer|container|document)\b/.test(prelude)) {
            rules.push(...parseCss(source, open + 1, i, context.concat(prelude)));
        } else if (!prelude.startsWith('@')) {
            rules.push({ start, open, close: i, prelude, selectors: splitSelectors(prelude), body: source.slice(open + 1, i), context });
        }
        start = i + 1;
    }
    return rules;
}

function metrics(source) {
    const rules = parseCss(source);
    const selectors = rules.flatMap((rule) => rule.selectors);
    const normalized = (selector) => selector.replace(/\s+/g, ' ').trim();
    const counts = new Map();
    rules.filter((rule) => rule.context.length === 0).forEach((rule) => {
        rule.selectors.forEach((selector) => {
            const key = normalized(selector);
            counts.set(key, (counts.get(key) || 0) + 1);
        });
    });
    const declarations = rules.map((rule) => rule.body).join('\n');
    const withoutTokens = declarations.replace(/--[\w-]+\s*:[^;]+;/g, '');
    const colors = /#[\da-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\([^)]*\)/gi;
    return {
        lines: source.trimEnd().split(/\r?\n/).length,
        bytes: Buffer.byteLength(source),
        selectors: selectors.length,
        uniqueSelectors: new Set(selectors.map(normalized)).size,
        duplicateBaseSelectors: [...counts].filter(([, count]) => count > 1).length,
        duplicateBaseDefinitions: [...counts].reduce((sum, [, count]) => sum + Math.max(0, count - 1), 0),
        directColors: (withoutTokens.match(colors) || []).length,
        important: (declarations.match(/!important/g) || []).length,
    };
}

function collectCss(directory) {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const target = path.join(directory, entry.name);
        return entry.isDirectory() ? collectCss(target) : entry.name.endsWith('.css') ? [target] : [];
    });
}

function testOwnership() {
    assert.deepEqual(splitSelectors('.a:is(.b, .c), [data-caption="one,two"]'), ['.a:is(.b, .c)', '[data-caption="one,two"]']);
    assert.equal(metrics('.a { color: var(--ink); } .a { display: block; }').duplicateBaseSelectors, 1);
    assert.equal(metrics('.a { color: var(--ink); } @media (max-width: 767px) { .a { display: block; } }').duplicateBaseSelectors, 0);
    assert.equal(metrics(':root { --ink: #123456; } .a { color: #234567; }').directColors, 1);
    const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
    const foundation = read('assets/css/public-foundation.css');
    const passport = read('assets/css/public-passport.css');
    const profile = read('assets/css/public-profile.css');
    const registration = read('assets/css/public-registration.css');
    const home = read('includes/frontend/class-setae-public-home.php');
    const passportPath = path.join(root, 'assets/css/public-passport.css');
    collectCss(path.join(root, 'assets/css')).forEach((file) => {
        if (file === passportPath) return;
        parseCss(fs.readFileSync(file, 'utf8')).forEach((rule) => {
            rule.selectors.forEach((selector) => assert.doesNotMatch(selector, passportSelector,
                `${path.relative(root, file)} must not own Passport selectors.`));
        });
    });

    ['canvas', 'surface', 'surface-muted', 'ink', 'muted', 'rule', 'rule-strong', 'accent', 'danger', 'warning', 'success', 'focus',
        'space-1', 'space-2', 'space-3', 'space-4', 'space-5', 'space-6', 'radius-control', 'radius-surface', 'radius-overlay', 'touch-target']
        .forEach((token) => assert.ok(foundation.includes(`--setae-public-${token}:`), `Missing shared token ${token}`));
    assert.match(foundation, /--setae-public-font-ui:\s*system-ui,/);
    assert.doesNotMatch(foundation, /\bInter\b|@font-face|fonts\.google/);
    [['regular', 400], ['medium', 500], ['semibold', 600], ['bold', 700]].forEach(([name, weight]) => {
        assert.match(foundation, new RegExp(`--setae-public-weight-${name}:\\s*${weight}`));
    });
    ['button', 'field', 'input', 'checkbox', 'form-error', 'form-status', 'form-actions', 'dialog', 'visually-hidden']
        .forEach((primitive) => assert.ok(foundation.includes(`.setae-public-${primitive}`)));
    ['primary', 'default', 'quiet', 'danger', 'icon'].forEach((variant) => assert.ok(foundation.includes(`.setae-public-button.is-${variant}`)));
    assert.match(foundation, /--setae-public-touch-target:\s*44px/);
    assert.match(foundation, /@media \(forced-colors: active\)/);
    assert.match(foundation, /:focus-visible/);
    assert.match(foundation, /@media \(prefers-color-scheme: dark\)/);
    collectCss(path.join(root, 'assets/css')).filter((file) => /^public[^/\\]*\.css$/.test(path.basename(file))).forEach((file) => {
        assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /font-weight:\s*(?!400\b|500\b|600\b|700\b)\d+/,
            `${path.relative(root, file)} must use the four Public font weights.`);
    });

    for (const [name, source] of [['passport', passport], ['profile', profile], ['registration', registration]]) {
        assert.equal(metrics(source).directColors, 0, `${name} must use color tokens outside declarations.`);
        assert.doesNotMatch(source, /font-weight:\s*(?!400\b|500\b|600\b|700\b)\d+/, `${name} must use standard weights.`);
        parseCss(source).forEach((rule) => {
            rule.body.split(';').forEach((declaration) => {
                if (/^\s*--/.test(declaration)) return;
                assert.doesNotMatch(declaration, /(?:^|\s)(?:white|black|CanvasText|ButtonText|ButtonFace|Highlight|LinkText)(?:\s|$)/,
                    `${name} must use Foundation tokens even in forced colors.`);
            });
        });
    }
    assert.equal(metrics(passport).duplicateBaseSelectors, 0, 'Passport must define each base selector only once.');
    assert.equal(metrics(passport).important, 0, 'Passport must not need specificity overrides.');
    assert.doesNotMatch(profile, /\.setae-public-register-/);
    assert.doesNotMatch(profile, /\.setae-public-profile-button\s*\{/);
    assert.match(passport, /grid-template-columns:\s*minmax\(0, 58fr\) minmax\(0, 42fr\)/);
    assert.match(passport, /aspect-ratio:\s*4\s*\/\s*3/);
    assert.match(passport, /object-fit:\s*cover/);
    assert.match(passport, /\.setae-qr-history-item\s*\{[\s\S]*?grid-template-columns:/);
    const widthBoundaries = [...passport.matchAll(/@media\s*\(max-width:\s*(\d+)px\)/g)].map((match) => Number(match[1]));
    assert.deepEqual(widthBoundaries, [1199, 767]);
    assert.match(home, /function enqueue_passport\([\s\S]*?Setae_Public_Registration::enqueue\(\$version\)[\s\S]*?public-passport\.css[\s\S]*?public-passport\.js[\s\S]*?array\(\)/);
    assert.doesNotMatch(home, /jquery|setae-app\.js|modules\/public-qr\.js/);
    console.log('UI System v4 Public Surface ownership tests passed');
    console.log(JSON.stringify({ passport: metrics(passport) }));
}

module.exports = { parseCss, splitSelectors, metrics, passportSelector };
if (require.main === module) testOwnership();
