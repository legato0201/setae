<?php

function assert_species_suggest($condition, $message)
{
    if (!$condition) {
        fwrite(STDERR, $message . PHP_EOL);
        exit(1);
    }
}

$root = dirname(__DIR__);
$source = file_get_contents($root . '/includes/api/class-setae-api-species.php');
$service = file_get_contents($root . '/assets/app/api/services.js');

assert_species_suggest(strpos($source, "'/species/suggest'") !== false, 'Species suggestion route is missing.');
assert_species_suggest(strpos($source, "'permission_callback' => '__return_true'") !== false, 'Species suggestions must remain publicly readable.');
assert_species_suggest(strpos($source, 'function suggest_species(') !== false, 'Species suggestion callback is missing.');
assert_species_suggest(strpos($source, "p.post_title LIKE %s") !== false, 'Scientific-name search is missing.');
assert_species_suggest(strpos($source, "common_name.meta_value LIKE %s") !== false, 'Japanese-name search is missing.');
assert_species_suggest(strpos($source, "genus_term.name LIKE %s") !== false, 'Genus search is missing.');
assert_species_suggest(preg_match('/ORDER BY CASE[\s\S]*?THEN 0[\s\S]*?THEN 1[\s\S]*?ELSE 2/', $source) === 1, 'Suggestion ranking must be exact, prefix, then partial.');
assert_species_suggest(preg_match("/'id'\s*=>[\s\S]*?'ja_name'\s*=>[\s\S]*?'scientific_name'\s*=>[\s\S]*?'genus'\s*=>/", $source) === 1, 'Suggestion response fields are incomplete.');
assert_species_suggest(strpos($service, '`/species/suggest${query({ q, limit })}`') !== false, 'GUI service is not connected to the suggestion route.');

echo "Species suggestion API tests passed\n";
