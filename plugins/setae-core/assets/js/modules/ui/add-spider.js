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
        });

        // モーダルを閉じる (共通クラスで処理される場合もあるが、念のため)
        $(document).on('click', '#modal-add-spider .setae-close', function () {
            $('#modal-add-spider').fadeOut(200);
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
                        // ★修正: 和名があれば表示用HTMLを作成
                        const jaDisplay = s.ja_name ? `<span style="font-size:12px; color:#666; font-weight:normal; margin-left:8px;">${s.ja_name}</span>` : '';

                        // ★修正: data-name属性を追加して学名を保持させる
                        html += `<div class="suggestion-item" data-id="${s.id}" data-name="${s.title}" style="padding:8px 12px; cursor:pointer; border-bottom:1px solid #f0f0f0;">
                            <div style="font-weight:bold; font-size:14px;">${s.title}${jaDisplay}</div>
                            <div style="font-size:12px; color:#888;">${s.genus || ''}</div>
                        </div>`;
                    });
                    $('#spider-species-suggestions').html(html).show();
                });
            }, 300); // Debounce
        });

        $(document).on('click', '#spider-species-suggestions .suggestion-item', function () {
            const name = $(this).data('name') || $(this).find('div:first').text();
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

        // フォーム送信
        $(document).on('submit', '#form-add-spider', function (e) {
            e.preventDefault();

            const speciesId = $('#spider-species-select').val();
            if (!speciesId) {
                SetaeCore.showToast('種類を選択してください', 'error');
                return;
            }

            const formData = new FormData();
            formData.append('species_id', speciesId);
            formData.append('name', $('#spider-name').val());
            formData.append('last_molt', $('#spider-last-molt').val());
            formData.append('last_feed', $('#spider-last-feed').val());

            if ($('#spider-image')[0].files[0]) {
                formData.append('image', $('#spider-image')[0].files[0]);
            }

            SetaeAPI.createSpider(formData, function (response) {
                if (response.success) {
                    SetaeCore.showToast('新しいクモを登録しました！', 'success');
                    $('#modal-add-spider').fadeOut(200);
                    // リストを再読み込み
                    if (window.SetaeUIList) SetaeUIList.refresh();
                }
            });
        });
    }

    return { init: init };
})(jQuery);

// 初期化実行 (app-ui-renderer 等から呼ばれる想定だが、単体でも動くように)
jQuery(document).ready(function () {
    SetaeUIAddSpider.init();
});
