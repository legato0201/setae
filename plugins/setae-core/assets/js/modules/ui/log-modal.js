var SetaeUILogModal = (function ($) {
    'use strict';

    const DEFAULT_PREY_LIST = [
        'Fruit Fly (ショウジョウバエ)',
        'Cricket (コオロギ)',
        'Red Roach (レッドローチ)',
        'Dubia (デュビア)',
        'Pinky (ピンキー)'
    ];

    function openLogModal(eOrId = null, initialType = 'feed') {
        // eOrId could be event object or ID string/number
        let idToUse = null;
        if (eOrId && (typeof eOrId === 'string' || typeof eOrId === 'number')) {
            idToUse = eOrId;
        } else if (SetaeUIDetail && SetaeUIDetail.getCurrentSpiderId) {
            // Ideally getting current ID from state if available, 
            // but previously it relied on a module-level variable currentSpiderId.
            // We can check the hidden field if modal was opened before? 
            // Or we accept it must be passed.
            // For now let's grab it from the DOM if we are in detail view
            const val = $('#log-spider-id').val();
            if (val) idToUse = val;
        }

        // If still null, try to find from open detail section
        if (!idToUse && $('#section-my-detail').is(':visible')) {
            // This is a bit hacky, but robust enough for now given HTML structure
            const text = $('#detail-spider-id-badge').text().replace('#', '');
            if (text) idToUse = text;
        }

        if (!idToUse) return;

        $('#setae-log-form')[0].reset();
        $('#log-date').val(new Date().toISOString().split('T')[0]);
        $('#log-spider-id').val(idToUse);
        renderLogPreyButtons();
        $('#setae-log-modal').fadeIn();

        const typeToSelect = (typeof initialType === 'string') ? initialType : 'feed';
        $(`.log-type-btn[data-val="${typeToSelect}"], .type-btn-sm[data-val="${typeToSelect}"]`).trigger('click');
    }

    function renderLogPreyButtons() {
        const container = $('#log-feed-prey-buttons');
        container.empty();

        if (!SetaeCore.state.feedTypes || SetaeCore.state.feedTypes.length === 0) {
            SetaeCore.state.feedTypes = DEFAULT_PREY_LIST;
        }

        const types = SetaeCore.state.feedTypes;

        types.forEach(t => {
            container.append(`<button type="button" class="prey-btn" data-val="${t}">${t}</button>`);
        });

        $('.prey-btn').on('click', function () {
            const val = $(this).data('val');
            $('#log-feed-prey-select').val(val);
            $('.prey-btn').removeClass('active');
            $(this).addClass('active');
        });

        const currentVal = $('#log-feed-prey-select').val();
        if (currentVal) {
            $(`.prey-btn[data-val="${currentVal}"]`).addClass('active');
        } else {
            $('.prey-btn:first').trigger('click');
        }
    }

    function handleLogTypeClick() {
        $('.log-type-btn, .type-btn-sm').removeClass('active');
        $(this).addClass('active');

        const val = $(this).data('val');
        $('#log-type').val(val);

        $('.log-option-group').hide();

        if (val === 'feed') {
            $('#log-feed-options').show();
            $('.options-container').show();
        } else if (val === 'growth' || val === 'molt') {
            $('#log-growth-options').show();
            $('.options-container').show();
        } else {
            $('.options-container').hide();
        }
    }

    function handleLogSubmit(e) {
        e.preventDefault();
        const id = $('#log-spider-id').val();
        const type = $('#log-type').val();
        const date = $('#log-date').val();
        const note = $('#log-note').val();

        let dataPayload = {};
        if (type === 'feed') {
            const prey = $('#log-feed-prey-select').val();
            const refused = $('#log-feed-refused').is(':checked');
            if (!prey && !refused) {
                SetaeCore.showToast('餌の種類または拒食を選択してください', 'warning'); return;
            }
            dataPayload = { prey_type: prey, refused: refused };
        } else if (type === 'growth') {
            dataPayload = { size: $('#log-size').val() };
        }

        if (note && note.trim() !== '') {
            dataPayload.note = note;
        }

        SetaeAPI.logEvent(id, type, date, dataPayload, () => {
            SetaeCore.showToast('記録を追加しました', 'success');
            $('#setae-log-modal').fadeOut();
            $('#setae-log-form')[0].reset();

            if (window.SetaeUIDetail) {
                // ログ一覧（タイムライン）のみを更新
                if (SetaeUIDetail.loadSpiderLogs) {
                    SetaeUIDetail.loadSpiderLogs(id);
                }
                // 詳細画面全体のリロード（画像フェードインなど）を避けるため
                // ステータス更新が必要な場合は別途APIから取得して描画だけ更新するのが理想
                // SetaeUIDetail.loadSpiderDetail(id); 
            }
            if (window.SetaeUIList && SetaeUIList.renderMySpiders) {
                SetaeAPI.fetchMySpiders(SetaeUIList.renderMySpiders);
            }
        });
    }

    // ==========================================
    // Prey List Edit
    // ==========================================
    function renderEditPreyListModal() {
        if ($('#modal-edit-prey-list').length === 0) {
            $('body').append(`
            <div id="modal-edit-prey-list" class="setae-modal" style="display:none; z-index:10004;">
                <div class="setae-modal-content" style="max-width:400px;">
                    <span class="setae-close" onclick="$('#modal-edit-prey-list').fadeOut()">&times;</span>
                    <h3>Edit Prey List</h3>
                    <textarea id="edit-prey-textarea" class="setae-input" style="height:200px;"></textarea>
                    <div style="margin-top:10px; text-align:right;">
                         <button class="setae-btn setae-btn-primary" onclick="window.savePreyList()">Save</button>
                    </div>
                </div>
            </div>`);
        }

        const currentList = SetaeCore.state.feedTypes || DEFAULT_PREY_LIST;
        $('#edit-prey-textarea').val(currentList.join('\n'));
        $('#modal-edit-prey-list').fadeIn();
    }

    function savePreyList() {
        const text = $('#edit-prey-textarea').val();
        const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        if (lines.length === 0) { alert('リストを空にはできません'); return; }

        SetaeCore.state.feedTypes = lines;
        SetaeCore.showToast('リストを更新しました', 'success');
        $('#modal-edit-prey-list').fadeOut();
        renderLogPreyButtons();
    }

    function resetPreyListToDefault() {
        if (!confirm('初期リストに戻しますか？')) return;
        $('#edit-prey-textarea').val(DEFAULT_PREY_LIST.join('\n'));
    }

    // Context Menu Action (exposed but relies on SetaeUIActions or SetaeAPI)
    function handlePreySelect(id, prey) {
        $('.setae-context-menu').remove();
        // Call global handleQuickAction (from actions.js)
        if (window.handleQuickAction) {
            handleQuickAction(id, 'feed', { prey: prey });
        } else {
            console.error('handleQuickAction not found');
        }
    }

    // Expose select globals for inline onclick handlers if needed
    window.savePreyList = savePreyList;
    window.resetPreyListToDefault = resetPreyListToDefault;

    return {
        openLogModal: openLogModal,
        handleLogSubmit: handleLogSubmit,
        handleLogTypeClick: handleLogTypeClick,
        renderEditPreyListModal: renderEditPreyListModal,
        savePreyList: savePreyList,
        resetPreyListToDefault: resetPreyListToDefault,
        handlePreySelect: handlePreySelect
    };

})(jQuery);
