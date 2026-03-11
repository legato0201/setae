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
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const today = `${year}-${month}-${day}`;

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

            // Default behavior (Quick Action / current logic)
            console.log(`🚀 Executing: ${actionType} -> New Status: ${newStatus} `);

            // 1. UIの即時更新
            $row.attr('data-status', newStatus);
            $row[0].dataset.status = newStatus;
            $content.attr('data-status', newStatus);

            // アニメーションの残像を消すため、少し遅延させてからインナーHTMLをクリア
            setTimeout(() => {
                $row.find('.setae-swipe-bg').removeAttr('style').html('').removeClass('swipe-triggered');
            }, 100);

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

            // スワイプ操作完了後、カードを少しモノクロ・半透明にして「お世話済み」を表現
            $content.css({
                'filter': 'grayscale(90%) opacity(1)'
            });

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
        isSwiping = false;
        isScrolling = false;

        const content = this.querySelector('.setae-list-content');
        const bgLeft = this.querySelector('.swipe-left');
        const bgRight = this.querySelector('.swipe-right');

        // ▼ 追加: スワイプ開始時にtransitionを無効化（ガタつき防止の最重要ポイント）
        if (content) content.style.transition = 'none';

        if (!bgLeft || !bgRight) return;

        // ▼ 追加: 背景側のtransitionも無効化
        bgLeft.style.transition = 'none';
        bgRight.style.transition = 'none';

        $('.setae-list-content').css('transform', 'translateX(0)');

        bgLeft.classList.remove('is-visible', 'swipe-triggered', 'is-resetting');
        bgRight.classList.remove('is-visible', 'swipe-triggered', 'is-resetting');
        bgLeft.style.width = '64px';
        bgRight.style.width = '64px';

        const status = $(this).data('status') || 'normal';
        const config = getSwipeConfig(status);

        // ▼ 変更箇所
        const preyType = $(this).data('prey') || '';
        const spiderId = $(this).data('id');
        let hasLastFeed = false;

        // キャッシュから過去の給餌履歴があるか確認
        if (typeof SetaeCore !== 'undefined' && SetaeCore.state && SetaeCore.state.cachedSpiders) {
            const spider = SetaeCore.state.cachedSpiders.find(s => s.id == spiderId);
            if (spider && spider.last_feed) hasLastFeed = true;
        }

        // 右スワイプが給餌（feedまたはate）で、かつ過去の履歴がある（即時実行される）場合のみキャプションを渡す
        let rightCaption = '';
        if ((config.right_swipe.action === 'feed' || config.right_swipe.action === 'ate') && hasLastFeed) {
            rightCaption = preyType;
        }

        setupSwipeBg(bgLeft, config.right_swipe, rightCaption);
        setupSwipeBg(bgRight, config.left_swipe);
        // ▲ 変更箇所ここまで
    }

    // ▼▼▼ ここに追加：色とアイコンを注入する必須関数 ▼▼▼
    function setupSwipeBg(el, conf, caption = '') {
        if (!el || !conf) return;
        el.style.backgroundColor = conf.color;
        el.dataset.action = conf.action;

        if (caption) {
            // キャプションがある場合（プロ仕様のレイアウト）
            // 括弧内の日本語だけを抽出する（例: "Dubia (デュビア)" -> "デュビア"）
            const match = caption.match(/\((.*?)\)/);
            const shortCaption = match ? match[1] : caption;

            el.innerHTML = `
                <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; width:100%;">
                    <span class="swipe-icon" style="font-size:20px; line-height:1; margin-bottom:2px;">${conf.icon}</span>
                    <span style="font-size:9px; color:#fff; font-weight:bold; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:90%; text-shadow:0 1px 2px rgba(0,0,0,0.3); letter-spacing:0.5px;">${shortCaption}</span>
                </div>
            `;
        } else {
            // 通常時
            el.innerHTML = `<span class="swipe-icon" style="font-size:24px; line-height:1;">${conf.icon}</span>`;
        }
    }
    // ▲▲▲ 追加ここまで ▲▲▲

    function handleTouchMove(e) {
        // ▼ 修正: スクロール判定済みなら処理を中断
        if (!currentSwipeRow || isScrolling) return;

        const diffX = e.changedTouches[0].screenX - touchStartX;
        const diffY = e.changedTouches[0].screenY - touchStartY;

        if (!isSwiping) {
            if (Math.abs(diffX) > Math.abs(diffY)) {
                isSwiping = true;
            } else {
                isScrolling = true;
                return;
            }
        }

        if (isSwiping) {
            e.preventDefault();
        }

        if (Math.abs(diffX) > 180) return;

        const content = currentSwipeRow.querySelector('.setae-list-content');
        const bgLeft = currentSwipeRow.querySelector('.swipe-left');
        const bgRight = currentSwipeRow.querySelector('.swipe-right');
        const status = $(currentSwipeRow).data('status');

        if (status === 'pre_molt' && diffX < 0) return;

        // ▼ 修正: 指への追従性を少し上げて重みを調整（dampFactor）
        const dampFactor = 0.6;
        const moveX = diffX * dampFactor;
        content.style.transform = `translateX(${moveX}px)`;

        // ▼ 修正: 玉が出現する閾値を少し早めに設定
        const threshold = 15;

        if (diffX > 0) {
            if (diffX > threshold) {
                if (!bgLeft.classList.contains('is-visible')) {
                    bgLeft.classList.add('is-visible'); // ここでボワッとアニメーション発火
                    bgRight.classList.remove('is-visible');
                    bgLeft.style.width = '64px';
                }
                // 60pxまでは丸い玉のまま維持し、それ以上引くとニョーンと伸びる
                const stretch = Math.max(0, diffX - 60);
                bgLeft.style.width = (64 + stretch * 0.4) + 'px';
            } else {
                // 閾値未満に戻したら消す
                bgLeft.classList.remove('is-visible');
            }

            let isPlant = false;
            const id = $(currentSwipeRow).data('id');
            if (typeof SetaeCore !== 'undefined' && SetaeCore.state && SetaeCore.state.cachedSpiders) {
                const spider = SetaeCore.state.cachedSpiders.find(s => s.id == id);
                if (spider && spider.classification === 'plant') isPlant = true;
            }
            if (!isPlant && $(currentSwipeRow).data('classification') === 'plant') isPlant = true;

            if (isPlant) {
                bgLeft.style.backgroundColor = '#3498db';
                bgLeft.innerHTML = '<span class="swipe-icon" style="font-size:24px; color:#fff;">💧</span>';
            }

        } else if (diffX < 0) {
            if (Math.abs(diffX) > threshold) {
                if (!bgRight.classList.contains('is-visible')) {
                    bgRight.classList.add('is-visible'); // ここでボワッとアニメーション発火
                    bgLeft.classList.remove('is-visible');
                    bgRight.style.width = '64px';
                }
                const stretch = Math.max(0, Math.abs(diffX) - 60);
                bgRight.style.width = (64 + stretch * 0.4) + 'px';
            } else {
                // 閾値未満に戻したら消す
                bgRight.classList.remove('is-visible');
            }

            let isPlant = false;
            const id = $(currentSwipeRow).data('id');
            if (typeof SetaeCore !== 'undefined' && SetaeCore.state && SetaeCore.state.cachedSpiders) {
                const spider = SetaeCore.state.cachedSpiders.find(s => s.id == id);
                if (spider && spider.classification === 'plant') isPlant = true;
            }
            if (!isPlant && $(currentSwipeRow).data('classification') === 'plant') isPlant = true;

            if (isPlant) {
                bgRight.style.backgroundColor = '#8e44ad';
                bgRight.innerHTML = '<span class="swipe-icon" style="font-size:24px; color:#fff;">🪴</span>';
            }
        }
    }

    function handleTouchEnd(e) {
        if (!currentSwipeRow) return;
        const diffX = e.changedTouches[0].screenX - touchStartX;
        const row = currentSwipeRow;
        const content = row.querySelector('.setae-list-content');
        const status = $(row).data('status') || 'normal';
        const config = getSwipeConfig(status);

        let actionConf = null;

        // スマホでの操作性を考慮し、アクション発動の閾値を少し軽く(90px)設定
        const actionThreshold = 90;

        if (diffX > actionThreshold) actionConf = config.right_swipe;
        else if (diffX < -actionThreshold) actionConf = config.left_swipe;

        let swipeBg = null;
        if (diffX > actionThreshold) swipeBg = row.querySelector('.swipe-left');
        else if (diffX < -actionThreshold) swipeBg = row.querySelector('.swipe-right');

        // ▼ 追加: 指が離れた瞬間にtransitionを復元して滑らかに元の位置へ戻す
        content.style.transition = 'transform 0.4s cubic-bezier(0.25, 1, 0.5, 1)';
        const bgLeft = row.querySelector('.swipe-left');
        const bgRight = row.querySelector('.swipe-right');
        if (bgLeft) bgLeft.style.transition = '';
        if (bgRight) bgRight.style.transition = '';

        if (actionConf && actionConf.action && actionConf.action !== 'locked' && actionConf.action !== 'wait' && swipeBg) {
            swipeBg.style.width = '64px';
            swipeBg.classList.add('is-resetting');

            setTimeout(() => {
                swipeBg.classList.remove('is-resetting');
                swipeBg.classList.add('swipe-triggered');

                setTimeout(() => {
                    const dir = (diffX > 0) ? 'right' : 'left';
                    executeSwipeAction(row, actionConf, dir);
                    isSwipeActionTaken = true;

                    content.style.transform = 'translateX(0)';

                    setTimeout(() => {
                        content.style.transition = '';
                        if (swipeBg) {
                            swipeBg.classList.remove('is-visible', 'swipe-triggered');
                            swipeBg.style.width = '64px';
                        }
                        currentSwipeRow = null;
                        setTimeout(() => isSwipeActionTaken = false, 300);
                    }, 400);
                }, 300);
            }, 150);
        } else {
            content.style.transform = 'translateX(0)';

            if (bgLeft) bgLeft.style.width = '64px';
            if (bgRight) bgRight.style.width = '64px';

            setTimeout(() => {
                content.style.transition = '';
                if (bgLeft) bgLeft.classList.remove('is-visible', 'swipe-triggered', 'is-resetting');
                if (bgRight) bgRight.classList.remove('is-visible', 'swipe-triggered', 'is-resetting');

                currentSwipeRow = null;
                setTimeout(() => isSwipeActionTaken = false, 300);
            }, 400);
        }
    }

    // ==========================================
    // PC用: ホバー時の玉の出現（ボワッ）
    // ==========================================
    function initDesktopHoverLogic() {
        $(document).on('mousemove', '.setae-spider-list-row', function (e) {
            if (currentSwipeRow) return;
            const width = $(this).outerWidth();
            const percent = (e.pageX - $(this).offset().left) / width;
            const content = this.querySelector('.setae-list-content');

            const bgLeft = this.querySelector('.swipe-left');
            const bgRight = this.querySelector('.swipe-right');

            // ★ PC版：ホバー時に背景色やアイコンを生成する
            if (bgLeft && !bgLeft.dataset.setup) {
                const status = $(this).data('status') || 'normal';
                const config = getSwipeConfig(status);

                // ▼ 変更箇所
                const preyType = $(this).data('prey') || '';
                const spiderId = $(this).data('id');
                let hasLastFeed = false;

                if (typeof SetaeCore !== 'undefined' && SetaeCore.state && SetaeCore.state.cachedSpiders) {
                    const spider = SetaeCore.state.cachedSpiders.find(s => s.id == spiderId);
                    if (spider && spider.last_feed) hasLastFeed = true;
                }

                let rightCaption = '';
                if ((config.right_swipe.action === 'feed' || config.right_swipe.action === 'ate') && hasLastFeed) {
                    rightCaption = preyType;
                }

                setupSwipeBg(bgLeft, config.right_swipe, rightCaption);
                setupSwipeBg(bgRight, config.left_swipe);
                // ▲ 変更箇所ここまで

                bgLeft.dataset.setup = '1';
                bgRight.dataset.setup = '1';

                // インラインのvisibilityが残っている場合の対策
                bgLeft.style.visibility = '';
                bgRight.style.visibility = '';
            }

            if (percent < 0.2) {
                content.style.transform = 'translateX(20px)';
                if (bgLeft && !bgLeft.classList.contains('is-visible')) {
                    bgLeft.classList.add('is-visible'); // ここで透明化を解除して出現させる
                    if (bgRight) bgRight.classList.remove('is-visible');
                    bgLeft.style.width = '64px'; // PC版は伸びずに玉のまま表示する
                }
            } else if (percent > 0.8) {
                content.style.transform = 'translateX(-20px)';
                if (bgRight && !bgRight.classList.contains('is-visible')) {
                    bgRight.classList.add('is-visible'); // ここで透明化を解除して出現させる
                    if (bgLeft) bgLeft.classList.remove('is-visible');
                    bgRight.style.width = '64px';
                }
            } else {
                content.style.transform = 'translateX(0)';
                if (bgLeft) { bgLeft.classList.remove('is-visible'); bgLeft.style.width = '64px'; }
                if (bgRight) { bgRight.classList.remove('is-visible'); bgRight.style.width = '64px'; }
            }
        });

        $(document).on('mouseleave', '.setae-spider-list-row', function () {
            const content = this.querySelector('.setae-list-content');
            if (content) content.style.transform = 'translateX(0)';
            const bgLeft = this.querySelector('.swipe-left');
            const bgRight = this.querySelector('.swipe-right');
            // マウスが離れたら玉を消す
            if (bgLeft) { bgLeft.classList.remove('is-visible'); bgLeft.style.width = '64px'; }
            if (bgRight) { bgRight.classList.remove('is-visible'); bgRight.style.width = '64px'; }
        });
    }

    // ==========================================
    // PC用: クリック実行時の弾けるアクション（パチン）
    // ==========================================
    function animateDesktopAction($card, direction, actionConfig, $row) {
        // 対象の玉を取得
        const swipeBg = (direction === 'right') ? $row[0].querySelector('.swipe-left') : $row[0].querySelector('.swipe-right');

        // 弾ける水しぶきアニメーションのクラスを付与
        if (swipeBg) swipeBg.classList.add('swipe-triggered');

        // アニメーション（300ms）を見せてからアクションを実行
        setTimeout(() => {
            executeSwipeAction($row[0], actionConfig, direction);

            // カードを元の位置に戻し、状態をリセット
            setTimeout(() => {
                $card.css('transform', 'translateX(0)');
                if (swipeBg) swipeBg.classList.remove('is-visible', 'swipe-triggered');
                $row.data('rendered-status', null);
                $row.find('.swipe-left, .swipe-right').removeAttr('data-setup'); // 色とアイコンのリセット
            }, 300);
        }, 300);
    }

    function initDesktopClickLogic() {
        // スマホやタブレットでも誤作動する環境があるため、以前の判定を削除
        // if ('ontouchstart' in window) return;

        $(document).on('click', '.setae-spider-list-row', function (e) {
            // ▼▼▼ 追加: 操作元が「タッチ（スマホ等）」の場合はこの処理をスキップし、詳細画面を開く処理へ任せる ▼▼▼
            if (e.originalEvent && (e.originalEvent.pointerType === 'touch' || e.originalEvent.pointerType === 'pen')) {
                return;
            }

            // ▼▼▼ ここから追加: iOS Safariなど pointerType が判定できないタッチデバイス向けの対策 ▼▼▼
            if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) {
                return;
            }
            // ▲▲▲ 追加ここまで ▲▲▲

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