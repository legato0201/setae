<?php

class Setae_API_BL
{
    public function register_routes()
    {
        // BL Candidates (募集中個体一覧)
        register_rest_route('setae/v1', '/bl-candidates', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_bl_candidates'),
            'permission_callback' => '__return_true',
        ));

        // Contracts (契約管理)
        register_rest_route('setae/v1', '/contracts', array(
            'methods' => array('GET', 'POST'),
            'callback' => array($this, 'handle_contracts'),
            'permission_callback' => function () {
                return is_user_logged_in();
            },
        ));

        // Contract Status Update
        register_rest_route('setae/v1', '/contracts/(?P<id>\d+)/status', array(
            'methods' => 'POST',
            'callback' => array($this, 'update_contract_status'),
            'permission_callback' => function () {
                return is_user_logged_in();
            },
        ));
    }

    public function get_bl_candidates($request)
    {
        $db = new Setae_BL_Contracts();
        $data = $db->get_recruiting_spiders();
        return new WP_REST_Response($data, 200);
    }

    public function handle_contracts($request)
    {
        $method = $request->get_method();
        $db = new Setae_BL_Contracts();
        $user_id = get_current_user_id();

        if ($method === 'POST') {
            $spider_id = $request->get_param('spider_id');
            $message = sanitize_textarea_field($request->get_param('message'));

            $spider = get_post($spider_id);
            if (!$spider || $spider->post_type !== 'setae_spider') {
                return new WP_Error('invalid_spider', 'Spider not found', array('status' => 404));
            }

            $owner_id = get_post_field('post_author', $spider_id);
            if ($owner_id == $user_id) {
                return new WP_Error('invalid_request', 'Cannot request your own spider', array('status' => 400));
            }

            $result = $db->create_request($owner_id, $user_id, $spider_id, $message);
            if ($result) {
                return new WP_REST_Response(array('success' => true), 201);
            }
            return new WP_Error('db_error', 'Could not create contract', array('status' => 500));

        } else {
            $contracts = $db->get_contracts_by_user($user_id);
            foreach ($contracts as $c) {
                $c->spider_name = get_the_title($c->spider_id);
                // 画像取得を追加
                $c->spider_image = get_the_post_thumbnail_url($c->spider_id, 'thumbnail') ?: SETAE_PLUGIN_URL . 'assets/images/default-spider.png';
                $c->owner_name = get_the_author_meta('display_name', $c->owner_id);
                $c->breeder_name = get_the_author_meta('display_name', $c->breeder_id);

                // 自分がどちらの立場か判定フラグ
                $c->is_owner = ($c->owner_id == $user_id);
                $c->display_status = $this->get_status_label($c->status);
            }
            return new WP_REST_Response($contracts, 200);
        }
    }

    private function get_status_label($status)
    {
        $labels = [
            'REQUESTED' => '申請中',
            'APPROVED' => '承認済',
            'REJECTED' => '却下',
            'PAIRED' => 'ペアリング中',
            'SUCCESS' => '繁殖成功',
            'FAIL' => '繁殖失敗'
        ];
        return isset($labels[$status]) ? $labels[$status] : $status;
    }

    public function update_contract_status($request)
    {
        $id = $request['id'];
        $status = $request->get_param('status');
        $db = new Setae_BL_Contracts();
        $contract = $db->get_contract($id);

        if (!$contract) {
            return new WP_Error('not_found', 'Contract not found', array('status' => 404));
        }

        $user_id = get_current_user_id();
        if ($contract->owner_id != $user_id && $contract->breeder_id != $user_id) {
            return new WP_Error('forbidden', 'You are not part of this contract', array('status' => 403));
        }

        $result = $db->update_status($id, $status);
        return new WP_REST_Response(array('success' => !!$result), 200);
    }
}
