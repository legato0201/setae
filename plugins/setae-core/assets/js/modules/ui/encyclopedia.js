(function ($) {
    'use strict';

    const state = {
        page: 1,
        maxPage: parseInt($('#setae-max-pages').val()) || 1,
        search: '',
        filterType: 'all',
        filterValue: '',
        sort: 'name_asc', // default sort
        isLoading: false
    };

    const $container = $('#setae-species-list-container');
    const $loader = $('#setae-enc-loader');

    // --- データ取得 (AJAX) ---
    function fetchSpecies(reset = false) {
        if (state.isLoading) return;

        if (reset) {
            state.page = 1;
            // ローディング感
            $container.css('opacity', '0.5');
        } else {
            if (state.page >= state.maxPage) return;
            state.page++;
        }

        state.isLoading = true;
        if (reset) {
            // リセット時は上書きするまでローダー出さないか、コンテナ内で表示するか
            // ここでは opacity で表現し、下部ローダーは追加読み込み用とする
        } else {
            $loader.css('display', 'flex');
        }

        // nonce取得 (SetaeSettings is localized in class-setae-dashboard.php)
        const nonce = (window.SetaeSettings && window.SetaeSettings.nonce) ? window.SetaeSettings.nonce : '';

        $.ajax({
            url: window.SetaeSettings ? window.SetaeSettings.ajax_url : '/wp-admin/admin-ajax.php',
            type: 'POST',
            data: {
                action: 'setae_search_species',
                nonce: nonce,
                paged: state.page,
                search: state.search,
                filter_type: state.filterType,
                filter_value: state.filterValue,
                sort: state.sort
            },
            success: function (res) {
                if (res.success) {
                    if (reset) {
                        $container.html(res.data.html);
                        $container.css('opacity', '1');
                        state.maxPage = parseInt(res.data.max_page);

                        // 1ページ未満なら監視解除、それ以外なら監視開始
                        if (state.maxPage <= 1) {
                            if (observer) observer.disconnect();
                        } else {
                            setupObserver(); // 再接続
                        }
                    } else {
                        // 追加
                        $container.append(res.data.html);
                    }
                }
            },
            error: function () {
                // エラー処理（トーストなど）
                $container.css('opacity', '1');
            },
            complete: function () {
                state.isLoading = false;
                $loader.hide();
            }
        });
    }

    // --- イベントリスナー ---

    // 1. 検索
    let searchTimer;
    $('#setae-enc-search').on('input', function () {
        const val = $(this).val();
        clearTimeout(searchTimer);
        state.search = val;

        searchTimer = setTimeout(() => {
            fetchSpecies(true);
        }, 500);
    });

    // 2. フィルター (Deck Pills)
    // HTML: data-filter="style_arboreal" or "region_brazil" or "all"
    // section-encyclopedia.php generates: data-filter="style_arboreal"
    // We need to parse this.
    $('#setae-enc-filters').on('click', '.deck-pill', function () {
        $('#setae-enc-filters .deck-pill').removeClass('active');
        $(this).addClass('active');

        const rawFilter = $(this).data('filter'); // e.g. "style_arboreal", "region_brazil", "all"

        if (rawFilter === 'all') {
            state.filterType = 'all';
            state.filterValue = '';
        } else {
            // split by first underscore
            const parts = rawFilter.split('_');
            // parts[0] is type, parts[1]... is value. Value might contain underscores? 
            // e.g. region_south_america.
            const type = parts.shift();
            const value = parts.join('_');

            state.filterType = type;
            state.filterValue = value;
        }

        fetchSpecies(true);
    });

    // 3. ソートメニュー
    // section-encyclopedia.php has #btn-enc-sort-menu
    // And it generates a popup. 
    // Updating logic to trigger fetch.
    $(document).on('click', '.enc-sort-opt', function () {
        const sortKey = $(this).data('sort');
        state.sort = sortKey;

        // Popup close logic is already in section-encyclopedia.php inline script?
        // Wait, I replaced section-encyclopedia.php but I REMOVED the inline script that handled popup logic!
        // The inline script `jQuery(document).ready...` was at the bottom of the original file.
        // My replacement REMOVED it.
        // I need to re-implement the popup logic HERE in this file.
        $('#setae-enc-sort-popup').remove();
        fetchSpecies(true);
    });

    // Sort Menu Popup Logic (Restoring from original)
    $('#btn-enc-sort-menu').on('click', function (e) {
        e.stopPropagation();
        $('#setae-enc-sort-popup').remove();
        const menuHtml = `
            <div id="setae-enc-sort-popup" style="position:absolute; background:#fff; border:1px solid #eee; border-radius:12px; box-shadow:0 4px 24px rgba(0,0,0,0.15); width:200px; z-index:9999; overflow:hidden;">
                <div class="enc-sort-opt" data-sort="name_asc" style="padding:10px 15px; cursor:pointer; border-bottom:1px solid #f5f5f5;">🔤 学名順 (A-Z)</div>
                <!-- Note: Complex sorts like count/diff are hard in WP_Query without custom meta setup. Keeping them visually but functionality might fallback to title if server not ready. -->
                <div class="enc-sort-opt" data-sort="count_desc" style="padding:10px 15px; cursor:pointer; border-bottom:1px solid #f5f5f5;">🔥 飼育数順 (多→少)</div>
                <div class="enc-sort-opt" data-sort="diff_asc" style="padding:10px 15px; cursor:pointer; border-bottom:1px solid #f5f5f5;">🔰 難易度順 (易→難)</div>
            </div>
        `;
        $('body').append(menuHtml);
        const rect = this.getBoundingClientRect();
        // Adjust position logic
        const top = rect.bottom + window.scrollY + 5;
        const left = rect.right + window.scrollX - 200;

        $('#setae-enc-sort-popup').css({ top: top + 'px', left: left + 'px' });
    });

    $(document).on('click', function (e) {
        if (!$(e.target).closest('#btn-enc-sort-menu').length) $('#setae-enc-sort-popup').remove();
    });


    // --- Infinite Scroll ---
    let observer;
    function setupObserver() {
        if (observer) observer.disconnect();

        const options = {
            root: null,
            rootMargin: '200px',
            threshold: 0
        };

        observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && !state.isLoading && state.page < state.maxPage) {
                    fetchSpecies(false);
                }
            });
        }, options);

        if ($loader.length) observer.observe($loader[0]);
    }

    // Init
    $(document).ready(function () {
        if ($('#section-enc').length) {
            setupObserver();
        }
    });

})(jQuery);
