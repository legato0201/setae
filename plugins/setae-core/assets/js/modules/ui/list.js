var SetaeUIList = (function ($) {
    'use strict';

    let emptyMySpidersTracked = false;
    let firstRecordPromptTracked = false;
    let dailyStreakPanelTracked = false;
    let continuePanelTracked = false;
    let emptyMyFilterTrackedKey = '';
    const LAST_SPIDER_KEY = 'setae_last_spider_v1';
    const CONTINUE_DISMISS_PREFIX = 'setae_continue_hidden_';
    const cardSyncTimers = {};
    const cardPendingFields = {};
    let cardRevealObserver = null;
    let cardPointerFrame = 0;
    let pendingCardPointer = null;
    const DESKTOP_CLASSIFICATION_DEFAULTS = {
        tarantula: { label: 'タランチュラ', icon: '🕷' },
        scorpion: { label: 'サソリ', icon: '🦂' },
        reptile: { label: '爬虫類', icon: '🦎' },
        plant: { label: '植物', icon: '🌿' },
        other: { label: 'その他', icon: '□' }
    };

    function renderLoading() {
        const $container = $('#setae-spider-list');
        if (!$container.length) return;

        $('#setae-today-check, #setae-species-pulse, #setae-continue-panel').hide().empty();
        $('#setae-my-desktop-dashboard').empty();
        $container.attr('aria-busy', 'true').html(`
            <div class="setae-view-state" role="status" aria-live="polite">
                <span class="setae-view-state-mark" aria-hidden="true"></span>
                <strong>飼育一覧を読み込んでいます</strong>
                <p>個体の状態と今日のケアを整理しています。</p>
            </div>
        `);
    }

    function renderLoadError(message) {
        const $container = $('#setae-spider-list');
        if (!$container.length) return;

        $('#setae-today-check, #setae-species-pulse, #setae-continue-panel').hide().empty();
        $('#setae-my-desktop-dashboard').empty();
        $container.removeAttr('aria-busy').html(`
            <div class="setae-view-state is-error" role="alert">
                <span class="setae-view-state-mark" aria-hidden="true"></span>
                <strong>飼育一覧を読み込めませんでした</strong>
                <p>${escapeHtml(message || '通信状態を確認して、もう一度お試しください。')}</p>
                <button type="button" class="js-retry-my-spiders">もう一度読み込む</button>
            </div>
        `);
    }

    function renderMySpiders() {
        const container = $('#setae-spider-list');
        container.empty().removeAttr('aria-busy').removeClass('setae-grid').addClass('setae-list-container');
        if (cardRevealObserver) {
            cardRevealObserver.disconnect();
            cardRevealObserver = null;
        }
        Object.keys(cardPendingFields).forEach(function (id) {
            delete cardPendingFields[id];
        });

        const allSpiders = (SetaeCore.state && Array.isArray(SetaeCore.state.cachedSpiders))
            ? SetaeCore.state.cachedSpiders
            : [];
        const spiders = getVisibleSpiders();

        $('#my-tool-active-count').text(allSpiders.length);

        updateDeckCounts();
        renderDesktopDashboard(allSpiders);
        renderTodayCheck(allSpiders);
        renderContinuePanel(allSpiders);

        if (spiders.length === 0) {
            const hasNoRegisteredSpiders = (SetaeCore.state.cachedSpiders.length === 0);
            const isDefaultView = !SetaeCore.state.currentSearch && SetaeCore.state.currentDeck === 'all';

            if (hasNoRegisteredSpiders && isDefaultView) {
                if (!emptyMySpidersTracked && typeof SetaeCore.track === 'function') {
                    emptyMySpidersTracked = true;
                    SetaeCore.track('empty_my_spiders_seen');
                }

                container.html(`
                    <div class="setae-empty-state setae-empty-my-spiders">
                        <span class="empty-icon">＋</span>
                        <h3>まずは1匹だけ登録しましょう</h3>
                        <p>
                            最初は名前と種類だけで十分です。写真や細かい情報は、慣れてから追加できます。
                        </p>
                        <div class="setae-first-start-grid">
                            <button type="button" class="setae-first-start-option js-open-add-spider"
                                data-start-mode="tarantula" data-source="empty_scientific">
                                <span>📖</span>
                                <strong>図鑑から選ぶ</strong>
                                <em>学名・和名で探して登録</em>
                            </button>
                            <button type="button" class="setae-first-start-option js-open-add-spider"
                                data-start-mode="other" data-source="empty_custom">
                                <span>✍️</span>
                                <strong>自由入力で登録</strong>
                                <em>未同定・植物・その他にも</em>
                            </button>
                            <button type="button" class="setae-first-start-option js-open-add-spider"
                                data-start-mode="tarantula" data-source="empty_quick">
                                <span>🕒</span>
                                <strong>あとで整える</strong>
                                <em>写真なしで1分登録</em>
                            </button>
                        </div>
                        <div class="setae-empty-actions">
                            <button type="button" class="setae-btn-secondary js-go-enc">登録前に図鑑を見る</button>
                        </div>
                    </div>
                `);
            } else {
                container.html(renderFilteredEmptyState(hasNoRegisteredSpiders));
            }
            return;
        }

        container.append(renderDesktopListHeader(spiders, allSpiders.length));

        let lastSpecies = null;
        spiders.forEach(spider => {
            // Species Header for multi-level sort
            if (SetaeCore.state.currentSort === 'species_asc') {
                const currentSpecies = spider.species_name || '未同定';
                if (currentSpecies !== lastSpecies) {
                    // Count how many of this species
                    const count = spiders.filter(s => (s.species_name || '未同定') === currentSpecies).length;
                    container.append(`
                        <div class="setae-list-header" style="padding:8px 12px; background:#f9f9f9; color:#666; font-size:13px; font-weight:bold; border-bottom:1px solid #eee; margin-top:0;">
                            ${currentSpecies} <span style="font-weight:normal; color:#999; margin-left:5px;">(${count})</span>
                        </div>
                    `);
                    lastSpecies = currentSpecies;
                }
            }
            container.append(renderSmartListItem(spider));
        });

        activateCardMotion(container, false);

        // ▼▼▼ チュートリアル呼び出し ▼▼▼
        if (typeof SetaeTutorial !== 'undefined') {
            SetaeTutorial.initSwipe();
        }
    }

    function activateCardMotion(scope, resetObserver) {
        const root = scope && scope.jquery ? scope[0] : scope;
        if (!root) return;

        if (resetObserver && cardRevealObserver) {
            cardRevealObserver.disconnect();
            cardRevealObserver = null;
        }

        const rows = root.matches && root.matches('.setae-spider-list-row')
            ? [root]
            : Array.from(root.querySelectorAll('.setae-spider-list-row'));
        if (!rows.length) return;

        const reducedMotion = window.matchMedia
            && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reducedMotion || !('IntersectionObserver' in window)) {
            rows.forEach(function (row) {
                row.classList.add('is-card-visible');
            });
            return;
        }

        if (!cardRevealObserver) {
            cardRevealObserver = new IntersectionObserver(function (entries, observer) {
                entries.forEach(function (entry) {
                    if (!entry.isIntersecting) return;

                    const row = entry.target;
                    const order = parseInt(row.style.getPropertyValue('--card-enter-order'), 10) || 0;
                    row.classList.add('is-card-visible');
                    observer.unobserve(row);
                    window.setTimeout(function () {
                        row.classList.remove('setae-card-enter', 'is-card-visible');
                        row.style.removeProperty('--card-enter-order');
                    }, 1250 + (order * 42));
                });
            }, {
                threshold: 0.08,
                rootMargin: '24px 0px 40px'
            });
        }

        rows.forEach(function (row, index) {
            row.classList.add('setae-card-enter');
            row.style.setProperty('--card-enter-order', String(Math.min(index, 8)));
            cardRevealObserver.observe(row);
        });
    }

    function supportsCardPointerMotion() {
        return !!(
            window.matchMedia
            && window.matchMedia('(hover: hover) and (pointer: fine)').matches
            && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
        );
    }

    function applyCardPointerMotion() {
        cardPointerFrame = 0;
        const motion = pendingCardPointer;
        pendingCardPointer = null;
        if (!motion || !motion.row || !document.documentElement.contains(motion.row)) return;

        const row = motion.row;
        const x = motion.x - 0.5;
        const y = motion.y - 0.5;
        row.style.setProperty('--card-tilt-x', `${(-y * 1.15).toFixed(3)}deg`);
        row.style.setProperty('--card-tilt-y', `${(x * 1.35).toFixed(3)}deg`);
        row.style.setProperty('--card-shadow-x', `${(x * 7).toFixed(2)}px`);
        row.style.setProperty('--card-shadow-y', `${(16 + (y * 4)).toFixed(2)}px`);
        row.style.setProperty('--card-photo-x', `${(x * 2.6).toFixed(2)}px`);
        row.style.setProperty('--card-photo-y', `${(y * 2.2).toFixed(2)}px`);
        row.classList.add('is-pointer-active');
    }

    function handleCardPointerMove(event) {
        if (!supportsCardPointerMotion()) return;

        const pointer = event.originalEvent || event;
        if (pointer.pointerType && pointer.pointerType !== 'mouse' && pointer.pointerType !== 'pen') return;

        const rect = this.getBoundingClientRect();
        if (!rect.width || !rect.height) return;

        pendingCardPointer = {
            row: this,
            x: Math.max(0, Math.min(1, (pointer.clientX - rect.left) / rect.width)),
            y: Math.max(0, Math.min(1, (pointer.clientY - rect.top) / rect.height))
        };
        if (!cardPointerFrame) {
            cardPointerFrame = window.requestAnimationFrame(applyCardPointerMotion);
        }
    }

    function handleCardPointerLeave() {
        if (pendingCardPointer && pendingCardPointer.row === this) {
            pendingCardPointer = null;
        }

        this.classList.remove('is-pointer-active');
        [
            '--card-tilt-x',
            '--card-tilt-y',
            '--card-shadow-x',
            '--card-shadow-y',
            '--card-photo-x',
            '--card-photo-y'
        ].forEach(function (property) {
            this.style.removeProperty(property);
        }, this);
    }

    function escapeHtml(value) {
        return String(value || '').replace(/[&<>"']/g, function (char) {
            return {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#039;'
            }[char];
        });
    }

    function getSpiderFallbackAsset(classification) {
        switch (classification) {
            case 'plant': return 'plant.svg';
            case 'scorpion': return 'scorpion.svg';
            case 'insect': return 'insect.svg';
            case 'reptile':
            case 'other': return 'generic-specimen.svg';
            case 'tarantula':
            default: return 'spider-silhouette.svg';
        }
    }

    function getClassificationMark(classification) {
        switch (classification) {
            case 'plant': return '🌿';
            case 'reptile': return '🦎';
            case 'scorpion': return '🦂';
            default: return '';
        }
    }

    function renderSpiderThumbnail(spider) {
        if (spider && spider.thumb) {
            return `<img src="${escapeHtml(spider.thumb)}" class="setae-avatar-img" alt="" loading="lazy">`;
        }

        const pluginUrl = (typeof SetaeSettings !== 'undefined' && SetaeSettings.plugin_url)
            ? String(SetaeSettings.plugin_url).replace(/\/$/, '')
            : '/wp-content/plugins/setae-core';
        const fallbackUrl = `${pluginUrl}/assets/images/specimen/${getSpiderFallbackAsset(spider && spider.classification)}`;

        return `
            <span class="setae-avatar-img setae-avatar-fallback">
                <img src="${escapeHtml(fallbackUrl)}" alt="画像なし">
            </span>
        `;
    }

    function getDesktopClassificationMeta(slug) {
        const normalized = String(slug || 'other');
        const fallback = DESKTOP_CLASSIFICATION_DEFAULTS[normalized] || {
            label: normalized.replace(/[-_]+/g, ' '),
            icon: '□'
        };
        const deck = 'cat_' + normalized;
        const $deck = $(`.deck-pill[data-deck="${deck}"]`);
        const icon = $deck.length ? String($deck.find('.pill-icon').text() || fallback.icon).trim() : fallback.icon;

        return {
            slug: normalized,
            deck: deck,
            label: $deck.length ? getDeckLabel(deck) : fallback.label,
            icon: icon || fallback.icon
        };
    }

    function getDesktopClassificationItems(spiders) {
        const groups = {};

        (Array.isArray(spiders) ? spiders : []).forEach(function (spider) {
            const slug = String(spider.classification || 'tarantula');
            if (!groups[slug]) {
                groups[slug] = Object.assign({ count: 0 }, getDesktopClassificationMeta(slug));
            }
            groups[slug].count++;
        });

        return Object.keys(groups).map(function (slug) {
            return groups[slug];
        }).sort(function (a, b) {
            if (a.count !== b.count) return b.count - a.count;
            return a.label.localeCompare(b.label, 'ja');
        });
    }

    function getDesktopCareItems(spiders) {
        return (Array.isArray(spiders) ? spiders : []).map(function (spider) {
            let reason = getTodayReason(spider);
            if (!reason && !hasCareHistory(spider)) {
                reason = getFirstRecordReason(spider);
            }
            return reason ? { spider: spider, reason: reason } : null;
        }).filter(Boolean).sort(function (a, b) {
            const priorityDiff = (b.reason.priority || 0) - (a.reason.priority || 0);
            return priorityDiff || (getDateScore(b.spider) - getDateScore(a.spider));
        });
    }

    function getDesktopCareTone(tone) {
        return ['alert', 'warning', 'hungry', 'start'].includes(tone) ? tone : 'calm';
    }

    function isAttentionSpider(spider) {
        if (!spider) return false;
        return spider.status === 'fasting'
            || spider.status === 'post_molt'
            || !hasCareHistory(spider);
    }

    function renderDesktopCareRows(items) {
        if (!items.length) {
            return '<div class="my-dashboard-calm-state">優先して確認する個体はありません</div>';
        }

        return items.slice(0, 4).map(function (item, index) {
            const spider = item.spider || {};
            const reason = item.reason || {};
            const tone = getDesktopCareTone(reason.tone);
            const title = spider.title || spider.species_name || '個体';
            const species = spider.species_name || '未同定';

            return `
                <button type="button" class="my-dashboard-priority js-desktop-dashboard-spider" data-id="${escapeHtml(spider.id)}" aria-label="${escapeHtml(title)}を開く">
                    <span class="my-dashboard-priority-rank is-${escapeHtml(tone)}" aria-hidden="true">${escapeHtml(String(index + 1).padStart(2, '0'))}</span>
                    <span class="my-dashboard-priority-avatar">${renderSpiderThumbnail(spider)}</span>
                    <span class="my-dashboard-priority-main">
                        <strong>${escapeHtml(title)}</strong>
                        <em>${escapeHtml(species)}</em>
                    </span>
                    <span class="my-dashboard-priority-reason is-${escapeHtml(tone)}">${escapeHtml(reason.label || '確認')}</span>
                </button>
            `;
        }).join('');
    }

    function renderDesktopDashboard(spiders) {
        const $dashboard = $('#setae-my-desktop-dashboard');
        if (!$dashboard.length) return;

        const allSpiders = Array.isArray(spiders) ? spiders : [];
        if (!allSpiders.length) {
            $dashboard.empty();
            return;
        }

        const summary = getCareSummary() || {};
        const total = allSpiders.length;
        const observed = Math.min(total, Math.max(0, parseInt(summary.observed_today, 10) || 0));
        const completion = Math.max(0, Math.min(100, parseInt(summary.completion_rate, 10) || (total ? Math.round((observed / total) * 100) : 0)));
        const hungryCount = allSpiders.filter(function (spider) { return !!spider.is_hungry; }).length;
        const preMoltCount = allSpiders.filter(function (spider) { return spider.status === 'pre_molt'; }).length;
        const attentionCount = allSpiders.filter(isAttentionSpider).length;
        const activeDeck = SetaeCore.state.currentDeck || 'all';
        const kpis = [
            { deck: 'all', label: '総個体数', value: total, note: `今日の確認 ${observed}/${total}`, icon: 'dashicons-admin-users', tone: 'green', progress: completion },
            { deck: 'normal', label: '通常管理', value: Math.max(0, total - attentionCount), note: '健全に飼育中', icon: 'dashicons-heart', tone: 'mint' },
            { deck: 'pre_molt', label: '脱皮が近い', value: preMoltCount, note: '静かに観察', icon: 'dashicons-hourglass', tone: 'amber' },
            { deck: 'hungry', label: '給餌が近い', value: hungryCount, note: '次回給餌を確認', icon: 'dashicons-admin-site-alt3', tone: 'blue' }
        ];

        $dashboard.html(`
            <section class="my-collection-kpis" aria-label="飼育状況">
                ${kpis.map(function (item) {
                    const activeClass = activeDeck === item.deck ? ' is-active' : '';
                    return `
                        <button type="button" class="my-collection-kpi is-${escapeHtml(item.tone)} js-desktop-dashboard-filter${activeClass}" data-deck="${escapeHtml(item.deck)}" aria-pressed="${activeDeck === item.deck ? 'true' : 'false'}">
                            <span class="my-collection-kpi-icon dashicons ${escapeHtml(item.icon)}" aria-hidden="true"></span>
                            <span class="my-collection-kpi-copy">
                                <small>${escapeHtml(item.label)}</small>
                                <strong>${escapeHtml(String(item.value))}<em>匹</em></strong>
                                <i>${escapeHtml(item.note)}</i>
                            </span>
                            ${typeof item.progress === 'number' ? `<span class="my-collection-kpi-progress" style="--kpi-progress:${item.progress}%" aria-hidden="true"><i></i></span>` : ''}
                        </button>
                    `;
                }).join('')}
            </section>
        `);
    }

    function renderDesktopListHeader(spiders, total) {
        const visibleCount = Array.isArray(spiders) ? spiders.length : 0;
        const filterText = getFilterSummaryText();

        return `
            <div class="my-desktop-list-header" aria-label="個体一覧">
                <div class="my-desktop-list-heading-main">
                    <strong>個体一覧</strong>
                    <span>${escapeHtml(String(visibleCount))} / ${escapeHtml(String(total || 0))}匹</span>
                    ${filterText ? `<em>${escapeHtml(filterText)}</em>` : ''}
                </div>
            </div>
        `;
    }

    function getDeckLabel(deck) {
        if (!deck || deck === 'all') return 'すべて';

        const $deck = $(`.deck-pill[data-deck="${deck}"]`).first();
        if (!$deck.length) return deck;

        const $clone = $deck.clone();
        $clone.find('.count-badge').remove();
        return $clone.text().replace(/\s+/g, ' ').trim() || deck;
    }

    function getFilterSummaryText() {
        const parts = [];
        const search = (SetaeCore.state.currentSearch || '').trim();
        const deck = SetaeCore.state.currentDeck || 'all';

        if (search) {
            parts.push(`検索「${search}」`);
        }

        if (deck !== 'all') {
            parts.push(`分類「${getDeckLabel(deck)}」`);
        }

        return parts.length ? parts.join(' / ') : '';
    }

    function trackFilteredEmptyState(hasNoRegisteredSpiders) {
        if (typeof SetaeCore.track !== 'function') return;

        const key = [
            SetaeCore.state.currentSearch || '',
            SetaeCore.state.currentDeck || 'all',
            hasNoRegisteredSpiders ? 'no_registered' : 'filtered'
        ].join('|');

        if (emptyMyFilterTrackedKey === key) return;
        emptyMyFilterTrackedKey = key;

        SetaeCore.track('my_spiders_filter_empty_seen', {
            search: !!(SetaeCore.state.currentSearch || '').trim(),
            deck: SetaeCore.state.currentDeck || 'all',
            total_spiders: SetaeCore.state.cachedSpiders.length,
            no_registered_spiders: hasNoRegisteredSpiders
        });
    }

    function renderFilteredEmptyState(hasNoRegisteredSpiders) {
        const summary = getFilterSummaryText();
        trackFilteredEmptyState(hasNoRegisteredSpiders);

        return `
            <div class="setae-empty-state">
                <span class="empty-icon">⌕</span>
                <h3>条件に合う個体がありません</h3>
                <p>${escapeHtml(summary)}では見つかりませんでした。条件を戻すと、登録済みの個体をすぐ確認できます。</p>
                <div class="setae-empty-actions">
                    <button type="button" class="setae-btn js-clear-my-filters">条件をリセット</button>
                    <button type="button" class="setae-btn-secondary js-open-add-spider" data-source="my_filter_empty">個体を追加</button>
                </div>
            </div>
        `;
    }

    function getDateScore(spider) {
        const dates = [spider.last_feed, spider.last_molt, spider.last_observation]
            .filter(Boolean)
            .map(value => new Date(value).getTime())
            .filter(value => !Number.isNaN(value));

        if (!dates.length) return parseInt(spider.id, 10) || 0;
        return Math.max.apply(null, dates);
    }

    function getLocalDayKey() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function getLocalTimestamp() {
        const now = new Date();
        const date = getLocalDayKey();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        return `${date} ${hours}:${minutes}:${seconds}`;
    }

    function readLastSpider() {
        try {
            const raw = localStorage.getItem(LAST_SPIDER_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            return null;
        }
    }

    function rememberLastSpider(spider) {
        if (!spider || !spider.id) return;

        try {
            localStorage.setItem(LAST_SPIDER_KEY, JSON.stringify({
                id: spider.id,
                saved_at: getLocalTimestamp()
            }));
        } catch (e) {
            // localStorageが使えない環境では何もしない。
        }
    }

    function getContinueDismissKey() {
        return CONTINUE_DISMISS_PREFIX + getLocalDayKey();
    }

    function isContinueHiddenToday() {
        try {
            return localStorage.getItem(getContinueDismissKey()) === '1';
        } catch (e) {
            return false;
        }
    }

    function hideContinueForToday() {
        try {
            localStorage.setItem(getContinueDismissKey(), '1');
        } catch (e) {
            // localStorageが使えない環境では、その場の表示だけ閉じる。
        }
    }

    function clearLastSpider() {
        try {
            localStorage.removeItem(LAST_SPIDER_KEY);
        } catch (e) {}
    }

    function getVisibleSpiders() {
        const source = (SetaeCore.state && Array.isArray(SetaeCore.state.cachedSpiders))
            ? SetaeCore.state.cachedSpiders
            : [];

        const spiders = source.filter(s => {
            if (SetaeCore.state.currentSearch) {
                const q = SetaeCore.state.currentSearch.toLowerCase();
                const name = (s.title || '').toLowerCase();
                const species = (s.species_name || '').toLowerCase();
                const specimenId = String(s.qr_code || s.id || '').toLowerCase();
                if (!name.includes(q) && !species.includes(q) && !specimenId.includes(q)) return false;
            }

            const deck = SetaeCore.state.currentDeck || 'all';
            if (deck === 'hungry') return s.is_hungry === true;
            if (deck === 'normal') return !isAttentionSpider(s) && !s.is_hungry;
            if (deck === 'pre_molt') return s.status === 'pre_molt';
            if (deck === 'attention') return isAttentionSpider(s);
            if (deck === 'favorite') return s.is_favorite === true;

            if (deck.startsWith('cat_')) {
                const targetCat = deck.replace('cat_', '');
                const myCat = s.classification || 'tarantula';

                if (targetCat === 'other') {
                    const knownCats = ['tarantula', 'scorpion', 'reptile', 'plant'];
                    return myCat === 'other' || !knownCats.includes(myCat);
                }

                return myCat === targetCat;
            }

            return true;
        });

        spiders.sort((a, b) => {
            const sort = SetaeCore.state.currentSort || 'priority';

            if (sort === 'priority') {
                const getScore = (s) => {
                    let score = 0;
                    if (s.status === 'pre_molt') score += 100;
                    if (s.status === 'fasting') score -= 50;
                    if (s.last_feed) {
                        const days = (new Date() - new Date(s.last_feed)) / (1000 * 60 * 60 * 24);
                        score += days;
                    } else {
                        score += 30;
                    }
                    return score;
                };
                return getScore(b) - getScore(a);
            }

            if (sort === 'classification') {
                const cA = (a.classification || 'tarantula');
                const cB = (b.classification || 'tarantula');
                if (cA !== cB) return cA.localeCompare(cB);
                return (a.title || '').localeCompare(b.title || '');
            }

            if (sort === 'species_asc') {
                const sA = (a.species_name || '').toLowerCase();
                const sB = (b.species_name || '').toLowerCase();
                if (sA !== sB) return sA.localeCompare(sB);
                return (a.title || '').localeCompare(b.title || '');
            }

            if (sort === 'hungriest') {
                const tA = a.last_feed ? new Date(a.last_feed).getTime() : 0;
                const tB = b.last_feed ? new Date(b.last_feed).getTime() : 0;
                return tA - tB;
            }

            if (sort === 'molt_oldest') {
                const tA = a.last_molt ? new Date(a.last_molt).getTime() : Date.now();
                const tB = b.last_molt ? new Date(b.last_molt).getTime() : Date.now();
                return tA - tB;
            }

            if (sort === 'name_asc') return (a.title || '').localeCompare(b.title || '');
            if (sort === 'newest') return b.id - a.id;

            return b.id - a.id;
        });

        return spiders;
    }

    function getAdjacentSpider(currentId) {
        const allSpiders = (SetaeCore.state && Array.isArray(SetaeCore.state.cachedSpiders))
            ? SetaeCore.state.cachedSpiders
            : [];
        let spiders = getVisibleSpiders();
        let index = spiders.findIndex(spider => String(spider.id) === String(currentId));

        if (index === -1) {
            spiders = allSpiders.slice();
            index = spiders.findIndex(spider => String(spider.id) === String(currentId));
        }

        if (index === -1 || spiders.length <= 1) {
            return {
                prev: null,
                next: null,
                index: index,
                total: spiders.length
            };
        }

        return {
            prev: index > 0 ? spiders[index - 1] : null,
            next: index < spiders.length - 1 ? spiders[index + 1] : null,
            index: index,
            total: spiders.length
        };
    }

    function getRecentSpiders(spiders) {
        return (Array.isArray(spiders) ? spiders : [])
            .slice()
            .sort((a, b) => getDateScore(b) - getDateScore(a));
    }

    function getTodayReason(spider) {
        const cls = spider.classification || 'tarantula';

        if (spider.status === 'normal' && !hasCareHistory(spider)) {
            return null;
        }

        if (spider.status === 'pre_molt') {
            return { priority: 100, tone: 'alert', label: '脱皮前', text: '脱皮前の様子を確認', recordType: 'note' };
        }

        if (spider.status === 'fasting') {
            return { priority: 90, tone: 'warning', label: '拒食中', text: '拒食中の様子見', recordType: 'feed' };
        }

        if (spider.is_hungry) {
            return {
                priority: 80,
                tone: 'hungry',
                label: cls === 'plant' ? '水やり目安' : '給餌目安',
                text: cls === 'plant' ? '水分状態を確認' : '給餌するか観察',
                recordType: 'feed'
            };
        }

        return null;
    }

    function renderTodaySummary(items) {
        const groups = {};
        items.forEach(item => {
            const label = item.reason && item.reason.label ? item.reason.label : '確認';
            const tone = String(item.reason && item.reason.tone ? item.reason.tone : 'calm')
                .replace(/[^a-z0-9_-]/gi, '') || 'calm';
            const key = `${tone}:${label}`;
            if (!groups[key]) {
                groups[key] = { label: label, tone: tone, count: 0 };
            }
            groups[key].count++;
        });

        const entries = Object.keys(groups).map(key => groups[key]);
        if (!entries.length) return '';

        const summaryLabel = entries
            .map(item => `${item.label} ${item.count}匹`)
            .join('、');

        return `
            <div class="care-signal-summary" aria-label="${escapeHtml(`今日見る個体の内訳、${summaryLabel}`)}">
                <div class="care-signal-track" aria-hidden="true">
                    ${entries.map(item => `
                        <i class="is-${escapeHtml(item.tone)}" style="--care-signal-weight:${item.count}"></i>
                    `).join('')}
                </div>
                <div class="care-signal-legend">
                    ${entries.map(item => `
                        <span class="is-${escapeHtml(item.tone)}">
                            <i aria-hidden="true"></i>
                            <b>${escapeHtml(item.label)}</b>
                            <strong>${escapeHtml(String(item.count))}</strong>
                        </span>
                    `).join('')}
                </div>
            </div>
        `;
    }

    function renderContinuePanel(spiders) {
        const $panel = $('#setae-continue-panel');
        if (!$panel.length) return;

        const allSpiders = Array.isArray(spiders) ? spiders : [];
        const isDefaultView = !SetaeCore.state.currentSearch && (SetaeCore.state.currentDeck || 'all') === 'all';
        const saved = readLastSpider();

        if (!isDefaultView || allSpiders.length === 0 || !saved || !saved.id || isContinueHiddenToday()) {
            $panel.hide().empty();
            return;
        }

        const spider = allSpiders.find(item => String(item.id) === String(saved.id));
        if (!spider) {
            clearLastSpider();
            $panel.hide().empty();
            return;
        }

        if (!continuePanelTracked && typeof SetaeCore.track === 'function') {
            continuePanelTracked = true;
            SetaeCore.track('continue_spider_panel_seen', {
                source: 'my_spiders'
            });
        }

        const savedLabel = saved.saved_at ? SetaeCore.formatRelativeDate(saved.saved_at) : '';
        const name = spider.title || spider.species_name || '個体';
        const species = spider.species_name || '未同定';
        const resumeMeta = savedLabel && savedLabel !== '-'
            ? `${species} · ${savedLabel}`
            : species;

        $panel.html(`
            <div class="setae-continue-card">
                <button type="button" class="setae-continue-target js-continue-open" data-id="${escapeHtml(spider.id)}" aria-label="${escapeHtml(name)}の続きから開く">
                    <span class="setae-continue-avatar">
                        ${renderSpiderThumbnail(spider)}
                    </span>
                    <span class="setae-continue-copy">
                        <span class="setae-continue-eyebrow">前回の続き</span>
                        <strong>${escapeHtml(name)}</strong>
                        <small>${escapeHtml(resumeMeta)}</small>
                    </span>
                    <span class="setae-continue-chevron" aria-hidden="true"></span>
                </button>
                <button type="button" class="setae-continue-dismiss js-continue-dismiss" aria-label="今日は表示しない">&times;</button>
            </div>
        `).show();
    }

    function getCareSummary() {
        return (SetaeCore.state && SetaeCore.state.careSummary) ? SetaeCore.state.careSummary : null;
    }

    function getStreakDayNumber(day) {
        const label = String(day && day.label ? day.label : '');
        if (label.indexOf('/') !== -1) {
            return label.split('/').pop();
        }
        return label || '';
    }

    function shiftDateString(dateString, offsetDays) {
        if (!dateString) return '';

        const parts = String(dateString).split('-').map(part => parseInt(part, 10));
        if (parts.length !== 3 || parts.some(part => Number.isNaN(part))) return '';

        const date = new Date(parts[0], parts[1] - 1, parts[2] + offsetDays);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function findStreakDay(summary, date) {
        const monthDays = summary && summary.month && Array.isArray(summary.month.days) ? summary.month.days : [];
        const monthDay = monthDays.find(day => day && day.date === date);
        if (monthDay) return monthDay;

        const week = summary && Array.isArray(summary.week) ? summary.week : [];
        return week.find(day => day && day.date === date) || null;
    }

    function getDefaultStreakDate(summary) {
        if (!summary) return '';

        const today = summary.today || '';
        const todayDay = today ? findStreakDay(summary, today) : null;
        if (todayDay) return todayDay.date;

        const week = Array.isArray(summary.week) ? summary.week : [];
        for (let i = week.length - 1; i >= 0; i--) {
            if (week[i] && week[i].checked) {
                return week[i].date;
            }
        }

        return today;
    }

    function getStreakDensityClass(logCount) {
        const count = parseInt(logCount, 10) || 0;
        if (count >= 5) return ' is-density-high';
        if (count >= 2) return ' is-density-mid';
        if (count >= 1) return ' is-density-low';
        return '';
    }

    function renderDailyStreak(summary) {
        if (!summary || !summary.total_spiders) return '';

        const streak = parseInt(summary.streak, 10) || 0;
        const bestStreak = parseInt(summary.best_streak, 10) || 0;
        const observedToday = parseInt(summary.observed_today, 10) || 0;
        const totalSpiders = parseInt(summary.total_spiders, 10) || 0;
        const pendingToday = Math.max(0, parseInt(summary.pending_today, 10) || (totalSpiders - observedToday));
        const hasRecordToday = !!(summary.today && summary.last_check_date === summary.today);
        const isComplete = totalSpiders > 0 && pendingToday === 0;
        const visibleStreak = hasRecordToday ? Math.max(1, streak) : streak + 1;
        const progress = totalSpiders > 0
            ? Math.min(100, Math.round((observedToday / totalSpiders) * 100))
            : 0;
        const rhythmLabel = `連続記録 ${visibleStreak}日、最高 ${bestStreak}日。今日 ${observedToday} / ${totalSpiders}匹${pendingToday > 0 ? `、あと${pendingToday}匹` : '、確認完了'}`;
        const week = Array.isArray(summary.week) ? summary.week : [];
        const weekCounts = week.map(day => parseInt(day.log_count, 10) || 0);
        const weekMax = Math.max(1, ...weekCounts);
        const weekTotal = weekCounts.reduce((total, count) => total + count, 0);
        const weekHtml = week.length ? `
            <div class="care-rhythm-week-head">
                <span>7日間のケア密度</span>
                <strong>${escapeHtml(String(weekTotal))}<small>件</small></strong>
            </div>
            <div class="care-rhythm-week" aria-label="直近7日の記録">
                ${week.map((day, index) => {
                    const logCount = parseInt(day.log_count, 10) || 0;
                    const level = logCount > 0
                        ? Math.max(24, Math.round((logCount / weekMax) * 100))
                        : 8;
                    const ariaLabel = `${day.label || day.date || ''} ${logCount > 0 ? `${logCount}件の記録` : '記録なし'}`;
                    return `
                    <button type="button" class="care-rhythm-day js-open-streak-day${day.checked ? ' is-checked' : ''}${getStreakDensityClass(logCount)}${day.date === summary.today ? ' is-today' : ''}" data-date="${escapeHtml(day.date || '')}" aria-label="${escapeHtml(ariaLabel)}" title="${escapeHtml(ariaLabel)}" style="--care-day-level:${level}%;--care-day-order:${index}">
                        <span>${escapeHtml(day.weekday || '')}</span>
                        <i aria-hidden="true"><b></b></i>
                        <strong>${logCount > 0 ? escapeHtml(String(logCount)) : '–'}</strong>
                    </button>
                    `;
                }).join('')}
            </div>
        ` : '';

        return `
            <div class="care-rhythm${isComplete ? ' is-complete' : ''}">
                <button type="button" class="care-rhythm-summary js-open-streak-calendar" aria-label="${escapeHtml(rhythmLabel)}。お世話カレンダーを開く" style="--care-progress:${progress}%">
                    <span class="care-rhythm-orbit" aria-hidden="true">
                        <span><strong>${escapeHtml(String(progress))}</strong><small>%</small></span>
                    </span>
                    <span class="care-rhythm-progress">
                        <span>今日の記録</span>
                        <strong>${escapeHtml(String(observedToday))}<small> / ${escapeHtml(String(totalSpiders))}匹</small></strong>
                        <em class="${isComplete ? 'is-done' : ''}">${pendingToday > 0 ? `あと ${escapeHtml(String(pendingToday))}匹` : '確認完了'}</em>
                    </span>
                    <span class="care-rhythm-streak">
                        <span>連続記録</span>
                        <strong>${escapeHtml(String(visibleStreak))}<small>日</small></strong>
                        <em>最高 ${escapeHtml(String(bestStreak))}日</em>
                    </span>
                    <span class="care-rhythm-chevron" aria-hidden="true"></span>
                </button>
                ${weekHtml}
            </div>
        `;
    }

    function renderStreakMonthCalendar(summary, selectedDate) {
        const month = summary && summary.month ? summary.month : null;
        const days = month && Array.isArray(month.days) ? month.days : [];
        if (!days.length) return '';

        const firstWeekday = parseInt(month.first_weekday, 10) || 0;
        const firstDate = days[0] && days[0].date ? days[0].date : '';
        const leadingDays = Array.from({ length: Math.max(0, Math.min(firstWeekday, 6)) }, (_, index) => {
            const date = shiftDateString(firstDate, index - firstWeekday);
            const existing = findStreakDay(summary, date) || {};
            const dayNumber = date ? String(parseInt(date.split('-')[2], 10) || '') : '';
            return Object.assign({}, existing, {
                date: date,
                day: existing.day || dayNumber,
                outside: true
            });
        });
        const weekdayLabels = ['日', '月', '火', '水', '木', '金', '土'];
        const renderMonthDay = (day) => {
            const logCount = parseInt(day.log_count, 10) || 0;
            const isFuture = !!day.future;
            const ariaLabel = `${day.label || day.date || ''} ${logCount > 0 ? `${logCount}件の記録` : (isFuture ? 'これからの日付' : '記録なし')}`;
            return `
            <button type="button" class="streak-month-day js-open-streak-day${day.checked ? ' is-checked' : ''}${getStreakDensityClass(logCount)}${day.date === summary.today ? ' is-today' : ''}${day.date === selectedDate ? ' is-active' : ''}${isFuture ? ' is-future' : ''}${day.outside ? ' is-outside' : ''}" data-date="${escapeHtml(day.date || '')}" aria-label="${escapeHtml(ariaLabel)}" ${isFuture ? 'disabled' : ''}>
                <strong>${escapeHtml(day.day || getStreakDayNumber(day))}</strong>
                ${logCount > 0 ? `<em>${escapeHtml(String(logCount))}</em>` : ''}
            </button>
            `;
        };

        return `
            <div class="streak-month-panel">
                <div class="streak-month-head">
                    <strong>${escapeHtml(month.label || '今月')}</strong>
                    <span>${escapeHtml(String(month.total_logs || 0))}件・${escapeHtml(String(month.active_days || 0))}日記録</span>
                </div>
                <div class="streak-month-weekdays" aria-hidden="true">
                    ${weekdayLabels.map(label => `<span>${escapeHtml(label)}</span>`).join('')}
                </div>
                <div class="streak-month-grid" aria-label="今月のお世話カレンダー">
                    ${leadingDays.map(renderMonthDay).join('')}
                    ${days.map(renderMonthDay).join('')}
                </div>
            </div>
        `;
    }

    function getTodayCheckedSpiderIds(summary) {
        const todayDay = summary && summary.today ? findStreakDay(summary, summary.today) : null;
        const ids = todayDay && Array.isArray(todayDay.spider_ids) ? todayDay.spider_ids : [];
        return new Set(ids.map(id => String(id)));
    }

    function getNextPendingCareSpider(summary) {
        const spiders = (SetaeCore.state && Array.isArray(SetaeCore.state.cachedSpiders))
            ? SetaeCore.state.cachedSpiders
            : [];
        if (!spiders.length) return null;

        const checkedIds = getTodayCheckedSpiderIds(summary);
        return spiders
            .filter(spider => spider && !checkedIds.has(String(spider.id)))
            .slice()
            .sort((a, b) => {
                const reasonA = getTodayReason(a);
                const reasonB = getTodayReason(b);
                const priorityA = reasonA ? reasonA.priority : 0;
                const priorityB = reasonB ? reasonB.priority : 0;
                if (priorityA !== priorityB) return priorityB - priorityA;
                return getDateScore(b) - getDateScore(a);
            })[0] || null;
    }

    function renderStreakDayAction(summary, day, selectedDate) {
        if (!summary || !summary.today || selectedDate !== summary.today) return '';

        const pendingCount = parseInt(summary.pending_today, 10) || 0;
        const nextSpider = pendingCount > 0 ? getNextPendingCareSpider(summary) : null;
        if (!nextSpider) {
            return `
                <div class="streak-day-action is-complete">
                    <div>
                        <strong>今日の記録は完了しています</strong>
                        <span>明日も1件残すと継続できます。</span>
                    </div>
                </div>
            `;
        }

        const reason = getTodayReason(nextSpider) || { recordType: 'note' };
        const title = nextSpider.title || nextSpider.species_name || '個体';
        return `
            <div class="streak-day-action">
                <div>
                    <strong>もう1件残せます</strong>
                    <span>次は ${escapeHtml(title)} を記録できます。</span>
                </div>
                <button type="button" class="js-streak-start-log" data-id="${escapeHtml(nextSpider.id || '')}" data-type="${escapeHtml(reason.recordType || 'note')}" data-date="${escapeHtml(summary.today)}">記録する</button>
            </div>
        `;
    }

    function renderStreakDayTypeSummary(day) {
        const typeCounts = day && Array.isArray(day.type_counts) ? day.type_counts : [];
        if (!typeCounts.length) return '';

        return `
            <div class="streak-day-types" aria-label="記録種別の内訳">
                ${typeCounts.map(item => `
                    <span>${escapeHtml(item.label || '記録')} ${escapeHtml(String(item.count || 0))}</span>
                `).join('')}
            </div>
        `;
    }

    function renderStreakDayLogs(day) {
        const logs = day && Array.isArray(day.logs) ? day.logs : [];
        const hiddenCount = parseInt(day && day.hidden_count, 10) || 0;

        if (!logs.length) {
            return `
                <div class="streak-day-empty">
                    <strong>この日の記録はまだありません</strong>
                    <span>記録を残すと、ここから振り返れるようになります。</span>
                </div>
            `;
        }

        return `
            <div class="streak-day-logs">
                ${logs.map(log => {
                    const spider = log.spider || {};
                    const canOpenDetail = !!log.shared;
                    const note = log.note ? `<span>${escapeHtml(log.note)}</span>` : '<span>記録だけ残しました</span>';
                    const actionLabel = canOpenDetail ? '詳細を見る' : '個体の記録へ';
                    return `
                    <button type="button" class="streak-log-row js-open-streak-log${canOpenDetail ? '' : ' is-private'}" data-id="${escapeHtml(log.id || '')}" data-spider-id="${escapeHtml(spider.id || '')}" data-shared="${canOpenDetail ? '1' : '0'}">
                        <span class="streak-log-type">${escapeHtml(log.type_label || '記録')}</span>
                        <strong>${escapeHtml(spider.title || '個体')}</strong>
                        ${note}
                        <em>${escapeHtml(actionLabel)}</em>
                    </button>
                    `;
                }).join('')}
                ${hiddenCount > 0 ? `<p class="streak-day-more">ほか ${escapeHtml(String(hiddenCount))}件の記録があります</p>` : ''}
            </div>
        `;
    }

    function openStreakDay(date, source) {
        const summary = getCareSummary();
        if (!summary) return;

        const selectedDate = date || getDefaultStreakDate(summary);
        const day = findStreakDay(summary, selectedDate) || {
            date: selectedDate,
            label: selectedDate,
            log_count: 0,
            spider_count: 0,
            logs: []
        };
        const logCount = parseInt(day.log_count, 10) || 0;
        const spiderCount = parseInt(day.spider_count, 10) || 0;
        const title = day.label ? `${day.label} のお世話` : '日別のお世話';
        const month = summary.month || {};

        $('#date-detail-title').text(month.label ? `${month.label}のお世話` : 'お世話カレンダー');
        $('#date-detail-list').html(`
            <div class="streak-day-modal">
                ${renderStreakMonthCalendar(summary, selectedDate)}
                <div class="streak-month-summary">
                    <span><strong>${escapeHtml(String(month.total_logs || 0))}</strong>今月の記録</span>
                    <span><strong>${escapeHtml(String(month.active_days || 0))}</strong>記録した日</span>
                    <span><strong>${escapeHtml(String(month.spider_count || 0))}</strong>個体</span>
                </div>
                <h4 class="streak-day-title">${escapeHtml(title)}</h4>
                <div class="streak-day-summary">
                    <span><strong>${escapeHtml(String(logCount))}</strong>件の記録</span>
                    <span><strong>${escapeHtml(String(spiderCount))}</strong>個体</span>
                </div>
                ${renderStreakDayTypeSummary(day)}
                ${renderStreakDayAction(summary, day, selectedDate)}
                ${renderStreakDayLogs(day)}
            </div>
        `);
        $('#btn-add-log-from-date').hide();
        $('#setae-date-detail-modal').fadeIn(160);

        if (typeof SetaeCore.track === 'function') {
            SetaeCore.track('daily_streak_calendar_open', {
                source: source || 'calendar',
                view: 'month',
                date: selectedDate,
                log_count: logCount,
                month_total_logs: parseInt(month.total_logs, 10) || 0
            });
        }
    }

    function handleStreakCalendarOpen(e) {
        if ($(e.target).closest('.js-open-streak-day, .js-open-streak-log').length) {
            return;
        }

        e.preventDefault();
        openStreakDay(getDefaultStreakDate(getCareSummary()), 'row');
    }

    function handleStreakCalendarKeydown(e) {
        if ($(e.currentTarget).is('button')) return;
        if (e.key !== 'Enter' && e.key !== ' ') return;
        if ($(e.target).closest('.js-open-streak-day, .js-open-streak-log').length) return;

        e.preventDefault();
        openStreakDay(getDefaultStreakDate(getCareSummary()), 'keyboard');
    }

    function handleStreakDayClick(e) {
        e.preventDefault();
        e.stopPropagation();
        openStreakDay($(this).data('date'), 'day');
    }

    function handleStreakStartLog(e) {
        e.preventDefault();
        e.stopPropagation();

        const id = $(this).data('id');
        const type = $(this).data('type') || 'note';
        const date = $(this).data('date') || '';
        if (!id || typeof SetaeUILogModal === 'undefined' || !SetaeUILogModal.openLogModal) return;

        $('#setae-date-detail-modal').fadeOut(120);
        SetaeUILogModal.openLogModal(id, type);
        if (date) {
            window.setTimeout(function () {
                $('#log-date').val(date).trigger('change');
            }, 0);
        }

        if (typeof SetaeCore.track === 'function') {
            SetaeCore.track('daily_streak_quick_record_open', {
                source: 'calendar',
                type: type
            });
        }
    }

    function handleStreakLogOpen(e) {
        e.preventDefault();
        e.stopPropagation();

        const id = parseInt($(this).data('id'), 10) || 0;
        const spiderId = parseInt($(this).data('spider-id'), 10) || 0;
        const isShared = String($(this).data('shared')) === '1';
        if (!id && !spiderId) return;

        $('#setae-date-detail-modal').fadeOut(120);
        if (isShared && window.SetaeUI && SetaeUI.openCareFeedDetail) {
            $('.setae-section').hide();
            if (typeof SetaeUI.syncPrimaryNav === 'function') {
                SetaeUI.syncPrimaryNav('section-care-feed');
            }
            SetaeUI.openCareFeedDetail(id);
        } else if (spiderId && window.SetaeUIDetail && SetaeUIDetail.loadSpiderDetail) {
            try {
                localStorage.setItem('setae_detail_tab_v1', 'tab-history');
            } catch (err) {}
            SetaeUIDetail.loadSpiderDetail(spiderId);
        }
        if (typeof SetaeCore.track === 'function') {
            SetaeCore.track('daily_streak_log_open', {
                source: 'calendar',
                target: isShared ? 'care_feed_detail' : 'spider_history'
            });
        }
    }

    function trackDailyStreakPanel(summary, context) {
        if (dailyStreakPanelTracked || !summary || !summary.total_spiders || typeof SetaeCore.track !== 'function') return;

        dailyStreakPanelTracked = true;
        SetaeCore.track('daily_streak_panel_seen', {
            context: context,
            streak: parseInt(summary.streak, 10) || 0,
            checked_today: !!(summary.today && summary.last_check_date === summary.today)
        });
    }

    function hasCareHistory(spider) {
        return !!(spider && (spider.last_feed || spider.last_molt || spider.last_observation));
    }

    function getFirstRecordReason(spider) {
        const cls = spider.classification || 'tarantula';
        const isPlant = cls === 'plant';

        return {
            priority: 70,
            tone: 'start',
            label: '未記録',
            text: isPlant ? '写真・メモ・水やりを残す' : '写真・メモ・給餌を残す',
            recordType: 'note',
            actionLabel: '記録する'
        };
    }

    function getFirstRecordCandidates(spiders) {
        return (Array.isArray(spiders) ? spiders : [])
            .filter(spider => !hasCareHistory(spider))
            .slice()
            .sort((a, b) => (parseInt(b.id, 10) || 0) - (parseInt(a.id, 10) || 0));
    }

    function renderTodayQueueItem(item, index) {
        const spider = item && item.spider ? item.spider : {};
        const reason = item && item.reason ? item.reason : {};
        const name = spider.title || spider.nickname || spider.species_name || '個体';
        const species = spider.species_name || spider.scientific_name || '種類未設定';
        const recordType = reason.recordType || 'note';
        const actionLabel = reason.actionLabel || '記録';
        const tone = String(reason.tone || 'calm').replace(/[^a-z0-9_-]/gi, '') || 'calm';
        const reasonLabel = reason.label || '確認';
        const reasonText = reason.text || '状態を確認';

        return `
            <div class="care-queue-item care-queue-item--${tone}">
                <button type="button" class="care-queue-open js-today-open-spider" data-id="${escapeHtml(spider.id || '')}" aria-label="${escapeHtml(`${name}、${reasonLabel}。${reasonText}。詳細を開く`)}">
                    <span class="care-queue-rank" aria-hidden="true">${escapeHtml(String(index + 1).padStart(2, '0'))}</span>
                    <span class="care-queue-avatar">${renderSpiderThumbnail(spider)}</span>
                    <span class="care-queue-identity">
                        <strong>${escapeHtml(name)}</strong>
                        <small>${escapeHtml(species)}</small>
                    </span>
                    <span class="care-queue-reason">
                        <b>${escapeHtml(reasonLabel)}</b>
                        <small>${escapeHtml(reasonText)}</small>
                    </span>
                    <span class="care-queue-disclosure" aria-hidden="true"></span>
                </button>
                <button type="button" class="care-queue-record js-today-log" data-id="${escapeHtml(spider.id || '')}" data-type="${escapeHtml(recordType)}" aria-label="${escapeHtml(`${name}を${actionLabel}`)}"><span aria-hidden="true">＋</span><b>${escapeHtml(actionLabel)}</b></button>
            </div>
        `;
    }

    function renderTodayOverview(options = {}) {
        const items = Array.isArray(options.items) ? options.items : [];
        const hiddenCount = Math.max(0, parseInt(options.hiddenCount, 10) || 0);
        const theme = String(options.theme || 'priority').replace(/[^a-z0-9_-]/gi, '') || 'priority';
        const descriptionHtml = options.description
            ? `<p>${escapeHtml(options.description)}</p>`
            : '';
        const count = Number.isFinite(Number(options.count)) ? Math.max(0, Number(options.count)) : null;
        const countHtml = count !== null
            ? `<strong class="care-overview-count">${escapeHtml(String(count))}<small>匹</small></strong>`
            : '';
        const queueHtml = items.length ? `
            <div class="care-queue" aria-label="今日の優先個体">
                ${items.map(renderTodayQueueItem).join('')}
            </div>
        ` : '';
        const footerHtml = hiddenCount > 0 ? `
            <div class="care-queue-footer">
                <span>ほか ${escapeHtml(String(hiddenCount))}匹</span>
                <button type="button" class="care-overview-list-link js-today-focus-list">優先順で一覧を見る</button>
            </div>
        ` : '';

        return `
            <div class="setae-today-check-card setae-care-overview care-overview--${theme}">
                <div class="care-overview-head">
                    <div>
                        <span class="care-overview-kicker">今日の確認</span>
                        <h3><span>${escapeHtml(options.title || '今日の飼育')}</span>${countHtml}</h3>
                        ${descriptionHtml}
                    </div>
                </div>
                ${options.summaryHtml || ''}
                ${options.streakHtml || ''}
                ${queueHtml}
                ${footerHtml}
            </div>
        `;
    }

    function renderTodayCheck(spiders) {
        const $panel = $('#setae-today-check');
        if (!$panel.length) return;

        const allSpiders = Array.isArray(spiders) ? spiders : [];
        if (allSpiders.length === 0) {
            $panel.hide().empty();
            return;
        }

        const careSummary = getCareSummary();
        const streakHtml = renderDailyStreak(careSummary);
        const visibleItemCount = 2;

        const items = allSpiders
            .map(spider => {
                const reason = getTodayReason(spider);
                return reason ? { spider: spider, reason: reason } : null;
            })
            .filter(Boolean)
            .sort((a, b) => b.reason.priority - a.reason.priority);

        if (items.length === 0) {
            const firstRecordSpiders = getFirstRecordCandidates(allSpiders);
            if (firstRecordSpiders.length > 0) {
                trackDailyStreakPanel(careSummary, 'first_record');
                const firstRecordItems = firstRecordSpiders.map(spider => ({
                    spider: spider,
                    reason: getFirstRecordReason(spider)
                }));

                if (!firstRecordPromptTracked && typeof SetaeCore.track === 'function') {
                    firstRecordPromptTracked = true;
                    SetaeCore.track('first_record_prompt_seen', {
                        source: 'today_check',
                        count: firstRecordSpiders.length
                    });
                }

                $panel.html(renderTodayOverview({
                    theme: 'first-record',
                    title: '最初の記録を残す',
                    count: firstRecordItems.length,
                    streakHtml: streakHtml,
                    summaryHtml: renderTodaySummary(firstRecordItems),
                    items: firstRecordItems.slice(0, visibleItemCount),
                    hiddenCount: firstRecordItems.length - visibleItemCount
                })).show();
                return;
            }

            trackDailyStreakPanel(careSummary, 'calm');
            $panel.html(renderTodayOverview({
                theme: 'calm',
                title: '今日は落ち着いています',
                streakHtml: streakHtml
            })).show();
            return;
        }

        trackDailyStreakPanel(careSummary, 'priority');

        const visibleItems = items.slice(0, visibleItemCount);
        const hiddenCount = items.length - visibleItems.length;
        $panel.html(renderTodayOverview({
            theme: 'priority',
            title: '今日見る個体',
            count: items.length,
            streakHtml: streakHtml,
            summaryHtml: renderTodaySummary(items),
            items: visibleItems,
            hiddenCount: hiddenCount
        })).show();
    }

    function updateDeckCounts() {
        const categories = ['tarantula', 'scorpion', 'reptile', 'plant', 'other'];
        const counts = { all: 0, hungry: 0, pre_molt: 0, attention: 0, favorite: 0 };
        categories.forEach(key => counts['cat_' + key] = 0);

        SetaeCore.state.cachedSpiders.forEach(s => {
            counts.all++;

            // ▼ 修正: API側で計算されたフラグを使用
            if (s.is_hungry) counts.hungry++;
            if (s.status === 'pre_molt') counts.pre_molt++;
            if (isAttentionSpider(s)) counts.attention++;
            if (s.is_favorite) counts.favorite++;

            const cls = s.classification || 'tarantula';
            if (categories.includes(cls)) {
                counts['cat_' + cls]++;
            } else {
                counts['cat_other']++;
            }
        });

        $(`.deck-pill[data-deck="all"] .count-badge`).text(counts.all);
        $(`.deck-pill[data-deck="hungry"] .count-badge`).text(counts.hungry);
        $(`.deck-pill[data-deck="pre_molt"] .count-badge`).text(counts.pre_molt);
        $(`.deck-pill[data-deck="attention"] .count-badge`).text(counts.attention);
        $(`.deck-pill[data-deck="favorite"] .count-badge`).text(counts.favorite);

        let activeCategoryCount = 0;
        categories.forEach(key => {
            if (counts['cat_' + key] > 0) activeCategoryCount++;
        });

        categories.forEach(key => {
            const $btn = $(`.deck-pill[data-deck="cat_${key}"]`);
            const count = counts['cat_' + key];

            $btn.find('.count-badge').text(count);

            if (count === 0 || activeCategoryCount <= 1) {
                $btn.hide();
            } else {
                $btn.show();
            }
        });
    }

    function handleDeckFilterClick() {
        const deck = $(this).data('deck');
        SetaeCore.state.currentDeck = deck;
        localStorage.setItem('setae_my_deck', deck);
        $('.deck-pill[data-deck]').removeClass('active');
        $(this).addClass('active');
        renderMySpiders();
    }

    function handleDesktopDashboardFilterClick(e) {
        e.preventDefault();
        e.stopPropagation();

        const deck = $(this).data('deck');
        if (!deck) return;

        SetaeCore.state.currentDeck = deck;
        localStorage.setItem('setae_my_deck', deck);
        $('.deck-pill[data-deck]').removeClass('active');
        $(`.deck-pill[data-deck="${deck}"]`).addClass('active');
        renderMySpiders();

        if (typeof SetaeCore.track === 'function') {
            SetaeCore.track('my_desktop_dashboard_filter', { deck: deck });
        }
    }

    function handleDesktopDashboardSpiderOpen(e) {
        e.preventDefault();
        e.stopPropagation();

        const id = $(this).data('id');
        if (!id || !window.SetaeUIDetail || !SetaeUIDetail.loadSpiderDetail) return;

        SetaeUIDetail.loadSpiderDetail(id);

        if (typeof SetaeCore.track === 'function') {
            SetaeCore.track('my_desktop_dashboard_spider_open', { id: id });
        }
    }

    function handleSearchInput() {
        const query = $(this).val();
        SetaeCore.state.currentSearch = query;
        localStorage.setItem('setae_my_search', query);
        renderMySpiders();
    }

    function handleClearMyFilters(e) {
        e.preventDefault();
        e.stopPropagation();

        SetaeCore.state.currentSearch = '';
        SetaeCore.state.currentDeck = 'all';
        localStorage.setItem('setae_my_search', '');
        localStorage.setItem('setae_my_deck', 'all');

        $('#setae-spider-search').val('');
        $('.deck-pill[data-deck]').removeClass('active');
        $('.deck-pill[data-deck="all"]').addClass('active');

        renderMySpiders();

        if (typeof SetaeCore.track === 'function') {
            SetaeCore.track('my_spiders_filter_reset');
        }
    }

    // ==========================================
    // Smart List Item
    // ==========================================
    // ==========================================
    // Smart List Item (Classification Aware)
    // ==========================================
    function getListCareDate(value) {
        const match = String(value || '').match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
        if (!match) {
            return {
                iso: '',
                label: '--/--',
                yearLabel: '',
                ariaDate: '記録なし',
                elapsedLabel: '未記録',
                elapsedDays: null,
                ageBand: 'empty'
            };
        }

        const year = parseInt(match[1], 10);
        const month = parseInt(match[2], 10);
        const day = parseInt(match[3], 10);
        const today = new Date();
        const currentYear = today.getFullYear();
        const yearLabel = year === currentYear
            ? ''
            : (year === currentYear - 1 ? `'${String(year).slice(-2)}` : String(year));
        const elapsedDays = Math.round((
            Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
            - Date.UTC(year, month - 1, day)
        ) / 86400000);
        let elapsedLabel = '';
        let ageBand = '';

        if (elapsedDays < 0) {
            elapsedLabel = `${Math.abs(elapsedDays)}日後`;
            ageBand = 'future';
        } else if (elapsedDays === 0) {
            elapsedLabel = '今日';
            ageBand = 'today';
        } else {
            elapsedLabel = `${elapsedDays}日前`;
            ageBand = elapsedDays <= 7 ? 'recent' : (elapsedDays <= 30 ? 'settled' : 'long');
        }

        return {
            iso: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
            label: `${month}/${String(day).padStart(2, '0')}`,
            yearLabel: yearLabel,
            ariaDate: `${year}年${month}月${day}日`,
            elapsedLabel: elapsedLabel,
            elapsedDays: elapsedDays,
            ageBand: ageBand
        };
    }

    function getCareGlyph(type, label) {
        if (type === 'feed') {
            return String(label || '').indexOf('水') === 0 ? '水' : '給';
        }
        return String(label || '').indexOf('植') === 0 ? '植' : '脱';
    }

    function renderTarantulaCareDate(type, label, value, refused, options = {}) {
        const date = getListCareDate(value);
        const windowDays = Math.max(7, parseInt(options.windowDays, 10) || 90);
        const count = Math.max(0, parseInt(options.count, 10) || 0);
        const refusedClass = refused ? ' is-refused' : '';
        const emptyClass = date.iso ? '' : ' is-empty';
        const dueClass = options.isDue ? ' is-due' : '';
        const yearHtml = date.yearLabel
            ? `<small class="tarantula-care-year">${escapeHtml(date.yearLabel)}</small>`
            : '';
        const dateHtml = date.iso
            ? `<time datetime="${escapeHtml(date.iso)}"><strong>${escapeHtml(date.label)}</strong></time>`
            : `<strong>${escapeHtml(date.label)}</strong>`;
        const ariaLabel = `${label} ${date.ariaDate}、${date.elapsedLabel}、過去${windowDays}日で${count}件${refused ? '、拒食中' : ''}`;

        return `
            <div class="setae-care-vital tarantula-care-date is-${escapeHtml(type)} is-age-${escapeHtml(date.ageBand)}${refusedClass}${emptyClass}${dueClass}"
                role="listitem"
                aria-label="${escapeHtml(ariaLabel)}">
                <span class="setae-care-vital-glyph" aria-hidden="true">
                    ${escapeHtml(getCareGlyph(type, label))}
                    ${refused ? '<i class="tarantula-care-refused">×</i>' : ''}
                </span>
                <span class="setae-care-vital-main">
                    <span class="setae-care-vital-head">
                        <span class="tarantula-care-kind">${escapeHtml(label)}</span>
                        <span class="setae-care-vital-count">
                            <b>${escapeHtml(String(count))}</b>
                            <small>回</small>
                        </span>
                    </span>
                    <span class="setae-care-vital-reading-row">
                        <span class="tarantula-care-reading">
                            ${dateHtml}
                            ${yearHtml}
                        </span>
                        <span class="setae-care-vital-elapsed">${escapeHtml(date.elapsedLabel)}</span>
                    </span>
                </span>
            </div>
        `;
    }

    function renderTarantulaCareDates(spider, status, labelFeed, labelMolt, activity) {
        const refused = status === 'fasting' || status === 'refused';
        const isDue = !!spider.is_hungry && hasCareHistory(spider);
        return `
            <div class="setae-care-vitals setae-tarantula-dates" role="list" aria-label="直近のケア記録">
                ${renderTarantulaCareDate('feed', labelFeed, spider.last_feed, refused, {
                    isDue: isDue,
                    count: activity.counts.feed,
                    windowDays: activity.windowDays
                })}
                ${renderTarantulaCareDate('molt', labelMolt, spider.last_molt, false, {
                    count: activity.counts.molt,
                    windowDays: activity.windowDays
                })}
            </div>
        `;
    }

    function getActivityTypeMeta(type, spider) {
        const isPlant = spider && spider.classification === 'plant';
        const types = {
            feed: { label: isPlant ? '水やり' : '給餌', short: isPlant ? '水' : '給' },
            molt: { label: isPlant ? '植え替え' : '脱皮', short: isPlant ? '植' : '脱' },
            observation: { label: '観察', short: '観' },
            pairing: { label: 'ペアリング', short: '交' },
            growth: { label: '計測', short: '測' }
        };
        return types[type] || null;
    }

    function getCardActivitySummary(spider) {
        const source = spider && spider.activity_90d && typeof spider.activity_90d === 'object'
            ? spider.activity_90d
            : null;
        const windowDays = source
            ? Math.max(7, Math.min(180, parseInt(source.window_days, 10) || 90))
            : 90;
        const counts = {
            feed: 0,
            molt: 0,
            observation: 0,
            pairing: 0,
            growth: 0
        };
        const weekCount = Math.ceil(windowDays / 7);
        const weekly = Array.from({ length: weekCount }, function () { return 0; });
        const events = [];
        const seen = {};
        const hasSourceWeekly = !!(source && Array.isArray(source.weekly));

        if (source && source.counts && typeof source.counts === 'object') {
            Object.keys(counts).forEach(function (type) {
                counts[type] = Math.max(0, parseInt(source.counts[type], 10) || 0);
            });
        }
        if (hasSourceWeekly) {
            source.weekly.slice(0, weekCount).forEach(function (count, index) {
                weekly[index] = Math.max(0, parseInt(count, 10) || 0);
            });
        }

        const rawEvents = source && Array.isArray(source.events)
            ? source.events
            : [
                { type: 'feed', date: spider && spider.last_feed },
                { type: 'molt', date: spider && spider.last_molt },
                { type: 'observation', date: spider && spider.last_observation }
            ];

        rawEvents.forEach(function (event) {
            const type = String(event && event.type ? event.type : '');
            const meta = getActivityTypeMeta(type, spider);
            const date = getListCareDate(event && event.date);
            if (!meta || !date.iso || date.elapsedDays === null || date.elapsedDays < 0 || date.elapsedDays >= windowDays) {
                return;
            }

            const key = `${type}|${date.iso}`;
            if (seen[key]) return;
            seen[key] = true;
            events.push({
                type: type,
                date: date.iso,
                dateLabel: date.label,
                age: date.elapsedDays,
                count: Math.max(1, parseInt(event && event.count, 10) || 1),
                refused: !!(event && event.refused),
                label: meta.label,
                short: meta.short
            });
        });

        events.forEach(function (event) {
            if (!source) {
                counts[event.type] += event.count;
            }
            if (!hasSourceWeekly) {
                const bucket = Math.max(
                    0,
                    Math.min(weekCount - 1, Math.floor((windowDays - 1 - event.age) / 7))
                );
                weekly[bucket] += event.count;
            }
        });

        events.sort(function (a, b) {
            if (a.age !== b.age) return b.age - a.age;
            return a.type.localeCompare(b.type);
        });

        const visibleTotal = events.reduce(function (sum, event) { return sum + event.count; }, 0);
        const total = source
            ? Math.max(visibleTotal, parseInt(source.total, 10) || 0)
            : events.reduce(function (sum, event) { return sum + event.count; }, 0);

        return {
            windowDays: windowDays,
            total: total,
            counts: counts,
            weekly: weekly,
            events: events
        };
    }

    function getCardActivityDeltas(previousSpider, updatedSpider) {
        const previous = getCardActivitySummary(previousSpider || {});
        const updated = getCardActivitySummary(updatedSpider || {});

        return ['feed', 'molt', 'observation', 'pairing', 'growth'].filter(function (type) {
            return updated.counts[type] > previous.counts[type];
        });
    }

    function getActivityDisplayMetrics(activity) {
        const activeWeeks = activity.weekly.filter(function (count) {
            return count > 0;
        }).length;
        const weeklyAverageValue = activity.weekly.length
            ? activity.total / activity.weekly.length
            : 0;

        return {
            activeWeeks: activeWeeks,
            weekCount: activity.weekly.length,
            weeklyAverage: weeklyAverageValue.toFixed(1).replace(/\.0$/, '')
        };
    }

    function renderActivityTimeline(spider, providedActivity) {
        const activity = providedActivity || getCardActivitySummary(spider);
        const metrics = getActivityDisplayMetrics(activity);
        const typeOrder = ['feed', 'molt', 'observation', 'pairing', 'growth'];
        const latestEventByType = {};
        activity.events.forEach(function (event, index) {
            latestEventByType[event.type] = index;
        });
        const activeTypes = typeOrder.filter(function (type) {
            return activity.counts[type] > 0;
        });
        const legendHtml = activeTypes.map(function (type) {
            const meta = getActivityTypeMeta(type, spider);
            return `
                <span class="setae-activity-legend-item is-${escapeHtml(type)}"
                    title="${escapeHtml(meta.label)} ${escapeHtml(String(activity.counts[type]))}件"
                    aria-label="${escapeHtml(meta.label)} ${escapeHtml(String(activity.counts[type]))}件">
                    <i aria-hidden="true"></i>
                    <span>${escapeHtml(meta.short)}</span>
                    <b>${escapeHtml(String(activity.counts[type]))}</b>
                </span>
            `;
        }).join('');
        const highlightedEvents = activity.events.filter(function (event, index) {
            return latestEventByType[event.type] === index;
        });
        const marksHtml = highlightedEvents.map(function (event, index) {
            const denominator = Math.max(1, activity.windowDays - 1);
            const position = Math.max(1.5, Math.min(98.5, 100 - ((event.age / denominator) * 100)));
            const refusedClass = event.refused ? ' is-refused' : '';
            const edgeClass = position < 20 ? ' is-edge-start' : (position > 80 ? ' is-edge-end' : '');
            const countLabel = event.count > 1 ? `・同日${event.count}件` : '';
            const refusedLabel = event.refused ? '・拒食' : '';
            const tooltip = `${event.dateLabel} ${event.label}${countLabel}${refusedLabel}`;
            return `
                <i class="setae-activity-mark is-${escapeHtml(event.type)}${refusedClass} is-latest${edgeClass}"
                    style="--event-pos:${position.toFixed(2)}%;--event-order:${Math.min(index, 4)}"
                    data-count="${escapeHtml(String(event.count))}">
                    <span class="setae-activity-mark-label">${escapeHtml(tooltip)}</span>
                </i>
            `;
        }).join('');
        const maximumWeekly = Math.max(1, ...activity.weekly);
        const densityHtml = activity.weekly.map(function (count, index) {
            const height = count > 0 ? (count / maximumWeekly) * 100 : 0;
            const weeksAgo = activity.weekly.length - index - 1;
            const weekLabel = weeksAgo === 0 ? '今週' : `${weeksAgo}週前`;
            return `
                <i class="${count > 0 ? 'is-active' : ''}"
                    style="--week-height:${height.toFixed(1)}%;--week-order:${index}"
                    title="${escapeHtml(weekLabel)} ${escapeHtml(String(count))}件"></i>
            `;
        }).join('');
        const ariaParts = typeOrder.filter(function (type) {
            return activity.counts[type] > 0;
        }).map(function (type) {
            const meta = getActivityTypeMeta(type, spider);
            return `${meta.label}${activity.counts[type]}件`;
        });
        const ariaLabel = `過去${activity.windowDays}日間の週別棒グラフ、合計${activity.total}件、活動週${metrics.activeWeeks}/${metrics.weekCount}、週平均${metrics.weeklyAverage}件${ariaParts.length ? '、' + ariaParts.join('、') : ''}`;

        return `
            <div class="setae-activity-ribbon${activity.events.length ? '' : ' is-empty'}" role="img" aria-label="${escapeHtml(ariaLabel)}">
                <div class="setae-activity-compact-head">
                    <span class="setae-activity-compact-title" aria-hidden="true">
                        <strong>${escapeHtml(String(activity.windowDays))}</strong>
                        <small>日・${escapeHtml(String(activity.total))}記録</small>
                    </span>
                    <span class="setae-activity-legend">
                        ${legendHtml || '<span class="setae-activity-empty-label">記録なし</span>'}
                    </span>
                    <span class="setae-activity-active-weeks" aria-hidden="true">
                        <strong>${escapeHtml(String(metrics.activeWeeks))}</strong>
                        <small>/${escapeHtml(String(metrics.weekCount))}週</small>
                    </span>
                </div>
                <div class="setae-activity-chart" aria-hidden="true">
                    <span class="setae-activity-density" style="--week-count:${activity.weekly.length}">${densityHtml}</span>
                    ${marksHtml}
                </div>
                <div class="setae-activity-scale" aria-hidden="true">
                    <span>${escapeHtml(String(activity.windowDays))}日前</span>
                    <span>${escapeHtml(String(Math.round(activity.windowDays / 2)))}日前</span>
                    <span>今日</span>
                </div>
            </div>
        `;
    }

    function renderCareInfographic(spider, status, labelFeed, labelMolt) {
        const activity = getCardActivitySummary(spider);
        const metrics = getActivityDisplayMetrics(activity);
        const ariaLabel = `ケアリズム、過去${activity.windowDays}日で${activity.total}記録、${metrics.activeWeeks}/${metrics.weekCount}週に記録`;
        return `
            <div class="setae-card-care-graphic" role="group" aria-label="${escapeHtml(ariaLabel)}">
                ${renderTarantulaCareDates(spider, status, labelFeed, labelMolt, activity)}
                ${renderActivityTimeline(spider, activity)}
            </div>
        `;
    }

    function getAverageCareInterval(activity, type) {
        const ages = (activity && Array.isArray(activity.events) ? activity.events : [])
            .filter(function (event) { return event.type === type && !event.refused; })
            .map(function (event) { return parseInt(event.age, 10); })
            .filter(function (age) { return Number.isFinite(age); })
            .sort(function (a, b) { return a - b; });
        if (ages.length < 2) return null;

        const intervals = [];
        for (let index = 1; index < ages.length; index++) {
            const interval = Math.abs(ages[index] - ages[index - 1]);
            if (interval > 0) intervals.push(interval);
        }
        if (!intervals.length) return null;
        return Math.max(1, Math.round(intervals.reduce(function (sum, value) {
            return sum + value;
        }, 0) / intervals.length));
    }

    function getCardCondition(spider, activity) {
        let score = 94;
        const observation = getListCareDate(spider.last_observation);
        if (!hasCareHistory(spider)) score -= 22;
        if (spider.is_hungry) score -= 12;
        if (spider.status === 'fasting') score -= 18;
        if (spider.status === 'post_molt') score -= 8;
        if (spider.status === 'pre_molt') score -= 4;
        if (observation.elapsedDays !== null && observation.elapsedDays > 30) score -= 8;
        if (activity && activity.total >= 8) score += 3;
        score = Math.max(42, Math.min(99, score));

        if (score >= 88) return { score: score, label: 'ケア良好', tone: 'good' };
        if (score >= 72) return { score: score, label: '経過観察', tone: 'watch' };
        return { score: score, label: '要確認', tone: 'alert' };
    }

    function getCardNextCare(spider, activity, labelFeed) {
        const status = spider.status || 'normal';
        if (!hasCareHistory(spider)) {
            return { label: '最初の記録', detail: '今日からカルテを開始', days: 0, recordType: 'note' };
        }
        if (status === 'pre_molt') {
            return { label: '静かに観察', detail: '脱皮前の可能性', days: 0, recordType: 'note' };
        }
        if (status === 'post_molt') {
            return { label: '回復を確認', detail: '脱皮後の経過', days: 0, recordType: 'note' };
        }
        if (status === 'fasting') {
            return { label: '様子を確認', detail: '拒食経過を記録', days: 0, recordType: 'feed' };
        }
        if (spider.is_hungry) {
            return { label: `${labelFeed}目安`, detail: '前回記録から算出', days: 0, recordType: 'feed' };
        }

        const interval = getAverageCareInterval(activity, 'feed') || (spider.classification === 'plant' ? 7 : 10);
        const lastFeed = getListCareDate(spider.last_feed);
        const remaining = lastFeed.elapsedDays === null ? 0 : Math.max(0, interval - lastFeed.elapsedDays);
        return {
            label: `${labelFeed}予定`,
            detail: `平均 ${interval}日周期`,
            days: remaining,
            recordType: 'feed'
        };
    }

    function getCardGenderLabel(gender) {
        if (gender === 'female') return 'メス ♀';
        if (gender === 'male') return 'オス ♂';
        return '性別不明';
    }

    function renderSpecimenMetrics(spider, activity, labelFeed, labelMolt) {
        const feedInterval = getAverageCareInterval(activity, 'feed');
        const moltDate = getListCareDate(spider.last_molt);
        const temperature = spider.temperature || spider.recommended_temperature || '';
        const humidity = spider.humidity || spider.recommended_humidity || '';
        const environmentSource = (spider.temperature || spider.humidity) ? '現在値' : '図鑑目安';

        return `
            <div class="specimen-card-metrics specimen-v5-metrics" aria-label="ケア指標">
                <span class="is-temperature" title="${escapeHtml(environmentSource)}">
                    <i aria-hidden="true"></i>
                    <b>${escapeHtml(temperature || '-')}</b><small>温度</small>
                </span>
                <span class="is-humidity" title="${escapeHtml(environmentSource)}">
                    <i aria-hidden="true"></i>
                    <b>${escapeHtml(humidity || '-')}</b><small>湿度</small>
                </span>
                <span class="is-feed">
                    <i aria-hidden="true"></i>
                    <b>${feedInterval ? `${escapeHtml(String(feedInterval))}日` : '-'}</b><small>${escapeHtml(labelFeed)}間隔</small>
                </span>
                <span class="is-molt">
                    <i aria-hidden="true"></i>
                    <b>${moltDate.elapsedDays !== null ? `${escapeHtml(String(moltDate.elapsedDays))}日` : '-'}</b><small>${escapeHtml(labelMolt)}後</small>
                </span>
            </div>
        `;
    }

    function renderSpecimenStageTrack(spider, activity) {
        const rawInstar = Math.max(0, parseInt(spider.instar, 10) || 0);
        const recordedMolts = Math.max(0, parseInt(activity && activity.counts && activity.counts.molt, 10) || 0);
        const current = rawInstar || Math.min(7, Math.max(1, recordedMolts));
        const stageStart = current > 5 ? current - 4 : 1;
        const stages = Array.from({ length: 6 }, function (_, index) {
            return stageStart + index;
        });
        const nodes = stages.map(function (stage) {
            const state = stage === current ? ' is-current' : (stage < current ? ' is-complete' : '');
            return `<span class="${state}" aria-label="L${stage}${stage === current ? ' 現在' : ''}"><i>L${stage}</i></span>`;
        }).join('');

        return `
            <div class="specimen-v5-stage" aria-label="成長ステージ">
                <div class="specimen-v5-stage-track">${nodes}<span class="is-adult"><i>成体</i></span></div>
            </div>
        `;
    }

    function renderSpecimenSparkline(activity, tone) {
        const source = activity && Array.isArray(activity.weekly) ? activity.weekly.slice(-13) : [];
        const values = Array.from({ length: 13 }, function (_, index) {
            return Math.max(0, parseInt(source[index - (13 - source.length)], 10) || 0);
        });
        const maximum = Math.max(1, ...values);
        return `
            <div class="specimen-v5-spark is-${escapeHtml(tone || 'good')}" aria-label="直近90日の記録リズム">
                ${values.map(function (value) {
                    const height = value ? Math.max(22, Math.round((value / maximum) * 100)) : 8;
                    return `<i class="${value ? 'is-active' : ''}" style="--spark-height:${height}%"></i>`;
                }).join('')}
            </div>
        `;
    }

    function renderSmartListItem(spider, options = {}) {
        // 分類を取得 (未設定なら tarantula)
        const cls = spider.classification || 'tarantula';
        const status = spider.status || 'normal';
        const isTodayContext = options.context === 'today';
        const isContinueContext = options.context === 'continue';
        const reason = options.reason || null;
        const note = options.note || null;
        const thumbHtml = renderSpiderThumbnail(spider);
        const classificationMark = getClassificationMark(cls);

        const prey = spider.last_prey || '';

        // 空腹/水切れ判定
        const isHungry = spider.is_hungry;

        // --- 分類ごとのUI設定 ---
        let steps = [];
        let labelFeed = setaeI18n.feed || '給餌';
        let labelMolt = setaeI18n.molt || '脱皮';

        switch (cls) {
            case 'plant':
                steps = [];
                labelFeed = setaeI18n.water || '水やり';
                labelMolt = setaeI18n.repot || '植え替え';
                break;

            case 'reptile':
                steps = [
                    { id: 'normal', label: setaeI18n.status_normal || '通常' },
                    { id: 'fasting', label: setaeI18n.status_fasting || '拒食中' },
                    { id: 'pre_molt', label: setaeI18n.status_pre_molt || '脱皮前' }
                ];
                labelFeed = setaeI18n.feed || '給餌';
                labelMolt = setaeI18n.shed || '脱皮';
                break;

            case 'scorpion':
                steps = [
                    { id: 'normal', label: setaeI18n.status_normal || '通常' },
                    { id: 'fasting', label: setaeI18n.status_fasting || '拒食中' },
                    { id: 'pre_molt', label: setaeI18n.status_pre_molt || '脱皮前' },
                    { id: 'post_molt', label: setaeI18n.status_post_molt || '脱皮後' }
                ];
                break;

            case 'tarantula':
            default:
                steps = [
                    { id: 'normal', label: setaeI18n.status_normal || '通常' },
                    { id: 'fasting', label: setaeI18n.status_fasting || '拒食中' },
                    { id: 'pre_molt', label: setaeI18n.status_pre_molt || '脱皮前' },
                    { id: 'post_molt', label: setaeI18n.status_post_molt || '脱皮後' }
                ];
                break;
        }

        // Keep the lifecycle readable while promoting the action that matters now.
        const activeStep = steps.find(step => step.id === status);
        const currentStatusLabel = activeStep
            ? activeStep.label
            : (status === 'normal'
                ? (setaeI18n.status_normal || '通常')
                : (status === 'refused' ? (setaeI18n.status_fasting || '拒食中') : status));
        const hasHistory = hasCareHistory(spider);
        const isCareDue = isHungry && hasHistory;
        let cardSignalLabel = currentStatusLabel;
        let cardSignalTone = status;

        if (status === 'normal' && !hasHistory) {
            cardSignalLabel = '最初の記録';
            cardSignalTone = 'start';
        } else if (status === 'normal' && isCareDue) {
            cardSignalLabel = `${labelFeed}目安`;
            cardSignalTone = 'hungry';
        } else if (status === 'normal') {
            cardSignalLabel = '通常管理';
        }

        const todayNoteHtml = reason ? `
            <div class="today-row-note">
                <span class="today-row-chip ${escapeHtml(reason.tone || '')}">${escapeHtml(reason.label)}</span>
                <span>${escapeHtml(reason.text)}</span>
            </div>
        ` : (note ? `
            <div class="today-row-note">
                <span class="today-row-chip ${escapeHtml(note.tone || 'calm')}">${escapeHtml(note.label || 'メモ')}</span>
                <span>${escapeHtml(note.text || '')}</span>
            </div>
        ` : (options.subtle ? `
            <div class="today-row-note is-subtle">
                <span class="today-row-chip calm">記録確認</span>
                <span>前回の記録を見返せます</span>
            </div>
        ` : ''));

        const guestMode = !!(window.SetaeSettings && SetaeSettings.guest_mode);
        const todayActionsHtml = isTodayContext ? `
            <div class="today-row-actions">
                <button type="button" class="today-row-action js-today-log" data-id="${escapeHtml(spider.id)}" data-type="${escapeHtml(reason && reason.recordType ? reason.recordType : 'note')}">${escapeHtml(reason && reason.actionLabel ? reason.actionLabel : '記録')}</button>
                ${guestMode ? '' : `<button type="button" class="today-row-action js-open-topic-modal" data-id="${escapeHtml(spider.id)}" data-type="${escapeHtml(reason && reason.recordType ? reason.recordType : 'note')}" data-source="today_check">相談</button>`}
            </div>
        ` : '';

        // --- HTML出力 ---
        const contextAttr = options.context ? ` data-context="${escapeHtml(options.context)}"` : '';
        const rowName = spider.title || spider.species_name || '個体';
        const rowSpecies = spider.species_name || setaeI18n.unidentified || '未同定';
        const activity = getCardActivitySummary(spider);
        const condition = getCardCondition(spider, activity);
        const nextCare = getCardNextCare(spider, activity, labelFeed);
        const rowLabel = `${rowName}、${rowSpecies}、${condition.label}。詳細を開く`;
        const rowAccessibility = ` role="group" aria-label="${escapeHtml(rowLabel)}"`;
        const imageSourceHtml = spider.image_source === 'species'
            ? '<span class="setae-avatar-source">図鑑</span>'
            : '';
        const specimenCode = String(spider.qr_code || `ID${spider.id || ''}`)
            .replace(/[^a-zA-Z0-9_-]/g, '')
            .toUpperCase()
            .slice(0, 10) || 'UNSET';
        const ownershipClass = spider.has_own_image ? ' has-owned-photo' : ' is-reference-photo';
        const syncClass = spider.sync_state === 'pending'
            ? ' is-offline-pending'
            : (spider.sync_state === 'local-only' ? ' is-local-only' : '');
        const syncLabel = spider.sync_state === 'pending'
            ? '同期待ち'
            : (spider.sync_state === 'local-only' ? '端末保存' : '');
        const nicknameHtml = isTodayContext
            ? `<button type="button" class="setae-nickname today-row-open js-today-open-spider" data-id="${escapeHtml(spider.id)}" aria-label="${escapeHtml(rowLabel)}">${escapeHtml(rowName)}</button>`
            : `<button type="button" class="setae-nickname js-list-open" data-id="${escapeHtml(spider.id)}" aria-label="${escapeHtml(rowLabel)}">${escapeHtml(rowName)}</button>`;
        const stageLabel = spider.instar ? `L${parseInt(spider.instar, 10)}` : (activity.counts.molt ? `脱皮 ${activity.counts.molt}回` : '齢数未設定');
        const nextDaysLabel = nextCare.days > 0 ? `あと ${nextCare.days}日` : '今日';
        const favoriteLabel = spider.is_favorite ? 'お気に入りから外す' : 'お気に入りに追加';

        return `
            <div class="setae-spider-list-row specimen-card specimen-card-v5${isTodayContext ? ' is-today-row' : ''}${isContinueContext ? ' is-continue-row' : ''}${isCareDue ? ' is-care-due' : ''}${hasHistory ? '' : ' is-no-history'}${ownershipClass}${syncClass}" data-id="${escapeHtml(spider.id)}" data-status="${escapeHtml(status)}" data-classification="${escapeHtml(cls)}" data-prey="${escapeHtml(prey)}" data-sync-label="${escapeHtml(syncLabel)}"${rowAccessibility}${contextAttr}>
                <div class="setae-swipe-bg swipe-left"></div>
                <div class="setae-swipe-bg swipe-right"></div>
                <article class="setae-list-content specimen-v5-shell">
                    <div class="setae-avatar-container specimen-card-photo specimen-v5-photo">
                        ${thumbHtml}
                        ${classificationMark ? `<span class="setae-classification-mark" aria-hidden="true">${classificationMark}</span>` : ''}
                        ${imageSourceHtml}
                        <span class="specimen-photo-code">${escapeHtml(specimenCode)}</span>
                        <button type="button" class="specimen-favorite js-toggle-spider-favorite${spider.is_favorite ? ' is-active' : ''}" data-id="${escapeHtml(spider.id)}" aria-pressed="${spider.is_favorite ? 'true' : 'false'}" aria-label="${escapeHtml(favoriteLabel)}" title="${escapeHtml(favoriteLabel)}">
                            <span class="dashicons ${spider.is_favorite ? 'dashicons-star-filled' : 'dashicons-star-empty'}" aria-hidden="true"></span>
                        </button>
                    </div>

                    <div class="setae-info-column specimen-card-identity specimen-v5-identity">
                        <div class="setae-scientific-name"><i>${escapeHtml(rowSpecies)}</i></div>
                        <div class="setae-nickname-row">${nicknameHtml}</div>
                        <div class="specimen-card-badges">
                            <span class="specimen-condition is-${escapeHtml(condition.tone)}"><i aria-hidden="true"></i>${escapeHtml(condition.label)}</span>
                            <span>${escapeHtml(stageLabel)}</span>
                            <span>${escapeHtml(getCardGenderLabel(spider.gender))}</span>
                        </div>
                        ${todayNoteHtml}
                        ${todayActionsHtml}
                    </div>

                    ${renderSpecimenMetrics(spider, activity, labelFeed, labelMolt)}
                    ${renderSpecimenStageTrack(spider, activity)}
                    ${renderSpecimenSparkline(activity, cardSignalTone)}

                    <aside class="specimen-next-care specimen-v5-care">
                        <button type="button" class="specimen-v5-more js-specimen-menu" data-id="${escapeHtml(spider.id)}" aria-label="${escapeHtml(rowName)}の操作メニュー" aria-haspopup="menu" aria-expanded="false"><span aria-hidden="true">•••</span></button>
                        <span class="specimen-next-care-icon" aria-hidden="true"></span>
                        <span class="specimen-next-care-copy">
                            <small>${escapeHtml(nextCare.label)}</small>
                            <strong>${escapeHtml(nextDaysLabel)}</strong>
                            <em>${escapeHtml(nextCare.detail)}</em>
                        </span>
                        <button type="button" class="specimen-detail-button js-list-open" data-id="${escapeHtml(spider.id)}">詳細を見る</button>
                    </aside>

                    <div class="specimen-v5-menu" role="menu" hidden>
                        <button type="button" class="js-list-record" data-id="${escapeHtml(spider.id)}" data-type="${escapeHtml(nextCare.recordType)}" role="menuitem">記録を追加</button>
                        <button type="button" class="js-list-open" data-id="${escapeHtml(spider.id)}" role="menuitem">詳細を見る</button>
                        <button type="button" class="js-toggle-spider-favorite" data-id="${escapeHtml(spider.id)}" role="menuitem">${escapeHtml(favoriteLabel)}</button>
                    </div>
                </article>
            </div>
        `;
    }

    function renderCardSyncState(state, label) {
        if (state === 'saving') {
            return `
                <span class="setae-card-sync-state" role="status" aria-live="polite">
                    <span class="setae-card-sync-dot" aria-hidden="true"></span>
                    <span>${escapeHtml(label || '保存中')}</span>
                </span>
            `;
        }

        return `
            <span class="setae-card-sync-state" role="status" aria-live="polite">
                <svg viewBox="0 0 16 16" aria-hidden="true">
                    <path d="m3 8.2 3 3L13 4.8"></path>
                </svg>
                <span>${escapeHtml(label || '更新済み')}</span>
            </span>
        `;
    }

    function refreshMySpiderPanels() {
        const spiders = Array.isArray(SetaeCore.state.cachedSpiders)
            ? SetaeCore.state.cachedSpiders
            : [];
        updateDeckCounts();
        renderDesktopDashboard(spiders);
        renderTodayCheck(spiders);
        renderContinuePanel(spiders);
    }

    function updateSpiderCard(id, changes, options = {}) {
        if (!SetaeCore.state || !Array.isArray(SetaeCore.state.cachedSpiders)) return null;

        const normalizedChanges = typeof SetaeCore.normalizeSpiderDisplayFields === 'function'
            ? SetaeCore.normalizeSpiderDisplayFields(changes || {})
            : (changes || {});
        const index = SetaeCore.state.cachedSpiders.findIndex(function (item) {
            return String(item.id) === String(id);
        });
        if (index < 0) return null;

        const previousSpider = SetaeCore.state.cachedSpiders[index] || {};
        const feedChanged = Object.prototype.hasOwnProperty.call(normalizedChanges, 'last_feed')
            && String(previousSpider.last_feed || '') !== String(normalizedChanges.last_feed || '');
        const moltChanged = Object.prototype.hasOwnProperty.call(normalizedChanges, 'last_molt')
            && String(previousSpider.last_molt || '') !== String(normalizedChanges.last_molt || '');
        const updatedSpider = Object.assign({}, previousSpider, normalizedChanges, { id: id });
        const activityDeltas = getCardActivityDeltas(previousSpider, updatedSpider);
        SetaeCore.state.cachedSpiders[index] = updatedSpider;
        refreshMySpiderPanels();

        const $currentRow = $(`#setae-spider-list > .setae-spider-list-row[data-id="${id}"]`).first();
        if (!$currentRow.length) return updatedSpider;

        const remainsVisible = getVisibleSpiders().some(function (item) {
            return String(item.id) === String(id);
        });
        if (!remainsVisible) {
            renderMySpiders();
            return updatedSpider;
        }

        const $nextRow = $(renderSmartListItem(updatedSpider));
        const syncState = options.state === 'saving' ? 'saving' : 'updated';
        if (syncState === 'saving') {
            cardPendingFields[id] = {
                feed: feedChanged,
                molt: moltChanged
            };
        }
        const pendingFields = cardPendingFields[id] || {};
        const highlightFeed = feedChanged || (syncState === 'updated' && !!pendingFields.feed);
        const highlightMolt = moltChanged || (syncState === 'updated' && !!pendingFields.molt);
        $nextRow.addClass(syncState === 'saving' ? 'is-saving' : 'is-freshly-updated');
        if (highlightFeed) {
            $nextRow.addClass('is-updated-feed');
        }
        if (highlightMolt) {
            $nextRow.addClass('is-updated-molt');
        }
        if (activityDeltas.length) {
            $nextRow.addClass('is-activity-updated');
            activityDeltas.forEach(function (type) {
                $nextRow.addClass(`is-updated-${type}`);
            });
        }
        if (syncState === 'updated') {
            delete cardPendingFields[id];
        }
        $nextRow.find('.setae-list-content').append(renderCardSyncState(syncState, options.label));
        $currentRow.replaceWith($nextRow);

        if (cardSyncTimers[id]) {
            window.clearTimeout(cardSyncTimers[id]);
            delete cardSyncTimers[id];
        }

        if (syncState === 'updated') {
            cardSyncTimers[id] = window.setTimeout(function () {
                const $row = $(`#setae-spider-list > .setae-spider-list-row[data-id="${id}"]`).first();
                $row.removeClass('is-freshly-updated');
                $row.find('.setae-card-sync-state').fadeOut(160, function () {
                    $(this).remove();
                });
                delete cardSyncTimers[id];
            }, 4200);

            if (typeof SetaeCore.announce === 'function') {
                SetaeCore.announce(`${updatedSpider.title || '個体'}のカードを最新情報に更新しました`);
            }
        }

        return updatedSpider;
    }

    function handleListItemClick(e) {
        // ボタンクリックやスワイプ中の誤タップ防止
        if ($(e.target).is('button') || $(e.target).closest('button').length) return;
        const suppressClickUntil = parseInt(this.dataset.suppressClickUntil || '0', 10);
        if (suppressClickUntil > Date.now()) return;

        // モバイルのスワイプ判定
        const content = this.querySelector('.setae-list-content');
        if (content && content.style.transform && content.style.transform !== 'translateX(0px)' && content.style.transform !== '') return;

        const id = $(this).data('id');
        const context = $(this).data('context') || '';
        if (context === 'continue' && typeof SetaeCore.track === 'function') {
            SetaeCore.track('continue_spider_open', {
                source: 'row'
            });
        }
        // Detailモジュールへ委譲
        if (window.SetaeUIDetail && SetaeUIDetail.loadSpiderDetail) {
            SetaeUIDetail.loadSpiderDetail(id);
        } else {
            console.error('SetaeUIDetail not loaded');
        }
    }

    function handleListRecordClick(e) {
        e.preventDefault();
        e.stopPropagation();

        const id = $(this).data('id');
        const type = $(this).data('type') || 'note';
        if (!id || typeof SetaeUILogModal === 'undefined' || !SetaeUILogModal.openLogModal) return;

        SetaeUILogModal.openLogModal(id, type);
        if (typeof SetaeCore.track === 'function') {
            SetaeCore.track('my_spider_list_record_click', {
                type: type,
                source: 'my_spiders'
            });
        }
    }

    function handleSpiderFavoriteClick(e) {
        e.preventDefault();
        e.stopPropagation();

        const $button = $(this);
        const id = $button.data('id');
        const spider = (SetaeCore.state.cachedSpiders || []).find(function (item) {
            return String(item.id) === String(id);
        });
        if (!spider || $button.prop('disabled') || !SetaeAPI.setSpiderFavorite) return;

        const nextStatus = !spider.is_favorite;
        $button.prop('disabled', true).addClass('is-saving');
        SetaeAPI.setSpiderFavorite(id, nextStatus, function (response) {
            const savedStatus = response && Object.prototype.hasOwnProperty.call(response, 'is_favorite')
                ? !!response.is_favorite
                : nextStatus;
            updateSpiderCard(id, { is_favorite: savedStatus });
            if (typeof SetaeCore.announce === 'function') {
                SetaeCore.announce(savedStatus ? 'お気に入りに追加しました' : 'お気に入りから外しました');
            }
        }, function (xhr) {
            $button.prop('disabled', false).removeClass('is-saving');
            const message = SetaeCore.getErrorMessage
                ? SetaeCore.getErrorMessage(xhr, 'お気に入りを更新できませんでした。')
                : 'お気に入りを更新できませんでした。';
            SetaeCore.showToast(message, 'error');
        });
    }

    function handleListOpenClick(e) {
        e.preventDefault();
        e.stopPropagation();

        const id = $(this).data('id');
        if (!id || !window.SetaeUIDetail || !SetaeUIDetail.loadSpiderDetail) return;
        SetaeUIDetail.loadSpiderDetail(id);
    }

    function handleListItemKeydown(e) {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        if ($(e.target).closest('button, a, input, select, textarea').length) return;

        e.preventDefault();
        handleListItemClick.call(this, e);
    }

    // ==========================================
    // Sort Menu
    // ==========================================
    function toggleSortMenu(e) {
        e.preventDefault();
        e.stopPropagation();
        const $trigger = $('#btn-sort-menu');
        const $existing = $('#setae-sort-menu-v3');
        if ($existing.length > 0) {
            closeSortMenu(true);
            return;
        }

        const currentSort = SetaeCore.state.currentSort || 'priority';
        const getActiveClass = (sortKey) => (sortKey === currentSort ? ' active' : '');
        const getChecked = (sortKey) => (sortKey === currentSort ? 'true' : 'false');

        const menuDiv = document.createElement('div');
        menuDiv.id = 'setae-sort-menu-v3';
        menuDiv.setAttribute('role', 'menu');
        menuDiv.setAttribute('aria-label', '個体の並び順');
        menuDiv.innerHTML = `
            <div class="sort-group-label" role="presentation">ケアの優先度</div>
            <button type="button" class="sort-option${getActiveClass('priority')}" role="menuitemradio" aria-checked="${getChecked('priority')}" data-sort="priority">メンテナンス優先</button>
            <button type="button" class="sort-option${getActiveClass('hungriest')}" role="menuitemradio" aria-checked="${getChecked('hungriest')}" data-sort="hungriest">給餌が必要な順</button>

            <div class="sort-group-label" role="presentation">個体情報</div>
            <button type="button" class="sort-option${getActiveClass('classification')}" role="menuitemradio" aria-checked="${getChecked('classification')}" data-sort="classification">カテゴリー順</button>
            <button type="button" class="sort-option${getActiveClass('species_asc')}" role="menuitemradio" aria-checked="${getChecked('species_asc')}" data-sort="species_asc">種類・学名順</button>
            <button type="button" class="sort-option${getActiveClass('molt_oldest')}" role="menuitemradio" aria-checked="${getChecked('molt_oldest')}" data-sort="molt_oldest">脱皮日が古い順</button>
            <button type="button" class="sort-option${getActiveClass('name_asc')}" role="menuitemradio" aria-checked="${getChecked('name_asc')}" data-sort="name_asc">名前・ID順</button>
            <button type="button" class="sort-option${getActiveClass('newest')}" role="menuitemradio" aria-checked="${getChecked('newest')}" data-sort="newest">登録が新しい順</button>
        `;
        document.body.appendChild(menuDiv);

        const rect = $trigger[0].getBoundingClientRect();
        const menuWidth = Math.min(260, Math.max(180, window.innerWidth - 24));
        const estimatedHeight = 365;
        const left = Math.max(12, Math.min(window.innerWidth - menuWidth - 12, rect.right - menuWidth));
        const openAbove = rect.bottom + estimatedHeight > window.innerHeight - 12;
        const top = openAbove
            ? Math.max(12, rect.top - estimatedHeight - 8)
            : rect.bottom + 8;

        $(menuDiv).css({
            position: 'fixed',
            top: top + 'px',
            left: left + 'px',
            zIndex: 999999
        });
        $trigger.attr('aria-expanded', 'true');
        $(menuDiv).find('.sort-option.active').first().trigger('focus');
        if (!$(menuDiv).find('.sort-option.active').length) {
            $(menuDiv).find('.sort-option').first().trigger('focus');
        }
    }

    function closeSortMenu(restoreFocus) {
        const hadMenu = $('#setae-sort-menu-v3').length > 0;
        $('#setae-sort-menu-v3').remove();
        $('#btn-sort-menu').attr('aria-expanded', 'false');
        if (restoreFocus === true && hadMenu) $('#btn-sort-menu').trigger('focus');
    }

    function closeSortMenuOutside(e) {
        if (!$(e.target).closest('#btn-sort-menu').length && !$(e.target).closest('#setae-sort-menu-v3').length) {
            closeSortMenu();
        }
    }

    function handleSortMenuKeydown(e) {
        const $items = $('#setae-sort-menu-v3 .sort-option');
        if (!$items.length) return;

        const currentIndex = $items.index(document.activeElement);
        let nextIndex = currentIndex;
        if (e.key === 'Escape') {
            e.preventDefault();
            closeSortMenu(true);
            return;
        }
        if (e.key === 'ArrowDown') nextIndex = (currentIndex + 1 + $items.length) % $items.length;
        else if (e.key === 'ArrowUp') nextIndex = (currentIndex - 1 + $items.length) % $items.length;
        else if (e.key === 'Home') nextIndex = 0;
        else if (e.key === 'End') nextIndex = $items.length - 1;
        else return;

        e.preventDefault();
        $items.eq(nextIndex).trigger('focus');
    }

    function handleSortOptionClick() {
        const sort = $(this).data('sort');
        SetaeCore.state.currentSort = sort;
        localStorage.setItem('setae_my_sort', sort);
        closeSortMenu();
        renderMySpiders();
        if (typeof SetaeCore.announce === 'function') {
            SetaeCore.announce($(this).text().trim() + 'に並び替えました');
        }
    }

    function handleTodayLogClick(e) {
        e.preventDefault();
        e.stopPropagation();

        const id = $(this).data('id');
        const type = $(this).data('type') || 'note';
        if (!id || typeof SetaeUILogModal === 'undefined' || !SetaeUILogModal.openLogModal) return;

        SetaeUILogModal.openLogModal(id, type);
        if (typeof SetaeCore.track === 'function') {
            SetaeCore.track('today_check_record_click', {
                type: type,
                source: 'today_check'
            });
        }
    }

    function handleTodaySpiderOpen(e) {
        e.preventDefault();
        e.stopPropagation();

        const id = $(this).data('id');
        if (!id || !window.SetaeUIDetail || !SetaeUIDetail.loadSpiderDetail) return;

        SetaeUIDetail.loadSpiderDetail(id);
        if (typeof SetaeCore.track === 'function') {
            SetaeCore.track('today_check_spider_open', {
                source: 'today_check'
            });
        }
    }

    function handleTodayFocusList(e) {
        e.preventDefault();
        e.stopPropagation();

        SetaeCore.state.currentDeck = 'all';
        SetaeCore.state.currentSort = 'priority';
        SetaeCore.state.currentSearch = '';
        localStorage.setItem('setae_my_deck', 'all');
        localStorage.setItem('setae_my_sort', 'priority');
        localStorage.setItem('setae_my_search', '');
        $('#setae-spider-search').val('');
        $('.deck-pill[data-deck]').removeClass('active');
        $('.deck-pill[data-deck="all"]').addClass('active');
        renderMySpiders();
        const listEl = document.getElementById('setae-spider-list');
        if (listEl && listEl.scrollIntoView) {
            listEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    function openContinueSpider(id, source) {
        if (!id || !window.SetaeUIDetail || !SetaeUIDetail.loadSpiderDetail) return;

        if (typeof SetaeCore.track === 'function') {
            SetaeCore.track('continue_spider_open', {
                source: source || 'button'
            });
        }

        SetaeUIDetail.loadSpiderDetail(id);
    }

    function handleContinueOpen(e) {
        e.preventDefault();
        e.stopPropagation();

        openContinueSpider($(this).data('id'), 'button');
    }

    function handleContinueDismiss(e) {
        e.preventDefault();
        e.stopPropagation();

        hideContinueForToday();
        $('#setae-continue-panel').slideUp(160, function () {
            $(this).empty();
        });

        if (typeof SetaeCore.track === 'function') {
            SetaeCore.track('continue_spider_dismiss', {
                source: 'my_spiders'
            });
        }
    }

    function closeSpecimenMenus(exceptMenu) {
        $('.specimen-v5-menu').each(function () {
            if (exceptMenu && this === exceptMenu) return;
            this.hidden = true;
            $(this).closest('.specimen-card-v5').find('.js-specimen-menu').attr('aria-expanded', 'false');
        });
    }

    function handleSpecimenMenuToggle(e) {
        e.preventDefault();
        e.stopPropagation();

        const $button = $(this);
        const menu = $button.closest('.specimen-v5-shell').find('.specimen-v5-menu').get(0);
        if (!menu) return;
        const willOpen = menu.hidden;
        closeSpecimenMenus(willOpen ? menu : null);
        menu.hidden = !willOpen;
        $button.attr('aria-expanded', willOpen ? 'true' : 'false');
        if (willOpen) {
            $(menu).find('button').first().trigger('focus');
        }
    }

    function handleSpecimenMenuOutside(e) {
        if ($(e.target).closest('.specimen-v5-menu, .js-specimen-menu').length) return;
        closeSpecimenMenus();
    }

    function handleSpecimenMenuKeydown(e) {
        if (e.key !== 'Escape') return;
        const $menu = $(this).closest('.specimen-v5-menu');
        const $trigger = $menu.closest('.specimen-card-v5').find('.js-specimen-menu').first();
        closeSpecimenMenus();
        $trigger.trigger('focus');
    }

    function handleMyFilterToggle(e) {
        e.preventDefault();
        const $button = $(this);
        const $pane = $('#setae-my-collection-pane');
        const collapsed = !$pane.hasClass('is-filters-collapsed');
        $pane.toggleClass('is-filters-collapsed', collapsed);
        $button.attr('aria-expanded', collapsed ? 'false' : 'true');
        $button.attr('aria-label', collapsed ? '絞り込み条件を表示' : '絞り込み条件を隠す');
    }

    function refresh() {
        if (!Array.isArray(SetaeCore.state.cachedSpiders) || !SetaeCore.state.cachedSpiders.length) {
            renderLoading();
        }
        return SetaeAPI.fetchMySpiders(renderMySpiders, {
            onError: function (xhr) {
                renderLoadError(SetaeCore.getErrorMessage
                    ? SetaeCore.getErrorMessage(xhr, '通信状態を確認して、もう一度お試しください。')
                    : '通信状態を確認して、もう一度お試しください。');
            }
        });
    }

    /**
     * 初期化：現在のステートをUIに反映させる
     */
    function init() {
        // 1. 検索クエリの復元
        if (SetaeCore.state.currentSearch) {
            $('#setae-spider-search').val(SetaeCore.state.currentSearch);
        }

        // 2. デッキ（フィルター）の復元
        if (SetaeCore.state.currentDeck) {
            $('.deck-pill[data-deck]').removeClass('active');
            $(`.deck-pill[data-deck="${SetaeCore.state.currentDeck}"]`).addClass('active');
        }

        // 3. 初回レンダリング
        renderMySpiders();

        if (SetaeAPI.fetchCareSummary) {
            SetaeAPI.fetchCareSummary(function () {
                renderMySpiders();
            });
        }

        $(document).off('click.setaeTodayLog').on('click.setaeTodayLog', '.js-today-log', handleTodayLogClick);
        $(document).off('click.setaeTodaySpider').on('click.setaeTodaySpider', '.js-today-open-spider', handleTodaySpiderOpen);
        $(document).off('click.setaeTodayFocus').on('click.setaeTodayFocus', '.js-today-focus-list', handleTodayFocusList);
        $(document).off('click.setaeClearMyFilters').on('click.setaeClearMyFilters', '.js-clear-my-filters', handleClearMyFilters);
        $(document).off('click.setaeDesktopDashboardFilter').on('click.setaeDesktopDashboardFilter', '.js-desktop-dashboard-filter', handleDesktopDashboardFilterClick);
        $(document).off('click.setaeDesktopDashboardSpider').on('click.setaeDesktopDashboardSpider', '.js-desktop-dashboard-spider', handleDesktopDashboardSpiderOpen);
        $(document).off('click.setaeContinueOpen').on('click.setaeContinueOpen', '.js-continue-open', handleContinueOpen);
        $(document).off('click.setaeContinueDismiss').on('click.setaeContinueDismiss', '.js-continue-dismiss', handleContinueDismiss);
        $(document).off('click.setaeMyFilterToggle').on('click.setaeMyFilterToggle', '#btn-my-filter-toggle', handleMyFilterToggle);
        $(document).off('click.setaeSpecimenMenu').on('click.setaeSpecimenMenu', '.js-specimen-menu', handleSpecimenMenuToggle);
        $(document).off('click.setaeSpecimenMenuOutside').on('click.setaeSpecimenMenuOutside', handleSpecimenMenuOutside);
        $(document).off('keydown.setaeSpecimenMenu').on('keydown.setaeSpecimenMenu', '.specimen-v5-menu', handleSpecimenMenuKeydown);
        $(document).off('click.setaeSpecimenMenuAction').on('click.setaeSpecimenMenuAction', '.specimen-v5-menu button', function () {
            closeSpecimenMenus();
        });
        $(document).off('click.setaeListOpen').on('click.setaeListOpen', '.js-list-open', handleListOpenClick);
        $(document).off('click.setaeListRecord').on('click.setaeListRecord', '.js-list-record', handleListRecordClick);
        $(document).off('click.setaeSpiderFavorite').on('click.setaeSpiderFavorite', '.js-toggle-spider-favorite', handleSpiderFavoriteClick);
        $(document).off('click.setaeStreakCalendar').on('click.setaeStreakCalendar', '.js-open-streak-calendar', handleStreakCalendarOpen);
        $(document).off('keydown.setaeStreakCalendar').on('keydown.setaeStreakCalendar', '.js-open-streak-calendar', handleStreakCalendarKeydown);
        $(document).off('click.setaeStreakDay').on('click.setaeStreakDay', '.js-open-streak-day', handleStreakDayClick);
        $(document).off('click.setaeStreakStartLog').on('click.setaeStreakStartLog', '.js-streak-start-log', handleStreakStartLog);
        $(document).off('click.setaeStreakLog').on('click.setaeStreakLog', '.js-open-streak-log', handleStreakLogOpen);
        $(document).off('pointermove.setaeCardDepth').on('pointermove.setaeCardDepth', '#setae-spider-list > .setae-spider-list-row', handleCardPointerMove);
        $(document).off('pointerleave.setaeCardDepth').on('pointerleave.setaeCardDepth', '#setae-spider-list > .setae-spider-list-row', handleCardPointerLeave);
    }

    return {
        init: init,
        refresh: refresh, // ★追加: これにより add-spider.js から SetaeUIList.refresh() が呼べるようになります
        rememberLastSpider: rememberLastSpider,
        getVisibleSpiders: getVisibleSpiders,
        getAdjacentSpider: getAdjacentSpider,
        renderLoading: renderLoading,
        renderLoadError: renderLoadError,
        renderMySpiders: renderMySpiders,
        updateSpiderCard: updateSpiderCard,
        handleDeckFilterClick: handleDeckFilterClick,
        handleSearchInput: handleSearchInput,
        handleListItemClick: handleListItemClick,
        handleListItemKeydown: handleListItemKeydown,
        toggleSortMenu: toggleSortMenu,
        handleSortOptionClick: handleSortOptionClick,
        handleSortMenuKeydown: handleSortMenuKeydown,
        closeSortMenuOutside: closeSortMenuOutside,
        closeSortMenu: closeSortMenu
    };

})(jQuery);
