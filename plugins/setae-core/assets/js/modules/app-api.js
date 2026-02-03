var SetaeAPI = (function ($) {
    'use strict';

    const root = SetaeCore.state.apiRoot;
    const nonce = SetaeCore.state.nonce;

    function fetchMySpiders(callback) {
        $.ajax({
            url: root + '/my-spiders',
            method: 'GET',
            cache: false,
            beforeSend: function (xhr) { xhr.setRequestHeader('X-WP-Nonce', nonce); },
            success: function (data) {
                SetaeCore.state.cachedSpiders = data || [];
                if (callback) callback(data);
            },
            error: function () {
                SetaeCore.showToast('読み込みエラーが発生しました。', 'error');
            }
        });
    }

    function updateSpiderStatus(id, status, callback) {
        $.ajax({
            url: root + '/spiders/' + id,
            method: 'POST',
            beforeSend: function (xhr) { xhr.setRequestHeader('X-WP-Nonce', nonce); },
            data: { status: status },
            success: function (res) {
                if (callback) callback(res);
            }
        });
    }

    function logEvent(id, type, date, data, file, callback) {
        // FormData オブジェクトの作成
        const formData = new FormData();
        formData.append('type', type);
        formData.append('date', date);
        formData.append('data', JSON.stringify(data));

        // ファイルがある場合のみ追加 (キー名は 'image')
        if (file) {
            formData.append('image', file);
        }

        $.ajax({
            url: root + '/spider/' + id + '/events',
            method: 'POST',
            beforeSend: function (xhr) { xhr.setRequestHeader('X-WP-Nonce', nonce); },
            data: formData,
            processData: false, // FormData送信に必須
            contentType: false, // FormData送信に必須
            success: function (res) {
                if (callback) callback(res);
            }
        });
    }

    function fetchSpecies(search, callback) {
        $.ajax({
            url: root + '/species',
            method: 'GET',
            data: { search: search },
            success: callback
        });
    }

    return {
        fetchMySpiders: fetchMySpiders,
        updateSpiderStatus: updateSpiderStatus,
        logEvent: logEvent,
        fetchSpecies: fetchSpecies
    };

})(jQuery);
