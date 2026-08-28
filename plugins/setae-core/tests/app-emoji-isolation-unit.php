<?php

function assert_app_emoji($condition, $message)
{
    if (!$condition) {
        fwrite(STDERR, $message . PHP_EOL);
        exit(1);
    }
}

$root = dirname(__DIR__);
$shell = file_get_contents($root . '/includes/frontend/class-setae-app-shell.php');
$reset = file_get_contents($root . '/assets/app/styles/reset.css');

foreach (array(
    "remove_action('wp_head', 'print_emoji_detection_script', 7)",
    "remove_action('wp_enqueue_scripts', 'wp_enqueue_emoji_styles')",
    "remove_action('wp_print_styles', 'print_emoji_styles')"
) as $expected) {
    assert_app_emoji(strpos($shell, $expected) !== false, 'Missing App emoji isolation: ' . $expected);
}

assert_app_emoji(strpos($shell, "'wp-emoji-styles'") !== false, 'WordPress emoji stylesheet must also be dequeued.');
assert_app_emoji(preg_match('/#setae-gui-root img\.emoji[\s\S]*?inline-size:\s*1em\s*!important[\s\S]*?block-size:\s*1em\s*!important/', $reset) === 1, 'Emoji image fallback must stay at 1em.');

$iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS));
foreach ($iterator as $file) {
    $path = $file->getPathname();
    if (!$file->isFile()
        || strpos($path, DIRECTORY_SEPARATOR . 'vendor' . DIRECTORY_SEPARATOR) !== false
        || basename($path) === 'THIRD_PARTY_NOTICES.md'
        || basename($path) === 'app-emoji-isolation-unit.php') {
        continue;
    }
    $contents = file_get_contents($path);
    assert_app_emoji(strpos($contents, 'assets/images/emoji/') === false, 'Dead emoji asset reference remains in ' . $path);
}

echo "App emoji isolation tests passed\n";
