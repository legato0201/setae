var SetaeUIAddSpider = (function ($) {
    'use strict';

    function init() {
        // モーダルを開く
        $(document).on('click', '#btn-add-spider', function () {
            $('#modal-add-spider').fadeIn(200);
            // 本日の日付をデフォルトセット
            const today = new Date().toISOString().split('T')[0];
            $('#spider-last-feed, #spider-last-molt').val('');

            // リセット
            $('#form-add-spider')[0].reset();
            $('#spider-species-select').val('');
            $('#preview-img-tag-add').attr('src', '');
            $('#spider-image-preview').hide();
            $('#btn-trigger-upload-add').show();
            $('#spider-species-suggestions').hide();

            if (typeof SetaeTutorial !== 'undefined') {
                SetaeTutorial.initAddSpider();
            }
        });

        // モーダルを閉じる (共通クラスで処理される場合もあるが、念のため)
        $(document).on('click', '#modal-add-spider .setae-close', function () {
            $('#modal-add-spider').fadeOut(200);
        });

        // ▼ 追加: カテゴリー切り替えロジック
        $(document).on('change', 'input[name="classification"]', function () {
            // スタイルの切り替え
            $('.radio-chip').removeClass('active');
            $(this).closest('.radio-chip').addClass('active');

            const val = $(this).val();

            if (val === 'tarantula') {
                // タランチュラ: DB検索モード
                $('#wrapper-species-search').show();
                $('#spider-custom-species').hide();
                $('#spider-species-search').prop('required', true);
                $('#spider-custom-species').prop('required', false);
            } else {
                // その他: 自由入力モード
                $('#wrapper-species-search').hide();
                $('#spider-custom-species').show();
                $('#spider-species-search').prop('required', false);
                $('#spider-custom-species').prop('required', true);
            }
        });

        // 写真選択のトリガー
        $(document).on('click', '#btn-trigger-upload-add', function () {
            $('#spider-image').click();
        });

        // 写真プレビュー表示
        $(document).on('change', '#spider-image', function (e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function (re) {
                    $('#preview-img-tag-add').attr('src', re.target.result);
                    $('#spider-image-preview').show();
                    $('#btn-trigger-upload-add').hide();
                };
                reader.readAsDataURL(file);
            }
        });

        // 写真削除
        $(document).on('click', '#btn-remove-image-add', function () {
            $('#spider-image').val('');
            $('#spider-image-preview').hide();
            $('#btn-trigger-upload-add').show();
        });

        // 種類のオートコンプリート
        let searchTimer = null;
        $(document).on('input', '#spider-species-search', function () {
            const term = $(this).val();

            // ▼ 追加: 入力内容が変わったら、選択済みのIDをクリアする（リスト選択を強制するため）
            $('#spider-species-select').val('');
            // ▲ 追加ここまで

            if (searchTimer) clearTimeout(searchTimer);

            if (term.length < 2) {
                $('#spider-species-suggestions').hide();
                return;
            }

            searchTimer = setTimeout(function () {
                // API経由で種を検索
                SetaeAPI.searchSpecies(term, function (results) {
                    if (!results || results.length === 0) {
                        $('#spider-species-suggestions').hide();
                        return;
                    }

                    let html = '';
                    results.forEach(s => {
                        // ★追加: 和名がある場合の表示用HTMLを作成
                        const jaDisplay = s.ja_name ? `<span style="font-size:12px; color:#666; font-weight:normal; margin-left:8px;">(${s.ja_name})</span>` : '';

                        // ★修正: data-nameには学名のみ、表示には jaDisplay を追加
                        html += `<div class="suggestion-item" data-id="${s.id}" data-name="${s.title}" style="padding:8px 12px; cursor:pointer; border-bottom:1px solid #f0f0f0;">
                            <div style="font-weight:bold; font-size:14px;">
                                ${s.title}${jaDisplay}
                            </div>
                            <div style="font-size:12px; color:#888;">${s.genus || ''}</div>
                        </div>`;
                    });
                    $('#spider-species-suggestions').html(html).show();
                });
            }, 300); // Debounce
        });

        // ★追加: クリック時は data-name (学名のみ) を取得してセット
        $(document).on('click', '#spider-species-suggestions .suggestion-item', function () {
            const name = $(this).data('name'); // テキストではなくdata属性から取得

            $('#spider-species-search').val(name);
            $('#spider-species-select').val($(this).data('id'));
            $('#spider-species-suggestions').hide();
        });

        // 候補外クリックで閉じる
        $(document).on('click', function (e) {
            if (!$(e.target).closest('.setae-autocomplete-wrapper').length) {
                $('#spider-species-suggestions').hide();
            }
        });

        // ==========================================
        // Submit New Spider (連打防止対策済み)
        // ==========================================
        $(document).on('submit', '#form-add-spider', function (e) {
            e.preventDefault();

            const $form = $(this);
            const $btn = $form.find('button[type="submit"]');

            // ★追加: 既に送信処理中（ボタンが無効）なら何もしない
            if ($btn.prop('disabled')) {
                return;
            }

            const originalText = $btn.text();

            // ▼ 追加: 種類がリストから選択されているかチェック (タランチュラの場合のみ)
            const classificationCheck = $('input[name="classification"]:checked').val();
            if (classificationCheck === 'tarantula') {
                const speciesIdCheck = $('#spider-species-select').val();
                if (!speciesIdCheck) {
                    SetaeCore.showToast('種類をリストから選択してください', 'warning');
                    return; // IDが無い場合はここで処理を中断
                }
            }
            // ▲ 追加ここまで

            // ★追加: ボタンを無効化してローディング状態にする
            $btn.prop('disabled', true).text('登録中...');

            // フォームデータの構築
            const formData = new FormData(this);

            // ★追加: ニックネーム入力欄(#spider-name)に name属性がないため、手動で値を取得して追加
            const nickname = $('#spider-name').val();
            if (nickname) {
                formData.append('name', nickname);
            }

            const classification = $('input[name="classification"]:checked').val();

            // カテゴリー情報を追加
            formData.append('classification', classification);

            if (classification === 'tarantula') {
                // 既存ロジック: IDチェック
                const speciesId = $('#spider-species-select').val();
                if (!speciesId) {
                    SetaeCore.showToast('種類をリストから選択してください', 'warning');
                    $btn.prop('disabled', false).text(originalText);
                    return;
                }
                formData.set('species_id', speciesId);
            } else {
                // 新規ロジック: 自由入力テキストを取得
                const customName = $('#spider-custom-species').val();
                if (!customName) {
                    SetaeCore.showToast('種類名を入力してください', 'warning');
                    $btn.prop('disabled', false).text(originalText);
                    return;
                }
                formData.append('custom_species', customName);
            }

            // 画像ファイル (input[type=file] がフォーム外や特殊な配置の場合に備えて明示的に取得)
            const imageFile = $('#spider-image')[0].files[0];
            if (imageFile) {
                formData.append('image', imageFile);
            }

            // API送信
            SetaeAPI.addSpider(formData,
                // 成功時
                function (response) {
                    SetaeCore.showToast('新しい個体を登録しました', 'success');

                    // フォームとプレビューのリセット
                    $form[0].reset();
                    $('#spider-species-search').val('');
                    $form[0].reset();
                    $('#spider-species-search').val('');
                    $('#spider-species-select').val('');
                    $('#spider-custom-species').val(''); // Clear custom input

                    // Reset to Tarantula default
                    $('input[name="classification"][value="tarantula"]').prop('checked', true).trigger('change');
                    $('#preview-img-tag-add').attr('src', '');
                    $('#spider-image-preview').hide();

                    // モーダルを閉じる
                    $('#modal-add-spider').fadeOut();

                    // リストを更新 (マイリスト画面にいる場合)
                    if (window.SetaeUI && SetaeUI.renderMySpiders) {
                        SetaeAPI.fetchMySpiders(SetaeUI.renderMySpiders);
                    }

                    // ★追加: ボタンを元の状態に戻す
                    $btn.prop('disabled', false).text(originalText);
                },
                // エラー時 (SetaeAPIが第2引数でエラーを受け取る想定)
                function (error) {
                    console.error('Add Spider Error:', error);
                    SetaeCore.showToast('登録に失敗しました', 'error');

                    // ★追加: エラー発生時もボタンを元の状態に戻して再試行可能にする
                    $btn.prop('disabled', false).text(originalText);
                }
            );
        });
    }

    return { init: init };
})(jQuery);

// 初期化実行 (app-ui-renderer 等から呼ばれる想定だが、単体でも動くように)
jQuery(document).ready(function () {
    SetaeUIAddSpider.init();
});
