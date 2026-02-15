var SetaeUI = (function ($) {
    'use strict';

    // ==========================================
    // Initialization & Event Listeners
    // ==========================================



    $(document).ready(function () {
        // ★追加: 初期表示セクションの制御
        // 現在アクティブなナビゲーションを取得
        const $activeNav = $('.setae-nav-item.active');
        if ($activeNav.length) {
            const targetId = $activeNav.data('target');
            // 全セクションを隠す
            $('.setae-section').hide();
            // ターゲットだけ表示
            $('#' + targetId).show();
        } else {
            // アクティブがない場合はデフォルトでMy Spidersを表示（安全策）
            $('.setae-section').hide();
            $('#section-my').show();
            $('.setae-nav-item[data-target="section-my"]').addClass('active');
        }

        initListeners();
        checkInitialLoad();


    });

    function initListeners() {
        // Tab Navigation
        $('.setae-nav-item').on('click', handleTabClick);

        // --- Community Listeners (追記) ---

        // 1. 新規トピックモーダルを開く
        $(document).on('click', '#btn-create-topic', function () {
            $('#modal-new-topic').fadeIn(200);
        });

        // 2. 新規トピックモーダルを閉じる
        $(document).on('click', '#close-topic-modal', function () {
            $('#modal-new-topic').fadeOut(200);
        });

        // カテゴリフィルタボタン
        $(document).on('click', '.com-filter-btn', function () {
            $('.com-filter-btn').removeClass('active').css({ background: '#fff', color: '#666' });
            $(this).addClass('active').css({ background: '#eee', color: '#333' }); // 簡易スタイル適用

            const type = $(this).data('type');
            loadTopics(type);
        });

        // 3. 新規トピック作成フォーム送信
        $(document).on('submit', '#setae-topic-form', function (e) {
            e.preventDefault();
            const title = $('#topic-title').val();
            const content = $('#topic-content').val();
            const type = $('#topic-type').val(); // カテゴリ取得

            // ボタンを無効化して二重送信防止
            const $btn = $(this).find('button[type="submit"]');
            $btn.prop('disabled', true).text('送信中...');

            SetaeAPI.createTopic({ title: title, content: content, type: type }, function (res) {
                $btn.prop('disabled', false).text('投稿する');
                $('#modal-new-topic').fadeOut();
                $('#topic-title').val('');
                $('#topic-content').val('');
                SetaeCore.showToast('トピックを作成しました', 'success');
                loadTopics(); // リスト再読み込み（デフォルトはAll）
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
        // -----------------------------
        // 画像添付用イベントハンドラ
        // -----------------------------
        // カメラアイコンクリックでファイル選択
        $(document).on('click', '#btn-trigger-comment-image', function () {
            $('#comment-image-input').click();
        });

        // 画像選択時のプレビュー表示
        $(document).on('change', '#comment-image-input', function (e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function (ev) {
                    $('#comment-image-preview img').attr('src', ev.target.result);
                    $('#comment-image-preview').fadeIn();
                };
                reader.readAsDataURL(file);
            }
        });

        // プレビュー削除ボタン
        $(document).on('click', '#btn-clear-comment-image', function () {
            $('#comment-image-input').val('');
            $('#comment-image-preview').hide();
        });

        // 送信処理
        $(document).on('submit', '#setae-comment-form', function (e) {
            e.preventDefault();
            const topicId = $('#comment-post-id').val();
            const content = $('#comment-content').val();
            const file = $('#comment-image-input')[0].files[0]; // ファイルを取得

            if (!content && !file) return;

            SetaeAPI.postComment(topicId, content, file, function () {
                $('#comment-content').val('');
                $('#comment-image-input').val(''); // inputクリア
                $('#comment-image-preview').hide(); // プレビュー非表示
                openTopicDetail(topicId); // 再読み込み
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

            // ▼ 修正: スクロールを阻止(preventDefault)するために、passive: false オプション付きのネイティブイベントとして登録
            document.addEventListener('touchmove', function (e) {
                // スワイプ対象の行の上での操作か判定
                if ($(e.target).closest('.setae-spider-list-row').length) {
                    SetaeUIActions.handleTouchMove(e);
                }
            }, { passive: false });

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

    function loadTopics(type = 'all') {
        $('#setae-topic-list').html('<p style="text-align:center; padding:20px; color:#999;"><span class="spinner"></span> 読み込み中...</p>');

        SetaeAPI.fetchTopics({ type: type }, function (data) {
            const container = $('#setae-topic-list');
            container.empty();

            if (!data || data.length === 0) {
                container.html('<div style="text-align:center; padding:40px; color:#999;">トピックがありません。<br>最初の投稿を作成してみましょう！</div>');
                return;
            }

            data.forEach(topic => {
                // カテゴリごとのバッジ色設定
                let typeLabel = 'その他';
                let typeColor = '#999';
                switch (topic.type) {
                    case 'question': typeLabel = '質問'; typeColor = '#e74c3c'; break;
                    case 'chat': typeLabel = '雑談'; typeColor = '#2ecc71'; break;
                    case 'breeding': typeLabel = 'ブリード'; typeColor = '#9b59b6'; break;
                }

                const html = `
                    <div class="setae-topic-row setae-card" data-id="${topic.id}" style="cursor:pointer; margin-bottom:10px; padding:15px; position:relative;">
                        <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:8px;">
                            <span style="background:${typeColor}; color:#fff; font-size:10px; padding:2px 8px; border-radius:10px; font-weight:bold;">${typeLabel}</span>
                            <span style="font-size:11px; color:#999;">${SetaeCore.formatRelativeDate(topic.date)}</span>
                        </div>
                        
                        <div style="font-weight:bold; font-size:16px; margin-bottom:8px; line-height:1.4;">${topic.title}</div>
                        
                        <div style="font-size:13px; color:#666; margin-bottom:10px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                            ${topic.excerpt}
                        </div>

                        <div style="font-size:12px; color:#888; display:flex; justify-content:space-between; align-items:center; border-top:1px solid #f5f5f5; padding-top:8px;">
                            <span>👤 ${topic.author_name || 'Anonymous'}</span>
                            <span style="display:flex; align-items:center;">
                                💬 <span style="margin-left:4px; font-weight:bold; color:${topic.comment_count > 0 ? '#333' : '#ccc'}">${topic.comment_count}</span>
                            </span>
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
                    let imageHtml = '';
                    if (comment.image) {
                        imageHtml = `<div style="margin-top:5px;"><img src="${comment.image}" style="max-width:100px; max-height:100px; border-radius:4px; cursor:pointer;" onclick="window.open(this.src, '_blank')"></div>`;
                    }

                    commentsContainer.append(`
                        <div class="setae-comment-row" style="border-bottom:1px solid #eee; padding:10px 0;">
                            <div style="font-size:12px; color:#888; margin-bottom:4px;">
                                <strong>${comment.author_name}</strong> - ${SetaeCore.formatRelativeDate(comment.date)}
                            </div>
                            <div style="font-size:14px;">
                                ${comment.content}
                                ${imageHtml}
                            </div>
                        </div>
                    `);
                });
            } else {
                commentsContainer.html('<p style="text-align:center; color:#ccc; margin-top:20px;">まだコメントはありません</p>');
            }
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
