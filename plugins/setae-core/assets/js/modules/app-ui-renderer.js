var SetaeUI = (function ($) {
    'use strict';

    // ▼ 追加: 図鑑一覧のスクロール位置を記憶する変数
    let encScrollPosition = 0;

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
            $('.com-filter-btn').removeClass('active');
            $(this).addClass('active');
            const type = $(this).data('type');
            loadTopics(type);
        });

        // "もっと見る" ボタン (トピック一覧)
        $(document).on('click', '#btn-load-more-topics', function () {
            loadTopics(currentTopicListType, true); // type=null (維持), isLoadMore=true
        });

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
            $('#section-enc').fadeIn(200, function () {
                // ▼ 追加: 一覧に戻った際、記憶しておいたスクロール位置へ復元する
                $(window).scrollTop(encScrollPosition);
            });
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
        // ▼ 追加: 現在の一覧画面のスクロール位置を保存しておく
        encScrollPosition = $(window).scrollTop();

        $('#section-enc').hide();
        $('#section-enc-detail').show();

        // ▼ 追加: 詳細画面を開く際、ウィンドウのスクロールを一番上(0)にリセットする
        $(window).scrollTop(0);

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

            // 画像クレジット情報の反映
            if (data.image_credit && data.image_credit.text) {
                $('#enc-detail-credit-name').text(data.image_credit.text);

                const $avatarContainer = $('#enc-detail-credit-avatar');

                if (data.image_credit.type === 'user') {
                    if (data.image_credit.avatar) {
                        // アバター画像がある場合
                        $avatarContainer.html(`<img src="${data.image_credit.avatar}" style="width:100%; height:100%; object-fit:cover;">`);
                    } else {
                        // アバターがない場合はイニシャルを表示（緑のグラデーション背景）
                        const initial = data.image_credit.text.charAt(0).toUpperCase();
                        $avatarContainer.html(`<div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; background:linear-gradient(135deg, #2ecc71, #27ae60); color:#fff; font-size:14px; font-weight:bold;">${initial}</div>`);
                    }
                } else {
                    // Wikipediaなど直接入力の場合は、汎用の地球アイコン等を表示
                    $avatarContainer.html(`<div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; background:linear-gradient(135deg, #7f8c8d, #34495e); color:#fff; font-size:12px;">🌐</div>`);
                }

                $('#enc-detail-image-credit-overlay').fadeIn();
            } else {
                $('#enc-detail-image-credit-overlay').hide();
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

            // -----------------------------------------------------
            // ▼ 追加: 広告データの取得と描画の出し分け
            // -----------------------------------------------------
            const adContainer = document.getElementById('enc-detail-ad-container');
            const speciesId = id; // openSpeciesDetail に渡される id 
            if (adContainer && speciesId) {
                fetch(`/wp-json/setae/v1/ads/species/${speciesId}`)
                    .then(res => res.json())
                    .then(data => {
                        if (data.has_ad && data.html) {
                            // 管理画面で設定した広告HTMLで上書きし、デフォルトの枠線を消す
                            adContainer.innerHTML = data.html;

                            // ↓↓↓ ここから追加: innerHTMLで挿入されたscriptタグを再構築して実行させる ↓↓↓
                            const scripts = adContainer.querySelectorAll('script');
                            scripts.forEach(oldScript => {
                                const newScript = document.createElement('script');
                                Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
                                newScript.appendChild(document.createTextNode(oldScript.innerHTML));
                                oldScript.parentNode.replaceChild(newScript, oldScript);
                            });
                            // ↑↑↑ ここまで追加 ↑↑↑

                            adContainer.style.border = 'none';
                            adContainer.style.padding = '0';
                            adContainer.style.background = 'transparent';
                        } else {
                            // 広告がない場合は、デフォルトの「広告主募集中」HTMLにリセット
                            // SPA対応: 一度広告付きのページを開いた後に、広告なしのページを開くと残ってしまうのを防ぐため
                            adContainer.innerHTML = `
                                <span style="display: inline-block; font-size: 10px; background: #eee; color: #888; padding: 3px 8px; border-radius: 12px; margin-bottom: 8px;">スポンサー枠</span>
                                <div style="font-weight: bold; font-size: 15px; color: #333; margin-bottom: 6px;">広告主募集中</div>
                                <div style="font-size: 12px; color: #666; line-height: 1.5; margin-bottom: 12px;">
                                    ここにショップのHP情報や、販売個体の値段掲載などが可能です。<br>
                                    詳細をご希望のショップ様は運営までご連絡ください。
                                </div>
                                <a href="https://nakano2835.com/contact/" target="_blank" rel="noopener noreferrer" style="display: inline-block; text-decoration: none; background: #fff; border: 1px solid #ccc; color: #555; padding: 6px 16px; border-radius: 20px; font-size: 12px; cursor: pointer; font-weight: bold;">
                                    お問い合わせ
                                </a>
                            `;
                            adContainer.style.border = '2px dashed #ddd';
                            adContainer.style.padding = '20px 15px';
                            adContainer.style.background = '#fafafa';
                        }
                    })
                    .catch(err => console.error('Ad fetch error:', err));
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

    let currentTopicListPage = 1;
    let currentTopicListType = 'all';
    let currentTopicSearch = '';
    let currentTopicSort = 'updated';
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
            page: currentTopicListPage,
            s: currentTopicSearch,
            sort: currentTopicSort
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

                // 2ch Style Topic Classes
                const isArchived = topic.is_archived ? true : false;
                const rowClass = isArchived ? 'thread-archived' : 'thread-active';
                const limitClass = isArchived ? 'limit-reached' : '';
                const maxCountDisplay = topic.comment_count > 1000 ? 1000 : topic.comment_count;

                // 2ch Style Badge Display
                let momentumBadge = '';
                if (topic.momentum !== undefined) {
                    momentumBadge = `<span class="thread-momentum">勢い: ${topic.momentum}</span>`;
                }

                // ▼ 追加：バッジHTMLの生成
                const badgesHtml = generateUserBadgesHtml(topic.author_is_premium, topic.author_bonus_slots);

                const html = `
                    <div class="setae-topic-row setae-card ${rowClass}" data-id="${topic.id}">
                        <div class="setae-topic-row-header">
                            <div class="thread-badges">
                                <span class="setae-topic-badge badge-${topic.type}">${typeLabel}</span>
                                ${momentumBadge}
                            </div>
                            <span class="setae-topic-time">${topic.date_display || SetaeCore.formatRelativeDate(topic.date)}</span>
                        </div>
                        
                        <h3 class="setae-topic-title" ${isArchived ? 'style="color: #888;"' : ''}>
                            ${topic.title}</span>
                        </h3>
                        
                        ${isArchived ? `
                            <div class="setae-topic-excerpt" style="color: #999;">
                                ※このスレッドは1000レスを超えたため過去ログ倉庫に移動しました。
                            </div>
                        ` : `
                            <div>
                            </div>
                        `}

                        <div class="setae-topic-row-footer">
                            <div class="setae-topic-author" ${isArchived ? 'style="opacity: 0.7;"' : ''}>
                                <div class="setae-user-avatar avatar-sm" style="position:relative; display:inline-flex; align-items:center; justify-content:center;">
                                    ${topicListAvatarHtml}
                                    ${badgesHtml}
                                </div>
                                <span class="setae-author-name">${topic.author_name || 'Anonymous'}</span>
                            </div>

                            <div class="thread-status-indicator">
                                ${isArchived ? '<span class="status-archived">過去ログ</span>' : '<span class="status-active">書き込み可</span>'}
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

                // ▼ 追加：バッジHTMLの生成
                const topicBadgesHtml = generateUserBadgesHtml(data.author_is_premium, data.author_bonus_slots);

                // 本文描画
                $('#topic-detail-content').html(`
                    <div class="setae-card setae-topic-detail-card">
                        <div class="setae-topic-meta">
                            <div class="setae-user-avatar" style="position:relative; display:inline-flex; align-items:center; justify-content:center;">
                                ${topicAvatarHtml}
                                ${topicBadgesHtml}
                            </div>
                            <span class="setae-author-name">${data.author_name}</span>
                            <span class="meta-divider">/</span> <img draggable="false" role="img" class="emoji" alt="📅" src="/wp-content/plugins/setae-core/assets/images/emoji/1f4c5.svg"> ${data.date}
                        </div>
                        <div class="setae-topic-body">
                            ${data.content}
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

                    // ▼ 追加：コメント投稿者のバッジHTML
                    const cBadgesHtml = generateUserBadgesHtml(comment.author_is_premium, comment.author_bonus_slots);

                    commentsContainer.append(`
                        <div class="setae-comment-row">
                            <div class="setae-comment-meta">
                                <div class="setae-user-avatar" style="position:relative; display:inline-flex; align-items:center; justify-content:center;">
                                    ${cAvatarHtml}
                                    ${cBadgesHtml}
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
        openSpeciesDetail: openSpeciesDetail,
        generateUserBadgesHtml: generateUserBadgesHtml
    };

})(jQuery);
