var SetaeUIFeeders = (function ($) {
    'use strict';

    const TOOL_STORAGE_KEY = 'setae_my_tool_v1';
    const VALID_TOOLS = ['collection', 'archive', 'feeders'];
    const TYPE_ICONS = {
        croco: '🦗',
        ieko: '🦗',
        red_runner: 'R',
        field_cricket: '🦗',
        mealworm: 'MW'
    };
    const CLASSIFICATION_ICONS = {
        tarantula: '🕷',
        scorpion: '🦂',
        reptile: '🦎',
        plant: '🌿',
        other: '□'
    };

    let currentTool = 'collection';
    let archivedSpiders = [];
    let archiveLoaded = false;
    let archiveLoading = false;
    let archiveReloadQueued = false;
    let feederDashboard = null;
    let feedersLoaded = false;
    let feedersLoading = false;
    let eventsExpanded = false;
    let initialized = false;

    function escapeHtml(value) {
        return String(value === undefined || value === null ? '' : value).replace(/[&<>"']/g, function (char) {
            return {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#039;'
            }[char];
        });
    }

    function getStoredTool() {
        try {
            const stored = localStorage.getItem(TOOL_STORAGE_KEY);
            return VALID_TOOLS.includes(stored) ? stored : 'collection';
        } catch (e) {
            return 'collection';
        }
    }

    function storeTool(tool) {
        try {
            localStorage.setItem(TOOL_STORAGE_KEY, tool);
        } catch (e) {
            // The selected pane still works when storage is unavailable.
        }
    }

    function openTool(tool, options) {
        const nextTool = VALID_TOOLS.includes(tool) ? tool : 'collection';
        const settings = options || {};
        const paneMap = {
            collection: '#setae-my-collection-pane',
            archive: '#setae-my-archive-pane',
            feeders: '#setae-feeder-pane'
        };

        currentTool = nextTool;
        storeTool(nextTool);

        $('.setae-my-tool-tab').each(function () {
            const isActive = $(this).data('my-tool') === nextTool;
            $(this)
                .toggleClass('is-active', isActive)
                .attr('aria-selected', isActive ? 'true' : 'false')
                .attr('tabindex', isActive ? '0' : '-1');
        });

        $('.setae-my-tool-pane').prop('hidden', true).hide();
        $(paneMap[nextTool]).prop('hidden', false).show();

        if (nextTool === 'archive' && (!archiveLoaded || settings.force)) {
            loadArchivedSpiders();
        }
        if (nextTool === 'feeders' && (!feedersLoaded || settings.force)) {
            loadFeederDashboard();
        }
    }

    function loadArchivedSpiders() {
        if (archiveLoading) {
            archiveReloadQueued = true;
            return;
        }
        archiveLoading = true;
        const $list = $('#setae-archive-list');
        $list.attr('aria-busy', 'true').html(`
            <div class="setae-view-state" role="status">
                <span class="setae-view-state-mark" aria-hidden="true"></span>
                <strong>アーカイブを読み込んでいます</strong>
            </div>
        `);

        SetaeAPI.fetchArchivedSpiders(function (items) {
            archivedSpiders = Array.isArray(items) ? items : [];
            archiveLoaded = true;
            $('#my-tool-archive-count').text(archivedSpiders.length);
            renderArchive();
        }).fail(function (xhr) {
            const message = SetaeCore.getErrorMessage
                ? SetaeCore.getErrorMessage(xhr, '通信状態を確認して、もう一度お試しください。')
                : '通信状態を確認して、もう一度お試しください。';
            $list.html(`
                <div class="setae-view-state is-error" role="alert">
                    <span class="setae-view-state-mark" aria-hidden="true"></span>
                    <strong>アーカイブを読み込めませんでした</strong>
                    <p>${escapeHtml(message)}</p>
                    <button type="button" class="js-retry-archive">もう一度読み込む</button>
                </div>
            `);
        }).always(function () {
            $list.removeAttr('aria-busy');
            archiveLoading = false;
            if (archiveReloadQueued) {
                archiveReloadQueued = false;
                loadArchivedSpiders();
            }
        });
    }

    function renderArchive() {
        const query = String($('#setae-archive-search').val() || '').trim().toLowerCase();
        const visibleItems = archivedSpiders.filter(function (spider) {
            if (!query) return true;
            const target = [spider.title, spider.species_name].join(' ').toLowerCase();
            return target.includes(query);
        });

        const latestArchivedAt = archivedSpiders.reduce(function (latest, spider) {
            const value = String(spider.archived_at || '').slice(0, 10);
            return value > latest ? value : latest;
        }, '');
        const transferredCount = archivedSpiders.filter(function (spider) { return !!spider.transfer_receipt; }).length;

        $('#setae-archive-summary').html(`
            <div class="setae-archive-stat">
                <span>保管中</span>
                <strong>${archivedSpiders.length}<small>匹</small></strong>
            </div>
            <div class="setae-archive-stat">
                <span>${transferredCount ? '譲渡済み' : '最近の追加'}</span>
                <strong class="${transferredCount ? '' : 'is-date'}">${transferredCount ? transferredCount + '<small>匹</small>' : (latestArchivedAt ? escapeHtml(formatDate(latestArchivedAt)) : '-')}</strong>
            </div>
        `);

        if (!archivedSpiders.length) {
            $('#setae-archive-list').html(`
                <div class="setae-archive-empty">
                    <span aria-hidden="true">□</span>
                    <h3>アーカイブはまだありません</h3>
                </div>
            `);
            return;
        }

        if (!visibleItems.length) {
            $('#setae-archive-list').html(`
                <div class="setae-archive-empty is-filtered">
                    <h3>一致する個体がありません</h3>
                    <button type="button" class="js-clear-archive-search">検索をクリア</button>
                </div>
            `);
            return;
        }

        const html = visibleItems.map(function (spider) {
            const image = spider.thumb
                ? `<img src="${escapeHtml(spider.thumb)}" alt="">`
                : `<span class="setae-archive-fallback">${escapeHtml(CLASSIFICATION_ICONS[spider.classification] || '□')}</span>`;

            const transferMeta = spider.transfer_receipt
                ? `<span class="setae-archive-transfer-badge">譲渡済み${spider.transfer_to_user_name ? ' / ' + escapeHtml(spider.transfer_to_user_name) + 'さん' : ''}</span>`
                : '';
            const restoreAction = spider.transfer_receipt
                ? ''
                : `<button type="button" class="setae-archive-restore-btn js-restore-spider" data-id="${escapeHtml(spider.id)}">飼育一覧へ戻す</button>`;

            return `
                <article class="setae-archive-item${spider.transfer_receipt ? ' is-transfer-receipt' : ''}" data-id="${escapeHtml(spider.id)}">
                    <button type="button" class="setae-archive-image js-open-archived-detail" data-id="${escapeHtml(spider.id)}" aria-label="${escapeHtml(spider.title || '個体')}の詳細">
                        ${image}
                    </button>
                    <div class="setae-archive-copy">
                        <span>${escapeHtml(spider.species_name || '種類不明')}</span>
                        <h3>${escapeHtml(spider.title || '名称未設定')}</h3>
                        ${transferMeta}
                        <time>${escapeHtml(formatDate(String(spider.archived_at || '').slice(0, 10)))}</time>
                    </div>
                    <div class="setae-archive-actions">
                        <button type="button" class="setae-archive-detail-btn js-open-archived-detail" data-id="${escapeHtml(spider.id)}">詳細</button>
                        ${restoreAction}
                    </div>
                </article>
            `;
        }).join('');

        $('#setae-archive-list').html(html);
    }

    function restoreSpider($button) {
        const spiderId = $button.data('id');
        if (!spiderId || $button.prop('disabled')) return;

        const originalText = $button.text();
        $button.prop('disabled', true).text('戻しています');
        SetaeAPI.setSpiderArchived(spiderId, false, function () {
            archivedSpiders = archivedSpiders.filter(function (spider) {
                return String(spider.id) !== String(spiderId);
            });
            $('#my-tool-archive-count').text(archivedSpiders.length);
            renderArchive();
            SetaeAPI.fetchMySpiders(function () {
                if (window.SetaeUIList && SetaeUIList.renderMySpiders) {
                    SetaeUIList.renderMySpiders();
                }
            });
            SetaeCore.showToast('飼育一覧に戻しました', 'success');
        }, function (xhr) {
            $button.prop('disabled', false).text(originalText);
            showApiError(xhr, '復元に失敗しました');
        });
    }

    function loadFeederDashboard() {
        if (feedersLoading) return;
        feedersLoading = true;
        $('#setae-feeder-app').attr('aria-busy', 'true').html(`
            <div class="setae-view-state" role="status">
                <span class="setae-view-state-mark" aria-hidden="true"></span>
                <strong>餌管理を読み込んでいます</strong>
                <p>在庫と孵化予定を整理しています。</p>
            </div>
        `);

        SetaeAPI.fetchFeederDashboard(function (data) {
            feederDashboard = data || null;
            feedersLoaded = true;
            renderFeederDashboard();
        }, function (xhr) {
            const message = SetaeCore.getErrorMessage
                ? SetaeCore.getErrorMessage(xhr, '通信状態を確認して、もう一度お試しください。')
                : '通信状態を確認して、もう一度お試しください。';
            $('#setae-feeder-app').html(`
                <div class="setae-view-state is-error" role="alert">
                    <span class="setae-view-state-mark" aria-hidden="true"></span>
                    <strong>餌管理を読み込めませんでした</strong>
                    <p>${escapeHtml(message)}</p>
                    <button type="button" class="js-retry-feeders">もう一度読み込む</button>
                </div>
            `);
        }).always(function () {
            $('#setae-feeder-app').removeAttr('aria-busy');
            feedersLoading = false;
        });
    }

    function renderFeederDashboard() {
        if (!feederDashboard) return;

        const summary = feederDashboard.summary || {};
        const inventory = Array.isArray(feederDashboard.inventory) ? feederDashboard.inventory : [];
        const batches = Array.isArray(feederDashboard.egg_batches) ? feederDashboard.egg_batches : [];
        const activeBatches = batches.filter(function (batch) { return batch.status === 'incubating'; });
        const lowStockCount = Number(summary.low_stock_count || 0);
        const $alert = $('#my-tool-feeder-alert');

        $alert.text(lowStockCount).prop('hidden', lowStockCount < 1);

        $('#setae-feeder-app').html(`
            <header class="setae-feeder-header">
                <div>
                    <span class="setae-section-kicker">FEEDER STOCK</span>
                    <h2>餌管理</h2>
                </div>
                <button type="button" class="setae-feeder-egg-button js-open-egg-modal">
                    <span aria-hidden="true">＋</span> 卵をセット
                </button>
            </header>

            <section class="setae-feeder-summary" aria-label="餌管理の概要">
                ${renderSummaryMetric('現在庫', formatNumber(summary.total_count || 0), '匹', 'stock')}
                ${renderSummaryMetric('在庫注意', lowStockCount, '種類', lowStockCount ? 'alert' : 'calm')}
                ${renderSummaryMetric('孵化待ち', summary.active_egg_batches || 0, 'セット', 'eggs')}
                ${renderSummaryMetric('次の孵化目安', summary.next_hatch_date ? formatShortDate(summary.next_hatch_date) : '-', summary.next_hatch_label || '', 'date')}
            </section>

            <div class="setae-feeder-workspace">
                <main class="setae-feeder-main">
                    <section class="setae-feeder-section">
                        <header class="setae-feeder-section-head">
                            <div>
                                <span>INVENTORY</span>
                                <h3>餌の在庫</h3>
                            </div>
                            <strong>${inventory.filter(function (item) { return item.initialized; }).length} / ${inventory.length} 種類</strong>
                        </header>
                        <div class="setae-feeder-stock-grid">
                            ${inventory.map(renderInventoryCard).join('')}
                        </div>
                    </section>
                </main>

                <aside class="setae-feeder-side">
                    <section class="setae-feeder-section setae-feeder-eggs-section">
                        <header class="setae-feeder-section-head">
                            <div>
                                <span>INCUBATION</span>
                                <h3>孵化予定</h3>
                            </div>
                            <strong>${activeBatches.length} セット</strong>
                        </header>
                        <div class="setae-feeder-egg-list">
                            ${activeBatches.length ? activeBatches.map(renderEggBatch).join('') : renderEggEmpty()}
                        </div>
                    </section>
                </aside>
            </div>

            <section class="setae-feeder-history setae-feeder-section">
                <header class="setae-feeder-section-head">
                    <div>
                        <span>HISTORY</span>
                        <h3>餌管理の履歴</h3>
                    </div>
                </header>
                ${renderFeederHistory()}
            </section>
        `);
    }

    function renderSummaryMetric(label, value, suffix, tone) {
        return `
            <div class="setae-feeder-summary-item is-${escapeHtml(tone)}">
                <span>${escapeHtml(label)}</span>
                <strong>${escapeHtml(value)}${suffix ? `<small>${escapeHtml(suffix)}</small>` : ''}</strong>
            </div>
        `;
    }

    function renderInventoryCard(item) {
        const isLow = item.initialized && Number(item.count) <= Number(item.low_stock_threshold);
        const statusClass = !item.initialized ? 'is-unset' : (isLow ? 'is-low' : 'is-ready');
        const statusLabel = !item.initialized ? '未登録' : (isLow ? '残りわずか' : '在庫あり');
        const cleanedLabel = item.last_cleaned_at ? formatDate(item.last_cleaned_at) : '清掃記録なし';
        const icon = TYPE_ICONS[item.feeder_type] || 'F';
        const identityHtml = `
            ${item.common_name ? `<b>${escapeHtml(item.common_name)}</b>` : ''}
            ${item.scientific_name ? `<i>${escapeHtml(item.scientific_name)}</i>` : ''}
        `;

        return `
            <article class="setae-feeder-stock-card ${statusClass}" data-type="${escapeHtml(item.feeder_type)}">
                <header>
                    <span class="setae-feeder-type-icon is-${escapeHtml(item.category || 'other')}">${escapeHtml(icon)}</span>
                    <div class="setae-feeder-type-copy">
                        <h4>${escapeHtml(item.label)}</h4>
                        <span class="setae-feeder-type-identity">${identityHtml}</span>
                        <span class="setae-feeder-stock-status">${escapeHtml(statusLabel)}</span>
                    </div>
                </header>
                <div class="setae-feeder-stock-count">
                    <strong>${item.initialized ? formatNumber(item.count) : '-'}</strong>
                    <span>匹</span>
                </div>
                <div class="setae-feeder-stock-meta">
                    <span>最終清掃</span>
                    <strong>${escapeHtml(cleanedLabel)}</strong>
                </div>
                <button type="button" class="setae-feeder-record-button js-open-feeder-action" data-type="${escapeHtml(item.feeder_type)}">
                    <span aria-hidden="true">＋</span> 記録
                </button>
            </article>
        `;
    }

    function renderEggEmpty() {
        return `
            <button type="button" class="setae-feeder-egg-empty js-open-egg-modal">
                <span aria-hidden="true">＋</span>
                <strong>卵をセット</strong>
            </button>
        `;
    }

    function renderEggBatch(batch) {
        const timing = getBatchTiming(batch);
        const progress = getBatchProgress(batch);
        const batchMeta = [batch.feeder_common_name, `${batch.temperature}℃`].filter(Boolean).join(' · ');

        return `
            <article class="setae-feeder-egg-card ${escapeHtml(timing.className)}">
                <header>
                    <span class="setae-feeder-type-icon is-egg">${escapeHtml(TYPE_ICONS[batch.feeder_type] || 'E')}</span>
                    <div>
                        <h4>${escapeHtml(batch.feeder_label)}</h4>
                        <span>${escapeHtml(batchMeta)}</span>
                    </div>
                    <strong>${escapeHtml(timing.label)}</strong>
                </header>
                <div class="setae-feeder-egg-window">
                    <span>孵化予定</span>
                    <strong>${escapeHtml(formatShortDate(batch.estimated_start_date))} - ${escapeHtml(formatShortDate(batch.estimated_end_date))}</strong>
                </div>
                <div class="setae-feeder-egg-progress" aria-hidden="true">
                    <span style="width:${progress}%"></span>
                </div>
                <footer>
                    <span>${escapeHtml(formatDate(batch.set_date))} セット</span>
                    <div>
                        <button type="button" class="js-cancel-egg-batch" data-id="${escapeHtml(batch.id)}">終了</button>
                        <button type="button" class="js-open-hatch-modal" data-id="${escapeHtml(batch.id)}">孵化を記録</button>
                    </div>
                </footer>
            </article>
        `;
    }

    function renderFeederHistory() {
        const events = feederDashboard && Array.isArray(feederDashboard.events) ? feederDashboard.events : [];
        if (!events.length) {
            return '<div class="setae-feeder-history-empty">まだ記録はありません</div>';
        }

        const visibleEvents = eventsExpanded ? events : events.slice(0, 8);
        const rows = visibleEvents.map(function (event) {
            const quantity = Number(event.quantity || 0);
            const isPositive = ['purchase', 'breed', 'hatched'].includes(event.action);
            const isNegative = event.action === 'consume';
            let quantityHtml = '<span class="is-neutral">-</span>';
            if (quantity > 0) {
                quantityHtml = `<span class="${isPositive ? 'is-positive' : (isNegative ? 'is-negative' : 'is-neutral')}">${isPositive ? '+' : (isNegative ? '-' : '')}${formatNumber(quantity)}匹</span>`;
            }

            return `
                <div class="setae-feeder-history-row">
                    <time>${escapeHtml(formatDate(event.date))}</time>
                    <span class="setae-feeder-history-type">${escapeHtml(event.feeder_label || '餌')}</span>
                    <strong>${escapeHtml(event.action_label || '記録')}</strong>
                    ${quantityHtml}
                    <em>${escapeHtml(event.note || '')}</em>
                </div>
            `;
        }).join('');

        return `
            <div class="setae-feeder-history-list">${rows}</div>
            ${events.length > 8 ? `<button type="button" class="setae-feeder-history-more js-toggle-feeder-history">${eventsExpanded ? '表示を戻す' : `履歴をもっと見る（${events.length}件）`}</button>` : ''}
        `;
    }

    function getBatchTiming(batch) {
        const today = parseDate(feederDashboard && feederDashboard.today);
        const start = parseDate(batch.estimated_start_date);
        const end = parseDate(batch.estimated_end_date);
        const estimated = parseDate(batch.estimated_hatch_date);
        if (!today || !start || !end) return { label: '孵化待ち', className: 'is-waiting' };

        if (today < start) {
            const days = Math.max(0, dateDiff(today, estimated || start));
            return { label: days === 0 ? 'まもなく' : `あと${days}日`, className: 'is-waiting' };
        }
        if (today <= end) {
            return { label: '予定期間', className: 'is-due' };
        }

        return { label: `${dateDiff(end, today)}日経過`, className: 'is-overdue' };
    }

    function getBatchProgress(batch) {
        const start = parseDate(batch.set_date);
        const end = parseDate(batch.estimated_end_date);
        const today = parseDate(feederDashboard && feederDashboard.today);
        if (!start || !end || !today) return 0;
        const total = Math.max(1, dateDiff(start, end));
        const elapsed = Math.max(0, dateDiff(start, today));
        return Math.min(100, Math.round((elapsed / total) * 100));
    }

    function ensureModals() {
        if ($('#setae-feeder-action-modal').length) return;

        $('body').append(`
            <div id="setae-feeder-action-modal" class="setae-modal setae-feeder-modal" style="display:none;">
                <div class="setae-modal-content setae-feeder-modal-content" role="dialog" aria-modal="true" aria-labelledby="setae-feeder-action-title">
                    <button type="button" class="setae-feeder-modal-close js-feeder-modal-close" aria-label="閉じる">&times;</button>
                    <header class="setae-feeder-modal-head">
                        <span id="setae-feeder-action-icon" class="setae-feeder-type-icon">F</span>
                        <div><span id="setae-feeder-action-context">STOCK LOG</span><h3 id="setae-feeder-action-title">在庫を記録</h3></div>
                    </header>
                    <form id="setae-feeder-action-form" novalidate>
                        <input type="hidden" id="setae-feeder-action-type">
                        <div class="setae-feeder-action-segments" role="radiogroup" aria-label="記録の種類">
                            ${renderActionSegment('purchase', '追加購入', true)}
                            ${renderActionSegment('consume', '給餌に使用', false)}
                            ${renderActionSegment('breed', '自家繁殖', false)}
                            ${renderActionSegment('box_reset', 'ボックス清掃', false)}
                        </div>
                        <div id="setae-feeder-quantity-group" class="setae-form-group">
                            <label for="setae-feeder-action-quantity" id="setae-feeder-quantity-label">匹数</label>
                            <div class="setae-feeder-number-field">
                                <input type="number" id="setae-feeder-action-quantity" min="1" max="100000" inputmode="numeric" required>
                                <span>匹</span>
                            </div>
                            <div id="setae-feeder-quantity-presets" class="setae-feeder-quantity-presets" aria-label="よく使う匹数"></div>
                        </div>
                        <div class="setae-feeder-form-grid">
                            <div class="setae-form-group">
                                <label for="setae-feeder-action-date">日付</label>
                                <input type="date" id="setae-feeder-action-date" class="setae-input" required>
                            </div>
                            <div class="setae-form-group">
                                <label for="setae-feeder-action-note">メモ</label>
                                <input type="text" id="setae-feeder-action-note" class="setae-input" maxlength="200" placeholder="任意">
                            </div>
                        </div>
                        <div id="setae-feeder-stock-preview" class="setae-feeder-stock-preview" aria-live="polite"></div>
                        <p id="setae-feeder-action-error" class="setae-feeder-form-error" role="alert" hidden></p>
                        <div class="setae-feeder-modal-actions">
                            <button type="button" class="setae-btn-secondary js-feeder-modal-close">キャンセル</button>
                            <button type="submit" class="setae-btn-primary" id="setae-feeder-action-submit">記録する</button>
                        </div>
                    </form>
                </div>
            </div>

            <div id="setae-feeder-egg-modal" class="setae-modal setae-feeder-modal" style="display:none;">
                <div class="setae-modal-content setae-feeder-modal-content" role="dialog" aria-modal="true" aria-labelledby="setae-feeder-egg-title">
                    <button type="button" class="setae-feeder-modal-close js-feeder-modal-close" aria-label="閉じる">&times;</button>
                    <header class="setae-feeder-modal-head">
                        <span class="setae-feeder-type-icon is-egg">E</span>
                        <div><span>INCUBATION</span><h3 id="setae-feeder-egg-title">卵をセット</h3></div>
                    </header>
                    <form id="setae-feeder-egg-form">
                        <div class="setae-feeder-form-grid">
                            <div class="setae-form-group">
                                <label for="setae-feeder-egg-type">種類</label>
                                <select id="setae-feeder-egg-type" class="setae-input" required></select>
                            </div>
                            <div class="setae-form-group">
                                <label for="setae-feeder-egg-date">セット日</label>
                                <input type="date" id="setae-feeder-egg-date" class="setae-input" required>
                            </div>
                        </div>
                        <div class="setae-form-group setae-feeder-temperature-field">
                            <div class="setae-feeder-temperature-label">
                                <label for="setae-feeder-egg-temperature-range">おおよその温度</label>
                                <div><input type="number" id="setae-feeder-egg-temperature" min="18" max="35" step="0.5" inputmode="decimal"><span>℃</span></div>
                            </div>
                            <input type="range" id="setae-feeder-egg-temperature-range" min="18" max="35" step="0.5" value="28">
                        </div>
                        <div id="setae-feeder-hatch-preview" class="setae-feeder-hatch-preview" aria-live="polite"></div>
                        <div class="setae-form-group">
                            <label for="setae-feeder-egg-note">メモ</label>
                            <textarea id="setae-feeder-egg-note" class="setae-input" rows="2" maxlength="300" placeholder="ケース名など（任意）"></textarea>
                        </div>
                        <div class="setae-feeder-modal-actions">
                            <button type="button" class="setae-btn-secondary js-feeder-modal-close">キャンセル</button>
                            <button type="submit" class="setae-btn-primary" id="setae-feeder-egg-submit">セットを保存</button>
                        </div>
                    </form>
                </div>
            </div>

            <div id="setae-feeder-hatch-modal" class="setae-modal setae-feeder-modal" style="display:none;">
                <div class="setae-modal-content setae-feeder-modal-content is-compact" role="dialog" aria-modal="true" aria-labelledby="setae-feeder-hatch-title">
                    <button type="button" class="setae-feeder-modal-close js-feeder-modal-close" aria-label="閉じる">&times;</button>
                    <header class="setae-feeder-modal-head">
                        <span class="setae-feeder-type-icon is-hatched">✓</span>
                        <div><span>HATCHED</span><h3 id="setae-feeder-hatch-title">孵化を記録</h3></div>
                    </header>
                    <form id="setae-feeder-hatch-form">
                        <input type="hidden" id="setae-feeder-hatch-id">
                        <div class="setae-feeder-form-grid">
                            <div class="setae-form-group">
                                <label for="setae-feeder-hatch-date">孵化日</label>
                                <input type="date" id="setae-feeder-hatch-date" class="setae-input" required>
                            </div>
                            <div class="setae-form-group">
                                <label for="setae-feeder-hatch-count">孵化数</label>
                                <div class="setae-feeder-number-field">
                                    <input type="number" id="setae-feeder-hatch-count" min="0" max="100000" inputmode="numeric" value="0">
                                    <span>匹</span>
                                </div>
                            </div>
                        </div>
                        <div class="setae-form-group">
                            <label for="setae-feeder-hatch-note">メモ</label>
                            <input type="text" id="setae-feeder-hatch-note" class="setae-input" maxlength="200" placeholder="任意">
                        </div>
                        <div class="setae-feeder-modal-actions">
                            <button type="button" class="setae-btn-secondary js-feeder-modal-close">キャンセル</button>
                            <button type="submit" class="setae-btn-primary" id="setae-feeder-hatch-submit">孵化を反映</button>
                        </div>
                    </form>
                </div>
            </div>
        `);
    }

    function renderActionSegment(value, label, checked) {
        return `
            <label>
                <input type="radio" name="setae_feeder_action" value="${escapeHtml(value)}"${checked ? ' checked' : ''}>
                <span>${escapeHtml(label)}</span>
            </label>
        `;
    }

    function openFeederActionModal(typeKey) {
        ensureModals();
        const item = getInventoryItem(typeKey);
        if (!item) return;

        $('#setae-feeder-action-type').val(typeKey);
        $('#setae-feeder-action-title').text(item.label + 'を記録');
        $('#setae-feeder-action-context').text([item.common_name, item.scientific_name].filter(Boolean).join(' · ') || 'STOCK LOG');
        $('#setae-feeder-action-icon').text(TYPE_ICONS[typeKey] || 'F').attr('class', `setae-feeder-type-icon is-${item.category || 'other'}`);
        $('input[name="setae_feeder_action"][value="purchase"]').prop('checked', true);
        $('#setae-feeder-action-quantity').val('').attr('max', 100000);
        $('#setae-feeder-action-date').val(feederDashboard.today || todayString());
        $('#setae-feeder-action-note').val('');
        setActionError('');
        updateActionForm();
        openModal($('#setae-feeder-action-modal'));
        setTimeout(function () { $('#setae-feeder-action-quantity').trigger('focus'); }, 120);
    }

    function updateActionForm() {
        const action = $('input[name="setae_feeder_action"]:checked').val() || 'purchase';
        const item = getInventoryItem($('#setae-feeder-action-type').val());
        const isReset = action === 'box_reset';
        const quantity = Math.max(0, Number($('#setae-feeder-action-quantity').val() || 0) || 0);
        const current = item ? Number(item.count || 0) : 0;
        let preview = '';
        let submitLabel = '記録する';
        const quantityLabels = {
            purchase: '購入した匹数',
            consume: '使用した匹数',
            breed: '繁殖で増えた匹数'
        };

        $('#setae-feeder-quantity-group').toggle(!isReset);
        $('#setae-feeder-action-quantity').prop('required', !isReset);
        $('#setae-feeder-quantity-label').text(quantityLabels[action] || '匹数');
        renderQuantityPresets(action, current);

        if (isReset) {
            preview = `<span>在庫 ${formatNumber(current)}匹</span><strong>在庫数は変わりません</strong>`;
            submitLabel = '清掃を記録';
        } else if (action === 'consume') {
            const after = Math.max(0, current - quantity);
            preview = `<span>現在 ${formatNumber(current)}匹</span><strong>${quantity ? `記録後 ${formatNumber(after)}匹` : '使用数を入力'}</strong>`;
            $('#setae-feeder-action-quantity').attr('max', Math.max(1, current));
        } else {
            const after = current + quantity;
            preview = `<span>現在 ${formatNumber(current)}匹</span><strong>${quantity ? `記録後 ${formatNumber(after)}匹` : '追加数を入力'}</strong>`;
            $('#setae-feeder-action-quantity').attr('max', 100000);
        }

        $('#setae-feeder-stock-preview').html(preview);
        $('#setae-feeder-action-submit').text(submitLabel);
    }

    function renderQuantityPresets(action, current) {
        const $presets = $('#setae-feeder-quantity-presets');
        if (action === 'box_reset') {
            $presets.empty().hide();
            return;
        }

        let values = action === 'consume' ? [1, 5, 10] : [10, 50, 100];
        if (action === 'consume') {
            values = values.filter(function (value) { return value <= current; });
        }

        if (!values.length) {
            $presets.empty().hide();
            return;
        }

        $presets.html(values.map(function (value) {
            return `<button type="button" class="js-feeder-quantity-preset" data-quantity="${value}">${value}匹</button>`;
        }).join('')).show();
    }

    function setActionError(message) {
        $('#setae-feeder-action-error')
            .text(message || '')
            .prop('hidden', !message);
    }

    function submitFeederAction(event) {
        event.preventDefault();
        const $button = $('#setae-feeder-action-submit');
        if ($button.prop('disabled')) return;

        const action = $('input[name="setae_feeder_action"]:checked').val() || 'purchase';
        const item = getInventoryItem($('#setae-feeder-action-type').val());
        const quantityValue = String($('#setae-feeder-action-quantity').val() || '').trim();
        const quantity = action === 'box_reset' ? 0 : Number(quantityValue);
        const date = $('#setae-feeder-action-date').val();

        if (action !== 'box_reset' && (!quantityValue || !Number.isInteger(quantity) || quantity < 1)) {
            const message = action === 'breed'
                ? '繁殖で増えた匹数を1匹以上で入力してください。'
                : '匹数を1匹以上の整数で入力してください。';
            setActionError(message);
            $('#setae-feeder-action-quantity').trigger('focus').select();
            return;
        }

        if (quantity > 100000) {
            setActionError('匹数は100,000匹以下で入力してください。');
            $('#setae-feeder-action-quantity').trigger('focus').select();
            return;
        }

        if (action === 'consume' && item && quantity > Number(item.count || 0)) {
            setActionError(`現在庫は${formatNumber(item.count)}匹です。在庫以内で入力してください。`);
            $('#setae-feeder-action-quantity').trigger('focus').select();
            return;
        }

        if (!parseDate(date)) {
            setActionError('記録日を入力してください。');
            $('#setae-feeder-action-date').trigger('focus');
            return;
        }

        setActionError('');
        const data = {
            feeder_type: $('#setae-feeder-action-type').val(),
            action: action,
            quantity: quantity,
            date: date,
            note: $('#setae-feeder-action-note').val()
        };
        const originalText = $button.text();
        $button.prop('disabled', true).text('保存中');

        const request = SetaeAPI.recordFeederAction(data, function (response) {
            feederDashboard = response.dashboard;
            renderFeederDashboard();
            closeModal($('#setae-feeder-action-modal'));
            SetaeCore.showToast(action === 'box_reset' ? '清掃を記録しました' : '在庫を更新しました', 'success');
        }, function (xhr) {
            $button.prop('disabled', false).text(originalText);
            setActionError(getApiErrorMessage(xhr, '在庫を更新できませんでした'));
            showApiError(xhr, '在庫を更新できませんでした');
        });

        if (request && typeof request.always === 'function') {
            request.always(function () {
                $button.prop('disabled', false).text(originalText);
            });
        }
    }

    function openEggModal(typeKey) {
        ensureModals();
        const types = feederDashboard && Array.isArray(feederDashboard.types) ? feederDashboard.types : [];
        const options = types.map(function (type) {
            const commonName = type.common_name ? `（${type.common_name}）` : '';
            return `<option value="${escapeHtml(type.key)}">${escapeHtml(type.label + commonName)}</option>`;
        }).join('');

        $('#setae-feeder-egg-type').html(options).val(typeKey || (types[0] && types[0].key));
        $('#setae-feeder-egg-date').val(feederDashboard.today || todayString());
        $('#setae-feeder-egg-note').val('');
        setEggDefaultTemperature();
        updateHatchPreview();
        openModal($('#setae-feeder-egg-modal'));
    }

    function setEggDefaultTemperature() {
        const type = getFeederType($('#setae-feeder-egg-type').val());
        const temperature = type && type.incubation ? Number(type.incubation.reference_temp || 28) : 28;
        $('#setae-feeder-egg-temperature, #setae-feeder-egg-temperature-range').val(temperature);
    }

    function updateHatchPreview() {
        const type = getFeederType($('#setae-feeder-egg-type').val());
        const setDate = $('#setae-feeder-egg-date').val();
        const temperature = Number($('#setae-feeder-egg-temperature').val());
        const estimate = calculateHatchEstimate(type, setDate, temperature);
        if (!estimate) {
            $('#setae-feeder-hatch-preview').html('<span>日付と温度を入力してください</span>');
            return;
        }

        $('#setae-feeder-hatch-preview').html(`
            <span>孵化の目安</span>
            <strong>${escapeHtml(formatDate(estimate.estimatedDate))} ごろ</strong>
            <em>${escapeHtml(formatShortDate(estimate.startDate))} - ${escapeHtml(formatShortDate(estimate.endDate))}</em>
            <small>温度・湿度・系統差で前後します</small>
        `);
    }

    function submitEggBatch(event) {
        event.preventDefault();
        const $button = $('#setae-feeder-egg-submit');
        if ($button.prop('disabled')) return;

        const data = {
            feeder_type: $('#setae-feeder-egg-type').val(),
            set_date: $('#setae-feeder-egg-date').val(),
            temperature: $('#setae-feeder-egg-temperature').val(),
            note: $('#setae-feeder-egg-note').val()
        };
        $button.prop('disabled', true).text('保存中');

        SetaeAPI.createFeederEggBatch(data, function (response) {
            feederDashboard = response.dashboard;
            renderFeederDashboard();
            closeModal($('#setae-feeder-egg-modal'));
            $button.prop('disabled', false).text('セットを保存');
            SetaeCore.showToast('孵化予定を追加しました', 'success');
        }, function (xhr) {
            $button.prop('disabled', false).text('セットを保存');
            showApiError(xhr, '卵セットを保存できませんでした');
        });
    }

    function openHatchModal(batchId) {
        ensureModals();
        const batch = getEggBatch(batchId);
        if (!batch) return;

        $('#setae-feeder-hatch-id').val(batchId);
        $('#setae-feeder-hatch-title').text(batch.feeder_label + 'の孵化');
        $('#setae-feeder-hatch-date').val(feederDashboard.today || todayString());
        $('#setae-feeder-hatch-count').val(0);
        $('#setae-feeder-hatch-note').val('');
        openModal($('#setae-feeder-hatch-modal'));
        setTimeout(function () { $('#setae-feeder-hatch-count').trigger('focus').select(); }, 120);
    }

    function submitHatch(event) {
        event.preventDefault();
        const $button = $('#setae-feeder-hatch-submit');
        if ($button.prop('disabled')) return;

        $button.prop('disabled', true).text('反映中');
        SetaeAPI.updateFeederEggBatch($('#setae-feeder-hatch-id').val(), {
            status: 'hatched',
            actual_hatch_date: $('#setae-feeder-hatch-date').val(),
            hatched_count: $('#setae-feeder-hatch-count').val(),
            note: $('#setae-feeder-hatch-note').val()
        }, function (response) {
            feederDashboard = response.dashboard;
            renderFeederDashboard();
            closeModal($('#setae-feeder-hatch-modal'));
            $button.prop('disabled', false).text('孵化を反映');
            SetaeCore.showToast('孵化と在庫を反映しました', 'success');
        }, function (xhr) {
            $button.prop('disabled', false).text('孵化を反映');
            showApiError(xhr, '孵化を反映できませんでした');
        });
    }

    function cancelEggBatch(batchId, $button) {
        const batch = getEggBatch(batchId);
        if (!batch) return;

        const confirmation = SetaeCore.confirmAction
            ? SetaeCore.confirmAction({
                title: '卵セットを終了',
                message: batch.feeder_label + 'の孵化待ちを終了します。',
                details: [
                    '在庫数は変更されません',
                    '終了後も履歴には残ります'
                ],
                confirmLabel: '終了する',
                tone: 'danger'
            })
            : Promise.resolve(window.confirm(batch.feeder_label + 'の卵セットを終了しますか？'));

        confirmation.then(function (confirmed) {
            if (!confirmed || !getEggBatch(batchId)) return;

            $button.prop('disabled', true).text('終了中');
            SetaeAPI.updateFeederEggBatch(batchId, { status: 'cancelled' }, function (response) {
                feederDashboard = response.dashboard;
                renderFeederDashboard();
                SetaeCore.showToast('卵セットを終了しました', 'success');
            }, function (xhr) {
                $button.prop('disabled', false).text('終了');
                showApiError(xhr, '卵セットを終了できませんでした');
            });
        });
    }

    function calculateHatchEstimate(type, setDate, temperature) {
        if (!type || !type.incubation || !parseDate(setDate) || !Number.isFinite(temperature)) return null;
        const profile = type.incubation;
        let days = Math.round(Number(profile.reference_days) - ((temperature - Number(profile.reference_temp)) * Number(profile.sensitivity)));
        days = Math.max(Number(profile.min_days), Math.min(Number(profile.max_days), days));
        const uncertainty = Math.max(2, Math.ceil(days * 0.2));

        return {
            estimatedDate: addDays(setDate, days),
            startDate: addDays(setDate, Math.max(1, days - uncertainty)),
            endDate: addDays(setDate, days + uncertainty)
        };
    }

    function getInventoryItem(typeKey) {
        const inventory = feederDashboard && Array.isArray(feederDashboard.inventory) ? feederDashboard.inventory : [];
        return inventory.find(function (item) { return item.feeder_type === typeKey; }) || null;
    }

    function getFeederType(typeKey) {
        const types = feederDashboard && Array.isArray(feederDashboard.types) ? feederDashboard.types : [];
        return types.find(function (type) { return type.key === typeKey; }) || null;
    }

    function getEggBatch(batchId) {
        const batches = feederDashboard && Array.isArray(feederDashboard.egg_batches) ? feederDashboard.egg_batches : [];
        return batches.find(function (batch) { return String(batch.id) === String(batchId); }) || null;
    }

    function openModal($modal) {
        $modal.stop(true, true).fadeIn(140).addClass('is-open');
        $('body').addClass('setae-has-open-modal');
    }

    function closeModal($modal) {
        $modal.stop(true, true).fadeOut(120).removeClass('is-open');
        if (!$('.setae-feeder-modal.is-open').not($modal).length) {
            $('body').removeClass('setae-has-open-modal');
        }
    }

    function getApiErrorMessage(xhr, fallback) {
        if (xhr && xhr.statusText === 'timeout') {
            return '通信に時間がかかっています。入力内容はそのままなので、もう一度お試しください。';
        }

        return xhr && xhr.responseJSON && xhr.responseJSON.message
            ? xhr.responseJSON.message
            : fallback;
    }

    function showApiError(xhr, fallback) {
        const message = getApiErrorMessage(xhr, fallback);
        SetaeCore.showToast(message, 'error');
    }

    function parseDate(value) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return null;
        const date = new Date(String(value) + 'T12:00:00');
        return Number.isNaN(date.getTime()) ? null : date;
    }

    function addDays(value, days) {
        const date = parseDate(value);
        if (!date) return '';
        date.setDate(date.getDate() + Number(days || 0));
        return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
    }

    function dateDiff(start, end) {
        return Math.round((end.getTime() - start.getTime()) / 86400000);
    }

    function formatDate(value) {
        const date = parseDate(String(value || '').slice(0, 10));
        if (!date) return '-';
        return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
    }

    function formatShortDate(value) {
        const date = parseDate(String(value || '').slice(0, 10));
        if (!date) return '-';
        return `${date.getMonth() + 1}/${date.getDate()}`;
    }

    function formatNumber(value) {
        return Number(value || 0).toLocaleString('ja-JP');
    }

    function todayString() {
        const date = new Date();
        return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
    }

    function bindEvents() {
        $(document).on('click', '.setae-my-tool-tab', function () {
            openTool($(this).data('my-tool'));
        });
        $(document).on('keydown', '.setae-my-tool-tab', function (event) {
            if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
            event.preventDefault();
            const index = VALID_TOOLS.indexOf($(this).data('my-tool'));
            const delta = event.key === 'ArrowRight' ? 1 : -1;
            const nextIndex = (index + delta + VALID_TOOLS.length) % VALID_TOOLS.length;
            $(`.setae-my-tool-tab[data-my-tool="${VALID_TOOLS[nextIndex]}"]`).trigger('click').trigger('focus');
        });
        $(document).on('input', '#setae-archive-search', renderArchive);
        $(document).on('click', '.js-clear-archive-search', function () {
            $('#setae-archive-search').val('');
            renderArchive();
        });
        $(document).on('click', '.js-retry-archive', loadArchivedSpiders);
        $(document).on('click', '.js-restore-spider', function () { restoreSpider($(this)); });
        $(document).on('click', '.js-open-archived-detail', function () {
            const id = $(this).data('id');
            if (id && window.SetaeUIDetail) SetaeUIDetail.loadSpiderDetail(id);
        });
        $(document).on('click', '.js-retry-feeders', loadFeederDashboard);
        $(document).on('click', '.js-open-feeder-action', function () { openFeederActionModal($(this).data('type')); });
        $(document).on('click', '.js-open-egg-modal', function () { openEggModal($(this).data('type')); });
        $(document).on('click', '.js-open-hatch-modal', function () { openHatchModal($(this).data('id')); });
        $(document).on('click', '.js-cancel-egg-batch', function () { cancelEggBatch($(this).data('id'), $(this)); });
        $(document).on('click', '.js-toggle-feeder-history', function () {
            eventsExpanded = !eventsExpanded;
            renderFeederDashboard();
        });
        $(document).on('click', '.js-feeder-modal-close', function () { closeModal($(this).closest('.setae-feeder-modal')); });
        $(document).on('click', '.setae-feeder-modal', function (event) {
            if (event.target === this) closeModal($(this));
        });
        $(document).on('keydown', function (event) {
            if (event.key === 'Escape') closeModal($('.setae-feeder-modal.is-open'));
        });
        $(document).on('change', 'input[name="setae_feeder_action"]', function () {
            $('#setae-feeder-action-quantity').val('');
            setActionError('');
            updateActionForm();
            if ($(this).val() !== 'box_reset') {
                $('#setae-feeder-action-quantity').trigger('focus');
            }
        });
        $(document).on('input', '#setae-feeder-action-quantity', function () {
            setActionError('');
            updateActionForm();
        });
        $(document).on('change', '#setae-feeder-action-date', function () { setActionError(''); });
        $(document).on('click', '.js-feeder-quantity-preset', function () {
            $('#setae-feeder-action-quantity').val($(this).data('quantity')).trigger('input');
        });
        $(document).on('submit', '#setae-feeder-action-form', submitFeederAction);
        $(document).on('change', '#setae-feeder-egg-type', function () {
            setEggDefaultTemperature();
            updateHatchPreview();
        });
        $(document).on('input change', '#setae-feeder-egg-date, #setae-feeder-egg-temperature', updateHatchPreview);
        $(document).on('input change', '#setae-feeder-egg-temperature-range', function () {
            $('#setae-feeder-egg-temperature').val($(this).val());
            updateHatchPreview();
        });
        $(document).on('input change', '#setae-feeder-egg-temperature', function () {
            $('#setae-feeder-egg-temperature-range').val($(this).val());
        });
        $(document).on('submit', '#setae-feeder-egg-form', submitEggBatch);
        $(document).on('submit', '#setae-feeder-hatch-form', submitHatch);
    }

    function init() {
        if (initialized || !$('#section-my').length) return;
        initialized = true;
        bindEvents();
        ensureModals();
        const storedTool = (window.SetaeSettings && SetaeSettings.guest_mode) ? 'collection' : getStoredTool();
        openTool(storedTool);
        if (storedTool !== 'archive') {
            loadArchivedSpiders();
        }
    }

    $(init);

    return {
        init: init,
        openTool: openTool,
        refreshArchive: function () {
            archiveLoaded = false;
            loadArchivedSpiders();
        },
        refreshFeeders: function () {
            feedersLoaded = false;
            if (currentTool === 'feeders') loadFeederDashboard();
        },
        getCurrentTool: function () { return currentTool; }
    };
})(jQuery);
