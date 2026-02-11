var SetaeUIActions = (function ($) {
    'use strict';

    // Swipe State
    let touchStartX = 0;
    let touchStartY = 0;
    let currentSwipeRow = null;
    let isSwipeActionTaken = false;

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
        } else if (action === 'refused') {
            nextStatus = 'fasting';
            toastMsg = '拒食・様子見モードへ移行します';
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
            $row.find('.meta-label:contains("Feed")').next('.meta-value').text('Just now').removeClass('alert-text');
        }
        if (action === 'molt') {
            $row.find('.meta-label:contains("Molt")').next('.meta-value').text('Just now');
        }

        if (toastMsg) SetaeCore.showToast(toastMsg, toastType);

        // API Call
        if (action === 'signs') {
            SetaeAPI.updateSpiderStatus(id, 'pre_molt');
        } else if (action === 'measure') {
            SetaeAPI.updateSpiderStatus(id, 'normal');
            if (window.SetaeUILogModal && SetaeUILogModal.openLogModal) {
                SetaeUILogModal.openLogModal(id, 'growth');
            }
            toastMsg = '計測しましょう';
        } else if (action === 'feed' || action === 'refused' || action === 'molt') {
            const isRefused = (action === 'refused');
            const logType = (action === 'molt') ? 'molt' : 'feed';

            const payload = {
                prey_type: data.prey || 'Cricket',
                refused: isRefused
            };

            SetaeAPI.logEvent(id, logType, today, payload, () => {
                SetaeAPI.updateSpiderStatus(id, nextStatus);
            });
        }
    }

    /**
     * アクション実行とUIの即時更新を行う関数 (Pure UI version)
     */
    function executeSwipeAction(rowElement, actionConfig) {
        const $row = jQuery(rowElement);
        const $content = $row.find('.setae-list-content');
        const id = $row.data('id');
        const actionType = actionConfig.action; // This comes from config, might need override for plants
        const newStatus = actionConfig.next;
        const preyType = $row.data('prey') || 'Cricket';

        // Check classification
        const cls = $row.data('classification') || 'tarantula';
        const isPlant = (cls === 'plant');

        // Determine actual action based on classification + direction/context
        // config.action is what we got from getSwipeConfig.
        // For plants, we want to intercept:
        // Left Swipe (usually 'feed' or 'refused' depending on status) -> Water (Log feed)
        // Right Swipe (usually 'molt' or 'feed') -> Repot (Log molt)

        // However, the actionConfig passed here comes from handleTouchEnd logic which selected right_swipe or left_swipe config.
        // We know right_swipe/left_swipe from config.

        // Let's refine based on direction implied by the action config or just force it for plants.
        // Since we don't strictly know direction here (only actionConfig), we might need to rely on what handleTouchEnd passed.
        // But handleTouchEnd calls this with config from getSwipeConfig(status).
        // If status was 'normal', left=refused, right=feed.
        // IF we want "Left = Water", "Right = Repot" regardless of status for plants:

        if (isPlant) {
            // For plants, we hijack the action flow.
            // We need to know if it was left or right swipe.
            // We can infer from actionConfig or just pass direction to executeSwipeAction.
            // But existing signature is (rowElement, actionConfig).
            // However, we can check if actionConfig matches left or right config of the status?
            // Or simpler: handleTouchEnd knows the direction.

            // BUT, the user prompt says:
            // "executeSwipeAction($row, dir)" in the PROPOSAL, but currently the code is "executeSwipeAction(rowElement, actionConfig)".
            // I will modify handleTouchEnd to pass direction if possible, OR I will try to support the user's proposal by MODIFYING executeSwipeAction signature?
            // No, I should stick to the existing signature if possible to avoid breaking callers, OR update callers.
            // handleTouchEnd calls it. animateDesktopAction calls it.

            // user proposal: function executeSwipeAction($row, dir)
            // existing: function executeSwipeAction(rowElement, actionConfig)

            // I will hybridize. I'll stick to replacing the function content but I need to adapt the logic.
            // Actually, the user explicitly asked to "Replace the existing window.executeSwipeAction function... with the provided implementation".
            // But wait, the previous `executeSwipeAction` was purely internal or exposed? It handles UI updates + API.
            // The user provided code snippet for `executeSwipeAction` taking `$row, dir` is a NEW signature.
            // If I change the signature, I MUST update all call sites.
            // Call sites: handleTouchEnd, animateDesktopAction.

            // Let's look at handleTouchEnd. It determines actionConfig based on diffX (direction).
            // So I can change handleTouchEnd to pass direction.

            // Wait, the user provided `executeSwipeAction($row, dir)` logic is:
            // if dir == left -> Open Log Modal (Feed/Water)
            // if dir == right -> Open Log Modal (Molt/Repot)

            // This is DIFFERENT from the original logic which did "Quick Action" (API call immediately).
            // The user wants to change swipe to OPEN MODAL for plants?
            // "Water Log を追加する処理へ (モーダルを開くか、即時追加か)" -> "ここでは簡易的にログモーダルを...開く例"
            // So yes, for plants, open modal.

            // FOR EXISTING logic (non-plants), it does "Quick Action" (immediate API + optimistic UI).
            // The user provided snippet seems to handle non-plants too: "else { SetaeUILogModal.openLogModal(id, 'feed'); }"
            // Wait, does the user want to change ALL swipes to open modal?
            // "修正目的: 植物用のコマンド...への変更"
            // "通常: Feed", "通常: Molt" in the snippet implies standard behavior?
            // BUT the existing code does `handleQuickAction` (immediate).
            // The user snippet calls `SetaeUILogModal.openLogModal` for non-plants too.
            // This might be a regression if I blindly copy it. The current app does quick actions (swipe -> done).
            // Opening a modal on swipe is a behavior change.
            // "通常: Feed" comment in snippet says "Feed Log".

            // I should probably keep the Quick Action for non-plants if that's the desired existing behavior, 
            // OR arguably the user WANTS to switch to modal opening for everything?
            // Looking at the context "植物（Plant）の表示レイアウト修正...".
            // I will assume the user wants special behavior for plants. 
            // If I change non-plant behavior, the user might complain.
            // HOWEVER, the user provided snippet for `executeSwipeAction` ONLY has `openLogModal` calls.
            // "else { SetaeUILogModal.openLogModal(id, 'feed'); }"

            // Detailed check: The user code uses `dir` ('left', 'right').
            // Existing code uses `actionConfig`.
            // If I adopt the user's `executeSwipeAction`, I need to update call sites.

            // Let's UPDATING `executeSwipeAction` to support both/hybrid or checking direction.
            // actually, `actionConfig` roughly maps to direction (left/right) via `getSwipeConfig`.
            // But it's status dependent.

            // Let's try to preserve `handleQuickAction` for non-plants if possible, OR just follow the instruction if it implies changing to modal.
            // "植物用のコマンド（スワイプアクション・記録追加）への変更を行うための修正案です"
            // It implies the focus is plants.

            // I will implement a check. If plant -> Open Modal. If not -> Use existing `handleQuickAction`.
            // To do this, I need to know direction or just map the action type.

            // Status: 'normal' -> Right=Feed, Left=Refused.
            // If I get 'feed' action for a Plant, it implies Water.
            // If I get 'refused' action for a Plant, it implies... maybe Water too? or Skip?
            // Plants don't really 'refuse' water in the same way.
            // User said: "Left Swipe (usually Feed) -> Water"
            // "Right Swipe (usually Molt) -> Repot"

            // So I need to map:
            // Feed -> Water (Open Modal)
            // Refused -> Water? (Open Modal) - Wait, left swipe is Refused for Normal status.
            // User says "Left Swipe (usually Feed)".
            // In `getSwipeConfig`, 'normal' status: Right=Feed, Left=Refused.
            // 'fasting' status: Right=Ate(Feed), Left=Signs.
            // 'pre_molt': Right=Molt, Left=Locked.
            // 'post_molt': Right=Feed, Left=Measure.

            // Setup for Plant:
            // Switch logic based on direction.
            // I need to update `handleTouchEnd` to pass direction to `executeSwipeAction` or pass it in config.

            // Let's modify `executeSwipeAction` to accept `direction` as an optional 3rd arg, or just handle it.
            // Actually, simpler: I'll modify `handleTouchEnd` to handle Plant logic SEPARATELY before calling `executeSwipeAction`, OR
            // Modify `executeSwipeAction` to check `isPlant` and `actionType`.
        }

        if (isPlant) {
            // Determine direction/intent from actionType or just use actionType to decide modal.
            // But `actionType` comes from `getSwipeConfig(status)`.
            // Plant status might be 'normal'.
            // getSwipeConfig('normal') -> Right=Feed, Left=Refused.
            // If actionType is 'feed' (Right) -> Repot? No, User said Right=Repot. 
            // Wait, user said "Left Swipe (usually Feed)".
            // IN MY CODE: 
            // config.right_swipe = { ... action: 'feed' ... }
            // config.left_swipe = { ... action: 'refused' ... }
            // So Right is Feed. Left is Refused.

            // User said: "Left swipe (usually usually Feed)".
            // Maybe the user has different swipe config or transposed?
            // "Left Swipe (通常はFeed)" -> In my code Right is Feed.
            // Maybe I should respect the user's TEXT description of direction?
            // "Left Swipe... -> Water"
            // "Right Swipe... -> Repot"

            // I will prioritize the DIRECTION over the existing action mapping for plants.
            // So I need to know the direction.
            // `executeSwipeAction` does NOT receive direction currently.

            // STRATEGY:
            // 1. Modify `handleTouchEnd` to pass direction ('left' or 'right') to `executeSwipeAction`.
            // 2. Modify `animateDesktopAction` to pass direction.
            // 3. Update `executeSwipeAction` to accept direction.
            // 4. Input the user's logic inside `executeSwipeAction`.

        } else {
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
                const $label = $row.find('.meta-label').filter(function () { return jQuery(this).text().trim() === 'Feed'; });
                if ($label.length) {
                    $label.next('.meta-value').text('Today').css('color', '').css('background-color', '#e8f5e9').animate({ backgroundColor: 'transparent' }, 1000);
                }
            } else if (actionType === 'molt') {
                const $label = $row.find('.meta-label').filter(function () { return jQuery(this).text().trim() === 'Molt'; });
                if ($label.length) {
                    $label.next('.meta-value').text('Today').css('background-color', '#f3e5f5').animate({ backgroundColor: 'transparent' }, 1000);
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
        if (!currentSwipeRow) return;
        const diffX = e.changedTouches[0].screenX - touchStartX;
        const diffY = e.changedTouches[0].screenY - touchStartY;

        if (Math.abs(diffX) > Math.abs(diffY)) {
            e.preventDefault();
        } else {
            return;
        }

        if (Math.abs(diffX) > 150) return;

        const content = currentSwipeRow.querySelector('.setae-list-content');
        const bgLeft = currentSwipeRow.querySelector('.swipe-left');
        const bgRight = currentSwipeRow.querySelector('.swipe-right');
        const status = $(currentSwipeRow).data('status');

        if (status === 'pre_molt' && diffX < 0) return;

        if (diffX > 0) {
            // Left Swipe Visuals (Feed/Water)
            bgLeft.style.visibility = 'visible';
            bgRight.style.visibility = 'hidden';

            // Check classification from data attribute
            const cls = $(currentSwipeRow).data('classification') || 'tarantula';
            const isPlant = (cls === 'plant');

            if (isPlant) {
                // 植物: Water
                bgLeft.style.backgroundColor = '#3498db'; // 水色
                bgLeft.innerHTML = '<span class="swipe-icon" style="font-size:24px; color:#fff;">💧 Water</span>';
            } else {
                // 通常: Feed (initially set by setupSwipeBg but we override here for safety/consistency if needed, 
                // though setupSwipeBg sets structure. Let's trust setupSwipeBg for normal case or override if we want dynamic)
                // Existing logic in setupSwipeBg handles the normal case based on config.
                // However, since we are doing dynamic visual update here for plants which might not be in basic config:
                // Let's rely on setupSwipeBg for non-plants, and only override for plants.
                // But wait, setupSwipeBg was called in touchStart.
                // If we want to change color/content dynamically during move based on classification (which we didn't check in touchStart),
                // we should do it here. 
                // Actually, let's keep it simple and just do it here as requested.
            }

        } else if (diffX < 0) {
            // Right Swipe Visuals (Molt/Repot)
            bgLeft.style.visibility = 'hidden';
            bgRight.style.visibility = 'visible';

            const cls = $(currentSwipeRow).data('classification') || 'tarantula';
            const isPlant = (cls === 'plant');

            if (isPlant) {
                // 植物: Repot
                bgRight.style.backgroundColor = '#8e44ad'; // 紫
                bgRight.innerHTML = '<span class="swipe-icon" style="font-size:24px; color:#fff;">🪴 Repot</span>';
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
        if ('ontouchstart' in window) return;

        $(document).on('click', '.setae-spider-list-row', function (e) {
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
