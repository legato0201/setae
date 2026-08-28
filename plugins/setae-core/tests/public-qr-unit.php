<?php

class WP_Error
{
    private $message;

    public function __construct($code, $message)
    {
        $this->message = $message;
    }

    public function get_error_message()
    {
        return $this->message;
    }
}

function is_wp_error($value)
{
    return $value instanceof WP_Error;
}

$GLOBALS['setae_public_qr_options'] = array();

function get_option($key, $default = false)
{
    return array_key_exists($key, $GLOBALS['setae_public_qr_options'])
        ? $GLOBALS['setae_public_qr_options'][$key]
        : $default;
}

function update_option($key, $value, $autoload = null)
{
    $GLOBALS['setae_public_qr_options'][$key] = $value;
    return true;
}

function wp_strip_all_tags($value)
{
    return strip_tags((string) $value);
}

function sanitize_text_field($value)
{
    return trim(strip_tags((string) $value));
}

function sanitize_key($value)
{
    return preg_replace('/[^a-z0-9_-]/', '', strtolower((string) $value));
}

function esc_url_raw($value)
{
    return filter_var((string) $value, FILTER_SANITIZE_URL);
}

function wp_timezone()
{
    return new DateTimeZone('Asia/Tokyo');
}

function assert_same($expected, $actual, $message)
{
    if ($expected !== $actual) {
        fwrite(
            STDERR,
            $message . PHP_EOL
            . 'Expected: ' . var_export($expected, true) . PHP_EOL
            . 'Actual:   ' . var_export($actual, true) . PHP_EOL
        );
        exit(1);
    }
}

define('SETAE_PLUGIN_DIR', dirname(__DIR__) . '/');
define('SETAE_PLUGIN_URL', 'https://setae.test/wp-content/plugins/setae-core/');

require_once dirname(__DIR__) . '/includes/class-setae-icon-registry.php';
require_once dirname(__DIR__) . '/includes/frontend/class-setae-public-visual.php';
require_once dirname(__DIR__) . '/includes/frontend/class-setae-public-qr.php';

$public_qr = new Setae_Public_QR('test');
$invoke = function ($method_name, ...$arguments) use ($public_qr) {
    $method = new ReflectionMethod($public_qr, $method_name);
    $method->setAccessible(true);
    return $method->invokeArgs($public_qr, $arguments);
};

assert_same(
    'Phormingochilus sp. “akcaya”',
    $invoke('normalize_display_text', 'Phormingochilus sp. &amp;#8220;akcaya&amp;#8221;'),
    'Nested HTML entities should be decoded for public display.'
);
assert_same('2026.07.25', $invoke('format_public_date', '2026-07-25', 'Y.m.d'), 'Public dates should use the requested format.');
assert_same('—', $invoke('format_public_date', 'not-a-date', 'Y.m.d'), 'Invalid public dates should use the empty marker.');
assert_same('メス', $invoke('get_gender_label', 'female'), 'Female gender label is incorrect.');

$gallery = $invoke(
    'build_public_gallery',
    array(
        'image' => 'https://setae.test/species.jpg',
        'image_source' => 'species',
    ),
    array(
        'gallery' => array(
            array(
                'url' => 'https://setae.test/log-1.jpg',
                'date' => '2026-07-20',
                'label' => '脱皮',
            ),
            array(
                'url' => 'https://setae.test/log-1.jpg',
                'date' => '2026-07-18',
                'label' => '観察',
            ),
        ),
    )
);

assert_same(2, count($gallery), 'Duplicate public gallery images should be removed.');
assert_same('https://setae.test/log-1.jpg', $gallery[0]['url'], 'Shared individual photos should precede a species fallback.');
assert_same('脱皮の記録', $gallery[0]['label'], 'Gallery care labels should describe the record.');
assert_same('種類の参考写真', $gallery[1]['label'], 'Species fallback photos should be identified clearly.');

$qr_icon = Setae_Public_Visual::icon('qr');
assert_same(true, strpos($qr_icon, '<svg') !== false && strpos($qr_icon, '<rect') !== false, 'The public QR icon should render as a real QR-style line icon.');

$custom_share = '<svg viewBox="0 0 24 24" fill="#ff3366"><circle cx="12" cy="12" r="8"/></svg>';
$save_result = Setae_Icon_Registry::save_override('public.share', $custom_share);
assert_same(false, is_wp_error($save_result), 'A safe public icon override should save.');
$share_icon = Setae_Public_Visual::icon('share');
assert_same(true, strpos($share_icon, 'fill="#ff3366"') !== false && strpos($share_icon, 'setae-icon') !== false, 'Public QR should render Registry overrides.');
Setae_Icon_Registry::reset_override('public.share');
$default_share = Setae_Public_Visual::icon('share');
assert_same(true, strpos($default_share, 'm8.59 13.51') !== false, 'Reset should restore the current public default icon.');

echo "public QR tests passed\n";
