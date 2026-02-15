var SetaeUIBL = (function ($) {
    'use strict';

    // 状態管理用
    let currentCandidates = [];

    function init() {
        // Tab Switching
        $('#btn-bl-board').on('click', function () { switchView('board'); });
        $('#btn-bl-contracts').on('click', function () { switchView('contracts'); });

        // 初期ロード
        loadRecruits();
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
                renderGrid(response);
            },
            error: function () {
                container.html('<p class="error-msg">データの読み込みに失敗しました。</p>');
            }
        });
    }

    // ★修正: リスト描画ロジックの刷新
    function renderGrid(spiders) {
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

        let html = '';

        // 1. 自分の募集 (My Listings) - 折りたたみ機能付き
        if (mySpiders.length > 0) {
            html += `
                <div class="bl-section-header toggle-my-listings" data-target="#my-listings-wrapper">
                    <h4>
                        My Listings <span class="count-badge">${mySpiders.length}</span>
                    </h4>
                    <span class="header-hint">Show/Hide</span>
                </div>
                <div id="my-listings-wrapper" class="setae-grid my-listings-grid" style="display:none;">
                    ${mySpiders.map(s => createSpiderCard(s, true)).join('')}
                </div>
            `;
        }

        // 2. コミュニティの募集
        if (otherSpiders.length > 0) {
            html += `
                <div class="bl-section-header" style="${mySpiders.length > 0 ? 'margin-top:20px;' : ''}">
                    <h4>Community Listings <span class="count-badge">${otherSpiders.length}</span></h4>
                </div>
                <div class="setae-grid community-listings-grid">
                    ${otherSpiders.map(s => createSpiderCard(s, false)).join('')}
                </div>
            `;
        } else if (mySpiders.length > 0) {
            html += `<p class="empty-sub-msg">他のユーザーからの募集はまだありません。</p>`;
        }

        container.html(html);

        // イベントバインド
        bindCardEvents();
    }

    // ★追加: カードHTML生成ヘルパー
    function createSpiderCard(spider, isMine) {
        const gender = spider.gender || 'unknown';
        const bgImage = spider.image;

        let genderIcon = '<span class="gender-icon unknown">?</span>';
        if (gender === 'male') genderIcon = '<span class="gender-icon male">♂</span>';
        if (gender === 'female') genderIcon = '<span class="gender-icon female">♀</span>';

        return `
        <div class="setae-card bl-card gender-${gender} ${isMine ? 'is-mine' : ''}">
            <div class="bl-badge">Recruiting</div>
            <div class="bl-content">
                <div class="bl-img" style="background-image:url('${bgImage}')"></div>
                <div class="bl-info">
                    <div class="bl-species">${spider.species}</div>
                    <div class="bl-name">${spider.name} ${genderIcon}</div>
                    <div class="bl-meta">
                        ${isMine
                ? `<span class="meta-tag my-tag">Your Listing</span>`
                : `<span>Owner: ${spider.owner_name}</span>`
            }
                    </div>
                </div>
            </div>
            <div class="bl-actions">
                <button class="setae-btn-sm btn-glass btn-view-bl-detail" 
                    data-name="${spider.name}"
                    data-molt="${spider.last_molt || '-'}"
                    data-terms="${encodeURIComponent(spider.bl_terms || '')}">
                    詳細
                </button>
                ${!isMine ? `<button class="setae-btn-sm btn-primary btn-shine btn-request-loan" data-id="${spider.id}" data-name="${spider.name}">申請する</button>` : ''}
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
            const id = $(this).data('id');
            const name = $(this).data('name');
            openRequestModal(id, name); // 名前も渡す
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
    function openRequestModal(spiderId, spiderName) {
        // 既存削除
        $('#bl-request-modal').remove();

        const html = `
        <div class="setae-modal-overlay active" id="bl-request-modal">
            <div class="setae-modal-content request-modal">
                <div class="modal-header">
                    <h3>Request Breeding Loan</h3>
                    <button class="btn-close-modal">×</button>
                </div>
                <div class="modal-body">
                    <div class="request-target-info">
                        <span class="label">Applying for:</span>
                        <strong class="target-name">${spiderName}</strong>
                    </div>
                    <div class="form-group" style="margin-top:15px;">
                        <label style="display:block; font-size:12px; font-weight:bold; color:#666; margin-bottom:5px;">Message to Owner</label>
                        <textarea id="request-message" class="setae-input" rows="5" placeholder="飼育環境、経験、条件への同意などを記入してください..."></textarea>
                    </div>
                </div>
                <div class="modal-footer" style="padding-top:15px; text-align:right; border-top:1px solid #eee;">
                    <button class="setae-btn-sm btn-secondary btn-close-modal" style="margin-right:10px;">Cancel</button>
                    <button id="btn-submit-request" class="setae-btn-sm btn-primary btn-shine">Send Request</button>
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
                SetaeCore.showToast('メッセージを入力してください。', 'error'); // alertから変更
                return;
            }
            // 送信処理実行
            sendRequest(spiderId, message);
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

        let html = '';

        // 1. 受信リクエスト (Incoming)
        if (incoming.length > 0) {
            html += `
                <div class="bl-section-header">
                    <h4>Requests Received <span class="count-badge">${incoming.length}</span></h4>
                    <span class="header-hint" style="background:none; color:#999; font-weight:normal;">Action Required</span>
                </div>
                <div class="setae-grid" style="margin-bottom: 30px;">
                    ${incoming.map(c => createContractCard(c, true)).join('')}
                </div>
            `;
        }

        // 2. 送信リクエスト (Outgoing)
        if (outgoing.length > 0) {
            html += `
                <div class="bl-section-header">
                    <h4>Requests Sent <span class="count-badge">${outgoing.length}</span></h4>
                    <span class="header-hint" style="background:none; color:#999; font-weight:normal;">Waiting</span>
                </div>
                <div class="setae-grid">
                    ${outgoing.map(c => createContractCard(c, false)).join('')}
                </div>
            `;
        }

        container.html(html);

        // イベントバインド
        bindContractEvents();
    }

    function createContractCard(c, isOwner) {
        let actions = '';

        // ステータスに応じたアクションボタン
        if (isOwner && c.status === 'REQUESTED') {
            actions = `
                <button class="setae-btn-sm btn-primary btn-bl-action" data-id="${c.id}" data-action="APPROVED">承認</button>
                <button class="setae-btn-sm btn-danger btn-bl-action" data-id="${c.id}" data-action="REJECTED">拒否</button>
            `;
        } else if (c.status === 'APPROVED') {
            actions = `<button class="setae-btn-sm btn-glass btn-bl-action" data-id="${c.id}" data-action="PAIRED">ペアリング開始</button>`;
        } else if (c.status === 'PAIRED') {
            actions = `
                <button class="setae-btn-sm btn-primary btn-bl-action" data-id="${c.id}" data-action="SUCCESS">成功</button>
                <button class="setae-btn-sm btn-danger btn-bl-action" data-id="${c.id}" data-action="FAIL">失敗</button>
            `;
        }

        // チャットボタン
        const chatBtn = `
            <button class="setae-btn-sm btn-glass btn-open-chat" data-id="${c.id}" data-spider="${c.spider_name}">
                💬 Message
            </button>
        `;

        // ステータス表示名の整形
        const statusLabel = c.display_status || c.status;
        const dateStr = c.created_at.substring(0, 10).replace(/-/g, '/');

        return `
        <div class="setae-card contract-card">
            <div class="contract-header">
                <span class="contract-status badge-${c.status}">${statusLabel}</span>
                <span class="contract-date">${dateStr}</span>
            </div>
            <div class="contract-body">
                <div class="c-thumb" style="background-image:url('${c.spider_image}')"></div>
                <div class="c-details">
                    <strong>${c.spider_name}</strong>
                    <div class="c-meta">
                        ${isOwner ? `From: ${c.breeder_name}` : `Owner: ${c.owner_name}`}
                    </div>
                    <div class="c-message">"${c.message}"</div>
                </div>
            </div>
            <div class="contract-actions">
                ${chatBtn}
                <div style="display:flex; gap:6px;">${actions}</div>
            </div>
        </div>`;
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

    // ▼▼▼ 追加: チャット機能の実装 ▼▼▼

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
                    <button id="btn-send-chat" class="btn-send">➤</button>
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
            html += `
            <div class="chat-bubble-row ${type}">
                ${!m.is_mine ? `<div class="chat-avatar" style="background-image:url('${m.avatar}')"></div>` : ''}
                <div class="chat-content">
                    <div class="chat-bubble ${type}">
                        ${m.message.replace(/\n/g, '<br>')}
                    </div>
                    <div class="chat-meta">${m.date}</div>
                </div>
            </div>`;
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

    return {
        init: init,
        loadRecruits: loadRecruits
    };

})(jQuery);
