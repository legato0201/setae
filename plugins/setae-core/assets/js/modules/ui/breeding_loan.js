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

    function renderGrid(spiders) {
        const container = $('#setae-bl-grid');
        container.empty();

        if (!spiders || spiders.length === 0) {
            container.html('<p class="empty-msg">現在、BL募集中 (Recruiting) の個体はいません。</p>');
            return;
        }

        spiders.forEach(spider => {
            const gender = spider.gender || 'unknown';
            const isMine = (String(spider.owner_id) === String(SetaeCore.state.currentUserId));

            // ★修正: APIから来た画像を確実に使用
            const bgImage = spider.image;

            // 性別アイコン
            let genderIcon = '<span class="gender-icon unknown">?</span>';
            if (gender === 'male') genderIcon = '<span class="gender-icon male">♂</span>';
            if (gender === 'female') genderIcon = '<span class="gender-icon female">♀</span>';

            const card = `
            <div class="setae-card bl-card gender-${gender}">
                <div class="bl-badge">Recruiting</div>
                <div class="bl-content">
                    <div class="bl-img" style="background-image:url('${bgImage}')"></div>
                    <div class="bl-info">
                        <div class="bl-species">${spider.species}</div>
                        <div class="bl-name">
                            ${spider.name} ${genderIcon}
                        </div>
                        <div class="bl-meta">
                            <span>Owner: ${spider.owner_name}</span>
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
                    ${!isMine ? `<button class="setae-btn-sm btn-primary btn-shine btn-request-loan" data-id="${spider.id}">申請する</button>` : ''}
                </div>
            </div>
            `;
            container.append(card);
        });

        // Event: 詳細ボタン (モーダルを開く)
        $('.btn-view-bl-detail').on('click', function () {
            const data = {
                name: $(this).data('name'),
                molt: $(this).data('molt'),
                terms: decodeURIComponent($(this).data('terms'))
            };
            openBLDetailModal(data);
        });

        // Event: 申請ボタン
        $('.btn-request-loan').on('click', function () {
            const id = $(this).data('id');
            openRequestModal(id);
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

    // --- 申請モーダル (簡易実装) ---

    function openRequestModal(spiderId) {
        // ※ 本来は汎用モーダルを使うべきですが、簡易的にpromptを使用、または専用DOMを生成
        const message = prompt("ブリーダーへのメッセージを入力してください（飼育環境や経験など）:", "BL希望です。よろしくお願いします。");
        if (message !== null && message.trim() !== "") {
            sendRequest(spiderId, message);
        }
    }

    function sendRequest(spiderId, message) {
        $.ajax({
            url: SetaeSettings.api_root + 'setae/v1/contracts',
            method: 'POST',
            beforeSend: function (xhr) { xhr.setRequestHeader('X-WP-Nonce', SetaeSettings.nonce); },
            data: { spider_id: spiderId, message: message },
            success: function () {
                alert("申請を送信しました。");
                switchView('contracts'); // 契約画面へ遷移
            },
            error: function (xhr) {
                alert("エラー: " + (xhr.responseJSON?.message || "申請できませんでした"));
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
            container.html('<p class="empty-msg">現在、進行中のBL契約はありません。</p>');
            return;
        }

        // セクション分け: 受信リクエスト (Action Required) / 送信済み (Waiting)
        const incoming = contracts.filter(c => c.is_owner);
        const outgoing = contracts.filter(c => !c.is_owner);

        let html = '';

        // 1. あなたへの依頼 (Incoming)
        if (incoming.length > 0) {
            html += `<h4>受信リクエスト (あなたの個体への応募)</h4>`;
            incoming.forEach(c => html += createContractCard(c, true));
        }

        // 2. あなたからの依頼 (Outgoing)
        if (outgoing.length > 0) {
            html += `<h4 style="margin-top:20px;">送信リクエスト (あなたが応募)</h4>`;
            outgoing.forEach(c => html += createContractCard(c, false));
        }

        container.html(html);

        // Events for Actions
        $('.btn-bl-action').on('click', function () {
            const id = $(this).data('id');
            const action = $(this).data('action');
            updateContractStatus(id, action);
        });
    }

    function createContractCard(c, isOwner) {
        let actions = '';

        // オーナー側のアクション: 申請が来たら「承認」「拒否」
        if (isOwner && c.status === 'REQUESTED') {
            actions = `
                <button class="setae-btn-sm btn-primary btn-bl-action" data-id="${c.id}" data-action="APPROVED">承認</button>
                <button class="setae-btn-sm btn-danger btn-bl-action" data-id="${c.id}" data-action="REJECTED">拒否</button>
            `;
        }
        // 成立後のステータス変更（例: ブリーダーが受け取ったら「ペアリング開始」など）
        else if (c.status === 'APPROVED') {
            // どちらか一方が進行ステータスを押せると仮定、あるいはオーナーが「発送済」にするなど
            // ここではシンプルに「進行中(PAIRED)にする」ボタンを置く
            actions = `<button class="setae-btn-sm btn-bl-action" data-id="${c.id}" data-action="PAIRED">ペアリング開始を報告</button>`;
        }
        else if (c.status === 'PAIRED') {
            actions = `
                <button class="setae-btn-sm btn-primary btn-bl-action" data-id="${c.id}" data-action="SUCCESS">成功報告</button>
                <button class="setae-btn-sm btn-danger btn-bl-action" data-id="${c.id}" data-action="FAIL">失敗報告</button>
            `;
        }

        return `
        <div class="setae-card contract-card status-${c.status.toLowerCase()}">
            <div class="contract-header">
                <span class="contract-status badge-${c.status}">${c.display_status || c.status}</span>
                <span class="contract-date">${c.created_at.substring(0, 10)}</span>
            </div>
            <div class="contract-body">
                <div class="c-thumb" style="background-image:url('${c.spider_image}')"></div>
                <div class="c-details">
                    <strong>${c.spider_name}</strong>
                    <div class="c-meta">
                        ${isOwner ? `Applicant: ${c.breeder_name}` : `Owner: ${c.owner_name}`}
                    </div>
                    <div class="c-message">"${c.message}"</div>
                </div>
            </div>
            <div class="contract-actions">
                ${actions}
            </div>
        </div>`;
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

    return {
        init: init,
        loadRecruits: loadRecruits
    };

})(jQuery);
