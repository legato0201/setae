var SetaeUIBL = (function ($) {
    'use strict';

    // ▼ 変更箇所: wp.i18n.__ の代わりに、PHPから渡される SetaeBL_i18n を参照する関数を定義
    const __ = function (text) {
        return (typeof SetaeBL_i18n !== 'undefined' && SetaeBL_i18n[text]) ? SetaeBL_i18n[text] : text;
    };

    // 状態管理用
    let currentCandidates = [];

    function init() {
        // Tab Switching
        $('#btn-bl-board').on('click', function () { switchView('board'); });
        $('#btn-bl-contracts').on('click', function () { switchView('contracts'); });

        // 初期ロード
        loadRecruits();

        // ▼ 追加: 未読チェック
        checkUnreadBadge();
    }

    function switchView(view) {
        $('.setae-toolbar button').removeClass('active');
        if (view === 'board') {
            $('#btn-bl-board').addClass('active');
            $('#bl-board-view').show();
            $('#bl-contracts-view').hide();
            loadRecruits();
        } else {
            $('#btn-bl-contracts').addClass('active');
            $('#bl-board-view').hide();
            $('#bl-contracts-view').show();
            loadContracts();
        }
    }

    // --- 募集一覧 (Recruits) ---

    function loadRecruits() {
        const container = $('#setae-bl-grid');
        container.html('<div class="setae-loading">Loading...</div>');

        $.ajax({
            url: SetaeSettings.api_root + 'setae/v1/bl-candidates',
            method: 'GET',
            beforeSend: function (xhr) { xhr.setRequestHeader('X-WP-Nonce', SetaeSettings.nonce); },
            success: function (response) {
                currentCandidates = response;
                // ▼ 変更: グリッドではなくリスト描画関数を呼ぶ
                renderRecruitsList(response);
            },
            error: function () {
                container.html('<p class="error-msg">データの読み込みに失敗しました。</p>');
            }
        });
    }

    // ★修正: リスト表示 + タブ切り替えロジック
    function renderRecruitsList(spiders) {
        const container = $('#setae-bl-grid');
        container.empty();

        if (!spiders || spiders.length === 0) {
            container.html('<div class="empty-state"><p>現在、BL募集中 (Recruiting) の個体はいません。</p></div>');
            return;
        }

        // データを分類
        const currentUserId = String(SetaeCore.state.currentUserId);
        const mySpiders = spiders.filter(s => String(s.owner_id) === currentUserId);
        const otherSpiders = spiders.filter(s => String(s.owner_id) !== currentUserId);

        // 1. タブナビゲーション
        const tabsHtml = `
            <div class="setae-segment-nav">
                <button class="segment-btn active" data-target="tab-community-list">
                    ${__('Community Listings', 'setae-core')} <span class="count-badge-inline">${otherSpiders.length}</span>
                </button>
                <button class="segment-btn" data-target="tab-mylistings-list">
                    ${__('My Listings', 'setae-core')} <span class="count-badge-inline">${mySpiders.length}</span>
                </button>
            </div>
        `;

        // 2. リストコンテナ
        const contentHtml = `
            <div id="tab-community-list" class="bl-tab-pane active">
                <div class="setae-list-header">
                    <span class="col-status">${__('Status', 'setae-core')}</span>
                    <span class="col-main">${__('Details', 'setae-core')}</span>
                    <span class="col-actions">${__('Actions', 'setae-core')}</span>
                </div>
                <div class="setae-list-group">
                    ${otherSpiders.length > 0
                ? otherSpiders.map(s => createRecruitRow(s, false)).join('')
                : '<div class="empty-tab-msg">募集中の個体はありません</div>'}
                </div>
            </div>
            
            <div id="tab-mylistings-list" class="bl-tab-pane" style="display:none;">
                <div class="setae-list-header">
                    <span class="col-status">${__('Status', 'setae-core')}</span>
                    <span class="col-main">${__('Details', 'setae-core')}</span>
                    <span class="col-actions">${__('Actions', 'setae-core')}</span>
                </div>
                <div class="setae-list-group">
                    ${mySpiders.length > 0
                ? mySpiders.map(s => createRecruitRow(s, true)).join('')
                : '<div class="empty-tab-msg">あなたの募集はありません</div>'}
                </div>
            </div>
        `;

        container.html(tabsHtml + contentHtml);

        // タブイベント (既存のContractsと競合しないよう、ID指定で制御)
        $('#setae-bl-grid .segment-btn').on('click', function () {
            $(this).siblings().removeClass('active');
            $(this).addClass('active');
            const target = $(this).data('target');
            $('#setae-bl-grid .bl-tab-pane').hide();
            $('#' + target).fadeIn(200);
        });

        bindCardEvents();
    }

    // ★修正: リスト行のHTML生成
    function createRecruitRow(spider, isMine) {
        const gender = spider.gender || 'unknown';
        const bgImage = spider.image || SetaeSettings.plugin_url + 'assets/images/default-spider.png';

        // 条件文言 (長い場合は省略)
        let terms = spider.bl_terms ? spider.bl_terms : '条件の記載なし';
        if (terms.length > 30) terms = terms.substring(0, 30) + '...';

        let genderIcon = '?';
        if (gender === 'male') genderIcon = '♂';
        if (gender === 'female') genderIcon = '♀';

        // アクションボタン
        let actionBtn = '';
        if (!isMine) {
            actionBtn = `
                <button class="setae-btn-xs btn-primary btn-request-loan" 
                    data-id="${spider.id}" 
                    data-name="${spider.name}"
                    data-species="${spider.species}"
                    data-image="${bgImage}"
                    data-owner="${spider.owner_name}">
                    🚀 申請
                </button>
            `;
        } else {
            actionBtn = `<span class="badge-mine">${__('Your Listing', 'setae-core')}</span>`;
        }

        const dateStr = 'ID: ' + spider.id;

        return `
        <div class="setae-list-item status-RECRUITING">
            <div class="list-col-status">
                <span class="status-dot status-RECRUITING"></span>
                <span class="status-text">募集中</span>
                <span class="list-date">${dateStr}</span>
            </div>
            
            <div class="list-col-main">
                <div class="list-thumb" style="background-image:url('${bgImage}')"></div>
                <div class="list-info">
                    <div class="list-title">${spider.name} <span class="gender-mark ${gender}">${genderIcon}</span></div>
                    <div class="list-meta">${spider.species} <span class="divider">|</span> Owner: ${spider.owner_name}</div>
                    <div class="list-msg">${terms}</div>
                </div>
            </div>

            <div class="list-col-actions">
                ${actionBtn}
                <button class="setae-btn-xs btn-icon btn-view-bl-detail" 
                    data-name="${spider.name}" 
                    data-molt="${spider.last_molt_date || '-'}" 
                    data-terms="${encodeURIComponent(spider.bl_terms || '')}">
                    <span class="icon">ℹ️</span>
                </button>
            </div>
        </div>
        `;
    }

    // イベントバインドの分離
    function bindCardEvents() {
        // セクション開閉 (My Listings)
        $('.toggle-my-listings').off('click').on('click', function () {
            const target = $(this).data('target');
            $(target).slideToggle(200);
            $(this).find('.toggle-icon').toggleClass('open');
        });

        // 詳細ボタン
        $('.btn-view-bl-detail').off('click').on('click', function () {
            const data = {
                name: $(this).data('name'),
                molt: $(this).data('molt'),
                terms: decodeURIComponent($(this).data('terms'))
            };
            openBLDetailModal(data);
        });

        // 申請ボタン (修正)
        $('.btn-request-loan').off('click').on('click', function () {
            const data = {
                id: $(this).data('id'),
                name: $(this).data('name'),
                species: $(this).data('species'),
                image: $(this).data('image'),
                owner: $(this).data('owner')
            };
            openRequestModal(data); // オブジェクトごと渡す
        });
    }

    // ★追加: BL詳細モーダル
    function openBLDetailModal(data) {
        const modalHtml = `
        <div class="setae-modal-overlay active" id="bl-detail-modal">
            <div class="setae-modal-content sm-modal">
                <div class="modal-header">
                    <h3>${data.name}</h3>
                    <button class="btn-close-modal">×</button>
                </div>
                <div class="modal-body">
                    <div class="bl-detail-row">
                        <label>Last Molt (最終脱皮日)</label>
                        <div class="detail-value highlight">${data.molt}</div>
                    </div>
                    <div class="bl-detail-row">
                        <label>Terms & Conditions (条件)</label>
                        <div class="detail-value text-block">${data.terms}</div>
                    </div>
                </div>
            </div>
        </div>
        `;

        $('body').append(modalHtml);

        // 閉じる処理
        $('#bl-detail-modal .btn-close-modal, #bl-detail-modal').on('click', function (e) {
            if (e.target === this || $(e.target).hasClass('btn-close-modal')) {
                $('#bl-detail-modal').remove();
            }
        });
    }

    // --- 申請モーダル (Pro仕様) ---

    // ★修正: リッチな申請モーダル (デザイン刷新)
    function openRequestModal(data) {
        // 既存削除
        $('#bl-request-modal').remove();

        // 画像がない場合のフォールバック
        const bgImage = data.image || SetaeSettings.plugin_url + 'assets/images/default-spider.png';

        const html = `
        <div class="setae-modal-overlay active" id="bl-request-modal">
            <div class="setae-modal-content request-modal">
                <div class="modal-header">
                    <h3>Request Breeding Loan</h3>
                    <button class="btn-close-modal">×</button>
                </div>
                <div class="modal-body">
                    <div class="request-target-wrapper">
                        <div class="req-thumb" style="background-image:url('${bgImage}')"></div>
                        <div class="req-info">
                            <span class="req-label">Applying For</span>
                            <span class="req-name">${data.name}</span>
                            <span class="req-species">${data.species}</span>
                            <div class="req-owner">
                                <span class="owner-icon">👤</span> ${data.owner}
                            </div>
                        </div>
                    </div>

                    <div class="form-group">
                        <label class="request-form-label">Message to Owner</label>
                        <textarea id="request-message" rows="5" placeholder="飼育環境、経験、条件への同意などを記入してください...&#10;例: 経験3年あり、条件確認しました。ぜひお願いします。"></textarea>
                    </div>
                </div>
                <div class="modal-footer-actions">
                    <button class="btn-cancel btn-close-modal">${__('Cancel', 'setae-core')}</button>
                    <button id="btn-submit-request" class="btn-submit-req">${__('Send Request', 'setae-core')}</button>
                </div>
            </div>
        </div>
        `;

        $('body').append(html);

        // Events
        const $modal = $('#bl-request-modal');

        $modal.find('.btn-close-modal').on('click', function () {
            $modal.remove();
        });

        $modal.find('#btn-submit-request').on('click', function () {
            const message = $('#request-message').val();
            if (!message.trim()) {
                SetaeCore.showToast('メッセージを入力してください。', 'error');
                return;
            }
            // 送信処理実行 (data.id を使用)
            sendRequest(data.id, message);
            $modal.remove();
        });
    }

    // ★修正: 送信完了時にToast通知を使用
    function sendRequest(spiderId, message) {
        $.ajax({
            url: SetaeSettings.api_root + 'setae/v1/contracts',
            method: 'POST',
            beforeSend: function (xhr) { xhr.setRequestHeader('X-WP-Nonce', SetaeSettings.nonce); },
            data: { spider_id: spiderId, message: message },
            success: function () {
                // alert("申請を送信しました。"); // 削除
                SetaeCore.showToast("申請を送信しました。", "success"); // Toastに変更
                switchView('contracts'); // 契約画面へ遷移
            },
            error: function (xhr) {
                // alert("エラー: " + ...); // 削除
                const msg = xhr.responseJSON?.message || "申請できませんでした";
                SetaeCore.showToast("エラー: " + msg, "error"); // Toastに変更
            }
        });
    }

    // --- 契約管理 (Contracts) ---

    function loadContracts() {
        const container = $('#setae-contracts-list');
        container.html('<div class="setae-loading">Loading contracts...</div>');

        $.ajax({
            url: SetaeSettings.api_root + 'setae/v1/contracts',
            method: 'GET',
            beforeSend: function (xhr) { xhr.setRequestHeader('X-WP-Nonce', SetaeSettings.nonce); },
            success: function (response) {
                renderContracts(response);
            },
            error: function () {
                container.html('<p class="error-msg">契約情報の取得に失敗しました。</p>');
            }
        });
    }

    // ★修正: タブ切り替え + リスト表示への変更
    function renderContracts(contracts) {
        const container = $('#setae-contracts-list');
        container.empty();

        if (!contracts || contracts.length === 0) {
            container.html('<div class="empty-state"><p>現在、進行中のBL契約はありません。</p></div>');
            return;
        }

        // 分類
        const incoming = contracts.filter(c => c.is_owner); // 自分に来た依頼
        const outgoing = contracts.filter(c => !c.is_owner); // 自分が出した依頼

        // 1. タブナビゲーション
        const tabsHtml = `
            <div class="setae-segment-nav">
                <button class="segment-btn active" data-target="tab-incoming">
                    ${__('Requests Received', 'setae-core')} <span class="count-badge-inline">${incoming.length}</span>
                </button>
                <button class="segment-btn" data-target="tab-outgoing">
                    ${__('Requests Sent', 'setae-core')} <span class="count-badge-inline">${outgoing.length}</span>
                </button>
            </div>
        `;

        // 2. リストコンテナ (Incoming / Outgoing)
        const contentHtml = `
            <div id="tab-incoming" class="bl-tab-pane active">
                <div class="setae-list-header">
                    <span class="col-status">Status</span>
                    <span class="col-main">Details</span>
                    <span class="col-actions">Actions</span>
                </div>
                <div class="setae-list-group">
                    ${incoming.length > 0
                ? incoming.map(c => createContractRow(c, true)).join('')
                : '<div class="empty-tab-msg">受信したリクエストはありません</div>'}
                </div>
            </div>
            
            <div id="tab-outgoing" class="bl-tab-pane" style="display:none;">
                <div class="setae-list-header">
                    <span class="col-status">Status</span>
                    <span class="col-main">Details</span>
                    <span class="col-actions">Actions</span>
                </div>
                <div class="setae-list-group">
                    ${outgoing.length > 0
                ? outgoing.map(c => createContractRow(c, false)).join('')
                : '<div class="empty-tab-msg">送信したリクエストはありません</div>'}
                </div>
            </div>
        `;

        container.html(tabsHtml + contentHtml);

        // タブ切り替えイベント
        $('.segment-btn').on('click', function () {
            $('.segment-btn').removeClass('active');
            $(this).addClass('active');
            $('.bl-tab-pane').hide();
            $('#' + $(this).data('target')).fadeIn(200);
        });

        // ボタン等のイベントバインド
        bindContractEvents();
    }

    // ★修正: カードではなく「行（Row）」を生成
    function createContractRow(c, isOwner) {
        let actions = '';

        // アクションボタン生成（ロジックは以前と同じ）
        if (isOwner && c.status === 'REQUESTED') {
            actions = `
                <button class="setae-btn-xs btn-primary btn-bl-action" data-id="${c.id}" data-action="APPROVED">承認</button>
                <button class="setae-btn-xs btn-danger btn-bl-action" data-id="${c.id}" data-action="REJECTED">拒否</button>
            `;
        } else if (c.status === 'APPROVED') {
            actions = `<button class="setae-btn-xs btn-glass btn-bl-action" data-id="${c.id}" data-action="PAIRED">ペアリング開始</button>`;
        } else if (c.status === 'PAIRED') {
            actions = `
                <button class="setae-btn-xs btn-primary btn-bl-action" data-id="${c.id}" data-action="SUCCESS">成功</button>
                <button class="setae-btn-xs btn-danger btn-bl-action" data-id="${c.id}" data-action="FAIL">失敗</button>
            `;
        }

        // 未読バッジ
        let badgeHtml = '';
        if (c.unread_count && c.unread_count > 0) {
            badgeHtml = `<span class="bl-chat-badge">${c.unread_count}</span>`;
        }

        // チャットボタン
        const chatBtn = `
            <button class="setae-btn-xs btn-icon btn-open-chat" data-id="${c.id}" data-spider="${c.spider_name}" style="position: relative;">
                <span class="icon">💬</span>
                ${badgeHtml}
            </button>
        `;

        // 日付・ステータス
        const dateStr = c.created_at.substring(5, 10).replace('-', '/');
        const statusLabel = c.display_status || c.status;

        // 相手の名前
        const partnerLabel = isOwner ? 'From: ' + c.breeder_name : 'Owner: ' + c.owner_name;

        // 最新メッセージ（長い場合は省略）
        let msgSnippet = c.message || '';
        if (msgSnippet.length > 20) msgSnippet = msgSnippet.substring(0, 20) + '...';

        return `
        <div class="setae-list-item status-${c.status}">
            <div class="list-col-status">
                <span class="status-dot status-${c.status}"></span>
                <span class="status-text">${statusLabel}</span>
                <span class="list-date">${dateStr}</span>
            </div>
            
            <div class="list-col-main">
                <div class="list-thumb" style="background-image:url('${c.spider_image}')"></div>
                <div class="list-info">
                    <div class="list-title">${c.spider_name}</div>
                    <div class="list-meta">${partnerLabel}</div>
                    <div class="list-msg">${msgSnippet}</div>
                </div>
            </div>

            <div class="list-col-actions">
                ${actions}
                ${chatBtn}
            </div>
        </div>
        `;
    }

    function bindContractEvents() {
        $('.btn-bl-action').off('click').on('click', function () {
            const id = $(this).data('id');
            const action = $(this).data('action');
            updateContractStatus(id, action);
        });

        $('.btn-open-chat').off('click').on('click', function () {
            const id = $(this).data('id');
            const title = $(this).data('spider');
            openChatModal(id, title);
        });
    }

    function updateContractStatus(id, status) {
        if (!confirm('ステータスを更新しますか？')) return;

        $.ajax({
            url: SetaeSettings.api_root + `setae/v1/contracts/${id}/status`,
            method: 'POST',
            beforeSend: function (xhr) { xhr.setRequestHeader('X-WP-Nonce', SetaeSettings.nonce); },
            data: { status: status },
            success: function () {
                loadContracts(); // リロード
            },
            error: function () {
                alert('更新に失敗しました。');
            }
        });
    }

    // ▼▼▼ チャットモーダル（SVGアイコン対応版） ▼▼▼

    function openChatModal(contractId, title) {
        // モーダルHTML
        const html = `
        <div class="setae-modal-overlay active" id="bl-chat-modal">
            <div class="setae-modal-content chat-modal">
                <div class="chat-header">
                    <h3>${title} <small>Messaging</small></h3>
                    <button class="btn-close-modal">×</button>
                </div>
                <div class="chat-body" id="chat-messages-area">
                    <div class="setae-loading">Loading messages...</div>
                </div>
                <div class="chat-footer">
                    <textarea id="chat-input" placeholder="メッセージを入力... (発送先、日程など)"></textarea>
                    <button id="btn-send-chat" class="btn-send">
                        <svg viewBox="0 0 24 24">
                            <line x1="22" y1="2" x2="11" y2="13"></line>
                            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                        </svg>
                    </button>
                </div>
            </div>
        </div>`;

        $('body').append(html);
        loadChatMessages(contractId);

        // イベント
        const $modal = $('#bl-chat-modal');
        $modal.find('.btn-close-modal').on('click', () => $modal.remove());

        // 送信
        $modal.find('#btn-send-chat').on('click', () => sendChatMessage(contractId));
    }

    function loadChatMessages(contractId) {
        $.ajax({
            url: SetaeSettings.api_root + `setae/v1/contracts/${contractId}/messages`,
            method: 'GET',
            beforeSend: function (xhr) { xhr.setRequestHeader('X-WP-Nonce', SetaeSettings.nonce); },
            success: function (response) {
                renderChatMessages(response);

                // 1. ナビゲーションバーの全体バッジを更新
                checkUnreadBadge();

                // 2. ▼ 追加: 個別のMessageボタン上のバッジを消す
                const $btn = $(`.btn-open-chat[data-id="${contractId}"]`);
                $btn.find('.bl-chat-badge').fadeOut(200, function () {
                    $(this).remove();
                });
            }
        });
    }

    function renderChatMessages(messages) {
        const $area = $('#chat-messages-area');
        $area.empty();

        if (messages.length === 0) {
            $area.html('<div class="chat-empty">まだメッセージはありません。<br>挨拶や発送の相談を始めましょう。</div>');
            return;
        }

        let html = '';
        messages.forEach(m => {
            const type = m.is_mine ? 'mine' : 'partner';
            html += `<div class="chat-bubble-row ${type}">${!m.is_mine ? `<div class="chat-avatar" style="background-image:url('${m.avatar}')"></div>` : ''}<div class="chat-content"><div class="chat-bubble ${type}">${m.message}</div><div class="chat-meta">${m.date}</div></div></div>`;
        });

        $area.html(html);
        // 最下部へスクロール
        $area.scrollTop($area[0].scrollHeight);
    }

    function sendChatMessage(contractId) {
        const $input = $('#chat-input');
        const msg = $input.val().trim();
        if (!msg) return;

        // 送信中は無効化
        $('#btn-send-chat').prop('disabled', true);

        $.ajax({
            url: SetaeSettings.api_root + `setae/v1/contracts/${contractId}/messages`,
            method: 'POST',
            beforeSend: function (xhr) { xhr.setRequestHeader('X-WP-Nonce', SetaeSettings.nonce); },
            data: { message: msg },
            success: function () {
                $input.val(''); // クリア
                loadChatMessages(contractId); // リロード
            },
            complete: function () {
                $('#btn-send-chat').prop('disabled', false);
            }
        });
    }

    // ▼ 追加: バッジ更新関数
    function checkUnreadBadge() {
        $.ajax({
            url: SetaeSettings.api_root + 'setae/v1/bl/unread-count',
            method: 'GET',
            beforeSend: function (xhr) { xhr.setRequestHeader('X-WP-Nonce', SetaeSettings.nonce); },
            success: function (response) {
                const count = response.unread_count;
                const $badge = $('.setae-nav-item[data-target="section-bl"] .setae-badge-count');

                if (count > 0) {
                    $badge.text(count > 99 ? '99+' : count).fadeIn(200);
                } else {
                    $badge.fadeOut(200);
                }
            }
        });
    }

    return {
        init: init,
        loadRecruits: loadRecruits
    };

})(jQuery);
