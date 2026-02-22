var SetaeUIActions = (function ($) {
    'use strict';

    // Swipe State
    let touchStartX = 0;
    let touchStartY = 0;
    let currentSwipeRow = null;
    let isSwipeActionTaken = false;
    // ▼ 追加: 動作判定用のフラグ
    let isSwiping = false;
    let isScrolling = false;

    function getStatusColor(status) {
        switch (status) {
            case 'fasting': return '#ff9800';
            case 'pre_molt': return '#e74c3c';
            case 'post_molt': return '#9c27b0';
            case 'refused': return '#f44336';
            default: return '#2ecc71';
        }
    }

    // Public helper for Swipe Config (Shared by Mobile & Desktop)
    function getSwipeConfig(status) {
        status = status || 'normal';
        const config = { right_swipe: {}, left_swipe: {} };

        if (status === 'normal') {
            config.right_swipe = { color: '#2ecc71', icon: '🦗', action: 'feed', next: 'normal', label: '給餌' };
            config.left_swipe = { color: '#f1c40f', icon: '✋', action: 'refused', next: 'fasting', label: '拒食' };
        }
        else if (status === 'fasting') {
            config.right_swipe = { color: '#2ecc71', icon: '🦗', action: 'ate', next: 'normal', label: '拒食終了' };
            config.left_swipe = { color: '#e74c3c', icon: '⚠️', action: 'signs', next: 'pre_molt', label: '脱皮兆候' };
        }
        else if (status === 'pre_molt') {
            config.right_swipe = { color: '#9b59b6', icon: '🧬', action: 'molt', next: 'post_molt', label: '脱皮' };
            config.left_swipe = { color: '#95a5a6', icon: '🚫', action: 'locked', next: null, label: 'ロック' };
        }
        else if (status === 'post_molt') {
            config.right_swipe = { color: '#2ecc71', icon: '🦗', action: 'feed', next: 'normal', label: '給餌' };
            config.left_swipe = { color: '#3498db', icon: '📏', action: 'measure', next: 'normal', label: '計測' };
        }
        return config;
    }

    function handleQuickAction(id, action, data = {}) {
        const today = new Date().toISOString().split('T')[0];
        const $row = $(`.setae-spider-list-row[data-id="${id}"]`);

        let nextStatus = $row.data('status');
        let toastMsg = '';
        let toastType = 'success';

        if (action === 'feed') {
            nextStatus = 'normal';
            toastMsg = '給餌を記録しました';

            // キャッシュデータの更新（Refused判定用）
            if (SetaeCore.state.cachedSpiders) {
                const cachedSpider = SetaeCore.state.cachedSpiders.find(s => s.id == id);
                if (cachedSpider) {
                    cachedSpider.last_feed = today; // 今日の日付で更新
                    cachedSpider.is_hungry = false;
                    cachedSpider.status = 'normal';
                }
            }
        } else if (action === 'refused') {
            nextStatus = 'fasting';
            toastMsg = ''; // メッセージはAPI成功後に表示または処理内でハンドリング
            toastType = 'warning';
        } else if (action === 'ate') {
            action = 'feed';
            nextStatus = 'normal';
            toastMsg = '拒食終了・通常モードへ戻ります';
        } else if (action === 'signs') {
            nextStatus = 'pre_molt';
            toastMsg = '脱皮準備モードへ移行します';
            toastType = 'warning';
        } else if (action === 'molt') {
            nextStatus = 'post_molt';
            toastMsg = '脱皮を記録しました🎉';
            toastType = 'success';
        } else if (action === 'measure') {
            nextStatus = 'normal';
            toastMsg = '通常モードへ復帰しました';
        }

        // Optimistic UI Update via executeSwipeAction logic directly or just attributes
        // Replicating logic here for consistency
        $row.attr('data-status', nextStatus);
        $row.data('status', nextStatus);
        $row.find('.setae-status-strip').css('background-color', getStatusColor(nextStatus));

        const $pipeline = $row.find('.setae-pipeline');
        $pipeline.find('.pipeline-step').removeClass('active');
        $pipeline.find(`.pipeline-step[data-step="${nextStatus}"]`).addClass('active');

        if (action === 'feed') {
            $row.find('.meta-label').filter(function () { return jQuery(this).text().trim().match(/^(Feed|給餌)$/); }).next('.meta-value').text('たった今').removeClass('alert-text');
        }
        if (action === 'molt') {
            $row.find('.meta-label').filter(function () { return jQuery(this).text().trim().match(/^(Molt|脱皮)$/); }).next('.meta-value').text('たった今');
        }

        if (toastMsg) SetaeCore.showToast(toastMsg, toastType);

        // API Call
        // API Call
        if (action === 'signs') {
            SetaeAPI.updateSpiderStatus(id, 'pre_molt');
        } else if (action === 'measure') {
            SetaeAPI.updateSpiderStatus(id, 'normal');
            if (window.SetaeUILogModal && SetaeUILogModal.openLogModal) {
                SetaeUILogModal.openLogModal(id, 'growth');
            }
            toastMsg = '計測しましょう';
        } else if (action === 'refused') {
            // Refused logic: Update existing log instead of creating new one
            SetaeAPI.getSpiderDetail(id, function (detailData) {
                const logs = detailData.history || [];
                // Find latest feed log that is not yet refused
                const targetLog = logs.find(l => l.type === 'feed' && !l.refused);

                if (targetLog) {
                    SetaeAPI.updateLog(targetLog.id, { refused: true }, () => {
                        SetaeAPI.updateSpiderStatus(id, nextStatus);
                        SetaeCore.showToast('拒食・様子見モードへ移行します', 'warning');
                    });
                } else {
                    SetaeCore.showToast('更新対象の給餌記録が見つかりませんでした', 'error');
                    // Reload list to fix UI inconsistency
                    if (window.SetaeUIList) SetaeUIList.refresh();
                }
            });
        } else if (action === 'feed' || action === 'molt') {
            const logType = (action === 'molt') ? 'molt' : 'feed';

            const payload = {
                prey_type: data.prey || 'Cricket',
                refused: false
            };

            SetaeAPI.logEvent(id, logType, today, payload, () => {
                SetaeAPI.updateSpiderStatus(id, nextStatus);
            });
        }
    }

    /**
     * アクション実行とUIの即時更新を行う関数
     * Modified: Added 'direction' argument to support plant logic
     */
    function executeSwipeAction(rowElement, actionConfig, direction) {
        const $row = jQuery(rowElement);
        const $content = $row.find('.setae-list-content');
        const id = $row.data('id');
        const actionType = actionConfig.action;
        const newStatus = actionConfig.next;
        const preyType = $row.data('prey') || 'Cricket';

        // Check classification logic
        let isPlant = false;
        if (typeof SetaeCore !== 'undefined' && SetaeCore.state && SetaeCore.state.cachedSpiders) {
            // IDから状態を検索（HTMLにdata-classificationがない場合の対策）
            const spider = SetaeCore.state.cachedSpiders.find(s => s.id == id);
            if (spider && spider.classification === 'plant') isPlant = true;
        }
        if (!isPlant && $row.data('classification') === 'plant') isPlant = true;

        if (isPlant) {
            // Plant Actions
            // direction 'right' (Swipe Right -> Reveals Left BG) -> Water -> Feed Log
            // direction 'left'  (Swipe Left  -> Reveals Right BG) -> Repot -> Molt Log

            if (direction === 'right') {
                // Water
                if (window.SetaeUILogModal) SetaeUILogModal.openLogModal(id, 'feed');
            } else {
                // Repot (Always Modal)
                if (window.SetaeUILogModal) SetaeUILogModal.openLogModal(id, 'molt');
            }
        } else {
            // Validation for Refused action
            if (actionType === 'refused') {
                const spider = SetaeCore.state.cachedSpiders.find(s => s.id == id);

                // 1. Log existence check
                if (!spider || !spider.last_feed) {
                    SetaeCore.showToast('給餌記録がありません', 'error');
                    return; // Abort
                }

                // 2. 48 hours check
                const lastFeedDate = new Date(spider.last_feed);
                const now = new Date();
                const diffHours = (now - lastFeedDate) / (1000 * 60 * 60);

                if (diffHours > 48) {
                    SetaeCore.showToast('直近（48時間以内）の給餌記録がありません', 'error');
                    return; // Abort
                }
            }

            // Default behavior (Quick Action / current logic)
            console.log(`🚀 Executing: ${actionType} -> New Status: ${newStatus} `);

            // 1. UIの即時更新
            $row.attr('data-status', newStatus);
            $row[0].dataset.status = newStatus;
            $content.attr('data-status', newStatus);
            $row.find('.setae-swipe-bg').removeAttr('style').html('');

            const $pipeline = $row.find('.setae-pipeline');
            if ($pipeline.length) {
                $pipeline.find('.pipeline-step').removeClass('active');
                const $nextStep = $pipeline.find(`.pipeline-step[data-step="${newStatus}"]`);
                if ($nextStep.length) $nextStep.addClass('active');
            }

            if (actionType === 'feed' || actionType === 'ate') {
                const $label = $row.find('.meta-label').filter(function () { return jQuery(this).text().trim().match(/^(Feed|給餌)$/); });
                if ($label.length) {
                    $label.next('.meta-value').text('今日').css('color', '').removeClass('alert-text').css('background-color', '#e8f5e9').animate({ backgroundColor: 'transparent' }, 1000);
                }
            } else if (actionType === 'molt') {
                const $label = $row.find('.meta-label').filter(function () { return jQuery(this).text().trim().match(/^(Molt|脱皮)$/); });
                if ($label.length) {
                    $label.next('.meta-value').text('今日').css('background-color', '#f3e5f5').animate({ backgroundColor: 'transparent' }, 1000);
                }
            }

            // 2. API送信
            let extraData = {};
            if (actionType === 'feed' || actionType === 'ate') {
                extraData = { prey: preyType };
            }
            handleQuickAction(id, actionType, extraData);
        }
    };

    // ==========================================
    // Swipe Logic (Stateful)
    // ==========================================
    function handleTouchStart(e) {
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
        currentSwipeRow = this;
        isSwipeActionTaken = false;

        // ▼ 追加: フラグのリセット
        isSwiping = false;
        isScrolling = false;

        $('.setae-list-content').css('transform', 'translateX(0)');

        const bgLeft = this.querySelector('.swipe-left');
        const bgRight = this.querySelector('.swipe-right');
        if (!bgLeft || !bgRight) return;

        bgLeft.style.visibility = 'hidden';
        bgRight.style.visibility = 'hidden';

        const status = $(this).data('status') || 'normal';
        const config = getSwipeConfig(status);

        setupSwipeBg(bgLeft, config.right_swipe);
        setupSwipeBg(bgRight, config.left_swipe);
    }

    function setupSwipeBg(el, conf) {
        if (!el || !conf) return;
        el.style.backgroundColor = conf.color;
        el.dataset.action = conf.action;
        el.innerHTML = `<span class="swipe-icon">${conf.icon}</span>`;
    }

    function handleTouchMove(e) {
        // ▼ 修正: スクロール判定済みなら処理を中断
        if (!currentSwipeRow || isScrolling) return;

        const diffX = e.changedTouches[0].screenX - touchStartX;
        const diffY = e.changedTouches[0].screenY - touchStartY;

        // ▼ 修正: まだ判定していない場合、移動量で判定を行う
        if (!isSwiping) {
            if (Math.abs(diffX) > Math.abs(diffY)) {
                isSwiping = true;   // 横移動が大きい＝スワイプ
            } else {
                isScrolling = true; // 縦移動が大きい＝スクロール
                return;             // スワイプ処理はしない
            }
        }

        // ▼ 修正: スワイプ中は確実にスクロールを阻止
        if (isSwiping) {
            e.preventDefault();
        }

        if (Math.abs(diffX) > 150) return;

        const content = currentSwipeRow.querySelector('.setae-list-content');
        const bgLeft = currentSwipeRow.querySelector('.swipe-left');
        const bgRight = currentSwipeRow.querySelector('.swipe-right');
        const status = $(currentSwipeRow).data('status');

        if (status === 'pre_molt' && diffX < 0) return;

        if (diffX > 0) {
            // Left Swipe Visuals (Reveals Left BG)
            bgLeft.style.visibility = 'visible';
            bgRight.style.visibility = 'hidden';

            // Check classification dynamically
            let isPlant = false;
            const id = $(currentSwipeRow).data('id');
            if (typeof SetaeCore !== 'undefined' && SetaeCore.state && SetaeCore.state.cachedSpiders) {
                const spider = SetaeCore.state.cachedSpiders.find(s => s.id == id);
                if (spider && spider.classification === 'plant') isPlant = true;
            }
            if (!isPlant && $(currentSwipeRow).data('classification') === 'plant') isPlant = true;

            if (isPlant) {
                // 植物: Water (Left Icon)
                bgLeft.style.backgroundColor = '#3498db'; // 水色
                bgLeft.innerHTML = '<span class="swipe-icon" style="font-size:24px; color:#fff;">💧</span>';
            }

        } else if (diffX < 0) {
            // Right Swipe Visuals (Reveals Right BG)
            bgLeft.style.visibility = 'hidden';
            bgRight.style.visibility = 'visible';

            let isPlant = false;
            const id = $(currentSwipeRow).data('id');
            if (typeof SetaeCore !== 'undefined' && SetaeCore.state && SetaeCore.state.cachedSpiders) {
                const spider = SetaeCore.state.cachedSpiders.find(s => s.id == id);
                if (spider && spider.classification === 'plant') isPlant = true;
            }
            if (!isPlant && $(currentSwipeRow).data('classification') === 'plant') isPlant = true;

            if (isPlant) {
                // 植物: Repot (Right Icon) -> Always Modal
                bgRight.style.backgroundColor = '#8e44ad'; // 紫
                bgRight.innerHTML = '<span class="swipe-icon" style="font-size:24px; color:#fff;">🪴</span>';
            }
        }

        content.style.transform = `translateX(${diffX}px)`;
    }

    function handleTouchEnd(e) {
        if (!currentSwipeRow) return;
        const diffX = e.changedTouches[0].screenX - touchStartX;
        const row = currentSwipeRow;
        const content = row.querySelector('.setae-list-content');
        const status = $(row).data('status') || 'normal';
        const config = getSwipeConfig(status);

        let actionConf = null;

        if (diffX > 80) actionConf = config.right_swipe;
        else if (diffX < -80) actionConf = config.left_swipe;

        if (actionConf && actionConf.action && actionConf.action !== 'locked' && actionConf.action !== 'wait') {
            // Using executeSwipeAction
            // Pass direction for potential plant logic
            const dir = (diffX > 80) ? 'right' : 'left';
            executeSwipeAction(row, actionConf, dir);
            isSwipeActionTaken = true;
        }

        content.style.transition = 'transform 0.2s ease-out';
        content.style.transform = 'translateX(0)';

        setTimeout(() => {
            content.style.transition = '';
            const bgLeft = row.querySelector('.swipe-left');
            const bgRight = row.querySelector('.swipe-right');
            if (bgLeft) bgLeft.style.visibility = 'hidden';
            if (bgRight) bgRight.style.visibility = 'hidden';

            currentSwipeRow = null;
            setTimeout(() => isSwipeActionTaken = false, 300);
        }, 200);
    }

    function initDesktopHoverLogic() {
        $(document).on('mousemove', '.setae-spider-list-row', function (e) {
            if (currentSwipeRow) return;
            const width = $(this).outerWidth();
            const percent = (e.pageX - $(this).offset().left) / width;
            const content = this.querySelector('.setae-list-content');

            if (percent < 0.2) content.style.transform = 'translateX(20px)';
            else if (percent > 0.8) content.style.transform = 'translateX(-20px)';
            else content.style.transform = 'translateX(0)';
        });

        $(document).on('mouseleave', '.setae-spider-list-row', function () {
            const content = this.querySelector('.setae-list-content');
            if (content) content.style.transform = 'translateX(0)';
        });
    }

    function animateDesktopAction($card, direction, actionConfig, $row) {
        // Slide Out
        const moveVal = (direction === 'right') ? '100px' : '-100px';
        $card.css('transition', 'transform 0.2s ease-out').css('transform', `translateX(${moveVal})`);

        setTimeout(() => {
            // Execute Action
            executeSwipeAction($row[0], actionConfig, direction);

            // Snap Back
            setTimeout(() => {
                $card.css('transform', 'translateX(0)');
                // 実行後にキャッシュをクリアして、マウスが動いた瞬間に新しい背景が出るようにする
                $row.data('rendered-status', null);
            }, 300);
        }, 100);
    }

    function initDesktopClickLogic() {
        // スマホやタブレットでも誤作動する環境があるため、以前の判定を削除
        // if ('ontouchstart' in window) return;

        $(document).on('click', '.setae-spider-list-row', function (e) {
            // ▼▼▼ 追加: 操作元が「タッチ（スマホ等）」の場合はこの処理をスキップし、詳細画面を開く処理へ任せる ▼▼▼
            if (e.originalEvent && (e.originalEvent.pointerType === 'touch' || e.originalEvent.pointerType === 'pen')) {
                return;
            }

            const $row = $(this);
            const $card = $row.find('.setae-list-content');

            const width = $row.outerWidth();
            const x = e.pageX - $row.offset().left;
            const percent = x / width;

            let direction = null;
            if (percent < 0.20) {
                direction = 'right';
            } else if (percent > 0.80) {
                direction = 'left';
            }

            if (direction) {
                e.preventDefault();
                e.stopImmediatePropagation();

                const status = $row.attr('data-status') || 'normal';
                const config = getSwipeConfig(status);

                const actionConfig = (direction === 'right') ? config.right_swipe : config.left_swipe;

                if (actionConfig && actionConfig.action && actionConfig.action !== 'locked' && actionConfig.action !== 'wait') {
                    animateDesktopAction($card, direction, actionConfig, $row);
                }
            }
        });
    }

    return {
        handleQuickAction: handleQuickAction,
        executeSwipeAction: executeSwipeAction,
        getSwipeConfig: getSwipeConfig,
        getStatusColor: getStatusColor,
        handleTouchStart: handleTouchStart,
        handleTouchMove: handleTouchMove,
        handleTouchEnd: handleTouchEnd,
        initDesktopHoverLogic: initDesktopHoverLogic,
        initDesktopClickLogic: initDesktopClickLogic
    };

})(jQuery);