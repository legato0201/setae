var SetaeUIDetail = (function ($) {
    'use strict';
    // Note: wp.i18n is removed in favor of setaeI18n global object passed via wp_localize_script
    let currentSpiderId = null;
    let currentClassification = 'tarantula'; // ★追加: 現在の個体の分類を保持
    let myListScrollPosition = 0;
    let detailAlbumItems = [];
    let detailAlbumIndex = 0;
    let detailAlbumTrigger = null;
    let detailAlbumTouchStartX = null;
    let detailStickyFrame = null;
    const DETAIL_TAB_KEY = 'setae_detail_tab_v1';
    const DETAIL_ALBUM_INITIAL_LIMIT = 5;

    function confirmDetailAction(options) {
        if (SetaeCore && typeof SetaeCore.confirmAction === 'function') {
            return SetaeCore.confirmAction(options);
        }
        return Promise.resolve(window.confirm(String(options && options.message ? options.message : 'この操作を続けますか？')));
    }

    // ==========================================
    // DEEP DETAIL VIEW
    // ==========================================

    function getSavedDetailTab() {
        try {
            return localStorage.getItem(DETAIL_TAB_KEY) || 'tab-overview';
        } catch (e) {
            return 'tab-overview';
        }
    }

    function activateDetailTab(target, persist = true) {
        let tabTarget = target || 'tab-overview';
        let $btn = $(`.setae-detail-tabs .tab-btn[data-target="${tabTarget}"]`);

        if (!$btn.length || $btn.css('display') === 'none') {
            tabTarget = 'tab-overview';
            $btn = $('.setae-detail-tabs .tab-btn[data-target="tab-overview"]');
        }

        $('.setae-detail-tabs .tab-btn')
            .removeClass('active')
            .attr({ 'aria-selected': 'false', 'tabindex': '-1' });
        $btn.addClass('active').attr({ 'aria-selected': 'true', 'tabindex': '0' });
        $('.detail-tab-content').hide().attr('hidden', true);
        $('#' + tabTarget).removeAttr('hidden').fadeIn(160);

        if (persist) {
            try {
                localStorage.setItem(DETAIL_TAB_KEY, tabTarget);
            } catch (e) {}
        }
    }

    function getSpiderDisplayName(spider) {
        if (!spider) return '';
        return spider.title || spider.nickname || spider.species_name || spider.scientific_name || '個体';
    }

    function getPageScrollPosition() {
        return window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
    }

    function setPageScrollPosition(position) {
        const top = Math.max(0, parseInt(position, 10) || 0);
        window.scrollTo(0, top);
        document.documentElement.scrollTop = top;
        document.body.scrollTop = top;
    }

    function rememberMyListScrollPosition() {
        if (!$('#section-my').is(':visible')) return;
        myListScrollPosition = getPageScrollPosition();
    }

    function resetDetailViewport() {
        const detailSection = document.getElementById('section-my-detail');
        if (detailSection) detailSection.scrollTop = 0;
        resetDetailStickyStack();
        setPageScrollPosition(0);
        window.requestAnimationFrame(function () {
            setPageScrollPosition(0);
            queueDetailStickyStackUpdate();
        });
    }

    function resetDetailStickyStack() {
        $('#section-my-detail .setae-detail-topbar').removeClass('is-stacked');
        $('#section-my-detail .setae-detail-command-bar').removeClass('is-stuck');
    }

    function updateDetailStickyStack() {
        const $section = $('#section-my-detail');
        const commandBar = $section.find('.setae-detail-command-bar').get(0);
        const compactLayout = !window.matchMedia || window.matchMedia('(max-width: 767px)').matches;

        if (!$section.is(':visible') || !commandBar || !compactLayout) {
            resetDetailStickyStack();
            return;
        }

        const stickyTop = parseFloat(window.getComputedStyle(commandBar).top) || 0;
        const isStuck = getPageScrollPosition() > 0
            && commandBar.getBoundingClientRect().top <= stickyTop + 1;

        $section.find('.setae-detail-topbar').toggleClass('is-stacked', isStuck);
        $(commandBar).toggleClass('is-stuck', isStuck);
    }

    function queueDetailStickyStackUpdate() {
        if (detailStickyFrame !== null) return;
        detailStickyFrame = window.requestAnimationFrame(function () {
            detailStickyFrame = null;
            updateDetailStickyStack();
        });
    }

    function setupDetailStickyStack() {
        $(window)
            .off('.setaeDetailStickyStack')
            .on('scroll.setaeDetailStickyStack resize.setaeDetailStickyStack', queueDetailStickyStackUpdate);
        queueDetailStickyStackUpdate();
    }

    function restoreMyListScrollPosition() {
        setPageScrollPosition(myListScrollPosition);
        window.requestAnimationFrame(function () {
            setPageScrollPosition(myListScrollPosition);
        });
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

    function buildDetailHeroDate(value) {
        const displayValue = String(value || '記録なし').trim();
        const match = displayValue.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);

        if (!match) {
            return `<span class="detail-hero-date-empty">${escapeHtml(displayValue)}</span>`;
        }

        const year = match[1];
        const month = String(parseInt(match[2], 10));
        const day = String(parseInt(match[3], 10));
        const normalizedMonth = month.padStart(2, '0');
        const normalizedDay = day.padStart(2, '0');
        const datetime = `${year}-${normalizedMonth}-${normalizedDay}`;

        return `
            <time class="detail-hero-date" datetime="${datetime}" aria-label="${year}年${month}月${day}日">
                <span class="detail-hero-date-main">
                    <span>${month}</span><i aria-hidden="true">/</i><span>${day}</span>
                </span>
                <span class="detail-hero-date-year">${year}</span>
            </time>
        `;
    }

    function renderDetailHeroDate(selector, value) {
        $(selector).html(buildDetailHeroDate(value));
    }

    function getDetailTopicType(spider) {
        const status = spider && spider.status ? spider.status : '';
        if (status === 'fasting') return 'feed';
        if (status === 'pre_molt' || status === 'post_molt') return 'molt';
        if (spider && spider.classification === 'plant') return 'water';
        return 'note';
    }

    function renderDetailConsultAction(spider) {
        const id = spider && spider.id ? spider.id : '';
        if (!id) return '';

        return `
            <div class="detail-consult-action">
                <button type="button" class="detail-consult-button js-open-topic-modal"
                    data-id="${escapeHtml(id)}"
                    data-type="${escapeHtml(getDetailTopicType(spider))}"
                    data-source="detail">
                    <span>
                        <strong>この個体について相談</strong>
                        <em>状態や直近の記録を入れて投稿できます</em>
                    </span>
                    <b>相談</b>
                </button>
            </div>
        `;
    }

    function getDetailCareFocus(spider) {
        const classification = spider && spider.classification ? spider.classification : 'tarantula';
        const status = spider && spider.status ? spider.status : 'normal';

        if (classification === 'plant') {
            return {
                tone: 'plant',
                title: '水分状態を確認しましょう',
                description: '土や葉の様子を見て、必要なら水やりの記録を残しましょう。',
                recordType: 'feed',
                actionLabel: '水やりを記録'
            };
        }

        if (status === 'pre_molt') {
            return {
                tone: 'alert',
                title: '静かに見守るタイミングです',
                description: '脱皮前の可能性があります。巣の周りをそっと確認し、変化だけを残しましょう。',
                recordType: 'note',
                actionLabel: '観察を記録'
            };
        }

        if (status === 'fasting') {
            return {
                tone: 'warning',
                title: '食べ方と腹部の様子を確認',
                description: '拒食の経過を残しておくと、次に判断するときの助けになります。',
                recordType: 'feed',
                actionLabel: '給餌を記録'
            };
        }

        if (status === 'post_molt') {
            return {
                tone: 'recovery',
                title: '回復の様子を見守りましょう',
                description: '脱皮後の変化をひとつ残すと、次の成長を振り返りやすくなります。',
                recordType: 'note',
                actionLabel: '観察を記録'
            };
        }

        if (spider && spider.is_hungry) {
            return {
                tone: 'hungry',
                title: '給餌を検討するタイミングです',
                description: '前回の給餌と様子を見比べて、今日の判断を残しましょう。',
                recordType: 'feed',
                actionLabel: '給餌を記録'
            };
        }

        return {
            tone: 'calm',
            title: '今日の小さな変化を残しましょう',
            description: 'ひとことの観察でも、飼育の積み重ねがこの個体のカルテになります。',
            recordType: 'note',
            actionLabel: '観察を記録'
        };
    }

    function renderDetailCareFocus(spider, status) {
        if (typeof SetaeCore !== 'undefined'
            && typeof SetaeCore.getCareFocusPreference === 'function'
            && !SetaeCore.getCareFocusPreference()) {
            return '';
        }

        const focus = getDetailCareFocus(spider);
        const id = spider && spider.id ? spider.id : '';
        const statusLabel = status && status.label ? status.label : '通常';

        return `
            <section class="detail-care-focus detail-care-focus--${escapeHtml(focus.tone)}">
                <button type="button" class="detail-care-focus-dismiss js-detail-care-focus-dismiss" aria-label="今日の飼育を閉じる" title="閉じる">
                    <span aria-hidden="true">&times;</span>
                </button>
                <div class="detail-care-focus-copy">
                    <span>今日の飼育</span>
                    <h3>${escapeHtml(focus.title)}</h3>
                    <p>${escapeHtml(focus.description)}</p>
                </div>
                <div class="detail-care-focus-actions">
                    <span class="detail-status-pill">${escapeHtml(statusLabel)}</span>
                    <button type="button" class="detail-record-action js-detail-record" data-id="${escapeHtml(id)}" data-type="${escapeHtml(focus.recordType)}">${escapeHtml(focus.actionLabel)}</button>
                </div>
            </section>
        `;
    }

    function renderDetailArchiveNotice(spider) {
        if (spider && spider.transfer_receipt) {
            return `
                <section class="detail-archive-notice is-transfer-receipt">
                    <div>
                        <span>TRANSFERRED</span>
                        <h3>譲渡時点のアーカイブ</h3>
                        <p>譲渡前の写真と履歴を保存しています。現在の個体管理は新しい所有者へ移動しました。</p>
                    </div>
                </section>
            `;
        }
        return `
            <section class="detail-archive-notice">
                <div>
                    <span>ARCHIVED</span>
                    <h3>アーカイブ中の個体</h3>
                    <p>記録と写真はそのまま保存されています。</p>
                </div>
                <button type="button" class="js-detail-restore" data-id="${escapeHtml(spider.id || '')}">飼育一覧へ戻す</button>
            </section>
        `;
    }

    function getDetailEventTypeLabel(event, isPlant) {
        const type = String(event && event.type ? event.type : '').toLowerCase();
        if (type === 'feed') return isPlant ? '水やり' : '給餌';
        if (type === 'molt') return isPlant ? '植え替え' : '脱皮';
        if (type === 'growth') return '成長記録';
        if (type === 'pairing') return 'ペアリング';
        if (type === 'observation') return '観察';
        if (type === 'memo' || type === 'note') return 'メモ';
        return '記録';
    }

    function parseDetailEventData(event) {
        if (!event || !event.data) return {};
        if (typeof event.data === 'object') return event.data;

        try {
            return JSON.parse(event.data);
        } catch (e) {
            return {};
        }
    }

    function getDetailPhotoItems(events, spider) {
        const isPlant = (spider && spider.classification === 'plant') || currentClassification === 'plant';

        return (Array.isArray(events) ? events : [])
            .map(function (event) {
                const parsed = parseDetailEventData(event);
                const imageUrl = event && (event.image || parsed.image) ? (event.image || parsed.image) : '';
                if (!imageUrl) return null;

                const typeLabel = getDetailEventTypeLabel(event, isPlant);
                const date = event.date || '';
                const note = event.note || parsed.note || '';

                return {
                    id: event.id || '',
                    url: imageUrl,
                    date: date,
                    typeLabel: typeLabel,
                    note: note,
                    alt: `${date ? date + ' ' : ''}${typeLabel}の記録写真`
                };
            })
            .filter(Boolean)
            .sort(function (a, b) {
                return String(b.date || '').localeCompare(String(a.date || ''));
            });
    }

    function renderDetailPhotoAlbum(events, spider, options = {}) {
        const $target = $('#detail-photo-album');
        detailAlbumItems = getDetailPhotoItems(events, spider);

        if (!$target.length) return;

        if (options.error) {
            $('#detail-photo-count').text('-');
            $target.html('<div class="detail-photo-empty is-error">写真を読み込めませんでした</div>');
            return;
        }

        $('#detail-photo-count').text(`${detailAlbumItems.length}枚`);
        if (!detailAlbumItems.length) {
            $target.html('<div class="detail-photo-empty">写真付きの記録はまだありません</div>');
            return;
        }

        const tiles = detailAlbumItems.map(function (item, index) {
            const isExtra = index >= DETAIL_ALBUM_INITIAL_LIMIT;
            return `
                <button type="button"
                    class="detail-photo-tile js-detail-album-open${index === 0 ? ' is-featured' : ''}"
                    data-album-index="${index}"
                    aria-label="${escapeHtml(item.alt)}を表示"${isExtra ? ' hidden data-album-extra="true"' : ''}>
                    <img src="${escapeHtml(item.url)}" alt="${escapeHtml(item.alt)}" loading="lazy">
                    <span class="detail-photo-meta">
                        <b>${escapeHtml(item.date || '-')}</b>
                        <span>${escapeHtml(item.typeLabel)}</span>
                    </span>
                </button>
            `;
        }).join('');

        const moreButton = detailAlbumItems.length > DETAIL_ALBUM_INITIAL_LIMIT
            ? `<button type="button" class="detail-album-more js-detail-album-more" aria-expanded="false">すべての写真（${detailAlbumItems.length}）</button>`
            : '';

        $target.html(`
            <div class="detail-photo-grid">${tiles}</div>
            ${moreButton ? `<div class="detail-photo-actions">${moreButton}</div>` : ''}
        `);
    }

    function ensureDetailAlbumViewer() {
        let $viewer = $('#setae-detail-album-viewer');
        if ($viewer.length) return $viewer;

        $('body').append(`
            <div id="setae-detail-album-viewer" class="setae-care-media-viewer setae-detail-album-viewer" role="dialog" aria-modal="true" aria-label="記録写真" aria-hidden="true">
                <div class="setae-care-media-viewer-stage setae-detail-album-viewer-stage" role="document">
                    <button type="button" class="setae-care-media-viewer-close js-detail-album-close" aria-label="写真を閉じる" title="閉じる">&times;</button>
                    <button type="button" class="detail-album-viewer-nav is-prev js-detail-album-prev" aria-label="前の写真">&lsaquo;</button>
                    <figure class="detail-album-viewer-figure">
                        <img class="setae-care-media-viewer-image detail-album-viewer-image" alt="">
                        <figcaption class="detail-album-viewer-caption">
                            <span class="detail-album-viewer-meta"></span>
                            <strong class="detail-album-viewer-note"></strong>
                            <span class="detail-album-viewer-position"></span>
                        </figcaption>
                    </figure>
                    <button type="button" class="detail-album-viewer-nav is-next js-detail-album-next" aria-label="次の写真">&rsaquo;</button>
                </div>
            </div>
        `);

        return $('#setae-detail-album-viewer');
    }

    function showDetailAlbumItem(index) {
        if (!detailAlbumItems.length) return;

        detailAlbumIndex = Math.max(0, Math.min(parseInt(index, 10) || 0, detailAlbumItems.length - 1));
        const item = detailAlbumItems[detailAlbumIndex];
        const $viewer = ensureDetailAlbumViewer();

        $viewer.find('.detail-album-viewer-image').attr({
            src: item.url,
            alt: item.alt
        });
        $viewer.find('.detail-album-viewer-meta').text([item.date, item.typeLabel].filter(Boolean).join(' · '));
        $viewer.find('.detail-album-viewer-note').text(item.note).toggle(!!item.note);
        $viewer.find('.detail-album-viewer-position').text(`${detailAlbumIndex + 1} / ${detailAlbumItems.length}`);
        $viewer.find('.js-detail-album-prev').prop('disabled', detailAlbumIndex === 0);
        $viewer.find('.js-detail-album-next').prop('disabled', detailAlbumIndex === detailAlbumItems.length - 1);
    }

    function handleDetailAlbumOpen(e) {
        e.preventDefault();
        e.stopPropagation();

        const index = parseInt($(this).attr('data-album-index'), 10);
        if (!Number.isInteger(index) || !detailAlbumItems[index]) return;

        detailAlbumTrigger = this;
        const $viewer = ensureDetailAlbumViewer();
        showDetailAlbumItem(index);
        $viewer.addClass('is-open').attr('aria-hidden', 'false');
        $('body').addClass('setae-care-media-viewer-open');
        window.setTimeout(function () {
            $viewer.find('.js-detail-album-close').trigger('focus');
        }, 0);
    }

    function closeDetailAlbumViewer(e) {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }

        const $viewer = $('#setae-detail-album-viewer');
        if (!$viewer.length || !$viewer.hasClass('is-open')) return;

        $viewer.removeClass('is-open').attr('aria-hidden', 'true');
        if (!$('#setae-care-feed-media-viewer').hasClass('is-open')) {
            $('body').removeClass('setae-care-media-viewer-open');
        }

        window.setTimeout(function () {
            if (!$viewer.hasClass('is-open')) {
                $viewer.find('.detail-album-viewer-image').attr({ src: '', alt: '' });
            }
        }, 180);

        if (detailAlbumTrigger && document.contains(detailAlbumTrigger)) {
            detailAlbumTrigger.focus();
        }
        detailAlbumTrigger = null;
        detailAlbumTouchStartX = null;
    }

    function handleDetailAlbumBackdrop(e) {
        if (e.target === this) closeDetailAlbumViewer(e);
    }

    function handleDetailAlbumMore(e) {
        e.preventDefault();
        const $button = $(this);
        const expanded = $button.attr('aria-expanded') === 'true';
        $('#detail-photo-album [data-album-extra="true"]').prop('hidden', expanded);
        $button.attr('aria-expanded', expanded ? 'false' : 'true')
            .text(expanded ? `すべての写真（${detailAlbumItems.length}）` : '表示を減らす');
    }

    function handleDetailAlbumKeydown(e) {
        const $viewer = $('#setae-detail-album-viewer');
        if (!$viewer.hasClass('is-open')) return;

        if (e.key === 'Escape') {
            closeDetailAlbumViewer(e);
        } else if (e.key === 'ArrowLeft' && detailAlbumIndex > 0) {
            e.preventDefault();
            showDetailAlbumItem(detailAlbumIndex - 1);
        } else if (e.key === 'ArrowRight' && detailAlbumIndex < detailAlbumItems.length - 1) {
            e.preventDefault();
            showDetailAlbumItem(detailAlbumIndex + 1);
        } else if (e.key === 'Tab') {
            const $focusable = $viewer.find('button:not([disabled]):visible');
            if (!$focusable.length) return;
            const first = $focusable[0];
            const last = $focusable[$focusable.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        }
    }

    function handleDetailAlbumTouchStart(e) {
        const touch = e.originalEvent && e.originalEvent.touches ? e.originalEvent.touches[0] : null;
        detailAlbumTouchStartX = touch ? touch.clientX : null;
    }

    function handleDetailAlbumTouchEnd(e) {
        const touch = e.originalEvent && e.originalEvent.changedTouches ? e.originalEvent.changedTouches[0] : null;
        if (!touch || detailAlbumTouchStartX === null) return;

        const distance = touch.clientX - detailAlbumTouchStartX;
        detailAlbumTouchStartX = null;
        if (Math.abs(distance) < 52) return;

        if (distance > 0 && detailAlbumIndex > 0) {
            showDetailAlbumItem(detailAlbumIndex - 1);
        } else if (distance < 0 && detailAlbumIndex < detailAlbumItems.length - 1) {
            showDetailAlbumItem(detailAlbumIndex + 1);
        }
    }

    function buildDetailActivityInsights(spider, events, options = {}) {
        const isLoading = !Array.isArray(events);
        const hasError = !!options.error;
        const safeEvents = Array.isArray(events) ? events : [];
        const isPlant = spider && spider.classification === 'plant';
        const feedLabel = isPlant ? '水やり' : '給餌';
        const moltLabel = isPlant ? '植え替え' : '脱皮';
        const counts = { feed: 0, molt: 0, observation: 0 };

        safeEvents.forEach(function (event) {
            const type = String(event && event.type ? event.type : '').toLowerCase();
            if (type === 'feed') {
                counts.feed += 1;
            } else if (type === 'molt') {
                counts.molt += 1;
            } else {
                counts.observation += 1;
            }
        });

        const latestEvent = safeEvents.slice().sort(function (a, b) {
            return String(b && b.date ? b.date : '').localeCompare(String(a && a.date ? a.date : ''));
        })[0] || null;
        const latestHtml = isLoading
            ? '<div class="detail-activity-loading">記録を読み込んでいます</div>'
            : (hasError
                ? '<div class="detail-activity-loading is-error">記録を読み込めませんでした</div>'
                : (latestEvent
                    ? `
                        <div class="detail-latest-event">
                            <span>最新の記録</span>
                            <strong>${escapeHtml(getDetailEventTypeLabel(latestEvent, isPlant))}</strong>
                            <em>${escapeHtml(getRelativeDateLabel(latestEvent.date))}</em>
                        </div>
                    `
                    : '<div class="detail-latest-event is-empty"><span>まだ記録はありません</span><em>最初のひとことから始めましょう</em></div>'));

        return `
            <section class="detail-activity-card${isLoading ? ' is-loading' : ''}">
                <div class="detail-activity-head">
                    <span>飼育カルテ</span>
                    <strong>${isLoading ? '...' : escapeHtml(String(safeEvents.length))}<small>記録</small></strong>
                </div>
                <div class="detail-activity-metrics">
                    <span><b>${isLoading ? '-' : escapeHtml(String(counts.feed))}</b>${escapeHtml(feedLabel)}</span>
                    <span><b>${isLoading ? '-' : escapeHtml(String(counts.molt))}</b>${escapeHtml(moltLabel)}</span>
                    <span><b>${isLoading ? '-' : escapeHtml(String(counts.observation))}</b>観察・メモ</span>
                </div>
                ${latestHtml}
                <button type="button" class="detail-history-link js-detail-open-history">履歴をすべて見る</button>
            </section>
        `;
    }

    function renderDetailActivityInsights(spider, events, options = {}) {
        const $target = $('#detail-activity-insights');
        if (!$target.length) return;
        $target.html(buildDetailActivityInsights(spider || {}, events, options));
    }

    function detailDateFromValue(value) {
        const match = String(value || '').match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
        if (!match) return null;
        const date = new Date(parseInt(match[1], 10), parseInt(match[2], 10) - 1, parseInt(match[3], 10));
        return Number.isNaN(date.getTime()) ? null : date;
    }

    function detailDayKey(date) {
        if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
        return [
            date.getFullYear(),
            String(date.getMonth() + 1).padStart(2, '0'),
            String(date.getDate()).padStart(2, '0')
        ].join('-');
    }

    function detailDaysSince(value) {
        const date = detailDateFromValue(value);
        if (!date) return null;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return Math.max(0, Math.floor((today.getTime() - date.getTime()) / 86400000));
    }

    function detailAverageInterval(events, type) {
        const timestamps = (Array.isArray(events) ? events : [])
            .filter(function (event) {
                if (String(event && event.type || '').toLowerCase() !== type) return false;
                const parsed = parseDetailEventData(event);
                return !(type === 'feed' && (event.refused || parsed.refused));
            })
            .map(function (event) {
                const date = detailDateFromValue(event.date);
                return date ? date.getTime() : null;
            })
            .filter(function (timestamp) { return timestamp !== null; })
            .sort(function (a, b) { return a - b; });
        if (timestamps.length < 2) return null;

        const intervals = [];
        for (let index = 1; index < timestamps.length; index++) {
            const interval = Math.round((timestamps[index] - timestamps[index - 1]) / 86400000);
            if (interval > 0) intervals.push(interval);
        }
        if (!intervals.length) return null;
        return Math.max(1, Math.round(intervals.reduce(function (sum, value) {
            return sum + value;
        }, 0) / intervals.length));
    }

    function getDetailCondition(spider, events) {
        let score = 94;
        const safeEvents = Array.isArray(events) ? events : [];
        const lastObservationDays = detailDaysSince(spider && spider.last_observation);
        if (!safeEvents.length && !(spider && (spider.last_feed || spider.last_molt || spider.last_observation))) score -= 22;
        if (spider && spider.is_hungry) score -= 12;
        if (spider && spider.status === 'fasting') score -= 18;
        if (spider && spider.status === 'post_molt') score -= 8;
        if (spider && spider.status === 'pre_molt') score -= 4;
        if (lastObservationDays !== null && lastObservationDays > 30) score -= 8;
        if (safeEvents.length >= 8) score += 3;
        score = Math.max(42, Math.min(99, score));

        if (score >= 88) return { score: score, label: '非常に良好', note: '記録が安定しています', tone: 'good' };
        if (score >= 72) return { score: score, label: '経過観察', note: '次のケアを確認しましょう', tone: 'watch' };
        return { score: score, label: '要確認', note: '状態と記録を見直しましょう', tone: 'alert' };
    }

    function getDetailGenderLabel(gender) {
        if (gender === 'female') return 'メス ♀';
        if (gender === 'male') return 'オス ♂';
        return '性別不明';
    }

    function buildDetailConditionPanel(spider, events) {
        const condition = getDetailCondition(spider || {}, events || []);
        return `
            <section class="detail-data-panel detail-condition-panel">
                <header class="detail-panel-head"><div><span class="detail-panel-kicker">CONDITION</span><h3>健康状態</h3></div></header>
                <div class="detail-condition-body">
                    <div class="detail-condition-ring is-${escapeHtml(condition.tone)}" style="--detail-condition:${condition.score}%">
                        <span><b>${escapeHtml(String(condition.score))}</b><small>%</small></span>
                    </div>
                    <strong>${escapeHtml(condition.label)}</strong>
                    <small>${escapeHtml(condition.note)}</small>
                </div>
            </section>
        `;
    }

    function buildDetailFeedingPanel(spider, events) {
        const safeEvents = Array.isArray(events) ? events : [];
        const feedEvents = safeEvents.filter(function (event) {
            const parsed = parseDetailEventData(event);
            return String(event && event.type || '').toLowerCase() === 'feed' && !(event.refused || parsed.refused);
        });
        const interval = detailAverageInterval(safeEvents, 'feed') || (spider.classification === 'plant' ? 7 : 10);
        const elapsed = detailDaysSince(spider.last_feed);
        const ringProgress = elapsed === null ? 0 : Math.max(8, Math.min(100, Math.round((elapsed / Math.max(1, interval)) * 100)));
        const thirtyDaysAgo = Date.now() - (30 * 86400000);
        const recentCount = feedEvents.filter(function (event) {
            const date = detailDateFromValue(event.date);
            return date && date.getTime() >= thirtyDaysAgo;
        }).length;
        const latestParsed = feedEvents.length ? parseDetailEventData(feedEvents.slice().sort(function (a, b) {
            return String(b.date || '').localeCompare(String(a.date || ''));
        })[0]) : {};
        const feedLabel = spider.classification === 'plant' ? '水やり' : '給餌';
        return `
            <section class="detail-data-panel detail-feeding-panel">
                <header class="detail-panel-head"><div><span class="detail-panel-kicker">FEEDING</span><h3>${escapeHtml(feedLabel)}ステータス</h3></div></header>
                <div class="detail-feeding-body">
                    <div class="detail-feeding-ring" style="--detail-feeding:${ringProgress}%"><span><small>${escapeHtml(feedLabel)}間隔</small><b>${escapeHtml(String(interval))}<i>日</i></b><em>${elapsed !== null && elapsed >= interval ? '確認時期' : '良好'}</em></span></div>
                    <dl>
                        <div><dt>最終${escapeHtml(feedLabel)}日</dt><dd>${escapeHtml(spider.last_feed || '-')}</dd></div>
                        <div><dt>前の種類</dt><dd>${escapeHtml(spider.last_prey || latestParsed.prey_type || latestParsed.prey || '-')}</dd></div>
                        <div><dt>平均間隔</dt><dd>${escapeHtml(String(interval))}日</dd></div>
                        <div><dt>直近30日</dt><dd>${escapeHtml(String(recentCount))}回</dd></div>
                    </dl>
                </div>
            </section>
        `;
    }

    function buildDetailWeeklyPanel(events) {
        const safeEvents = Array.isArray(events) ? events : [];
        const labels = ['月', '火', '水', '木', '金', '土', '日'];
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const days = Array.from({ length: 7 }, function (_, index) {
            const date = new Date(today);
            date.setDate(today.getDate() - (6 - index));
            return date;
        });
        const counts = days.map(function (date) {
            const key = detailDayKey(date);
            return safeEvents.filter(function (event) { return String(event && event.date || '').slice(0, 10) === key; }).length;
        });
        const maximum = Math.max(1, ...counts);
        const points = counts.map(function (count, index) {
            const x = 14 + (index * 62);
            const y = 88 - ((count / maximum) * 62);
            return `${x},${y.toFixed(1)}`;
        }).join(' ');
        return `
            <section class="detail-data-panel detail-weekly-panel">
                <header class="detail-panel-head"><div><span class="detail-panel-kicker">7 DAYS</span><h3>週間アクティビティ</h3></div><span class="detail-panel-count">${escapeHtml(String(counts.reduce(function (sum, value) { return sum + value; }, 0)))}件</span></header>
                <div class="detail-weekly-chart" role="img" aria-label="直近7日間の記録数">
                    <svg viewBox="0 0 400 100" preserveAspectRatio="none" aria-hidden="true">
                        <path class="detail-weekly-grid" d="M14 26H386M14 57H386M14 88H386"></path>
                        <polyline points="${points}"></polyline>
                        ${counts.map(function (count, index) {
                            const x = 14 + (index * 62);
                            const y = 88 - ((count / maximum) * 62);
                            return `<circle cx="${x}" cy="${y.toFixed(1)}" r="3"></circle>`;
                        }).join('')}
                    </svg>
                    <div>${days.map(function (date) { return `<span>${escapeHtml(labels[(date.getDay() + 6) % 7])}</span>`; }).join('')}</div>
                </div>
            </section>
        `;
    }

    function renderDetailHeroProfile(spider, events) {
        const condition = getDetailCondition(spider || {}, events || spider.history || []);
        const statusLabels = {
            normal: '通常管理',
            fasting: '拒食中',
            pre_molt: '脱皮前',
            post_molt: '脱皮後'
        };
        const tags = [
            { label: statusLabels[spider.status] || '通常管理', tone: spider.status || 'normal' },
            { label: getDetailGenderLabel(spider.gender), tone: 'neutral' },
            { label: spider.instar ? `L${parseInt(spider.instar, 10)}` : '齢数未設定', tone: 'stage' }
        ];
        $('#detail-hero-tags').html(tags.map(function (tag) {
            return `<span class="is-${escapeHtml(tag.tone)}">${escapeHtml(tag.label)}</span>`;
        }).join(''));

        const facts = [
            { label: '産地・入手元', value: spider.origin || '-' },
            { label: '管理開始', value: spider.acquired_date || spider.created_at || '-' },
            { label: '飼育容器', value: spider.enclosure || '-' }
        ];
        $('#detail-hero-facts').html(facts.map(function (fact) {
            return `<div><dt>${escapeHtml(fact.label)}</dt><dd>${escapeHtml(fact.value)}</dd></div>`;
        }).join(''));

        $('#detail-health-meter').html(`
            <div class="detail-health-ring is-${escapeHtml(condition.tone)}" style="--detail-health:${condition.score}%">
                <span><b>${escapeHtml(String(condition.score))}</b><small>%</small></span>
            </div>
            <div><small>ケアコンディション</small><strong>${escapeHtml(condition.label)}</strong><em>${escapeHtml(condition.note)}</em></div>
        `);
        $('#btn-detail-favorite')
            .toggleClass('is-active', !!spider.is_favorite)
            .attr('aria-pressed', spider.is_favorite ? 'true' : 'false')
            .attr('aria-label', spider.is_favorite ? 'お気に入りから外す' : 'お気に入りに追加')
            .attr('title', spider.is_favorite ? 'お気に入りから外す' : 'お気に入りに追加');
    }

    function formatDetailEnvironment(value, suffix) {
        const text = String(value || '').trim();
        if (!text) return '-';
        return text.indexOf(suffix) >= 0 ? text : text + suffix;
    }

    function buildDetailEnvironmentPanel(spider) {
        const hasCurrent = !!(spider.temperature || spider.humidity);
        const temperature = spider.temperature || spider.recommended_temperature || '';
        const humidity = spider.humidity || spider.recommended_humidity || '';
        const lastCheck = spider.last_observation || '';
        return `
            <section class="detail-data-panel detail-environment-panel">
                <header class="detail-panel-head">
                    <div><span class="detail-panel-kicker">ENVIRONMENT</span><h3>環境ステータス</h3></div>
                    <span class="detail-panel-source">${hasCurrent ? '現在値' : '図鑑目安'}</span>
                </header>
                <div class="detail-environment-metrics">
                    <div class="is-temperature"><span aria-hidden="true"></span><small>温度</small><strong>${escapeHtml(formatDetailEnvironment(temperature, '℃'))}</strong><em>${escapeHtml(spider.recommended_temperature || '')}</em></div>
                    <div class="is-humidity"><span aria-hidden="true"></span><small>湿度</small><strong>${escapeHtml(formatDetailEnvironment(humidity, '%'))}</strong><em>${escapeHtml(spider.recommended_humidity || '')}</em></div>
                    <div class="is-substrate"><span aria-hidden="true"></span><small>床材・環境</small><strong>${escapeHtml(spider.substrate || '良好')}</strong><em>${escapeHtml(spider.enclosure || '')}</em></div>
                    <button type="button" class="is-check js-detail-open-profile-settings"><span aria-hidden="true"></span><small>最終環境チェック</small><strong>${escapeHtml(lastCheck || '記録なし')}</strong><em>詳細を見る</em></button>
                </div>
            </section>
        `;
    }

    function buildDetailGrowthStagePanel(spider, events) {
        const safeEvents = Array.isArray(events) ? events : [];
        const moltEvents = safeEvents.filter(function (event) { return String(event.type || '') === 'molt'; });
        const instar = Math.max(0, parseInt(spider.instar, 10) || 0);
        const completed = instar || moltEvents.length;
        const start = instar ? Math.max(1, instar - 3) : 1;
        const stepCount = 7;
        const steps = Array.from({ length: stepCount }, function (_, index) {
            const value = start + index;
            const active = instar ? value === instar : index === Math.max(0, Math.min(stepCount - 1, completed - 1));
            const done = instar ? value < instar : index < completed;
            return `<span class="${active ? 'is-current' : (done ? 'is-complete' : '')}"><i>${instar ? `L${value}` : value}</i><small>${active ? '現在' : (done ? '記録済' : '-')}</small></span>`;
        }).join('');
        const interval = detailAverageInterval(moltEvents, 'molt');
        const elapsed = detailDaysSince(spider.last_molt);
        const remaining = interval && elapsed !== null ? Math.max(0, interval - elapsed) : null;
        const forecast = remaining === null ? '記録が増えると予測できます' : (remaining === 0 ? '予測日を迎えています' : `次回目安まで約${remaining}日`);
        return `
            <section class="detail-data-panel detail-stage-panel">
                <header class="detail-panel-head">
                    <div><span class="detail-panel-kicker">GROWTH STAGE</span><h3>脱皮・成長ステージ</h3></div>
                    <span class="detail-stage-forecast">${escapeHtml(forecast)}</span>
                </header>
                <div class="detail-stage-track" aria-label="${escapeHtml(instar ? `現在L${instar}` : `脱皮記録${moltEvents.length}回`)}">${steps}</div>
                <div class="detail-stage-summary"><span>脱皮記録 <b>${escapeHtml(String(moltEvents.length))}回</b></span><span>平均間隔 <b>${interval ? `${interval}日` : '-'}</b></span><span>最終脱皮 <b>${escapeHtml(spider.last_molt || '-')}</b></span></div>
            </section>
        `;
    }

    function getDetailNextCare(spider, events) {
        if (spider.status === 'pre_molt') return { label: '脱皮前の観察', days: 0, type: 'note', note: '刺激を避けて様子を記録' };
        if (spider.status === 'post_molt') return { label: '脱皮後の確認', days: 0, type: 'note', note: '回復状態を確認' };
        if (spider.status === 'fasting') return { label: '拒食経過の確認', days: 0, type: 'feed', note: '腹部と反応を記録' };
        const interval = detailAverageInterval(events, 'feed') || (spider.classification === 'plant' ? 7 : 10);
        const elapsed = detailDaysSince(spider.last_feed);
        const days = spider.is_hungry ? 0 : (elapsed === null ? 0 : Math.max(0, interval - elapsed));
        return { label: spider.classification === 'plant' ? '水やり目安' : '給餌目安', days: days, type: 'feed', note: `平均${interval}日周期から算出` };
    }

    function buildDetailReminderPanel(spider, events) {
        const nextCare = getDetailNextCare(spider, events);
        const observationElapsed = detailDaysSince(spider.last_observation);
        const observationDays = observationElapsed === null ? 0 : Math.max(0, 7 - observationElapsed);
        const reminders = [
            { label: nextCare.label, days: nextCare.days, note: nextCare.note, type: nextCare.type },
            { label: '環境チェック', days: observationDays, note: '温湿度・給水・床材', type: 'note' }
        ];
        if (spider.last_molt) {
            reminders.push({ label: '成長の計測', days: 0, note: '脱皮後のサイズを残す', type: 'growth' });
        }
        return `
            <section class="detail-data-panel detail-reminder-panel">
                <header class="detail-panel-head"><div><span class="detail-panel-kicker">NEXT CARE</span><h3>次の予定</h3></div></header>
                <div class="detail-reminder-list">
                    ${reminders.map(function (item) {
                        return `<button type="button" class="js-detail-record" data-id="${escapeHtml(spider.id)}" data-type="${escapeHtml(item.type)}"><span><small>${escapeHtml(item.label)}</small><em>${escapeHtml(item.note)}</em></span><strong>${item.days > 0 ? `あと${item.days}日` : '今日'}</strong></button>`;
                    }).join('')}
                </div>
            </section>
        `;
    }

    function buildDetailHeatmapPanel(events) {
        const safeEvents = Array.isArray(events) ? events : [];
        const counts = {};
        safeEvents.forEach(function (event) {
            const key = String(event && event.date || '').slice(0, 10);
            if (key) counts[key] = (counts[key] || 0) + 1;
        });
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const days = Array.from({ length: 42 }, function (_, index) {
            const date = new Date(today);
            date.setDate(today.getDate() - (41 - index));
            const key = detailDayKey(date);
            const count = counts[key] || 0;
            const level = count === 0 ? 0 : Math.min(4, count);
            return `<i class="is-level-${level}" title="${escapeHtml(`${key} ${count}件`)}" aria-label="${escapeHtml(`${key} ${count}件`)}"></i>`;
        }).join('');
        const activeDays = Object.keys(counts).filter(function (key) {
            const date = detailDateFromValue(key);
            return date && (today.getTime() - date.getTime()) <= 41 * 86400000;
        }).length;
        return `
            <section class="detail-data-panel detail-heatmap-panel">
                <header class="detail-panel-head"><div><span class="detail-panel-kicker">42 DAYS</span><h3>ケアヒートマップ</h3></div><span class="detail-panel-count">${escapeHtml(String(activeDays))}日</span></header>
                <div class="detail-care-heatmap" role="img" aria-label="直近42日の記録密度">${days}</div>
                <div class="detail-heatmap-legend"><span>少</span><i></i><i></i><i></i><i></i><span>多</span></div>
            </section>
        `;
    }

    function getDetailEventIconClass(type) {
        const icons = {
            feed: 'dashicons-food',
            molt: 'dashicons-update',
            growth: 'dashicons-chart-line',
            pairing: 'dashicons-heart',
            observation: 'dashicons-edit',
            note: 'dashicons-edit'
        };
        return icons[String(type || '').toLowerCase()] || 'dashicons-edit';
    }

    function buildDetailRecentPanel(spider, events) {
        const safeEvents = (Array.isArray(events) ? events : []).slice().sort(function (a, b) {
            return String(b.date || '').localeCompare(String(a.date || ''));
        }).slice(0, 4);
        return `
            <section class="detail-data-panel detail-recent-panel">
                <header class="detail-panel-head"><div><span class="detail-panel-kicker">LATEST</span><h3>最新の記録</h3></div><button type="button" class="detail-inline-link js-detail-open-history">すべて見る</button></header>
                <div class="detail-recent-list">
                    ${safeEvents.length ? safeEvents.map(function (event) {
                        const parsed = parseDetailEventData(event);
                        const note = event.note || parsed.note || '';
                        return `<div><span class="dashicons ${escapeHtml(getDetailEventIconClass(event.type))}" aria-hidden="true"></span><strong>${escapeHtml(getDetailEventTypeLabel(event, spider.classification === 'plant'))}</strong><small>${escapeHtml(note || '記録を追加')}</small><time>${escapeHtml(event.date || '-')}</time></div>`;
                    }).join('') : '<p class="detail-dashboard-empty">最初の記録を追加すると、ここに時系列で表示されます。</p>'}
                </div>
            </section>
        `;
    }

    function buildDetailQuickActions(spider) {
        const isPlant = spider.classification === 'plant';
        const actions = [
            { type: 'feed', label: isPlant ? '水やり' : '給餌', icon: 'dashicons-food' },
            { type: 'note', label: '観察', icon: 'dashicons-visibility' },
            { type: 'molt', label: isPlant ? '植え替え' : '脱皮', icon: 'dashicons-update' },
            { type: 'growth', label: '計測', icon: 'dashicons-chart-line' },
            { type: 'note', label: 'メモ', icon: 'dashicons-welcome-write-blog' }
        ];
        return `
            <section class="detail-data-panel detail-quick-panel">
                <header class="detail-panel-head"><div><span class="detail-panel-kicker">QUICK ACTION</span><h3>すぐに記録</h3></div></header>
                <div class="detail-quick-grid">
                    ${actions.map(function (action) {
                        return `<button type="button" class="js-detail-record" data-id="${escapeHtml(spider.id)}" data-type="${escapeHtml(action.type)}"><span class="dashicons ${escapeHtml(action.icon)}" aria-hidden="true"></span><strong>${escapeHtml(action.label)}</strong><small>記録</small></button>`;
                    }).join('')}
                </div>
            </section>
        `;
    }

    function buildDetailNotesPanel(spider) {
        return `
            <section class="detail-data-panel detail-notes-panel">
                <header class="detail-panel-head"><div><span class="detail-panel-kicker">PROFILE NOTE</span><h3>個体メモ</h3></div><button type="button" class="detail-inline-link js-detail-open-profile-settings">編集</button></header>
                <p>${escapeHtml(spider.notes || '性格や飼育上の注意点を残しておくと、日々の判断に役立ちます。')}</p>
                <small>管理開始: ${escapeHtml(spider.acquired_date || spider.created_at || '-')}</small>
            </section>
        `;
    }

    function renderDetailOperationalDashboard(spider, events, options = {}) {
        const safeEvents = Array.isArray(events) ? events : [];
        renderDetailHeroProfile(spider, safeEvents);
        $('#detail-condition-slot').html(buildDetailConditionPanel(spider, safeEvents));
        $('#detail-feeding-slot').html(buildDetailFeedingPanel(spider, safeEvents));
        $('#detail-weekly-slot').html(buildDetailWeeklyPanel(safeEvents));
        $('#detail-stage-slot').html(buildDetailGrowthStagePanel(spider, safeEvents));
        $('#detail-reminder-slot').html(buildDetailReminderPanel(spider, safeEvents));
        $('#detail-heatmap-slot').html(buildDetailHeatmapPanel(safeEvents));
        $('#detail-recent-slot').html(buildDetailRecentPanel(spider, safeEvents));
        if (options.error) {
            $('#detail-heatmap-slot, #detail-recent-slot').addClass('is-data-error');
        }
    }

    function syncDetailSpiderCache(spider) {
        if (!spider || !spider.id || !SetaeCore.state) return;

        const spiders = Array.isArray(SetaeCore.state.cachedSpiders)
            ? SetaeCore.state.cachedSpiders
            : [];
        const index = spiders.findIndex(function (item) {
            return String(item.id || '') === String(spider.id);
        });

        if (spider.archived) {
            if (index >= 0) {
                spiders.splice(index, 1);
            }
            SetaeCore.state.cachedSpiders = spiders;
            return;
        }

        if (index >= 0) {
            spiders[index] = Object.assign({}, spiders[index], spider);
        } else {
            spiders.push(spider);
        }

        SetaeCore.state.cachedSpiders = spiders;
    }

    function updateDetailNavigation(id) {
        const $nav = $('#setae-detail-nav');
        if (!$nav.length || !window.SetaeUIList || !SetaeUIList.getAdjacentSpider) return;

        const state = SetaeUIList.getAdjacentSpider(id);
        if (!state || state.total <= 1 || state.index < 0) {
            $nav.hide();
            return;
        }

        const position = `${state.index + 1} / ${state.total}`;
        $('#setae-detail-nav-position').text(position);

        const $prev = $nav.find('.js-detail-nav[data-direction="prev"]');
        const $next = $nav.find('.js-detail-nav[data-direction="next"]');

        $prev.prop('disabled', !state.prev)
            .attr('title', state.prev ? getSpiderDisplayName(state.prev) : '前の個体はありません')
            .data('target-id', state.prev ? state.prev.id : '');
        $next.prop('disabled', !state.next)
            .attr('title', state.next ? getSpiderDisplayName(state.next) : '次の個体はありません')
            .data('target-id', state.next ? state.next.id : '');

        $nav.show();
    }

    function handleDetailNavClick(e) {
        e.preventDefault();
        e.stopPropagation();

        if ($(this).prop('disabled')) return;

        const direction = $(this).data('direction') || '';
        const targetId = $(this).data('target-id');
        if (!targetId) return;

        if (typeof SetaeCore.track === 'function') {
            SetaeCore.track('detail_spider_nav_click', {
                direction: direction
            });
        }

        loadSpiderDetail(targetId);
    }

    function handleDetailRecordClick(e) {
        e.preventDefault();
        e.stopPropagation();

        const id = $(this).data('id') || currentSpiderId;
        const type = $(this).data('type') || 'note';
        if (!id || typeof SetaeUILogModal === 'undefined' || !SetaeUILogModal.openLogModal) return;

        SetaeUILogModal.openLogModal(id, type);
        if (typeof SetaeCore.track === 'function') {
            SetaeCore.track('detail_dashboard_record_click', {
                type: type
            });
        }
    }

    function handleDetailHistoryOpen(e) {
        e.preventDefault();
        e.stopPropagation();
        activateDetailTab('tab-history', true);
    }

    function handleDetailFavorite(e) {
        e.preventDefault();
        e.stopPropagation();
        if (!currentSpiderId || !SetaeAPI.setSpiderFavorite) return;

        const $button = $(this);
        if ($button.prop('disabled')) return;
        const cached = (SetaeCore.state.cachedSpiders || []).find(function (item) {
            return String(item.id) === String(currentSpiderId);
        }) || { id: currentSpiderId, is_favorite: $button.hasClass('is-active') };
        const nextStatus = !cached.is_favorite;
        $button.prop('disabled', true).addClass('is-saving');

        SetaeAPI.setSpiderFavorite(currentSpiderId, nextStatus, function (response) {
            const savedStatus = response && Object.prototype.hasOwnProperty.call(response, 'is_favorite')
                ? !!response.is_favorite
                : nextStatus;
            cached.is_favorite = savedStatus;
            syncDetailSpiderCache(cached);
            renderDetailHeroProfile(cached, cached.history || []);
            if (window.SetaeUIList && SetaeUIList.updateSpiderCard) {
                SetaeUIList.updateSpiderCard(currentSpiderId, { is_favorite: savedStatus });
            }
            $button.prop('disabled', false).removeClass('is-saving');
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

    function handleCareFocusDismiss(e) {
        e.preventDefault();
        e.stopPropagation();

        const $focus = $(this).closest('.detail-care-focus');
        if (!$focus.length) return;

        confirmDetailAction({
            title: '「今日の飼育」を閉じる',
            message: 'この画面だけ閉じるか、今後すべての個体で表示しないかを選べます。',
            confirmLabel: '今後は表示しない',
            cancelLabel: '今回は閉じる'
        }).then(function (hideNextTime) {
            $focus.addClass('is-dismissing').attr('aria-hidden', 'true');
            window.setTimeout(function () { $focus.remove(); }, 180);

            if (!hideNextTime) {
                if (typeof SetaeCore.track === 'function') {
                    SetaeCore.track('detail_care_focus_dismiss_once');
                }
                return;
            }

            const savePreference = window.SetaeUIProfile
                && typeof SetaeUIProfile.saveCareFocusPreference === 'function'
                ? SetaeUIProfile.saveCareFocusPreference(false)
                : Promise.resolve(
                    typeof SetaeCore.setCareFocusPreference === 'function'
                        ? SetaeCore.setCareFocusPreference(false, true)
                        : false
                );

            savePreference.then(function () {
                SetaeCore.showToast('「今日の飼育」を非表示にしました。表示設定から戻せます。', 'success');
                if (typeof SetaeCore.track === 'function') {
                    SetaeCore.track('detail_care_focus_disabled');
                }
            }).catch(function () {
                if (typeof SetaeCore.setCareFocusPreference === 'function') {
                    SetaeCore.setCareFocusPreference(true, true);
                }
                SetaeCore.showToast('表示設定を保存できませんでした', 'error');
            });
        });
    }

    // Tab Event Listener (Delegated)
    $(document).on('click', '.setae-detail-tabs .tab-btn', function () {
        activateDetailTab($(this).data('target'), true);
    });
    $(document).on('keydown', '.setae-detail-tabs .tab-btn', function (e) {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;

        const $tabs = $(this).closest('.setae-detail-tabs').find('.tab-btn:visible');
        const currentIndex = $tabs.index(this);
        if (currentIndex < 0 || !$tabs.length) return;

        let nextIndex = currentIndex;
        if (e.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + $tabs.length) % $tabs.length;
        if (e.key === 'ArrowRight') nextIndex = (currentIndex + 1) % $tabs.length;
        if (e.key === 'Home') nextIndex = 0;
        if (e.key === 'End') nextIndex = $tabs.length - 1;

        e.preventDefault();
        const $next = $tabs.eq(nextIndex);
        activateDetailTab($next.data('target'), true);
        $next.trigger('focus');
    });
    $(document).on('click', '.js-detail-nav', handleDetailNavClick);
    $(document).on('click', '.js-detail-record', handleDetailRecordClick);
    $(document).on('click', '#btn-detail-favorite', handleDetailFavorite);
    $(document).on('click', '.js-detail-open-profile-settings', function (e) {
        e.preventDefault();
        e.stopPropagation();
        $('#btn-edit-spider-trigger').trigger('click');
    });
    $(document).on('click', '.js-detail-care-focus-dismiss', handleCareFocusDismiss);
    $(document).on('click', '.js-detail-open-history', handleDetailHistoryOpen);
    $(document).on('click', '.js-detail-album-open', handleDetailAlbumOpen);
    $(document).on('click', '.js-detail-album-more', handleDetailAlbumMore);
    $(document).on('click', '.js-detail-album-close', closeDetailAlbumViewer);
    $(document).on('click', '#setae-detail-album-viewer', handleDetailAlbumBackdrop);
    $(document).on('click', '.js-detail-album-prev', function () {
        if (!$(this).prop('disabled')) showDetailAlbumItem(detailAlbumIndex - 1);
    });
    $(document).on('click', '.js-detail-album-next', function () {
        if (!$(this).prop('disabled')) showDetailAlbumItem(detailAlbumIndex + 1);
    });
    $(document).on('touchstart.setaeDetailAlbum', '#setae-detail-album-viewer', handleDetailAlbumTouchStart);
    $(document).on('touchend.setaeDetailAlbum', '#setae-detail-album-viewer', handleDetailAlbumTouchEnd);
    $(document).on('keydown.setaeDetailAlbum', handleDetailAlbumKeydown);
    function loadSpiderDetail(id) {
        rememberMyListScrollPosition();
        currentSpiderId = id;
        closeDetailAlbumViewer();
        detailAlbumItems = [];

        // ★追加: 前回のHTML要素(絵文字)が残らないよう empty() で中身も消去
        $('#section-my-detail .hero-backdrop').css('background-image', 'none').css('background-color', 'transparent').empty();
        $('#detail-spider-name').text('読み込み中...').removeAttr('title');
        $('#detail-topbar-title').text('個体カルテ');
        $('#detail-spider-species').text('-').removeAttr('title');
        $('#detail-spider-id-badge').text(`#${id}`);
        $('#detail-hero-molt-label').text('最終脱皮');
        $('#detail-hero-feed-label').text('最終給餌');
        $('#detail-hero-molt, #detail-hero-feed, #detail-hero-status').text('-');

        SetaeAPI.getSpiderDetail(id, function (spider) {
            renderSpiderDetailSection(spider);
        }, function (xhr) {
            const message = SetaeCore.getErrorMessage
                ? SetaeCore.getErrorMessage(xhr, '個体の詳細を読み込めませんでした。')
                : '個体の詳細を読み込めませんでした。';
            SetaeCore.showToast(message, 'error');
        });
    }

    function renderSpiderDetailSection(spider) {
        if (typeof SetaeCore.normalizeSpiderDisplayFields === 'function') {
            spider = SetaeCore.normalizeSpiderDisplayFields(spider);
        }
        currentClassification = spider.classification || 'tarantula'; // ★分類を保存
        syncDetailSpiderCache(spider);

        if (!spider.archived && window.SetaeUIList && SetaeUIList.rememberLastSpider) {
            SetaeUIList.rememberLastSpider(spider);
        }

        const $heroBackdrop = $('#section-my-detail .hero-backdrop');
        let imgUrl = spider.image_url || spider.thumb || spider.src || spider.full_image;

        // ★追加: 万が一APIから文字列の 'false' や 'null' が返ってきた場合の誤表示を防ぐ
        if (imgUrl === 'false' || imgUrl === 'null' || imgUrl === false) {
            imgUrl = null;
        }

        if (imgUrl) {
            $heroBackdrop.css('background-image', `url('${imgUrl}')`);
            $heroBackdrop.css('background-color', 'transparent');
            $heroBackdrop.empty(); // 実画像がある場合は中の要素をクリア
        } else {
            let fallbackAsset = 'spider-silhouette.svg';
            switch (currentClassification) {
                case 'plant': fallbackAsset = 'plant.svg'; break;
                case 'scorpion': fallbackAsset = 'scorpion.svg'; break;
                case 'insect': fallbackAsset = 'insect.svg'; break;
                case 'reptile':
                case 'other': fallbackAsset = 'generic-specimen.svg'; break;
                case 'tarantula':
                default: fallbackAsset = 'spider-silhouette.svg'; break;
            }
            const pluginUrl = (typeof SetaeSettings !== 'undefined' && SetaeSettings.plugin_url)
                ? String(SetaeSettings.plugin_url).replace(/\/$/, '')
                : '/wp-content/plugins/setae-core';
            const fallbackUrl = `${pluginUrl}/assets/images/specimen/${fallbackAsset}`;

            // ★修正: background-image ではなく、HTML要素として直接埋め込む
            $heroBackdrop.css('background-image', 'none');
            $heroBackdrop.css('background-color', '#f1f5f9');
            $heroBackdrop.html(`
                <div class="detail-hero-fallback">
                    <img src="${fallbackUrl}" alt="画像なし">
                </div>
            `);
        }

        // Basic Info & Dates
        const spiderDisplayName = spider.title || spider.nickname || spider.species || '不明';
        const spiderSpeciesName = spider.species_name || spider.scientific_name || '種類不明';
        const heroPrimaryName = spiderSpeciesName && spiderSpeciesName !== '種類不明'
            ? spiderSpeciesName
            : spiderDisplayName;
        const heroSecondaryName = heroPrimaryName === spiderDisplayName ? '個体カルテ' : spiderDisplayName;
        $('#detail-spider-name').text(heroPrimaryName).attr('title', heroPrimaryName);
        $('#detail-topbar-title').text(spiderDisplayName).attr('title', spiderDisplayName);
        $('#detail-spider-species').text(heroSecondaryName).attr('title', heroSecondaryName);
        $('#detail-spider-id-badge').text(spider.qr_code ? spider.qr_code.toUpperCase() : `#${spider.id}`);
        $heroBackdrop.attr('aria-label', `${spiderDisplayName}の写真`);
        renderDetailHeroProfile(spider, Array.isArray(spider.history) ? spider.history : []);

        // --- Tabs Implementation (Refactored for Static HTML) ---
        // Do not empty container as it holds the static panel structure now.
        // Just manage visibility of the Settings tab.

        const $settingsBtn = $('#btn-tab-settings');
        if (String(spider.owner_id) === String(SetaeCore.state.currentUserId)) {
            $settingsBtn.show();
            renderDetailSettings(spider);
        } else {
            $settingsBtn.hide();
        }

        // --- Tab 1: Overview (Status + Charts) ---
        // Helper for cycle color
        const statusMap = {
            'normal': { label: setaeI18n.status_normal || '通常', color: '#2c3e50' },
            'fasting': { label: setaeI18n.status_fasting || '拒食中', color: '#d35400' },
            'pre_molt': { label: setaeI18n.status_pre_molt || '脱皮前', color: '#c0392b' },
            'post_molt': { label: setaeI18n.status_post_molt || '脱皮後', color: '#2980b9' },
        };
        const st = statusMap[spider.status] || statusMap['normal'];

        // Determine labels based on classification
        const isPlant = (currentClassification === 'plant');
        const labelMolt = isPlant ? (setaeI18n.last_repot || "最終植え替え") : (setaeI18n.last_molt || "最終脱皮");
        const labelFeed = isPlant ? (setaeI18n.last_water || "最終水やり") : (setaeI18n.last_feed || "最終給餌");

        // Keep the three highest-value care facts visible in the compact header.
        $('#detail-hero-molt-label').text(labelMolt);
        $('#detail-hero-feed-label').text(labelFeed);
        renderDetailHeroDate('#detail-hero-molt', spider.last_molt);
        renderDetailHeroDate('#detail-hero-feed', spider.last_feed);
        $('#detail-hero-status').text(st.label);

        const overviewHtml = `
            <main class="setae-detail-workspace">
                ${spider.archived ? renderDetailArchiveNotice(spider) : renderDetailCareFocus(spider, st)}

                <div id="detail-condition-slot" class="detail-dashboard-slot">${buildDetailConditionPanel(spider, spider.history || [])}</div>
                ${buildDetailEnvironmentPanel(spider)}
                <div id="detail-feeding-slot" class="detail-dashboard-slot">${buildDetailFeedingPanel(spider, spider.history || [])}</div>
                <div id="detail-stage-slot" class="detail-dashboard-slot">${buildDetailGrowthStagePanel(spider, spider.history || [])}</div>
                <div id="detail-weekly-slot" class="detail-dashboard-slot">${buildDetailWeeklyPanel(spider.history || [])}</div>

                <div id="detail-activity-insights" class="detail-activity-slot" aria-live="polite">
                    ${buildDetailActivityInsights(spider, null)}
                </div>
                <div id="detail-heatmap-slot" class="detail-dashboard-slot">${buildDetailHeatmapPanel(spider.history || [])}</div>
                <div id="detail-reminder-slot" class="detail-dashboard-slot">${buildDetailReminderPanel(spider, spider.history || [])}</div>
                <div id="detail-recent-slot" class="detail-dashboard-slot">${buildDetailRecentPanel(spider, spider.history || [])}</div>
                ${buildDetailNotesPanel(spider)}
                ${buildDetailQuickActions(spider)}

                <section class="detail-data-panel detail-photo-panel">
                    <header class="detail-panel-head">
                        <div>
                            <span class="detail-panel-kicker">アルバム</span>
                            <h3>記録写真</h3>
                        </div>
                        <span id="detail-photo-count" class="detail-panel-count">-</span>
                    </header>
                    <div id="detail-photo-album" aria-live="polite">
                        <div class="detail-photo-empty is-loading">写真を読み込んでいます</div>
                    </div>
                </section>

                <section class="detail-data-panel detail-growth-panel">
                    <header class="detail-panel-head">
                        <div>
                            <span class="detail-panel-kicker">サイズ</span>
                            <h3>${escapeHtml(setaeI18n.growth_log || '成長記録')}</h3>
                        </div>
                        <div id="detail-growth-summary" class="detail-panel-summary" aria-live="polite"><span>-</span></div>
                    </header>
                    <div class="chart-container detail-growth-chart">
                        <canvas id="growthChart" role="img" aria-label="サイズの変化を表す成長グラフ"></canvas>
                    </div>
                </section>

                ${!isPlant ? `
                <section class="detail-data-panel detail-prey-panel">
                    <header class="detail-panel-head">
                        <div>
                            <span class="detail-panel-kicker">給餌</span>
                            <h3>${escapeHtml(setaeI18n.prey_preferences || '餌の傾向')}</h3>
                        </div>
                        <span id="detail-prey-summary" class="detail-panel-count">-</span>
                    </header>
                    <div class="chart-container detail-prey-chart">
                        <canvas id="preyChart" role="img" aria-label="餌の種類別割合"></canvas>
                    </div>
                </section>` : ''}

                ${renderDetailConsultAction(spider)}
            </main>
        `;
        $('#tab-overview').html(overviewHtml);

        // --- Tab 2: History (Timeline) ---
        const historyHtml = `
            <div class="setae-timeline-section" style="margin-top:0;">
                <header class="detail-history-header">
                    <div>
                        <span>CARE HISTORY</span>
                        <h2>すべての記録</h2>
                    </div>
                    <small>新しい順</small>
                </header>
                <div id="setae-log-list" class="timeline-container"></div>
                <div id="log-sentinel"></div>
            </div>
        `;
        $('#tab-history').html(historyHtml);
        activateDetailTab(getSavedDetailTab(), false);

        // renderBLSettingsCard called above


        // --- Tab Switch Event ---
        // Moved to top-level delegation to prevent multiple bindings

        // Load Logs (Render to #setae-log-list)
        loadSpiderLogs(spider.id, spider);

        // Setup FAB
        setupFabButton(spider);

        // Remove old elements if any remain
        $('.section-calendar').remove();

        // Show Section
        const $detailSection = $('#section-my-detail');
        if ($detailSection.is(':visible')) {
            $detailSection.css('display', 'grid');
            resetDetailViewport();
        } else {
            $('#section-my').hide();
            $detailSection.stop(true, true).css({ opacity: 0, display: 'grid' });
            resetDetailViewport();
            $detailSection.animate({ opacity: 1 }, 160, function () {
                $(this).css('opacity', '');
            });
        }
        updateDetailNavigation(spider.id);
        setupDetailStickyStack();
    }

    // ★ Helper: FAB Button (Moved out to function)
    function setupFabButton(spider) {
        $('#btn-add-log').remove();
        const $target = $('#setae-detail-primary-actions');
        $target.empty();
        if (spider && spider.archived) {
            return;
        }
        const focus = getDetailCareFocus(spider || {});
        const fabBtnHtml = `
            <button type="button" id="btn-add-log" class="setae-fab-record" data-id="${escapeHtml(spider && spider.id ? spider.id : '')}" data-type="${escapeHtml(focus.recordType || 'note')}" aria-label="記録を追加">
                <span class="fab-icon" aria-hidden="true">+</span>
                <span class="fab-text">記録を追加</span>
            </button>
        `;
        if ($target.length) {
            $target.html(fabBtnHtml);
        } else {
            $('#section-my-detail').append(fabBtnHtml);
        }
    }


    function getRelativeDateLabel(dateStr) {
        if (!dateStr) return '-';

        // ハイフンをスラッシュに置換してローカル時間としてパースさせる (UTCズレ防止とiOS Safari対策)
        const safeDateStr = dateStr.replace(/-/g, '/');
        const d = new Date(safeDateStr);
        d.setHours(0, 0, 0, 0); // 時間を0時にリセット

        const now = new Date();
        now.setHours(0, 0, 0, 0); // 現在時刻も0時にリセットして純粋な「日付」の差分をとる

        const diffTime = Math.abs(now - d);
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)); // 切り上げ(ceil)ではなく切り捨て(floor)で日数化

        if (diffDays === 0) return setaeI18n.today || '今日';
        if (diffDays === 1) return setaeI18n.yesterday || '昨日';
        if (diffDays <= 30) return diffDays + (setaeI18n.days_ago || '日前');
        if (diffDays <= 365) return Math.floor(diffDays / 30) + (setaeI18n.months_ago || 'ヶ月前');
        return d.getFullYear().toString();
    }

    function loadSpiderLogs(id, spider) {
        const requestedId = String(id || '');
        const resolveDetailSpider = function () {
            if (spider && spider.id) return spider;
            const cached = SetaeCore.state && Array.isArray(SetaeCore.state.cachedSpiders)
                ? SetaeCore.state.cachedSpiders
                : [];
            return cached.find(function (item) {
                return String(item && item.id ? item.id : '') === requestedId;
            }) || { id: id };
        };

        $('#setae-log-list').attr('aria-busy', 'true').html(`
            <div class="setae-view-state" role="status">
                <span class="setae-view-state-mark" aria-hidden="true"></span>
                <strong>飼育記録を読み込んでいます</strong>
            </div>
        `);

        SetaeAPI.getSpiderEvents(id, function (events) {
                if (requestedId && currentSpiderId && String(currentSpiderId) !== requestedId) return;
                $('#setae-log-list').removeAttr('aria-busy');
                events = Array.isArray(events) ? events : [];
                const detailSpider = resolveDetailSpider();
                renderDetailActivityInsights(detailSpider, events);
                renderDetailPhotoAlbum(events, detailSpider);
                renderDetailOperationalDashboard(detailSpider, events);

                if (typeof renderGrowthChart === 'function') renderGrowthChart(events);
                if (typeof renderPreyChart === 'function') renderPreyChart(events);

                const listContainer = $('#setae-log-list');
                const sentinel = $('#log-sentinel');
                listContainer.empty();
                sentinel.empty();

                const wrapper = $('<div class="setae-timeline-wrapper"></div>');
                listContainer.append(wrapper);

                let currentOffset = 0;
                const BATCH_SIZE = 15;
                const totalEvents = events.length;
                let lastDateLabel = null;

                if (totalEvents === 0) {
                    listContainer.html('<div class="setae-card" style="text-align:center; padding:30px; background:none; box-shadow:none;"><p style="color:#999;">まだ記録はありません。</p></div>');
                    return;
                }

                renderBatch();

                if (totalEvents > BATCH_SIZE) {
                    const observer = new IntersectionObserver((entries) => {
                        if (entries[0].isIntersecting && currentOffset < totalEvents) {
                            sentinel.html('<div class="spinner" style="padding:20px; text-align:center; color:#ccc;">読み込み中...</div>');
                            setTimeout(() => {
                                renderBatch();
                                if (currentOffset >= totalEvents) {
                                    sentinel.html('<div class="end-of-log" style="padding:20px; text-align:center; color:#eee;">ここまでの記録を表示しました</div>');
                                    observer.unobserve(sentinel[0]);
                                } else {
                                    sentinel.empty();
                                }
                            }, 500);
                        }
                    }, { rootMargin: '200px' });
                    if (sentinel.length) observer.observe(sentinel[0]);
                } else {
                    sentinel.html('<div class="end-of-log" style="padding:20px; text-align:center; color:#eee;">ここまでの記録を表示しました</div>');
                }

                function renderBatch() {
                    const batch = events.slice(currentOffset, currentOffset + BATCH_SIZE);
                    currentOffset += BATCH_SIZE;

                    batch.forEach(e => {
                        const currentDateLabel = getRelativeDateLabel(e.date);
                        if (currentDateLabel !== lastDateLabel) {
                            const isToday = currentDateLabel === setaeI18n.today;
                            wrapper.append(`
                                <div class="timeline-date-label ${isToday ? 'is-today' : ''}">
                                    <span>${currentDateLabel}</span>
                                </div>`);
                            lastDateLabel = currentDateLabel;
                        }

                        let iconChar = '📝';
                        let nodeClass = 'node-default';
                        let displayMeta = '';
                        let isRefused = false;

                        let parsedData = {};
                        try {
                            if (typeof e.data === 'string' && e.data.trim().length > 0) {
                                parsedData = JSON.parse(e.data);
                                if (parsedData.source === 'baby_group') {
                                    displayMeta += ' <span class="timeline-source-badge">ベビー期</span>';
                                }
                                if (parsedData.prey_type) {
                                    const preyNameMap = {
                                        'Fruit Fly': 'ショウジョウバエ',
                                        'Fruit Fly (ショウジョウバエ)': 'ショウジョウバエ',
                                        'Cricket': 'コオロギ',
                                        'Cricket (コオロギ)': 'コオロギ',
                                        'Red Roach': 'レッドローチ',
                                        'Red Roach (レッドローチ)': 'レッドローチ',
                                        'Dubia': 'デュビア',
                                        'Dubia (デュビア)': 'デュビア',
                                        'Pinky': 'ピンキー',
                                        'Pinky (ピンキー)': 'ピンキー'
                                    };
                                    displayMeta += ` ${preyNameMap[parsedData.prey_type] || parsedData.prey_type}`;
                                }
                                if (parsedData.refused) {
                                    isRefused = true;
                                    // ★変更: REFUSED を日本語化
                                    displayMeta += ` <span style="color:#e74c3c; font-weight:bold; font-size:11px;">(${setaeI18n.refused || '拒食'})</span>`;
                                }
                                if (e.type === 'growth' && parsedData.size) displayMeta += ` <b style="color:#3498db;">${parsedData.size}cm</b>`;
                                if (e.type === 'observation' && parsedData.label) displayMeta += ` ${parsedData.label}`;
                            }
                        } catch (err) { }

                        const typeKey = (e.type || '').toLowerCase();
                        let typeLabel = e.type.toUpperCase(); // ラベル用変数を用意

                        // ▼ 追加: 植物判定
                        const isPlant = (currentClassification === 'plant');

                        // ★変更: typeLabel に setaeI18n オブジェクトの翻訳を割り当てる
                        if (typeKey === 'feed') {
                            if (isPlant) {
                                iconChar = '💧'; // Water
                                nodeClass = 'node-growth'; // 青系クラスを流用
                                typeLabel = setaeI18n.water || '水やり';
                                if (displayMeta) displayMeta = displayMeta.replace('Cricket', '').replace('Dubia', '').replace('コオロギ', '').replace('デュビア', ''); // デフォルト値を消す
                            } else {
                                iconChar = isRefused ? '✕' : '🦗';
                                nodeClass = isRefused ? 'node-refused' : 'node-feed';
                                typeLabel = setaeI18n.feed || '給餌';
                            }
                        } else if (typeKey === 'molt') {
                            if (isPlant) {
                                iconChar = '🪴'; // Repot
                                nodeClass = 'node-molt';
                                typeLabel = setaeI18n.repot || '植え替え';
                            } else {
                                iconChar = '🧬';
                                nodeClass = 'node-molt';
                                typeLabel = setaeI18n.molt || '脱皮';
                            }
                        } else if (typeKey === 'growth') {
                            iconChar = '📏';
                            nodeClass = 'node-growth';
                            typeLabel = setaeI18n.growth || '成長記録';
                        } else if (typeKey === 'pairing') {
                            iconChar = '↔';
                            nodeClass = 'node-note';
                            typeLabel = 'ペアリング';
                        } else if (typeKey === 'observation') {
                            iconChar = '✓';
                            nodeClass = 'node-note';
                            typeLabel = setaeI18n.observation || '観察';
                        } else if (typeKey === 'note' || typeKey === 'memo') {
                            iconChar = '📝';
                            nodeClass = 'node-note';
                            typeLabel = setaeI18n.note || 'メモ';
                        } else {
                            iconChar = '📝';
                            nodeClass = 'node-note';
                        }

                        const eventImage = e.image || parsedData.image || '';
                        const albumIndex = eventImage ? detailAlbumItems.findIndex(function (item) {
                            return (e.id && String(item.id) === String(e.id)) || item.url === eventImage;
                        }) : -1;
                        const albumAlt = `${e.date ? e.date + ' ' : ''}${typeLabel}の記録写真`;
                        const imageHtml = eventImage
                            ? (albumIndex >= 0
                                ? `<button type="button" class="timeline-image-button js-detail-album-open" data-album-index="${albumIndex}" aria-label="${escapeHtml(albumAlt)}を表示">
                                     <img src="${escapeHtml(eventImage)}" alt="${escapeHtml(albumAlt)}" loading="lazy">
                                   </button>`
                                : `<div class="timeline-image-button is-static"><img src="${escapeHtml(eventImage)}" alt="${escapeHtml(albumAlt)}" loading="lazy"></div>`)
                            : '';

                        const noteText = e.note || parsedData.note || '';
                        const noteHtml = noteText && noteText.trim() !== ''
                            ? `<div class="timeline-note-content">${escapeHtml(noteText)}</div>`
                            : '';

                        const listRow = `
                            <div class="timeline-item log-card-animate">
                                <div class="timeline-node ${nodeClass}">${iconChar}</div>
                                <div class="timeline-content">
                                    <button type="button" class="btn-delete-log" data-id="${escapeHtml(e.id)}" aria-label="${escapeHtml(e.date || '')}の記録を削除" title="削除">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                            <polyline points="3 6 5 6 21 6"></polyline>
                                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2-2v2"></path>
                                        </svg>
                                    </button>
                                    <div class="timeline-card">
                                    <div class="timeline-card-header">
                                        <div class="timeline-card-title">
                                            ${typeLabel} <span class="timeline-card-subtitle">${displayMeta}</span>
                                        </div>
                                        <div class="timeline-card-date">${e.date}</div>
                                    </div>
                                        ${imageHtml}  ${noteHtml} 
                                    </div>
                                </div>
                            </div>
                        `;
                        wrapper.append(listRow);
                    });
                }
            }, function (xhr) {
                if (requestedId && currentSpiderId && String(currentSpiderId) !== requestedId) return;
                const detailSpider = resolveDetailSpider();
                renderDetailActivityInsights(detailSpider, [], { error: true });
                renderDetailPhotoAlbum([], detailSpider, { error: true });
                renderDetailOperationalDashboard(detailSpider, [], { error: true });
                if (typeof renderGrowthChart === 'function') renderGrowthChart([]);
                if (typeof renderPreyChart === 'function') renderPreyChart([]);
                const message = SetaeCore.getErrorMessage
                    ? SetaeCore.getErrorMessage(xhr, '通信状態を確認して、もう一度お試しください。')
                    : '通信状態を確認して、もう一度お試しください。';
                $('#setae-log-list').removeAttr('aria-busy').html(`
                    <div class="setae-view-state is-error" role="alert">
                        <span class="setae-view-state-mark" aria-hidden="true"></span>
                        <strong>飼育記録を読み込めませんでした</strong>
                        <p>${escapeHtml(message)}</p>
                        <button type="button" class="js-retry-detail-logs" data-id="${escapeHtml(id)}">もう一度読み込む</button>
                    </div>
                `);
            });
    }

    $(document).on('click', '.js-retry-detail-logs', function (e) {
        e.preventDefault();
        const id = $(this).data('id') || currentSpiderId;
        if (id) loadSpiderLogs(id);
    });

    // Delete Log Event Handler
    $(document).on('click', '.btn-delete-log', function (e) {
        e.preventDefault();
        e.stopPropagation();
        const id = $(this).data('id');
        const $item = $(this).closest('.timeline-item');
        const $button = $(this);
        if (!id || $button.prop('disabled')) return;

        confirmDetailAction({
            title: '記録を削除',
            message: 'この飼育記録を削除します。写真がある場合は写真も一覧から消えます。',
            confirmLabel: '削除する',
            tone: 'danger'
        }).then(function (confirmed) {
            if (!confirmed || !document.contains($button[0])) return;

            $button.prop('disabled', true).attr('aria-busy', 'true');
            const request = SetaeAPI.deleteLog(id, function () {
                $item.fadeOut(220, function () {
                    $(this).remove();
                    if (currentSpiderId) loadSpiderLogs(currentSpiderId);
                });
                SetaeCore.showToast('記録を削除しました', 'success');
            }, function (xhr) {
                $button.prop('disabled', false).removeAttr('aria-busy');
                SetaeCore.showToast(SetaeCore.getErrorMessage
                    ? SetaeCore.getErrorMessage(xhr, '記録を削除できませんでした。')
                    : '記録を削除できませんでした。', 'error');
            });

            if (request && request.always) {
                request.always(function () {
                    if (document.contains($button[0])) {
                        $button.prop('disabled', false).removeAttr('aria-busy');
                    }
                });
            }
        });
    });

    /**
     * Helper to toggle chart data state
     */
    function toggleChartDataState(canvasId, hasData) {
        const $canvas = $('#' + canvasId);
        const $container = $canvas.parent();

        $container.find('.chart-no-data').remove();

        if (hasData) {
            $canvas.removeClass('chart-hidden');
        } else {
            $canvas.addClass('chart-hidden');
            const noDataHtml = `
                <div class="chart-no-data">
                    <strong>-</strong>
                    <span>記録がまだありません</span>
                </div>
            `;
            $container.append(noDataHtml);
        }
    }

    function formatDetailSize(value) {
        const number = parseFloat(value);
        if (!Number.isFinite(number)) return '-';
        return Number.isInteger(number) ? String(number) : number.toFixed(1);
    }

    function formatDetailChartDate(dateString) {
        const parts = String(dateString || '').split('-');
        if (parts.length !== 3) return dateString || '-';
        return `${parseInt(parts[1], 10)}/${parseInt(parts[2], 10)}`;
    }

    /**
     * 成長グラフと脱皮履歴テーブルを描画
     */
    function renderGrowthChart(logs) {
        const ctx = document.getElementById('growthChart');
        if (!ctx) return;

        const $container = $(ctx).closest('.chart-container');

        // 既存のテーブルを削除 (初期化)
        $container.find('.molt-history-container').remove();
        $container.next('.molt-history-container').remove();

        // 2. データの準備（サイズ記録があるログのみ抽出・パース）
        const sizeLogs = logs.map(l => {
            let sizeVal = 0;
            if (l.size) {
                sizeVal = parseFloat(l.size);
            } else if (l.data) {
                try {
                    const d = typeof l.data === 'string' ? JSON.parse(l.data) : l.data;
                    if (d.size) sizeVal = parseFloat(d.size);
                } catch (e) { }
            }
            return { ...l, sizeVal: sizeVal };
        })
            .filter(l => l.sizeVal > 0)
            .sort((a, b) => new Date(a.date) - new Date(b.date));

        // ★追加: データ有無による表示切り替え
        const hasData = sizeLogs.length > 0;
        toggleChartDataState('growthChart', hasData);

        const $summary = $('#detail-growth-summary');
        if (hasData) {
            const firstSize = sizeLogs[0].sizeVal;
            const latestSize = sizeLogs[sizeLogs.length - 1].sizeVal;
            const delta = latestSize - firstSize;
            const deltaHtml = sizeLogs.length > 1
                ? `<em class="${delta > 0 ? 'is-positive' : (delta < 0 ? 'is-negative' : 'is-neutral')}">${delta > 0 ? '+' : ''}${formatDetailSize(delta)} cm</em>`
                : '';
            $summary.html(`<strong>${formatDetailSize(latestSize)}</strong><span>cm</span>${deltaHtml}`);
        } else {
            $summary.html('<span>サイズ記録なし</span>');
        }

        // 3. チャート描画 (Chart.js)
        if (typeof Chart !== 'undefined' && window.setaeGrowthChart instanceof Chart) {
            window.setaeGrowthChart.destroy();
        }

        if (hasData && typeof Chart !== 'undefined') {
            const chartContext = ctx.getContext('2d');
            const chartGradient = chartContext.createLinearGradient(0, 0, 0, 300);
            chartGradient.addColorStop(0, 'rgba(15, 118, 110, 0.24)');
            chartGradient.addColorStop(1, 'rgba(15, 118, 110, 0.01)');
            const values = sizeLogs.map(l => l.sizeVal);
            const minValue = Math.min.apply(null, values);
            const maxValue = Math.max.apply(null, values);
            const chartPadding = Math.max((maxValue - minValue) * 0.18, 0.2);

            window.setaeGrowthChart = new Chart(chartContext, {
                type: 'line',
                data: {
                    labels: sizeLogs.map(l => formatDetailChartDate(l.date)),
                    datasets: [{
                        label: 'サイズ',
                        data: values,
                        borderColor: '#0f766e',
                        backgroundColor: chartGradient,
                        borderWidth: 2.4,
                        tension: 0.34,
                        fill: true,
                        pointBackgroundColor: '#fff',
                        pointBorderColor: '#0f766e',
                        pointBorderWidth: 2,
                        pointRadius: sizeLogs.length > 14 ? 2.5 : 4,
                        pointHoverRadius: 6,
                        pointHitRadius: 14
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: { intersect: false, mode: 'index' },
                    layout: { padding: { top: 8, right: 8, bottom: 0, left: 0 } },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            backgroundColor: '#172033',
                            titleColor: '#ffffff',
                            bodyColor: '#ffffff',
                            padding: 11,
                            cornerRadius: 6,
                            displayColors: false,
                            callbacks: {
                                title: function (items) {
                                    const item = items && items[0];
                                    return item && sizeLogs[item.dataIndex] ? sizeLogs[item.dataIndex].date : '';
                                },
                                label: function (context) {
                                    return `${formatDetailSize(context.parsed.y)} cm`;
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            grid: { display: false },
                            border: { display: false },
                            ticks: {
                                color: '#64748b',
                                maxRotation: 0,
                                autoSkip: true,
                                maxTicksLimit: 7,
                                font: { size: 10, weight: '600' }
                            }
                        },
                        y: {
                            beginAtZero: false,
                            suggestedMin: Math.max(0, minValue - chartPadding),
                            suggestedMax: maxValue + chartPadding,
                            border: { display: false },
                            grid: { color: 'rgba(148, 163, 184, 0.18)' },
                            ticks: {
                                color: '#64748b',
                                maxTicksLimit: 5,
                                callback: function (value) { return `${value} cm`; },
                                font: { size: 10, weight: '600' }
                            }
                        }
                    }
                }
            });
        }


        // ==========================================
        // ★脱皮履歴テーブル (Pro View)
        // ==========================================
        const moltLogs = logs
            .filter(l => l.type === 'molt')
            .sort((a, b) => new Date(b.date) - new Date(a.date));

        if (moltLogs.length > 0) {
            let rows = '';
            moltLogs.forEach((m, i) => {
                // 前回脱皮からの経過日数を計算
                let interval = '-';
                let intervalClass = '';

                if (i < moltLogs.length - 1) {
                    const current = new Date(m.date);
                    const prev = new Date(moltLogs[i + 1].date);
                    const diffTime = Math.abs(current - prev);
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    interval = `${diffDays}日`;
                    intervalClass = ' has-value';
                }

                // ★変更: SIZEの代わりに脱皮回数(NO.)を計算
                // リストは新しい順(降順)なので、(総数 - インデックス) で 1, 2, 3... となる
                const countVal = moltLogs.length - i;

                rows += `
                    <tr>
                        <td>${escapeHtml(m.date || '-')}</td>
                        <td class="detail-molt-interval${intervalClass}">${interval}</td>
                        <td><strong>#${countVal}</strong></td>
                    </tr>
                `;
            });

            // ▼ 追加: タイトル切り替え
            const historyTitle = (currentClassification === 'plant') ? (setaeI18n.repot_history || 'REPOT HISTORY') : (setaeI18n.molt_history || 'MOLT HISTORY');

            const tableHtml = `
                <div class="molt-history-container detail-molt-history">
                    <div class="detail-molt-history-head">
                        <h4>${escapeHtml(historyTitle)}</h4>
                        <span>${moltLogs.length}回</span>
                    </div>
                    <div class="detail-molt-history-scroll">
                    <table>
                        <thead>
                            <tr>
                                <th>${escapeHtml(setaeI18n.date || '日付')}</th>
                                <th>${escapeHtml(setaeI18n.interval || '間隔')}</th>
                                <th>${escapeHtml(setaeI18n.no || '回数')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rows}
                        </tbody>
                    </table>
                    </div>
                </div>
            `;

            // レイアウト崩れ防止のためコンテナの後ろに追加
            $container.after(tableHtml);
        }
    }

    function renderPreyChart(logs) {
        const ctx = document.getElementById('preyChart');
        if (!ctx) return;

        if (typeof Chart !== 'undefined' && window.setaePreyChart instanceof Chart) window.setaePreyChart.destroy();

        const counts = {};
        logs.forEach(log => {
            if (log.type === 'feed') {
                let isRefused = false;
                let preyName = 'コオロギ';
                try {
                    const d = typeof log.data === 'string' ? JSON.parse(log.data) : (log.data || {});
                    if (d.refused) isRefused = true;
                    if (d.prey_type) preyName = d.prey_type;
                } catch (e) { }

                const preyNameMap = {
                    'Cricket': 'コオロギ',
                    'Cricket (コオロギ)': 'コオロギ',
                    'Dubia': 'デュビア',
                    'Dubia (デュビア)': 'デュビア',
                    'Fruit Fly': 'ショウジョウバエ',
                    'Fruit Fly (ショウジョウバエ)': 'ショウジョウバエ',
                    'Red Roach': 'レッドローチ',
                    'Red Roach (レッドローチ)': 'レッドローチ',
                    'Pinky': 'ピンキー',
                    'Pinky (ピンキー)': 'ピンキー'
                };
                preyName = preyNameMap[preyName] || preyName;

                if (!isRefused) {
                    counts[preyName] = (counts[preyName] || 0) + 1;
                }
            }
        });

        const labels = Object.keys(counts);
        const data = Object.values(counts);

        // ★追加: データ有無による表示切り替え
        const hasData = labels.length > 0;
        toggleChartDataState('preyChart', hasData);
        const totalFeeds = data.reduce((total, count) => total + count, 0);
        $('#detail-prey-summary').text(hasData ? `${totalFeeds}回` : '記録なし');

        if (hasData && typeof Chart !== 'undefined') {
            const palette = ['#0f766e', '#2563eb', '#d97706', '#be123c', '#7c3aed', '#0891b2', '#65a30d', '#475569'];

            window.setaePreyChart = new Chart(ctx.getContext('2d'), {
                type: 'doughnut',
                data: {
                    labels: labels,
                    datasets: [{
                        data: data,
                        backgroundColor: labels.map((_, i) => palette[i % palette.length]),
                        borderColor: '#ffffff',
                        borderWidth: 3,
                        hoverOffset: 5
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '70%',
                    layout: { padding: 4 },
                    plugins: {
                        tooltip: {
                            backgroundColor: '#172033',
                            padding: 10,
                            cornerRadius: 6,
                            callbacks: {
                                label: function (context) {
                                    const value = context.parsed || 0;
                                    const percent = totalFeeds ? Math.round((value / totalFeeds) * 100) : 0;
                                    return `${context.label}: ${value}回 (${percent}%)`;
                                }
                            }
                        },
                        legend: {
                            position: 'bottom',
                            labels: {
                                color: '#475569',
                                usePointStyle: true,
                                boxWidth: 8,
                                padding: 12,
                                font: { size: 10, weight: '600' }
                            }
                        }
                    }
                }
            });
        }
    }

    function deleteSpider(id) {
        if (!id) return;
        const spiderName = String($('#detail-spider-name').text() || $('#edit-spider-name').val() || 'この個体').trim();
        confirmDetailAction({
            title: '個体を完全に削除',
            message: '「' + spiderName + '」を削除します。アーカイブとは異なり、元に戻せません。',
            details: [
                '飼育記録と登録写真も削除対象になります',
                '記録を残したい場合はアーカイブを利用してください'
            ],
            confirmLabel: '完全に削除する',
            tone: 'danger'
        }).then(function (confirmed) {
            if (!confirmed) return;

            const $button = $('#btn-delete-spider');
            const originalText = $button.text();
            $button.prop('disabled', true).text('削除中');
            const request = SetaeAPI.deleteSpider(id, function () {
                    SetaeCore.showToast(setaeI18n.delete, 'success');
                    $('#modal-edit-spider').fadeOut();
                    $('#section-my-detail').hide();
                    $('#section-my').fadeIn();
                    if (window.SetaeUI && SetaeUI.renderMySpiders) {
                        SetaeAPI.fetchMySpiders(SetaeUI.renderMySpiders);
                    }
                }, function (xhr) {
                    SetaeCore.showToast(SetaeCore.getErrorMessage
                        ? SetaeCore.getErrorMessage(xhr, '個体を削除できませんでした。')
                        : '個体を削除できませんでした。', 'error');
                });
            if (request && request.always) {
                request.always(function () {
                    $button.prop('disabled', false).text(originalText);
                });
            } else {
                $button.prop('disabled', false).text(originalText);
            }
        });
    }


    // ==========================================
    // Edit Spider Modal Logic
    // ==========================================
    $(document).on('click', '#btn-edit-spider-trigger', function () {
        const spiderId = currentSpiderId;
        if (!spiderId) return;
        // リスト取得は不要になったので直接開く
        openEditModal(spiderId);
    });

    function openEditModal(spiderId) {
        SetaeAPI.getSpiderDetail(spiderId, function (data) {
            $('#edit-spider-id').val(data.id);
            $('#edit-spider-name').val(data.title);

            // ▼ 修正: 種類入力のハンドリング
            const $searchWrapper = $('#wrapper-edit-species-search');
            const $searchInput = $('#edit-spider-species-search');
            const $hiddenId = $('#edit-spider-species-id');
            const $customInput = $('#edit-spider-species-custom');
            const $toggleBtn = $('#btn-toggle-edit-species-input');

            // DBに登録された種類IDを持っているか確認
            if (data.species_id && data.species_id != 0) {
                // DBモード: 検索窓を表示し、初期値をセット
                $searchWrapper.show();
                $searchInput.val(data.species_name); // 名前を表示
                $hiddenId.val(data.species_id);      // IDを裏で保持

                $customInput.hide().val('');
                $toggleBtn.text('手入力に切り替え');
            } else {
                // 手入力モード
                $searchWrapper.hide();
                $searchInput.val('');
                $hiddenId.val('');

                $customInput.val(data.species_name || data.species || '').show();
                $toggleBtn.text('リストから選択');
            }

            // Gender
            const gender = data.gender || 'unknown';
            $(`input[name="edit_spider_gender"][value="${gender}"]`).prop('checked', true);

            $('#edit-spider-acquired-date').val(data.acquired_date || '');
            $('#edit-spider-instar').val(data.instar || '');
            $('#edit-spider-temperature').val(data.temperature || '');
            $('#edit-spider-humidity').val(data.humidity || '');
            $('#edit-spider-origin').val(data.origin || '');
            $('#edit-spider-enclosure').val(data.enclosure || '');
            $('#edit-spider-substrate').val(data.substrate || '');
            $('#edit-spider-notes').val(data.notes || '');

            $('#edit-spider-image').val('').data('had-own-image', !!data.has_own_image);

            $('#btn-archive-spider')
                .data('archived', !!data.archived)
                .text(data.archived ? '飼育一覧へ戻す' : 'アーカイブ')
                .toggle(!data.transfer_receipt);

            // Preview Image: species fallback is not an individual photo.
            if (data.has_own_image && data.thumb) {
                $('#edit-preview-img-tag').attr('src', data.thumb);
                $('#edit-spider-image-preview').show();
            } else {
                $('#edit-preview-img-tag').attr('src', '');
                $('#edit-spider-image-preview').hide();
            }

            $('#modal-edit-spider').fadeIn();
        });
    }

    // ▼ 追加: 種類入力モードの切り替えイベント
    $(document).on('click', '#btn-toggle-edit-species-input', function (e) {
        e.preventDefault();
        const $searchWrapper = $('#wrapper-edit-species-search');
        const $custom = $('#edit-spider-species-custom');

        if ($searchWrapper.is(':visible')) {
            $searchWrapper.hide();
            $custom.show().focus();
            $(this).text('リストから選択');
            // モード切替時はIDをクリア
            $('#edit-spider-species-id').val('');
        } else {
            $custom.hide();
            $searchWrapper.show();
            $(this).text('手入力に切り替え');
            // カスタム入力をクリア
            $('#edit-spider-species-custom').val('');
        }
    });

    // ==========================================
    // ★追加: 編集モーダル用 オートコンプリート
    // ==========================================
    let editSearchTimer = null;

    // ① 入力イベント (検索トリガー)
    $(document).on('input', '#edit-spider-species-search', function () {
        const term = $(this).val();

        // 入力内容が変わったら、裏で保持しているIDをクリアする (リストからの再選択を強制)
        $('#edit-spider-species-id').val('');

        if (editSearchTimer) clearTimeout(editSearchTimer);

        // 2文字未満は検索しない (負荷軽減)
        if (term.length < 2) {
            $('#edit-spider-species-suggestions').hide();
            return;
        }

        editSearchTimer = setTimeout(function () {
            // API経由で検索
            SetaeAPI.searchSpecies(term, function (results) {
                if (!results || results.length === 0) {
                    $('#edit-spider-species-suggestions').hide();
                    return;
                }

                let html = '';
                results.forEach(s => {
                    const speciesTitle = escapeHtml(s.title || '');
                    const jaDisplay = s.ja_name
                        ? `<span class="edit-suggestion-ja">(${escapeHtml(s.ja_name)})</span>`
                        : '';

                    html += `<button type="button" class="edit-suggestion-item" role="option" data-id="${escapeHtml(s.id)}" data-name="${speciesTitle}">
                        <strong>${speciesTitle}${jaDisplay}</strong>
                        <span class="edit-suggestion-genus">${escapeHtml(s.genus || '')}</span>
                    </button>`;
                });

                // 結果を表示
                $('#edit-spider-species-suggestions').html(html).show();
            });
        }, 300); // 0.3秒の遅延 (連打防止)
    });

    // ② 候補クリック時の処理
    $(document).on('click', '.edit-suggestion-item', function () {
        const name = $(this).data('name');
        const id = $(this).data('id');

        // 選択した名前とIDをセット
        $('#edit-spider-species-search').val(name);
        $('#edit-spider-species-id').val(id);

        // サジェストを隠す
        $('#edit-spider-species-suggestions').hide();
    });

    // ③ 候補外クリックで閉じる
    $(document).on('click', function (e) {
        if (!$(e.target).closest('#wrapper-edit-species-search').length) {
            $('#edit-spider-species-suggestions').hide();
        }
    });

    // Delete Button Handler
    $(document).on('click', '#btn-delete-spider', function () {
        const id = $('#edit-spider-id').val();
        SetaeUIDetail.deleteSpider(id);
    });

    function updateSpiderArchiveState(id, archived, $button) {
        if (!id || ($button && $button.prop('disabled'))) return;

        const name = String($('#detail-spider-name').text() || $('#edit-spider-name').val() || 'この個体').trim();
        const confirmation = archived
            ? confirmDetailAction({
                title: '個体をアーカイブ',
                message: '「' + name + '」を飼育一覧から移します。',
                details: [
                    '記録と写真はそのまま残ります',
                    'いつでも飼育一覧へ戻せます'
                ],
                confirmLabel: 'アーカイブする'
            })
            : Promise.resolve(true);

        confirmation.then(function (confirmed) {
            if (!confirmed) return;
            performSpiderArchiveUpdate(id, archived, $button);
        });
    }

    function performSpiderArchiveUpdate(id, archived, $button) {

        const originalText = $button ? $button.text() : '';
        if ($button) {
            $button.prop('disabled', true).text(archived ? '移動中' : '復元中');
        }

        SetaeAPI.setSpiderArchived(id, archived, function () {
            $('#modal-edit-spider').fadeOut();
            $('#section-my-detail').hide();
            $('#section-my').show();

            SetaeAPI.fetchMySpiders(function () {
                if (window.SetaeUIList && SetaeUIList.renderMySpiders) {
                    SetaeUIList.renderMySpiders();
                }
            });

            if (window.SetaeUIFeeders) {
                if (archived) {
                    SetaeUIFeeders.openTool('archive', { force: true });
                } else {
                    SetaeUIFeeders.openTool('collection');
                    SetaeUIFeeders.refreshArchive();
                }
            }

            SetaeCore.showToast(archived ? 'アーカイブしました' : '飼育一覧に戻しました', 'success');
        }, function (xhr) {
            if ($button) {
                $button.prop('disabled', false).text(originalText);
            }
            const errorMessage = xhr && xhr.responseJSON && xhr.responseJSON.message
                ? xhr.responseJSON.message
                : 'アーカイブの更新に失敗しました';
            SetaeCore.showToast(errorMessage, 'error');
        });
    }

    $(document).on('click', '#btn-archive-spider', function () {
        const id = $('#edit-spider-id').val();
        const isArchived = !!$(this).data('archived');
        updateSpiderArchiveState(id, !isArchived, $(this));
    });

    $(document).on('click', '.js-detail-restore', function () {
        updateSpiderArchiveState($(this).data('id'), false, $(this));
    });

    // Modal Image Upload Trigger
    $(document).on('click', '#btn-trigger-edit-upload', function () {
        $('#edit-spider-image').click();
    });

    // Modal Image Preview
    $(document).on('change', '#edit-spider-image', function (e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function (e) {
                $('#edit-preview-img-tag').attr('src', e.target.result);
                $('#edit-spider-image-preview').fadeIn();
            };
            reader.readAsDataURL(file);
        }
    });

    // Remove Image
    $(document).on('click', '#btn-remove-edit-image', function () {
        $('#edit-preview-img-tag').attr('src', '');
        $('#edit-spider-image-preview').fadeOut();
        $('#edit-spider-image').val('');
    });

    function renderDetailSettings(spider) {
        const blPanel = currentClassification === 'tarantula'
            ? '<div id="setae-detail-bl-settings"></div>'
            : '';
        $('#tab-settings').html(`
            <div class="setae-detail-settings-layout">
                <div id="setae-detail-qr-settings"></div>
                ${blPanel}
            </div>
        `);

        if (window.SetaeUIQR && typeof SetaeUIQR.renderSpiderSettings === 'function') {
            SetaeUIQR.renderSpiderSettings(spider, '#setae-detail-qr-settings');
        }
        if (currentClassification === 'tarantula') {
            renderBLSettingsCard(spider, '#setae-detail-bl-settings');
        }
    }

    // ★修正版: プロ仕様のBL設定カード描画
    function renderBLSettingsCard(spider, targetSelector) {
        // 現在の値を正しく取得
        const blStatus = spider.bl_status || 'none';
        const blTerms = spider.bl_terms || '';

        // 新しいHTML構造
        const html = `
        <div class="bl-settings-panel">
            <div class="bl-panel-header">
                <div class="bl-icon-box">🤝</div>
                <div class="bl-header-text">
                    <h4>${setaeI18n.bl_settings_title}</h4>
                    <p>${setaeI18n.bl_settings_desc}</p>
                </div>
            </div>

            <div class="bl-panel-body">
                <div class="bl-form-group">
                    <label for="bl-status-select">${setaeI18n.current_status}</label>
                    <div class="setae-input-wrapper">
                        <select id="bl-status-select">
                            <option value="none" ${blStatus === 'none' ? 'selected' : ''}>⛔ ${setaeI18n.status_private}</option>
                            <option value="recruiting" ${blStatus === 'recruiting' ? 'selected' : ''}>✅ ${setaeI18n.status_recruiting}</option>
                            <option value="loaned" ${blStatus === 'loaned' ? 'selected' : ''}>⏳ ${setaeI18n.status_loaned}</option>
                        </select>
                    </div>
                    <span class="input-helper">${setaeI18n.bl_status_helper}</span>
                </div>

                <div class="bl-form-group">
                    <label for="bl-terms-input">${setaeI18n.terms_conditions}</label>
                    <div class="setae-input-wrapper">
                        <textarea id="bl-terms-input" placeholder="例: 子返し50%、発送は翌日着地域のみ、死着保証なし等">${escapeHtml(blTerms)}</textarea>
                    </div>
                    <span class="input-helper">${setaeI18n.bl_terms_helper}</span>
                </div>
            </div>

            <div class="bl-panel-footer">
                <button type="button" id="btn-save-bl-settings" class="setae-btn-sm btn-primary btn-wide" data-id="${spider.id}">
                    ${setaeI18n.save_settings}
                </button>
            </div>
        </div>
        `;

        // 描画
        $(targetSelector).html(html);

        // イベントハンドラ (保存処理)
        $('#btn-save-bl-settings').off('click').on('click', function () {
            const $btn = $(this);
            const originalText = $btn.text();

            // ローディング表示
            $btn.text(setaeI18n.save).prop('disabled', true);

            const status = $('#bl-status-select').val();
            const terms = $('#bl-terms-input').val();
            const id = $(this).data('id');

            const formData = new FormData();
            formData.append('bl_status', status);
            formData.append('bl_terms', terms);

            SetaeAPI.updateSpider(id, formData, function (response) {
                SetaeCore.showToast(setaeI18n.settings_saved, 'success');

                // ボタンを戻す
                $btn.text(originalText).prop('disabled', false);

                // ローカルデータを更新 (リロードなしで反映させるため重要)
                spider.bl_status = status;
                spider.bl_terms = terms;
            });
        });
    }



    // Close Modal (Icon & Cancel Button)
    $(document).on('click', '#close-edit-spider, #close-edit-spider-btn', function () {
        $('#modal-edit-spider').fadeOut();
    });

    // Submit Edit Form
    $(document).on('submit', '#form-edit-spider', function (e) {
        e.preventDefault();
        const id = $('#edit-spider-id').val();

        // Manual FormData construction for robustness
        // Manual FormData construction for robustness
        const formData = new FormData();

        // ▼ 修正: バリデーションとデータ取得
        if ($('#wrapper-edit-species-search').is(':visible')) {
            // DB検索モードの場合
            const speciesId = $('#edit-spider-species-id').val();

            // ★必須チェック: IDが空（＝リストから選んでいない）ならエラー
            if (!speciesId) {
                SetaeCore.showToast('種類をリストから選択してください', 'warning');
                return;
            }
            formData.append('species_id', speciesId);

        } else {
            // 手入力モードの場合
            const customName = $('#edit-spider-species-custom').val();
            if (!customName) {
                SetaeCore.showToast('種類名を入力してください', 'warning');
                return;
            }
            formData.append('species_name', customName);
        }
        // ▲ 修正ここまで
        formData.append('name', $('#edit-spider-name').val()); // Matches PHP 'name' expectation (which maps to post_title/nickname)
        formData.append('gender', $('input[name="edit_spider_gender"]:checked').val()); // ★Adde: Gender
        formData.append('acquired_date', $('#edit-spider-acquired-date').val());
        formData.append('instar', $('#edit-spider-instar').val());
        formData.append('temperature', $('#edit-spider-temperature').val());
        formData.append('humidity', $('#edit-spider-humidity').val());
        formData.append('origin', $('#edit-spider-origin').val());
        formData.append('enclosure', $('#edit-spider-enclosure').val());
        formData.append('substrate', $('#edit-spider-substrate').val());
        formData.append('notes', $('#edit-spider-notes').val());

        // [Fix] Check for file input manually since it might lack 'name' attribute or be outside form context
        const imageFile = $('#edit-spider-image')[0].files[0];
        const hadOwnImage = $('#edit-spider-image').data('had-own-image') === true;
        if (imageFile) {
            formData.append('image', imageFile);
        }

        SetaeAPI.updateSpider(id, formData, function (response) {
            SetaeCore.showToast('個体情報を更新しました', 'success');
            $('#modal-edit-spider').fadeOut();

            if (imageFile && !hadOwnImage && typeof SetaeCore.track === 'function') {
                SetaeCore.track('spider_first_photo_add', {
                    source: 'edit_modal'
                });
            }

            // Server response (fresh data)
            if (response.data) {
                renderSpiderDetailSection(response.data);
            } else {
                loadSpiderDetail(id);
            }

            // Update List in Background
            if (window.SetaeUI && SetaeUI.renderMySpiders) {
                SetaeAPI.fetchMySpiders(SetaeUI.renderMySpiders);
            }
        });
    });


    return {
        loadSpiderDetail: loadSpiderDetail,
        render: renderSpiderDetailSection,
        deleteSpider: deleteSpider,
        loadSpiderLogs: loadSpiderLogs,
        renderBLSettingsCard: renderBLSettingsCard,
        openEditModal: openEditModal,
        getMyListScrollPosition: function () { return myListScrollPosition; },
        restoreMyListScrollPosition: restoreMyListScrollPosition,
        resetDetailStickyStack: resetDetailStickyStack
    };

})(jQuery);
