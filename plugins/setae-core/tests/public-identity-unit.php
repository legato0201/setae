<?php

$identity_test_users = array(
    1 => (object) array(
        'ID' => 1,
        'user_login' => 'owner@example.com',
        'user_email' => 'owner@example.com',
    ),
    2 => (object) array(
        'ID' => 2,
        'user_login' => 'private-login-name',
        'user_email' => 'keeper@example.net',
    ),
    3 => (object) array(
        'ID' => 3,
        'user_login' => 'legacy-user',
        'user_email' => 'legacy@example.org',
    ),
);
$identity_test_meta = array(
    3 => array(
        '_setae_public_handle' => 'legacy-user@example.org',
    ),
);

function absint($value)
{
    return abs((int) $value);
}

function sanitize_key($value)
{
    return preg_replace('/[^a-z0-9_-]/', '', strtolower((string) $value));
}

function get_userdata($user_id)
{
    global $identity_test_users;
    return isset($identity_test_users[$user_id]) ? $identity_test_users[$user_id] : false;
}

function get_user_meta($user_id, $key, $single)
{
    global $identity_test_meta;
    return isset($identity_test_meta[$user_id][$key]) ? $identity_test_meta[$user_id][$key] : '';
}

function update_user_meta($user_id, $key, $value)
{
    global $identity_test_meta;
    if (!isset($identity_test_meta[$user_id])) {
        $identity_test_meta[$user_id] = array();
    }
    $identity_test_meta[$user_id][$key] = $value;
    return true;
}

function wp_salt($scheme)
{
    return 'identity-test-salt-' . $scheme;
}

function home_url($path = '/')
{
    return 'https://setae.test' . $path;
}

function esc_url($value)
{
    return htmlspecialchars((string) $value, ENT_QUOTES, 'UTF-8');
}

class Public_Identity_Test_WPDB
{
    public $usermeta = 'wp_usermeta';

    public function prepare($query, ...$args)
    {
        return $args;
    }

    public function get_var($prepared)
    {
        global $identity_test_meta;
        $meta_key = isset($prepared[0]) ? $prepared[0] : '';
        $candidate = isset($prepared[1]) ? $prepared[1] : '';

        foreach ($identity_test_meta as $user_id => $meta) {
            if (isset($meta[$meta_key]) && $meta[$meta_key] === $candidate) {
                return $user_id;
            }
        }

        return null;
    }
}

function assert_identity($condition, $message)
{
    if (!$condition) {
        fwrite(STDERR, $message . PHP_EOL);
        exit(1);
    }
}

$wpdb = new Public_Identity_Test_WPDB();

require_once dirname(__DIR__) . '/includes/class-setae-public-identity.php';

$first_handle = Setae_Public_Identity::get_handle(1);
$second_handle = Setae_Public_Identity::get_handle(2);
$migrated_handle = Setae_Public_Identity::get_handle(3);

assert_identity(
    preg_match('/^st_[23456789abcdefghjkmnpqrstuvwxyz]{10}$/', $first_handle) === 1,
    'A SETAE public handle must use the expected random format.'
);
assert_identity(
    $first_handle === Setae_Public_Identity::get_handle(1),
    'A generated public handle must remain stable.'
);
assert_identity(
    $first_handle !== $second_handle,
    'Different users must receive different public handles.'
);
assert_identity(
    strpos($first_handle, 'owner') === false && strpos($first_handle, 'example') === false,
    'A public handle must not contain the login name or email address.'
);
assert_identity(
    preg_match('/^st_[23456789abcdefghjkmnpqrstuvwxyz]{10}$/', $migrated_handle) === 1,
    'An invalid legacy handle must be replaced automatically.'
);
assert_identity(
    $migrated_handle !== 'legacy-user@example.org',
    'A legacy credential-derived handle must never remain public.'
);
assert_identity(
    Setae_Public_Identity::get_handle(999) === '',
    'Unknown users must not receive public handles.'
);
assert_identity(
    Setae_Public_Identity::render_brand() === '<a class="setae-brand setae-brand-lockup" href="https://setae.test/" aria-label="SETAE">'
        . '<span class="setae-brand-icon" aria-hidden="true"></span>'
        . '<span class="setae-brand-copy"><strong class="setae-brand-title">SETAE</strong>'
        . '<small class="setae-brand-subtitle">Living Collection</small></span></a>',
    'Public pages must share the SETAE Living Collection lockup.'
);

echo "public identity tests passed\n";
