#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const themeRoot = path.resolve(__dirname, '..');
const indexSource = fs.readFileSync(path.join(themeRoot, 'index.php'), 'utf8');
const headerSource = fs.readFileSync(path.join(themeRoot, 'header.php'), 'utf8');
const styleSource = fs.readFileSync(path.join(themeRoot, 'style.css'), 'utf8');

assert.match(
  indexSource,
  /\$setae_app_requested = class_exists\('Setae_App_Shell'\)[\s\S]*?Setae_App_Shell::is_app_page_request\(\)/,
  'The theme body must delegate App routing to Setae_App_Shell.'
);
assert.match(indexSource, /\? Setae_App_Shell::app_url\(\)\s*: home_url\('\/'\)/);
assert.match(
  headerSource,
  /\$setae_header_app_requested = class_exists\('Setae_App_Shell'\)[\s\S]*?Setae_App_Shell::is_app_page_request\(\)/,
  'The document header must use the same App routing decision.'
);
assert.match(
  headerSource,
  /<\?php if \(!\$setae_header_app_requested\): \?>[\s\S]*?id="setae-preloader"[\s\S]*?<\?php endif; \?>/,
  'The legacy preloader must not render inside the new GUI.'
);
assert.match(
  indexSource,
  /if \(is_front_page\(\) && !\$setae_app_requested\) \{/,
  'The dormant marketing home must remain isolated from App requests.'
);
assert.match(
  indexSource,
  /} elseif \(\$setae_app_requested\) \{/,
  'The SETAE App must have its own explicit branch.'
);
assert.match(
  indexSource,
  /<main id="primary" class="setae-wordpress-content">/,
  'Normal WordPress requests must render the standard content branch.'
);
assert.match(indexSource, /while \(have_posts\(\)\)/);
assert.match(indexSource, /the_content\(\)/);
assert.doesNotMatch(
  indexSource,
  /^if \(!\$setae_app_requested\) \{/m,
  'A generic non-app request must not be treated as the public home.'
);
assert.match(styleSource, /^Version: 1\.0\.13$/m);

console.log('setae-theme index routing checks passed');
