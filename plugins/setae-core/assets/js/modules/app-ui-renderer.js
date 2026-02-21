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
            $('.com-filter-btn').removeClass('active')
            $(this).addClass('active')
            const type = $(this).data('type');
            loadTopics(type);
        });

        // "もっと見る" ボタン (トピック一覧)
        $(document).on('click', '#btn-load-more-topics', function () {
            loadTopics(null, true); // type=null (維持), isLoadMore=true
        });

        // 3. 新規トピック作成フォーム送信
        $(document).on('submit', '#setae-topic-form', function (e) {
            e.preventDefault();
            const title = $('#topic-title').val();
            const content = $('#topic-content').val();
            const type = $('#topic-type').val(); // カテゴリ取得

            // ボタンを無効化して二重送信防止
            const $btn = $(this).find('button[type="submit"]');
            $btn.prop('disabled', true).text(setaeI18n.sending);

            SetaeAPI.createTopic({ title: title, content: content, type: type }, function (res) {
                $btn.prop('disabled', false).text(setaeI18n.post);
                $('#modal-new-topic').fadeOut();
                $('#topic-title').val('');
                $('#topic-content').val('');
                SetaeCore.showToast(setaeI18n.topic_created, 'success');
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


        // ==========================================
        // コメント制御用: 文字数カウンター & ページネーション
        // ==========================================

        // 文字数カウンターイベント
        $(document).on('input', '#comment-content', function () {
            const max = 1000;
            const current = $(this).val().length;
            const $counter = $('#comment-char-count');

            $counter.text(`${current} / ${max}`);

            if (current > max) {
                $counter.css('color', '#e74c3c'); // 赤色
                $('.btn-send-comment').prop('disabled', true);
            } else {
                $counter.css('color', '#aaa');
                $('.btn-send-comment').prop('disabled', false);
            }
        });

        // 「もっと見る」クリックイベント
        $(document).on('click', '#btn-load-more-comments', function () {
            const nextPage = $(this).data('next');
            // ボタンをローディング表示に
            $(this).text(setaeI18n.loading).prop('disabled', true);

            loadComments(currentTopicId, nextPage);
        });

        // 送信処理 (文字数チェック追加)
        $(document).on('submit', '#setae-comment-form', function (e) {
            e.preventDefault();

            const $form = $(this);
            const $btn = $form.find('button[type="submit"]');
            const $input = $('#comment-content');

            // 二重送信防止
            if ($btn.prop('disabled')) return;

            const topicId = $('#comment-post-id').val();
            const content = $input.val().trim();
            const file = $('#comment-image-input')[0].files[0];

            // 文字数チェック
            if (content.length > 1000) {
                SetaeCore.showToast(setaeI18n.comment_limit, 'error');
                return;
            }

            // 空送信防止
            if (!content && !file) return;

            // 1. 送信中状態にする (ローディング表示)
            const originalIcon = $btn.html();
            $btn.prop('disabled', true).html('<div class="spinner-icon"></div>');
            $input.prop('disabled', true);

            // 2. API送信
            SetaeAPI.postComment(topicId, content, file, function (res) {
                // --- 成功時の処理 ---

                // フォームのリセット
                $input.val('').prop('disabled', false).focus();
                $('#comment-image-input').val('');
                $('#comment-image-preview').hide().css('display', 'none'); // hide()だけだとflexが残る場合があるので念のため

                // 文字数カウンターリセット
                $('#comment-char-count').text('0 / 1000').css('color', '#aaa');

                // ボタンを元に戻す
                $btn.prop('disabled', false).html(originalIcon);

                openTopicDetail(topicId); // 再読み込み (これは1ページ目に戻る)
                SetaeCore.showToast(setaeI18n.comment_posted, 'success');
            });

            // ★重要: エラー時やタイムアウト時にボタンが戻らないのを防ぐため
            setTimeout(function () {
                if ($btn.prop('disabled')) {
                    // 10秒経ってもdisabledのままなら強制復帰
                    $btn.prop('disabled', false).html(originalIcon);
                    $input.prop('disabled', false);
                }
            }, 10000);
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
        $('#enc-detail-title').text(setaeI18n.loading);
        $('#enc-gallery-grid').html(`<p style="text-align:center;">${setaeI18n.loading}</p>`);

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
            $('#enc-detail-size').text(data.size ? String(data.size).replace(/cm/gi, '').trim() + ' cm' : '-');
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
            const emptyMsg = $('#enc-gallery-empty');

            if (data.featured_gallery && data.featured_gallery.length > 0) {
                gallery.empty().show();
                emptyMsg.hide();
                data.featured_gallery.forEach(item => {
                    const html = `
                        <div class="gallery-item-trigger" style="height:100px; overflow:hidden; border-radius:4px; cursor:pointer; position:relative;"
                             data-url="${item.url}"
                             data-username="${item.username}"
                             data-avatar="${item.avatar || ''}">
                            <img src="${item.url}" style="width:100%; height:100%; object-fit:cover; transition:transform 0.3s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                        </div>
                    `;
                    gallery.append(html);
                });
            } else {
                gallery.hide();
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

    // ==========================================
    // トピック一覧 (Community)
    // ==========================================
    let currentTopicListPage = 1;
    let currentTopicListType = 'all';
    let isTopicListLoading = false;

    function loadTopics(type = null, isLoadMore = false) {
        if (isTopicListLoading) return;
        isTopicListLoading = true;

        if (type) {
            currentTopicListType = type;
        }

        if (!isLoadMore) {
            currentTopicListPage = 1;
            $('#setae-topic-list').html(`<p style="text-align:center; padding:20px; color:#999;"><span class="spinner"></span> ${setaeI18n.loading}</p>`);
            $('#setae-topic-load-more').hide();
        } else {
            $('#btn-load-more-topics').hide();
            $('#loader-topics').show();
        }

        SetaeAPI.fetchTopics({
            type: currentTopicListType,
            page: currentTopicListPage
        }, function (response) {
            isTopicListLoading = false;
            const container = $('#setae-topic-list');

            // APIレスポンス形式 { items: [...], has_next: true/false } に対応
            // 古い形式(配列のみ)の場合は items = response
            const topics = response.items || response;
            const hasNext = response.has_next || false;

            if (!isLoadMore) {
                container.empty();
            } else {
                $('#loader-topics').hide();
            }

            if (!topics || topics.length === 0) {
                if (!isLoadMore) {
                    $('#setae-topic-list').html(`<div style="text-align:center; padding:40px; color:#999;">${setaeI18n.no_topics}</div>`);
                }
                $('#setae-topic-load-more').hide();
                return;
            }

            topics.forEach(topic => {
                // カテゴリごとのバッジ色設定
                let typeLabel = 'その他';
                let typeColor = '#999';
                switch (topic.type) {
                    case 'question': typeLabel = '質問'; typeColor = '#e74c3c'; break;
                    case 'chat': typeLabel = '雑談'; typeColor = '#2ecc71'; break;
                    case 'breeding': typeLabel = 'ブリード'; typeColor = '#9b59b6'; break;
                }

                // アバターまたはイニシャルの表示ロジック
                // APIレスポンスに avatar_url / initial 等が含まれていない場合はフォールバック
                let topicListAvatarHtml = '';
                if (topic.author_avatar) {
                    topicListAvatarHtml = `<img src="${topic.author_avatar}" alt="${topic.author_name}" class="avatar-img">`;
                } else if (topic.author_initial) {
                    topicListAvatarHtml = `<span class="avatar-initial">${topic.author_initial}</span>`;
                } else {
                    // 古いデータ形式等へのフォールバック（最初の1文字を取る）
                    let initial = topic.author_name ? topic.author_name.substring(0, 1) : '?';
                    topicListAvatarHtml = `<span class="avatar-initial">${initial}</span>`;
                }

                const html = `
                    <div class="setae-topic-row setae-card" data-id="${topic.id}">
                        <div class="setae-topic-row-header">
                            <span class="setae-topic-badge badge-${topic.type}">${typeLabel}</span>
                            <span class="setae-topic-time">${SetaeCore.formatRelativeDate(topic.date)}</span>
                        </div>
                        
                        <h3 class="setae-topic-title">${topic.title}</h3>
                        
                        <div class="setae-topic-excerpt">
                            ${topic.excerpt}
                        </div>

                        <div class="setae-topic-row-footer">
                            <div class="setae-topic-author">
                                <div class="setae-user-avatar avatar-sm">
                                    ${topicListAvatarHtml}
                                </div>
                                <span class="setae-author-name">${topic.author_name || 'Anonymous'}</span>
                            </div>

                            <div class="setae-topic-comments-count">
                                <img draggable="false" role="img" class="emoji" alt="💬" src="https://s.w.org/images/core/emoji/17.0.2/svg/1f4ac.svg">
                                <span class="count">${topic.comment_count}</span>
                            </div>
                        </div>
                    </div>
                `;
                container.append(html);
            });

            // 次のページがあるなら「もっと見る」を表示
            if (hasNext) {
                $('#setae-topic-load-more').show();
                $('#btn-load-more-topics').show();
            } else {
                $('#setae-topic-load-more').hide();
            }

            if (hasNext) {
                currentTopicListPage++;
            }
        });
    }

    // ==========================================
    // コメント制御用 変数
    // ==========================================
    let currentTopicPage = 1;
    let currentTopicId = null;

    function openTopicDetail(id) {
        currentTopicId = id;
        currentTopicPage = 1; // ページリセット

        $('#section-com').hide();
        $('#section-com-detail').show().scrollTop(0);
        $('#topic-detail-content').html(`<p>${setaeI18n.loading}</p>`);
        $('#topic-comments-list').empty();
        $('#btn-load-more-comments').remove(); // 前のボタンがあれば削除

        loadComments(id, 1);
    }

    // コメント読み込み関数
    function loadComments(id, page) {
        SetaeAPI.getTopicDetail(id, page, function (data) {
            // 初回ロード時はトピック本文などを描画
            if (page === 1) {
                // ヘッダー設定
                $('#detail-header-title').text(data.title);
                $('#comment-post-id').val(data.id);

                // アバターまたはイニシャルの表示ロジック
                let topicAvatarHtml = data.author_avatar ?
                    `<img src="${data.author_avatar}" alt="${data.author_name}" class="avatar-img">` :
                    `<span class="avatar-initial">${data.author_initial}</span>`;

                // 本文描画
                $('#topic-detail-content').html(`
                    <div class="setae-card setae-topic-detail-card">
                        <div class="setae-topic-meta">
                            <div class="setae-user-avatar">
                                ${topicAvatarHtml}
                            </div>
                            <span class="setae-author-name">${data.author_name}</span>
                            <span class="meta-divider">/</span> <img draggable="false" role="img" class="emoji" alt="📅" src="https://s.w.org/images/core/emoji/17.0.2/svg/1f4c5.svg"> ${data.date}
                        </div>
                        <div class="setae-topic-body">
                            <p>${data.content}</p>
                        </div>
                    </div>
                `);

                // ★追加: 文字数カウンター用のSpanを挿入 (フォームはPHP側にある想定だが、JSで動的に入れるならここ)
                // input要素の親Divに相対配置で入れる
                const $inputWrapper = $('#comment-content').parent();
                if ($('#comment-char-count').length === 0) {
                    $inputWrapper.css('position', 'relative');
                    $inputWrapper.append('<span id="comment-char-count" style="position:absolute; bottom:-18px; right:0; font-size:10px; color:#aaa;">0 / 1000</span>');
                }
            }

            // コメント描画
            const commentsContainer = $('#topic-comments-list');

            // ページ1でコメントがない場合
            if (page === 1 && (!data.comments || data.comments.length === 0)) {
                commentsContainer.html('<p style="text-align:center; color:#ccc; margin-top:20px;">まだコメントはありません</p>');
                return;
            }

            // コメント追加
            if (data.comments && data.comments.length > 0) {
                data.comments.forEach(comment => {
                    let imageHtml = '';
                    if (comment.image) {
                        imageHtml = `<div style="margin-top:5px;"><img src="${comment.image}" style="max-width:100px; max-height:100px; border-radius:4px; cursor:pointer;" onclick="window.open(this.src, '_blank')"></div>`;
                    }

                    let cAvatarHtml = comment.author_avatar ?
                        `<img src="${comment.author_avatar}" alt="${comment.author_name}" class="avatar-img">` :
                        `<span class="avatar-initial">${comment.author_initial}</span>`;

                    commentsContainer.append(`
                        <div class="setae-comment-row">
                            <div class="setae-comment-meta">
                                <div class="setae-user-avatar">
                                    ${cAvatarHtml}
                                </div>
                                <span class="setae-author-name">${comment.author_name}</span>
                                <span class="meta-divider">-</span> ${SetaeCore.formatRelativeDate(comment.date)}
                            </div>
                            <div class="setae-comment-body">
                                ${comment.content}
                                ${imageHtml}
                            </div>
                        </div>
                    `);
                });
            }

            // 「もっと見る」ボタンの制御
            $('#btn-load-more-comments').remove();
            if (data.has_next) {
                commentsContainer.after(`
                    <button id="btn-load-more-comments" data-next="${page + 1}" class="setae-btn-secondary" style="width:100%; margin-top:10px; padding:10px; border-radius:8px;">
                        もっと見る
                    </button>
                `);
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

    // ギャラリー画像クリックイベント
    $(document).off('click', '.gallery-item-trigger').on('click', '.gallery-item-trigger', function () {
        const url = $(this).data('url');
        const username = $(this).data('username') || 'Unknown User';
        const avatar = $(this).data('avatar');

        $('#gallery-modal-img').attr('src', url);
        $('#gallery-modal-username').text(username);

        const $avatarContainer = $('#gallery-modal-avatar');
        if (avatar) {
            $avatarContainer.html(`<img src="${avatar}" style="width:100%; height:100%; object-fit:cover;">`);
        } else {
            // アイコンがない場合は頭文字を生成 (Setaeのテーマカラーグラデーション)
            const initial = username.charAt(0).toUpperCase();
            $avatarContainer.html(`<div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; background:linear-gradient(135deg, var(--primary-color, #2ecc71), #27ae60); color:#fff; font-size:16px; font-weight:bold;">${initial}</div>`);
        }

        $('#modal-gallery-view').fadeIn(200).css('display', 'flex');
    });

    // ギャラリーモーダルを閉じる
    $(document).off('click', '#close-gallery-modal, #modal-gallery-view').on('click', '#close-gallery-modal, #modal-gallery-view', function (e) {
        if (e.target === this || e.target.id === 'close-gallery-modal') {
            $('#modal-gallery-view').fadeOut(200);
        }
    });

    // Public API
    return {
        initListeners: initListeners,
        renderMySpiders: SetaeUIList.renderMySpiders,
        openSpeciesDetail: openSpeciesDetail
    };

})(jQuery);
