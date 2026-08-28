var SetaeUI = (function ($) {
    'use strict';

    // ▼ 追加: 図鑑一覧のスクロール位置を記憶する変数
    let encScrollPosition = 0;
    let topicSpeciesSearchTimer = null;
    const TOPIC_DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
    let topicDraftSaveTimer = null;
    let isRestoringTopicDraft = false;
    let careFeedMediaViewerTrigger = null;
    let currentSocialHubView = 'care';
    let latestCareFeedUnreadCount = 0;
    let latestCommunityUnreadCount = 0;
    let socialQuickComposeImageFile = null;
    let socialQuickComposeImagePreviewUrl = '';
    let socialQuickDraftSaveTimer = null;
    let socialLivePollTimer = null;
    let socialLiveRequest = null;
    let socialNewPostsScrollRaf = null;
    const socialLiveStatusResetTimers = {
        care: null,
        community: null
    };
    const PRIMARY_SECTION_STORAGE_KEY = 'setae_last_primary_section_v1';
    const SOCIAL_QUICK_DRAFT_STORAGE_KEY = 'setae_social_quick_draft_v1';
    const SOCIAL_QUICK_DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
    const SOCIAL_LIVE_POLL_INTERVAL_MS = 20000;
    const SOCIAL_LIVE_RETRY_INTERVAL_MS = 45000;
    const PRIMARY_SECTION_IDS = [
        'section-enc',
        'section-my',
        'section-baby',
        'section-care-feed',
        'section-com'
    ];

    function revealEncyclopediaDetailPanel($panel) {
        if (
            !$panel.length
            || !window.matchMedia
            || !window.matchMedia('(max-width: 767px)').matches
        ) {
            return;
        }

        const panelElement = $panel.get(0);
        const tabsElement = document.querySelector('#section-enc-detail .enc-detail-tabs');
        if (!panelElement || !tabsElement) return;

        window.requestAnimationFrame(function () {
            const stickyTop = parseFloat(window.getComputedStyle(tabsElement).top) || 0;
            const targetTop = window.pageYOffset
                + panelElement.getBoundingClientRect().top
                - stickyTop
                - tabsElement.offsetHeight
                - 12;
            const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

            window.scrollTo({
                top: Math.max(0, targetTop),
                behavior: prefersReducedMotion ? 'auto' : 'smooth'
            });
        });
    }

    // ==========================================
    // Initialization & Event Listeners
    // ==========================================



    $(document).ready(function () {
        const initialSection = resolveInitialPrimarySection();
        activateInitialPrimarySection(initialSection);

        initListeners();
        restoreSocialQuickComposeDraft();
        checkInitialLoad(initialSection);
        startSocialLiveUpdates();
        if (!(window.SetaeSettings && SetaeSettings.guest_mode)) {
            refreshCareFeedUnread();
            refreshCommunityUnread();
            refreshCommunitySpeciesPulse();
        }


    });

    function initListeners() {
        // Tab Navigation
        $('.setae-nav-item').on('click', handleTabClick);
        $(document).on('click', '.js-social-hub-tab', handleSocialHubTabClick);
        $(document).on('click', '.js-social-filter-toggle', handleSocialFilterToggle);
        $(document).on('click', '.js-social-new-posts-jump', handleSocialNewPostsJump);
        $(document).on('input', '.js-social-quick-content', handleSocialQuickComposeInput);
        $(document).on('input change', '.js-social-compose-subject-input, .js-social-compose-media-alt, .social-quick-compose-type', handleSocialQuickComposeDraftChange);
        $(document).on('focusin', '.js-social-quick-compose', function () {
            $(this).addClass('is-expanded');
        });
        $(document).on('click', '.js-social-compose-image', handleSocialComposeImageTrigger);
        $(document).on('change', '.js-social-compose-file', handleSocialComposeImageChange);
        $(document).on('click', '.js-social-compose-media-remove', clearSocialComposeImage);
        $(document).on('click', '.js-social-compose-subject-toggle', handleSocialComposeSubjectToggle);
        $(document).on('submit', '.js-social-quick-compose', handleSocialQuickComposeSubmit);
        $(document).on('click', '.js-social-cw-toggle', handleSocialContentWarningToggle);
        $(document).on('click', '.js-social-reaction-picker-toggle', handleSocialReactionPickerToggle);
        $(document).on('click', '.js-social-share-post', handleSocialPostShare);
        $(document).on('visibilitychange', handleSocialLiveEnvironmentChange);
        $(window).on('online offline', handleSocialLiveEnvironmentChange);
        $(window).on('scroll.setaeSocialNewPosts', handleSocialNewPostsScroll);

        // --- Community Listeners (追記) ---

        // 1. 新規トピックモーダルを開く
        $(document).on('click', '#btn-create-topic, .js-open-topic-modal', function (e) {
            const spiderId = $(this).data('id');
            if (spiderId && openTopicModalForSpider(spiderId, $(this).data('type') || 'note', $(this).data('source') || 'topic_modal')) {
                e.preventDefault();
                e.stopPropagation();
                return;
            }

            openTopicModal();
        });

        $(document).on('click', '.js-open-species-topic-modal', handleOpenSpeciesTopicModal);
        $(document).on('click', '.js-open-community-empty-topic', handleCommunityEmptyTopicClick);

        $(document).on('click', '.js-go-enc', function () {
            $('.setae-nav-item[data-target="section-enc"]').trigger('click');
        });

        // 2. 新規トピックモーダルを閉じる
        $(document).on('click', '#close-topic-modal', function () {
            saveTopicDraft();
            $('#modal-new-topic').fadeOut(200);
        });

        $(document).on('click', '.topic-template-btn', handleTopicTemplateClick);
        $(document).on('input change', '#topic-title, #topic-content, #topic-type', saveTopicDraftDebounced);
        $(document).on('click', '#btn-topic-draft-discard', discardTopicDraft);
        $(document).on('input', '#topic-related-species-search', handleTopicRelatedSpeciesSearch);
        $(document).on('click', '.topic-species-suggestion', function () {
            setTopicRelatedSpecies({
                id: $(this).attr('data-id'),
                title: $(this).attr('data-title') || '',
                ja_name: $(this).attr('data-ja-name') || '',
                thumb: $(this).attr('data-thumb') || ''
            });
            saveTopicDraftDebounced();
        });
        $(document).on('click', '#topic-related-species-clear', function (e) {
            e.preventDefault();
            e.stopPropagation();
            clearTopicRelatedSpecies();
            saveTopicDraftDebounced();
        });
        $(document).on('click', '.topic-related-species-chip', function (e) {
            e.preventDefault();
            e.stopPropagation();
            const id = $(this).data('id');
            if (!id) return;
            $('#section-com, #section-com-detail').hide();
            syncPrimaryNav('section-enc');
            openSpeciesDetail(id);
        });

        // カテゴリフィルタボタン
        $(document).on('click', '.com-filter-btn', function () {
            $('.com-filter-btn').removeClass('active');
            $(this).addClass('active');
            const type = $(this).data('type');
            loadTopics(type);
        });

        // "もっと見る" ボタン (トピック一覧)
        $(document).on('click', '#btn-load-more-topics', function () {
            loadTopics(currentTopicListType, true); // type=null (維持), isLoadMore=true
        });

        $(document).on('click', '#btn-load-more-care-feed', function () {
            loadCareFeed(true);
        });
        $(document).on('click', '.js-retry-care-feed', function () {
            loadCareFeed(false);
        });
        $(document).on('click', '.js-retry-topics', function () {
            loadTopics(currentTopicListType, false);
        });

        $(document).on('click', '.care-feed-filter-btn', handleCareFeedFilterClick);
        $(document).on('click', '.care-feed-sort-btn', handleCareFeedSortClick);
        $(document).on('change', '#care-feed-filter-select', handleCareFeedFilterSelectChange);
        $(document).on('change', '#care-feed-sort-select', handleCareFeedSortSelectChange);
        $(document).on('click', '.care-feed-scope-btn', handleCareFeedScopeClick);
        $(document).on('click', '.com-scope-btn', handleCommunityScopeClick);
        $(document).on('click', '.js-care-feed-clear-filter', handleCareFeedClearFilterClick);
        $(document).on('click', '.js-care-feed-clear-scope', handleCareFeedClearScopeClick);
        $(document).on('click', '.js-care-feed-go-record', handleCareFeedGoRecordClick);
        $(document).on('click', '.js-care-feed-relationships-toggle', handleCareFeedRelationshipsToggle);
        $(document).on('click', '.js-care-feed-media-open', handleCareFeedMediaOpen);
        $(document).on('click', '#setae-care-feed-media-viewer .js-care-feed-media-close', closeCareFeedMediaViewer);
        $(document).on('click', '#setae-care-feed-media-viewer', handleCareFeedMediaViewerBackdrop);
        $(document).on('click', '.js-care-feed-actions-toggle', handleCareFeedActionsToggle);
        $(document).on('click', function (e) {
            if (!$(e.target).closest('.care-feed-actions').length) {
                closeCareFeedActionMenus();
            }
            if (!$(e.target).closest('.social-reaction-control').length) {
                closeSocialReactionPickers();
            }
        });
        $(document).on('keydown', handleCareFeedOverlayKeydown);
        $(window).on('resize.setaeCareFeedActionMenu scroll.setaeCareFeedActionMenu', function () {
            if ($('.care-feed-actions.is-open').length) {
                closeCareFeedActionMenus();
            }
        });

        $(document).on('click', '.setae-care-feed-item', function (e) {
            if ($(e.target).closest('button, a, input, textarea, select').length) return;
            const id = $(this).data('id');
            if (id) openCareFeedDetail(id);
        });
        $(document).on('keydown', '.social-timeline-post[tabindex="0"]', handleSocialTimelinePostKeydown);

        $(document).on('click', '.js-care-feed-comment-open', handleCareFeedCommentOpen);
        $(document).on('click', '.js-care-feed-preview-comment', handleCareFeedPreviewCommentOpen);
        $(document).on('click', '.js-care-feed-unshare', handleCareFeedUnshare);
        $(document).on('click', '.js-care-feed-report', handleCareFeedReport);
        $(document).on('click', '.js-care-feed-copy-link', handleCareFeedCopyLink);
        $(document).on('click', '.js-care-feed-copy-share-text', handleCareFeedCopyShareText);
        $(document).on('click', '.js-care-feed-share-outbound', handleCareFeedOutboundShare);
        $(document).on('click', '.js-social-follow-toggle', handleSocialFollowToggle);
        $(document).on('click', '.js-social-block', handleSocialBlock);
        $(document).on('click', '.js-social-unblock', handleSocialUnblock);
        $(document).on('click', '.js-care-reaction', handleCareFeedReactionClick);
        $(document).on('click', '.js-open-care-feed-activity', function (e) {
            e.preventDefault();
            e.stopPropagation();
            const id = $(this).data('id');
            const commentId = parseInt($(this).data('comment-id'), 10) || 0;
            const activityType = $(this).data('activity-type') || '';
            if (id) {
                if (typeof SetaeCore.track === 'function') {
                    SetaeCore.track('care_feed_activity_open', {
                        type: activityType,
                        has_comment: !!commentId
                    });
                }
                markCareFeedRead({ clearPanel: true });
                openCareFeedDetail(id, {
                    focusCommentId: commentId,
                    activityType: activityType
                });
            }
        });
        $(document).on('click', '#btn-care-feed-activity-dismiss', function (e) {
            e.preventDefault();
            e.stopPropagation();
            markCareFeedRead({ clearPanel: true });
        });
        $(document).on('click', '.js-care-comment-delete', handleCareFeedCommentDelete);
        $(document).on('click', '.js-care-comment-report', handleCareFeedCommentReport);
        $(document).on('click', '.js-care-comment-reply', handleCareFeedCommentReply);
        $(document).on('click', '.js-care-comment-parent', handleCareFeedCommentParentOpen);
        $(document).on('click', '.js-care-feed-comment-focus', handleCareFeedCommentFocus);
        $(document).on('click', '#btn-care-feed-reply-cancel', clearCareFeedReplyTarget);
        $(document).on('click', '.js-care-comment-template', handleCareFeedCommentTemplateClick);
        $(document).on('click', '.js-topic-comment-template', handleTopicCommentTemplateClick);
        $(document).on('click', '.js-topic-comment-focus', handleTopicCommentFocus);

        $(document).on('click', '#btn-back-to-care-feed', function () {
            $('#section-care-feed-detail').hide();
            $('#section-care-feed').fadeIn(160);
            loadCareFeed();
        });

        $(document).on('click', '#btn-load-more-care-comments', function () {
            loadCareFeedComments(true);
        });

        $(document).on('input', '#care-feed-comment-content', function () {
            $('#care-feed-comment-count').text($(this).val().length + ' / 1000');
        });

        $(document).on('submit', '#care-feed-comment-form', handleCareFeedCommentSubmit);

        // Search & Sort Event Listeners for 2ch-Style Community
        $(document).on('change', '#com-sort-select', function () {
            currentTopicSort = $(this).val();
            loadTopics(currentTopicListType, false);
        });

        $(document).on('keypress', '#com-search-input', function (e) {
            if (e.which == 13) {
                currentTopicSearch = $(this).val();
                loadTopics(currentTopicListType, false);
            }
        });

        $(document).on('click', '#com-search-btn', function () {
            currentTopicSearch = $('#com-search-input').val();
            loadTopics(currentTopicListType, false);
        });

        // 検索クリア（テキストボックスが空になったら再読み込み）
        $(document).on('input', '#com-search-input', function () {
            if ($(this).val() === '') {
                currentTopicSearch = '';
                loadTopics(currentTopicListType, false);
            }
        });

        // 3. 新規トピック作成フォーム送信
        $(document).on('submit', '#setae-topic-form', function (e) {
            e.preventDefault();
            const title = $('#topic-title').val();
            const content = $('#topic-content').val();
            const type = $('#topic-type').val(); // カテゴリ取得
            const relatedSpeciesId = $('#topic-related-species-id').val();

            // ボタンを無効化して二重送信防止
            const $btn = $(this).find('button[type="submit"]');
            $btn.prop('disabled', true).text(setaeI18n.sending);

            const request = SetaeAPI.createTopic({
                title: title,
                content: content,
                type: type,
                related_species_id: relatedSpeciesId
            }, function (res) {
                const createdTopicId = res && res.id ? parseInt(res.id, 10) : 0;

                clearTopicDraft();
                hideTopicDraftBanner();
                $('#modal-new-topic').fadeOut();
                resetTopicModal();
                SetaeCore.showToast('相談を作成しました。返信が来たら「反応あり」に表示されます。', 'success');

                if (createdTopicId) {
                    openTopicDetail(createdTopicId);
                    refreshCommunityUnread();

                    if (typeof SetaeCore.track === 'function') {
                        SetaeCore.track('community_topic_created_open_detail', {
                            type: type || 'question',
                            has_species: !!relatedSpeciesId
                        });
                    }
                } else {
                    loadTopics(); // リスト再読み込み（デフォルトはAll）
                }
            });
            if (request && request.always) {
                request.always(function () {
                    $btn.prop('disabled', false).text(setaeI18n.post);
                });
            } else {
                $btn.prop('disabled', false).text(setaeI18n.post);
            }
        });

        // 4. トピック詳細を開く (一覧のアイテムクリック時)
        $(document).on('click', '.setae-topic-row', function (e) {
            if ($(e.target).closest('button, a, input, select, textarea').length) return;
            const id = $(this).data('id');
            openTopicDetail(id);
        });
        $(document).on('click', '.js-open-topic-row', function (e) {
            e.preventDefault();
            e.stopPropagation();
            const id = $(this).data('id') || $(this).closest('.setae-topic-row').data('id');
            if (id) openTopicDetail(id);
        });

        $(document).on('click', '.js-open-unread-topic', function (e) {
            e.preventDefault();
            e.stopPropagation();
            const id = $(this).data('id');
            if (id) openTopicDetail(id);
        });

        $(document).on('click', '#btn-community-mark-all-read', handleCommunityMarkAllRead);
        $(document).on('click', '.js-open-species-topic-list', handleOpenSpeciesTopicList);
        $(document).on('click', '#btn-community-clear-species, .js-community-clear-species', clearCommunitySpeciesFilter);
        $(document).on('click', '.js-community-reset-filters', resetCommunityFilters);
        $(document).on('click', '.js-open-species-pulse', handleOpenSpeciesPulse);
        $(document).on('click', '.js-open-pulse-topic', handleOpenPulseTopic);
        $(document).on('click', '.topic-reaction-btn', handleTopicReactionClick);
        $(document).on('click', '.comment-reaction-btn', handleCommentReactionClick);
        $(document).on('click', '#btn-topic-toggle-resolved', handleTopicStatusToggle);

        // 5. 詳細から一覧に戻る
        $(document).on('click', '#btn-back-to-topics', function () {
            $('#section-com-detail').hide();
            $('#section-com').fadeIn(200);
            loadTopics(); // 最新状態に更新
            refreshCommunityUnread();
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
                    $('#comment-image-preview').css('display', 'inline-flex').hide().fadeIn();
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
                $counter.css('color', '#8e8e93');
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

        $(document).on('click', '#btn-reload-comments-from-start', function (e) {
            e.preventDefault();
            $(this).text(setaeI18n.loading).prop('disabled', true);
            loadComments(currentTopicId, 1, { replace: true, renderTopic: true });

            if (typeof SetaeCore.track === 'function') {
                SetaeCore.track('topic_comment_read_from_start');
            }
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
            const originalText = $btn.text() || '投稿する';
            $btn.prop('disabled', true).text('送信中...');
            $input.prop('disabled', true);

            const restoreSubmitState = function () {
                $btn.prop('disabled', false).text(originalText);
                $input.prop('disabled', false);
            };

            // 2. API送信
            const request = SetaeAPI.postComment(topicId, content, file, function (res) {
                // --- 成功時の処理 ---

                // フォームのリセット
                $input.val('').focus();
                $('#comment-image-input').val('');
                $('#comment-image-preview').hide().css('display', 'none'); // hide()だけだとflexが残る場合があるので念のため

                // 文字数カウンターリセット
                $('#comment-char-count').text('0 / 1000').css('color', '#8e8e93');
                $('.js-topic-comment-template').removeClass('active');

                const targetPage = Math.max(1, parseInt(res && res.comment_page, 10) || 1);
                loadComments(topicId, targetPage, {
                    replace: true,
                    renderTopic: true,
                    focusCommentId: res && res.id,
                    showFromStart: targetPage > 1
                });
                SetaeCore.showToast(setaeI18n.comment_posted, 'success');

                if (typeof SetaeCore.track === 'function') {
                    SetaeCore.track('topic_comment_success', {
                        comment_page: targetPage,
                        comment_count: parseInt(res && res.comment_count, 10) || 0
                    });
                }
            });

            if (request && request.always) {
                request.always(restoreSubmitState);
            } else {
                setTimeout(restoreSubmitState, 10000);
            }
        });

        // Deck Filters (My Spiders Only)
        $(document).on('click', '.deck-pill[data-deck]', SetaeUIList.handleDeckFilterClick);

        // Sort Menu
        $(document).on('click', '#btn-sort-menu', SetaeUIList.toggleSortMenu);
        $(document).on('click', '.sort-option', SetaeUIList.handleSortOptionClick);
        $(document).on('keydown', '#setae-sort-menu-v3', SetaeUIList.handleSortMenuKeydown);
        $(document).on('click', SetaeUIList.closeSortMenuOutside);
        $(window).on('resize scroll', SetaeUIList.closeSortMenu);

        // List Item Click (Detail View)
        $(document).on('click', '.setae-spider-list-row', SetaeUIList.handleListItemClick);
        $(document).on('keydown', '.setae-spider-list-row', SetaeUIList.handleListItemKeydown);

        $(document).on('click', '.js-retry-my-spiders', function () {
            loadMySpidersWithFeedback(true);
        });

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
        $(document).on('click', '#btn-add-log', function () {
            SetaeUILogModal.openLogModal($(this).data('id') || null, $(this).data('type') || 'note');
        });
        $(document).on('submit', '#setae-log-form', SetaeUILogModal.handleLogSubmit);
        $(document).on('click', '.setae-close', function () { $(this).closest('.setae-modal').fadeOut(); });

        // Edit Prey List
        $(document).on('click', '#btn-manage-feed-types', SetaeUILogModal.renderEditPreyListModal);

        // Species Detail Back Button
        $(document).on('click', '#btn-back-to-enc', function () {
            // 1. 詳細画面を即座に隠す
            $('#section-enc-detail').hide();

            // 2. 一覧画面を「透明な状態(opacity: 0)」で即座に表示(show)し、DOMの高さを確保する
            $('#section-enc').css('opacity', 0).show();

            // 3. ブラウザが画面を描画する前に、スクロール位置を元の場所へ復元する（カクつきを完全防止）
            $(window).scrollTop(encScrollPosition);

            // 4. その後、200ミリ秒かけてフワッとフェードインさせる
            $('#section-enc').animate({ opacity: 1 }, 200, function () {
                // アニメーション完了後、念のためインラインのopacityスタイルをクリーンアップ
                $(this).css('opacity', '');
            });
        });

        // Species Card Click - Updated selector for PHP rendered items
        $(document).on('click', '.js-open-species-detail, .setae-species-card', function (e) {
            e.preventDefault();
            const id = $(this).data('id');
            if (id) SetaeUI.openSpeciesDetail(id);
        });

        $(document).on('click', '.enc-detail-tabs [data-enc-panel]', function () {
            const panel = $(this).data('enc-panel');
            if (!panel) return;

            const $detail = $('#section-enc-detail');
            const $targetPanel = $detail.find('[data-enc-panel-content="' + panel + '"]');
            if (!$targetPanel.length) return;

            $detail.find('.enc-detail-tabs [data-enc-panel]')
                .removeClass('active')
                .attr({
                    'aria-selected': 'false',
                    'tabindex': '-1'
                });
            $(this).addClass('active').attr({
                'aria-selected': 'true',
                'tabindex': '0'
            });
            $detail.find('[data-enc-panel-content]').removeClass('active').prop('hidden', true);
            $targetPanel.addClass('active').prop('hidden', false);
            revealEncyclopediaDetailPanel($targetPanel);
        });

        $(document).on('click', '.enc-related-topic', function () {
            const id = $(this).data('id');
            if (!id) return;
            $('#section-enc-detail').hide();
            syncPrimaryNav('section-care-feed');
            openTopicDetail(id);
        });

        $(document).on('click', '.enc-related-care-log', function () {
            const id = $(this).data('id');
            if (!id) return;
            $('#section-enc-detail').hide();
            syncPrimaryNav('section-care-feed');
            openCareFeedDetail(id);
        });

        // Detail View Back Button
        $(document).on('click', '#btn-back-to-list', function () {
            const savedScroll = (window.SetaeUIDetail && SetaeUIDetail.getMyListScrollPosition)
                ? SetaeUIDetail.getMyListScrollPosition()
                : ($(window).scrollTop() || 0);
            if (window.SetaeUIDetail && SetaeUIDetail.resetDetailStickyStack) {
                SetaeUIDetail.resetDetailStickyStack();
            }
            $('#section-my-detail').hide();
            const $listSection = $('#section-my');
            $listSection.stop(true, true).css('opacity', 0).show();

            const restoreListPosition = function () {
                if (window.SetaeUIDetail && SetaeUIDetail.restoreMyListScrollPosition) {
                    SetaeUIDetail.restoreMyListScrollPosition();
                } else {
                    $(window).scrollTop(savedScroll);
                }
            };
            const refreshList = function () {
                if (window.SetaeUIList && SetaeUIList.init) SetaeUIList.init();
                restoreListPosition();
                window.setTimeout(restoreListPosition, 0);
            };

            window.requestAnimationFrame(function () {
                restoreListPosition();
                $listSection.animate({ opacity: 1 }, 160, function () {
                    $(this).css('opacity', '');
                });
            });

            if (SetaeAPI.fetchMySpiders) {
                SetaeAPI.fetchMySpiders(refreshList);
            } else {
                refreshList();
            }
        });

        // Scroll Shadow
        $(window).on('scroll', function () { handleToolbarShadow($(this).scrollTop()); });

        // Swipe Actions (Mobile)
        if (SetaeUIActions) {
            $(document).on('touchstart', '.setae-spider-list-row', SetaeUIActions.handleTouchStart);

            // DOM探索は開始時だけ行い、移動中はアクティブな行へ直接渡す。
            document.addEventListener('touchmove', SetaeUIActions.handleTouchMove, { passive: false });

            $(document).on('touchend', '.setae-spider-list-row', SetaeUIActions.handleTouchEnd);
            $(document).on('touchcancel', '.setae-spider-list-row', SetaeUIActions.handleTouchCancel);

            // Desktop Hover Actions is now handled by SetaeUIDesktop (app-ui-desktop.js)
            // SetaeUIActions.initDesktopHoverLogic();
        }

    }

    function checkInitialLoad(initialSection) {
        const target = initialSection || $('.setae-section:visible').first().attr('id') || 'section-my';

        if (target === 'section-my') {
            loadMySpidersWithFeedback(false);
        } else if (target === 'section-baby' && typeof SetaeUIBaby !== 'undefined') {
            SetaeUIBaby.loadGroups();
        } else if (target === 'section-care-feed') {
            loadCareFeed();
        } else if (target === 'section-com') {
            loadTopics();
        }
    }

    function loadMySpidersWithFeedback(forceLoading) {
        const hasLoaded = !!(SetaeCore.state && SetaeCore.state.mySpidersLoaded);
        if ((forceLoading || !hasLoaded) && SetaeUIList.renderLoading) {
            SetaeUIList.renderLoading();
        }

        return SetaeAPI.fetchMySpiders(SetaeUIList.init, {
            onError: function (xhr) {
                const message = SetaeCore.getErrorMessage
                    ? SetaeCore.getErrorMessage(xhr, '通信状態を確認して、もう一度お試しください。')
                    : '通信状態を確認して、もう一度お試しください。';
                if (!hasLoaded || forceLoading) {
                    SetaeUIList.renderLoadError(message);
                } else {
                    SetaeCore.showToast('一覧を更新できませんでした。現在の表示をそのまま利用できます。', 'warning');
                }
            }
        });
    }

    // ==========================================
    // Species Logic
    // ==========================================
    function renderSpeciesRelatedTopics(items) {
        const $card = $('#enc-related-topics-card');
        const $list = $('#enc-related-topics');
        const topics = Array.isArray(items) ? items : [];

        if (!$card.length || !$list.length) return;
        if (!topics.length) {
            $list.html(`
                <div class="enc-related-empty">
                    まだこの種に紐づいた相談はありません。
                </div>
            `);
            $card.show();
            return;
        }

        const typeLabels = {
            question: '質問',
            chat: '雑談',
            breeding: 'ブリード',
            general: 'その他',
            other: 'その他'
        };

        $list.html(topics.map(topic => `
            <button type="button" class="enc-related-item enc-related-topic" data-id="${escapeHtml(topic.id)}">
                <div class="enc-related-main">
                    <div class="enc-related-badges">
                        <span class="setae-topic-badge badge-${escapeHtml(topic.type || 'general')}">${escapeHtml(typeLabels[topic.type] || 'その他')}</span>
                        ${topic.is_resolved ? '<span class="thread-resolved-badge">解決済み</span>' : ''}
                    </div>
                    <strong>${escapeHtml(topic.title || '無題')}</strong>
                    ${topic.excerpt ? `<p>${escapeHtml(topic.excerpt)}</p>` : ''}
                </div>
                <span class="enc-related-meta">${escapeHtml(topic.comment_count || 0)}件</span>
            </button>
        `).join(''));
        $card.show();
    }

    function renderSpeciesRelatedCareLogs(items) {
        const $card = $('#enc-related-care-card');
        const $list = $('#enc-related-care');
        const logs = Array.isArray(items) ? items : [];

        if (!$card.length || !$list.length) return;
        if (!logs.length) {
            $list.html(`
                <div class="enc-related-empty">
                    まだこの種に紐づいた公開飼育記録はありません。
                </div>
            `);
            $card.show();
            return;
        }

        $list.html(logs.map(log => {
            const imageHtml = log.image ? `
                <div class="enc-related-thumb">
                    <img src="${escapeHtml(log.image)}" alt="">
                </div>
            ` : '<div class="enc-related-thumb is-empty"></div>';
            const dateLabel = log.created_at ? SetaeCore.formatRelativeDate(log.created_at) : '';
            return `
                <button type="button" class="enc-related-item enc-related-care-log" data-id="${escapeHtml(log.id)}">
                    ${imageHtml}
                    <div class="enc-related-main">
                        <div class="enc-related-badges">
                            <span class="setae-topic-badge badge-chat">${escapeHtml(log.type_label || '記録')}</span>
                            ${dateLabel ? `<span class="enc-related-date">${escapeHtml(dateLabel)}</span>` : ''}
                        </div>
                        <strong>${escapeHtml(log.spider_name || log.author_name || 'お世話記録')}</strong>
                        ${log.note ? `<p>${escapeHtml(log.note)}</p>` : ''}
                    </div>
                </button>
            `;
        }).join(''));
        $card.show();
    }

    function formatSpeciesDate(value) {
        if (!value) return '';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '';
        return new Intl.DateTimeFormat('ja-JP', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        }).format(date);
    }

    function renderSpeciesContentSections(sections) {
        const labels = {
            identification: '同定・特徴',
            distribution: '分布',
            natural_history: '生態',
            husbandry: '飼育',
            feeding: '給餌',
            breeding: '繁殖',
            conservation: '保全状況',
            cautions: '注意点'
        };
        const values = sections && typeof sections === 'object' ? sections : {};
        const html = Object.keys(labels).map(function (key) {
            const value = String(values[key] || '').trim();
            if (!value) return '';
            return `
                <section class="enc-content-section">
                    <h3>${escapeHtml(labels[key])}</h3>
                    <p>${escapeHtml(value).replace(/\n/g, '<br>')}</p>
                </section>
            `;
        }).join('');
        $('#enc-detail-content-sections').html(html);
    }

    function renderSpeciesCareProfile(profile) {
        const labels = {
            enclosure: 'ケージ',
            substrate: '床材',
            ventilation: '通気',
            water: '給水',
            feeding: '給餌',
            growth: '成長',
            breeding: '繁殖',
            handling: '接触'
        };
        const values = profile && typeof profile === 'object' ? profile : {};
        const html = Object.keys(labels).map(function (key) {
            const value = String(values[key] || '').trim();
            if (!value) return '';
            return `
                <div class="enc-care-profile-item">
                    <strong>${escapeHtml(labels[key])}</strong>
                    <span>${escapeHtml(value).replace(/\n/g, '<br>')}</span>
                </div>
            `;
        }).join('');
        $('#enc-care-profile').html(html);
    }

    function renderSpeciesResearch(research) {
        const data = research && typeof research === 'object' ? research : {};
        const sources = Array.isArray(data.sources) ? data.sources : [];
        const status = data.status || 'unreviewed';
        const labels = {
            unreviewed: '未調査',
            draft: 'Codex調査中',
            reviewed: 'レビュー済み',
            verified: '確認済み'
        };

        $('#enc-research-status')
            .removeClass('is-unreviewed is-draft is-reviewed is-verified')
            .addClass('is-' + status)
            .text(labels[status] || labels.unreviewed);
        $('#enc-research-date').text(formatSpeciesDate(data.last_researched_at));

        if (!sources.length) {
            $('#enc-research-sources').empty();
            $('#enc-research-empty').prop('hidden', false);
            return;
        }

        const html = sources.map(function (source, index) {
            source = source && typeof source === 'object' ? source : {};
            const doi = String(source.doi || '').trim();
            const href = source.url || (doi ? 'https://doi.org/' + doi : '');
            const authors = Array.isArray(source.authors) ? source.authors.join(', ') : '';
            const meta = [authors, source.year || '', doi ? 'DOI ' + doi : ''].filter(Boolean).join(' / ');
            const body = `
                <span>
                    <strong>${escapeHtml(source.title || `出典 ${index + 1}`)}</strong>
                    ${meta ? `<small>${escapeHtml(meta)}</small>` : ''}
                </span>
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M7 17 17 7M7 7h10v10"></path>
                </svg>
            `;
            if (!href) return `<div class="enc-source-item">${body}</div>`;
            return `<a class="enc-source-item" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${body}</a>`;
        }).join('');

        $('#enc-research-empty').prop('hidden', true);
        $('#enc-research-sources').html(html);
    }

    function renderSpeciesExternalLinks(items) {
        const links = Array.isArray(items) ? items : [];
        const html = links.map(function (item) {
            if (!item || !item.url) return '';
            return `<a class="enc-external-link" href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.title || item.type || '外部資料')}</a>`;
        }).join('');
        $('#enc-external-links').html(html);
        $('#enc-external-links-section').prop('hidden', !html);
    }

    function renderSpeciesBreedingCandidates(items) {
        const candidates = Array.isArray(items) ? items : [];
        const html = candidates.map(function (item) {
            const image = item.image
                ? `<img src="${escapeHtml(item.image)}" alt="" loading="lazy">`
                : '<span class="enc-breeding-image-empty"></span>';
            const genderLabels = { male: 'オス', female: 'メス', unknown: '性別不明' };
            const contactUrl = /^https:\/\//i.test(String(item.contact_url || '')) ? String(item.contact_url) : '';
            return `
                <article class="enc-breeding-item">
                    ${image}
                    <div>
                        <strong>${escapeHtml(item.name || '名称未設定')}</strong>
                        <small>${escapeHtml(item.owner_name || 'ユーザー')} / ${escapeHtml(genderLabels[item.gender] || item.gender || '性別不明')}</small>
                        <span>繁殖相手を募集中</span>
                        ${contactUrl ? `<a class="enc-secondary-button" href="${escapeHtml(contactUrl)}" target="_blank" rel="noopener noreferrer nofollow">${escapeHtml(item.contact_label || '外部連絡先を開く')} ↗</a>` : ''}
                    </div>
                </article>
            `;
        }).join('');

        $('#enc-breeding-candidates').html(html || `
            <div class="enc-panel-empty">
                <strong>現在この種の繁殖募集はありません</strong>
            </div>
        `);
    }

    function renderSpeciesShopLinks(items) {
        const shops = Array.isArray(items) ? items : [];
        const html = shops.map(function (shop) {
            if (!shop || !shop.url) return '';
            const image = shop.image
                ? `<img src="${escapeHtml(shop.image)}" alt="" loading="lazy">`
                : '<span class="enc-shop-image-empty"></span>';
            return `
                <article class="enc-shop-item">
                    ${image}
                    <div class="enc-shop-item-main">
                        <strong>${escapeHtml(shop.shop_name || shop.title || 'プロショップ')}</strong>
                        ${shop.price_label || shop.stock_label ? `<small>${escapeHtml([shop.price_label, shop.stock_label].filter(Boolean).join(' / '))}</small>` : ''}
                        ${shop.description ? `<p>${escapeHtml(shop.description)}</p>` : ''}
                    </div>
                    <a href="${escapeHtml(shop.url)}" target="_blank" rel="sponsored noopener noreferrer">${escapeHtml(shop.cta_label || '販売情報を見る')}</a>
                </article>
            `;
        }).join('');

        $('#enc-shop-links').html(html);
        $('#enc-shop-empty').prop('hidden', !!html);
    }

    function renderSpeciesGallery(items) {
        const gallery = Array.isArray(items) ? items : [];
        const html = gallery.map(function (item) {
            if (!item || !item.url) return '';
            return `
                <button type="button" class="enc-gallery-item gallery-item-trigger"
                    data-url="${escapeHtml(item.url)}"
                    data-username="${escapeHtml(item.username || '')}"
                    data-avatar="${escapeHtml(item.avatar || '')}"
                    aria-label="${escapeHtml((item.username || 'ユーザー') + 'の写真を拡大')}">
                    <img src="${escapeHtml(item.url)}" alt="" loading="lazy">
                    ${item.username ? `<span class="enc-gallery-credit">${escapeHtml(item.username)}</span>` : ''}
                </button>
            `;
        }).join('');

        $('#enc-gallery-grid').html(html);
        $('#enc-gallery-empty').prop('hidden', !!html);
    }

    function resetSpeciesDetailPanels() {
        $('.enc-detail-tabs [data-enc-panel]')
            .removeClass('active')
            .attr({
                'aria-selected': 'false',
                'tabindex': '-1'
            });
        $('.enc-detail-tabs [data-enc-panel="overview"]')
            .addClass('active')
            .attr({
                'aria-selected': 'true',
                'tabindex': '0'
            });
        $('[data-enc-panel-content]').removeClass('active').prop('hidden', true);
        $('[data-enc-panel-content="overview"]').addClass('active').prop('hidden', false);
    }

    function openSpeciesDetailDashboard(id) {
        encScrollPosition = $(window).scrollTop();

        $('#section-enc').hide();
        $('#section-enc-detail').show();
        window.scrollTo(0, 0);
        window.requestAnimationFrame(function () { window.scrollTo(0, 0); });

        resetSpeciesDetailPanels();
        $('.enc-detail-content').prop('hidden', true);
        $('#enc-detail-loading-spinner').prop('hidden', false).html(`
            <span class="enc-loader-mark" aria-hidden="true"></span>
            <span>図鑑情報を読み込んでいます</span>
        `);
        $('#enc-detail-title').text((typeof setaeI18n !== 'undefined' && setaeI18n.loading) ? setaeI18n.loading : '読み込み中...');

        SetaeAPI.getSpeciesDetail(id, function (data) {
            const displayName = data.ja_name || data.title || '種情報';
            const scientificName = data.title || data.scientific_name || '';
            const summary = data.related_summary && typeof data.related_summary === 'object' ? data.related_summary : {};
            const temperaments = Array.isArray(data.temperaments) ? data.temperaments : [];
            const habitats = Array.isArray(data.habitats) ? data.habitats : [];
            const relatedLogs = Array.isArray(data.related_care_logs) ? data.related_care_logs : [];
            const relatedTopics = Array.isArray(data.related_topics) ? data.related_topics : [];
            const breedingCandidates = Array.isArray(data.breeding_candidates) ? data.breeding_candidates : [];

            $('#enc-detail-title').text(displayName);
            $('#enc-detail-name').text(scientificName);
            $('#enc-detail-genus').text(data.genus || '');
            $('#enc-detail-common-name').text(data.ja_name || '和名未登録');

            $('#btn-open-species-topic, #btn-open-species-topic-list')
                .attr('data-species-id', data.id || id)
                .attr('data-scientific-name', scientificName)
                .attr('data-common-name', data.ja_name || '')
                .attr('data-display-name', displayName);

            $('#enc-detail-description').html(data.description || '<p>概要はまだ登録されていません。</p>');
            $('#enc-detail-lifespan').text(data.lifespan || '-');
            $('#enc-detail-size').text(data.size ? (/cm/i.test(String(data.size)) ? data.size : `${data.size} cm`) : '-');
            $('#enc-detail-temp').text(data.temperature || '-');
            $('#enc-detail-humidity').text(data.humidity || '-');
            $('#enc-detail-lifestyle').text(data.lifestyle || '-').data('value', data.lifestyle_slug || '');
            $('#enc-detail-difficulty').text({ beginner: '入門', intermediate: '中級', expert: '上級' }[data.difficulty] || data.difficulty || '-');
            $('#enc-detail-taxonomy-genus').text(data.genus || '-');
            $('#enc-detail-habitats').text(habitats.length ? habitats.map(function (item) { return item.name; }).join('、') : (data.habitat || '-'));
            $('#enc-detail-temperaments-text').text(temperaments.length ? temperaments.map(function (item) { return item.name; }).join('、') : '-');

            $('#enc-detail-temperament-list').html(temperaments.length
                ? temperaments.map(function (item) {
                    return `<span class="setae-chip" data-id="${escapeHtml(item.term_id)}">${escapeHtml(item.name)}</span>`;
                }).join('')
                : '<span class="enc-detail-tag-empty">気質未登録</span>');

            $('#enc-detail-metric-keepers').text(Number(summary.keepers || data.keeping_count || 0).toLocaleString('ja-JP'));
            $('#enc-detail-metric-care').text(Number(summary.care_logs || relatedLogs.length || 0).toLocaleString('ja-JP'));
            $('#enc-detail-metric-topics').text(Number(summary.topics || relatedTopics.length || 0).toLocaleString('ja-JP'));
            $('#enc-detail-metric-breeding').text(Number(summary.breeding_candidates || breedingCandidates.length || 0).toLocaleString('ja-JP'));
            $('#btn-open-edit-modal').data('id', id);

            if (data.thumb) {
                $('#enc-detail-image').attr('src', data.thumb).attr('alt', displayName).show();
            } else {
                $('#enc-detail-image').removeAttr('src').attr('alt', '').hide();
            }

            if (data.image_credit && data.image_credit.text) {
                $('#enc-detail-credit-name').text(data.image_credit.text);
                if (data.image_credit.avatar) {
                    $('#enc-detail-credit-avatar').html(`<img src="${escapeHtml(data.image_credit.avatar)}" alt="">`);
                } else {
                    $('#enc-detail-credit-avatar').text(data.image_credit.text.charAt(0).toUpperCase());
                }
                $('#enc-detail-image-credit-overlay').prop('hidden', false);
            } else {
                $('#enc-detail-image-credit-overlay').prop('hidden', true);
            }

            renderSpeciesRelatedTopics(relatedTopics);
            renderSpeciesRelatedCareLogs(relatedLogs);
            renderSpeciesContentSections(data.content_sections);
            renderSpeciesCareProfile(data.care_profile);
            renderSpeciesResearch(data.research);
            renderSpeciesExternalLinks(data.external_links);
            renderSpeciesBreedingCandidates(breedingCandidates);
            renderSpeciesShopLinks(data.shop_links);
            renderSpeciesGallery(data.featured_gallery);

            $('#btn-search-inaturalist').attr('href', 'https://www.inaturalist.org/search?q=' + encodeURIComponent(scientificName));
            $('#enc-detail-loading-spinner').prop('hidden', true);
            $('.enc-detail-content').prop('hidden', false);
        }, function () {
            $('#enc-detail-loading-spinner').prop('hidden', false).html(`
                <span>図鑑情報を読み込めませんでした。一覧へ戻って再度お試しください。</span>
            `);
        });
    }

    function openSpeciesDetail(id) {
        return openSpeciesDetailDashboard(id);
    }

    // ==========================================
    // Navigation
    // ==========================================
    function syncPrimaryNav(target) {
        $('.setae-nav-item').each(function () {
            const isActive = $(this).data('target') === target
                || (target === 'section-com' && $(this).data('target') === 'section-care-feed');
            $(this)
                .toggleClass('active', isActive)
                .attr('aria-current', isActive ? 'page' : null);
        });
    }

    function getPrimaryNavTarget(target) {
        return target === 'section-com' ? 'section-care-feed' : target;
    }

    function canOpenPrimarySection(target) {
        if (PRIMARY_SECTION_IDS.indexOf(target) === -1 || !$('#' + target).length) {
            return false;
        }

        const $nav = $(`.setae-nav-item[data-target="${getPrimaryNavTarget(target)}"]`);
        const sessionRestricted = !!(
            window.SetaeSettings
            && (SetaeSettings.guest_mode || SetaeSettings.offline_session)
        );
        const requiresAccountConnection = [
            'section-baby',
            'section-care-feed',
            'section-com'
        ].indexOf(target) !== -1;

        return !$nav.length || !(
            sessionRestricted
            && (requiresAccountConnection || $nav.attr('data-guest-locked') === '1')
        );
    }

    function readRememberedPrimarySection() {
        try {
            const saved = localStorage.getItem(PRIMARY_SECTION_STORAGE_KEY);
            return canOpenPrimarySection(saved) ? saved : '';
        } catch (error) {
            return '';
        }
    }

    function rememberPrimarySection(target) {
        if (!canOpenPrimarySection(target)) return;

        try {
            localStorage.setItem(PRIMARY_SECTION_STORAGE_KEY, target);
        } catch (error) {
            // Storage can be unavailable in private or restricted browser contexts.
        }
    }

    function resolveInitialPrimarySection() {
        const remembered = readRememberedPrimarySection();
        if (remembered) return remembered;

        const activeTarget = $('.setae-nav-item.active').first().data('target');
        return canOpenPrimarySection(activeTarget) ? activeTarget : 'section-my';
    }

    function activateInitialPrimarySection(target) {
        const safeTarget = canOpenPrimarySection(target) ? target : 'section-my';
        $('.setae-section').hide();
        $('#' + safeTarget).show();
        syncPrimaryNav(safeTarget);

        if (safeTarget === 'section-com' || safeTarget === 'section-care-feed') {
            currentSocialHubView = safeTarget === 'section-com' ? 'community' : 'care';
            syncSocialHubTabs(currentSocialHubView);
        }
    }

    function showPrimarySection(target) {
        const $target = $('#' + target);
        if (!$target.length) return;

        rememberPrimarySection(target);
        $('.setae-section').hide();
        const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reduceMotion) $target.show();
        else $target.stop(true, true).fadeIn(160);

        window.scrollTo(0, 0);
        window.requestAnimationFrame(function () {
            window.scrollTo(0, 0);
        });
    }

    function handleTabClick(e) {
        if (e) e.preventDefault();
        if (
            window.SetaeSettings
            && (SetaeSettings.guest_mode || SetaeSettings.offline_session)
            && $(this).attr('data-guest-locked') === '1'
        ) {
            if (e) e.stopImmediatePropagation();
            const offlineAccount = !!SetaeSettings.offline_session;
            SetaeCore.openDialog({
                title: offlineAccount ? 'オンライン接続が必要です' : '無料登録後に利用できます',
                message: offlineAccount
                    ? '個体と飼育記録はオフラインでも使えます。交流とベビー管理は再接続後に利用してください。'
                    : '交流とベビー管理はアカウントに紐づく機能です。端末の体験データは登録後に同期できます。',
                confirmLabel: offlineAccount ? '閉じる' : '無料登録へ'
            }).then(function (confirmed) {
                if (confirmed && !offlineAccount) {
                    window.location.href = SetaeSettings.registration_url || '/?register=1';
                }
            });
            return;
        }
        const target = $(this).data('target');
        if (!target) return;

        if (target === 'section-care-feed') {
            openSocialHubView('care');
            return;
        }

        if (target === 'section-com') {
            openSocialHubView('community');
            return;
        }

        if ($(this).hasClass('active') && $('#' + target).is(':visible')) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }

        syncPrimaryNav(target);
        showPrimarySection(target);

        if (target === 'section-my') {
            loadMySpidersWithFeedback(false);
            if (!(window.SetaeSettings && SetaeSettings.guest_mode)) {
                refreshCommunitySpeciesPulse();
            }
        }
        else if (target === 'section-baby') {
            if (typeof SetaeUIBaby !== 'undefined') SetaeUIBaby.loadGroups();
        }
        if (typeof SetaeCore.announce === 'function') {
            SetaeCore.announce($(this).find('.setae-nav-label').text().trim() + 'を表示しました');
        }
    }

    function handleSocialHubTabClick(e) {
        e.preventDefault();
        e.stopPropagation();
        openSocialHubView($(this).data('social-view'));
    }

    function handleSocialFilterToggle(e) {
        e.preventDefault();
        const panelId = $(this).attr('aria-controls');
        const $panel = panelId ? $('#' + panelId) : $();
        if (!$panel.length) return;

        const willOpen = !$panel.hasClass('is-mobile-open');
        $('.social-filter-panel').removeClass('is-mobile-open');
        $('.js-social-filter-toggle').attr('aria-expanded', 'false');
        $panel.toggleClass('is-mobile-open', willOpen);
        $(this).attr('aria-expanded', willOpen ? 'true' : 'false');
    }

    function setSocialLiveStatus(view, state, label) {
        const safeView = view === 'community' ? 'community' : 'care';
        const $status = $(`[data-social-live-status="${safeView}"]`);
        if (!$status.length) return;

        const statusLabels = {
            live: 'ライブ',
            checking: 'ライブ',
            syncing: '新着を反映中',
            offline: '再接続待ち'
        };
        const statusAriaLabels = {
            live: '新着投稿を自動確認中',
            checking: '新着投稿を確認中',
            syncing: '新着投稿を反映中',
            offline: '通信の再接続を待っています'
        };
        const nextLabel = label || statusLabels[state] || statusLabels.live;

        $status
            .attr('data-state', state || 'live')
            .attr('aria-label', statusAriaLabels[state] || statusAriaLabels.live);
        if ($status.find('.social-live-label').text() !== nextLabel) {
            $status.find('.social-live-label').text(nextLabel);
        }
    }

    function scheduleSocialLiveStatusReset(view, delay) {
        const safeView = view === 'community' ? 'community' : 'care';
        if (socialLiveStatusResetTimers[safeView]) {
            window.clearTimeout(socialLiveStatusResetTimers[safeView]);
        }
        socialLiveStatusResetTimers[safeView] = window.setTimeout(function () {
            socialLiveStatusResetTimers[safeView] = null;
            setSocialLiveStatus(safeView, navigator.onLine === false ? 'offline' : 'live');
        }, delay || 3200);
    }

    function getSocialTimelineList(view) {
        return view === 'community' ? $('#setae-topic-list') : $('#setae-care-feed-list');
    }

    function getSocialNewPostsBanner(view) {
        const safeView = view === 'community' ? 'community' : 'care';
        return $(`.js-social-new-posts-jump[data-social-view="${safeView}"]`);
    }

    function hideSocialNewPostsBanner(view) {
        const $banner = getSocialNewPostsBanner(view);
        if (!$banner.length) return;

        $banner
            .prop('hidden', true)
            .attr('data-new-count', '0')
            .removeClass('is-visible');
        $banner.find('.js-social-new-posts-count').text('0');
    }

    function showSocialNewPostsBanner(view, addedCount) {
        const $banner = getSocialNewPostsBanner(view);
        const count = Math.max(0, parseInt(addedCount, 10) || 0);
        if (!$banner.length || !count) return;

        const previousCount = parseInt($banner.attr('data-new-count'), 10) || 0;
        const nextCount = previousCount + count;
        $banner
            .attr('data-new-count', String(nextCount))
            .prop('hidden', false);
        $banner.find('.js-social-new-posts-count').text(String(nextCount));
        window.requestAnimationFrame(function () {
            $banner.addClass('is-visible');
        });
    }

    function getSocialTimelineScrollTarget(view) {
        const $list = getSocialTimelineList(view);
        if (!$list.length) return 0;

        const sectionSelector = view === 'community' ? '#section-com' : '#section-care-feed';
        const header = document.querySelector(sectionSelector + ' .social-hub-header');
        const stickyHeight = header ? header.getBoundingClientRect().height : 0;
        return Math.max(0, window.pageYOffset + $list[0].getBoundingClientRect().top - stickyHeight - 10);
    }

    function handleSocialNewPostsJump(e) {
        e.preventDefault();
        e.stopPropagation();
        const view = $(this).data('social-view') === 'community' ? 'community' : 'care';
        const prefersReducedMotion = window.matchMedia
            && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        hideSocialNewPostsBanner(view);
        window.scrollTo({
            top: getSocialTimelineScrollTarget(view),
            behavior: prefersReducedMotion ? 'auto' : 'smooth'
        });
        getSocialTimelineList(view).children('.social-timeline-post').removeClass('is-live-new');
    }

    function handleSocialNewPostsScroll() {
        if (socialNewPostsScrollRaf) return;

        socialNewPostsScrollRaf = window.requestAnimationFrame(function () {
            socialNewPostsScrollRaf = null;
            const view = getVisibleSocialView();
            if (!view) return;

            const $list = getSocialTimelineList(view);
            if (!$list.length) return;
            const listTop = $list[0].getBoundingClientRect().top;
            const sectionSelector = view === 'community' ? '#section-com' : '#section-care-feed';
            const header = document.querySelector(sectionSelector + ' .social-hub-header');
            const headerBottom = header ? header.getBoundingClientRect().bottom : 0;
            if (listTop >= headerBottom - 12) {
                hideSocialNewPostsBanner(view);
            }
        });
    }

    function getSocialTimelineItems(view) {
        return view === 'community' ? currentTopicItems : currentCareFeedItems;
    }

    function mergeSocialTimelineItems(incomingItems, existingItems) {
        const seenIds = new Set();
        return (incomingItems || []).concat(existingItems || []).filter(function (item) {
            const id = item && item.id !== undefined ? String(item.id) : '';
            if (!id || seenIds.has(id)) return false;
            seenIds.add(id);
            return true;
        });
    }

    function getSocialTimelineItemRevision(view, item) {
        if (!item) return '';

        const reactions = item.reactions && typeof item.reactions === 'object'
            ? Object.keys(item.reactions).sort().map(function (key) {
                const reaction = item.reactions[key] || {};
                return key + ':' + (parseInt(reaction.count, 10) || 0);
            }).join(',')
            : '';
        if (view === 'community') {
            return [
                item.updated_at || '',
                parseInt(item.comment_count, 10) || 0,
                parseInt(item.unread_count, 10) || 0,
                reactions
            ].join('|');
        }
        return [
            item.last_activity_at || item.created_at || item.date || '',
            parseInt(item.comment_count, 10) || 0,
            parseInt(item.reply_count, 10) || 0,
            reactions
        ].join('|');
    }

    function captureSocialTimelineAnchor(view) {
        const $list = getSocialTimelineList(view);
        if (!$list.length) return null;

        const sectionSelector = view === 'community' ? '#section-com' : '#section-care-feed';
        const header = document.querySelector(sectionSelector + ' .social-hub-header');
        const stickyBottom = header ? Math.max(0, header.getBoundingClientRect().bottom) : 0;
        const visibleThreshold = stickyBottom + 8;
        const posts = $list.children('.social-timeline-post').toArray();
        if (!posts.length || posts[0].getBoundingClientRect().top >= visibleThreshold) {
            return null;
        }

        const anchorElement = posts.find(function (post) {
            return post.getBoundingClientRect().bottom > visibleThreshold;
        });
        if (!anchorElement) return null;

        return {
            id: String($(anchorElement).data('id')),
            top: anchorElement.getBoundingClientRect().top
        };
    }

    function restoreSocialTimelineAnchor(view, anchor) {
        if (!anchor || !anchor.id) return;

        window.requestAnimationFrame(function () {
            const target = getSocialTimelineList(view).children('[data-id]').filter(function () {
                return String($(this).data('id')) === anchor.id;
            }).get(0);
            if (!target) return;

            const delta = target.getBoundingClientRect().top - anchor.top;
            if (Math.abs(delta) > 0.5) {
                window.scrollTo(0, Math.max(0, window.pageYOffset + delta));
            }
        });
    }

    function finishSocialLiveMerge(view, newIds, updateCount, anchor) {
        const ids = new Set((newIds || []).map(function (id) { return String(id); }));
        const $newPosts = getSocialTimelineList(view).children('[data-id]').filter(function () {
            return ids.has(String($(this).data('id')));
        });

        $newPosts.addClass('is-live-new');
        if (ids.size && anchor) {
            showSocialNewPostsBanner(view, ids.size);
        } else if (!anchor) {
            hideSocialNewPostsBanner(view);
        }
        restoreSocialTimelineAnchor(view, anchor);
        const statusLabel = ids.size
            ? ids.size + '件追加'
            : Math.max(1, parseInt(updateCount, 10) || 0) + '件更新';
        setSocialLiveStatus(view, 'live', statusLabel);
        scheduleSocialLiveStatusReset(view);

        window.setTimeout(function () {
            $newPosts.removeClass('is-live-new');
        }, 1800);
    }

    function scheduleSocialLivePoll(delay) {
        if (socialLivePollTimer) {
            window.clearTimeout(socialLivePollTimer);
        }
        socialLivePollTimer = window.setTimeout(checkSocialLiveUpdates, delay);
    }

    function getVisibleSocialView() {
        if ($('#section-com').is(':visible')) return 'community';
        if ($('#section-care-feed').is(':visible')) return 'care';
        return '';
    }

    function getSocialLivePollParams(view) {
        if (view === 'community') {
            return {
                type: currentTopicListType,
                page: 1,
                per_page: 8,
                s: currentTopicSearch,
                sort: 'newest',
                scope: currentTopicScope || 'all',
                species_id: currentTopicSpeciesId || ''
            };
        }

        const params = {
            page: 1,
            per_page: 8,
            sort: 'new',
            scope: currentCareFeedScope || 'all'
        };
        if (currentCareFeedFilter && currentCareFeedFilter !== 'all') {
            params.classification = currentCareFeedFilter;
        }
        return params;
    }

    function applySocialLiveItems(view, liveSnapshot, newIds, updateCount) {
        const liveItems = Array.isArray(liveSnapshot) ? liveSnapshot : [];
        const options = {
            silent: true,
            liveMerge: true,
            liveItems: liveItems,
            newIds: Array.isArray(newIds) ? newIds : [],
            liveUpdateCount: Math.max(0, parseInt(updateCount, 10) || 0)
        };
        setSocialLiveStatus(view, 'syncing');

        if (view === 'community') {
            loadTopics(currentTopicListType, false, options);
            refreshCommunityUnread();
        } else {
            loadCareFeed(false, options);
            refreshCareFeedUnread();
        }
    }

    function checkSocialLiveUpdates() {
        socialLivePollTimer = null;

        const restrictedSession = !!(
            window.SetaeSettings
            && (SetaeSettings.guest_mode || SetaeSettings.offline_session)
        );
        const view = getVisibleSocialView();
        if (restrictedSession || !view || document.hidden) {
            scheduleSocialLivePoll(SOCIAL_LIVE_POLL_INTERVAL_MS);
            return;
        }
        if (navigator.onLine === false) {
            setSocialLiveStatus(view, 'offline');
            scheduleSocialLivePoll(SOCIAL_LIVE_RETRY_INTERVAL_MS);
            return;
        }
        if (
            socialLiveRequest
            || (view === 'community' && isTopicListLoading)
            || (view === 'care' && isCareFeedLoading)
            || $('.care-feed-actions.is-open, .social-reaction-picker:not([hidden])').length
        ) {
            scheduleSocialLivePoll(3000);
            return;
        }

        const fetcher = view === 'community' ? SetaeAPI.fetchTopics : SetaeAPI.fetchCareFeed;
        if (typeof fetcher !== 'function') {
            scheduleSocialLivePoll(SOCIAL_LIVE_RETRY_INTERVAL_MS);
            return;
        }

        setSocialLiveStatus(view, 'checking');
        const knownItems = new Map(getSocialTimelineItems(view).map(function (item) {
            return [String(item.id), item];
        }));
        socialLiveRequest = fetcher(getSocialLivePollParams(view), function (response) {
            const items = response && Array.isArray(response.items)
                ? response.items
                : (Array.isArray(response) ? response : []);
            const incomingItems = items.filter(function (item) {
                if (!item || item.id === undefined) return false;
                const existing = knownItems.get(String(item.id));
                return !existing
                    || getSocialTimelineItemRevision(view, existing) !== getSocialTimelineItemRevision(view, item);
            });
            const newIds = incomingItems.filter(function (item) {
                return !knownItems.has(String(item.id));
            }).map(function (item) {
                return item.id;
            });

            if (incomingItems.length) {
                applySocialLiveItems(view, items, newIds, incomingItems.length);
            } else {
                setSocialLiveStatus(view, 'live');
            }
        }, function () {
            setSocialLiveStatus(view, 'offline');
        });

        if (socialLiveRequest && socialLiveRequest.always) {
            socialLiveRequest.always(function () {
                socialLiveRequest = null;
                scheduleSocialLivePoll(SOCIAL_LIVE_POLL_INTERVAL_MS);
            });
        } else {
            socialLiveRequest = null;
            scheduleSocialLivePoll(SOCIAL_LIVE_POLL_INTERVAL_MS);
        }
    }

    function startSocialLiveUpdates() {
        scheduleSocialLivePoll(5000);
    }

    function handleSocialLiveEnvironmentChange() {
        const view = getVisibleSocialView();
        if (view && navigator.onLine === false) {
            setSocialLiveStatus(view, 'offline');
        }
        scheduleSocialLivePoll(document.hidden ? SOCIAL_LIVE_POLL_INTERVAL_MS : 600);
    }

    function updateSocialQuickComposeMetrics($input) {
        if (!$input || !$input.length) return;

        const valueLength = Array.from(String($input.val() || '')).length;
        const maxLength = parseInt($input.attr('maxlength'), 10) || 500;
        const $form = $input.closest('.js-social-quick-compose');
        const remaining = Math.max(0, maxLength - valueLength);
        const progress = Math.min(360, Math.round((valueLength / maxLength) * 360));

        if ($input.is(':visible')) {
            $input.css('height', 'auto');
            const inputElement = $input.get(0);
            const inputHeight = inputElement ? inputElement.scrollHeight : 52;
            $input.css({
                height: Math.min(inputHeight, 168) + 'px',
                overflowY: inputHeight > 168 ? 'auto' : 'hidden'
            });
        }

        $form.find('.social-quick-compose-count')
            .css('--compose-progress', progress + 'deg')
            .attr('aria-label', '残り' + remaining + '文字')
            .toggleClass('is-near-limit', remaining <= 80);
        $form.find('.social-compose-remaining').text(remaining);
        $form.find('.social-quick-compose-submit').prop(
            'disabled',
            !String($input.val() || '').trim() && !socialQuickComposeImageFile
        );
    }

    function handleSocialQuickComposeInput() {
        const $input = $(this);
        const $form = $input.closest('.js-social-quick-compose');
        updateSocialQuickComposeMetrics($input);
        $form.toggleClass('has-content', !!String($input.val() || '').trim() || !!socialQuickComposeImageFile);
        scheduleSocialQuickComposeDraftSave($form);
    }

    function handleSocialQuickComposeDraftChange() {
        const $form = $(this).closest('.js-social-quick-compose');
        $form.addClass('is-expanded');
        scheduleSocialQuickComposeDraftSave($form);
    }

    function getSocialQuickComposeDraft($form) {
        const subjectOpen = !$form.find('.js-social-compose-subject').prop('hidden');
        return {
            content: String($form.find('.js-social-quick-content').val() || ''),
            subject: subjectOpen ? String($form.find('.js-social-compose-subject-input').val() || '') : '',
            subject_open: subjectOpen,
            image_alt: socialQuickComposeImageFile
                ? String($form.find('.js-social-compose-media-alt').val() || '')
                : '',
            type: $form.find('.social-quick-compose-type').val() || 'chat',
            saved_at: Date.now()
        };
    }

    function applySocialQuickComposeDraft(draft, exceptForm) {
        draft = draft || {};
        $('.js-social-quick-compose').each(function () {
            if (exceptForm && this === exceptForm) return;
            const $form = $(this);
            const subjectOpen = !!draft.subject_open;
            $form.find('.js-social-quick-content').val(draft.content || '');
            $form.find('.js-social-compose-subject-input').val(draft.subject || '');
            $form.find('.js-social-compose-media-alt').val(
                socialQuickComposeImageFile ? (draft.image_alt || '') : ''
            );
            $form.find('.social-quick-compose-type').val(draft.type || 'chat');
            $form.find('.js-social-compose-subject').prop('hidden', !subjectOpen);
            $form.find('.js-social-compose-subject-toggle')
                .attr('aria-pressed', subjectOpen ? 'true' : 'false')
                .toggleClass('is-active', subjectOpen);
            $form.toggleClass('has-cw', subjectOpen);
            $form.toggleClass('has-content', !!String(draft.content || '').trim() || !!socialQuickComposeImageFile);
            $form.toggleClass('is-expanded', subjectOpen || !!String(draft.content || '').trim() || !!socialQuickComposeImageFile);
            updateSocialQuickComposeMetrics($form.find('.js-social-quick-content'));
        });
    }

    function persistSocialQuickComposeDraft($form) {
        if (!$form || !$form.length) return;

        const draft = getSocialQuickComposeDraft($form);
        applySocialQuickComposeDraft(draft, $form.get(0));
        try {
            const hasDraft = !!draft.content.trim() || !!draft.subject.trim() || !!draft.subject_open;
            if (hasDraft) {
                localStorage.setItem(SOCIAL_QUICK_DRAFT_STORAGE_KEY, JSON.stringify(draft));
            } else {
                localStorage.removeItem(SOCIAL_QUICK_DRAFT_STORAGE_KEY);
            }
            $('.social-compose-draft-status').text(hasDraft ? '下書き保存済み' : '');
        } catch (error) {
            $('.social-compose-draft-status').text('');
        }
    }

    function scheduleSocialQuickComposeDraftSave($form) {
        window.clearTimeout(socialQuickDraftSaveTimer);
        if (String($form.find('.js-social-quick-content').val() || '').trim()) {
            $form.find('.social-compose-draft-status').text('保存中');
        }
        socialQuickDraftSaveTimer = window.setTimeout(function () {
            persistSocialQuickComposeDraft($form);
        }, 180);
    }

    function restoreSocialQuickComposeDraft() {
        let draft = null;
        try {
            draft = JSON.parse(localStorage.getItem(SOCIAL_QUICK_DRAFT_STORAGE_KEY) || 'null');
        } catch (error) {
            draft = null;
        }

        if (
            draft
            && draft.saved_at
            && Date.now() - parseInt(draft.saved_at, 10) <= SOCIAL_QUICK_DRAFT_MAX_AGE_MS
        ) {
            applySocialQuickComposeDraft(draft);
            $('.social-compose-draft-status').text(
                String(draft.content || '').trim() || String(draft.subject || '').trim()
                    ? '下書き保存済み'
                    : ''
            );
            return;
        }

        try {
            localStorage.removeItem(SOCIAL_QUICK_DRAFT_STORAGE_KEY);
        } catch (error) {
            // Storage can be unavailable in private or restricted browser contexts.
        }
        applySocialQuickComposeDraft({ type: 'chat' });
    }

    function clearSocialQuickComposeDraft() {
        window.clearTimeout(socialQuickDraftSaveTimer);
        try {
            localStorage.removeItem(SOCIAL_QUICK_DRAFT_STORAGE_KEY);
        } catch (error) {
            // Storage can be unavailable in private or restricted browser contexts.
        }

        $('.js-social-quick-compose').each(function () {
            const $form = $(this);
            $form.removeClass('is-expanded has-content has-cw');
            $form.find('.js-social-quick-content, .js-social-compose-subject-input, .js-social-compose-media-alt').val('');
            $form.find('.social-quick-compose-type').val('chat');
            $form.find('.js-social-compose-subject').prop('hidden', true);
            $form.find('.js-social-compose-subject-toggle').attr('aria-pressed', 'false').removeClass('is-active');
            $form.find('.social-compose-draft-status').text('');
            updateSocialQuickComposeMetrics($form.find('.js-social-quick-content'));
        });
        clearSocialComposeImage();
    }

    function handleSocialComposeImageTrigger(e) {
        e.preventDefault();
        e.stopPropagation();
        $(this).closest('.js-social-quick-compose').find('.js-social-compose-file').trigger('click');
    }

    function formatSocialComposeFileSize(size) {
        const bytes = parseInt(size, 10) || 0;
        if (bytes < 1024 * 1024) return Math.max(1, Math.round(bytes / 1024)) + 'KB';
        return (bytes / (1024 * 1024)).toFixed(1) + 'MB';
    }

    function renderSocialComposeImagePreview() {
        $('.js-social-quick-compose').each(function () {
            const $form = $(this);
            const $preview = $form.find('.js-social-compose-media-preview');
            if (!socialQuickComposeImageFile || !socialQuickComposeImagePreviewUrl) {
                $preview.prop('hidden', true);
                $preview.find('img').attr('src', '');
                $form.toggleClass('has-content', !!String($form.find('.js-social-quick-content').val() || '').trim());
                updateSocialQuickComposeMetrics($form.find('.js-social-quick-content'));
                return;
            }

            $preview.find('img').attr('src', socialQuickComposeImagePreviewUrl);
            $preview.find('.js-social-compose-media-name').text(socialQuickComposeImageFile.name || '写真');
            $preview.find('.js-social-compose-media-size').text(formatSocialComposeFileSize(socialQuickComposeImageFile.size));
            $preview.prop('hidden', false);
            $form.addClass('is-expanded has-content');
            updateSocialQuickComposeMetrics($form.find('.js-social-quick-content'));
        });
    }

    function handleSocialComposeImageChange() {
        const file = this.files && this.files[0] ? this.files[0] : null;
        if (!file) return;

        if (!/^image\/(jpeg|png|webp|gif)$/i.test(file.type || '')) {
            this.value = '';
            SetaeCore.showToast('JPEG、PNG、WebP、GIF画像を選択してください', 'error');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            this.value = '';
            SetaeCore.showToast('画像は5MB以下にしてください', 'error');
            return;
        }

        if (socialQuickComposeImagePreviewUrl) {
            URL.revokeObjectURL(socialQuickComposeImagePreviewUrl);
        }
        socialQuickComposeImageFile = file;
        socialQuickComposeImagePreviewUrl = URL.createObjectURL(file);
        renderSocialComposeImagePreview();
    }

    function clearSocialComposeImage(e) {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        if (socialQuickComposeImagePreviewUrl) {
            URL.revokeObjectURL(socialQuickComposeImagePreviewUrl);
        }
        socialQuickComposeImageFile = null;
        socialQuickComposeImagePreviewUrl = '';
        $('.js-social-compose-file').val('');
        $('.js-social-compose-media-alt').val('');
        renderSocialComposeImagePreview();
        if (e) {
            const $activeForm = $('.setae-section:visible .js-social-quick-compose').first();
            if ($activeForm.length) scheduleSocialQuickComposeDraftSave($activeForm);
        }
    }

    function handleSocialComposeSubjectToggle(e) {
        e.preventDefault();
        e.stopPropagation();
        const $button = $(this);
        const $form = $button.closest('.js-social-quick-compose');
        const $subject = $form.find('.js-social-compose-subject');
        const willOpen = $subject.prop('hidden');

        $subject.prop('hidden', !willOpen);
        $button.attr('aria-pressed', willOpen ? 'true' : 'false').toggleClass('is-active', willOpen);
        $form.toggleClass('has-cw', willOpen).addClass('is-expanded');

        if (willOpen) {
            window.setTimeout(function () {
                $form.find('.js-social-compose-subject-input').trigger('focus');
            }, 0);
        } else {
            $form.find('.js-social-compose-subject-input').val('');
        }
        scheduleSocialQuickComposeDraftSave($form);
    }

    function buildSocialQuickTitle(content, type) {
        const firstLine = String(content || '')
            .split(/\r?\n/)
            .map(function (line) { return line.trim(); })
            .find(function (line) { return !!line; }) || '';
        const normalized = firstLine.replace(/\s+/g, ' ');
        const characters = Array.from(normalized);

        if (!characters.length) {
            return type === 'question' ? '写真について質問' : '写真を共有しました';
        }
        if (characters.length <= 48) return normalized;
        return characters.slice(0, 47).join('') + '…';
    }

    function handleSocialQuickComposeSubmit(e) {
        e.preventDefault();
        const $form = $(this);
        const $input = $form.find('.js-social-quick-content');
        const $button = $form.find('.social-quick-compose-submit');
        const content = String($input.val() || '').trim();
        const type = $form.find('.social-quick-compose-type').val() || 'chat';
        const subjectOpen = !$form.find('.js-social-compose-subject').prop('hidden');
        const subject = subjectOpen
            ? String($form.find('.js-social-compose-subject-input').val() || '').trim()
            : '';
        const hasImage = !!socialQuickComposeImageFile;

        if ((!content && !hasImage) || $button.prop('disabled')) return;

        $button.prop('disabled', true).text('投稿中');
        const payload = new FormData();
        payload.append('title', subject || buildSocialQuickTitle(content, type));
        payload.append('content', content);
        payload.append('type', type);
        payload.append('has_cw', subjectOpen && subject ? '1' : '0');
        if (hasImage) {
            payload.append('image', socialQuickComposeImageFile, socialQuickComposeImageFile.name);
            payload.append('image_alt', String($form.find('.js-social-compose-media-alt').val() || '').trim());
        }

        const request = SetaeAPI.createTopic(payload, function () {
            clearSocialQuickComposeDraft();
            SetaeCore.showToast('投稿しました', 'success');
            openSocialHubView('community');

            if (typeof SetaeCore.track === 'function') {
                SetaeCore.track('community_quick_post_created', {
                    type: type,
                    length: Array.from(content).length,
                    has_image: hasImage,
                    has_cw: !!(subjectOpen && subject)
                });
            }
        });

        if (request && request.always) {
            request.always(function () {
                $button.text('投稿');
                if (String($input.val() || '').trim() || socialQuickComposeImageFile) {
                    $button.prop('disabled', false);
                }
            });
        } else {
            $button.text('投稿').prop('disabled', !String($input.val() || '').trim() && !socialQuickComposeImageFile);
        }
    }

    function handleSocialContentWarningToggle(e) {
        e.preventDefault();
        e.stopPropagation();
        const $button = $(this);
        const targetId = $button.attr('aria-controls');
        const $content = targetId ? $('#' + targetId) : $button.closest('.social-content-warning').next('.social-cw-content');
        if (!$content.length) return;

        const willExpand = $content.prop('hidden');
        $content.prop('hidden', !willExpand);
        $button.attr('aria-expanded', willExpand ? 'true' : 'false').text(willExpand ? '隠す' : '表示');
    }

    function syncSocialHubTabs(view) {
        const activeView = view === 'community' ? 'community' : 'care';
        $('.social-hub-tab').each(function () {
            const isActive = $(this).data('social-view') === activeView;
            $(this).toggleClass('active', isActive).attr('aria-selected', isActive ? 'true' : 'false');
        });
    }

    function openSocialHubView(view) {
        const activeView = view === 'community' ? 'community' : 'care';
        const sectionId = activeView === 'community' ? 'section-com' : 'section-care-feed';
        const $activeComposer = $('.setae-section:visible .js-social-quick-compose').first();
        if ($activeComposer.length) {
            persistSocialQuickComposeDraft($activeComposer);
        }

        currentSocialHubView = activeView;
        $('.social-filter-panel').removeClass('is-mobile-open');
        $('.js-social-filter-toggle').attr('aria-expanded', 'false');
        syncPrimaryNav(sectionId);
        $('#section-care-feed-detail, #section-com-detail').hide();
        showPrimarySection(sectionId);
        syncSocialHubTabs(activeView);
        restoreSocialQuickComposeDraft();

        if (activeView === 'community') {
            loadTopics();
            refreshCommunityUnread();
        } else {
            loadCareFeed();
            refreshCareFeedUnread();
        }
        setSocialLiveStatus(activeView, navigator.onLine === false ? 'offline' : 'live');
        scheduleSocialLivePoll(2500);
    }

    // ==========================================
    // トピック一覧 (Community)
    // ==========================================

    // ▼ 追加: バッジHTML生成関数
    function generateUserBadgesHtml(isPremium, bonusSlots) {
        let html = '';
        if (isPremium) {
            //   html += '<span class="supporter-badge" title="Setae Supporter">✦</span>';
        }
        if (bonusSlots > 0) {
            let bonusClass = '';
            let bonusLabel = '';
            if (bonusSlots >= 51) { bonusClass = 'tier-legend'; bonusLabel = '★'; }
            else if (bonusSlots >= 41) { bonusClass = 'tier-epic'; bonusLabel = 'V'; }
            else if (bonusSlots >= 31) { bonusClass = 'tier-rare'; bonusLabel = 'IV'; }
            else if (bonusSlots >= 21) { bonusClass = 'tier-uncommon'; bonusLabel = 'III'; }
            else if (bonusSlots >= 11) { bonusClass = 'tier-advanced'; bonusLabel = 'II'; }
            else if (bonusSlots >= 1) { bonusClass = 'tier-basic'; bonusLabel = 'I'; }
            html += `<span class="bonus-badge ${bonusClass}" title="ボーナス枠: ${bonusSlots}">${bonusLabel}</span>`;
        }
        return html;
    }
    // ▲ 追加ここまで

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

    // ==========================================
    // Care Feed
    // ==========================================
    let currentCareFeedPage = 1;
    let isCareFeedLoading = false;
    let currentCareFeedId = null;
    let currentCareFeedCommentPage = 1;
    let isCareFeedCommentLoading = false;
    let currentCareFeedFilter = localStorage.getItem('setae_care_feed_filter') || 'all';
    let currentCareFeedSort = localStorage.getItem('setae_care_feed_sort') || 'new';
    let currentCareFeedScope = localStorage.getItem('setae_care_feed_scope') || 'all';
    let currentCareFeedItems = [];
    let latestCareFeedActivity = [];
    let careFeedReplyTarget = null;
    let careFeedActivityTrackedKey = '';
    let careFeedEmptyTrackedKey = '';

    function getCareFeedFallbackUrl(classification) {
        const map = {
            plant: 'plant.svg',
            scorpion: 'scorpion.svg',
            insect: 'insect.svg',
            tarantula: 'spider-silhouette.svg'
        };
        const fileName = map[classification] || 'generic-specimen.svg';
        const base = (typeof SetaeSettings !== 'undefined' && SetaeSettings.plugin_url)
            ? SetaeSettings.plugin_url
            : '/wp-content/plugins/setae-core/';
        return base + 'assets/images/specimen/' + fileName;
    }

    function getCareFeedMetaText(item) {
        const data = item.data || {};
        const parts = [];

        if (data.refused) {
            parts.push('拒食');
        } else if (data.prey_type) {
            parts.push(data.prey_type);
        }

        if (data.size) {
            parts.push(data.size + 'cm');
        }

        if (data.is_best_shot) {
            parts.push('図鑑候補写真');
        }

        return parts.join(' / ');
    }

    function renderCareFeedDesktopSummary(items) {
        const $panel = $('#care-feed-desktop-summary');
        if (!$panel.length) return;

        const visibleItems = Array.isArray(items) ? items : [];
        if (!visibleItems.length) {
            $panel.hide().empty();
            return;
        }

        const conversationCount = visibleItems.filter(function (item) {
            return (parseInt(item.comment_count, 10) || 0) > 0;
        }).length;
        const replyCount = visibleItems.filter(function (item) {
            return (parseInt(item.reply_count, 10) || 0) > 0;
        }).length;
        const photoCount = visibleItems.filter(function (item) {
            return !!item.image;
        }).length;
        const filterLabel = getCareFeedFilterLabel(currentCareFeedFilter || 'all');
        const sortLabel = currentCareFeedSort === 'new' ? '新しい順' : '会話中';
        const scopeLabel = getCareFeedScopeLabel(currentCareFeedScope || 'all');
        const activeItems = visibleItems.slice().sort(function (a, b) {
            const bScore = (parseInt(b.comment_count, 10) || 0) + (parseInt(b.reply_count, 10) || 0) * 2;
            const aScore = (parseInt(a.comment_count, 10) || 0) + (parseInt(a.reply_count, 10) || 0) * 2;
            return bScore - aScore;
        }).slice(0, 3);
        const activityRows = activeItems.map(function (item) {
            const spider = item.spider || {};
            const author = item.author || {};
            const conversationTotal = parseInt(item.comment_count, 10) || 0;
            return `
                <button type="button" class="social-rail-topic js-care-feed-comment-open"
                    data-id="${escapeHtml(item.id)}">
                    <span>${escapeHtml(author.name || '飼育者')} · ${escapeHtml(item.type_label || '記録')}</span>
                    <strong>${escapeHtml(spider.title || '名前なし')}</strong>
                    <em>${conversationTotal ? escapeHtml(conversationTotal + '件の会話') : '新しい記録'}</em>
                </button>
            `;
        }).join('');

        $panel.html(`
            <section class="care-feed-rail-overview">
                <div class="care-feed-rail-head">
                    <span>このタイムライン</span>
                    <strong>${escapeHtml(String(visibleItems.length))}<small>件</small></strong>
                </div>
                <p>${escapeHtml(scopeLabel)} / ${escapeHtml(filterLabel)}を${escapeHtml(sortLabel)}で表示中</p>
                <div class="care-feed-rail-metrics">
                    <span><b>${escapeHtml(String(conversationCount))}</b>会話あり</span>
                    <span><b>${escapeHtml(String(replyCount))}</b>返信あり</span>
                    <span><b>${escapeHtml(String(photoCount))}</b>写真付き</span>
                </div>
                ${activityRows ? `
                    <div class="social-rail-trends">
                        <h4>会話の動き</h4>
                        ${activityRows}
                    </div>
                ` : ''}
            </section>
        `).show();
    }

    function renderCareFeedActions(item) {
        if (!item || !item.id) return '';

        const menuId = 'care-feed-action-menu-' + escapeHtml(item.id);
        const menuItems = [];
        const author = item.author || {};
        const relationship = item.viewer_relationship || {};
        if (author.id && !relationship.is_self && !relationship.blocked) {
            const followLabel = relationship.following ? 'フォローを解除' : 'フォローする';
            menuItems.push(`
                <button type="button" class="care-feed-action-btn js-social-follow-toggle"
                    data-user-id="${escapeHtml(author.id)}"
                    data-user-name="${escapeHtml(author.name || 'このユーザー')}"
                    data-following="${relationship.following ? '1' : '0'}" role="menuitem">
                    <span class="dashicons ${relationship.following ? 'dashicons-minus' : 'dashicons-plus-alt2'}" aria-hidden="true"></span>
                    <span>${followLabel}</span>
                </button>
            `);
            menuItems.push(`
                <button type="button" class="care-feed-action-btn care-feed-action-danger js-social-block"
                    data-user-id="${escapeHtml(author.id)}"
                    data-user-name="${escapeHtml(author.name || 'このユーザー')}" role="menuitem">
                    <span class="dashicons dashicons-hidden" aria-hidden="true"></span>
                    <span>このユーザーをブロック</span>
                </button>
            `);
        }
        const shareButton = item.share_url ? `
            <button type="button" class="care-feed-action-btn care-feed-action-share js-care-feed-copy-link"
                data-id="${escapeHtml(item.id)}" data-url="${escapeHtml(item.share_url)}" role="menuitem">
                <span class="dashicons dashicons-admin-links" aria-hidden="true"></span>
                <span>リンクをコピー</span>
            </button>
        ` : '';
        const shareTextButton = item.share_copy_text ? `
            <button type="button" class="care-feed-action-btn care-feed-action-copy js-care-feed-copy-share-text"
                data-id="${escapeHtml(item.id)}" data-text="${escapeHtml(item.share_copy_text)}" role="menuitem">
                <span class="dashicons dashicons-clipboard" aria-hidden="true"></span>
                <span>紹介文をコピー</span>
            </button>
        ` : '';
        const xShareButton = item.x_share_url ? `
            <a class="care-feed-action-btn care-feed-action-x js-care-feed-share-outbound"
                href="${escapeHtml(item.x_share_url)}"
                target="_blank"
                rel="noopener noreferrer"
                data-id="${escapeHtml(item.id)}" data-channel="x" role="menuitem">
                <span class="dashicons dashicons-share-alt2" aria-hidden="true"></span>
                <span>Xで共有</span>
            </a>
        ` : '';
        const lineShareButton = item.line_share_url ? `
            <a class="care-feed-action-btn care-feed-action-line js-care-feed-share-outbound"
                href="${escapeHtml(item.line_share_url)}"
                target="_blank"
                rel="noopener noreferrer"
                data-id="${escapeHtml(item.id)}" data-channel="line" role="menuitem">
                <span class="dashicons dashicons-share-alt2" aria-hidden="true"></span>
                <span>LINEで共有</span>
            </a>
        ` : '';
        [shareButton, shareTextButton, xShareButton, lineShareButton].forEach(function (action) {
            if (action) menuItems.push(action);
        });

        if (item.can_manage) {
            menuItems.push(`
                <button type="button" class="care-feed-action-btn care-feed-action-danger js-care-feed-unshare" data-id="${escapeHtml(item.id)}" role="menuitem">
                    <span class="dashicons dashicons-dismiss" aria-hidden="true"></span>
                    <span>共有を解除</span>
                </button>
            `);
        } else {
            menuItems.push(`
                <button type="button" class="care-feed-action-btn js-care-feed-report" data-id="${escapeHtml(item.id)}" role="menuitem">
                    <span class="dashicons dashicons-flag" aria-hidden="true"></span>
                    <span>通報する</span>
                </button>
            `);
        }

        return `
            <div class="care-feed-actions">
                <button type="button" class="care-feed-more-btn js-care-feed-actions-toggle" aria-label="投稿の操作" title="投稿の操作" aria-expanded="false" aria-haspopup="menu" aria-controls="${menuId}">
                    <span class="dashicons dashicons-ellipsis" aria-hidden="true"></span>
                </button>
                <div id="${menuId}" class="care-feed-action-menu" role="menu" hidden>
                    ${menuItems.join('')}
                </div>
            </div>
        `;
    }

    function renderTopicActions(topic) {
        if (!topic || !topic.id) return '';

        const menuId = 'topic-action-menu-' + escapeHtml(topic.id);
        const menuItems = [];
        const relationship = topic.viewer_relationship || {};
        const authorId = parseInt(topic.author_id, 10) || 0;
        const authorName = topic.author_name || 'このユーザー';

        if (topic.author_profile_url) {
            menuItems.push(`
                <a class="care-feed-action-btn" href="${escapeHtml(topic.author_profile_url)}"
                    target="_blank" rel="noopener noreferrer" role="menuitem">
                    <span class="dashicons dashicons-id" aria-hidden="true"></span>
                    <span>プロフィールを見る</span>
                </a>
            `);
        }
        if (authorId && !relationship.is_self && !relationship.blocked) {
            menuItems.push(`
                <button type="button" class="care-feed-action-btn js-social-follow-toggle"
                    data-user-id="${escapeHtml(authorId)}"
                    data-user-name="${escapeHtml(authorName)}"
                    data-following="${relationship.following ? '1' : '0'}" role="menuitem">
                    <span class="dashicons ${relationship.following ? 'dashicons-minus' : 'dashicons-plus-alt2'}" aria-hidden="true"></span>
                    <span>${relationship.following ? 'フォローを解除' : 'フォローする'}</span>
                </button>
            `);
            menuItems.push(`
                <button type="button" class="care-feed-action-btn care-feed-action-danger js-social-block"
                    data-user-id="${escapeHtml(authorId)}"
                    data-user-name="${escapeHtml(authorName)}" role="menuitem">
                    <span class="dashicons dashicons-hidden" aria-hidden="true"></span>
                    <span>このユーザーをブロック</span>
                </button>
            `);
        }
        if (topic.link) {
            menuItems.push(`
                <button type="button" class="care-feed-action-btn js-social-share-post"
                    data-share-url="${escapeHtml(topic.link)}"
                    data-share-title="${escapeHtml(topic.title || 'SETAEの投稿')}"
                    data-copy-only="1" role="menuitem">
                    <span class="dashicons dashicons-admin-links" aria-hidden="true"></span>
                    <span>リンクをコピー</span>
                </button>
            `);
        }

        return `
            <div class="care-feed-actions">
                <button type="button" class="care-feed-more-btn js-care-feed-actions-toggle"
                    aria-label="投稿の操作" title="投稿の操作" aria-expanded="false"
                    aria-haspopup="menu" aria-controls="${menuId}">
                    <span class="dashicons dashicons-ellipsis" aria-hidden="true"></span>
                </button>
                <div id="${menuId}" class="care-feed-action-menu" role="menu" hidden>
                    ${menuItems.join('')}
                </div>
            </div>
        `;
    }

    function renderCareFeedMedia(item, spider) {
        const mediaUrl = item.image || item.fallback_image || getCareFeedFallbackUrl(item.classification);
        const hasPostedPhoto = !!item.image;
        const mediaAlt = (spider && spider.title ? spider.title + 'の写真' : 'お世話記録の写真');

        if (!hasPostedPhoto) {
            return `
                <div class="care-feed-media is-fallback">
                    <img src="${escapeHtml(mediaUrl)}" alt="">
                </div>
            `;
        }

        return `
            <button type="button" class="care-feed-media is-expandable js-care-feed-media-open" data-media-url="${escapeHtml(item.image)}" data-media-alt="${escapeHtml(mediaAlt)}" aria-label="${escapeHtml(mediaAlt)}を拡大" title="写真を拡大">
                <img src="${escapeHtml(item.image)}" alt="${escapeHtml(mediaAlt)}" loading="lazy">
                <span class="care-feed-media-zoom-mark" aria-hidden="true"></span>
            </button>
        `;
    }

    function ensureCareFeedMediaViewer() {
        let $viewer = $('#setae-care-feed-media-viewer');
        if ($viewer.length) return $viewer;

        $('body').append(`
            <div id="setae-care-feed-media-viewer" class="setae-care-media-viewer" role="dialog" aria-modal="true" aria-label="投稿写真" aria-hidden="true">
                <div class="setae-care-media-viewer-stage" role="document">
                    <button type="button" class="setae-care-media-viewer-close js-care-feed-media-close" aria-label="写真を閉じる" title="閉じる">&times;</button>
                    <img class="setae-care-media-viewer-image" alt="">
                </div>
            </div>
        `);

        return $('#setae-care-feed-media-viewer');
    }

    function handleCareFeedMediaOpen(e) {
        e.preventDefault();
        e.stopPropagation();

        const imageUrl = $(this).attr('data-media-url');
        if (!imageUrl) return;

        const $viewer = ensureCareFeedMediaViewer();
        careFeedMediaViewerTrigger = this;
        $viewer.find('.setae-care-media-viewer-image').attr({
            src: imageUrl,
            alt: $(this).attr('data-media-alt') || '投稿写真'
        });
        $viewer.addClass('is-open').attr('aria-hidden', 'false');
        $('body').addClass('setae-care-media-viewer-open');

        window.setTimeout(function () {
            $viewer.find('.js-care-feed-media-close').trigger('focus');
        }, 0);
    }

    function closeCareFeedMediaViewer(e) {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }

        const $viewer = $('#setae-care-feed-media-viewer');
        if (!$viewer.length || !$viewer.hasClass('is-open')) return;

        $viewer.removeClass('is-open').attr('aria-hidden', 'true');
        $('body').removeClass('setae-care-media-viewer-open');
        window.setTimeout(function () {
            if (!$viewer.hasClass('is-open')) {
                $viewer.find('.setae-care-media-viewer-image').attr({ src: '', alt: '' });
            }
        }, 180);

        if (careFeedMediaViewerTrigger && document.contains(careFeedMediaViewerTrigger)) {
            careFeedMediaViewerTrigger.focus();
        }
        careFeedMediaViewerTrigger = null;
    }

    function handleCareFeedMediaViewerBackdrop(e) {
        if (e.target === this) {
            closeCareFeedMediaViewer(e);
        }
    }

    function positionCareFeedActionMenu($actions) {
        if (!$actions || !$actions.length) return;

        const $trigger = $actions.find('.js-care-feed-actions-toggle').first();
        const $menu = $actions.find('.care-feed-action-menu').first();
        if (!$trigger.length || !$menu.length || $menu.prop('hidden')) return;

        const visualViewport = window.visualViewport;
        const viewportLeft = visualViewport ? visualViewport.offsetLeft : 0;
        const viewportTop = visualViewport ? visualViewport.offsetTop : 0;
        const viewportWidth = visualViewport
            ? visualViewport.width
            : (document.documentElement.clientWidth || window.innerWidth);
        const viewportHeight = visualViewport
            ? visualViewport.height
            : (document.documentElement.clientHeight || window.innerHeight);
        const edgeGap = 12;
        const triggerGap = 8;
        const triggerRect = $trigger[0].getBoundingClientRect();

        $menu
            .addClass('is-viewport-positioned')
            .css({
                right: 'auto',
                bottom: 'auto',
                left: edgeGap + 'px',
                top: edgeGap + 'px',
                visibility: 'hidden'
            });

        const menuRect = $menu[0].getBoundingClientRect();
        const menuWidth = Math.min(menuRect.width, Math.max(0, viewportWidth - edgeGap * 2));
        const menuHeight = Math.min(menuRect.height, Math.max(0, viewportHeight - edgeGap * 2));
        const minLeft = viewportLeft + edgeGap;
        const minTop = viewportTop + edgeGap;
        const maxLeft = Math.max(minLeft, viewportLeft + viewportWidth - menuWidth - edgeGap);
        const maxTop = Math.max(minTop, viewportTop + viewportHeight - menuHeight - edgeGap);
        let left = triggerRect.right - menuWidth;
        let top = triggerRect.bottom + triggerGap;

        left = Math.max(minLeft, Math.min(left, maxLeft));
        if (top + menuHeight > viewportTop + viewportHeight - edgeGap) {
            top = triggerRect.top - menuHeight - triggerGap;
        }
        top = Math.max(minTop, Math.min(top, maxTop));

        $menu.css({
            left: Math.round(left) + 'px',
            top: Math.round(top) + 'px',
            visibility: 'visible'
        });
    }

    function closeCareFeedActionMenus(exceptElement, restoreFocus) {
        $('.care-feed-actions.is-open').each(function () {
            if (exceptElement && this === exceptElement) return;
            const $actions = $(this);
            const shouldRestoreFocus = restoreFocus && this.contains(document.activeElement);
            $actions.removeClass('is-open');
            $actions.find('.js-care-feed-actions-toggle').attr('aria-expanded', 'false');
            $actions.find('.care-feed-action-menu')
                .prop('hidden', true)
                .removeClass('is-viewport-positioned')
                .css({
                    right: '',
                    bottom: '',
                    left: '',
                    top: '',
                    visibility: ''
                });
            if (shouldRestoreFocus) {
                $actions.find('.js-care-feed-actions-toggle').trigger('focus');
            }
        });
    }

    function handleCareFeedActionsToggle(e) {
        e.preventDefault();
        e.stopPropagation();

        const $actions = $(this).closest('.care-feed-actions');
        if (!$actions.length) return;

        const willOpen = !$actions.hasClass('is-open');
        closeCareFeedActionMenus(willOpen ? $actions[0] : null);
        $actions.toggleClass('is-open', willOpen);
        $(this).attr('aria-expanded', willOpen ? 'true' : 'false');
        $actions.find('.care-feed-action-menu').prop('hidden', !willOpen);

        if (willOpen) {
            positionCareFeedActionMenu($actions);
            window.requestAnimationFrame(function () {
                $actions.find('.care-feed-action-menu [role="menuitem"]').first().trigger('focus');
            });
        }
    }

    function handleCareFeedOverlayKeydown(e) {
        const $viewer = $('#setae-care-feed-media-viewer');
        if ($viewer.hasClass('is-open')) {
            if (e.key === 'Escape') {
                closeCareFeedMediaViewer(e);
                return;
            }

            if (e.key === 'Tab') {
                e.preventDefault();
                $viewer.find('.js-care-feed-media-close').trigger('focus');
            }
            return;
        }

        const $menu = $(e.target).closest('.care-feed-action-menu');
        if ($menu.length && ['ArrowDown', 'ArrowUp', 'Home', 'End'].indexOf(e.key) !== -1) {
            const menuItems = $menu.find('[role="menuitem"]:visible').toArray();
            if (!menuItems.length) return;

            e.preventDefault();
            const currentIndex = menuItems.indexOf(document.activeElement);
            let nextIndex = currentIndex;
            if (e.key === 'Home') nextIndex = 0;
            else if (e.key === 'End') nextIndex = menuItems.length - 1;
            else if (e.key === 'ArrowDown') nextIndex = (currentIndex + 1 + menuItems.length) % menuItems.length;
            else nextIndex = (currentIndex - 1 + menuItems.length) % menuItems.length;
            menuItems[nextIndex].focus();
            return;
        }

        if (e.key === 'Escape') {
            e.preventDefault();
            closeCareFeedActionMenus(null, true);
            closeSocialReactionPickers();
        }
    }

    function copyTextToClipboard(text) {
        if (SetaeCore && typeof SetaeCore.copyText === 'function') {
            return SetaeCore.copyText(text);
        }
        if (navigator.clipboard && window.isSecureContext) {
            return navigator.clipboard.writeText(text);
        }

        return new Promise(function (resolve, reject) {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.setAttribute('readonly', '');
            textarea.style.position = 'fixed';
            textarea.style.left = '-9999px';
            textarea.style.top = '0';
            document.body.appendChild(textarea);
            textarea.select();

            try {
                const successful = document.execCommand('copy');
                document.body.removeChild(textarea);
                successful ? resolve() : reject(new Error('copy_failed'));
            } catch (error) {
                document.body.removeChild(textarea);
                reject(error);
            }
        });
    }

    function confirmSocialAction(options) {
        if (SetaeCore && typeof SetaeCore.confirmAction === 'function') {
            return SetaeCore.confirmAction(options);
        }
        return Promise.resolve(window.confirm(String(options && options.message ? options.message : 'この操作を続けますか？')));
    }

    function requestSocialText(options) {
        if (SetaeCore && typeof SetaeCore.requestText === 'function') {
            return SetaeCore.requestText(options);
        }
        return Promise.resolve(window.prompt(String(options && options.message ? options.message : '入力してください'), String(options && options.value ? options.value : '')));
    }

    function showCopyFallback(title, value) {
        return requestSocialText({
            title: title,
            message: '自動でコピーできませんでした。下の内容を選択してコピーしてください。',
            inputLabel: title,
            value: value,
            maxLength: Math.max(500, String(value || '').length + 20),
            confirmLabel: '閉じる'
        });
    }

    function getSocialReactionSummary(reactions) {
        const values = Object.keys(reactions || {}).map(function (key) {
            return reactions[key] || {};
        });
        return {
            count: values.reduce(function (total, item) {
                return total + (parseInt(item.count, 10) || 0);
            }, 0),
            active: values.some(function (item) {
                return !!item.active;
            })
        };
    }

    function closeSocialReactionPickers(exceptElement) {
        $('.social-reaction-control.is-open').each(function () {
            if (exceptElement && this === exceptElement) return;
            const $control = $(this);
            $control.removeClass('is-open');
            $control.find('.js-social-reaction-picker-toggle').attr('aria-expanded', 'false');
            $control.find('.social-reaction-picker').prop('hidden', true);
        });
    }

    function handleSocialReactionPickerToggle(e) {
        e.preventDefault();
        e.stopPropagation();
        const $control = $(this).closest('.social-reaction-control');
        if (!$control.length) return;

        const willOpen = !$control.hasClass('is-open');
        closeSocialReactionPickers(willOpen ? $control.get(0) : null);
        $control.toggleClass('is-open', willOpen);
        $(this).attr('aria-expanded', willOpen ? 'true' : 'false');
        $control.find('.social-reaction-picker').prop('hidden', !willOpen);
    }

    function handleSocialPostShare(e) {
        e.preventDefault();
        e.stopPropagation();
        closeCareFeedActionMenus();
        closeSocialReactionPickers();

        const $button = $(this);
        const url = $button.attr('data-share-url') || '';
        const title = $button.attr('data-share-title') || 'SETAEの投稿';
        const copyOnly = String($button.attr('data-copy-only')) === '1';
        if (!url) return;

        if (!copyOnly && navigator.share) {
            navigator.share({ title: title, url: url }).catch(function (error) {
                if (!error || error.name !== 'AbortError') {
                    SetaeCore.showToast('共有を完了できませんでした', 'error');
                }
            });
            return;
        }

        copyTextToClipboard(url).then(function () {
            SetaeCore.showToast('投稿リンクをコピーしました', 'success');
        }).catch(function () {
            showCopyFallback('投稿リンク', url);
        });
    }

    function renderCareFeedReactions(item) {
        if (!item || !item.id) return '';

        const reactions = item.reactions || {};
        const keys = Object.keys(reactions);
        if (!keys.length) return '';
        const summary = getSocialReactionSummary(reactions);
        const pickerId = 'care-feed-reactions-' + escapeHtml(item.id);

        return `
            <div class="social-reaction-control${summary.active ? ' has-active-reaction' : ''}"
                data-care-reactions-for="${escapeHtml(item.id)}">
                <button type="button" class="social-post-action social-reaction-toggle js-social-reaction-picker-toggle"
                    aria-label="リアクション" title="リアクション" aria-expanded="false"
                    aria-haspopup="true" aria-controls="${pickerId}">
                    <span class="dashicons ${summary.active ? 'dashicons-star-filled' : 'dashicons-star-empty'} social-reaction-icon" aria-hidden="true"></span>
                    <b class="social-reaction-toggle-count">${summary.count || ''}</b>
                </button>
                <div id="${pickerId}" class="care-feed-reactions social-reaction-picker" role="group" aria-label="リアクションを選択" hidden>
                    ${keys.map(key => {
                const reaction = reactions[key] || {};
                const count = parseInt(reaction.count, 10) || 0;
                const activeClass = reaction.active ? 'active' : '';
                const reactionLabel = reaction.label || key;
                return `
                            <button type="button" class="care-feed-reaction-btn js-care-reaction ${activeClass}"
                                data-id="${escapeHtml(item.id)}"
                                data-reaction="${escapeHtml(key)}"
                                aria-label="${escapeHtml(reactionLabel)} ${escapeHtml(count)}件"
                                title="${escapeHtml(reactionLabel)}"
                                aria-pressed="${reaction.active ? 'true' : 'false'}">
                                <span>${escapeHtml(reaction.icon || '')}</span>
                                <em>${escapeHtml(reactionLabel)}</em>
                                <strong>${count}</strong>
                            </button>
                        `;
            }).join('')}
                </div>
            </div>
        `;
    }

    function updateCareFeedReactions(id, reactions) {
        $(`[data-care-reactions-for="${id}"]`).each(function () {
            $(this).replaceWith(renderCareFeedReactions({ id: id, reactions: reactions || {} }));
        });
    }

    function syncSocialUnreadBadges() {
        const careCount = Math.max(0, parseInt(latestCareFeedUnreadCount, 10) || 0);
        const communityCount = Math.max(0, parseInt(latestCommunityUnreadCount, 10) || 0);
        const total = careCount + communityCount;
        const $badge = $('#social-unread-badge');

        if ($badge.length) {
            if (total > 0) {
                $badge.text(total > 99 ? '99+' : total).css('display', 'flex');
            } else {
                $badge.text('0').hide();
            }
        }

        $('[data-social-unread="care"]').each(function () {
            const $count = $(this);
            $count.text(careCount > 99 ? '99+' : careCount).prop('hidden', careCount === 0);
        });
        $('[data-social-unread="community"]').each(function () {
            const $count = $(this);
            $count.text(communityCount > 99 ? '99+' : communityCount).prop('hidden', communityCount === 0);
        });
    }

    function renderCareFeedUnread(count) {
        latestCareFeedUnreadCount = parseInt(count, 10) || 0;
        syncSocialUnreadBadges();
    }

    function getCareFeedActivityActionLabel(item) {
        if (!item) return 'リアクション';
        if (item.type === 'comment') return 'コメント';
        if (item.type === 'reply') return '返信';
        return item.label || 'リアクション';
    }

    function renderCareFeedActivityOpenAttrs(item) {
        if (!item) return '';
        return `data-id="${escapeHtml(item.log_id)}" data-activity-type="${escapeHtml(item.type || '')}" data-comment-id="${escapeHtml(item.comment_id || '')}"`;
    }

    function renderCareFeedActivityPanel(activity, rawCount, meta) {
        const $panel = $('#care-feed-activity-panel');
        if (!$panel.length) return;

        meta = meta || {};
        const items = Array.isArray(activity) ? activity : [];
        if (!items.length || !rawCount) {
            $panel.hide().empty();
            return;
        }

        const trackedKey = String(rawCount) + ':' + items.map(item => item.log_id + ':' + item.type + ':' + (item.comment_id || '')).join('|');
        if (trackedKey !== careFeedActivityTrackedKey && typeof SetaeCore.track === 'function') {
            careFeedActivityTrackedKey = trackedKey;
            SetaeCore.track('care_feed_activity_panel_seen', {
                count: parseInt(rawCount, 10) || 0
            });
        }

        const hiddenCount = Math.max(0, (parseInt(rawCount, 10) || 0) - items.length);
        const counts = [
            { key: 'replies', label: '返信', count: parseInt(meta.replies, 10) || 0 },
            { key: 'comments', label: 'コメント', count: parseInt(meta.comments, 10) || 0 },
            { key: 'reactions', label: 'リアクション', count: parseInt(meta.reactions, 10) || 0 }
        ].filter(item => item.count > 0);
        const summaryHtml = counts.length
            ? `<div class="care-feed-activity-summary">${counts.map(item => `<span class="${item.key === 'replies' ? 'is-priority' : ''}">${escapeHtml(item.label)} ${escapeHtml(item.count)}</span>`).join('')}</div>`
            : '';
        const primaryItem = items.find(item => item.type === 'reply') || items[0];
        const primaryLabel = primaryItem && primaryItem.type === 'reply' ? '返信を見る' : '新着を見る';
        $panel.html(`
            <div class="care-feed-activity-head">
                <div>
                    <span>あなたへの新着反応</span>
                    <strong>${escapeHtml(rawCount)}件の新着</strong>
                </div>
                <div class="care-feed-activity-controls">
                    ${primaryItem ? `<button type="button" class="care-feed-activity-primary js-open-care-feed-activity" ${renderCareFeedActivityOpenAttrs(primaryItem)}>${escapeHtml(primaryLabel)}</button>` : ''}
                    <button type="button" id="btn-care-feed-activity-dismiss">既読にする</button>
                </div>
            </div>
            ${summaryHtml}
            <div class="care-feed-activity-list">
                ${items.map(item => `
                    <button type="button" class="care-feed-activity-item js-open-care-feed-activity" ${renderCareFeedActivityOpenAttrs(item)}>
                        <span class="care-feed-activity-icon">${escapeHtml(item.icon || (item.type === 'comment' || item.type === 'reply' ? '💬' : '✨'))}</span>
                        <span>
                            <strong>${escapeHtml(item.author || 'ユーザー')}さんが${escapeHtml(getCareFeedActivityActionLabel(item))}</strong>
                            <em>${escapeHtml(item.spider_title || '記録')} · ${escapeHtml(item.text || '')}</em>
                        </span>
                    </button>
                `).join('')}
            </div>
            ${hiddenCount > 0 ? `<p class="care-feed-activity-more">ほか ${escapeHtml(hiddenCount)}件</p>` : ''}
        `).show();
    }

    function refreshCareFeedUnread() {
        if (!SetaeAPI.fetchCareFeedUnread) return;

        SetaeAPI.fetchCareFeedUnread(function (response) {
            renderCareFeedUnread(response && response.count ? response.count : 0);
            latestCareFeedActivity = response && Array.isArray(response.latest) ? response.latest : [];
            renderCareFeedActivityPanel(latestCareFeedActivity, response && response.raw_count ? response.raw_count : 0, response || {});
        });
    }

    function markCareFeedRead(options) {
        options = options || {};
        function clearActivityPanel() {
            if (!options.clearPanel) return;
            latestCareFeedActivity = [];
            careFeedActivityTrackedKey = '';
            $('#care-feed-activity-panel').fadeOut(140, function () {
                $(this).empty();
            });
        }

        if (!SetaeAPI.markCareFeedRead) {
            renderCareFeedUnread(0);
            clearActivityPanel();
            return;
        }

        SetaeAPI.markCareFeedRead(function () {
            renderCareFeedUnread(0);
            clearActivityPanel();
        });
    }

    function renderCareFeedItem(item) {
        const author = item.author || {};
        const spider = item.spider || {};
        const relationship = item.viewer_relationship || {};
        const avatarHtml = author.avatar
            ? `<img src="${escapeHtml(author.avatar)}" alt="${escapeHtml(author.name || 'ユーザー')}" class="avatar-img">`
            : `<span class="avatar-initial">${escapeHtml(author.initial || '?')}</span>`;
        const avatarInnerHtml = `<div class="setae-user-avatar avatar-sm">${avatarHtml}</div>`;
        const avatarLinkHtml = author.profile_url
            ? `<a class="social-post-avatar-link care-feed-author-link" href="${escapeHtml(author.profile_url)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(author.name || 'ユーザー')}のプロフィール">${avatarInnerHtml}</a>`
            : avatarInnerHtml;
        const authorNameHtml = author.profile_url
            ? `<a class="setae-author-name care-feed-author-link" href="${escapeHtml(author.profile_url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(author.name || 'ユーザー不明')}</a>`
            : `<span class="setae-author-name">${escapeHtml(author.name || 'ユーザー不明')}</span>`;
        const authorHandle = String(author.handle || '').replace(/^@/, '');
        const authorHandleHtml = authorHandle
            ? `<span class="social-author-handle" title="ログイン情報とは異なるSETAE専用公開ID">@${escapeHtml(authorHandle)}</span>`
            : '';
        const followingMarkHtml = relationship.following ? `
            <span class="social-following-mark" title="フォロー中">
                <span class="dashicons dashicons-yes-alt" aria-hidden="true"></span>
                <span class="screen-reader-text">フォロー中</span>
            </span>
        ` : '';
        const metaText = getCareFeedMetaText(item);
        const noteHtml = item.note ? `<p class="care-feed-note">${escapeHtml(item.note)}</p>` : '';
        const commentCount = parseInt(item.comment_count, 10) || 0;
        const replyCount = parseInt(item.reply_count, 10) || 0;
        const commentLabel = commentCount > 0
            ? (replyCount > 0 ? `${commentCount}件の会話を見る` : `${commentCount}件のコメントを見る`)
            : 'コメントする';
        const conversationBadge = replyCount > 0
            ? `<span class="care-feed-meta-chip care-feed-conversation-chip">返信あり ${escapeHtml(replyCount)}</span>`
            : '';
        const publishedTime = item.created_at || item.date;
        const activityLabel = item.last_activity_label || '会話を更新';
        const activityTime = item.last_activity_at || publishedTime;
        const activityType = item.last_activity_type || 'post';
        const activityHtml = `
            <time class="setae-topic-time"
                datetime="${escapeHtml(publishedTime || '')}"
                title="${escapeHtml(publishedTime || '')}">
                ${escapeHtml(SetaeCore.formatRelativeDate(publishedTime))}
            </time>
        `;
        const activityNoteHtml = activityType !== 'post' && activityTime ? `
            <div class="social-post-activity-note">
                <span class="dashicons dashicons-admin-comments" aria-hidden="true"></span>
                <span>${escapeHtml(activityLabel)}</span>
                <time datetime="${escapeHtml(activityTime)}" title="${escapeHtml(activityTime)}">${escapeHtml(SetaeCore.formatRelativeDate(activityTime))}</time>
            </div>
        ` : '';
        const shareAction = item.share_url ? `
            <button type="button" class="social-post-action social-post-share-action js-social-share-post"
                data-share-url="${escapeHtml(item.share_url)}"
                data-share-title="${escapeHtml((spider.title || 'お世話記録') + ' · SETAE')}"
                aria-label="共有" title="共有">
                <span class="dashicons dashicons-share-alt2" aria-hidden="true"></span>
            </button>
        ` : '';
        const latestComments = Array.isArray(item.latest_comments) && item.latest_comments.length ? `
            <div class="care-feed-latest-comments">
                ${item.latest_comments.map(comment => `
                    <button type="button" class="care-feed-latest-comment js-care-feed-preview-comment" data-id="${escapeHtml(item.id)}" data-comment-id="${escapeHtml(comment.id)}">
                        ${comment.parent_id ? `<span class="care-feed-latest-reply">返信</span>` : ''}
                        <strong>${escapeHtml(comment.author && comment.author.name ? comment.author.name : 'ユーザー不明')}</strong>
                        ${comment.author && comment.author.handle ? `<span class="social-author-handle" title="SETAE専用公開ID">@${escapeHtml(String(comment.author.handle).replace(/^@/, ''))}</span>` : ''}
                        <span>${escapeHtml(comment.content)}</span>
                    </button>
                `).join('')}
            </div>
        ` : '';

        return `
            <article class="setae-care-feed-item social-timeline-post" data-id="${escapeHtml(item.id)}"
                tabindex="0" aria-label="${escapeHtml((author.name || '飼育者') + 'の' + (item.type_label || 'お世話記録'))}">
                <div class="social-post-avatar">${avatarLinkHtml}</div>
                <div class="social-post-content">
                    <div class="social-post-header care-feed-top">
                        <div class="social-post-author-line">
                            ${authorNameHtml}
                            ${authorHandleHtml}
                            ${followingMarkHtml}
                            ${activityHtml}
                        </div>
                        ${renderCareFeedActions(item)}
                    </div>

                    <div class="care-feed-body">
                        <div class="care-feed-badges">
                            <span class="setae-topic-badge badge-chat">${escapeHtml(item.type_label || '記録')}</span>
                            ${metaText ? `<span class="care-feed-meta-chip">${escapeHtml(metaText)}</span>` : ''}
                            ${conversationBadge}
                        </div>
                        <h3>${escapeHtml(spider.title || '名前なし')}</h3>
                        <p class="care-feed-species">${escapeHtml(spider.species_name || '未同定')}</p>
                        ${noteHtml}
                    </div>

                    ${renderCareFeedMedia(item, spider)}
                    ${activityNoteHtml}
                    ${latestComments}
                    <div class="care-feed-footer social-post-action-row">
                        <button type="button" class="social-post-action care-feed-comment-link js-care-feed-comment-open"
                            data-id="${escapeHtml(item.id)}" aria-label="${escapeHtml(commentLabel)}" title="${escapeHtml(commentLabel)}">
                            <span class="dashicons dashicons-undo" aria-hidden="true"></span>
                            <b>${commentCount ? escapeHtml(commentCount) : ''}</b>
                        </button>
                        ${renderCareFeedReactions(item)}
                        ${shareAction}
                    </div>
                </div>
            </article>
        `;
    }

    function renderCareFeedDetailCard(item) {
        const html = renderCareFeedItem(item);
        return html.replace('setae-care-feed-item social-timeline-post', 'setae-care-feed-detail-card social-timeline-post');
    }

    function renderCareFeedComment(comment) {
        const author = comment.author || {};
        const avatarHtml = author.avatar
            ? `<img src="${escapeHtml(author.avatar)}" alt="${escapeHtml(author.name || 'ユーザー')}" class="avatar-img">`
            : `<span class="avatar-initial">${escapeHtml(author.initial || '?')}</span>`;
        const parentId = parseInt(comment.parent_id, 10) || 0;
        const authorHandle = String(author.handle || '').replace(/^@/, '');
        const avatarInnerHtml = `<div class="setae-user-avatar avatar-sm">${avatarHtml}</div>`;
        const avatarLinkHtml = author.profile_url
            ? `<a class="social-post-avatar-link" href="${escapeHtml(author.profile_url)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(author.name || 'ユーザー')}のプロフィール">${avatarInnerHtml}</a>`
            : avatarInnerHtml;
        const authorNameHtml = author.profile_url
            ? `<a class="setae-author-name care-feed-author-link" href="${escapeHtml(author.profile_url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(author.name || 'ユーザー不明')}</a>`
            : `<strong class="setae-author-name">${escapeHtml(author.name || 'ユーザー不明')}</strong>`;
        const replyClass = parentId ? ' is-reply' : '';
        const replyToHtml = parentId && comment.parent_author
            ? `<button type="button" class="care-feed-comment-reply-to js-care-comment-parent" data-parent-id="${escapeHtml(parentId)}">↳ ${escapeHtml(comment.parent_author)}さんへの返信を見る</button>`
            : '';
        const replyBtn = `<button type="button" class="care-feed-comment-tool js-care-comment-reply" data-id="${escapeHtml(comment.id)}" data-author="${escapeHtml(author.name || 'ユーザー不明')}">返信</button>`;
        const toolsHtml = comment.can_delete
            ? `${replyBtn}<button type="button" class="care-feed-comment-tool care-feed-action-danger js-care-comment-delete" data-id="${escapeHtml(comment.id)}">削除</button>`
            : `${replyBtn}<button type="button" class="care-feed-comment-tool js-care-comment-report" data-id="${escapeHtml(comment.id)}">通報</button>`;

        return `
            <div class="setae-comment-row care-feed-comment-row${replyClass}" data-id="${escapeHtml(comment.id)}">
                <div class="setae-comment-meta">
                    ${avatarLinkHtml}
                    <div class="care-feed-comment-identity">
                        <div class="social-post-author-line">
                            ${authorNameHtml}
                            ${authorHandle ? `<span class="social-author-handle" title="SETAE専用公開ID">@${escapeHtml(authorHandle)}</span>` : ''}
                            <time class="setae-topic-time" datetime="${escapeHtml(comment.date || '')}" title="${escapeHtml(comment.date || '')}">${escapeHtml(SetaeCore.formatRelativeDate(comment.date))}</time>
                        </div>
                    </div>
                    <div class="care-feed-comment-tools">${toolsHtml}</div>
                </div>
                <div class="setae-comment-body">
                    ${replyToHtml}
                    <p>${escapeHtml(comment.content)}</p>
                </div>
            </div>
        `;
    }

    function getCareFeedFilterLabel(filter) {
        const labels = {
            all: 'すべて',
            tarantula: 'タランチュラ',
            scorpion: 'サソリ',
            reptile: '爬虫類',
            plant: '植物',
            other: 'その他'
        };
        return labels[filter] || 'この条件';
    }

    function getCareFeedScopeLabel(scope) {
        const labels = {
            all: 'みんなの記録',
            following: 'フォロー中',
            mine: '自分の記録'
        };
        return labels[scope] || labels.all;
    }

    function renderCareFeedEmptyState() {
        const isFiltered = currentCareFeedFilter && currentCareFeedFilter !== 'all';
        const isScoped = currentCareFeedScope && currentCareFeedScope !== 'all';
        const filterLabel = getCareFeedFilterLabel(currentCareFeedFilter);
        let title = '共有されたお世話記録はまだありません';
        let text = '自分の記録を共有すると、ここから会話が始まります。';
        if (currentCareFeedScope === 'following') {
            title = 'フォロー中の記録はまだありません';
            text = '気になる飼育者をフォローすると、ここに記録が並びます。';
        } else if (currentCareFeedScope === 'mine') {
            title = '共有した自分の記録はまだありません';
            text = '記録を共有すると、自分の飼育履歴としてここから振り返れます。';
        } else if (isFiltered) {
            title = `${filterLabel}のお世話記録はまだありません`;
            text = 'ほかの分類を見るか、自分の記録を共有してみましょう。';
        }
        const resetButton = isFiltered
            ? '<button type="button" class="setae-btn-secondary js-care-feed-clear-filter">すべてを見る</button>'
            : '';
        const resetScopeButton = isScoped
            ? '<button type="button" class="setae-btn-secondary js-care-feed-clear-scope">みんなの記録を見る</button>'
            : '';

        const trackKey = `${currentCareFeedScope || 'all'}:${currentCareFeedFilter || 'all'}:${currentCareFeedSort || 'new'}`;
        if (careFeedEmptyTrackedKey !== trackKey && typeof SetaeCore.track === 'function') {
            careFeedEmptyTrackedKey = trackKey;
            SetaeCore.track('care_feed_empty_seen', {
                filter: currentCareFeedFilter || 'all',
                sort: currentCareFeedSort || 'new',
                scope: currentCareFeedScope || 'all',
                filtered: isFiltered || isScoped
            });
        }

        return `
            <div class="setae-empty-state care-feed-empty-state">
                <span class="empty-icon">+</span>
                <h3>${escapeHtml(title)}</h3>
                <p>${escapeHtml(text)}</p>
                <div class="setae-empty-actions">
                    ${resetButton}
                    ${resetScopeButton}
                    <button type="button" class="setae-btn js-care-feed-go-record">マイ個体で記録する</button>
                </div>
            </div>
        `;
    }

    function loadCareFeed(isLoadMore = false, options) {
        options = options || {};
        const silent = !isLoadMore && !!options.silent;
        const liveMerge = !isLoadMore && !!options.liveMerge;
        if (isCareFeedLoading || !SetaeAPI.fetchCareFeed) return null;

        const previousPage = currentCareFeedPage;
        const timelineAnchor = liveMerge ? captureSocialTimelineAnchor('care') : null;
        isCareFeedLoading = true;
        syncCareFeedFilterUI();

        if (!isLoadMore) {
            if (!liveMerge) {
                currentCareFeedPage = 1;
                hideSocialNewPostsBanner('care');
            }
            if (!silent) {
                currentCareFeedItems = [];
                renderCareFeedDesktopSummary([]);
                $('#setae-care-feed-list').attr('aria-busy', 'true').html(`
                    <div class="setae-view-state" role="status">
                        <span class="setae-view-state-mark" aria-hidden="true"></span>
                        <strong>お世話記録を読み込んでいます</strong>
                        <p>新しい記録と会話を整理しています。</p>
                    </div>
                `);
                $('#setae-care-feed-load-more').hide();
            }
        } else {
            $('#btn-load-more-care-feed').hide();
            $('#loader-care-feed').show();
        }

        const params = {
            page: isLoadMore ? currentCareFeedPage : 1,
            sort: currentCareFeedSort || 'new',
            scope: currentCareFeedScope || 'all'
        };
        if (currentCareFeedFilter && currentCareFeedFilter !== 'all') {
            params.classification = currentCareFeedFilter;
        }

        const request = SetaeAPI.fetchCareFeed(params, function (response) {
            const container = $('#setae-care-feed-list');
            let items = response.items || [];
            const hasNext = response.has_next || false;
            if (liveMerge) {
                const liveItems = mergeSocialTimelineItems(options.liveItems || [], items);
                items = mergeSocialTimelineItems(liveItems, currentCareFeedItems);
            }

            if (!isLoadMore) {
                container.empty();
            } else {
                $('#loader-care-feed').hide();
            }

            if (!items.length) {
                if (!isLoadMore) {
                    currentCareFeedItems = [];
                    renderCareFeedDesktopSummary([]);
                    container.html(renderCareFeedEmptyState());
                }
                $('#setae-care-feed-load-more').hide();
                if (liveMerge) {
                    setSocialLiveStatus('care', 'live');
                }
                return;
            }

            if (isLoadMore) {
                currentCareFeedItems = currentCareFeedItems.concat(items);
            } else {
                currentCareFeedItems = items.slice();
            }
            renderCareFeedDesktopSummary(currentCareFeedItems);

            items.forEach(item => {
                container.append(renderCareFeedItem(item));
            });

            if (!liveMerge) {
                if (hasNext) {
                    currentCareFeedPage++;
                    $('#setae-care-feed-load-more').show();
                    $('#btn-load-more-care-feed').show();
                } else {
                    $('#setae-care-feed-load-more').hide();
                }
            } else {
                currentCareFeedPage = previousPage;
                finishSocialLiveMerge('care', options.newIds || [], options.liveUpdateCount || 0, timelineAnchor);
            }
        }, function (xhr) {
            if (silent) {
                setSocialLiveStatus('care', 'offline');
                return;
            }
            const message = SetaeCore.getErrorMessage
                ? SetaeCore.getErrorMessage(xhr, '通信状態を確認して、もう一度お試しください。')
                : '通信状態を確認して、もう一度お試しください。';
            if (isLoadMore) {
                SetaeCore.showToast('続きの記録を読み込めませんでした。表示中の内容はそのままです。', 'warning');
                return;
            }
            renderCareFeedDesktopSummary([]);
            $('#setae-care-feed-list').html(`
                <div class="setae-view-state is-error" role="alert">
                    <span class="setae-view-state-mark" aria-hidden="true"></span>
                    <strong>お世話記録を読み込めませんでした</strong>
                    <p>${escapeHtml(message)}</p>
                    <button type="button" class="js-retry-care-feed">もう一度読み込む</button>
                </div>
            `);
        });
        if (request && request.always) {
            request.always(function () {
                isCareFeedLoading = false;
                $('#setae-care-feed-list').removeAttr('aria-busy');
                $('#loader-care-feed').hide();
                $('#btn-load-more-care-feed').show();
            });
        }
        return request;
    }

    function syncCareFeedFilterUI() {
        $('.care-feed-scope-btn').removeClass('active');
        $(`.care-feed-scope-btn[data-scope="${currentCareFeedScope || 'all'}"]`).addClass('active');
        $('.care-feed-filter-btn').removeClass('active');
        $(`.care-feed-filter-btn[data-filter="${currentCareFeedFilter || 'all'}"]`).addClass('active');
        $('.care-feed-sort-btn').removeClass('active');
        $(`.care-feed-sort-btn[data-sort="${currentCareFeedSort || 'new'}"]`).addClass('active');
        $('#care-feed-filter-select').val(currentCareFeedFilter || 'all');
        $('#care-feed-sort-select').val(currentCareFeedSort || 'new');
    }

    function handleCareFeedFilterClick(e) {
        e.preventDefault();
        e.stopPropagation();

        currentCareFeedFilter = $(this).data('filter') || 'all';
        localStorage.setItem('setae_care_feed_filter', currentCareFeedFilter);
        syncCareFeedFilterUI();
        loadCareFeed(false);
    }

    function handleCareFeedFilterSelectChange() {
        currentCareFeedFilter = $(this).val() || 'all';
        localStorage.setItem('setae_care_feed_filter', currentCareFeedFilter);
        syncCareFeedFilterUI();
        loadCareFeed(false);
    }

    function handleCareFeedScopeClick(e) {
        e.preventDefault();
        e.stopPropagation();

        currentCareFeedScope = $(this).data('scope') || 'all';
        localStorage.setItem('setae_care_feed_scope', currentCareFeedScope);
        syncCareFeedFilterUI();
        loadCareFeed(false);
    }

    function handleCareFeedSortClick(e) {
        e.preventDefault();
        e.stopPropagation();

        currentCareFeedSort = $(this).data('sort') || 'new';
        localStorage.setItem('setae_care_feed_sort', currentCareFeedSort);
        syncCareFeedFilterUI();
        loadCareFeed(false);

        if (typeof SetaeCore.track === 'function') {
            SetaeCore.track('care_feed_sort_change', { sort: currentCareFeedSort });
        }
    }

    function handleCareFeedSortSelectChange() {
        currentCareFeedSort = $(this).val() || 'new';
        localStorage.setItem('setae_care_feed_sort', currentCareFeedSort);
        syncCareFeedFilterUI();
        loadCareFeed(false);

        if (typeof SetaeCore.track === 'function') {
            SetaeCore.track('care_feed_sort_change', { sort: currentCareFeedSort });
        }
    }

    function handleCareFeedClearFilterClick(e) {
        e.preventDefault();
        e.stopPropagation();

        currentCareFeedFilter = 'all';
        localStorage.setItem('setae_care_feed_filter', currentCareFeedFilter);
        syncCareFeedFilterUI();
        loadCareFeed(false);

        if (typeof SetaeCore.track === 'function') {
            SetaeCore.track('care_feed_empty_filter_reset');
        }
    }

    function handleCareFeedClearScopeClick(e) {
        e.preventDefault();
        e.stopPropagation();

        currentCareFeedScope = 'all';
        localStorage.setItem('setae_care_feed_scope', currentCareFeedScope);
        syncCareFeedFilterUI();
        loadCareFeed(false);
    }

    function renderCareFeedRelationshipUsers(users, action) {
        const items = Array.isArray(users) ? users : [];
        if (!items.length) {
            return '<p class="care-feed-relationship-empty">まだいません</p>';
        }

        return items.map(function (user) {
            const name = user && user.name ? user.name : 'ユーザー不明';
            const handle = String(user && user.handle ? user.handle : '').replace(/^@/, '');
            const avatarHtml = user && user.avatar
                ? `<img src="${escapeHtml(user.avatar)}" alt="${escapeHtml(name)}">`
                : `<span>${escapeHtml(user && user.initial ? user.initial : '?')}</span>`;
            const isFollowing = action === 'unfollow';
            const buttonClass = isFollowing ? 'js-social-follow-toggle' : 'js-social-unblock';
            const label = isFollowing ? '解除' : 'ブロック解除';
            const followingAttr = isFollowing ? ' data-following="1"' : '';

            return `
                <div class="care-feed-relationship-user">
                    <span class="care-feed-relationship-avatar">${avatarHtml}</span>
                    <span class="care-feed-relationship-identity">
                        <strong>${escapeHtml(name)}</strong>
                        ${handle ? `<em title="SETAE専用公開ID">@${escapeHtml(handle)}</em>` : ''}
                    </span>
                    <button type="button" class="care-feed-relationship-action ${buttonClass}" data-user-id="${escapeHtml(user.id)}" data-user-name="${escapeHtml(name)}"${followingAttr}>${label}</button>
                </div>
            `;
        }).join('');
    }

    function renderCareFeedRelationshipPanel(data) {
        const $panel = $('#care-feed-relationship-panel');
        if (!$panel.length) return;

        const following = data && Array.isArray(data.following) ? data.following : [];
        const blocked = data && Array.isArray(data.blocked) ? data.blocked : [];
        $panel.html(`
            <div class="care-feed-relationship-panel-head">
                <strong>フォロー・表示設定</strong>
                <span>フォロー ${escapeHtml(following.length)} / ブロック ${escapeHtml(blocked.length)}</span>
            </div>
            <section class="care-feed-relationship-group">
                <div class="care-feed-relationship-group-head"><strong>フォロー中</strong><span>${escapeHtml(following.length)}</span></div>
                <div class="care-feed-relationship-list">${renderCareFeedRelationshipUsers(following, 'unfollow')}</div>
            </section>
            <section class="care-feed-relationship-group">
                <div class="care-feed-relationship-group-head"><strong>ブロック中</strong><span>${escapeHtml(blocked.length)}</span></div>
                <div class="care-feed-relationship-list">${renderCareFeedRelationshipUsers(blocked, 'unblock')}</div>
            </section>
        `);
    }

    function loadCareFeedRelationships() {
        const $panel = $('#care-feed-relationship-panel');
        if (!$panel.length || !SetaeAPI.fetchSocialRelationships) return;

        $panel.html('<div class="care-feed-relationship-loading"><span class="spinner"></span> 読み込み中...</div>');
        SetaeAPI.fetchSocialRelationships(function (data) {
            renderCareFeedRelationshipPanel(data || {});
        });
    }

    function handleCareFeedRelationshipsToggle(e) {
        e.preventDefault();
        e.stopPropagation();

        const $panel = $('#care-feed-relationship-panel');
        if (!$panel.length) return;

        const willOpen = $panel.prop('hidden');
        $panel.prop('hidden', !willOpen);
        $(this).attr('aria-expanded', willOpen ? 'true' : 'false');
        if (willOpen) {
            loadCareFeedRelationships();
        }
    }

    function refreshCareFeedRelationshipsIfVisible() {
        const $panel = $('#care-feed-relationship-panel');
        if ($panel.length && !$panel.prop('hidden')) {
            loadCareFeedRelationships();
        }
    }

    function refreshSocialSurfaces() {
        refreshCareFeedRelationshipsIfVisible();
        refreshCareFeedUnread();
        refreshCommunityUnread();

        if ($('#section-care-feed').is(':visible')) {
            loadCareFeed(false);
        }
        if ($('#section-com').is(':visible')) {
            loadTopics(currentTopicListType, false);
        }
    }

    function handleCareFeedGoRecordClick(e) {
        e.preventDefault();
        e.stopPropagation();

        $('.setae-nav-item[data-target="section-my"]').trigger('click');

        window.setTimeout(function () {
            const $target = $('#setae-today-check:visible').length ? $('#setae-today-check') : $('#setae-spider-list');
            if ($target.length && $target[0] && $target[0].scrollIntoView) {
                $target[0].scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, 240);

        if (typeof SetaeCore.track === 'function') {
            SetaeCore.track('care_feed_empty_record_cta');
        }
    }

    function openCareFeedDetail(id, options) {
        options = options || {};
        currentCareFeedId = id;
        currentCareFeedCommentPage = 1;
        const focusCommentId = parseInt(options.focusCommentId, 10) || 0;
        const apiOptions = focusCommentId ? { focus_comment: focusCommentId } : {};

        $('#section-care-feed').hide();
        $('#section-care-feed-detail').fadeIn(160);
        $('#care-feed-detail-content').html(`<div class="setae-card" style="text-align:center; padding:20px; color:#999;"><span class="spinner"></span> ${setaeI18n.loading}</div>`);
        $('#care-feed-comments-list').empty();
        $('#care-feed-comment-content').val('');
        $('#care-feed-comment-count').text('0 / 1000');
        $('.js-care-comment-template').removeClass('active');
        clearCareFeedReplyTarget();
        $('#care-feed-comments-more').hide();

        SetaeAPI.getCareFeedDetail(id, 1, function (response) {
            const item = response.item || {};
            $('#care-feed-detail-title').text(item.type_label || 'お世話フィード');
            $('#care-feed-detail-content').html(renderCareFeedDetailCard(item));
            renderCareFeedComments(response.comments || {}, true);
            if (focusCommentId && response.focused_comment) {
                ensureCareFeedFocusedComment(response.focused_comment);
                focusCareFeedComment(focusCommentId);
            } else if (focusCommentId) {
                focusCareFeedComment(focusCommentId);
            } else if (options.activityType === 'reaction') {
                focusCareFeedReactions(id);
            } else if (options.focusComposer) {
                focusCareFeedComposer();
            }
        }, apiOptions);
    }

    function renderCareFeedComments(comments, reset) {
        const data = comments || {};
        const items = data.items || [];
        const $list = $('#care-feed-comments-list');

        if (reset) {
            $list.empty();
        }

        if (!items.length && reset) {
            $list.html(`
                <div class="setae-empty-state care-feed-comments-empty">
                    <span class="empty-icon">+</span>
                    <h3>まだコメントはありません</h3>
                    <p>気づいたことや、同じ飼育経験を短く残せます。</p>
                    <div class="setae-empty-actions">
                        <button type="button" class="setae-btn js-care-feed-comment-focus">コメントを書く</button>
                    </div>
                </div>
            `);
        } else {
            if (reset) $list.empty();
            items.forEach(comment => {
                const commentId = parseInt(comment && comment.id, 10) || 0;
                if (commentId && $list.find('.care-feed-comment-row[data-id="' + commentId + '"]').length) {
                    return;
                }
                $list.append(renderCareFeedComment(comment));
            });
        }

        if (data.has_next) {
            currentCareFeedCommentPage = (data.page || currentCareFeedCommentPage) + 1;
            $('#care-feed-comments-more').show();
        } else {
            $('#care-feed-comments-more').hide();
        }
    }

    function loadCareFeedComments(isLoadMore) {
        if (!currentCareFeedId || isCareFeedCommentLoading) return;
        isCareFeedCommentLoading = true;
        $('#btn-load-more-care-comments').prop('disabled', true).text('読み込み中...');

        const request = SetaeAPI.getCareFeedDetail(currentCareFeedId, currentCareFeedCommentPage, function (response) {
            renderCareFeedComments(response.comments || {}, !isLoadMore);
        });
        if (request && request.always) {
            request.always(function () {
                isCareFeedCommentLoading = false;
                $('#btn-load-more-care-comments').prop('disabled', false).text('コメントをもっと見る');
            });
        }
    }

    function ensureCareFeedFocusedComment(comment) {
        const commentId = parseInt(comment && comment.id, 10) || 0;
        if (!commentId) return;

        const $list = $('#care-feed-comments-list');
        if ($list.find('.care-feed-comment-row[data-id="' + commentId + '"]').length) return;

        $list.find('.care-feed-comments-empty').remove();
        $list.append(renderCareFeedComment(comment));
    }

    function focusCareFeedComment(commentId) {
        commentId = parseInt(commentId, 10) || 0;
        if (!commentId) return;

        setTimeout(function () {
            const $row = $('#care-feed-comments-list .care-feed-comment-row[data-id="' + commentId + '"]');
            if (!$row.length) return;

            $('.care-feed-comment-row.is-focus').removeClass('is-focus');
            $row.addClass('is-focus');
            $('html, body').animate({ scrollTop: Math.max(0, $row.offset().top - 92) }, 260);

            setTimeout(function () {
                $row.removeClass('is-focus');
            }, 3600);
        }, 120);
    }

    function openCareFeedFocusedComment(commentId) {
        commentId = parseInt(commentId, 10) || 0;
        if (!commentId || !currentCareFeedId) return;

        const $existing = $('#care-feed-comments-list .care-feed-comment-row[data-id="' + commentId + '"]');
        if ($existing.length) {
            focusCareFeedComment(commentId);
            return;
        }

        SetaeAPI.getCareFeedDetail(currentCareFeedId, 1, function (response) {
            if (response && response.focused_comment) {
                ensureCareFeedFocusedComment(response.focused_comment);
                focusCareFeedComment(commentId);
            } else {
                SetaeCore.showToast('コメントを読み込めませんでした', 'error');
            }
        }, { focus_comment: commentId });
    }

    function handleCareFeedCommentParentOpen(e) {
        e.preventDefault();
        e.stopPropagation();

        const parentId = parseInt($(this).data('parent-id'), 10) || 0;
        if (!parentId || !currentCareFeedId) return;

        openCareFeedFocusedComment(parentId);

        if (typeof SetaeCore.track === 'function') {
            SetaeCore.track('care_feed_reply_parent_open');
        }
    }

    function handleCareFeedPreviewCommentOpen(e) {
        e.preventDefault();
        e.stopPropagation();

        const id = $(this).data('id');
        const commentId = parseInt($(this).data('comment-id'), 10) || 0;
        if (!id || !commentId) return;

        if ($('#section-care-feed-detail').is(':visible') && String(currentCareFeedId) === String(id)) {
            openCareFeedFocusedComment(commentId);
        } else {
            openCareFeedDetail(id, { focusCommentId: commentId });
        }

        if (typeof SetaeCore.track === 'function') {
            SetaeCore.track('care_feed_preview_comment_open');
        }
    }

    function handleCareFeedCommentOpen(e) {
        e.preventDefault();
        e.stopPropagation();

        const id = $(this).data('id');
        if (!id) return;

        if ($('#section-care-feed-detail').is(':visible') && String(currentCareFeedId) === String(id)) {
            focusCareFeedComposer();
        } else {
            openCareFeedDetail(id, { focusComposer: true });
        }

        if (typeof SetaeCore.track === 'function') {
            SetaeCore.track('care_feed_comment_cta_open');
        }
    }

    function handleCareFeedCommentFocus(e) {
        e.preventDefault();
        e.stopPropagation();

        focusCareFeedComposer();

        if (typeof SetaeCore.track === 'function') {
            SetaeCore.track('care_feed_comments_empty_focus');
        }
    }

    function focusCareFeedComposer() {
        setTimeout(function () {
            const $form = $('#care-feed-comment-form');
            const $input = $('#care-feed-comment-content');
            if (!$form.length || !$input.length) return;

            $('.care-feed-comment-form.is-focus').removeClass('is-focus');
            $form.addClass('is-focus');
            $('html, body').animate({ scrollTop: Math.max(0, $form.offset().top - 120) }, 240);
            $input.focus();

            setTimeout(function () {
                $form.removeClass('is-focus');
            }, 2600);
        }, 140);
    }

    function focusCareFeedReactions(id) {
        setTimeout(function () {
            const $target = $('#care-feed-detail-content [data-care-reactions-for="' + id + '"]');
            if (!$target.length) return;

            $('.care-feed-reactions.is-focus').removeClass('is-focus');
            $target.addClass('is-focus');
            $('html, body').animate({ scrollTop: Math.max(0, $target.offset().top - 116) }, 260);

            setTimeout(function () {
                $target.removeClass('is-focus');
            }, 3200);
        }, 120);
    }

    function handleCareFeedCommentSubmit(e) {
        e.preventDefault();
        if (!currentCareFeedId) return;

        const $form = $('#care-feed-comment-form');
        const $input = $('#care-feed-comment-content');
        const $btn = $form.find('button[type="submit"]');
        const content = $input.val().trim();

        if (!content) return;
        if (content.length > 1000) {
            SetaeCore.showToast('コメントは1000文字以内で入力してください', 'error');
            return;
        }
        if ($btn.prop('disabled')) return;

        $btn.prop('disabled', true).text('送信中...');
        const parentId = careFeedReplyTarget && careFeedReplyTarget.id ? careFeedReplyTarget.id : 0;
        const request = SetaeAPI.postCareFeedComment(currentCareFeedId, content, function (response) {
            $input.val('');
            $('#care-feed-comment-count').text('0 / 1000');
            $('#care-feed-comments-list .care-feed-comments-empty').remove();
            if (response.comment) {
                $('#care-feed-comments-list').append(renderCareFeedComment(response.comment));
                focusCareFeedComment(response.comment.id);
            }
            $('.js-care-comment-template').removeClass('active');
            clearCareFeedReplyTarget();
            if (typeof SetaeCore.track === 'function') {
                SetaeCore.track(parentId ? 'care_feed_reply_success' : 'care_feed_comment_success');
            }
            SetaeCore.showToast(parentId ? '返信を投稿しました' : 'コメントを投稿しました', 'success');
        }, parentId ? { parent_id: parentId } : {});
        if (request && request.always) {
            request.always(function () {
                $btn.prop('disabled', false).text('投稿する');
            });
        }
    }

    function handleCareFeedCommentReply(e) {
        e.preventDefault();
        e.stopPropagation();

        const $btn = $(this);
        const id = parseInt($btn.data('id'), 10) || 0;
        const author = $btn.data('author') || 'ユーザー';
        if (!id) return;

        careFeedReplyTarget = { id: id, author: author };
        $('#care-feed-reply-target span').text(author + 'さんに返信中');
        $('#care-feed-reply-target').css('display', 'flex');
        focusCareFeedComposer();

        if (typeof SetaeCore.track === 'function') {
            SetaeCore.track('care_feed_reply_start');
        }
    }

    function clearCareFeedReplyTarget(e) {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        careFeedReplyTarget = null;
        $('#care-feed-reply-target').hide();
        $('#care-feed-reply-target span').text('');
    }

    function handleCareFeedCommentTemplateClick(e) {
        e.preventDefault();
        e.stopPropagation();

        const $btn = $(this);
        const text = ($btn.attr('data-comment') || '').trim();
        const label = $btn.attr('data-label') || $btn.text().trim();
        const $input = $('#care-feed-comment-content');

        if (!text || !$input.length) return;

        const current = ($input.val() || '').trim();
        const next = current ? current + '\n' + text : text;

        $input.val(next.slice(0, 1000)).trigger('input').focus();
        $('.js-care-comment-template').removeClass('active');
        $btn.addClass('active');

        if (typeof SetaeCore.track === 'function') {
            SetaeCore.track('care_feed_quick_comment_select', { label: label });
        }
    }

    function handleTopicCommentTemplateClick(e) {
        e.preventDefault();
        e.stopPropagation();

        const $btn = $(this);
        const text = ($btn.attr('data-comment') || '').trim();
        const label = $btn.attr('data-label') || $btn.text().trim();
        const $input = $('#comment-content');

        if (!text || !$input.length) return;

        const current = ($input.val() || '').trim();
        const next = current ? current + '\n' + text : text;

        $input.val(next.slice(0, 1000)).trigger('input').focus();
        $('.js-topic-comment-template').removeClass('active');
        $btn.addClass('active');

        if (typeof SetaeCore.track === 'function') {
            SetaeCore.track('topic_comment_template_select', { label: label });
        }
    }

    function focusTopicCommentForm(prefillText) {
        const $form = $('#setae-comment-form');
        const $input = $('#comment-content');

        if (!$form.length || !$input.length) return;

        const prefill = (prefillText || '').trim();
        if (prefill) {
            const current = ($input.val() || '').trim();
            if (!current.includes(prefill)) {
                const next = current ? current + '\n' + prefill : prefill;
                $input.val(next.slice(0, 1000)).trigger('input');
            }
        }

        if ($form[0] && $form[0].scrollIntoView) {
            $form[0].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }

        $form.addClass('is-focus');
        window.setTimeout(function () {
            $form.removeClass('is-focus');
        }, 1800);

        window.setTimeout(function () {
            $input.trigger('focus');
        }, 160);
    }

    function getTopicCommentRow(commentId) {
        return $('#topic-comments-list .setae-comment-row').filter(function () {
            return String($(this).data('comment-id')) === String(commentId);
        }).first();
    }

    function focusTopicCommentRow(commentId) {
        const $row = getTopicCommentRow(commentId);

        if (!$row.length) return;

        if ($row[0] && $row[0].scrollIntoView) {
            $row[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        $('.setae-comment-row.is-focus').removeClass('is-focus');
        $row.addClass('is-focus');

        window.setTimeout(function () {
            $row.removeClass('is-focus');
        }, 2200);
    }

    function handleTopicCommentFocus(e) {
        e.preventDefault();
        e.stopPropagation();

        focusTopicCommentForm();

        if (typeof SetaeCore.track === 'function') {
            SetaeCore.track('topic_comment_empty_focus');
        }
    }

    function handleCareFeedReactionClick(e) {
        e.preventDefault();
        e.stopPropagation();

        const id = $(this).data('id');
        const reaction = $(this).data('reaction');
        if (!id || !reaction || !SetaeAPI.reactToCareFeedItem) return;

        const $btn = $(this);
        $btn.prop('disabled', true);

        const request = SetaeAPI.reactToCareFeedItem(id, reaction, function (response) {
            if (response && response.reactions) {
                updateCareFeedReactions(id, response.reactions);
                closeSocialReactionPickers();
            }
        });

        if (request && request.always) {
            request.always(function () {
                $btn.prop('disabled', false);
            });
        }
    }

    function handleCareFeedCopyLink(e) {
        e.preventDefault();
        e.stopPropagation();

        const $btn = $(this);
        const id = $btn.data('id');
        const url = $btn.attr('data-url');
        if (!url) return;

        const originalText = $btn.text();
        $btn.prop('disabled', true).text('コピー中...');

        function finishCopyAttempt() {
            setTimeout(function () {
                $btn.prop('disabled', false);
            }, 300);
        }

        copyTextToClipboard(url).then(function () {
            $btn.text('コピー済み');
            SetaeCore.showToast('共有リンクをコピーしました', 'success');
            if (typeof SetaeCore.track === 'function') {
                SetaeCore.track('care_feed_share_link_copy', { id: id });
            }
            setTimeout(function () {
                $btn.text(originalText);
            }, 1300);
            finishCopyAttempt();
        }).catch(function () {
            showCopyFallback('共有リンク', url);
            $btn.text(originalText);
            finishCopyAttempt();
        });
    }

    function handleCareFeedCopyShareText(e) {
        e.preventDefault();
        e.stopPropagation();

        const $btn = $(this);
        const id = $btn.data('id');
        const text = $btn.attr('data-text');
        if (!text) return;

        const originalText = $btn.text();
        $btn.prop('disabled', true).text('コピー中...');

        function restore() {
            setTimeout(function () {
                $btn.prop('disabled', false);
            }, 300);
        }

        copyTextToClipboard(text).then(function () {
            $btn.text('コピー済み');
            SetaeCore.showToast('紹介文をコピーしました', 'success');
            if (typeof SetaeCore.track === 'function') {
                SetaeCore.track('care_feed_share_text_copy', { id: id });
            }
            setTimeout(function () {
                $btn.text(originalText);
            }, 1300);
            restore();
        }).catch(function () {
            showCopyFallback('紹介文', text);
            $btn.text(originalText);
            restore();
        });
    }

    function handleCareFeedOutboundShare(e) {
        e.stopPropagation();
        closeCareFeedActionMenus();

        const $link = $(this);
        const channel = $link.data('channel') || 'external';
        const id = $link.data('id');
        if (typeof SetaeCore.track === 'function') {
            SetaeCore.track(channel === 'line' ? 'care_feed_share_line' : 'care_feed_share_x', { id: id });
        }
    }

    function handleCareFeedUnshare(e) {
        e.preventDefault();
        e.stopPropagation();
        closeCareFeedActionMenus();

        const $btn = $(this);
        const id = $btn.data('id');
        if (!id || !SetaeAPI.unshareCareFeedItem) return;
        confirmSocialAction({
            title: '共有を解除',
            message: 'この記録を交流の一覧から非公開にします。元の飼育記録は残ります。',
            details: ['マイ個体の履歴と写真は削除されません'],
            confirmLabel: '共有を解除する'
        }).then(function (confirmed) {
            if (!confirmed || !document.contains($btn[0])) return;

            $btn.prop('disabled', true);
            const request = SetaeAPI.unshareCareFeedItem(id, function () {
                SetaeCore.showToast('共有を解除しました', 'success');
                currentCareFeedId = null;

                if ($('#section-care-feed-detail').is(':visible')) {
                    $('#section-care-feed-detail').hide();
                    $('#section-care-feed').fadeIn(160);
                }

                loadCareFeed();
                refreshCareFeedUnread();
            });

            if (request && request.always) {
                request.always(function () {
                    $btn.prop('disabled', false);
                });
            }
        });
    }

    function handleCareFeedReport(e) {
        e.preventDefault();
        e.stopPropagation();
        closeCareFeedActionMenus();

        const $btn = $(this);
        const id = $btn.data('id');
        if (!id || !SetaeAPI.reportCareFeedItem) return;

        requestSocialText({
            title: '投稿を通報',
            message: '運営が確認します。差し支えなければ、問題だと感じた理由を入力してください。',
            inputLabel: '通報理由（任意）',
            placeholder: '例: 個人情報が含まれている',
            maxLength: 500,
            confirmLabel: '通報する'
        }).then(function (reason) {
            if (reason === null || !document.contains($btn[0])) return;

            $btn.prop('disabled', true);
            const request = SetaeAPI.reportCareFeedItem(id, reason, function () {
                SetaeCore.showToast('通報を受け付けました', 'success');
            });

            if (request && request.always) {
                request.always(function () {
                    $btn.prop('disabled', false);
                });
            }
        });
    }

    function handleSocialFollowToggle(e) {
        e.preventDefault();
        e.stopPropagation();

        const $btn = $(this);
        const userId = parseInt($btn.data('user-id'), 10) || 0;
        const isFollowing = String($btn.attr('data-following')) === '1';
        const requestMethod = isFollowing ? 'unfollowUser' : 'followUser';
        if (!userId || !SetaeAPI[requestMethod]) return;

        closeCareFeedActionMenus();
        $btn.prop('disabled', true);
        const request = SetaeAPI[requestMethod](userId, function () {
            const nextFollowing = !isFollowing;
            $(`.js-social-follow-toggle[data-user-id="${userId}"]`)
                .attr('data-following', nextFollowing ? '1' : '0')
                .text(nextFollowing ? 'フォローを解除' : 'フォローする');
            SetaeCore.showToast(nextFollowing ? 'フォローしました' : 'フォローを解除しました', 'success');
            refreshSocialSurfaces();
        });

        if (request && request.always) {
            request.always(function () {
                $btn.prop('disabled', false);
            });
        }
    }

    function handleSocialBlock(e) {
        e.preventDefault();
        e.stopPropagation();

        const $btn = $(this);
        const userId = parseInt($btn.data('user-id'), 10) || 0;
        const userName = $btn.attr('data-user-name') || 'このユーザー';
        if (!userId || !SetaeAPI.blockUser) return;

        confirmSocialAction({
            title: 'ユーザーをブロック',
            message: `${userName}さんの投稿を交流に表示しないようにします。`,
            details: [
                '相手にブロックしたことは通知されません',
                'フォロー・表示設定から解除できます'
            ],
            confirmLabel: 'ブロックする',
            tone: 'danger'
        }).then(function (confirmed) {
            if (!confirmed || !document.contains($btn[0])) return;

            closeCareFeedActionMenus();
            $btn.prop('disabled', true);
            const request = SetaeAPI.blockUser(userId, function () {
                SetaeCore.showToast(`${userName}さんをブロックしました`, 'success');
                if ($('#section-care-feed-detail').is(':visible')) {
                    $('#section-care-feed-detail').hide();
                    $('#section-care-feed').fadeIn(160);
                }
                refreshSocialSurfaces();
            });

            if (request && request.always) {
                request.always(function () {
                    $btn.prop('disabled', false);
                });
            }
        });
    }

    function handleSocialUnblock(e) {
        e.preventDefault();
        e.stopPropagation();

        const $btn = $(this);
        const userId = parseInt($btn.data('user-id'), 10) || 0;
        const userName = $btn.attr('data-user-name') || 'このユーザー';
        if (!userId || !SetaeAPI.unblockUser) return;

        $btn.prop('disabled', true);
        const request = SetaeAPI.unblockUser(userId, function () {
            SetaeCore.showToast(`${userName}さんのブロックを解除しました`, 'success');
            refreshSocialSurfaces();
        });

        if (request && request.always) {
            request.always(function () {
                $btn.prop('disabled', false);
            });
        }
    }

    function handleCareFeedCommentDelete(e) {
        e.preventDefault();
        e.stopPropagation();

        const $btn = $(this);
        const id = $btn.data('id');
        if (!id || !SetaeAPI.deleteCareFeedComment) return;

        const $row = $btn.closest('.care-feed-comment-row');
        confirmSocialAction({
            title: 'コメントを削除',
            message: 'このコメントを削除します。削除後は元に戻せません。',
            confirmLabel: '削除する',
            tone: 'danger'
        }).then(function (confirmed) {
            if (!confirmed || !document.contains($btn[0])) return;

            $btn.prop('disabled', true);
            const request = SetaeAPI.deleteCareFeedComment(id, function () {
                $row.fadeOut(140, function () {
                    $(this).remove();
                });
                SetaeCore.showToast('コメントを削除しました', 'success');
                refreshCareFeedUnread();
            });

            if (request && request.always) {
                request.always(function () {
                    $btn.prop('disabled', false);
                });
            }
        });
    }

    function handleCareFeedCommentReport(e) {
        e.preventDefault();
        e.stopPropagation();

        const $btn = $(this);
        const id = $btn.data('id');
        if (!id || !SetaeAPI.reportCareFeedComment) return;

        requestSocialText({
            title: 'コメントを通報',
            message: '運営が確認します。差し支えなければ、問題だと感じた理由を入力してください。',
            inputLabel: '通報理由（任意）',
            placeholder: '例: 攻撃的な内容が含まれている',
            maxLength: 500,
            confirmLabel: '通報する'
        }).then(function (reason) {
            if (reason === null || !document.contains($btn[0])) return;

            $btn.prop('disabled', true);
            const request = SetaeAPI.reportCareFeedComment(id, reason, function () {
                SetaeCore.showToast('通報を受け付けました', 'success');
            });

            if (request && request.always) {
                request.always(function () {
                    $btn.prop('disabled', false);
                });
            }
        });
    }

    function handleTopicTemplateClick(e) {
        e.preventDefault();

        const $button = $(this);
        const key = $button.data('template');
        const templates = {
            feeding: {
                type: 'question',
                title: '給餌・拒食について相談です',
                content: '【個体】\n【種類】\n【サイズ・性別】\n【最後に食べた日】\n【餌の種類】\n【温度・湿度】\n【気になっていること】\n'
            },
            molt: {
                type: 'question',
                title: '脱皮・成長について相談です',
                content: '【個体】\n【種類】\n【前回の脱皮日】\n【現在の様子】\n【温度・湿度】\n【写真や補足】\n'
            },
            environment: {
                type: 'question',
                title: '飼育環境について相談です',
                content: '【種類】\n【ケースサイズ】\n【床材・湿度】\n【温度】\n【隠れ家・水入れ】\n【困っていること】\n'
            },
            identify: {
                type: 'question',
                title: '同定・写真について相談です',
                content: '【知りたいこと】\n【入手時の名前】\n【サイズ】\n【撮影した部位】\n【補足】\n'
            }
        };

        const template = templates[key];
        if (!template) return;

        const hasInput = $('#topic-title').val().trim() || $('#topic-content').val().trim();
        if (hasInput) {
            confirmSocialAction({
                title: 'テンプレートを適用',
                message: '現在入力しているタイトルと本文をテンプレートで置き換えます。',
                confirmLabel: '置き換える'
            }).then(function (confirmed) {
                if (confirmed) applyTopicTemplate(template, $button);
            });
            return;
        }

        applyTopicTemplate(template, $button);
    }

    function applyTopicTemplate(template, $button) {
        $('#topic-type').val(template.type);
        $('#topic-title').val(template.title).focus();
        $('#topic-content').val(template.content);
        $('.topic-template-btn').removeClass('active');
        $button.addClass('active');
        saveTopicDraftDebounced();
    }

    function getSpeciesDisplayName(species) {
        if (!species) return '';
        return species.display_name || species.ja_name || species.common_name || species.title || species.scientific_name || '';
    }

    function getTopicSpeciesFallbackUrl() {
        const base = (typeof SetaeSettings !== 'undefined' && SetaeSettings.plugin_url)
            ? SetaeSettings.plugin_url
            : '/wp-content/plugins/setae-core/';
        return base + 'assets/images/specimen/spider-silhouette.svg';
    }

    function renderTopicSpeciesThumb(thumb, altText) {
        if (thumb) {
            return `<img src="${escapeHtml(thumb)}" alt="${escapeHtml(altText || '')}">`;
        }

        return `
            <span class="topic-related-species-initial">
                <img src="${escapeHtml(getTopicSpeciesFallbackUrl())}" style="object-fit: fill;width: 50%; height: 50%; filter: grayscale(100%) opacity(0.35);" alt="画像なし">
            </span>
        `;
    }

    function getThumbFromSpeciesDetail(data) {
        if (!data) return '';
        if (data.thumb) return data.thumb;
        if (Array.isArray(data.featured_images) && data.featured_images[0]) return data.featured_images[0];
        if (Array.isArray(data.featured_gallery) && data.featured_gallery[0] && data.featured_gallery[0].url) {
            return data.featured_gallery[0].url;
        }
        return '';
    }

    function getTopicDraftKey() {
        const userId = (typeof SetaeCore !== 'undefined' && SetaeCore.state)
            ? (SetaeCore.state.currentUserId || 0)
            : ((typeof SetaeSettings !== 'undefined' && SetaeSettings.current_user_id) ? SetaeSettings.current_user_id : 0);
        return 'setae_topic_draft_v1_' + userId;
    }

    function readTopicDraft() {
        try {
            const raw = localStorage.getItem(getTopicDraftKey());
            const draft = raw ? JSON.parse(raw) : null;

            if (!draft || typeof draft !== 'object') return null;
            if (!draft.updated_at || (Date.now() - draft.updated_at) > TOPIC_DRAFT_MAX_AGE_MS) {
                clearTopicDraft();
                return null;
            }

            return draft;
        } catch (e) {
            return null;
        }
    }

    function writeTopicDraft(draft) {
        try {
            localStorage.setItem(getTopicDraftKey(), JSON.stringify(draft));
        } catch (e) {
            // localStorageが使えない環境では保存しない。
        }
    }

    function clearTopicDraft() {
        try {
            localStorage.removeItem(getTopicDraftKey());
        } catch (e) {
            // localStorageが使えない環境では何もしない。
        }
    }

    function collectTopicDraft() {
        return {
            type: $('#topic-type').val() || 'question',
            title: $('#topic-title').val() || '',
            content: $('#topic-content').val() || '',
            related_species_id: $('#topic-related-species-id').val() || '',
            related_species_name: $('#topic-related-species-selected strong').first().text() || '',
            related_species_scientific_name: $('#topic-related-species-selected em').first().text() || '',
            related_species_thumb: $('#topic-related-species-selected .topic-related-species-pill > img').first().attr('src') || '',
            updated_at: Date.now()
        };
    }

    function hasMeaningfulTopicDraft(draft) {
        if (!draft) return false;
        if ((draft.title || '').trim()) return true;
        if ((draft.content || '').trim()) return true;
        if (draft.related_species_id) return true;
        return false;
    }

    function saveTopicDraft() {
        if (isRestoringTopicDraft) return;

        const draft = collectTopicDraft();
        if (!hasMeaningfulTopicDraft(draft)) {
            clearTopicDraft();
            hideTopicDraftBanner();
            return;
        }

        writeTopicDraft(draft);
    }

    function saveTopicDraftDebounced() {
        window.clearTimeout(topicDraftSaveTimer);
        topicDraftSaveTimer = window.setTimeout(saveTopicDraft, 250);
    }

    function showTopicDraftBanner() {
        $('#topic-draft-banner').css('display', 'flex');
    }

    function hideTopicDraftBanner() {
        $('#topic-draft-banner').hide();
    }

    function restoreTopicDraftIfAvailable() {
        const draft = readTopicDraft();
        if (!hasMeaningfulTopicDraft(draft)) return false;

        isRestoringTopicDraft = true;
        try {
            $('#topic-type').val(draft.type || 'question');
            $('#topic-title').val(draft.title || '');
            $('#topic-content').val(draft.content || '');

            if (draft.related_species_id) {
                setTopicRelatedSpecies({
                    id: draft.related_species_id,
                    display_name: draft.related_species_name || '',
                    title: draft.related_species_scientific_name || '',
                    thumb: draft.related_species_thumb || ''
                });
            } else {
                clearTopicRelatedSpecies();
            }
        } finally {
            isRestoringTopicDraft = false;
        }

        showTopicDraftBanner();
        SetaeCore.showToast('相談の下書きを復元しました', 'info');

        if (typeof SetaeCore.track === 'function') {
            SetaeCore.track('topic_draft_restored', {
                type: draft.type || 'question',
                has_species: !!draft.related_species_id
            });
        }

        return true;
    }

    function discardTopicDraft(e) {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }

        clearTopicDraft();
        resetTopicModal();
        SetaeCore.showToast('相談の下書きを破棄しました', 'info');

        if (typeof SetaeCore.track === 'function') {
            SetaeCore.track('topic_draft_discard');
        }
    }

    function resetTopicModal() {
        isRestoringTopicDraft = true;
        try {
            $('#topic-title').val('');
            $('#topic-content').val('');
            $('#topic-type').val('question');
            $('.topic-template-btn').removeClass('active');
            clearTopicRelatedSpecies();
            hideTopicDraftBanner();
        } finally {
            isRestoringTopicDraft = false;
        }
    }

    function openTopicModal(options) {
        options = options || {};
        resetTopicModal();
        if (options.restoreDraft !== false) {
            restoreTopicDraftIfAvailable();
        }
        $('#modal-new-topic').fadeIn(200);
    }

    function openTopicModalForSpecies(species) {
        resetTopicModal();

        const displayName = getSpeciesDisplayName(species);
        const scientificName = species.title || species.scientific_name || '';
        const speciesLine = scientificName && scientificName !== displayName
            ? `${displayName}（${scientificName}）`
            : displayName;

        setTopicRelatedSpecies(species);
        $('#topic-type').val('question');
        $('#topic-title').val(displayName ? `${displayName}について相談です` : 'この種について相談です');
        $('#topic-content').val(`【種類】${speciesLine}\n【個体】\n【飼育環境】\n【相談内容】\n`);
        $('#modal-new-topic').fadeIn(200);
    }

    function getCachedSpiderById(id) {
        const spiders = (SetaeCore.state && Array.isArray(SetaeCore.state.cachedSpiders))
            ? SetaeCore.state.cachedSpiders
            : [];
        const targetId = String(id || '');

        return spiders.find(function (spider) {
            return String(spider.id || '') === targetId;
        }) || null;
    }

    function getSpiderStatusLabel(status) {
        const labels = {
            normal: '通常',
            fasting: '拒食中',
            pre_molt: '脱皮前',
            post_molt: '脱皮後'
        };

        return labels[status] || '未設定';
    }

    function getSpiderClassificationLabel(classification) {
        const labels = {
            tarantula: 'タランチュラ',
            scorpion: 'サソリ',
            reptile: '爬虫類',
            plant: '植物',
            other: 'その他'
        };

        return labels[classification] || 'その他';
    }

    function getSpiderTopicReason(recordType, classification) {
        const isPlant = classification === 'plant';
        const reasons = {
            feed: {
                title: isPlant ? '水やりについて相談です' : '給餌について相談です',
                label: isPlant ? '水やり・状態' : '給餌・拒食'
            },
            water: {
                title: '水やりについて相談です',
                label: '水やり・状態'
            },
            molt: {
                title: isPlant ? '植え替え・成長について相談です' : '脱皮・成長について相談です',
                label: isPlant ? '植え替え・成長' : '脱皮・成長'
            },
            shed: {
                title: '脱皮・成長について相談です',
                label: '脱皮・成長'
            },
            note: {
                title: '様子について相談です',
                label: '気になる様子'
            }
        };

        return reasons[recordType] || reasons.note;
    }

    function formatTopicDateHint(dateValue) {
        if (!dateValue) return '未記録';
        return SetaeCore.formatRelativeDate(dateValue);
    }

    function openTopicModalForSpider(spiderId, recordType, source) {
        const spider = getCachedSpiderById(spiderId);
        if (!spider) return false;

        resetTopicModal();

        const classification = spider.classification || 'tarantula';
        const reason = getSpiderTopicReason(recordType, classification);
        const title = spider.title || spider.species_name || '個体';
        const speciesName = spider.species_name || '種類不明';
        const feedLabel = classification === 'plant' ? '最後の水やり' : '最後の給餌';
        const moltLabel = classification === 'plant' ? '最後の植え替え' : '最後の脱皮';

        if (spider.species_id) {
            setTopicRelatedSpecies({
                id: spider.species_id,
                title: speciesName,
                display_name: speciesName,
                thumb: spider.species_thumb || ''
            });
        }

        $('#topic-type').val('question');
        $('#topic-title').val(`${title}の${reason.title}`);
        $('#topic-content').val(
            `【個体】${title}\n` +
            `【種類】${speciesName}\n` +
            `【分類】${getSpiderClassificationLabel(classification)}\n` +
            `【相談したいこと】${reason.label}\n` +
            `【現在の状態】${getSpiderStatusLabel(spider.status)}\n` +
            `【${feedLabel}】${formatTopicDateHint(spider.last_feed)}\n` +
            `【${moltLabel}】${formatTopicDateHint(spider.last_molt)}\n` +
            `【補足】\n`
        );
        $('#modal-new-topic').fadeIn(200);
        $('#topic-content').focus();

        if (typeof SetaeCore.track === 'function') {
            const eventName = source === 'detail' ? 'detail_topic_click' : 'today_check_topic_click';
            SetaeCore.track(eventName, {
                type: recordType || 'note',
                classification: classification,
                has_species: !!spider.species_id
            });
        }

        return true;
    }

    function handleOpenSpeciesTopicModal(e) {
        e.preventDefault();
        e.stopPropagation();

        openTopicModalForSpecies({
            id: $(this).attr('data-species-id'),
            title: $(this).attr('data-scientific-name') || '',
            ja_name: $(this).attr('data-common-name') || '',
            display_name: $(this).attr('data-display-name') || ''
        });
    }

    function handleCommunityEmptyTopicClick(e) {
        e.preventDefault();
        e.stopPropagation();

        const searchText = (currentTopicSearch || $('#com-search-input').val() || '').trim().replace(/\s+/g, ' ');
        const selectedType = currentTopicListType && currentTopicListType !== 'all' ? currentTopicListType : 'question';
        const safeTitle = searchText.substring(0, 60);

        openTopicModal({ restoreDraft: false });
        $('#topic-type').val(selectedType);

        if (safeTitle) {
            $('#topic-title').val(`${safeTitle}について相談です`);
            $('#topic-content').val(`【知りたいこと】${safeTitle}\n【種類・個体】\n【環境・状況】\n【試したこと】\n`);
        }

        $('#topic-title').focus();

        if (typeof SetaeCore.track === 'function') {
            SetaeCore.track('community_empty_topic_cta', {
                type: currentTopicListType || 'all',
                has_search: !!safeTitle,
                species_id: currentTopicSpeciesId || ''
            });
        }
    }

    function setTopicRelatedSpecies(species) {
        const id = species && species.id ? parseInt(species.id, 10) : 0;
        if (!id) {
            clearTopicRelatedSpecies();
            return;
        }

        const displayName = getSpeciesDisplayName(species);
        const scientificName = species.title || species.scientific_name || '';
        const subName = scientificName && scientificName !== displayName ? scientificName : '';
        const thumb = species.thumb || species.image || '';

        $('#topic-related-species-id').val(id);
        $('#topic-related-species-selected').html(`
            <div class="topic-related-species-pill">
                ${renderTopicSpeciesThumb(thumb, displayName || scientificName || '関連種')}
                <span>
                    <strong>${escapeHtml(displayName || scientificName || '関連種')}</strong>
                    ${subName ? `<em>${escapeHtml(subName)}</em>` : ''}
                </span>
                <button type="button" id="topic-related-species-clear">解除</button>
            </div>
        `).show();

        if (!thumb && SetaeAPI.getSpeciesDetail) {
            SetaeAPI.getSpeciesDetail(id, function (data) {
                if (String($('#topic-related-species-id').val()) !== String(id)) return;
                const detailThumb = getThumbFromSpeciesDetail(data);
                if (!detailThumb) return;
                $('#topic-related-species-selected .topic-related-species-pill > .topic-related-species-initial')
                    .replaceWith(renderTopicSpeciesThumb(detailThumb, displayName || scientificName || '関連種'));
                saveTopicDraftDebounced();
            });
        }

        $('.topic-related-species-search-wrap').hide();
        $('#topic-related-species-search').val('');
        $('#topic-related-species-suggestions').hide().empty();
    }

    function clearTopicRelatedSpecies() {
        $('#topic-related-species-id').val('');
        $('#topic-related-species-selected').hide().empty();
        $('.topic-related-species-search-wrap').show();
        $('#topic-related-species-search').val('');
        $('#topic-related-species-suggestions').hide().empty();
    }

    function renderTopicRelatedSpeciesSuggestions(items) {
        const $suggestions = $('#topic-related-species-suggestions');
        const speciesItems = Array.isArray(items) ? items : [];

        if (!$suggestions.length) return;
        if (!speciesItems.length) {
            $suggestions.html('<div class="topic-species-suggestion-empty">該当する種が見つかりません</div>').show();
            return;
        }

        $suggestions.html(speciesItems.slice(0, 8).map(species => {
            const displayName = getSpeciesDisplayName(species);
            const subName = species.title && species.title !== displayName ? species.title : '';
            const thumbHtml = renderTopicSpeciesThumb(species.thumb || '', displayName || species.title || '種類');
            return `
                <button type="button" class="topic-species-suggestion"
                    data-id="${escapeHtml(species.id)}"
                    data-title="${escapeHtml(species.title || '')}"
                    data-ja-name="${escapeHtml(species.ja_name || '')}"
                    data-thumb="${escapeHtml(species.thumb || '')}">
                    ${thumbHtml}
                    <span>
                        <strong>${escapeHtml(displayName || species.title || '種類')}</strong>
                        ${subName ? `<em>${escapeHtml(subName)}</em>` : ''}
                    </span>
                </button>
            `;
        }).join('')).show();
    }

    function handleTopicRelatedSpeciesSearch() {
        const term = $(this).val().trim();
        const $suggestions = $('#topic-related-species-suggestions');

        if (topicSpeciesSearchTimer) {
            window.clearTimeout(topicSpeciesSearchTimer);
        }

        if (term.length < 2) {
            $suggestions.hide().empty();
            return;
        }

        topicSpeciesSearchTimer = window.setTimeout(function () {
            SetaeAPI.fetchSpecies(term, renderTopicRelatedSpeciesSuggestions);
        }, 180);
    }

    function renderTopicRelatedSpeciesChip(species) {
        if (!species || !species.id) return '';

        const displayName = getSpeciesDisplayName(species);
        const scientificName = species.title && species.title !== displayName ? species.title : '';
        return `
            <button type="button" class="topic-related-species-chip" data-id="${escapeHtml(species.id)}">
                ${renderTopicSpeciesThumb(species.thumb || '', displayName || scientificName || '関連種')}
                <span>
                    <strong>${escapeHtml(displayName || '関連種')}</strong>
                    ${scientificName ? `<em>${escapeHtml(scientificName)}</em>` : ''}
                </span>
            </button>
        `;
    }

    function renderReactionButtons(reactions, targetType, targetId) {
        if (!reactions || !targetId) return '';

        const className = targetType === 'comment' ? 'comment-reaction-btn' : 'topic-reaction-btn';
        const idAttr = targetType === 'comment' ? 'data-comment-id' : 'data-topic-id';
        const buttons = Object.keys(reactions).map(key => {
            const item = reactions[key] || {};
            const count = parseInt(item.count, 10) || 0;
            const activeClass = item.active ? 'active' : '';
            const label = item.label || key;
            return `
                <button type="button" class="community-reaction-btn ${className} ${activeClass}"
                    ${idAttr}="${escapeHtml(targetId)}" data-reaction="${escapeHtml(key)}"
                    aria-label="${escapeHtml(label)} ${escapeHtml(count)}件"
                    aria-pressed="${item.active ? 'true' : 'false'}">
                    <span>${escapeHtml(label)}</span>
                    <strong>${count}</strong>
                </button>
            `;
        }).join('');

        return `<div class="community-reaction-row" data-target-type="${escapeHtml(targetType)}" data-target-id="${escapeHtml(targetId)}">${buttons}</div>`;
    }

    function renderTopicListReactionControl(topic) {
        if (!topic || !topic.id || !topic.reactions) return '';

        const reactions = topic.reactions;
        const keys = Object.keys(reactions);
        if (!keys.length) return '';

        const summary = getSocialReactionSummary(reactions);
        const pickerId = 'topic-list-reactions-' + escapeHtml(topic.id);
        return `
            <div class="social-reaction-control${summary.active ? ' has-active-reaction' : ''}">
                <button type="button" class="social-post-action social-reaction-toggle js-social-reaction-picker-toggle"
                    aria-label="リアクション" title="リアクション" aria-expanded="false"
                    aria-haspopup="true" aria-controls="${pickerId}">
                    <span class="dashicons ${summary.active ? 'dashicons-star-filled' : 'dashicons-star-empty'} social-reaction-icon" aria-hidden="true"></span>
                    <b class="social-reaction-toggle-count">${summary.count || ''}</b>
                </button>
                <div id="${pickerId}" class="community-reaction-row social-reaction-picker"
                    data-target-type="topic" data-target-id="${escapeHtml(topic.id)}"
                    role="group" aria-label="リアクションを選択" hidden>
                    ${keys.map(function (key) {
                const item = reactions[key] || {};
                const count = parseInt(item.count, 10) || 0;
                return `
                            <button type="button" class="community-reaction-btn topic-reaction-btn ${item.active ? 'active' : ''}"
                                data-topic-id="${escapeHtml(topic.id)}" data-reaction="${escapeHtml(key)}"
                                aria-pressed="${item.active ? 'true' : 'false'}">
                                <span>${escapeHtml(item.label || key)}</span>
                                <strong>${count}</strong>
                            </button>
                        `;
            }).join('')}
                </div>
            </div>
        `;
    }

    function renderSocialTopicMedia(topic, context) {
        if (!topic || !topic.image) return '';

        const mediaAlt = String(topic.image_alt || '').trim() || ((topic.title || '投稿') + 'の写真');
        const contextClass = context === 'detail' ? ' is-detail' : '';
        return `
            <button type="button" class="social-topic-media js-care-feed-media-open${contextClass}"
                data-media-url="${escapeHtml(topic.image)}"
                data-media-alt="${escapeHtml(mediaAlt)}"
                aria-label="${escapeHtml(mediaAlt)}を拡大" title="写真を拡大">
                <img src="${escapeHtml(topic.image)}" alt="${escapeHtml(mediaAlt)}" loading="lazy">
                <span class="care-feed-media-zoom-mark" aria-hidden="true"></span>
            </button>
        `;
    }

    function renderTopicListContent(topic, titleText, excerptText, isQuickPost) {
        const mediaHtml = renderSocialTopicMedia(topic, 'list');
        const bodyHtml = isQuickPost
            ? (excerptText ? `<p class="social-post-text">${escapeHtml(excerptText)}</p>` : '')
            : `
                <h3 class="setae-topic-title">
                    <button type="button" class="setae-topic-title-button js-open-topic-row"
                        data-id="${escapeHtml(topic.id)}">${escapeHtml(titleText)}</button>
                </h3>
                ${excerptText ? `<p class="setae-topic-excerpt social-post-text">${escapeHtml(excerptText)}</p>` : ''}
            `;

        if (!topic.has_cw) {
            return bodyHtml + mediaHtml;
        }

        const contentId = 'topic-cw-content-' + escapeHtml(topic.id);
        return `
            <div class="social-content-warning">
                <div>
                    <span>CW</span>
                    <strong>${escapeHtml(titleText || '内容についての注意')}</strong>
                </div>
                <button type="button" class="js-social-cw-toggle"
                    aria-expanded="false" aria-controls="${contentId}"
                    data-show-label="表示" data-hide-label="隠す">表示</button>
            </div>
            <div id="${contentId}" class="social-cw-content" hidden>
                ${excerptText ? `<p class="social-post-text">${escapeHtml(excerptText)}</p>` : ''}
                ${mediaHtml}
            </div>
        `;
    }

    function handleSocialTimelinePostKeydown(e) {
        if ((e.key !== 'Enter' && e.key !== ' ') || e.target !== this) return;

        e.preventDefault();
        const $post = $(this);
        const id = $post.data('id');
        if (!id) return;

        if ($post.hasClass('setae-care-feed-item')) {
            openCareFeedDetail(id);
            return;
        }

        if ($post.hasClass('setae-topic-row')) {
            openTopicDetail(id);
        }
    }

    function updateReactionRow($row, reactions) {
        if (!$row.length || !reactions) return;

        $row.find('.community-reaction-btn').each(function () {
            const key = $(this).data('reaction');
            const item = reactions[key] || {};
            $(this).toggleClass('active', !!item.active);
            $(this).attr('aria-pressed', item.active ? 'true' : 'false');
            $(this).find('strong').text(parseInt(item.count, 10) || 0);
        });

        const summary = getSocialReactionSummary(reactions);
        const $control = $row.closest('.social-reaction-control');
        $control.toggleClass('has-active-reaction', summary.active);
        $control.find('.social-reaction-icon')
            .toggleClass('dashicons-star-filled', summary.active)
            .toggleClass('dashicons-star-empty', !summary.active);
        $control.find('.social-reaction-toggle-count').text(summary.count || '');
    }

    function renderTopicStatusPanel(topic) {
        if (!topic || !topic.id) return '';

        const isResolved = !!topic.is_resolved;
        const label = isResolved ? '解決済み' : '受付中';
        const description = isResolved
            ? 'この相談には解決の手がかりがあります。'
            : '回答や経験談を募集しています。';
        const actionHtml = topic.can_manage ? `
            <button type="button" id="btn-topic-toggle-resolved"
                data-topic-id="${escapeHtml(topic.id)}"
                data-next-status="${isResolved ? 'open' : 'resolved'}">
                ${isResolved ? '未解決に戻す' : '解決済みにする'}
            </button>
        ` : '';

        return `
            <div class="topic-status-panel ${isResolved ? 'is-resolved' : 'is-open'}">
                <div>
                    <strong>${label}</strong>
                    <span>${description}</span>
                </div>
                ${actionHtml}
            </div>
        `;
    }

    function handleTopicStatusToggle(e) {
        e.preventDefault();
        e.stopPropagation();

        const $btn = $(this);
        const topicId = $btn.data('topic-id') || currentTopicId;
        const nextStatus = $btn.data('next-status');
        if (!topicId || !nextStatus || !SetaeAPI.updateTopicStatus) return;

        const confirmation = nextStatus === 'open'
            ? confirmSocialAction({
                title: '相談を未解決に戻す',
                message: '未解決へ戻すと、設定中のベスト回答も解除されます。',
                confirmLabel: '未解決に戻す'
            })
            : Promise.resolve(true);

        confirmation.then(function (confirmed) {
            if (!confirmed || !document.contains($btn[0])) return;

            $btn.prop('disabled', true);
            const request = SetaeAPI.updateTopicStatus(topicId, nextStatus, function () {
                SetaeCore.showToast(nextStatus === 'resolved' ? '解決済みにしました' : '未解決に戻しました', 'success');
                openTopicDetail(topicId);
                loadTopics(currentTopicListType, false);
            });

            if (request && request.always) {
                request.always(function () {
                    $btn.prop('disabled', false);
                });
            }
        });
    }

    function handleTopicReactionClick(e) {
        e.preventDefault();
        e.stopPropagation();

        const $btn = $(this);
        const topicId = $btn.data('topic-id');
        const reaction = $btn.data('reaction');
        if (!topicId || !reaction || !SetaeAPI.reactToTopic) return;

        $btn.prop('disabled', true);
        const request = SetaeAPI.reactToTopic(topicId, reaction, function (response) {
            updateReactionRow($btn.closest('.community-reaction-row'), response.reactions);
            closeSocialReactionPickers();
        });

        if (request && request.always) {
            request.always(function () {
                $btn.prop('disabled', false);
            });
        }
    }

    function handleCommentReactionClick(e) {
        e.preventDefault();
        e.stopPropagation();

        const $btn = $(this);
        const commentId = $btn.data('comment-id');
        const reaction = $btn.data('reaction');
        if (!commentId || !reaction || !SetaeAPI.reactToTopicComment) return;

        $btn.prop('disabled', true);
        const request = SetaeAPI.reactToTopicComment(commentId, reaction, function (response) {
            updateReactionRow($btn.closest('.community-reaction-row'), response.reactions);
        });

        if (request && request.always) {
            request.always(function () {
                $btn.prop('disabled', false);
            });
        }
    }

    function renderCommunityUnreadBadge(count) {
        latestCommunityUnreadCount = parseInt(count, 10) || 0;
        syncSocialUnreadBadges();
    }

    function renderCommunityUnreadPanel(data) {
        const $panel = $('#community-unread-panel');
        if (!$panel.length) return;

        const items = data && Array.isArray(data.items) ? data.items : [];
        if (!items.length) {
            $panel.hide().empty();
            return;
        }

        const total = parseInt(data.raw_count || data.count, 10) || 0;
        const visibleItems = items.slice(0, 3).map(item => `
            <button type="button" class="community-unread-item js-open-unread-topic" data-id="${escapeHtml(item.id)}">
                <span class="community-unread-reason">${escapeHtml(item.reason || '新着返信')}</span>
                <strong>${escapeHtml(item.title || '無題')}</strong>
                <span>${escapeHtml(item.latest_author || 'ユーザー不明')}：${escapeHtml(item.latest_excerpt || '')}</span>
            </button>
        `).join('');

        $panel.html(`
            <div class="community-unread-head">
                <div>
                    <strong>反応あり</strong>
                    <span>${total}件の新着返信</span>
                </div>
                <button type="button" id="btn-community-mark-all-read">すべて既読</button>
            </div>
            <div class="community-unread-list">
                ${visibleItems}
            </div>
        `).css('display', 'grid');
    }

    function refreshCommunityUnread() {
        if (!SetaeAPI.fetchCommunityUnread) return;

        SetaeAPI.fetchCommunityUnread(function (response) {
            renderCommunityUnreadBadge(response && response.count ? response.count : 0);
            renderCommunityUnreadPanel(response || {});
        });
    }

    function markCommunityTopicRead(id) {
        if (!id || !SetaeAPI.markCommunityTopicRead) return;

        const request = SetaeAPI.markCommunityTopicRead(id, function () {
            refreshCommunityUnread();
        });

        if (request && request.fail) {
            request.fail(function () {
                refreshCommunityUnread();
            });
        }
    }

    function handleCommunityMarkAllRead(e) {
        e.preventDefault();
        e.stopPropagation();

        if (!SetaeAPI.markAllCommunityRead) return;

        const $btn = $(this);
        $btn.prop('disabled', true).text('処理中...');

        const request = SetaeAPI.markAllCommunityRead(function () {
            renderCommunityUnreadBadge(0);
            renderCommunityUnreadPanel({ items: [], count: 0, raw_count: 0 });
            loadTopics(currentTopicListType, false);
        });

        if (request && request.always) {
            request.always(function () {
                $btn.prop('disabled', false).text('すべて既読');
            });
        }
    }

    function renderCommunitySpeciesPulse(data) {
        const $panel = $('#setae-species-pulse');
        if (!$panel.length) return;

        const items = data && Array.isArray(data.items) ? data.items : [];
        if (!items.length) {
            $panel.hide().empty();
            return;
        }

        const rows = items.map(item => {
            const species = item.species || {};
            const topic = item.latest_topic || {};
            const thumbHtml = renderTopicSpeciesThumb(species.thumb || '', species.display_name || species.title || '関連種');
            const latestDate = item.latest_at ? SetaeCore.formatRelativeDate(item.latest_at) : '';
            const openCount = parseInt(item.open_count, 10) || 0;
            const topicCount = parseInt(item.topic_count, 10) || 0;

            return `
                <div class="species-pulse-item">
                    <button type="button" class="species-pulse-main js-open-species-pulse"
                        data-species-id="${escapeHtml(species.id)}"
                        data-scientific-name="${escapeHtml(species.title || '')}"
                        data-common-name="${escapeHtml(species.ja_name || '')}"
                        data-display-name="${escapeHtml(species.display_name || species.ja_name || species.title || '')}">
                        <div class="species-pulse-thumb">${thumbHtml}</div>
                        <div class="species-pulse-name">
                            <strong>${escapeHtml(species.display_name || species.title || '関連種')}</strong>
                            ${species.title && species.title !== species.display_name ? `<span>${escapeHtml(species.title)}</span>` : ''}
                        </div>
                        <div class="species-pulse-stats">
                            ${openCount ? `<span class="pulse-stat is-open">未解決 ${openCount}</span>` : ''}
                            <span class="pulse-stat">相談 ${topicCount}</span>
                        </div>
                    </button>
                    ${topic.id ? `
                        <button type="button" class="species-pulse-topic js-open-pulse-topic" data-id="${escapeHtml(topic.id)}">
                            <span>${escapeHtml(topic.title || '最新の相談')}</span>
                            ${latestDate ? `<em>${escapeHtml(latestDate)}</em>` : ''}
                        </button>
                    ` : ''}
                </div>
            `;
        }).join('');

        $panel.html(`
            <div class="species-pulse-card">
                <div class="species-pulse-head">
                    <div>
                        <span class="species-pulse-eyebrow">相談の動き</span>
                        <h3>いま話題の種</h3>
                    </div>
                    <button type="button" class="species-pulse-community-btn js-open-topic-modal">相談する</button>
                </div>
                <div class="species-pulse-list">
                    ${rows}
                </div>
            </div>
        `).show();
    }

    function refreshCommunitySpeciesPulse() {
        if (!SetaeAPI.fetchCommunitySpeciesPulse) return;

        SetaeAPI.fetchCommunitySpeciesPulse(function (response) {
            renderCommunitySpeciesPulse(response || {});
        });
    }

    function handleOpenSpeciesPulse(e) {
        e.preventDefault();
        e.stopPropagation();
        openCommunityForSpecies(getSpeciesPayloadFromElement($(this)));
    }

    function handleOpenPulseTopic(e) {
        e.preventDefault();
        e.stopPropagation();

        const id = $(this).data('id');
        if (!id) return;

        syncPrimaryNav('section-care-feed');
        $('.setae-section').hide();
        openTopicDetail(id);
    }

    function getSpeciesPayloadFromElement($element) {
        return {
            id: $element.attr('data-species-id') || '',
            title: $element.attr('data-scientific-name') || '',
            ja_name: $element.attr('data-common-name') || '',
            display_name: $element.attr('data-display-name') || ''
        };
    }

    function renderCommunitySpeciesContext() {
        const $panel = $('#community-species-context-panel');
        if (!$panel.length) return;

        if (!currentTopicSpeciesId) {
            $panel.hide().empty();
            return;
        }

        const subName = currentTopicSpeciesScientificName && currentTopicSpeciesScientificName !== currentTopicSpeciesName
            ? `<span>${escapeHtml(currentTopicSpeciesScientificName)}</span>`
            : '';

        $panel.html(`
            <div class="community-species-context-main">
                <span class="community-species-context-label">種で絞り込み中</span>
                <strong>${escapeHtml(currentTopicSpeciesName || '関連種')}</strong>
                ${subName}
            </div>
            <button type="button" id="btn-community-clear-species">すべての相談へ</button>
        `).css('display', 'flex');
    }

    function openCommunityForSpecies(species) {
        const id = species && species.id ? parseInt(species.id, 10) : 0;
        if (!id) return;

        currentTopicSpeciesId = id;
        currentTopicSpeciesName = getSpeciesDisplayName(species) || '関連種';
        currentTopicSpeciesScientificName = species.title || species.scientific_name || '';
        currentTopicListType = 'all';
        currentTopicSearch = '';
        currentTopicSort = 'updated';
        currentTopicScope = 'all';
        localStorage.setItem('setae_topic_scope', currentTopicScope);

        $('#com-search-input').val('');
        $('#com-sort-select').val('updated');
        $('.com-filter-btn').removeClass('active');
        $('.com-filter-btn[data-type="all"]').addClass('active');
        syncPrimaryNav('section-com');
        $('.setae-section').hide();
        $('#section-com').fadeIn(160);
        currentSocialHubView = 'community';
        syncSocialHubTabs('community');

        renderCommunitySpeciesContext();
        loadTopics('all', false);
        refreshCommunityUnread();
    }

    function handleOpenSpeciesTopicList(e) {
        e.preventDefault();
        e.stopPropagation();
        openCommunityForSpecies(getSpeciesPayloadFromElement($(this)));
    }

    function clearCommunitySpeciesFilter(e) {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }

        currentTopicSpeciesId = null;
        currentTopicSpeciesName = '';
        currentTopicSpeciesScientificName = '';
        renderCommunitySpeciesContext();
        loadTopics(currentTopicListType, false);
    }

    function syncCommunityListControls() {
        $('#com-search-input').val(currentTopicSearch || '');
        $('#com-sort-select').val(currentTopicSort || 'newest');

        const activeScope = ['all', 'following', 'mine'].indexOf(currentTopicScope) !== -1
            ? currentTopicScope
            : 'all';
        $('.com-scope-btn').removeClass('active');
        $(`.com-scope-btn[data-scope="${activeScope}"]`).addClass('active');

        const activeType = currentTopicListType || 'all';
        const $buttons = $('.com-filter-btn');
        $buttons.removeClass('active');
        const $activeButton = $buttons.filter(function () {
            return String($(this).data('type')) === activeType;
        });

        if ($activeButton.length) {
            $activeButton.addClass('active');
        } else {
            $('.com-filter-btn[data-type="all"]').addClass('active');
        }

        renderCommunitySpeciesContext();
    }

    function handleCommunityScopeClick(e) {
        e.preventDefault();
        e.stopPropagation();

        const nextScope = $(this).data('scope') || 'all';
        currentTopicScope = ['all', 'following', 'mine'].indexOf(nextScope) !== -1
            ? nextScope
            : 'all';
        localStorage.setItem('setae_topic_scope', currentTopicScope);
        syncCommunityListControls();
        loadTopics(currentTopicListType, false);
    }

    function resetCommunityFilters(e) {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }

        currentTopicListType = 'all';
        currentTopicSearch = '';
        currentTopicSort = 'newest';
        currentTopicScope = 'all';
        currentTopicSpeciesId = null;
        currentTopicSpeciesName = '';
        currentTopicSpeciesScientificName = '';

        localStorage.setItem('setae_topic_scope', currentTopicScope);

        syncCommunityListControls();
        loadTopics('all', false);

        if (typeof SetaeCore.track === 'function') {
            SetaeCore.track('community_empty_reset');
        }
    }

    let currentTopicListPage = 1;
    let currentTopicListType = 'all';
    let currentTopicSearch = '';
    let currentTopicSort = 'newest';
    let currentTopicScope = localStorage.getItem('setae_topic_scope') || 'all';
    if (['all', 'following', 'mine'].indexOf(currentTopicScope) === -1) {
        currentTopicScope = 'all';
    }
    let currentTopicSpeciesId = null;
    let currentTopicSpeciesName = '';
    let currentTopicSpeciesScientificName = '';
    let currentTopicItems = [];
    let isTopicListLoading = false;

    function renderCommunityDesktopSummary(items) {
        const $panel = $('#community-desktop-summary');
        if (!$panel.length) return;

        const visibleItems = Array.isArray(items) ? items : [];
        if (!visibleItems.length) {
            $panel.hide().empty();
            return;
        }

        const unreadCount = visibleItems.filter(function (topic) {
            return !!topic.has_unread || (parseInt(topic.unread_count, 10) || 0) > 0;
        }).length;
        const openCount = visibleItems.filter(function (topic) {
            return !topic.is_archived && !topic.is_resolved;
        }).length;
        const questionCount = visibleItems.filter(function (topic) {
            return topic.type === 'question';
        }).length;
        const typeLabel = {
            all: 'すべての相談',
            question: '質問',
            chat: '雑談',
            breeding: 'ブリード'
        }[currentTopicListType || 'all'] || '相談';
        const scopeLabel = {
            all: 'みんな',
            following: 'フォロー中',
            mine: '自分'
        }[currentTopicScope || 'all'] || 'みんな';
        const activeTopics = visibleItems.slice().sort(function (a, b) {
            const bScore = (parseFloat(b.momentum) || 0) + (parseInt(b.comment_count, 10) || 0);
            const aScore = (parseFloat(a.momentum) || 0) + (parseInt(a.comment_count, 10) || 0);
            return bScore - aScore;
        }).slice(0, 3);
        const topicRows = activeTopics.map(function (topic) {
            const commentCount = parseInt(topic.comment_count, 10) || 0;
            return `
                <button type="button" class="social-rail-topic js-open-topic-row"
                    data-id="${escapeHtml(topic.id)}">
                    <span>${escapeHtml(topic.author_name || '飼育者')} · ${escapeHtml(SetaeCore.formatRelativeDate(topic.date))}</span>
                    <strong>${escapeHtml(topic.title || '投稿')}</strong>
                    <em>${commentCount ? escapeHtml(commentCount + '件の返信') : '新しい投稿'}</em>
                </button>
            `;
        }).join('');

        $panel.html(`
            <section class="community-rail-overview">
                <div class="community-rail-head">
                    <span>このタイムライン</span>
                    <strong>${escapeHtml(String(visibleItems.length))}<small>件</small></strong>
                </div>
                <p>${escapeHtml(scopeLabel)}の${escapeHtml(typeLabel)}を表示中</p>
                <div class="community-rail-metrics">
                    <span><b>${escapeHtml(String(unreadCount))}</b>未読あり</span>
                    <span><b>${escapeHtml(String(openCount))}</b>受付中</span>
                    <span><b>${escapeHtml(String(questionCount))}</b>質問</span>
                </div>
                ${topicRows ? `
                    <div class="social-rail-trends">
                        <h4>いま話題</h4>
                        ${topicRows}
                    </div>
                ` : ''}
            </section>
        `).show();
    }

    function loadTopics(type = null, isLoadMore = false, options) {
        options = options || {};
        const silent = !isLoadMore && !!options.silent;
        const liveMerge = !isLoadMore && !!options.liveMerge;
        if (isTopicListLoading) return null;

        const previousPage = currentTopicListPage;
        const timelineAnchor = liveMerge ? captureSocialTimelineAnchor('community') : null;
        isTopicListLoading = true;

        if (type) {
            currentTopicListType = type;
        }

        if (!isLoadMore && !liveMerge) {
            syncCommunityListControls();
        }

        if (!isLoadMore) {
            if (!liveMerge) {
                currentTopicListPage = 1;
                hideSocialNewPostsBanner('community');
            }
            renderCommunitySpeciesContext();
            if (!silent) {
                currentTopicItems = [];
                renderCommunityDesktopSummary([]);
                $('#setae-topic-list').attr('aria-busy', 'true').html(`
                    <div class="setae-view-state" role="status">
                        <span class="setae-view-state-mark" aria-hidden="true"></span>
                        <strong>相談を読み込んでいます</strong>
                        <p>新しい質問と会話を整理しています。</p>
                    </div>
                `);
                $('#setae-topic-load-more').hide();
            }
        } else {
            $('#btn-load-more-topics').hide();
            $('#loader-topics').show();
        }

        const request = SetaeAPI.fetchTopics({
            type: currentTopicListType,
            page: isLoadMore ? currentTopicListPage : 1,
            s: currentTopicSearch,
            sort: currentTopicSort,
            scope: currentTopicScope || 'all',
            species_id: currentTopicSpeciesId || ''
        }, function (response) {
            isTopicListLoading = false;
            const container = $('#setae-topic-list');

            // APIレスポンス形式 { items: [...], has_next: true/false } に対応
            // 古い形式(配列のみ)の場合は items = response
            let topics = response.items || response;
            const hasNext = response.has_next || false;
            if (liveMerge) {
                const liveItems = mergeSocialTimelineItems(options.liveItems || [], topics);
                topics = mergeSocialTimelineItems(liveItems, currentTopicItems);
            }

            if (!isLoadMore) {
                container.empty();
            } else {
                $('#loader-topics').hide();
            }

            if (!topics || topics.length === 0) {
                if (!isLoadMore) {
                    currentTopicItems = [];
                    renderCommunityDesktopSummary([]);
                    if (typeof SetaeCore.track === 'function') {
                        SetaeCore.track('community_empty_seen', {
                            type: currentTopicListType,
                            scope: currentTopicScope || 'all',
                            search: currentTopicSearch,
                            species_id: currentTopicSpeciesId || ''
                        });
                    }

                    const speciesAttrs = currentTopicSpeciesId ? `
                        data-species-id="${escapeHtml(currentTopicSpeciesId)}"
                        data-scientific-name="${escapeHtml(currentTopicSpeciesScientificName)}"
                        data-common-name="${escapeHtml(currentTopicSpeciesName)}"
                        data-display-name="${escapeHtml(currentTopicSpeciesName)}"
                    ` : '';
                    const hasActiveCommunityFilters = !!currentTopicSpeciesId
                        || !!(currentTopicSearch && currentTopicSearch.trim())
                        || (currentTopicListType && currentTopicListType !== 'all')
                        || (currentTopicScope && currentTopicScope !== 'all')
                        || (currentTopicSort && currentTopicSort !== 'newest');
                    const resetAllTopicsButton = '<button type="button" class="setae-btn-secondary js-community-reset-filters">すべての相談を見る</button>';
                    const emptyTitle = currentTopicSpeciesId
                        ? 'この種の相談はまだありません'
                        : (hasActiveCommunityFilters ? '条件に合う相談はありません' : 'まだ相談はありません');
                    const emptyText = currentTopicSpeciesId
                        ? '最初の相談を立てると、同じ種を飼っている人があとから見つけやすくなります。'
                        : (hasActiveCommunityFilters
                            ? '条件を戻すと、ほかの相談が見つかるかもしれません。見つからない内容なら、そのまま新しい相談にできます。'
                            : '最初の質問や飼育メモを投稿できます。タイトルだけでも具体的にすると、あとから来た人が答えやすくなります。');
                    const hasSearchQuery = !!(currentTopicSearch && currentTopicSearch.trim());
                    const emptyTopicButton = hasSearchQuery
                        ? '<button type="button" class="setae-btn js-open-community-empty-topic">この内容で相談する</button>'
                        : '<button type="button" class="setae-btn js-open-topic-modal">相談を投稿する</button>';
                    const emptyActions = currentTopicSpeciesId ? `
                        <button type="button" class="setae-btn js-open-species-topic-modal" ${speciesAttrs}>この種について相談</button>
                        ${resetAllTopicsButton}
                    ` : `
                        ${emptyTopicButton}
                        ${hasActiveCommunityFilters ? resetAllTopicsButton : '<button type="button" class="setae-btn-secondary js-go-enc">図鑑を見る</button>'}
                    `;

                    $('#setae-topic-list').html(`
                        <div class="setae-empty-state setae-community-empty">
                            <span class="empty-icon">?</span>
                            <h3>${emptyTitle}</h3>
                            <p>${emptyText}</p>
                            <div class="setae-empty-actions">
                                ${emptyActions}
                            </div>
                        </div>
                    `);
                }
                $('#setae-topic-load-more').hide();
                if (liveMerge) {
                    setSocialLiveStatus('community', 'live');
                }
                return;
            }

            if (isLoadMore) {
                currentTopicItems = currentTopicItems.concat(topics);
            } else {
                currentTopicItems = topics.slice();
            }
            renderCommunityDesktopSummary(currentTopicItems);

            let unreadDividerInserted = isLoadMore || container.find('.social-unread-divider').length > 0;
            topics.forEach(topic => {
                // カテゴリごとのバッジ色設定
                let typeLabel = 'その他';
                switch (topic.type) {
                    case 'question': typeLabel = '質問'; break;
                    case 'chat': typeLabel = '雑談'; break;
                    case 'breeding': typeLabel = 'ブリード'; break;
                }

                // アバターまたはイニシャルの表示ロジック
                // APIレスポンスに avatar_url / initial 等が含まれていない場合はフォールバック
                let topicListAvatarHtml = '';
                if (topic.author_avatar) {
                    topicListAvatarHtml = `<img src="${escapeHtml(topic.author_avatar)}" alt="" class="avatar-img" loading="lazy">`;
                } else if (topic.author_initial) {
                    topicListAvatarHtml = `<span class="avatar-initial">${escapeHtml(topic.author_initial)}</span>`;
                } else {
                    // 古いデータ形式等へのフォールバック（最初の1文字を取る）
                    let initial = topic.author_name ? topic.author_name.substring(0, 1) : '?';
                    topicListAvatarHtml = `<span class="avatar-initial">${escapeHtml(initial)}</span>`;
                }

                const isArchived = topic.is_archived ? true : false;
                const hasUnread = topic.has_unread || (parseInt(topic.unread_count, 10) || 0) > 0;
                const rowClass = `${isArchived ? 'thread-archived' : 'thread-active'} ${hasUnread ? 'has-unread' : ''}`;
                const momentum = parseFloat(topic.momentum) || 0;
                const momentumBadge = momentum > 0
                    ? `<span class="thread-momentum">勢い ${escapeHtml(momentum)}</span>`
                    : '';
                const unreadBadge = hasUnread
                    ? `<span class="thread-unread-badge">新着 ${escapeHtml(topic.unread_count)}</span>`
                    : '';
                const resolvedBadge = topic.is_resolved
                    ? '<span class="thread-resolved-badge">解決済み</span>'
                    : '';
                const relatedSpeciesChip = renderTopicRelatedSpeciesChip(topic.related_species);

                // ▼ 追加：バッジHTMLの生成
                const badgesHtml = generateUserBadgesHtml(topic.author_is_premium, topic.author_bonus_slots);
                const decodeDisplayText = SetaeCore && typeof SetaeCore.decodeHtmlEntities === 'function'
                    ? SetaeCore.decodeHtmlEntities
                    : function (value) { return String(value || ''); };
                const titleText = decodeDisplayText(topic.title || '');
                const excerptText = decodeDisplayText(topic.excerpt || '');
                const normalizedTitle = titleText.replace(/\s+/g, ' ').trim();
                const normalizedExcerpt = excerptText.replace(/\s+/g, ' ').trim();
                const isQuickPost = topic.type === 'chat'
                    && normalizedExcerpt
                    && (
                        normalizedExcerpt.indexOf(normalizedTitle) === 0
                        || normalizedTitle.indexOf(normalizedExcerpt) === 0
                    );
                const topicTextHtml = renderTopicListContent(topic, titleText, excerptText, isQuickPost);
                const commentCount = parseInt(topic.comment_count, 10) || 0;
                const topicCreatedAt = topic.created_at || topic.date;
                const dateLabel = topic.date_display || SetaeCore.formatRelativeDate(topicCreatedAt);
                const editedHtml = topic.is_edited
                    ? '<span class="social-post-edited" title="投稿後に編集されています">編集済み</span>'
                    : '';
                const statusLabel = isArchived
                    ? '過去ログ'
                    : (topic.is_resolved ? '解決済み' : '会話中');
                const topicHandle = String(topic.author_handle || '').replace(/^@/, '');
                const topicRelationship = topic.viewer_relationship || {};
                const topicFollowingMark = topicRelationship.following ? `
                    <span class="social-following-mark" title="フォロー中">
                        <span class="dashicons dashicons-yes-alt" aria-hidden="true"></span>
                        <span class="screen-reader-text">フォロー中</span>
                    </span>
                ` : '';
                const topicAvatarInner = `
                    <div class="setae-user-avatar avatar-sm">
                        ${topicListAvatarHtml}
                        ${badgesHtml}
                    </div>
                `;
                const topicAvatar = topic.author_profile_url
                    ? `<a class="social-post-avatar-link" href="${escapeHtml(topic.author_profile_url)}"
                        target="_blank" rel="noopener noreferrer"
                        aria-label="${escapeHtml(topic.author_name || 'ユーザー')}のプロフィール">${topicAvatarInner}</a>`
                    : topicAvatarInner;
                const topicAuthorName = topic.author_profile_url
                    ? `<a class="setae-author-name care-feed-author-link"
                        href="${escapeHtml(topic.author_profile_url)}" target="_blank"
                        rel="noopener noreferrer">${escapeHtml(topic.author_name || 'ユーザー不明')}</a>`
                    : `<span class="setae-author-name">${escapeHtml(topic.author_name || 'ユーザー不明')}</span>`;
                const topicShareAction = topic.link ? `
                    <button type="button" class="social-post-action social-post-share-action js-social-share-post"
                        data-share-url="${escapeHtml(topic.link)}"
                        data-share-title="${escapeHtml(titleText || 'SETAEの投稿')}"
                        aria-label="共有" title="共有">
                        <span class="dashicons dashicons-share-alt2" aria-hidden="true"></span>
                    </button>
                ` : '';

                if (hasUnread && !unreadDividerInserted) {
                    container.append(`
                        <div class="social-unread-divider" role="separator" aria-label="ここから未読の投稿">
                            <span>ここから未読</span>
                        </div>
                    `);
                    unreadDividerInserted = true;
                }

                const html = `
                    <article class="setae-topic-row social-timeline-post ${rowClass}" data-id="${escapeHtml(topic.id)}"
                        tabindex="0" aria-label="${escapeHtml((topic.author_name || '飼育者') + 'の投稿: ' + (titleText || '無題'))}">
                        <div class="social-post-avatar">
                            ${topicAvatar}
                        </div>
                        <div class="social-post-content">
                            <div class="social-post-header">
                                <div class="social-post-author-line">
                                    ${topicAuthorName}
                                    ${topicHandle ? `<span class="social-author-handle" title="ログイン情報とは異なるSETAE専用公開ID">@${escapeHtml(topicHandle)}</span>` : ''}
                                    ${topicFollowingMark}
                                    <time class="setae-topic-time" datetime="${escapeHtml(topicCreatedAt || '')}"
                                        title="${escapeHtml(topicCreatedAt || '')}">${escapeHtml(dateLabel)}</time>
                                    ${editedHtml}
                                </div>
                                <div class="social-post-header-actions">
                                    <div class="thread-badges">${unreadBadge}</div>
                                    ${renderTopicActions(topic)}
                                </div>
                            </div>

                            <div class="social-post-meta">
                                <span class="setae-topic-badge badge-${escapeHtml(topic.type || 'other')}">${escapeHtml(typeLabel)}</span>
                                ${resolvedBadge}
                                ${momentumBadge}
                            </div>

                            ${topicTextHtml}
                            ${relatedSpeciesChip}

                            ${isArchived ? `
                                <p class="social-post-archive-note">この相談は過去ログとして閲覧できます。</p>
                            ` : ''}

                            <div class="setae-topic-row-footer social-post-action-row">
                                <button type="button" class="social-post-action social-post-reply-action js-open-topic-row"
                                    data-id="${escapeHtml(topic.id)}"
                                    aria-label="${escapeHtml(commentCount ? commentCount + '件の返信を見る' : '返信する')}"
                                    title="${escapeHtml(commentCount ? commentCount + '件の返信を見る' : '返信する')}">
                                    <span class="dashicons dashicons-undo" aria-hidden="true"></span>
                                    <b>${escapeHtml(commentCount ? String(commentCount) : '')}</b>
                                </button>
                                ${renderTopicListReactionControl(topic)}
                                ${topicShareAction}
                                <span class="thread-status-indicator ${hasUnread ? 'has-unread' : ''}">
                                    ${escapeHtml(statusLabel)}
                                </span>
                            </div>
                        </div>
                    </article>
                `;
                container.append(html);
            });

            if (!liveMerge) {
                // 次のページがあるなら「もっと見る」を表示
                if (hasNext) {
                    $('#setae-topic-load-more').show();
                    $('#btn-load-more-topics').show();
                    currentTopicListPage++;
                } else {
                    $('#setae-topic-load-more').hide();
                }
            } else {
                currentTopicListPage = previousPage;
                finishSocialLiveMerge('community', options.newIds || [], options.liveUpdateCount || 0, timelineAnchor);
            }
        }, function (xhr) {
            if (silent) {
                setSocialLiveStatus('community', 'offline');
                return;
            }
            const message = SetaeCore.getErrorMessage
                ? SetaeCore.getErrorMessage(xhr, '通信状態を確認して、もう一度お試しください。')
                : '通信状態を確認して、もう一度お試しください。';
            if (isLoadMore) {
                SetaeCore.showToast('続きの相談を読み込めませんでした。表示中の内容はそのままです。', 'warning');
                return;
            }
            currentTopicItems = [];
            renderCommunityDesktopSummary([]);
            $('#setae-topic-list').html(`
                <div class="setae-view-state is-error" role="alert">
                    <span class="setae-view-state-mark" aria-hidden="true"></span>
                    <strong>相談を読み込めませんでした</strong>
                    <p>${escapeHtml(message)}</p>
                    <button type="button" class="js-retry-topics">もう一度読み込む</button>
                </div>
            `);
        });

        if (request && request.always) {
            request.always(function () {
                isTopicListLoading = false;
                $('#setae-topic-list').removeAttr('aria-busy');
                $('#loader-topics').hide();
            });
        }
        return request;
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
    function loadComments(id, page, options) {
        options = options || {};

        SetaeAPI.getTopicDetail(id, page, function (data) {
            const shouldRenderTopic = page === 1 || options.renderTopic;
            currentTopicPage = page;

            // 初回ロード時はトピック本文などを描画
            if (shouldRenderTopic) {
                // ヘッダー設定
                $('#detail-header-title').text(data.title);
                $('#comment-post-id').val(data.id);

                // アバターまたはイニシャルの表示ロジック
                let topicAvatarHtml = data.author_avatar ?
                    `<img src="${escapeHtml(data.author_avatar)}" alt="${escapeHtml(data.author_name || 'ユーザー')}" class="avatar-img">` :
                    `<span class="avatar-initial">${escapeHtml(data.author_initial || '?')}</span>`;

                // ▼ 追加：バッジHTMLの生成
                const topicBadgesHtml = generateUserBadgesHtml(data.author_is_premium, data.author_bonus_slots);
                const detailHandle = String(data.author_handle || '').replace(/^@/, '');
                const detailCreatedAt = data.created_at || data.date;
                const detailEditedHtml = data.is_edited
                    ? '<span class="social-post-edited" title="投稿後に編集されています">編集済み</span>'
                    : '';
                const detailTypeLabel = {
                    question: '質問',
                    chat: 'ひとこと',
                    breeding: 'ブリード'
                }[data.type] || '投稿';
                const detailAvatarInner = `
                    <div class="setae-user-avatar">
                        ${topicAvatarHtml}
                        ${topicBadgesHtml}
                    </div>
                `;
                const detailAvatar = data.author_profile_url
                    ? `<a class="social-post-avatar-link" href="${escapeHtml(data.author_profile_url)}"
                        target="_blank" rel="noopener noreferrer"
                        aria-label="${escapeHtml(data.author_name || 'ユーザー')}のプロフィール">${detailAvatarInner}</a>`
                    : detailAvatarInner;
                const detailAuthorName = data.author_profile_url
                    ? `<a class="setae-author-name care-feed-author-link"
                        href="${escapeHtml(data.author_profile_url)}" target="_blank"
                        rel="noopener noreferrer">${escapeHtml(data.author_name || 'ユーザー不明')}</a>`
                    : `<span class="setae-author-name">${escapeHtml(data.author_name || 'ユーザー不明')}</span>`;
                const detailContentBody = `
                    <div class="setae-topic-body">${data.content || ''}</div>
                    ${renderSocialTopicMedia(data, 'detail')}
                `;
                const detailCwId = 'topic-detail-cw-' + escapeHtml(data.id);
                const detailContent = data.has_cw ? `
                    <div class="social-content-warning is-detail">
                        <div>
                            <span>CW</span>
                            <strong>${escapeHtml(data.title || '内容についての注意')}</strong>
                        </div>
                        <button type="button" class="js-social-cw-toggle"
                            aria-expanded="false" aria-controls="${detailCwId}">表示</button>
                    </div>
                    <div id="${detailCwId}" class="social-cw-content" hidden>
                        ${detailContentBody}
                    </div>
                ` : detailContentBody;

                // 本文描画
                $('#topic-detail-content').html(`
                    <article class="setae-card setae-topic-detail-card social-topic-detail">
                        <div class="social-topic-detail-head">
                            <div class="social-post-avatar">${detailAvatar}</div>
                            <div class="social-topic-detail-identity">
                                <div class="social-post-author-line">
                                    ${detailAuthorName}
                                    ${detailHandle ? `<span class="social-author-handle" title="ログイン情報とは異なるSETAE専用公開ID">@${escapeHtml(detailHandle)}</span>` : ''}
                                    <time class="setae-topic-time" datetime="${escapeHtml(detailCreatedAt || '')}"
                                        title="${escapeHtml(detailCreatedAt || '')}">${escapeHtml(SetaeCore.formatRelativeDate(detailCreatedAt))}</time>
                                    ${detailEditedHtml}
                                </div>
                                <span class="setae-topic-badge badge-${escapeHtml(data.type || 'other')}">${escapeHtml(detailTypeLabel)}</span>
                            </div>
                            ${renderTopicActions(data)}
                        </div>
                        ${renderTopicStatusPanel(data)}
                        ${renderTopicRelatedSpeciesChip(data.related_species)}
                        ${detailContent}
                        ${renderReactionButtons(data.reactions, 'topic', data.id)}
                    </article>
                `);

                // ★追加: 文字数カウンター用のSpanを挿入 (フォームはPHP側にある想定だが、JSで動的に入れるならここ)
                // input要素の親Divに相対配置で入れる
                const $inputWrapper = $('#comment-content').parent();
                if ($('#comment-char-count').length === 0) {
                    $inputWrapper.append('<div class="care-feed-comment-actions"><span id="comment-char-count">0 / 1000</span><button type="submit" class="setae-btn setae-btn-primary btn-send-comment">投稿する</button></div>');
                }

                markCommunityTopicRead(data.id);
            }

            // コメント描画
            const commentsContainer = $('#topic-comments-list');
            $('#btn-load-more-comments, #btn-reload-comments-from-start').remove();

            if (options.replace || page === 1) {
                commentsContainer.empty();
            }

            if (options.showFromStart && page > 1) {
                commentsContainer.append(`
                    <button type="button" id="btn-reload-comments-from-start" class="setae-btn-secondary topic-comments-from-start">
                        最初から読む
                    </button>
                `);
            }

            // ページ1でコメントがない場合
            if (page === 1 && (!data.comments || data.comments.length === 0)) {
                commentsContainer.html(`
                    <div class="setae-empty-state topic-comments-empty">
                        <span class="empty-icon">+</span>
                        <h3>まだコメントはありません</h3>
                        <p>経験談や気づいたことを最初に残せます。</p>
                        <div class="setae-empty-actions">
                            <button type="button" class="setae-btn js-topic-comment-focus">コメントを書く</button>
                        </div>
                    </div>
                `);
                return;
            }

            // コメント追加
            if (data.comments && data.comments.length > 0) {
                data.comments.forEach(comment => {
                    let imageHtml = '';
                    if (comment.image) {
                        imageHtml = `
                            <button type="button" class="topic-comment-image js-care-feed-media-open"
                                data-media-url="${escapeHtml(comment.image)}"
                                data-media-alt="コメントの写真" aria-label="コメントの写真を拡大">
                                <img src="${escapeHtml(comment.image)}" alt="コメントの写真" loading="lazy">
                            </button>
                        `;
                    }

                    const commentAuthorName = comment.author_name || 'ユーザー不明';
                    const commentHandle = String(comment.author_handle || '').replace(/^@/, '');
                    let cAvatarHtml = comment.author_avatar ?
                        `<img src="${escapeHtml(comment.author_avatar)}" alt="${escapeHtml(commentAuthorName)}" class="avatar-img">` :
                        `<span class="avatar-initial">${escapeHtml(comment.author_initial)}</span>`;

                    // ▼ 追加：コメント投稿者のバッジHTML
                    const cBadgesHtml = generateUserBadgesHtml(comment.author_is_premium, comment.author_bonus_slots);
                    const bestAnswerHtml = comment.is_best_answer
                        ? '<div class="best-answer-label">ベスト回答</div>'
                        : '';
                    const commentAvatarInner = `
                        <div class="setae-user-avatar">
                            ${cAvatarHtml}
                            ${cBadgesHtml}
                        </div>
                    `;
                    const commentAvatar = comment.author_profile_url
                        ? `<a class="social-post-avatar-link" href="${escapeHtml(comment.author_profile_url)}"
                            target="_blank" rel="noopener noreferrer">${commentAvatarInner}</a>`
                        : commentAvatarInner;
                    const commentAuthor = comment.author_profile_url
                        ? `<a class="setae-author-name care-feed-author-link"
                            href="${escapeHtml(comment.author_profile_url)}" target="_blank"
                            rel="noopener noreferrer">${escapeHtml(commentAuthorName)}</a>`
                        : `<span class="setae-author-name">${escapeHtml(commentAuthorName)}</span>`;

                    commentsContainer.append(`
                        <article class="setae-comment-row social-topic-comment ${comment.is_best_answer ? 'is-best-answer' : ''}" data-comment-id="${escapeHtml(comment.id)}">
                            ${bestAnswerHtml}
                            <div class="setae-comment-meta">
                                ${commentAvatar}
                                <div class="social-post-author-line">
                                    ${commentAuthor}
                                    ${commentHandle ? `<span class="social-author-handle" title="SETAE専用公開ID">@${escapeHtml(commentHandle)}</span>` : ''}
                                    <time class="setae-topic-time" datetime="${escapeHtml(comment.date || '')}"
                                        title="${escapeHtml(comment.date || '')}">${escapeHtml(SetaeCore.formatRelativeDate(comment.date))}</time>
                                </div>
                            </div>
                            <div class="setae-comment-body">
                                ${comment.content}
                                ${imageHtml}
                            </div>
                            ${renderReactionButtons(comment.reactions, 'comment', comment.id)}
                        </article>
                    `);
                });
            }

            // 「もっと見る」ボタンの制御
            $('#btn-load-more-comments').remove();
            if (data.has_next) {
                commentsContainer.after(`
                    <button type="button" id="btn-load-more-comments" data-next="${page + 1}" class="setae-btn-secondary" style="width:100%; margin-top:10px; padding:10px; border-radius:8px;">
                        もっと見る
                    </button>
                `);
            }

            if (options.focusCommentId) {
                window.setTimeout(function () {
                    focusTopicCommentRow(options.focusCommentId);
                }, 120);
            }
        });
    }



    // Removed: loadSpeciesBook() - Now handled by PHP in section-encyclopedia.php


    // 修正後
    function handleToolbarShadow(scrollTop) {
        if (scrollTop > 10) {
            $('.setae-toolbar-container').addClass('sticky-shadow').each(function () {
                // ネイティブAPIで確実に !important を付与する
                this.style.setProperty('z-index', '2002', 'important');
            });
        } else {
            $('.setae-toolbar-container').removeClass('sticky-shadow').each(function () {
                // スクロールが上に戻ったら z-index 自体を削除して元に戻す
                this.style.removeProperty('z-index');
            });
        }
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
        const username = $(this).data('username') || 'ユーザー不明';
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
        openSpeciesDetail: openSpeciesDetail,
        loadCareFeed: loadCareFeed,
        openCareFeedDetail: openCareFeedDetail,
        openTopicDetail: openTopicDetail,
        refreshCareFeedUnread: refreshCareFeedUnread,
        refreshCommunityUnread: refreshCommunityUnread,
        syncPrimaryNav: syncPrimaryNav,
        generateUserBadgesHtml: generateUserBadgesHtml,
        openTopicModalForSpider: openTopicModalForSpider
    };

})(jQuery);
