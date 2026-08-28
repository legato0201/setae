<?php

/**
 * Public breeding listings. Negotiation and direct communication intentionally
 * happen outside SETAE; this controller exposes no contracts or messages.
 */
class Setae_API_BL
{
    public function register_routes()
    {
        register_rest_route('setae/v1', '/bl-candidates', array(
            'methods' => WP_REST_Server::READABLE,
            'callback' => array($this, 'get_bl_candidates'),
            'permission_callback' => '__return_true',
        ));
    }

    public function get_bl_candidates()
    {
        $posts = get_posts(array(
            'post_type' => 'setae_spider',
            'post_status' => 'publish',
            'posts_per_page' => -1,
            'orderby' => 'modified',
            'order' => 'DESC',
            'meta_query' => array(
                array(
                    'key' => '_setae_bl_status',
                    'value' => 'recruiting',
                    'compare' => '=',
                ),
            ),
        ));

        $candidates = array();
        foreach ($posts as $post) {
            $contact_url = $this->https_url(get_post_meta($post->ID, '_setae_breeding_contact_url', true));
            if (!$contact_url) {
                continue;
            }

            $species_id = absint(get_post_meta($post->ID, '_setae_species_id', true));
            $species_name = $species_id
                ? sanitize_text_field(get_the_title($species_id))
                : sanitize_text_field(get_post_meta($post->ID, '_setae_custom_species_name', true));
            if (!$species_name) {
                $species_name = '種類不明';
            }

            $image = $this->representative_image($post->ID, $species_id);
            $contact_label = sanitize_text_field(get_post_meta($post->ID, '_setae_breeding_contact_label', true));
            $contact_label = $contact_label ? mb_substr($contact_label, 0, 80) : '外部連絡先を開く';

            $candidates[] = array(
                'id' => (int) $post->ID,
                'spider_id' => (int) $post->ID,
                'name' => sanitize_text_field($post->post_title),
                'spider_name' => sanitize_text_field($post->post_title),
                'title' => sanitize_text_field($post->post_title),
                'species' => $species_name,
                'species_name' => $species_name,
                'classification' => sanitize_key(get_post_meta($post->ID, '_setae_classification', true)) ?: 'tarantula',
                'image' => $image,
                'gender' => sanitize_key(get_post_meta($post->ID, '_setae_gender', true)) ?: 'unknown',
                'owner_id' => (int) $post->post_author,
                'owner_name' => sanitize_text_field(get_the_author_meta('display_name', $post->post_author)),
                'last_molt' => sanitize_text_field(
                    get_post_meta($post->ID, '_setae_last_molt_date', true)
                        ?: get_post_meta($post->ID, 'last_molt_date', true)
                ),
                'bl_status' => 'recruiting',
                'bl_terms' => sanitize_textarea_field(get_post_meta($post->ID, '_setae_bl_terms', true)),
                'contact_url' => $contact_url,
                'contact_label' => $contact_label,
                'can_manage' => get_current_user_id() === (int) $post->post_author,
            );
        }

        return new WP_REST_Response($candidates, 200);
    }

    private function representative_image($spider_id, $species_id)
    {
        $image = get_post_meta($spider_id, '_setae_spider_image', true);
        if (!$image) {
            $image = get_the_post_thumbnail_url($spider_id, 'medium');
        }
        if (!$image) {
            $images = get_post_meta($spider_id, '_setae_images', true);
            if (is_string($images) && strpos(ltrim($images), '[') === 0) {
                $images = json_decode($images, true);
            }
            if (is_array($images) && !empty($images[0])) {
                $image = $images[0];
            } elseif (is_string($images)) {
                $image = $images;
            }
        }
        if (!$image && $species_id) {
            $image = get_the_post_thumbnail_url($species_id, 'medium');
        }
        return $image ? esc_url_raw($image) : '';
    }

    private function https_url($value)
    {
        $url = esc_url_raw(trim((string) $value));
        if (!$url) {
            return '';
        }
        $parts = wp_parse_url($url);
        return isset($parts['scheme']) && strtolower($parts['scheme']) === 'https' ? $url : '';
    }
}
