var SetaeUIEncyclopedia = (function ($) {
    'use strict';

    const state = {
        page: 1,
        maxPage: 1,
        search: '',
        lifestyle: '',
        habitat: '',
        contentFilter: 'all',
        sort: 'name_asc',
        isLoading: false
    };

    let observer = null;
    let searchTimer = null;
    let emptyTrackedKey = '';

    function init() {
        if (!$('#section-enc').length) return;

        state.maxPage = parseInt($('#setae-max-pages').val(), 10) || 1;
        bindEvents();
        syncControls();
        checkLoaderVisibility();
        setupObserver();
    }

    function bindEvents() {
        $(document)
            .off('input.setaeEncyclopedia', '#setae-enc-search')
            .on('input.setaeEncyclopedia', '#setae-enc-search', function () {
                clearTimeout(searchTimer);
                state.search = $(this).val().trim();
                updateSearchClear();
                searchTimer = setTimeout(function () {
                    fetchData(true);
                }, 350);
            });

        $(document)
            .off('click.setaeEncyclopedia', '.js-enc-search-clear')
            .on('click.setaeEncyclopedia', '.js-enc-search-clear', function () {
                state.search = '';
                $('#setae-enc-search').val('').trigger('focus');
                updateSearchClear();
                fetchData(true);
            });

        $(document)
            .off('change.setaeEncyclopedia', '#setae-enc-lifestyle')
            .on('change.setaeEncyclopedia', '#setae-enc-lifestyle', function () {
                state.lifestyle = $(this).val() || '';
                $('.js-enc-mobile-lifestyle').val(state.lifestyle);
                filterChanged();
            });

        $(document)
            .off('change.setaeEncyclopedia', '#setae-enc-habitat')
            .on('change.setaeEncyclopedia', '#setae-enc-habitat', function () {
                state.habitat = $(this).val() || '';
                $('.js-enc-mobile-habitat').val(state.habitat);
                filterChanged();
            });

        $(document)
            .off('change.setaeEncyclopedia', '#setae-enc-sort')
            .on('change.setaeEncyclopedia', '#setae-enc-sort', function () {
                state.sort = $(this).val() || 'name_asc';
                $('.js-enc-mobile-sort').val(state.sort);
                fetchData(true);
            });

        $(document)
            .off('change.setaeEncyclopedia', '.js-enc-mobile-lifestyle')
            .on('change.setaeEncyclopedia', '.js-enc-mobile-lifestyle', function () {
                state.lifestyle = $(this).val() || '';
                $('#setae-enc-lifestyle').val(state.lifestyle);
                filterChanged();
            });

        $(document)
            .off('change.setaeEncyclopedia', '.js-enc-mobile-habitat')
            .on('change.setaeEncyclopedia', '.js-enc-mobile-habitat', function () {
                state.habitat = $(this).val() || '';
                $('#setae-enc-habitat').val(state.habitat);
                filterChanged();
            });

        $(document)
            .off('change.setaeEncyclopedia', '.js-enc-mobile-sort')
            .on('change.setaeEncyclopedia', '.js-enc-mobile-sort', function () {
                state.sort = $(this).val() || 'name_asc';
                $('#setae-enc-sort').val(state.sort);
                fetchData(true);
            });

        $(document)
            .off('click.setaeEncyclopedia', '#setae-enc-content-filters button')
            .on('click.setaeEncyclopedia', '#setae-enc-content-filters button', function () {
                state.contentFilter = $(this).data('content-filter') || 'all';
                $('#setae-enc-content-filters button')
                    .removeClass('active')
                    .attr('aria-selected', 'false');
                $(this).addClass('active').attr('aria-selected', 'true');
                filterChanged();
            });

        $(document)
            .off('click.setaeEncyclopedia', '.js-enc-mobile-filter-toggle')
            .on('click.setaeEncyclopedia', '.js-enc-mobile-filter-toggle', function () {
                const $panel = $('#enc-mobile-filters');
                const willOpen = $panel.prop('hidden');
                $panel.prop('hidden', !willOpen);
                $(this).attr('aria-expanded', willOpen ? 'true' : 'false');
            });

        $(document)
            .off('click.setaeEncyclopedia', '.js-enc-clear-filters')
            .on('click.setaeEncyclopedia', '.js-enc-clear-filters', handleClearFilters);

        $(document)
            .off('click.setaeEncyclopedia', '.js-enc-topic-cta')
            .on('click.setaeEncyclopedia', '.js-enc-topic-cta', handleTopicCta);
    }

    function filterChanged() {
        syncControls();
        fetchData(true);
    }

    function syncControls() {
        $('#setae-enc-lifestyle, .js-enc-mobile-lifestyle').val(state.lifestyle);
        $('#setae-enc-habitat, .js-enc-mobile-habitat').val(state.habitat);
        $('#setae-enc-sort, .js-enc-mobile-sort').val(state.sort);
        $('#setae-enc-search').val(state.search);
        updateSearchClear();
        updateFilterCount();
        updateSummary();
    }

    function updateSearchClear() {
        $('.js-enc-search-clear').prop('hidden', !state.search);
    }

    function updateFilterCount() {
        let count = 0;
        if (state.lifestyle) count++;
        if (state.habitat) count++;
        if (state.contentFilter !== 'all') count++;

        const $badge = $('.enc-mobile-filter-count');
        $badge.text(count).prop('hidden', count === 0);
    }

    function selectedText(selector) {
        const $selected = $(selector).find('option:selected');
        if (!$selected.length || !$selected.val()) return '';
        return $selected.text().trim();
    }

    function updateSummary() {
        const parts = [];
        const lifestyle = selectedText('#setae-enc-lifestyle');
        const habitat = selectedText('#setae-enc-habitat');
        const contentLabels = {
            researched: '出典あり',
            community: '飼育・相談あり',
            breeding: '繁殖募集中'
        };

        if (lifestyle) parts.push(lifestyle);
        if (habitat) parts.push(habitat);
        if (contentLabels[state.contentFilter]) parts.push(contentLabels[state.contentFilter]);
        if (state.search) parts.push(`「${state.search}」`);

        $('#setae-enc-active-summary').text(parts.length ? parts.join(' / ') : 'すべての図鑑情報');
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

    function trackEmptySeen() {
        if (typeof SetaeCore === 'undefined' || typeof SetaeCore.track !== 'function') return;

        const key = [state.search, state.lifestyle, state.habitat, state.contentFilter, state.sort].join('|');
        if (emptyTrackedKey === key) return;

        emptyTrackedKey = key;
        SetaeCore.track('encyclopedia_empty_seen', {
            has_search: !!state.search,
            lifestyle: state.lifestyle,
            habitat: state.habitat,
            content_filter: state.contentFilter,
            sort: state.sort
        });
    }

    function renderEmptyState() {
        trackEmptySeen();
        const summary = $('#setae-enc-active-summary').text() || '現在の条件';

        return `
            <div class="setae-empty-state enc-empty-state">
                <h3>条件に合う種が見つかりません</h3>
                <p>${escapeHtml(summary)}では見つかりませんでした。</p>
                <div class="setae-empty-actions">
                    <button type="button" class="setae-btn js-enc-clear-filters">条件をリセット</button>
                    <button type="button" class="setae-btn-secondary js-enc-topic-cta">相談広場で聞く</button>
                </div>
            </div>
        `;
    }

    function handleClearFilters(event) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }

        clearTimeout(searchTimer);
        state.search = '';
        state.lifestyle = '';
        state.habitat = '';
        state.contentFilter = 'all';
        state.sort = 'name_asc';

        $('#setae-enc-content-filters button')
            .removeClass('active')
            .attr('aria-selected', 'false');
        $('#setae-enc-content-filters button[data-content-filter="all"]')
            .addClass('active')
            .attr('aria-selected', 'true');
        syncControls();
        fetchData(true);

        if (typeof SetaeCore !== 'undefined' && typeof SetaeCore.track === 'function') {
            SetaeCore.track('encyclopedia_filters_reset');
        }
    }

    function handleTopicCta(event) {
        event.preventDefault();
        event.stopPropagation();

        $('.setae-nav-item[data-target="section-care-feed"]').trigger('click');
        window.setTimeout(function () {
            $('.js-social-hub-tab[data-social-view="community"]').first().trigger('click');
        }, 120);
        window.setTimeout(function () {
            $('.js-open-topic-modal').first().trigger('click');
        }, 280);
    }

    function getAjaxSettings() {
        let nonce = '';
        let ajaxUrl = '/wp-admin/admin-ajax.php';

        if (typeof SetaeSettings !== 'undefined') {
            nonce = SetaeSettings.setae_nonce || SetaeSettings.nonce || '';
            ajaxUrl = SetaeSettings.ajax_url || ajaxUrl;
        } else if (typeof setaecore_vars !== 'undefined') {
            nonce = setaecore_vars.nonce || '';
            ajaxUrl = setaecore_vars.ajax_url || ajaxUrl;
        }

        return { nonce: nonce, ajaxUrl: ajaxUrl };
    }

    function fetchData(reset) {
        if (state.isLoading) return;

        const $container = $('#setae-species-list-container');
        const $loader = $('#setae-enc-loader');

        if (reset) {
            state.page = 1;
            $container.css('opacity', '0.45').attr('aria-busy', 'true');
        } else {
            if (state.page >= state.maxPage) return;
            state.page++;
        }

        state.isLoading = true;
        $loader.prop('hidden', false).css('visibility', 'visible');
        const settings = getAjaxSettings();

        $.ajax({
            url: settings.ajaxUrl,
            type: 'POST',
            data: {
                action: 'setae_search_species',
                nonce: settings.nonce,
                paged: state.page,
                search: state.search,
                lifestyle: state.lifestyle,
                habitat: state.habitat,
                content_filter: state.contentFilter,
                sort: state.sort
            },
            success: function (response) {
                if (!response.success) {
                    if (reset) $container.html(renderEmptyState());
                    return;
                }

                const payload = response.data || {};
                const html = payload.html || '';
                const total = parseInt(payload.total, 10) || 0;
                state.maxPage = parseInt(payload.max_page, 10) || 0;

                if (reset) {
                    $container.html(total > 0 ? html : renderEmptyState());
                } else if (html) {
                    $container.append(html);
                }

                $('#setae-enc-result-count').text(`${total.toLocaleString('ja-JP')}種`);
                $('#setae-max-pages').val(state.maxPage);

                if (reset && typeof SetaeTutorial !== 'undefined' && typeof SetaeTutorial.initEncyclopedia === 'function') {
                    SetaeTutorial.initEncyclopedia();
                }
            },
            error: function () {
                if (!reset) state.page--;
                if (typeof SetaeCore !== 'undefined' && typeof SetaeCore.showToast === 'function') {
                    SetaeCore.showToast('図鑑を読み込めませんでした', 'error');
                }
            },
            complete: function () {
                state.isLoading = false;
                $container.css('opacity', '').removeAttr('aria-busy');
                updateFilterCount();
                updateSummary();
                checkLoaderVisibility();
                setupObserver();
            }
        });
    }

    function checkLoaderVisibility() {
        const $loader = $('#setae-enc-loader');
        if (state.page < state.maxPage) {
            $loader.prop('hidden', false).css('visibility', state.isLoading ? 'visible' : 'hidden');
        } else {
            $loader.prop('hidden', true);
        }
    }

    function setupObserver() {
        const loader = document.getElementById('setae-enc-loader');
        if (!loader || typeof IntersectionObserver === 'undefined') return;

        if (observer) observer.disconnect();
        if (state.page >= state.maxPage) return;

        observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting && !state.isLoading && state.page < state.maxPage) {
                    fetchData(false);
                }
            });
        }, {
            root: null,
            rootMargin: '240px',
            threshold: 0
        });

        observer.observe(loader);
    }

    return {
        init: init,
        refresh: function () { fetchData(true); }
    };
})(jQuery);

jQuery(document).ready(function () {
    SetaeUIEncyclopedia.init();
});
