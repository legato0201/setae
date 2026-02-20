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
        // 未承認（pending）のBest Shotログを取得
        $args = array(
            'post_type' => 'setae_log',
            'post_status' => 'publish',
            'posts_per_page' => -1,
            'meta_query' => array(
                array(
                    'key' => '_is_best_shot',
                    'value' => 1,
                ),
                array(
                    'key' => '_best_shot_status',
                    'value' => 'pending',
                    'compare' => '='
                )
            )
        );
        $logs = new WP_Query($args);

        echo '<div class="wrap">';
        echo '<h1>' . esc_html__('Pending Best Shots Approval', 'setae') . '</h1>';
        echo '<table class="wp-list-table widefat fixed striped">';
        echo '<thead><tr><th style="width:100px;">' . esc_html__('Image', 'setae') . '</th><th>' . esc_html__('User', 'setae') . '</th><th>' . esc_html__('Spider', 'setae') . '</th><th>' . esc_html__('Species', 'setae') . '</th><th>' . esc_html__('Actions', 'setae') . '</th></tr></thead>';
        echo '<tbody>';

        if ($logs->have_posts()) {
            while ($logs->have_posts()) {
                $logs->the_post();
                $log_id = get_the_ID();
                $spider_id = get_post_meta($log_id, '_setae_spider_id', true);
                $species_id = get_post_meta($spider_id, '_setae_species_id', true);

                // サムネイル画像を取得（実装に合わせてメタキーを変更してください）
                $image_id = get_post_thumbnail_id($log_id);
                if (!$image_id) {
                    $image_id = get_post_meta($log_id, '_setae_image_id', true);
                }
                $image_url = wp_get_attachment_image_url($image_id, 'thumbnail');

                $user_info = get_userdata(get_post_field('post_author', $log_id));
                $username = $user_info ? $user_info->display_name : 'Unknown';

                echo '<tr id="best-shot-row-' . esc_attr($log_id) . '">';
                echo '<td>';
                if ($image_url) {
                    echo '<a href="' . esc_url(wp_get_attachment_url($image_id)) . '" target="_blank"><img src="' . esc_url($image_url) . '" width="80" style="object-fit:cover; border-radius:4px;"></a>';
                } else {
                    echo 'No Image';
                }
                echo '</td>';
                echo '<td>' . esc_html($username) . '</td>';
                echo '<td><a href="' . get_edit_post_link($spider_id) . '" target="_blank">' . esc_html(get_the_title($spider_id)) . '</a></td>';
                echo '<td><a href="' . get_edit_post_link($species_id) . '" target="_blank">' . esc_html(get_the_title($species_id)) . '</a></td>';
                echo '<td>';
                if ($image_url && $species_id) {
                    echo '<button class="button button-primary btn-best-shot-action" data-action="approve" data-log-id="' . esc_attr($log_id) . '" data-species-id="' . esc_attr($species_id) . '" data-image-id="' . esc_attr($image_id) . '">' . esc_html__('Approve', 'setae') . '</button> ';
                }
                echo '<button class="button btn-best-shot-action" style="color:red; border-color:red;" data-action="reject" data-log-id="' . esc_attr($log_id) . '">' . esc_html__('Reject', 'setae') . '</button>';
                echo '</td>';
                echo '</tr>';
            }
            wp_reset_postdata();
        } else {
            echo '<tr><td colspan="5">' . esc_html__('There are currently no pending Best Shots.', 'setae') . '</td></tr>';
        }

        echo '</tbody></table></div>';
    }

    public function add_admin_scripts()
    {
        $screen = get_current_screen();
        if (!$screen || $screen->id !== 'setae_settings_page_setae_best_shots')
            return;
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
                    
                    if (!confirm(actionType === 'approve' ? confirmMsgApprove : confirmMsgReject)) return;

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
                                $('#best-shot-row-' + logId).fadeOut(function () { $(this).remove(); });
                            } else {
                                alert('<?php echo esc_js(__("Error: ", "setae")); ?>' + response.data);
                                var approveText = '<?php echo esc_js(__("Approve", "setae")); ?>';
                                var rejectText = '<?php echo esc_js(__("Reject", "setae")); ?>';
                                btn.prop('disabled', false).text(actionType === 'approve' ? approveText : rejectText);
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
