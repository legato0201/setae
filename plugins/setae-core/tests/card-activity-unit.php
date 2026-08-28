<?php

define('ARRAY_A', 'ARRAY_A');
define('DAY_IN_SECONDS', 86400);

function absint($value)
{
    return abs((int) $value);
}

function sanitize_key($value)
{
    return preg_replace('/[^a-z0-9_-]/', '', strtolower((string) $value));
}

function sanitize_text_field($value)
{
    return trim(strip_tags((string) $value));
}

function current_time($type)
{
    if ($type === 'timestamp') {
        return strtotime('2026-07-24 12:00:00');
    }

    if ($type === 'Y-m-d') {
        return '2026-07-24';
    }

    return '2026-07-24T12:00:00+09:00';
}

class Card_Activity_Test_WPDB
{
    public $posts = 'wp_posts';
    public $postmeta = 'wp_postmeta';
    public $prepared_query = '';
    public $prepared_args = array();
    public $rows = array();

    public function prepare($query, $args)
    {
        $this->prepared_query = $query;
        $this->prepared_args = $args;
        return $query;
    }

    public function get_results($query, $output)
    {
        return $this->rows;
    }
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

$wpdb = new Card_Activity_Test_WPDB();
$wpdb->rows = array(
    array(
        'log_id' => 109,
        'spider_id' => 12,
        'event_type' => 'feed',
        'event_date' => '2026-07-24',
        'event_data' => '{"refused":false}',
    ),
    array(
        'log_id' => 108,
        'spider_id' => 12,
        'event_type' => 'feed',
        'event_date' => '2026-07-24',
        'event_data' => '{"refused":true}',
    ),
    array(
        'log_id' => 107,
        'spider_id' => 12,
        'event_type' => 'molt',
        'event_date' => '2026-07-10',
        'event_data' => '',
    ),
    array(
        'log_id' => 1051,
        'spider_id' => 34,
        'event_type' => 'feed',
        'event_date' => '2026-07-23',
        'event_data' => '{"refused":"false"}',
    ),
    array(
        'log_id' => 106,
        'spider_id' => 34,
        'event_type' => 'observation',
        'event_date' => '2026-05-01',
        'event_data' => '',
    ),
    array(
        'log_id' => 105,
        'spider_id' => 99,
        'event_type' => 'feed',
        'event_date' => '2026-07-20',
        'event_data' => '',
    ),
    array(
        'log_id' => 104,
        'spider_id' => 12,
        'event_type' => 'unknown',
        'event_date' => '2026-07-20',
        'event_data' => '',
    ),
    array(
        'log_id' => 103,
        'spider_id' => 12,
        'event_type' => 'growth',
        'event_date' => 'invalid',
        'event_data' => '',
    ),
);
for ($index = 0; $index < 20; $index++) {
    $wpdb->rows[] = array(
        'log_id' => 200 - $index,
        'spider_id' => 56,
        'event_type' => 'feed',
        'event_date' => date('Y-m-d', strtotime('2026-07-23 -' . $index . ' days')),
        'event_data' => '',
    );
}

require_once dirname(__DIR__) . '/includes/api/class-setae-api-spiders.php';

$api = new Setae_API_Spiders();
$method = new ReflectionMethod($api, 'get_card_activity_map');
$method->setAccessible(true);
$result = $method->invoke($api, array(12, '34', 0, -12, 34, 56), 90);

assert_same(array(12, 34, 56, '2026-04-26', '2026-07-24'), $wpdb->prepared_args, 'The batch query arguments are incorrect.');
assert_same(3, $result[12]['total'], 'Raw record total should include same-day records.');
assert_same(2, $result[12]['counts']['feed'], 'Feed count should include both same-day records.');
assert_same(1, $result[12]['counts']['molt'], 'Molt count is incorrect.');
assert_same(2, count($result[12]['events']), 'Same-day records should collapse into one chart mark.');
assert_same(2, $result[12]['events'][0]['count'], 'Collapsed mark count is incorrect.');
assert_same(true, $result[12]['events'][0]['refused'], 'A refusal in a collapsed feed mark must remain visible.');
assert_same(2, $result[12]['weekly'][12], 'The current-week density should include every raw record.');
assert_same(1, $result[12]['weekly'][10], 'The earlier-week density is incorrect.');
assert_same(1, $result[34]['counts']['observation'], 'Second spider aggregation is incorrect.');
assert_same(1, $result[34]['weekly'][0], 'The oldest activity should remain in the first density bucket.');
assert_same(false, isset($result[34]['events'][0]['refused']), 'A string false value must not render as a refusal.');
assert_same(20, $result[56]['total'], 'Dense histories must retain their complete total.');
assert_same(18, count($result[56]['events']), 'Chart marks should be capped without inflating the payload.');
assert_same(20, array_sum($result[56]['weekly']), 'Weekly density must retain records omitted from chart marks.');
assert_same(false, isset($result[99]), 'Rows outside the requested spider IDs must not be exposed.');

echo "card activity tests passed\n";
