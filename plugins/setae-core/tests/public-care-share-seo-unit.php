<?php
require_once __DIR__ . '/helpers/public-surfaces-fixture.php';
foreach (array(true, false) as $photo) {
    foreach (array(true, false) as $pretty) {
        list($controller, $view, $item) = setae_fixture_care(array('photo' => $photo, 'tracking' => true), function () use ($pretty) {
            if (!$pretty) { $GLOBALS['setae_fixture_options']['permalink_structure'] = ''; }
        });
        $html = setae_fixture_surface_render($controller, $view, 'care');
        preg_match('/<link\s+rel="canonical"\s+href="([^"]+)"/', $html, $canonical);
        setae_fixture_assert(!empty($canonical[1]), 'Canonical exists.');
        $url = html_entity_decode($canonical[1], ENT_QUOTES, 'UTF-8');
        setae_fixture_assert($url === ($pretty ? 'https://setae.test/setae-care/401/' : 'https://setae.test/?setae_care_share=401'), 'Canonical removes referral/UTM/register but preserves routing.');
        setae_fixture_assert($view['registration']['referral_source'] === 'fixture', 'Existing incoming UTM source still reaches registration unchanged.');
        foreach (array('description', 'og:type', 'og:title', 'og:description', 'og:url', 'og:image', 'og:image:alt', 'article:published_time', 'twitter:card') as $name) {
            setae_fixture_assert(preg_match('/<meta\b[^>]*(?:name|property)="' . preg_quote($name, '/') . '"[^>]*content="[^"]+"/', $html), 'Required public metadata: ' . $name);
        }
        setae_fixture_assert(strpos($html, 'property="og:type" content="article"') !== false, 'Care remains Article metadata.');
        setae_fixture_assert($GLOBALS['setae_fixture_theme_reads'] === 0 && strpos($html, 'forbidden-theme') === false, 'OG fallback does not read a theme asset.');
        if (!$photo) { setae_fixture_assert(strpos($item['og_image'], '/setae-icon/') !== false || strpos($item['og_image'], SETAE_PLUGIN_URL . 'assets/') !== false, 'Fallback uses an existing plugin icon/brand resource.'); }
        preg_match_all('/<script\b[^>]*type="application\/ld\+json"[^>]*>(.*?)<\/script>/s', $html, $ld);
        foreach ($ld[1] as $json) {
            $data = json_decode($json, true); setae_fixture_assert(is_array($data), 'Valid JSON-LD.');
            setae_fixture_assert(!preg_match('/PRIVATE_|user_id|author_email|comment_author_IP/', $json), 'Structured data excludes private information.');
        }
    }
}
list($controller, $view) = setae_fixture_care(array(), function () {
    $GLOBALS['setae_fixture_posts'][201]->post_title = 'C014 "quoted" <script>bad</script>';
    $GLOBALS['setae_fixture_meta'][401]['_setae_log_data']['note'] = '記録 <img src=x onerror=bad> & "quoted"';
});
$html = setae_fixture_surface_render($controller, $view, 'care');
setae_fixture_assert(strpos($html, '<script>bad</script>') === false && strpos($html, '<img src=x') === false, 'Public text is escaped at HTML/metadata boundary.');
list($controller, $view) = setae_fixture_care(array('not_found' => true));
$html = setae_fixture_surface_render($controller, $view, 'care');
setae_fixture_assert(!preg_match('/Typhochlaena|C014|PRIVATE_|author_email/', $html), '404 metadata and body are generic.');
echo "Public care-share SEO tests passed (Article metadata, clean canonical, plugin fallback, escaping and private 404)\n";
