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

            // ▼ 修正: インラインスタイルを削除し、クラス付与に変更
            content.style.transform = 'translateX(80px)'; // ホバー時は少しだけ動かす
            if (!bgLeft.classList.contains('is-visible')) {
                bgLeft.classList.add('is-visible');
                bgRight.classList.remove('is-visible');
                bgLeft.style.width = '64px';
            }
        }
        // 右端 (80%以上) -> 左スワイプアクション (Reveal Right BG)
        else if (percent > 0.8) {
            setupSwipeBg(bgRight, config.left_swipe);

            // 植物用のアイコン上書き
            if (isPlant) {
                bgRight.style.backgroundColor = '#8e44ad'; // Repot
                bgRight.innerHTML = '<span class="swipe-icon" style="font-size:24px; color:#fff;">🪴</span>';
            }

            // ▼ 修正: インラインスタイルを削除し、クラス付与に変更
            content.style.transform = 'translateX(-80px)'; // ホバー時は少しだけ動かす
            if (!bgRight.classList.contains('is-visible')) {
                bgRight.classList.add('is-visible');
                bgLeft.classList.remove('is-visible');
                bgRight.style.width = '64px';
            }
        }
        // 中央
        else {
            // ▼ 修正: インラインスタイルを削除し、クラスを外す処理に変更
            content.style.transform = 'translateX(0)';
            if (bgLeft.classList.contains('is-visible')) {
                bgLeft.classList.remove('is-visible');
                bgLeft.style.width = '64px';
            }
            if (bgRight.classList.contains('is-visible')) {
                bgRight.classList.remove('is-visible');
                bgRight.style.width = '64px';
            }
        }
    }

    function handleMouseLeave() {
        const content = this.querySelector('.setae-list-content');
        if (content) content.style.transform = 'translateX(0)';

        // ▼ 修正: インラインスタイルを削除し、クラスを外す処理に変更
        const bgLeft = this.querySelector('.swipe-left');
        const bgRight = this.querySelector('.swipe-right');
        if (bgLeft) {
            bgLeft.classList.remove('is-visible', 'swipe-triggered', 'is-resetting');
            bgLeft.style.width = '64px';
        }
        if (bgRight) {
            bgRight.classList.remove('is-visible', 'swipe-triggered', 'is-resetting');
            bgRight.style.width = '64px';
        }
    }

    function handleClick(e) {
        // ボタン類をクリックした場合は発火させない
        if ($(e.target).closest('button, .setae-btn').length) return;

        // タッチ操作（スマホ・タブレット等）を強力にブロック
        if (isTouch || ('ontouchstart' in window) || navigator.maxTouchPoints > 0) {
            return;
        }

        const $row = $(this);
        const width = $row.outerWidth();
        const x = e.pageX - $row.offset().left;
        const percent = x / width;

        let actionConfig = null;
        let direction = null;

        const status = $row.data('status') || 'normal';
        const config = (window.SetaeUIActions) ? SetaeUIActions.getSwipeConfig(status) : getSwipeConfigFallback(status);

        if (percent < 0.2) {
            // 左側クリック -> 右スワイプアクション
            actionConfig = config.right_swipe;
            direction = 'right';
        } else if (percent > 0.8) {
            // 右側クリック -> 左スワイプアクション
            actionConfig = config.left_swipe;
            direction = 'left';
        }

        if (actionConfig && actionConfig.action) {
            e.preventDefault();
            e.stopImmediatePropagation();

            const $content = $row.find('.setae-list-content');
            const moveVal = (direction === 'right') ? '140px' : '-140px';
            const bgTarget = (direction === 'right') ? this.querySelector('.swipe-left') : this.querySelector('.swipe-right');

            // 1. カードを大きく動かし、背景の玉を横に「ビヨン」と伸ばす
            $content.css({
                'transition': 'transform 0.5s cubic-bezier(0.25, 1, 0.5, 1)',
                'transform': `translateX(${moveVal})`
            });

            if (bgTarget) {
                bgTarget.style.transition = 'width 0.5s cubic-bezier(0.25, 1, 0.5, 1)';
                bgTarget.style.width = '120px'; // 横に伸ばす
            }

            // 2. 伸びきった後、玉が元の丸にスッと戻る
            setTimeout(() => {
                if (bgTarget) {
                    bgTarget.classList.add('is-resetting'); // 縮むための素早いtransitionクラス（CSSに定義済み）
                    bgTarget.style.width = '64px';
                }

                // 3. 丸に戻った直後に「パチン」と弾けてアクション実行
                setTimeout(() => {
                    if (bgTarget) {
                        bgTarget.classList.remove('is-resetting');
                        bgTarget.classList.add('swipe-triggered'); // 水しぶきエフェクト
                    }

                    // グローバルのアクションを実行
                    if (window.SetaeUIActions && SetaeUIActions.executeSwipeAction) {
                        SetaeUIActions.executeSwipeAction(this, actionConfig, direction);
                    } else if (window.executeSwipeAction) {
                        executeSwipeAction(this, actionConfig, direction);
                    } else if (window.handleQuickAction) {
                        window.handleQuickAction($row.data('id'), actionConfig.action, {});
                    }

                    // 4. アクション実行後、少し待ってから全体を元の位置にリセット
                    setTimeout(() => {
                        $content.css('transform', 'translateX(0)');
                        if (bgTarget) {
                            bgTarget.classList.remove('is-visible', 'swipe-triggered');
                        }
                    }, 300); // 弾けるエフェクトを見せるための待機時間
                }, 150); // 玉が丸に戻るまでの時間
            }, 200); // ビヨンと伸びるまでの時間
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
