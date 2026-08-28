const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const controller = read('includes/frontend/class-setae-public-qr.php');
const documentTemplate = read('templates/public/passport-document.php');
const content = read('templates/public/passport-content.php');
const photoDialog = read('templates/public/passport-photo-dialog.php');
const script = read('assets/js/public-passport.js');
const css = read('assets/css/public-passport.css');
const home = read('includes/frontend/class-setae-public-home.php');
const templates = fs.readdirSync(path.join(root, 'templates/public')).filter((name) => /^passport-.*\.php$/.test(name)).map((name) => read('templates/public/' + name)).join('\n');

assert.match(documentTemplate, /<!doctype html>/i, 'The passport owns its HTML document.');
for (const hook of ['language_attributes', 'wp_head', 'wp_body_open', 'wp_footer']) assert.match(documentTemplate, new RegExp(hook + '\\s*\\('));
for (const method of ['resolve_passport_mode', 'build_template_context', 'build_seo_context', 'render_document']) assert.match(controller, new RegExp('function\\s+' + method + '\\s*\\('));
assert.match(controller, /templates\/public\/passport-document\.php/);
assert.match(controller, /show_admin_bar\(false\)/, 'The standalone document must not depend on the installed theme to hide the WordPress admin bar.');
assert.match(controller, /remove_action\('wp_head', 'print_emoji_detection_script', 7\)/, 'Core emoji inline execution must be removed outside the script enqueue queue.');
assert.doesNotMatch(controller, /function\s+render_content\s*\(|function\s+render_registration_modal\s*\(/);
assert.doesNotMatch(controller, /<(?:div|section|article|aside|dialog|main|header|footer|h[1-6])\b/i, 'Page layout belongs in templates, not the controller.');
assert.doesNotMatch(controller + templates, /\bget_(?:header|footer)\s*\(/, 'The passport cannot depend on a theme header/footer.');
assert.doesNotMatch(templates, /\b(?:get_post_meta|get_user_meta|get_posts|WP_Query|get_userdata)\s*\(/, 'Views may not retrieve additional private data.');
assert.doesNotMatch(templates, /\sstyle\s*=|\son(?:click|load|submit|error)\s*=/i, 'No inline style or event handler.');
for (const tag of templates.matchAll(/<script\b([^>]*)>/gi)) assert.match(tag[1], /type\s*=\s*["']application\/(?:ld\+)?json["']|\bsrc\s*=/i, 'Inline scripts must be inert JSON data.');
assert.match(controller + templates, /Setae_Public_Registration::(?:build_context|render)/);
assert.match(controller + home, /assets\/js\/public-passport\.js/);
assert.doesNotMatch(controller + home, /assets\/js\/modules\/public-qr\.js/);
assert.doesNotMatch(script, /\bjQuery\b|\$\s*\(|\.fade(?:In|Out)\s*\(|\b(?:localStorage|sessionStorage)\b/);

assert.match(photoDialog, /<dialog\b/);
assert.match(photoDialog, /aria-labelledby=/);
assert.match(photoDialog, /aria-label=/);
for (const behavior of ['showModal', 'ArrowLeft', 'ArrowRight', 'Escape', 'AbortError', 'clipboard', 'share']) assert.ok(script.includes(behavior), 'Passport JS must implement ' + behavior);
assert.match(script, /(?:\.focus\(|focus\?\.\()/, 'Photo dialog restores focus.');
assert.match(script, /aria-live|(?:live|status)/i);
assert.match(templates, /aria-live="polite"/);
assert.match(templates, /loading="eager"/);
assert.match(templates, /decoding="async"/);
assert.match(templates, /fetchpriority="high"/);
assert.match(templates, /width="4"\s+height="3"/);
assert.match(templates, /loading="lazy"/);
assert.match(script, /fetchPriority\s*=\s*['"]low['"]/);
assert.match(templates, /<dl\b/);
assert.match(templates, /<time\b/);
assert.match(content, /Setae_Public_Identity::render_brand/);
assert.match(controller + templates, /公開個体・基本情報/);
assert.match(controller + templates, /公開個体・生活史/);
assert.match(controller + templates, /所有者だけに表示/);
assert.match(controller + templates, /管理番号/);
assert.match(controller, /幼体/);
assert.match(controller, /亜成体/);
assert.match(controller, /成体/);
assert.match(controller, /未判定/);
assert.doesNotMatch(templates, />\s*(?:ACCESSION|Stage|Origin|PHOTO|PHOTOS|PRIVATE PREVIEW|TRANSFER LABEL)\b/i);

assert.match(css, /aspect-ratio:\s*4\s*\/\s*3/);
assert.match(css, /object-fit:\s*cover/);
assert.match(css, /@media\s*\(forced-colors:\s*active\)/);
assert.match(css, /prefers-reduced-motion/);
assert.doesNotMatch(css, /@(?:import|font-face)/, 'The passport must not fetch external font or legacy CSS.');
assert.doesNotMatch(css, /(?:max|min)-width:\s*(?:420|480|650|900)px/, 'Use the shared responsive bands.');
assert.equal((css.match(/\{/g) || []).length, (css.match(/\}/g) || []).length, 'Balanced CSS.');

// Execute the shipped script at a minimal DOM boundary to observe Image
// construction/priority. Full native dialog/focus behavior is covered in the
// browser suite; this checks that navigation never preloads the whole gallery.
function photoRuntime(photos) {
    const preloads = [];
    const document = { readyState: 'complete', baseURI: 'https://setae.test/r4k7m/', title: 'Passport' };
    const node = (attrs = {}) => ({
        attrs: { ...attrs }, listeners: {}, textContent: '', hidden: false, isConnected: true,
        classList: { add() {}, remove() {} },
        getAttribute(name) { return this.attrs[name] ?? null; },
        setAttribute(name, value) { this.attrs[name] = String(value); },
        addEventListener(name, callback) { (this.listeners[name] ||= []).push(callback); },
        emit(name, event = {}) { for (const callback of this.listeners[name] || []) callback(event); },
        focus() { document.activeElement = this; }
    });
    const fields = Object.fromEntries(['image', 'label', 'date', 'count', 'close', 'prev', 'next'].map((name) => [name, node()]));
    const dialog = node();
    dialog.open = false;
    dialog.querySelector = (selector) => fields[selector.match(/photo-(\w+)/)[1]];
    dialog.showModal = () => { dialog.open = true; };
    dialog.close = () => { dialog.open = false; dialog.emit('close'); };
    const trigger = node({ 'data-public-photo-index': '0' });
    const data = node();
    data.textContent = JSON.stringify(photos);
    const page = node();
    page.querySelector = (selector) => ({
        '[data-setae-public-photo-data]': data,
        '[data-setae-public-photo-dialog]': dialog
    })[selector] || null;
    page.querySelectorAll = (selector) => selector === '.js-setae-public-photo' ? [trigger] : [];
    document.querySelectorAll = (selector) => selector === '.setae-qr-public-page' ? [page] : [];
    document.documentElement = node();
    class RuntimeImage {
        set src(value) { preloads.push({ url: value, priority: this.fetchPriority, decoding: this.decoding }); }
    }
    vm.runInNewContext(script, {
        document, navigator: {}, Image: RuntimeImage, URL,
        window: { addEventListener() {}, clearTimeout() {}, setTimeout() {} }
    }, { filename: 'public-passport.js' });
    return { preloads, fields, dialog, trigger };
}

const ninePhotos = Array.from({ length: 9 }, (_, index) => ({ url: `https://setae.test/photos/${index}.jpg`, label: `写真 ${index}`, date: '2026-08-01' }));
const nineRuntime = photoRuntime(ninePhotos);
assert.deepEqual(nineRuntime.preloads, [], 'The initial page must not preload dialog photos.');
nineRuntime.trigger.emit('click');
assert.equal(nineRuntime.fields.image.src, ninePhotos[0].url);
assert.deepEqual(nineRuntime.preloads, [
    { url: ninePhotos[1].url, priority: 'low', decoding: 'async' },
    { url: ninePhotos[8].url, priority: 'low', decoding: 'async' }
], 'Opening a photo only preloads its two neighbors at low priority.');
nineRuntime.preloads.length = 0;
nineRuntime.fields.next.emit('click');
assert.equal(nineRuntime.fields.image.src, ninePhotos[1].url);
assert.deepEqual(nineRuntime.preloads, [
    { url: ninePhotos[2].url, priority: 'low', decoding: 'async' },
    { url: ninePhotos[0].url, priority: 'low', decoding: 'async' }
], 'Next navigation updates the neighboring pair instead of fetching all photos.');

const oneRuntime = photoRuntime(ninePhotos.slice(0, 1));
oneRuntime.trigger.emit('click');
assert.deepEqual(oneRuntime.preloads, [], 'A single photo has no neighboring requests.');
assert.equal(oneRuntime.fields.count.textContent, '写真1 / 1点');
const twoRuntime = photoRuntime(ninePhotos.slice(0, 2));
twoRuntime.trigger.emit('click');
assert.equal(twoRuntime.preloads.length, 1, 'Identical previous/next neighbor URLs are deduplicated.');
assert.equal(twoRuntime.preloads[0].url, ninePhotos[1].url);

const filteredRuntime = photoRuntime([ninePhotos[0], { url: 'javascript:alert(1)' }, { url: 'data:image/svg+xml,<svg/>' }]);
filteredRuntime.trigger.emit('click');
assert.equal(filteredRuntime.fields.count.textContent, '写真1 / 1点', 'Only HTTP(S) photos enter the active gallery.');
assert.deepEqual(filteredRuntime.preloads, [], 'Rejected photo schemes cannot be prefetched.');

console.log('Public passport architecture, interaction contract and actual-script photo prefetch tests passed');
