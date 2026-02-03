var SetaeUIDesktop = (function ($) {
    'use strict';

    function init() {
        // マウスが動いた時の処理（ホバーで背景チラ見せ）
        $(document).on('mousemove', '.setae-spider-list-row', handleMouseMove);

        // マウスが離れた時の処理（リセット）
        $(document).on('mouseleave', '.setae-spider-list-row', handleMouseLeave);

        // クリック時の処理（アクション実行）
        $(document).on('click', '.setae-spider-list-row', handleClick);
    }

    function handleMouseMove(e) {
        // モバイルでスワイプ中の場合は無視
        // Note: SetaeUIMobile is deprecated/removed in favor of SetaeUIActions but
        // we keep the check just in case or we can check 'ontouchstart'
        if ('ontouchstart' in window) return;

        const $row = $(this);
        const width = $row.outerWidth();
        const x = e.pageX - $row.offset().left;
        const percent = x / width;
        const content = this.querySelector('.setae-list-content');

        // 背景設定の準備
        const status = $row.data('status') || 'normal';
        // SetaeUIActions があればそこから、なければグローバルから取得
        const config = (window.SetaeUIActions) ? SetaeUIActions.getSwipeConfig(status) : getSwipeConfigFallback(status);

        const bgLeft = this.querySelector('.swipe-left');
        const bgRight = this.querySelector('.swipe-right');

        if (!bgLeft || !bgRight) return;

        // 左端 (20%未満) -> 右スワイプアクション (給餌など)
        if (percent < 0.2) {
            setupSwipeBg(bgLeft, config.right_swipe);
            content.style.transform = 'translateX(60px)';
            bgLeft.style.visibility = 'visible';
            bgRight.style.visibility = 'hidden';
        }
        // 右端 (80%以上) -> 左スワイプアクション (拒食など)
        else if (percent > 0.8) {
            setupSwipeBg(bgRight, config.left_swipe);
            content.style.transform = 'translateX(-60px)';
            bgLeft.style.visibility = 'hidden';
            bgRight.style.visibility = 'visible';
        }
        // 中央
        else {
            content.style.transform = 'translateX(0)';
            bgLeft.style.visibility = 'hidden';
            bgRight.style.visibility = 'hidden';
        }
    }

    function handleMouseLeave() {
        const content = this.querySelector('.setae-list-content');
        if (content) content.style.transform = 'translateX(0)';
    }

    function handleClick(e) {
        // ボタン類をクリックした場合は発火させない
        if ($(e.target).closest('button, .setae-btn').length) return;

        const $row = $(this);
        const width = $row.outerWidth();
        const x = e.pageX - $row.offset().left;
        const percent = x / width;

        let actionConfig = null;
        const status = $row.data('status') || 'normal';
        const config = (window.SetaeUIActions) ? SetaeUIActions.getSwipeConfig(status) : getSwipeConfigFallback(status);

        if (percent < 0.2) {
            actionConfig = config.right_swipe; // 左エリアクリック
        } else if (percent > 0.8) {
            actionConfig = config.left_swipe; // 右エリアクリック
        }

        if (actionConfig && actionConfig.action) {
            e.preventDefault();
            e.stopImmediatePropagation();

            // アニメーション演出
            const $content = $row.find('.setae-list-content');
            const direction = (percent < 0.2) ? '100px' : '-100px';

            $content.css('transition', 'transform 0.2s ease-out').css('transform', `translateX(${direction})`);

            setTimeout(() => {
                // グローバルの executeSwipeAction を呼ぶ
                if (window.SetaeUIActions && SetaeUIActions.executeSwipeAction) {
                    SetaeUIActions.executeSwipeAction(this, actionConfig);
                } else if (window.executeSwipeAction) {
                    executeSwipeAction(this, actionConfig);
                } else if (window.handleQuickAction) {
                    // フォールバック
                    window.handleQuickAction($row.data('id'), actionConfig.action, {});
                }

                // 戻す
                setTimeout(() => {
                    $content.css('transform', 'translateX(0)');
                }, 200);
            }, 100);
        }
    }

    // Helper: 背景セットアップ
    function setupSwipeBg(el, conf) {
        if (!el || !conf) return;
        el.style.backgroundColor = conf.color;
        el.innerHTML = `<span class="swipe-icon" style="font-size:24px; line-height:1;">${conf.icon}</span>`;
    }

    // Fallback if module is missing
    function getSwipeConfigFallback(status) {
        // 最低限の設定（本来は共通モジュールから呼ぶべき）
        return {
            right_swipe: { color: '#2ecc71', icon: '🦗', action: 'feed', next: 'normal' },
            left_swipe: { color: '#f1c40f', icon: '✋', action: 'refused', next: 'fasting' }
        };
    }

    return {
        init: init
    };

})(jQuery);
