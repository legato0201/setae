const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
for (const file of ['assets/css/public-pages.css', 'assets/js/public-entry-share.js', 'assets/css/public-pages-legacy.css', 'assets/css/public-compat.css', 'assets/css/public-shared-layout.css']) {
  assert.equal(fs.existsSync(path.join(root, file)), false, `Retired asset must be removed: ${file}`);
}
const files = [];
function walk(dir) { for (const item of fs.readdirSync(dir, { withFileTypes: true })) { const file = path.join(dir, item.name); if (item.isDirectory()) walk(file); else if (/\.(php|js|css)$/.test(file)) files.push(file); } }
for (const folder of ['includes', 'templates', 'assets']) walk(path.join(root, folder));
for (const file of files) assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /enqueue_public_pages\s*\(|assets\/css\/public-pages\.css|assets\/js\/public-entry-share\.js/, `No obsolete reference in ${path.relative(root, file)}`);
const home = read('includes/frontend/class-setae-public-home.php');
for (const surface of ['care-share', 'partner']) {
  const controller = read(`includes/frontend/class-setae-public-${surface}.php`);
  const templates = fs.readdirSync(path.join(root, 'templates/public')).filter((file) => file.startsWith(surface + '-') && file.endsWith('.php')).map((file) => read('templates/public/' + file)).join('\n');
  assert.ok(fs.existsSync(path.join(root, `templates/public/${surface}-document.php`)));
  assert.ok(fs.existsSync(path.join(root, `assets/css/public-${surface}.css`)));
  assert.doesNotMatch(controller, /get_(?:header|footer)\s*\(|function\s+render_content\s*\(/);
  assert.doesNotMatch(controller, /<(?:div|main|section|article|aside|header|footer|dialog|h[1-6])\b/i, 'Controller must not own page markup.');
  assert.doesNotMatch(templates, /\b(?:get_post_meta|get_user_meta|get_comments|get_userdata|get_the_terms)\s*\(/);
  assert.doesNotMatch(templates, /\sstyle\s*=|\son(?:click|load|submit|error)\s*=/i);
  for (const script of templates.matchAll(/<script\b([^>]*)>/gi)) assert.match(script[1], /type=["']application\/(?:ld\+)?json["']|\bsrc=/i);
  assert.match(home, new RegExp('enqueue_public_' + surface.replaceAll('-', '_')));
  assert.ok(home.includes("self::enqueue_public_surface($version, '" + surface + "')"), 'Dedicated methods delegate their surface to the shared enqueue implementation.');
  assert.ok(fs.existsSync(path.join(root, `assets/js/public-${surface}.js`)));
}
assert.match(home, /'assets\/js\/public-'\s*\.\s*\$surface\s*\.\s*'\.js'/);
for (const script of ['public-share', 'public-care-share', 'public-partner']) assert.doesNotMatch(read('assets/js/' + script + '.js'), /jQuery|window\.prompt\s*\(|\$\s*\(|https?:\/\/.*(?:cdn|unpkg|jsdelivr)/);
console.log('Public pages retirement and dedicated document contracts passed');
