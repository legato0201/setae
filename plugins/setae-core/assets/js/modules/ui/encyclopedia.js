var SetaeUIEncyclopedia = (function ($) {
    'use strict';

    // 状態管理
    const state = {
        page: 1,
        maxPage: 1,
        search: '',
        filterType: 'all',
        filterValue: '',
        sort: 'name_asc', // PHP側のデフォルトと合わせる
        isLoading: false
    };

    let observer;
    let searchTimer;

    // 初期化関数
    function init() {
        if (!$('#section-enc').length) return;

        // 初期ページ数を取得
        const $maxPageInput = $('#setae-max-pages');
        if ($maxPageInput.length) {
            state.maxPage = parseInt($maxPageInput.val()) || 1;
        }

        // イベントリスナーの登録
        bindEvents();

        // 監視の開始
        checkLoaderVisibility();
        setupObserver();
    }

    // イベントバインド
    function bindEvents() {
        // 1. 検索 (デバウンス処理)
        $(document).off('input', '#setae-enc-search').on('input', '#setae-enc-search', function () {
            clearTimeout(searchTimer);
            state.search = $(this).val().trim();
            searchTimer = setTimeout(function () {
                fetchData(true);
            }, 500);
        });

        // 2. フィルタボタン
        $(document).off('click', '#setae-enc-filters .deck-pill').on('click', '#setae-enc-filters .deck-pill', function () {
            // 見た目の更新
            $('#setae-enc-filters .deck-pill').removeClass('active');
            $(this).addClass('active');

            // データ属性の解析 (例: "lifestyle_arboreal" -> type="lifestyle", value="arboreal")
            const rawFilter = $(this).data('filter') || 'all';
            parseFilter(rawFilter);

            fetchData(true); // リセットして検索
        });

        // 3. ソートメニュー開閉
        $(document).off('click', '#btn-enc-sort-menu').on('click', '#btn-enc-sort-menu', function (e) {
            e.preventDefault();
            e.stopPropagation();
            toggleSortMenu($(this));
        });

        // 4. ソート実行
        $(document).off('click', '.enc-sort-option').on('click', '.enc-sort-option', function () {
            state.sort = $(this).data('sort');
            $('#setae-enc-sort-menu').remove(); // メニューを閉じる
            fetchData(true);
        });

        // メニュー外クリックで閉じる
        $(document).on('click', function (e) {
            if (!$(e.target).closest('#btn-enc-sort-menu').length &&
                !$(e.target).closest('#setae-enc-sort-menu').length) {
                $('#setae-enc-sort-menu').remove();
            }
        });
    }

    // フィルタ文字列の解析
    function parseFilter(rawFilter) {
        if (!rawFilter || rawFilter === 'all') {
            state.filterType = 'all';
            state.filterValue = '';
        } else {
            // 最初のアンダースコアで分割
            const separator = rawFilter.indexOf('_');
            if (separator !== -1) {
                state.filterType = rawFilter.substring(0, separator);

                // ★修正: 値部分をデコードする (例: %e3%... -> ブラジル)
                // これによりPHP側での不整合を防ぐ
                const rawValue = rawFilter.substring(separator + 1);
                try {
                    state.filterValue = decodeURIComponent(rawValue);
                } catch (e) {
                    state.filterValue = rawValue;
                }
            } else {
                state.filterType = 'all';
                state.filterValue = '';
            }
        }

        // デバッグ用（コンソールで確認できます）
        console.log('Filter set to:', state.filterType, state.filterValue);
    }

    // データの取得 (AJAX)
    function fetchData(reset = false) {
        if (state.isLoading) return;

        const $container = $('#setae-species-list-container');
        const $loader = $('#setae-enc-loader');

        if (reset) {
            state.page = 1;
            $container.css('opacity', '0.5'); // 読み込み中の演出
            // ※ここで全スクロールさせると使いにくい場合があるため削除、必要なら追加
        } else {
            if (state.page >= state.maxPage) return;
            state.page++;
        }

        state.isLoading = true;
        $loader.css('visibility', 'visible').show();

        // ★修正: 確実に取得できる変数名を使用する
        // setaecore_vars か SetaeSettings のどちらか存在する方を使う
        let nonce = '';
        if (typeof SetaeSettings !== 'undefined') {
            // Encyclopedia uses 'setae_nonce' if available, fallback to 'nonce' (though likely wrong action)
            if (SetaeSettings.setae_nonce) {
                nonce = SetaeSettings.setae_nonce;
            } else if (SetaeSettings.nonce) {
                nonce = SetaeSettings.nonce;
            }
        } else if (typeof setaecore_vars !== 'undefined' && setaecore_vars.nonce) {
            nonce = setaecore_vars.nonce;
        } else {
            console.error('Setae Nonce not found!');
        }

        const ajaxUrl = (typeof SetaeSettings !== 'undefined' && SetaeSettings.ajax_url)
            ? SetaeSettings.ajax_url
            : ((typeof setaecore_vars !== 'undefined' && setaecore_vars.ajax_url) ? setaecore_vars.ajax_url : '/wp-admin/admin-ajax.php');

        $.ajax({
            url: ajaxUrl,
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

                        // ページ数リセットに伴い監視状態を再設定
                        if (state.maxPage <= 1) {
                            if (observer) observer.disconnect();
                            $loader.hide();
                        } else {
                            checkLoaderVisibility();
                            setupObserver();
                        }

                        // ▼▼▼ ここに追加: 初回データ読み込み完了時にチュートリアルを起動 ▼▼▼
                        if (typeof SetaeTutorial !== 'undefined' && typeof SetaeTutorial.initEncyclopedia === 'function') {
                            SetaeTutorial.initEncyclopedia();
                        }
                        // ▲▲▲ 追加終了 ▲▲▲

                    } else {
                        $container.append(res.data.html);
                    }
                } else {
                    if (reset) $container.html('<p class="no-results" style="padding:20px; text-align:center; color:#999;">データが見つかりません</p>');
                    $container.css('opacity', '1');
                }
            },
            error: function () {
                $container.css('opacity', '1');
                if (!reset) state.page--;
            },
            complete: function () {
                state.isLoading = false;
                checkLoaderVisibility();
            }
        });
    }

    // ローダー表示制御（無限スクロール用）
    function checkLoaderVisibility() {
        const $loader = $('#setae-enc-loader');
        if (state.page < state.maxPage) {
            // 次のページがあるなら、見えない状態で配置して監視させる
            $loader.css({
                'display': 'flex',
                'visibility': 'hidden'
            });
        } else {
            $loader.hide();
        }
    }

    // IntersectionObserverの設定
    function setupObserver() {
        const $loader = $('#setae-enc-loader');
        if (!$loader.length) return;

        if (observer) observer.disconnect();

        const options = {
            root: null,
            rootMargin: '200px', // 早めに読み込む
            threshold: 0
        };

        observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && !state.isLoading && state.page < state.maxPage) {
                    fetchData(false); // 追加読み込み
                }
            });
        }, options);

        observer.observe($loader[0]);
    }

    // ソートメニューの表示
    function toggleSortMenu($btn) {
        const $existing = $('#setae-enc-sort-menu');
        if ($existing.length) {
            $existing.remove();
            return;
        }

        const menuHtml = `
            <div id="setae-enc-sort-menu" style="position:absolute; background:#fff; border:1px solid #eee; border-radius:12px; box-shadow:0 4px 24px rgba(0,0,0,0.15); width:180px; z-index:99999; overflow:hidden; padding:8px 0;">
                <div class="enc-sort-option ${state.sort === 'name_asc' ? 'active' : ''}" data-sort="name_asc" style="padding:10px 15px; cursor:pointer; font-size:14px;">🔤 名前順 (A-Z)</div>
                <div class="enc-sort-option ${state.sort === 'count_desc' ? 'active' : ''}" data-sort="count_desc" style="padding:10px 15px; cursor:pointer; font-size:14px;">🔥 人気順</div>
                <div class="enc-sort-option ${state.sort === 'diff_asc' ? 'active' : ''}" data-sort="diff_asc" style="padding:10px 15px; cursor:pointer; font-size:14px;">🔰 難易度順</div>
            </div>
        `;

        $('body').append(menuHtml);

        const rect = $btn[0].getBoundingClientRect();
        const $menu = $('#setae-enc-sort-menu');
        $menu.css({
            top: (rect.bottom + window.scrollY + 5) + 'px',
            left: Math.max(10, (rect.right + window.scrollX) - 180) + 'px'
        });

        $('.enc-sort-option.active').css({ fontWeight: 'bold', color: '#2ecc71', background: '#f9f9f9' });
    }

    // 公開メソッド
    return {
        init: init
    };

})(jQuery);

// ドキュメント読み込み完了時に初期化
jQuery(document).ready(function () {
    SetaeUIEncyclopedia.init();
});