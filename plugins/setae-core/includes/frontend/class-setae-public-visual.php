<?php

class Setae_Public_Visual
{
    /** Same public avatar priority as Keeper Profile; only presentation data leaves this helper. */
    public static function avatar_context($user_id, $display_name)
    {
        $user_id = absint($user_id);
        $display_name = is_scalar($display_name) ? trim(sanitize_text_field((string) $display_name)) : '';
        $initial = preg_match('/^./us', $display_name, $match) ? $match[0] : '?';
        $url = '';
        if ($user_id) {
            $attachment_id = absint(get_user_meta($user_id, 'setae_user_avatar', true));
            if ($attachment_id) {
                $url = wp_get_attachment_image_url($attachment_id, 'thumbnail') ?: '';
            }
            if (!$url) {
                $url = get_avatar_url($user_id, array('size' => 192)) ?: '';
                if (strpos($url, 'mystery') !== false) {
                    $url = '';
                }
            }
        }
        return array('url' => esc_url_raw($url), 'initial' => $initial);
    }

    /** Public icon placement belongs to templates, not request controllers. */
    public static function icon($name)
    {
        $aliases = array('feeding' => 'feed', 'cleaning' => 'sparkles', 'water' => 'droplet', 'health' => 'heart-pulse', 'photo' => 'image', 'record' => 'history', 'growth' => 'history');
        $name = sanitize_key($name);
        $name = $aliases[$name] ?? $name;
        $keys = Setae_Icon_Registry::public_key_map();
        return Setae_Icon_Registry::render($keys[$name] ?? $keys['history'], 'setae-icon');
    }

    public static function specimen_placeholder($args = array())
    {
        $args = wp_parse_args($args, array(
            'classification' => 'tarantula',
            'scientific_name' => '',
            'code' => '',
            'variant' => 'exhibit',
            'show_taxon' => true,
        ));

        $classification = sanitize_key($args['classification']);
        $icon_key = self::is_arachnid($classification) ? 'specimen.spider' : 'specimen.generic';
        $icon_url = Setae_Icon_Registry::asset_url($icon_key);
        $variant = in_array($args['variant'], array('exhibit', 'compact', 'thumbnail'), true)
            ? $args['variant']
            : 'exhibit';
        $scientific_name = sanitize_text_field($args['scientific_name']);
        $code = sanitize_text_field($args['code']);
        $show_taxon = (bool) $args['show_taxon'] && ($scientific_name || $code);

        ob_start();
        ?>
        <div class="setae-specimen-placeholder is-<?php echo esc_attr($variant); ?>" role="img" aria-label="標本写真は未登録です">
            <img
                class="setae-specimen-placeholder-icon"
                src="<?php echo esc_url($icon_url); ?>"
                alt=""
                aria-hidden="true"
            >
            <?php if ($show_taxon): ?>
                <div class="setae-specimen-placeholder-taxon">
                    <?php if ($scientific_name): ?><em><?php echo esc_html($scientific_name); ?></em><?php endif; ?>
                    <?php if ($code): ?><strong><?php echo esc_html($code); ?></strong><?php endif; ?>
                </div>
            <?php endif; ?>
            <small>SPECIMEN IMAGE · NOT RECORDED</small>
        </div>
        <?php
        return trim(ob_get_clean());
    }

    private static function is_arachnid($classification)
    {
        return in_array($classification, array('tarantula', 'spider', 'arachnid', 'scorpion'), true);
    }
}
