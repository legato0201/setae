<?php

class Setae_Admin_Best_Shots
{

    public function __construct()
    {
        add_action('admin_menu', array($this, 'add_admin_menu'));
        add_action('admin_footer', array($this, 'add_admin_scripts'));
    }

    public function add_admin_menu()
    {
        // 設定メニューのサブメニューとして追加
        add_submenu_page(
            'options-general.php',
            __('Best Shots Approval', 'setae'),
            __('Best Shots Approval', 'setae'),
            'manage_options',
            'setae_best_shots',
            array($this, 'render_page')
        );
    }

    public function render_page()
    {
        echo '<div class="wrap">';
        echo '<h1>' . esc_html__('Best Shots Management', 'setae') . '</h1>';
        
        // --- 1. 承認待ちリスト ---
        echo '<h2>' . esc_html__('Pending Best Shots Approval', 'setae') . '</h2>';
        $this->render_table('pending');
        
        // --- 2. 承認済み（ギャラリー掲載中）リスト ---
        echo '<h2 style="margin-top: 40px;">' . esc_html__('Approved Best Shots (In Gallery)', 'setae') . '</h2>';
        $this->render_table('approved');

        echo '</div>';
    }

    private function render_table($status)
    {
        $args = array(
            'post_type' => 'setae_log',
            'post_status' => 'publish',
            'posts_per_page' => -1,
            'meta_query' => array(
                array(
                    'key' => '_setae_is_best_shot',
                    'value' => 1,
                ),
                array(
                    'key' => '_best_shot_status',
                    'value' => $status,
                    'compare' => '='
                )
            )
        );
        $logs = new WP_Query($args);

        echo '<table class="wp-list-table widefat fixed striped">';
        echo '<thead><tr><th style="width:100px;">' . esc_html__('Image', 'setae') . '</th><th>' . esc_html__('User', 'setae') . '</th><th>' . esc_html__('Spider', 'setae') . '</th><th>' . esc_html__('Species', 'setae') . '</th><th>' . esc_html__('Actions', 'setae') . '</th></tr></thead>';
        echo '<tbody>';

        if ($logs->have_posts()) {
            while ($logs->have_posts()) {
                $logs->the_post();
                $log_id = get_the_ID();
                $spider_id = get_post_meta($log_id, '_setae_log_spider_id', true);
                $species_id = get_post_meta($spider_id, '_setae_species_id', true);

                $image_url = get_post_meta($log_id, '_setae_log_image', true);
                $image_id = $image_url ? attachment_url_to_postid($image_url) : 0;

                $user_info = get_userdata(get_post_field('post_author', $log_id));
                $username = $user_info ? $user_info->display_name : 'Unknown';

                echo '<tr id="best-shot-row-' . esc_attr($log_id) . '">';
                echo '<td>';
                if ($image_url) {
                    echo '<a href="' . esc_url($image_url) . '" target="_blank"><img src="' . esc_url($image_url) . '" width="80" style="object-fit:cover; border-radius:4px;"></a>';
                } else {
                    echo 'No Image';
                }
                echo '</td>';
                echo '<td>' . esc_html($username) . '</td>';
                echo '<td><a href="' . get_edit_post_link($spider_id) . '" target="_blank">' . esc_html(get_the_title($spider_id)) . '</a></td>';
                echo '<td><a href="' . get_edit_post_link($species_id) . '" target="_blank">' . esc_html(get_the_title($species_id)) . '</a></td>';
                echo '<td>';

                if ($status === 'pending') {
                    if ($image_url && $species_id) {
                        echo '<button class="button button-primary btn-best-shot-action" data-action="approve" data-log-id="' . esc_attr($log_id) . '" data-species-id="' . esc_attr($species_id) . '" data-image-id="' . esc_attr($image_id) . '">' . esc_html__('Approve', 'setae') . '</button> ';
                    }
                    echo '<button class="button btn-best-shot-action" style="color:red; border-color:red;" data-action="reject" data-log-id="' . esc_attr($log_id) . '">' . esc_html__('Reject', 'setae') . '</button>';
                } else {
                    // 承認済みの場合は「取り消し（Revoke）」ボタンのみ表示
                    echo '<button class="button btn-best-shot-action" data-action="revoke" data-log-id="' . esc_attr($log_id) . '" data-species-id="' . esc_attr($species_id) . '" data-image-id="' . esc_attr($image_id) . '">' . esc_html__('Revoke (Remove from Gallery)', 'setae') . '</button>';
                }
                
                echo '</td>';
                echo '</tr>';
            }
            wp_reset_postdata();
        } else {
            echo '<tr><td colspan="5">' . esc_html__('No records found.', 'setae') . '</td></tr>';
        }

        echo '</tbody></table>';
    }

    public function add_admin_scripts()
    {
        $screen = get_current_screen();
        if (!$screen || strpos($screen->id, 'setae_best_shots') === false) {
            return;
        }
        ?>
        <script>
            jQuery(document).ready(function ($) {
                $('.btn-best-shot-action').on('click', function () {
                    var btn = $(this);
                    var actionType = btn.data('action');
                    var logId = btn.data('log-id');
                    var speciesId = btn.data('species-id') || 0;
                    var imageId = btn.data('image-id') || 0;

                    var confirmMsgApprove = '<?php echo esc_js(__("Are you sure you want to add this image to the species gallery?", "setae")); ?>';
                    var confirmMsgReject = '<?php echo esc_js(__("Are you sure you want to reject this request?", "setae")); ?>';
                    var confirmMsgRevoke = '<?php echo esc_js(__("Are you sure you want to remove this image from the gallery?", "setae")); ?>';

                    var msg = confirmMsgApprove;
                    if (actionType === 'reject') msg = confirmMsgReject;
                    if (actionType === 'revoke') msg = confirmMsgRevoke;

                    if (!confirm(msg)) return;

                    btn.prop('disabled', true).text('<?php echo esc_js(__("Processing...", "setae")); ?>');

                    $.ajax({
                        url: ajaxurl,
                        type: 'POST',
                        data: {
                            action: 'setae_handle_best_shot',
                            type: actionType,
                            log_id: logId,
                            species_id: speciesId,
                            image_id: imageId,
                            nonce: '<?php echo wp_create_nonce("setae_best_shot_nonce"); ?>'
                        },
                        success: function (response) {
                            if (response.success) {
                                // テーブルの行を消してリロードを促す（またはそのままリロードする）
                                location.reload();
                            } else {
                                alert('<?php echo esc_js(__("Error: ", "setae")); ?>' + response.data);
                                location.reload();
                            }
                        },
                        error: function () {
                            alert('<?php echo esc_js(__("A communication error occurred.", "setae")); ?>');
                            btn.prop('disabled', false);
                        }
                    });
                });
            });
        </script>
        <?php
    }
}
