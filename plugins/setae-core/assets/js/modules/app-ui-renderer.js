var SetaeUI = (function ($) {
    'use strict';

    // ==========================================
    // Initialization & Event Listeners
    // ==========================================
    $(document).ready(function () {
        initListeners();
        checkInitialLoad();
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

        // Deck Filters
        $('.deck-pill').on('click', SetaeUIList.handleDeckFilterClick);

        // Sort Menu
        $(document).on('click', '#btn-sort-menu', SetaeUIList.toggleSortMenu);
        $(document).on('click', '.sort-option', SetaeUIList.handleSortOptionClick);
        $(document).on('click', SetaeUIList.closeSortMenuOutside);
        $(window).on('resize scroll', SetaeUIList.closeSortMenu);

        // List Item Click (Detail View)
        $(document).on('click', '.setae-spider-list-row', SetaeUIList.handleListItemClick);

        // Search Input
        $(document).on('input', '#setae-spider-search', SetaeUIList.handleSearchInput);

        // Initialize Species Search (Server-Side List)
        initSpeciesSearch();

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
            $('#enc-detail-title').text(data.title);
            $('#enc-detail-name').text(data.title);
            $('#enc-detail-genus').text(data.genus || '');
            $('#enc-detail-description').html(data.description ? data.description.replace(/\n/g, '<br>') : 'No description available.');
            $('#enc-detail-lifespan').text(data.lifespan || '-');
            $('#enc-detail-size').text(data.size ? data.size + ' cm' : '-');
            $('#enc-detail-temperament').text(data.temperament || 'Unknown');
            $('#enc-detail-keeping').html(`🔥 ${data.keeping_count} Keeping`);

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

    // New: Client-side filtering for Server-Side Rendered Species List
    function initSpeciesSearch() {
        $(document).on('input', '#setae-species-search', function () {
            const val = $(this).val().toLowerCase().trim();
            $('.js-species-item').each(function () {
                const searchData = $(this).data('search'); // string already lowercased from PHP
                if (!val || (searchData && searchData.indexOf(val) > -1)) {
                    $(this).show();
                } else {
                    $(this).hide();
                }
            });
        });
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
