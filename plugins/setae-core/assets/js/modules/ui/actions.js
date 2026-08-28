var SetaeUIActions = (function ($) {
    'use strict';

    // Swipe State
    let touchStartX = 0;
    let touchStartY = 0;
    let currentSwipeRow = null;
    let isSwipeActionTaken = false;
    let isSwiping = false;
    let isScrolling = false;
    let touchStartTime = 0;
    let lastTouchX = 0;
    let lastTouchTime = 0;
    let swipeVelocityX = 0;
    let swipeThresholdArmed = false;
    let swipeHapticSent = false;
    let isSwipeGestureActive = false;
    let swipeContent = null;
    let swipeBgLeft = null;
    let swipeBgRight = null;
    let swipeConfig = null;
    let swipeFrameRequest = null;
    let pendingSwipeFrame = null;
    let swipeVisualDirection = 0;
    let swipeVisualArmed = false;
    let swipeGestureId = 0;
    const SWIPE_ACTION_THRESHOLD = 88;
    const SWIPE_FLICK_THRESHOLD = 46;
    const SWIPE_FLICK_VELOCITY = 0.52;
    const SWIPE_MAX_TRANSLATE = 118;

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

    function getSwipeConfigForRow(rowElement) {
        const rowData = rowElement && rowElement.dataset ? rowElement.dataset : {};
        const classification = rowData.classification || 'tarantula';
        if (classification === 'plant') {
            return {
                right_swipe: { color: '#0a84ff', icon: '+', action: 'feed', next: 'normal', label: '水やり' },
                left_swipe: { color: '#7c3aed', icon: '↻', action: 'molt', next: 'normal', label: '植え替え' }
            };
        }

        return getSwipeConfig(rowData.status || 'normal');
    }

    function handleQuickAction(id, requestedAction, data = {}, rowElement = null) {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const today = `${year}-${month}-${day}`;

        const $row = rowElement ? $(rowElement) : $(`.setae-spider-list-row[data-id="${id}"]`);
        let action = requestedAction;
        let nextStatus = $row.data('status');
        let toastMsg = '';
        let toastType = 'success';

        if (action === 'feed') {
            nextStatus = 'normal';
            toastMsg = '給餌を記録しました';
        } else if (action === 'refused') {
            nextStatus = 'fasting';
            toastMsg = '拒食・様子見モードへ移行しました';
            toastType = 'warning';
        } else if (action === 'ate') {
            action = 'feed';
            nextStatus = 'normal';
            toastMsg = '拒食終了・通常モードへ戻しました';
        } else if (action === 'signs') {
            nextStatus = 'pre_molt';
            toastMsg = '脱皮準備モードへ移行しました';
            toastType = 'warning';
        } else if (action === 'molt') {
            nextStatus = 'post_molt';
            toastMsg = '脱皮を記録しました';
        } else if (action === 'measure') {
            nextStatus = 'normal';
            toastMsg = '通常モードへ戻しました';
        } else {
            return;
        }

        const optimisticChanges = { status: nextStatus };
        if (action === 'feed') {
            optimisticChanges.last_feed = today;
            optimisticChanges.last_prey = data.prey || 'コオロギ';
            optimisticChanges.is_hungry = false;
        }
        if (action === 'molt') {
            optimisticChanges.last_molt = today;
        }

        if (window.SetaeUIList && SetaeUIList.updateSpiderCard) {
            SetaeUIList.updateSpiderCard(id, optimisticChanges, {
                state: 'saving',
                label: '保存中'
            });
        } else {
            $row.attr('data-status', nextStatus).data('status', nextStatus);
        }

        const completeAction = function (response) {
            const serverChanges = response && (response.spider || response.data)
                ? (response.spider || response.data)
                : optimisticChanges;

            if (window.SetaeUIList && SetaeUIList.updateSpiderCard) {
                SetaeUIList.updateSpiderCard(id, serverChanges, {
                    state: 'updated',
                    label: '更新済み'
                });
            }
            if (toastMsg) SetaeCore.showToast(toastMsg, toastType);
        };

        const rollbackAction = function (xhr, fallbackMessage) {
            const message = typeof SetaeCore.getErrorMessage === 'function'
                ? SetaeCore.getErrorMessage(xhr, fallbackMessage || '記録を保存できませんでした。')
                : (fallbackMessage || '記録を保存できませんでした。');
            SetaeCore.showToast(message, 'error');
            if (window.SetaeUIList && SetaeUIList.refresh) {
                SetaeUIList.refresh();
            }
        };

        if (action === 'signs') {
            SetaeAPI.updateSpiderStatus(id, 'pre_molt', completeAction, function (xhr) {
                rollbackAction(xhr, '脱皮準備モードへ変更できませんでした。');
            });
        } else if (action === 'measure') {
            SetaeAPI.updateSpiderStatus(id, 'normal', function (response) {
                completeAction(response);
                if (window.SetaeUILogModal && SetaeUILogModal.openLogModal) {
                    SetaeUILogModal.openLogModal(id, 'growth');
                }
            }, function (xhr) {
                rollbackAction(xhr, '状態を更新できませんでした。');
            });
        } else if (action === 'refused') {
            SetaeAPI.getSpiderDetail(id, function (detailData) {
                const logs = detailData.history || [];
                const targetLog = logs.find(l => l.type === 'feed' && !l.refused);

                if (targetLog) {
                    SetaeAPI.updateLog(targetLog.id, { refused: true }, () => {
                        SetaeAPI.updateSpiderStatus(id, nextStatus, completeAction, function (xhr) {
                            rollbackAction(xhr, '拒食状態を保存できませんでした。');
                        });
                    }, function (xhr) {
                        rollbackAction(xhr, '給餌記録を更新できませんでした。');
                    });
                } else {
                    rollbackAction(null, '更新対象の給餌記録が見つかりませんでした。');
                }
            }, function (xhr) {
                rollbackAction(xhr, '個体情報を確認できませんでした。');
            });
        } else if (action === 'feed' || action === 'molt') {
            const logType = (action === 'molt') ? 'molt' : 'feed';
            const payload = {
                prey_type: data.prey || 'コオロギ',
                refused: false
            };

            SetaeAPI.logEvent(id, logType, today, payload, null, completeAction, function (xhr) {
                rollbackAction(xhr, `${logType === 'molt' ? '脱皮' : '給餌'}記録を保存できませんでした。`);
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
        const preyType = $row.data('prey') || 'コオロギ';

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
            // 個体データを取得（Refused判定などでも使い回すため外に出す）
            const spider = SetaeCore.state.cachedSpiders ? SetaeCore.state.cachedSpiders.find(s => s.id == id) : null;

            // ▼ 追加：給餌アクションで過去ログ（last_feed）がない場合はモーダルを開いて処理を中断
            if ((actionType === 'feed' || actionType === 'ate') && spider && !spider.last_feed) {
                if (window.SetaeUILogModal) SetaeUILogModal.openLogModal(id, 'feed');

                // UIのスワイプ状態をリセット
                $content.css('transform', 'translateX(0)');
                $row.find('.swipe-left, .swipe-right').removeClass('is-visible swipe-triggered is-resetting').css('width', '64px');
                return;
            }

            // Validation for Refused action
            if (actionType === 'refused') {
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

            let extraData = {};
            if (actionType === 'feed' || actionType === 'ate') {
                extraData = { prey: preyType };
            }
            handleQuickAction(id, actionType, extraData, rowElement);
        }
    };

    // ==========================================
    // Swipe Logic (Stateful)
    // ==========================================
    function getTouchPoint(e) {
        const sourceEvent = e && e.originalEvent ? e.originalEvent : e;
        const touches = sourceEvent && sourceEvent.changedTouches && sourceEvent.changedTouches.length
            ? sourceEvent.changedTouches
            : (sourceEvent ? sourceEvent.touches : null);
        const touch = touches && touches.length ? touches[0] : null;
        return touch
            ? { x: touch.clientX, y: touch.clientY }
            : { x: touchStartX, y: touchStartY };
    }

    function clearSwipeVisuals(row, content, bgLeft, bgRight) {
        if (content) {
            content.style.transform = '';
            content.style.transition = '';
        }
        if (row) {
            row.classList.remove('is-swipe-active', 'is-swipe-committing');
        }
        if (bgLeft) {
            bgLeft.classList.remove('is-visible', 'is-armed', 'swipe-triggered', 'is-resetting');
            bgLeft.style.transition = '';
        }
        if (bgRight) {
            bgRight.classList.remove('is-visible', 'is-armed', 'swipe-triggered', 'is-resetting');
            bgRight.style.transition = '';
        }
    }

    function cancelScheduledSwipeFrame(discardPending) {
        if (swipeFrameRequest !== null && typeof window.cancelAnimationFrame === 'function') {
            window.cancelAnimationFrame(swipeFrameRequest);
        }
        swipeFrameRequest = null;
        if (discardPending) pendingSwipeFrame = null;
    }

    function updateSwipeBackgrounds(direction, isArmed) {
        if (!swipeBgLeft || !swipeBgRight) return;
        if (direction === swipeVisualDirection && isArmed === swipeVisualArmed) return;

        if (direction > 0) {
            swipeBgLeft.classList.add('is-visible');
            swipeBgLeft.classList.toggle('is-armed', isArmed);
            swipeBgRight.classList.remove('is-visible', 'is-armed');
        } else if (direction < 0) {
            swipeBgRight.classList.add('is-visible');
            swipeBgRight.classList.toggle('is-armed', isArmed);
            swipeBgLeft.classList.remove('is-visible', 'is-armed');
        } else {
            swipeBgLeft.classList.remove('is-visible', 'is-armed');
            swipeBgRight.classList.remove('is-visible', 'is-armed');
        }

        swipeVisualDirection = direction;
        swipeVisualArmed = isArmed;
    }

    function renderSwipeFrame() {
        swipeFrameRequest = null;
        if (!currentSwipeRow || !swipeContent || !pendingSwipeFrame) return;

        const frame = pendingSwipeFrame;
        pendingSwipeFrame = null;
        const action = frame.diffX >= 0 ? swipeConfig.right_swipe : swipeConfig.left_swipe;
        const isUnavailable = !action || !action.action || action.action === 'locked' || action.action === 'wait';

        if (isUnavailable) {
            swipeContent.style.transform = 'translate3d(0, 0, 0)';
            updateSwipeBackgrounds(0, false);
            return;
        }

        const overThreshold = Math.max(0, frame.absX - SWIPE_ACTION_THRESHOLD);
        const translated = Math.min(
            (Math.min(frame.absX, SWIPE_ACTION_THRESHOLD) * 0.84) + (overThreshold * 0.22),
            SWIPE_MAX_TRANSLATE
        );
        const moveX = Math.sign(frame.diffX) * translated;
        const isArmed = frame.absX >= SWIPE_ACTION_THRESHOLD;

        swipeContent.style.transform = `translate3d(${moveX}px, 0, 0)`;

        if (isArmed && !swipeThresholdArmed && !swipeHapticSent) {
            swipeHapticSent = true;
            if (window.navigator && typeof window.navigator.vibrate === 'function') {
                window.navigator.vibrate(5);
            }
        }

        swipeThresholdArmed = isArmed;
        updateSwipeBackgrounds(Math.sign(frame.diffX), isArmed);
    }

    function scheduleSwipeFrame() {
        if (swipeFrameRequest !== null) return;
        if (typeof window.requestAnimationFrame === 'function') {
            swipeFrameRequest = window.requestAnimationFrame(renderSwipeFrame);
            return;
        }
        renderSwipeFrame();
    }

    function flushScheduledSwipeFrame() {
        cancelScheduledSwipeFrame(false);
        if (pendingSwipeFrame) renderSwipeFrame();
    }

    function releaseSwipeSession(row, gestureId, content, bgLeft, bgRight) {
        if (currentSwipeRow !== row || swipeGestureId !== gestureId) return;

        clearSwipeVisuals(row, content, bgLeft, bgRight);
        currentSwipeRow = null;
        swipeContent = null;
        swipeBgLeft = null;
        swipeBgRight = null;
        swipeConfig = null;
        pendingSwipeFrame = null;
        swipeVisualDirection = 0;
        swipeVisualArmed = false;
        isSwiping = false;
        isScrolling = false;
    }

    function handleTouchStart(e) {
        const point = getTouchPoint(e);
        const now = window.performance ? window.performance.now() : Date.now();

        cancelScheduledSwipeFrame(true);
        if (currentSwipeRow) {
            clearSwipeVisuals(
                currentSwipeRow,
                swipeContent || currentSwipeRow.querySelector('.setae-list-content'),
                swipeBgLeft || currentSwipeRow.querySelector('.swipe-left'),
                swipeBgRight || currentSwipeRow.querySelector('.swipe-right')
            );
        }

        swipeGestureId += 1;
        touchStartX = point.x;
        touchStartY = point.y;
        touchStartTime = now;
        lastTouchX = point.x;
        lastTouchTime = now;
        swipeVelocityX = 0;
        swipeThresholdArmed = false;
        swipeHapticSent = false;
        currentSwipeRow = this;
        isSwipeGestureActive = true;
        this.classList.add('is-swipe-active');
        isSwipeActionTaken = false;
        isSwiping = false;
        isScrolling = false;
        swipeVisualDirection = 0;
        swipeVisualArmed = false;

        swipeContent = this.querySelector('.setae-list-content');
        swipeBgLeft = this.querySelector('.swipe-left');
        swipeBgRight = this.querySelector('.swipe-right');
        swipeConfig = getSwipeConfigForRow(this);

        if (swipeContent) {
            swipeContent.style.transition = 'none';
            swipeContent.style.transform = 'translate3d(0, 0, 0)';
        }

        if (!swipeBgLeft || !swipeBgRight) return;

        swipeBgLeft.style.transition = 'none';
        swipeBgRight.style.transition = 'none';

        swipeBgLeft.classList.remove('is-visible', 'is-armed', 'swipe-triggered', 'is-resetting');
        swipeBgRight.classList.remove('is-visible', 'is-armed', 'swipe-triggered', 'is-resetting');

        // ▼ 変更箇所
        const preyType = this.dataset.prey || '';
        const spiderId = this.dataset.id;
        let hasLastFeed = false;

        // キャッシュから過去の給餌履歴があるか確認
        if (typeof SetaeCore !== 'undefined' && SetaeCore.state && SetaeCore.state.cachedSpiders) {
            const spider = SetaeCore.state.cachedSpiders.find(s => s.id == spiderId);
            if (spider && spider.last_feed) hasLastFeed = true;
        }

        // 右スワイプが給餌（feedまたはate）で、かつ過去の履歴がある（即時実行される）場合のみキャプションを渡す
        let rightCaption = '';
        if ((swipeConfig.right_swipe.action === 'feed' || swipeConfig.right_swipe.action === 'ate') && hasLastFeed) {
            rightCaption = preyType;
        }

        setupSwipeBg(swipeBgLeft, swipeConfig.right_swipe, rightCaption);
        setupSwipeBg(swipeBgRight, swipeConfig.left_swipe);
        // ▲ 変更箇所ここまで
    }

    // ▼▼▼ ここに追加：色とアイコンを注入する必須関数 ▼▼▼
    function setupSwipeBg(el, conf, caption = '') {
        if (!el || !conf) return;
        el.style.backgroundColor = conf.color;
        el.dataset.action = conf.action;

        const match = String(caption || '').match(/\((.*?)\)/);
        const shortCaption = match ? match[1] : String(caption || '');
        const signature = [conf.color, conf.action, conf.icon, conf.label, shortCaption].join('||');
        if (el.dataset.swipeSignature === signature) return;

        el.dataset.swipeSignature = signature;
        const action = document.createElement('span');
        const icon = document.createElement('span');
        const label = document.createElement('strong');

        action.className = 'setae-swipe-action';
        icon.className = 'swipe-icon';
        icon.setAttribute('aria-hidden', 'true');
        icon.textContent = conf.icon || '+';
        label.textContent = conf.label || '記録';
        action.append(icon, label);

        if (shortCaption) {
            const detail = document.createElement('small');
            detail.textContent = shortCaption;
            action.append(detail);
        }

        el.replaceChildren(action);
    }

    function handleTouchMove(e) {
        if (!currentSwipeRow || !isSwipeGestureActive || isScrolling) return;

        const point = getTouchPoint(e);
        const diffX = point.x - touchStartX;
        const diffY = point.y - touchStartY;
        const absX = Math.abs(diffX);
        const absY = Math.abs(diffY);

        if (!isSwiping) {
            if (Math.max(absX, absY) < 9) return;
            if (absX > absY * 1.2) {
                isSwiping = true;
            } else {
                isScrolling = true;
                return;
            }
        }

        if (typeof e.preventDefault === 'function' && e.cancelable !== false) e.preventDefault();

        const now = window.performance ? window.performance.now() : Date.now();
        const elapsed = Math.max(1, now - lastTouchTime);
        const instantVelocity = (point.x - lastTouchX) / elapsed;
        swipeVelocityX = (swipeVelocityX * 0.58) + (instantVelocity * 0.42);
        lastTouchX = point.x;
        lastTouchTime = now;

        pendingSwipeFrame = { diffX: diffX, absX: absX };
        scheduleSwipeFrame();
    }

    function handleTouchEnd(e) {
        if (!currentSwipeRow || !isSwipeGestureActive) return;
        const point = getTouchPoint(e);
        const now = window.performance ? window.performance.now() : Date.now();
        const diffX = point.x - touchStartX;
        const absX = Math.abs(diffX);
        if (isSwiping) {
            pendingSwipeFrame = { diffX: diffX, absX: absX };
            flushScheduledSwipeFrame();
        } else {
            cancelScheduledSwipeFrame(true);
        }
        const gestureDuration = Math.max(1, now - touchStartTime);
        const overallVelocity = diffX / gestureDuration;
        const recentVelocity = now - lastTouchTime > 120 ? 0 : swipeVelocityX;
        const effectiveVelocity = Math.abs(recentVelocity) > Math.abs(overallVelocity)
            ? recentVelocity
            : overallVelocity;
        const row = currentSwipeRow;
        const content = swipeContent;
        const bgLeft = swipeBgLeft;
        const bgRight = swipeBgRight;
        const config = swipeConfig;
        const gestureId = swipeGestureId;
        const actionConf = diffX > 0 ? config.right_swipe : config.left_swipe;
        const swipeBg = diffX > 0 ? bgLeft : bgRight;
        const isQuickFlick = absX >= SWIPE_FLICK_THRESHOLD
            && Math.abs(effectiveVelocity) >= SWIPE_FLICK_VELOCITY
            && Math.sign(effectiveVelocity) === Math.sign(diffX);
        const shouldCommit = isSwiping
            && (absX >= SWIPE_ACTION_THRESHOLD || isQuickFlick)
            && actionConf
            && actionConf.action
            && actionConf.action !== 'locked'
            && actionConf.action !== 'wait';

        isSwipeGestureActive = false;
        if (isSwiping && absX > 12) {
            row.dataset.suppressClickUntil = String(Date.now() + 700);
        }

        if (!content) {
            releaseSwipeSession(row, gestureId, content, bgLeft, bgRight);
            return;
        }
        content.style.transition = 'transform 280ms cubic-bezier(0.22, 1, 0.36, 1)';

        if (shouldCommit && swipeBg) {
            isSwipeActionTaken = true;
            row.classList.add('is-swipe-committing');
            swipeBg.classList.add('is-visible', 'is-armed', 'swipe-triggered');
            content.style.transform = `translate3d(${diffX > 0 ? SWIPE_MAX_TRANSLATE : -SWIPE_MAX_TRANSLATE}px, 0, 0)`;
            if (!swipeHapticSent && window.navigator && typeof window.navigator.vibrate === 'function') {
                window.navigator.vibrate(8);
            }

            window.setTimeout(function () {
                executeSwipeAction(row, actionConf, diffX > 0 ? 'right' : 'left');
                if (currentSwipeRow === row && swipeGestureId === gestureId) {
                    content.style.transform = 'translate3d(0, 0, 0)';
                }
            }, 110);
        } else {
            content.style.transform = 'translate3d(0, 0, 0)';
        }

        window.setTimeout(function () {
            releaseSwipeSession(row, gestureId, content, bgLeft, bgRight);
            window.setTimeout(function () { isSwipeActionTaken = false; }, 300);
        }, shouldCommit ? 430 : 280);
    }

    function handleTouchCancel() {
        if (!currentSwipeRow || !isSwipeGestureActive) return;
        const row = currentSwipeRow;
        const content = swipeContent;
        const bgLeft = swipeBgLeft;
        const bgRight = swipeBgRight;
        const gestureId = swipeGestureId;
        isSwipeGestureActive = false;
        cancelScheduledSwipeFrame(true);

        if (content) {
            content.style.transition = 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)';
            content.style.transform = 'translate3d(0, 0, 0)';
        }
        window.setTimeout(function () {
            releaseSwipeSession(row, gestureId, content, bgLeft, bgRight);
        }, 240);
    }





    return {
        handleQuickAction: handleQuickAction,
        executeSwipeAction: executeSwipeAction,
        getSwipeConfig: getSwipeConfig,
        getStatusColor: getStatusColor,
        handleTouchStart: handleTouchStart,
        handleTouchMove: handleTouchMove,
        handleTouchEnd: handleTouchEnd,
        handleTouchCancel: handleTouchCancel
    };

})(jQuery);
