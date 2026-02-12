var SetaeUI = (function ($) {
    'use strict';

    // ==========================================
    // Initialization & Event Listeners
    // ==========================================
    $(document).ready(function () {
        initListeners();
        checkInitialLoad();

        if ($('#section-enc').length) {
            initEncyclopedia();
        }
    });

    function initListeners() {
        // Tab Navigation
        $('.setae-nav-item').on('click', handleTabClick);

        // --- Community Listeners (追記) ---

        // 1. 新規トピックモーダルを開く
        $(document).on('click', '#btn-create-topic', function () {
            $('#setae-create-topic-modal').fadeIn(200);
        });

        // 2. 新規トピックモーダルを閉じる
        $(document).on('click', '#close-topic-modal', function () {
            $('#setae-create-topic-modal').fadeOut(200);
        });

        // 3. 新規トピック作成フォーム送信
        $(document).on('submit', '#setae-topic-form', function (e) {
            e.preventDefault();
            const title = $('#topic-title').val();
            const content = $('#topic-content').val();

            SetaeAPI.createTopic({ title: title, content: content }, function () {
                $('#setae-create-topic-modal').fadeOut();
                $('#topic-title').val('');
                $('#topic-content').val('');
                SetaeCore.showToast('トピックを作成しました', 'success');
                loadTopics(); // リスト再読み込み
            });
        });

        // 4. トピック詳細を開く (一覧のアイテムクリック時)
        $(document).on('click', '.setae-topic-row', function () {
            const id = $(this).data('id');
            openTopicDetail(id);
        });

        // 5. 詳細から一覧に戻る
        $(document).on('click', '#btn-back-to-topics', function () {
            $('#section-com-detail').hide();
            $('#section-com').fadeIn(200);
            loadTopics(); // 最新状態に更新
        });

        // 6. コメント投稿
        $(document).on('submit', '#setae-comment-form', function (e) {
            e.preventDefault();
            const topicId = $('#comment-post-id').val();
            const content = $('#comment-content').val();

            if (!content) return;

            SetaeAPI.postComment(topicId, content, function () {
                $('#comment-content').val('');
                openTopicDetail(topicId); // コメント反映のため再読み込み
                SetaeCore.showToast('書き込みました', 'success');
            });
        });

        // Deck Filters (My Spiders Only)
        $(document).on('click', '.deck-pill[data-deck]', SetaeUIList.handleDeckFilterClick);

        // Sort Menu
        $(document).on('click', '#btn-sort-menu', SetaeUIList.toggleSortMenu);
        $(document).on('click', '.sort-option', SetaeUIList.handleSortOptionClick);
        $(document).on('click', SetaeUIList.closeSortMenuOutside);
        $(window).on('resize scroll', SetaeUIList.closeSortMenu);

        // List Item Click (Detail View)
        $(document).on('click', '.setae-spider-list-row', SetaeUIList.handleListItemClick);

        // Search Input
        $(document).on('input', '#setae-spider-search', SetaeUIList.handleSearchInput);

        // --- Encyclopedia Listeners ---

        // 1. Search Input
        $(document).on('input', '#setae-enc-search', function () {
            const val = $(this).val();
            SetaeCore.state.encSearch = val;
            localStorage.setItem('setae_enc_search', val);
            runEncyclopediaFilter();
        });

        // 2. Filter Buttons (Encyclopedia Only)
        $(document).on('click', '#setae-enc-filters .deck-pill', function () {
            const filter = $(this).data('filter');
            SetaeCore.state.encFilter = filter;
            localStorage.setItem('setae_enc_filter', filter);

            // UI Update
            $('#setae-enc-filters .deck-pill').removeClass('active');
            $(this).addClass('active');

            runEncyclopediaFilter();
        });

        // 3. Sort Menu
        $(document).on('click', '#btn-enc-sort-menu', toggleEncSortMenu);
        $(document).on('click', '.enc-sort-option', handleEncSortOptionClick);

        // Close menu on outside click
        $(document).on('click', function (e) {
            if (!$(e.target).closest('#btn-enc-sort-menu').length && !$(e.target).closest('#setae-enc-sort-menu').length) {
                $('#setae-enc-sort-menu').remove();
            }
        });

        // Initialize Species Search (Replaced by initEncyclopedia)
        // initSpeciesSearch();

        $(document).on('click', function (e) {
            // Close Context Menu if click outside
            if (!$(e.target).closest('.setae-context-menu').length && !$(e.target).closest('.btn-feed-smart').length) {
                $('.setae-context-menu').remove();
            }
        });

        // Log Modal
        $(document).on('click', '.log-type-btn, .type-btn-sm', SetaeUILogModal.handleLogTypeClick);
        $(document).on('click', '#btn-add-log', function () { SetaeUILogModal.openLogModal(null); });
        $(document).on('submit', '#setae-log-form', SetaeUILogModal.handleLogSubmit);
        $(document).on('click', '.setae-close', function () { $(this).closest('.setae-modal').fadeOut(); });

        // Edit Prey List
        $(document).on('click', '#btn-manage-feed-types', SetaeUILogModal.renderEditPreyListModal);

        // Species Detail Back Button
        $(document).on('click', '#btn-back-to-enc', function () {
            $('#section-enc-detail').hide();
            $('#section-enc').fadeIn(200);
        });

        // Species Card Click - Updated selector for PHP rendered items
        $(document).on('click', '.js-open-species-detail, .setae-species-card', function (e) {
            // If it's the anchor inside, prevent default if needed, though href is void(0)
            const id = $(this).data('id');
            if (id) SetaeUI.openSpeciesDetail(id);
        });

        // Detail View Back Button
        $(document).on('click', '#btn-back-to-list', function () {
            $('#section-my-detail').hide();
            $('#section-my').fadeIn();
            SetaeAPI.fetchMySpiders(SetaeUIList.init);
        });

        // Scroll Shadow
        $(window).on('scroll', function () { handleToolbarShadow($(this).scrollTop()); });

        // Swipe Actions (Mobile)
        if (SetaeUIActions) {
            $(document).on('touchstart', '.setae-spider-list-row', SetaeUIActions.handleTouchStart);
            $(document).on('touchmove', '.setae-spider-list-row', SetaeUIActions.handleTouchMove);
            $(document).on('touchend', '.setae-spider-list-row', SetaeUIActions.handleTouchEnd);

            // Desktop Hover Actions is now handled by SetaeUIDesktop (app-ui-desktop.js)
            // SetaeUIActions.initDesktopHoverLogic();
        }

        // Initialize Breeding Loan Module
        if (typeof SetaeUIBL !== 'undefined') {
            SetaeUIBL.init();
        }
    }

    function checkInitialLoad() {
        if ($('#section-my').is(':visible')) {
            SetaeAPI.fetchMySpiders(SetaeUIList.init);
        }
    }

    // ==========================================
    // Species Logic
    // ==========================================
    function openSpeciesDetail(id) {
        $('#section-enc').hide();
        $('#section-enc-detail').show().scrollTop(0);
        $('#enc-detail-title').text('Loading...');
        $('#enc-gallery-grid').html('<p style="text-align:center;">Loading...</p>');

        SetaeAPI.getSpeciesDetail(id, function (data) {
            const displayName = data.ja_name ? data.ja_name : data.title;
            $('#enc-detail-title').text(displayName);
            $('#enc-detail-name').text(data.title);
            $('#enc-detail-genus').text(data.genus || '');

            // New Fields
            $('#enc-detail-common-name').text(data.ja_name || '');

            // Stats
            $('#enc-detail-description').html(data.description ? data.description.replace(/\n/g, '<br>') : 'No description available.');
            $('#enc-detail-lifespan').text(data.lifespan || '-');
            $('#enc-detail-size').text(data.size ? data.size + ' cm' : '-');
            $('#enc-detail-temp').text(data.temperature || '-');
            $('#enc-detail-humidity').text(data.humidity || '-');

            // Lifestyle
            $('#enc-detail-lifestyle').text(data.lifestyle || '-').data('value', data.lifestyle_slug || '');

            // Temperament List (Chips)
            const tempContainer = $('#enc-detail-temperament-list');
            tempContainer.empty();
            if (data.temperaments && data.temperaments.length > 0) {
                const chips = data.temperaments.map(t =>
                    `<span class="setae-chip" data-id="${t.term_id}" style="background:#eee; padding:3px 8px; border-radius:12px; font-size:11px;">${t.name}</span>`
                ).join('');
                tempContainer.html(chips);
            } else {
                tempContainer.html('<span style="font-size:11px; color:#999;">Unknown</span>');
            }

            $('#enc-detail-keeping').html(`🔥 ${data.keeping_count} Keeping`);

            // Set ID for Edit Suggestion Button
            $('#btn-open-edit-modal').data('id', id);

            if (data.thumb) {
                $('#enc-detail-image').attr('src', data.thumb).show();
            } else {
                $('#enc-detail-image').hide();
            }

            // Gallery
            const gallery = $('#enc-gallery-grid');
            gallery.empty();
            const emptyMsg = $('#enc-gallery-empty');

            if (data.featured_images && data.featured_images.length > 0) {
                emptyMsg.hide();
                data.featured_images.forEach(imgUrl => {
                    gallery.append(`
                        <div style="height:100px; overflow:hidden; border-radius:4px;">
                            <img src="${imgUrl}" style="width:100%; height:100%; object-fit:cover;">
                        </div>
                    `);
                });
            } else {
                emptyMsg.show();
            }
        });
    }

    // ==========================================
    // Navigation
    // ==========================================
    // ==========================================
    // Navigation
    // ==========================================
    function handleTabClick() {
        const target = $(this).data('target');
        $('.setae-nav-item').removeClass('active');
        $(this).addClass('active');
        $('.setae-section').hide();
        $('#' + target).fadeIn(200);

        if (target === 'section-my') {
            SetaeAPI.fetchMySpiders(SetaeUIList.init);
        }
        // ▼ 追加: Communityタブが選択された時の処理
        else if (target === 'section-com') {
            loadTopics();
        }
        else if (target === 'section-bl') {
            if (typeof SetaeUIBL !== 'undefined') SetaeUIBL.loadRecruits();
        }
        // ▲ 追加ここまで

        // section-enc is now server-side rendered, no need to fetch API
    }

    // --- Community Functions (追記) ---

    function loadTopics() {
        $('#setae-topic-list').html('<p style="text-align:center;">読み込み中...</p>');
        SetaeAPI.fetchTopics(function (data) {
            const container = $('#setae-topic-list');
            container.empty();

            if (!data || data.length === 0) {
                container.html('<div style="text-align:center; padding:20px; color:#999;">トピックがありません</div>');
                return;
            }

            data.forEach(topic => {
                // クラス名 .setae-topic-row をクリックイベントのフックに使用
                const html = `
                    <div class="setae-topic-row setae-card" data-id="${topic.id}" style="cursor:pointer; margin-bottom:10px; padding:15px;">
                        <div style="font-weight:bold; font-size:16px; margin-bottom:5px;">${topic.title}</div>
                        <div style="font-size:12px; color:#666; display:flex; justify-content:space-between;">
                            <span>👤 ${topic.author_name || 'Anonymous'}</span>
                            <span>📅 ${SetaeCore.formatRelativeDate(topic.date)}</span>
                        </div>
                        <div style="font-size:12px; color:#888; margin-top:5px;">
                            💬 ${topic.comment_count || 0} comments
                        </div>
                    </div>
                `;
                container.append(html);
            });
        });
    }

    function openTopicDetail(id) {
        $('#section-com').hide();
        $('#section-com-detail').show().scrollTop(0);
        $('#topic-detail-content').html('<p>Loading...</p>');
        $('#topic-comments-list').empty();

        SetaeAPI.getTopicDetail(id, function (data) {
            // ヘッダー設定
            $('#detail-header-title').text(data.title);
            $('#comment-post-id').val(data.id);

            // 本文描画
            $('#topic-detail-content').html(`
                <div class="setae-card" style="margin-bottom:20px; padding:15px; background:#fff;">
                    <div style="font-size:12px; color:#666; margin-bottom:10px;">
                        👤 ${data.author_name} / 📅 ${data.date}
                    </div>
                    <div style="line-height:1.6; white-space:pre-wrap;">${data.content}</div>
                </div>
            `);

            // コメント描画
            const commentsContainer = $('#topic-comments-list');
            commentsContainer.empty();

            if (data.comments && data.comments.length > 0) {
                data.comments.forEach(comment => {
                    commentsContainer.append(`
                        <div class="setae-comment-row" style="border-bottom:1px solid #eee; padding:10px 0;">
                            <div style="font-size:12px; color:#888; margin-bottom:4px;">
                                <strong>${comment.author_name}</strong> - ${SetaeCore.formatRelativeDate(comment.date)}
                            </div>
                            <div style="font-size:14px;">${comment.content}</div>
                        </div>
                    `);
                });
            } else {
                commentsContainer.html('<p style="text-align:center; color:#ccc; margin-top:20px;">まだコメントはありません</p>');
            }
        });
    }

    // ==========================================
    // Encyclopedia Logic (New Implementation)
    // ==========================================

    function initEncyclopedia() {
        // 1. Restore Search
        const savedSearch = SetaeCore.state.encSearch;
        if (savedSearch) {
            $('#setae-enc-search').val(savedSearch);
        }

        // 2. Restore Filter
        const savedFilter = SetaeCore.state.encFilter || 'all';

        // Reset only encyclopedia buttons
        $('#setae-enc-filters .deck-pill').removeClass('active');

        const $targetPill = $(`#setae-enc-filters .deck-pill[data-filter="${savedFilter}"]`);
        if ($targetPill.length) {
            $targetPill.addClass('active');
        } else {
            $(`#setae-enc-filters .deck-pill[data-filter="all"]`).addClass('active');
            SetaeCore.state.encFilter = 'all';
        }

        // 3. Run
        runEncyclopediaFilter();
    }

    function runEncyclopediaFilter() {
        const query = (SetaeCore.state.encSearch || '').toLowerCase().trim();
        const filter = SetaeCore.state.encFilter || 'all';
        const sort = SetaeCore.state.encSort || 'name';

        const $container = $('#setae-species-list-container');
        const $items = $container.find('.js-species-item');

        // 1. Filter Logic
        $items.each(function () {
            const $el = $(this);
            let matchSearch = true;
            let matchFilter = true;

            // Search Filter
            if (query) {
                const searchData = ($el.data('search') || '').toString();
                if (searchData.indexOf(query) === -1) matchSearch = false;
            }

            // Category/Region Filter
            if (filter !== 'all') {
                if (filter.startsWith('style_')) {
                    if ($el.data('filter-style') !== filter) matchFilter = false;
                } else if (filter.startsWith('region_')) {
                    if ($el.data('filter-region') !== filter) matchFilter = false;
                }
            }

            if (matchSearch && matchFilter) {
                $el.show().addClass('visible-item');
            } else {
                $el.hide().removeClass('visible-item');
            }
        });

        // 2. Sort Logic
        const $visibleItems = $items.filter('.visible-item');

        $visibleItems.sort(function (a, b) {
            const $a = $(a);
            const $b = $(b);

            if (sort === 'keeping') {
                // Keeping Count (Desc)
                const countA = parseInt($a.data('sort-count') || 0);
                const countB = parseInt($b.data('sort-count') || 0);
                if (countA !== countB) return countB - countA;
                return ($a.data('sort-name') || '').localeCompare($b.data('sort-name') || '');
            }

            // Default: Name (Asc)
            return ($a.data('sort-name') || '').localeCompare($b.data('sort-name') || '');
        });

        $visibleItems.detach().appendTo($container);
    }

    function toggleEncSortMenu(e) {
        e.preventDefault(); e.stopPropagation();
        var $existing = $('#setae-enc-sort-menu');
        if ($existing.length > 0) { $existing.remove(); return; }

        const currentSort = SetaeCore.state.encSort || 'name';
        const getActiveClass = (key) => (key === currentSort ? ' active' : '');

        var menuDiv = document.createElement('div');
        menuDiv.id = 'setae-enc-sort-menu';
        menuDiv.innerHTML = `
            <div class="enc-sort-option${getActiveClass('name')}" data-sort="name">🔤 名前順 (A-Z)</div>
            <div class="enc-sort-option${getActiveClass('keeping')}" data-sort="keeping">🔥 人気順 (Keeping)</div>
        `;
        document.body.appendChild(menuDiv);

        var rect = $(this)[0].getBoundingClientRect();
        $(menuDiv).css({
            position: 'fixed', top: (rect.bottom + 10) + 'px', left: Math.max(10, rect.right - 180) + 'px',
            background: '#fff', border: '1px solid rgba(0,0,0,0.1)', borderRadius: '12px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.15)', zIndex: 999999, width: '180px', padding: '8px 0'
        });
        $('.enc-sort-option').css({ padding: '10px 16px', cursor: 'pointer', fontSize: '14px' });
        $('.enc-sort-option.active').css({ fontWeight: 'bold', color: '#2ecc71', background: '#f9f9f9' });
    }

    function handleEncSortOptionClick() {
        const sort = $(this).data('sort');
        SetaeCore.state.encSort = sort;
        localStorage.setItem('setae_enc_sort', sort);
        $('#setae-enc-sort-menu').remove();
        runEncyclopediaFilter();
    }

    // Removed: loadSpeciesBook() - Now handled by PHP in section-encyclopedia.php


    function handleToolbarShadow(scrollTop) {
        if (scrollTop > 10) $('.setae-toolbar-container').addClass('sticky-shadow');
        else $('.setae-toolbar-container').removeClass('sticky-shadow');
    }

    // ==========================================
    // Backward Compatibility & Globals
    // ==========================================

    // Ensure modules are loaded
    if (typeof SetaeUIDetail !== 'undefined') {
        window.loadSpiderDetail = SetaeUIDetail.loadSpiderDetail;
        window.deleteSpider = SetaeUIDetail.deleteSpider;
    }

    if (typeof SetaeUIActions !== 'undefined') {
        window.handleQuickAction = SetaeUIActions.handleQuickAction;
        // executeSwipeAction is also attached to window in some legacy logic maybe?
        window.executeSwipeAction = SetaeUIActions.executeSwipeAction;

        // Expose handlePreySelect if needed (it was in renderer)
        // But log-modal handles it.
    }

    if (typeof SetaeUILogModal !== 'undefined') {
        // savePreyList/resetPreyListToDefault are attached to window in log-modal.js
        window.handlePreySelect = SetaeUILogModal.handlePreySelect;
    }

    // Public API
    return {
        initListeners: initListeners,
        renderMySpiders: SetaeUIList.renderMySpiders,
        openSpeciesDetail: openSpeciesDetail
    };

})(jQuery);
