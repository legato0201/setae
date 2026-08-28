<?php

function assert_contains($needle, $haystack, $message)
{
    if (strpos($haystack, $needle) === false) {
        fwrite(STDERR, $message . PHP_EOL);
        exit(1);
    }
}

function assert_not_contains($needle, $haystack, $message)
{
    if (strpos($haystack, $needle) !== false) {
        fwrite(STDERR, $message . PHP_EOL);
        exit(1);
    }
}

function assert_true($condition, $message)
{
    if (!$condition) {
        fwrite(STDERR, $message . PHP_EOL);
        exit(1);
    }
}

function assert_before($first, $second, $haystack, $message)
{
    $first_position = strpos($haystack, $first);
    $second_position = strpos($haystack, $second);
    if ($first_position === false || $second_position === false || $first_position >= $second_position) {
        fwrite(STDERR, $message . PHP_EOL);
        exit(1);
    }
}

$root = dirname(__DIR__);
$admin = file_get_contents($root . '/includes/admin/class-setae-admin-icons.php');
$registry = file_get_contents($root . '/includes/class-setae-icon-registry.php');
$script = file_get_contents($root . '/assets/admin/icon-studio.js');
$style = file_get_contents($root . '/assets/admin/icon-studio.css');
$core = file_get_contents($root . '/includes/class-setae-core.php');

assert_contains("'SETAE Icon Studio'", $admin, 'The independent Icon Studio page is missing.');
assert_contains("'SETAE Icons'", $admin, 'The Settings menu label is missing.');
assert_contains("'manage_options'", $admin, 'Icon Studio must require manage_options.');
assert_contains('check_admin_referer', $admin, 'Save actions must verify nonces.');
assert_contains('setae_save_icon_override', $admin, 'Per-icon save handler is missing.');
assert_contains('setae_reset_icon_override', $admin, 'Per-icon reset handler is missing.');
assert_contains('setae_reset_all_icon_overrides', $admin, 'Reset-all handler is missing.');
assert_contains('setae_import_icon_overrides', $admin, 'Import handler is missing.');
assert_contains('setae_export_icon_overrides', $admin, 'Export handler is missing.');
assert_contains('accept=".svg,image/svg+xml"', $admin, 'Local SVG file loading is missing.');
assert_contains('data-icon-search', $admin, 'Client-side search is missing.');
assert_contains('data-icon-category', $admin, 'Category filtering is missing.');
assert_contains('is-light', $admin, 'Light preview is missing.');
assert_contains('is-dark', $admin, 'Dark preview is missing.');
assert_contains('data-icon-preview-target', $admin, 'Live preview targets are missing.');

assert_contains("const OPTION_NAME = 'setae_icon_overrides_v1'", $registry, 'Override option name is incorrect.');
assert_contains('sanitize_svg', $registry, 'Server SVG sanitizer is missing.');
assert_contains('standalone_svg', $registry, 'Standalone SVG conversion is missing.');
assert_true(substr_count($registry, '$svg = self::standalone_svg(self::get($key));') >= 2, 'Asset URL and HTTP response must share the standalone SVG body.');
assert_contains("header('Content-Type: image/svg+xml; charset=UTF-8')", $registry, 'SVG endpoint Content-Type is incorrect.');
assert_contains("header('X-Content-Type-Options: nosniff')", $registry, 'SVG endpoint must retain nosniff.');
assert_contains('viewBox', $registry, 'viewBox validation is missing.');
assert_contains('foreignObject', $registry, 'Forbidden SVG elements are not audited.');
assert_not_contains('upload_mimes', $admin . $registry, 'Icon Studio must not enable global SVG Media uploads.');

assert_contains('sanitizeForPreview', $script, 'Client preview sanitizer is missing.');
assert_before("if (name === 'xmlns')", 'if (unsafeValue(attribute.value))', $script, 'The standard namespace must be handled before URL validation.');
assert_contains("element.removeAttribute('xmlns')", $script, 'The preview sanitizer must remove the standard namespace.');
assert_contains('現在のIcon Studioでは未対応です。', $script, 'Unsupported SVG structures need an actionable explanation.');
assert_contains('FileReader', $script, 'Local SVG/JSON file reading is missing.');
assert_contains('window.confirm', $script, 'Destructive reset confirmation is missing.');
assert_not_contains('fill: none', $style, 'Admin preview CSS must not force custom SVG fill.');
assert_contains("new Setae_Admin_Icons()", $core, 'Icon Studio is not registered by the plugin core.');

echo "icon studio tests passed\n";
