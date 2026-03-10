/**
 * Module: UI / Community
 * コミュニティタブのバッジやUI制御を管理
 */
const SetaeUI_Community = (function ($) {

    // 未読件数を取得してバッジに反映
    function updateUnreadBadge() {
        if (typeof SetaeSettings === 'undefined' || !SetaeSettings.ajax_url) return;
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
        if (typeof SetaeSettings === 'undefined' || !SetaeSettings.ajax_url) return;
        $.ajax({
            url: SetaeSettings.ajax_url,
            type: 'POST',
            data: { action: 'setae_update_com_last_checked' }
        });
    }

    // ★追加: 最新コメントへのジャンプボタン制御
    function initJumpToBottom() {
        // ボタンのHTMLを動的に生成
        const btnHtml = `
            <button id="btn-jump-latest" type="button" aria-label="最新のコメントへ" style="
                display: none;
                position: fixed;
                bottom: 80px; /* 入力フォームのすぐ上に配置 */
                right: 20px;
                width: 44px;
                height: 44px;
                border-radius: 50%;
                background: rgba(255, 255, 255, 0.85);
                border: 1px solid #e2e8f0;
                box-shadow: 0 4px 16px rgba(0,0,0,0.15);
                color: #333;
                z-index: 100;
                cursor: pointer;
                align-items: center;
                justify-content: center;
                transition: opacity 0.3s ease, transform 0.3s ease;
                opacity: 0;
                transform: translateY(15px);
                backdrop-filter: blur(8px);
                -webkit-backdrop-filter: blur(8px);
            ">
                <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="12" y1="4" x2="12" y2="20"></line>
                    <polyline points="19 13 12 20 5 13"></polyline>
                </svg>
            </button>
        `;

        // 詳細セクションの最後に追加
        $('#section-com-detail').append(btnHtml);

        const $btn = $('#btn-jump-latest');
        let scrollTimer;

        // スクロール監視（デバウンス処理でパフォーマンスを最適化）
        $(window).on('scroll', function () {
            // コミュニティ詳細画面が開いている時のみ処理
            if (!$('#section-com-detail').is(':visible')) return;

            if (scrollTimer) clearTimeout(scrollTimer);

            scrollTimer = setTimeout(function () {
                const scrollTop = $(window).scrollTop();
                const windowHeight = $(window).height();
                const documentHeight = $(document).height();

                // ページの一番下から何px離れているか
                const distanceFromBottom = documentHeight - (scrollTop + windowHeight);

                // 下から400px以上離れていたらボタンをフワッと表示
                if (distanceFromBottom > 400) {
                    $btn.css('display', 'flex');
                    requestAnimationFrame(() => {
                        $btn.css({ opacity: '1', transform: 'translateY(0)' });
                    });
                } else {
                    // 下までスクロールしたら隠す
                    $btn.css({ opacity: '0', transform: 'translateY(15px)' });
                    setTimeout(() => {
                        if ($btn.css('opacity') === '0') {
                            $btn.hide();
                        }
                    }, 300);
                }
            }, 100); // 100msごとに判定し負荷を軽減
        });

        // クリックで最下部（最新コメントと入力フォーム）へスムーズにスクロール
        $(document).on('click', '#btn-jump-latest', function () {
            $('html, body').animate({
                scrollTop: $(document).height()
            }, 400, 'swing');
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

        // ★追加: ジャンプボタンの初期化
        initJumpToBottom();
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
