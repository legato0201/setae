var SetaeUILogModal = (function ($) {
    'use strict';

    const DEFAULT_PREY_LIST = [
        'Fruit Fly (ショウジョウバエ)',
        'Cricket (コオロギ)',
        'Red Roach (レッドローチ)',
        'Dubia (デュビア)',
        'Pinky (ピンキー)'
    ];

    // モジュール内に追加: 画像プレビュー等のイベント設定
    function bindLogImageEvents() {
        // アップロードボタン -> ファイル選択発火
        $('#btn-trigger-upload').off('click').on('click', function () {
            $('#log-image').click();
        });

        // ファイル選択時 -> プレビュー表示
        $('#log-image').off('change').on('change', function (e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function (e) {
                    $('#preview-img-tag').attr('src', e.target.result);
                    $('#log-image-preview').show();

                    // ▼▼▼ 追加: アップロードボタンを隠し、Best Shotトグルを表示 ▼▼▼
                    $('#btn-trigger-upload').hide();
                    $('.setae-toggle-wrapper').css('display', 'flex');
                }
                reader.readAsDataURL(file);
            }
        });

        // 削除ボタン -> クリア
        $('#btn-remove-image').off('click').on('click', function () {
            $('#log-image').val('');
            $('#preview-img-tag').attr('src', '');
            $('#log-image-preview').hide();

            // ▼▼▼ 追加: アップロードボタンを表示し、Best Shotトグルを隠す（リセット） ▼▼▼
            $('#btn-trigger-upload').show();
            $('.setae-toggle-wrapper').hide();
            $('#log-best-shot').prop('checked', false);
        });
    }

    function openLogModal(eOrId = null, initialType = 'feed') {
        // eOrId could be event object or ID string/number
        let idToUse = null;
        if (eOrId && (typeof eOrId === 'string' || typeof eOrId === 'number')) {
            idToUse = eOrId;
        } else if (SetaeUIDetail && SetaeUIDetail.getCurrentSpiderId) {
            const val = $('#log-spider-id').val();
            if (val) idToUse = val;
        }

        // If still null, try to find from open detail section
        if (!idToUse && $('#section-my-detail').is(':visible')) {
            const text = $('#detail-spider-id-badge').text().replace('#', '');
            if (text) idToUse = text;
        }

        if (!idToUse) return;

        // ★追加: 現在の個体データを取得して分類判定
        const spider = SetaeCore.state.cachedSpiders ? SetaeCore.state.cachedSpiders.find(s => s.id == idToUse) : null;
        const cls = spider ? (spider.classification || 'tarantula') : 'tarantula';
        const isPlant = (cls === 'plant');

        // ★追加: ボタン・ラベルの書き換え
        const $modal = $('#setae-log-modal');
        const $btnFeed = $modal.find('button[data-val="feed"]');
        const $btnMolt = $modal.find('button[data-val="molt"]');

        if (isPlant) {
            // 植物モード
            $btnFeed.html('💧').attr('title', 'Water');
            $btnMolt.html('🪴').attr('title', 'Repot');
            $('#log-feed-options label').first().text('Watering Type (Option)');
        } else {
            // 通常モード
            $btnFeed.html('🦗').attr('title', 'Feed');
            $btnMolt.html('🧬').attr('title', 'Molt');
            $('#log-feed-options label').first().text('餌 (Prey)');
        }

        $('#setae-log-form')[0].reset();

        // 画像プレビューのリセット
        $('#log-image').val('');
        $('#log-image-preview').hide();
        $('#preview-img-tag').attr('src', '');

        // ▼▼▼ 追加: UIの初期状態セット（ボタン表示、トグル非表示） ▼▼▼
        $('#btn-trigger-upload').show();
        $('.setae-toggle-wrapper').hide();

        // イベントバインド (まだ行われていなければ)
        bindLogImageEvents();

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

        // [追加] ファイル入力を取得
        const fileInput = $('#log-image')[0];
        const file = (fileInput && fileInput.files.length > 0) ? fileInput.files[0] : null;

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

        // [追加] Best Shot フラグ
        if ($('#log-best-shot').is(':checked')) {
            dataPayload.is_best_shot = true;
        }

        // [変更] API呼び出しにfile引数を追加
        SetaeAPI.logEvent(id, type, date, dataPayload, file, () => {
            SetaeCore.showToast('記録を追加しました', 'success');
            $('#setae-log-modal').fadeOut();
            $('#setae-log-form')[0].reset();

            // [追加] 画像プレビューのリセット
            $('#log-image-preview').hide();
            $('#preview-img-tag').attr('src', '');
            $('#log-image').val('');

            // ▼▼▼ 追加: UI状態のリセット ▼▼▼
            $('#btn-trigger-upload').show();
            $('.setae-toggle-wrapper').hide();

            if (window.SetaeUIDetail) {
                if (SetaeUIDetail.loadSpiderLogs) {
                    SetaeUIDetail.loadSpiderLogs(id);
                }
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
            <div id="modal-edit-prey-list" class="setae-modal" style="display:none; z-index:100000;">
                <div class="setae-modal-content" style="max-width:400px;">
                    <span class="setae-close" onclick="$('#modal-edit-prey-list').fadeOut()">&times;</span>
                    <h3>Edit Prey List</h3>
                    <textarea id="edit-prey-textarea" class="setae-input" style="height:200px;"></textarea>
                    
                    <div style="margin-top:10px; display:flex; justify-content:space-between;">
                        <button class="setae-btn setae-btn-secondary" onclick="window.resetPreyListToDefault()" style="color:#666; border:1px solid #ccc;">
                            Default
                         </button>
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
