var SetaeUIDesktop = (function ($) {
    'use strict';

    // ▼▼▼ 追加: タッチ操作を確実に検知するためのフラグ ▼▼▼
    let isTouch = false;

    function init() {
        // ▼▼▼ 追加: 一度でも画面がタッチされたらフラグを立てる ▼▼▼
        $(document).on('touchstart', function () {
            isTouch = true;
        });

        // マウスが動いた時の処理（ホバーで背景チラ見せ）
        $(document).on('mousemove', '.setae-spider-list-row', handleMouseMove);

        // マウスが離れた時の処理（リセット）
        $(document).on('mouseleave', '.setae-spider-list-row', handleMouseLeave);

        // クリック時の処理（アクション実行）
        $(document).on('click', '.setae-spider-list-row', handleClick);
    }

    function handleMouseMove(e) {
        // ▼▼▼ 修正: タッチデバイスの場合はホバー処理も完全に無視する ▼▼▼
        if (isTouch || ('ontouchstart' in window) || navigator.maxTouchPoints > 0) return;

        const $row = $(this);
        const width = $row.outerWidth();
        const x = e.pageX - $row.offset().left;
        const percent = x / width;
        const content = this.querySelector('.setae-list-content');

        // 背景設定の準備
        const status = $row.data('status') || 'normal';
        const config = (window.SetaeUIActions) ? SetaeUIActions.getSwipeConfig(status) : getSwipeConfigFallback(status);

        const bgLeft = this.querySelector('.swipe-left');
        const bgRight = this.querySelector('.swipe-right');

        if (!bgLeft || !bgRight) return;

        // 植物かどうかの判定 (表示変更用)
        let isPlant = false;
        const id = $row.data('id');
        if (typeof SetaeCore !== 'undefined' && SetaeCore.state && SetaeCore.state.cachedSpiders) {
            const spider = SetaeCore.state.cachedSpiders.find(s => s.id == id);
            if (spider && spider.classification === 'plant') isPlant = true;
        }
        if (!isPlant && $row.data('classification') === 'plant') isPlant = true;


        // 左端 (20%未満) -> 右スワイプアクション (Reveal Left BG)
        if (percent < 0.2) {
            setupSwipeBg(bgLeft, config.right_swipe);

            // 植物用のアイコン上書き
            if (isPlant) {
                bgLeft.style.backgroundColor = '#3498db'; // Water
                bgLeft.innerHTML = '<span class="swipe-icon" style="font-size:24px; color:#fff;">💧</span>';
            }

            content.style.transform = 'translateX(60px)';
            bgLeft.style.visibility = 'visible';
            bgRight.style.visibility = 'hidden';
        }
        // 右端 (80%以上) -> 左スワイプアクション (Reveal Right BG)
        else if (percent > 0.8) {
            setupSwipeBg(bgRight, config.left_swipe);

            // 植物用のアイコン上書き
            if (isPlant) {
                bgRight.style.backgroundColor = '#8e44ad'; // Repot
                bgRight.innerHTML = '<span class="swipe-icon" style="font-size:24px; color:#fff;">🪴</span>';
            }

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

        // ▼▼▼ 修正: タッチ操作（スマホ・タブレット等）をより強力にブロックする ▼▼▼
        if (isTouch || ('ontouchstart' in window) || navigator.maxTouchPoints > 0) {
            return;
        }
        // ▲▲▲ 修正ここまで ▲▲▲

        const $row = $(this);
        const width = $row.outerWidth();
        const x = e.pageX - $row.offset().left;
        const percent = x / width;

        let actionConfig = null;
        let direction = null;

        const status = $row.data('status') || 'normal';
        const config = (window.SetaeUIActions) ? SetaeUIActions.getSwipeConfig(status) : getSwipeConfigFallback(status);

        if (percent < 0.2) {
            // Clicked Left Area -> Simulates Swipe Right (Reveal Left BG)
            actionConfig = config.right_swipe;
            direction = 'right';
        } else if (percent > 0.8) {
            // Clicked Right Area -> Simulates Swipe Left (Reveal Right BG)
            actionConfig = config.left_swipe;
            direction = 'left';
        }

        if (actionConfig && actionConfig.action) {
            e.preventDefault();
            e.stopImmediatePropagation();

            // アニメーション演出
            const $content = $row.find('.setae-list-content');
            const moveVal = (direction === 'right') ? '100px' : '-100px';

            $content.css('transition', 'transform 0.2s ease-out').css('transform', `translateX(${moveVal})`);

            setTimeout(() => {
                // グローバルの executeSwipeAction を呼ぶ
                // ★修正点: direction を第三引数に渡す
                if (window.SetaeUIActions && SetaeUIActions.executeSwipeAction) {
                    SetaeUIActions.executeSwipeAction(this, actionConfig, direction);
                } else if (window.executeSwipeAction) {
                    executeSwipeAction(this, actionConfig, direction);
                } else if (window.handleQuickAction) {
                    // フォールバック (植物対応なし)
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
        return {
            right_swipe: { color: '#2ecc71', icon: '🦗', action: 'feed', next: 'normal' },
            left_swipe: { color: '#f1c40f', icon: '✋', action: 'refused', next: 'fasting' }
        };
    }

    return {
        init: init
    };

})(jQuery);
