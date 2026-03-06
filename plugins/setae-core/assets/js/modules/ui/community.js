/**
 * Module: UI / Community
 * コミュニティタブのバッジやUI制御を管理
 */
const SetaeUI_Community = (function ($) {

    // 未読件数を取得してバッジに反映
    function updateUnreadBadge() {
        $.ajax({
            url: SetaeSettings.ajax_url,
            type: 'GET',
            data: { action: 'setae_get_unread_community_count' },
            success: function (response) {
                if (response.success && response.data.count > 0) {
                    $('#com-unread-badge').text(response.data.count).show();
                }
            }
        });
    }

    // タブクリック時に既読処理を行う
    function markAsRead() {
        $('#com-unread-badge').hide().text('0');

        $.ajax({
            url: SetaeSettings.ajax_url,
            type: 'POST',
            data: { action: 'setae_update_com_last_checked' }
        });
    }

    // 初期化処理
    function init() {
        // ページ読み込み時にバッジを取得
        updateUnreadBadge();

        // コミュニティタブがクリックされたら既読にする
        $(document).on('click', '.setae-nav-item[data-target="section-com"]', function () {
            markAsRead();
        });
    }

    return {
        init: init,
        updateBadge: updateUnreadBadge
    };

})(jQuery);

// モジュールの初期化
jQuery(document).ready(function () {
    SetaeUI_Community.init();
});
