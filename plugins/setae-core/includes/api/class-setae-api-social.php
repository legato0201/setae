<?php

/**
 * Stores the viewer-specific relationships used by the social surfaces.
 */
class Setae_API_Social
{
    const FOLLOWING_META_KEY = '_setae_social_following';
    const BLOCKED_META_KEY = '_setae_social_blocked_users';

    public function register_routes()
    {
        $namespace = 'setae/v1';

        register_rest_route($namespace, '/social/relationships', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_relationships'),
            'permission_callback' => array($this, 'check_auth'),
        ));

        register_rest_route($namespace, '/social/users/(?P<id>\d+)/follow', array(
            'methods' => 'POST',
            'callback' => array($this, 'follow_user'),
            'permission_callback' => array($this, 'check_auth'),
        ));

        register_rest_route($namespace, '/social/users/(?P<id>\d+)/follow', array(
            'methods' => 'DELETE',
            'callback' => array($this, 'unfollow_user'),
            'permission_callback' => array($this, 'check_auth'),
        ));

        register_rest_route($namespace, '/social/users/(?P<id>\d+)/block', array(
            'methods' => 'POST',
            'callback' => array($this, 'block_user'),
            'permission_callback' => array($this, 'check_auth'),
        ));

        register_rest_route($namespace, '/social/users/(?P<id>\d+)/block', array(
            'methods' => 'DELETE',
            'callback' => array($this, 'unblock_user'),
            'permission_callback' => array($this, 'check_auth'),
        ));
    }

    public function check_auth()
    {
        return is_user_logged_in();
    }

    public static function get_followed_user_ids($user_id)
    {
        return self::get_user_id_list($user_id, self::FOLLOWING_META_KEY);
    }

    public static function get_blocked_user_ids($user_id)
    {
        return self::get_user_id_list($user_id, self::BLOCKED_META_KEY);
    }

    public static function is_user_blocked($viewer_id, $target_id)
    {
        $viewer_id = absint($viewer_id);
        $target_id = absint($target_id);
        if (!$viewer_id || !$target_id || $viewer_id === $target_id) {
            return false;
        }

        return in_array($target_id, self::get_blocked_user_ids($viewer_id), true);
    }

    public static function get_relationship($viewer_id, $target_id)
    {
        $viewer_id = absint($viewer_id);
        $target_id = absint($target_id);
        $is_self = $viewer_id && $target_id && $viewer_id === $target_id;

        return array(
            'is_self' => (bool) $is_self,
            'following' => !$is_self && $viewer_id && $target_id && in_array($target_id, self::get_followed_user_ids($viewer_id), true),
            'blocked' => !$is_self && self::is_user_blocked($viewer_id, $target_id),
        );
    }

    public function get_relationships($request)
    {
        $user_id = get_current_user_id();
        $following = self::get_followed_user_ids($user_id);
        $blocked = self::get_blocked_user_ids($user_id);

        return new WP_REST_Response(array(
            'following' => $this->build_user_summaries($following),
            'blocked' => $this->build_user_summaries($blocked),
            'following_count' => count($following),
            'blocked_count' => count($blocked),
        ), 200);
    }

    public function follow_user($request)
    {
        $user_id = get_current_user_id();
        $target_id = $this->validate_target($request['id'], $user_id);
        if (is_wp_error($target_id)) {
            return $target_id;
        }

        if (self::is_user_blocked($user_id, $target_id)) {
            return new WP_Error('target_blocked', 'ブロックを解除してからフォローしてください。', array('status' => 409));
        }

        $following = self::get_followed_user_ids($user_id);
        if (!in_array($target_id, $following, true)) {
            $following[] = $target_id;
            self::save_user_id_list($user_id, self::FOLLOWING_META_KEY, $following);
        }

        return $this->relationship_response($user_id, $target_id);
    }

    public function unfollow_user($request)
    {
        $user_id = get_current_user_id();
        $target_id = $this->validate_target($request['id'], $user_id);
        if (is_wp_error($target_id)) {
            return $target_id;
        }

        $following = array_values(array_diff(self::get_followed_user_ids($user_id), array($target_id)));
        self::save_user_id_list($user_id, self::FOLLOWING_META_KEY, $following);

        return $this->relationship_response($user_id, $target_id);
    }

    public function block_user($request)
    {
        $user_id = get_current_user_id();
        $target_id = $this->validate_target($request['id'], $user_id);
        if (is_wp_error($target_id)) {
            return $target_id;
        }

        $blocked = self::get_blocked_user_ids($user_id);
        if (!in_array($target_id, $blocked, true)) {
            $blocked[] = $target_id;
            self::save_user_id_list($user_id, self::BLOCKED_META_KEY, $blocked);
        }

        $following = array_values(array_diff(self::get_followed_user_ids($user_id), array($target_id)));
        self::save_user_id_list($user_id, self::FOLLOWING_META_KEY, $following);

        return $this->relationship_response($user_id, $target_id);
    }

    public function unblock_user($request)
    {
        $user_id = get_current_user_id();
        $target_id = $this->validate_target($request['id'], $user_id);
        if (is_wp_error($target_id)) {
            return $target_id;
        }

        $blocked = array_values(array_diff(self::get_blocked_user_ids($user_id), array($target_id)));
        self::save_user_id_list($user_id, self::BLOCKED_META_KEY, $blocked);

        return $this->relationship_response($user_id, $target_id);
    }

    private static function get_user_id_list($user_id, $meta_key)
    {
        $user_id = absint($user_id);
        if (!$user_id) {
            return array();
        }

        $raw_ids = get_user_meta($user_id, $meta_key, true);
        if (!is_array($raw_ids)) {
            return array();
        }

        $ids = array_values(array_unique(array_filter(array_map('absint', $raw_ids))));
        return array_values(array_filter($ids, function ($id) {
            return (bool) get_userdata($id);
        }));
    }

    private static function save_user_id_list($user_id, $meta_key, $ids)
    {
        $ids = array_values(array_unique(array_filter(array_map('absint', $ids))));
        if (empty($ids)) {
            delete_user_meta($user_id, $meta_key);
            return;
        }

        update_user_meta($user_id, $meta_key, $ids);
    }

    private function validate_target($target_id, $viewer_id)
    {
        $target_id = absint($target_id);
        if (!$target_id || !get_userdata($target_id)) {
            return new WP_Error('user_not_found', 'ユーザーが見つかりません。', array('status' => 404));
        }

        if ($target_id === (int) $viewer_id) {
            return new WP_Error('invalid_target', '自分自身にはこの操作を行えません。', array('status' => 400));
        }

        return $target_id;
    }

    private function relationship_response($viewer_id, $target_id)
    {
        return new WP_REST_Response(array(
            'success' => true,
            'relationship' => self::get_relationship($viewer_id, $target_id),
            'following_count' => count(self::get_followed_user_ids($viewer_id)),
            'blocked_count' => count(self::get_blocked_user_ids($viewer_id)),
        ), 200);
    }

    private function build_user_summaries($user_ids)
    {
        $users = array();
        foreach ($user_ids as $user_id) {
            $user = get_userdata($user_id);
            if (!$user) {
                continue;
            }

            $avatar = get_avatar_url($user_id);
            if ($avatar && strpos($avatar, 'mystery') !== false) {
                $avatar = '';
            }
            $name = $user->display_name ?: 'ユーザー不明';

            $users[] = array(
                'id' => (int) $user_id,
                'name' => $name,
                'handle' => Setae_Public_Identity::get_handle($user_id),
                'avatar' => $avatar,
                'initial' => function_exists('mb_substr') ? mb_substr($name, 0, 1, 'UTF-8') : substr($name, 0, 1),
            );
        }

        return $users;
    }
}
