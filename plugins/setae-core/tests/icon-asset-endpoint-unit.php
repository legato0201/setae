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

$GLOBALS['setae_endpoint_options'] = array();
$GLOBALS['setae_endpoint_query'] = 'specimen.spider';

function get_option($key, $default = false)
{
    return array_key_exists($key, $GLOBALS['setae_endpoint_options'])
        ? $GLOBALS['setae_endpoint_options'][$key]
        : $default;
}

function update_option($key, $value, $autoload = null)
{
    $GLOBALS['setae_endpoint_options'][$key] = $value;
    return true;
}

function get_query_var($key)
{
    return $key === 'setae_icon_asset' ? $GLOBALS['setae_endpoint_query'] : '';
}

function status_header($status)
{
    $GLOBALS['setae_endpoint_status'] = $status;
}

define('SETAE_PLUGIN_DIR', dirname(__DIR__) . '/');
define('SETAE_PLUGIN_URL', 'https://setae.test/wp-content/plugins/setae-core/');

require_once dirname(__DIR__) . '/includes/class-setae-icon-registry.php';

$input = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/></svg>';
$saved = Setae_Icon_Registry::save_override('specimen.spider', $input);
if (is_wp_error($saved) || strpos($saved, 'xmlns=') !== false) {
    fwrite(STDERR, "Endpoint fixture could not persist an inline-safe specimen SVG.\n");
    exit(1);
}

$method = new ReflectionMethod(Setae_Icon_Registry::class, 'standalone_svg');
$method->setAccessible(true);
$expected = $method->invoke(null, $saved);

ob_start();
register_shutdown_function(function () use ($expected) {
    $body = ob_get_clean();
    $valid = $body === $expected
        && strpos($body, '<svg xmlns="http://www.w3.org/2000/svg"') === 0
        && substr_count($body, 'xmlns="http://www.w3.org/2000/svg"') === 1
        && strpos($body, '<!DOCTYPE html>') === false
        && strpos($body, 'Warning:') === false;
    if (!$valid) {
        fwrite(STDERR, "SVG endpoint did not emit the canonical standalone response body.\n");
        exit(1);
    }
    echo "icon asset endpoint tests passed\n";
});

Setae_Icon_Registry::maybe_render_asset();
