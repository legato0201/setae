<?php
require_once __DIR__ . '/helpers/public-passport-fixture.php';

function passport_seo_markup($controller, $data)
{
    setae_fixture_property($controller, 'page_data', $data);
    ob_start(); $controller->render_meta_tags(); $html = ob_get_clean();
    return $html . '<title>' . esc_html($controller->filter_document_title('Theme title')) . '</title>';
}
function passport_meta_value($html, $attribute, $name)
{
    preg_match('/<meta\s+' . $attribute . '="' . preg_quote($name, '/') . '"\s+content="([^"]*)"[^>]*>/i', $html, $match);
    return isset($match[1]) ? html_entity_decode($match[1], ENT_QUOTES, 'UTF-8') : null;
}

foreach (array('private', 'basic', 'life_history') as $visibility) {
    foreach (array(0, 11, 22) as $viewer) {
        foreach (array(false, true) as $transfer) {
            $name = $visibility . '/viewer=' . $viewer . '/transfer=' . (int) $transfer;
            list($controller, $context, $data) = setae_fixture_passport(array('visibility' => $visibility, 'viewer' => $viewer, 'transfer' => $transfer));
            $_GET = array('claim' => '1', 'requested' => '1', 'register' => '1', 'ref' => 'PRIVATE_REF_QUERY_247');
            $_SERVER['REQUEST_URI'] = '/r4k7m/?claim=1&requested=1&register=1&ref=PRIVATE_REF_QUERY_247';
            $data['label']['url'] = home_url($_SERVER['REQUEST_URI']);
            $html = passport_seo_markup($controller, $data);
            setae_fixture_assert(passport_meta_value($html, 'name', 'robots') === 'noindex,follow', $name . ': robots contract');
            setae_fixture_assert(strpos($html, '<link rel="canonical" href="https://setae.test/r4k7m/">') !== false, $name . ': canonical must be short URL');
            setae_fixture_assert(!preg_match('/[?&](?:amp;)?(?:claim|requested|register|ref)=/', $html), $name . ': metadata URL must not contain entry query parameters');
            foreach (array('PRIVATE_REF_QUERY', 'PRIVATE_KEEPER', 'PRIVATE_REFERRAL', '1981-01-', 'PRIVATE_PHOTO_247') as $secret) {
                setae_fixture_assert(strpos($html, $secret) === false, $name . ': metadata leak ' . $secret);
            }
            if ($visibility === 'private') {
                foreach (array('SPECIMEN_ID_247', 'Phormingochilus', 'passport-247-photo') as $secret) { setae_fixture_assert(strpos($html, $secret) === false, $name . ': private/transfer-only metadata must remain generic, including owner preview'); }
            } else {
                setae_fixture_assert(passport_meta_value($html, 'property', 'og:type') === 'profile', $name . ': og:type');
                setae_fixture_assert(strpos((string) passport_meta_value($html, 'property', 'og:title'), 'SPECIMEN_ID_247') !== false, $name . ': public title');
                setae_fixture_assert(passport_meta_value($html, 'property', 'og:url') === 'https://setae.test/r4k7m/', $name . ': og:url');
                foreach (array('og:description', 'og:image', 'og:image:alt') as $field) { setae_fixture_assert(passport_meta_value($html, 'property', $field) !== null, $name . ': ' . $field); }
                setae_fixture_assert(passport_meta_value($html, 'name', 'twitter:card') === 'summary_large_image', $name . ': Twitter card with image');
            }
        }
    }
}

list($controller, $context, $data) = setae_fixture_passport(array('visibility' => 'basic', 'photos' => 0));
$html = passport_seo_markup($controller, $data);
setae_fixture_assert(passport_meta_value($html, 'name', 'twitter:card') === 'summary', 'No-photo Twitter card');
setae_fixture_assert(passport_meta_value($html, 'property', 'og:image') === null, 'No-photo page must not invent an image');

// Basic pages and private-owner previews must not use internal record totals in SEO.
list($controller, $context, $data) = setae_fixture_passport(array('visibility' => 'basic', 'viewer' => 11));
$data['record_count'] = 918273;
$data['last_feed'] = 'PRIVATE_FEED_DATE_247';
$html = passport_seo_markup($controller, $data);
setae_fixture_assert(strpos($html, '918273') === false && strpos($html, 'PRIVATE_FEED_DATE_247') === false, 'Metadata only summarizes permitted public records');

// Escaping is checked on the actual metadata renderer, not a duplicated serializer.
$data['label']['title'] = 'Specimen "quoted" & ampersand';
$data['label']['species_name'] = 'Taxon <script>alert(247)</script>';
$html = passport_seo_markup($controller, $data);
setae_fixture_assert(strpos($html, '<script>') === false, 'Metadata must escape/remove executable input');
setae_fixture_assert(strpos($html, '&quot;quoted&quot;') !== false, 'Quoted titles must be attribute escaped');

// Sites without pretty permalinks must keep the existing routing query key.
// Only entry/tracking parameters are removed, not setae_qr itself.
$GLOBALS['setae_fixture_options']['permalink_structure'] = '';
$html = passport_seo_markup($controller, $data);
setae_fixture_assert(passport_meta_value($html, 'property', 'og:url') === 'https://setae.test/?setae_qr=r4k7m', 'Plain permalink canonical must retain the QR routing query');

echo "Public passport SEO tests passed (18 states, canonical/noindex/private metadata/escaping)\n";
