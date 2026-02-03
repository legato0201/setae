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

    function logEvent(id, type, date, data, callback) {
        $.ajax({
            url: root + '/spider/' + id + '/events',
            method: 'POST',
            beforeSend: function (xhr) { xhr.setRequestHeader('X-WP-Nonce', nonce); },
            data: { type: type, date: date, data: JSON.stringify(data) },
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
