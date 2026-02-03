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

    // [Fix] オブジェクトだけでなくFormDataも扱える汎用的な更新関数
    function updateSpider(id, data, callback) {
        const isFormData = data instanceof FormData;

        $.ajax({
            url: root + '/spiders/' + id,
            method: 'POST',
            beforeSend: function (xhr) { xhr.setRequestHeader('X-WP-Nonce', nonce); },
            data: data,
            // FormDataの場合は以下2行が必須
            processData: isFormData ? false : true,
            contentType: isFormData ? false : 'application/x-www-form-urlencoded; charset=UTF-8',
            success: function (res) {
                if (callback) callback(res);
            },
            error: function () {
                SetaeCore.showToast('更新に失敗しました。', 'error');
            }
        });
    }

    // 既存の名称も維持（互換性のため）
    function updateSpiderStatus(id, status, callback) {
        updateSpider(id, { status: status }, callback);
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


    function getSpiderDetail(id, callback) {
        $.ajax({
            url: root + '/spider/' + id,
            method: 'GET',
            beforeSend: function (xhr) { xhr.setRequestHeader('X-WP-Nonce', nonce); },
            success: function (data) {
                if (callback) callback(data);
            },
            error: function () {
                SetaeCore.showToast('詳細の取得に失敗しました', 'error');
            }
        });
    }

    return {
        fetchMySpiders: fetchMySpiders,
        updateSpider: updateSpider,
        updateSpiderStatus: updateSpiderStatus,
        getSpiderDetail: getSpiderDetail,
        logEvent: logEvent,
        fetchSpecies: fetchSpecies
    };

})(jQuery);
