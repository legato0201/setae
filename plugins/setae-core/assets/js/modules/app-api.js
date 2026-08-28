var SetaeAPI = (function ($) {
    'use strict';

    const root = SetaeCore.state.apiRoot;
    let nonce = SetaeCore.state.nonce;

    function acceptSession(response) {
        if (!response || !Object.prototype.hasOwnProperty.call(response, 'nonce')) return;
        nonce = response.nonce || '';
        SetaeCore.state.nonce = nonce;
        if (window.SetaeSettings) SetaeSettings.nonce = nonce;
    }

    function offlineError(error) {
        return {
            status: 0,
            offline: true,
            responseJSON: {
                message: error && error.message ? error.message : '端末への保存に失敗しました。'
            }
        };
    }

    function localRequest(promise, callback, errorCallback) {
        const deferred = $.Deferred();
        Promise.resolve(promise).then(function (data) {
            if (callback) callback(data);
            deferred.resolve(data);
        }).catch(function (error) {
            const xhr = offlineError(error);
            if (errorCallback) errorCallback(xhr);
            else SetaeCore.showToast(xhr.responseJSON.message, 'error');
            deferred.reject(xhr);
        });
        return deferred.promise();
    }

    function useOfflineStore() {
        return window.SetaeOffline && SetaeOffline.shouldUseLocal();
    }

    function appRequest(path, method, data, callback, errorCallback) {
        const isMultipart = typeof FormData !== 'undefined' && data instanceof FormData;
        const options = {
            url: root + path,
            method: method || 'GET',
            data: data || {},
            cache: (method || 'GET') === 'GET' ? false : undefined,
            timeout: 20000,
            beforeSend: function (xhr) {
                if (nonce) xhr.setRequestHeader('X-WP-Nonce', nonce);
            },
            success: function (response) {
                if (callback) callback(response);
            },
            error: function (xhr) {
                if (errorCallback) errorCallback(xhr);
            }
        };
        if (isMultipart) {
            options.processData = false;
            options.contentType = false;
        }
        return $.ajax(options);
    }

    function fetchAppBootstrap(callback, errorCallback) {
        return appRequest('/app/bootstrap', 'GET', {}, function (response) {
            acceptSession(response);
            if (callback) callback(response);
        }, errorCallback);
    }

    function fetchOperations(callback, errorCallback) {
        return appRequest('/operations', 'GET', {}, callback, errorCallback);
    }

    function registerUser(data, callback, errorCallback) {
        return appRequest('/registration', 'POST', data, callback, errorCallback);
    }

    function fetchSession(callback, errorCallback) {
        return appRequest('/session', 'GET', {}, function (response) {
            acceptSession(response);
            if (callback) callback(response);
        }, errorCallback);
    }

    function createSession(data, callback, errorCallback) {
        return appRequest('/session', 'POST', data, function (response) {
            acceptSession(response);
            if (callback) callback(response);
        }, errorCallback);
    }

    function deleteSession(callback, errorCallback) {
        return appRequest('/session', 'DELETE', {}, function (response) {
            acceptSession(response);
            if (callback) callback(response);
        }, errorCallback);
    }

    function requestPasswordReset(data, callback, errorCallback) {
        return appRequest('/password-reset', 'POST', data, callback, errorCallback);
    }

    function verifyEmail(data, callback, errorCallback) {
        return appRequest('/email-verification', 'POST', data, callback, errorCallback);
    }

    function fetchCurrentUser(callback, errorCallback) {
        return appRequest('/me', 'GET', {}, callback, errorCallback);
    }

    function updateCurrentUser(data, callback, errorCallback) {
        return appRequest('/me', 'POST', data, function (response) {
            acceptSession(response);
            if (callback) callback(response);
        }, errorCallback);
    }

    function submitSpeciesSuggestion(speciesId, data, callback, errorCallback) {
        return appRequest('/species/' + speciesId + '/suggestions', 'POST', data, callback, errorCallback);
    }

    function trackMetricEvent(data, callback, errorCallback) {
        return appRequest('/metrics/events', 'POST', data, callback, errorCallback);
    }

    function fetchMySpiders(callback, options) {
        const requestOptions = options || {};
        const scope = requestOptions.scope || 'active';

        if (useOfflineStore()) {
            return localRequest(SetaeOffline.getSpiders({ scope: scope }), function (spiders) {
                const normalized = Array.isArray(spiders) && typeof SetaeCore.normalizeSpiderDisplayFields === 'function'
                    ? spiders.map(SetaeCore.normalizeSpiderDisplayFields)
                    : (spiders || []);
                if (scope === 'active') {
                    SetaeCore.state.cachedSpiders = normalized;
                    SetaeCore.state.mySpidersLoaded = true;
                    if (window.SetaeSettings && SetaeSettings.current_user && window.SetaeOffline) {
                        SetaeOffline.getSpiders({ scope: 'all' }).then(function (allSpiders) {
                            SetaeSettings.current_user.spider_count = allSpiders.length;
                        }).catch(function () {});
                    }
                }
                if (callback) callback(normalized);
            }, requestOptions.onError);
        }

        return $.ajax({
            url: root + '/my-spiders',
            method: 'GET',
            data: scope === 'active' ? {} : { scope: scope },
            cache: false,
            timeout: 15000,
            beforeSend: function (xhr) { xhr.setRequestHeader('X-WP-Nonce', nonce); },
            success: function (data) {
                const serverSpiders = Array.isArray(data) && typeof SetaeCore.normalizeSpiderDisplayFields === 'function'
                    ? data.map(SetaeCore.normalizeSpiderDisplayFields)
                    : (data || []);

                function deliver(spiders) {
                    if (scope === 'active') {
                        SetaeCore.state.cachedSpiders = spiders;
                        SetaeCore.state.mySpidersLoaded = true;
                    }
                    if (callback) callback(spiders);
                }

                if (!window.SetaeOffline) {
                    deliver(serverSpiders);
                    return;
                }
                SetaeOffline.cacheServerSpiders(serverSpiders, { scope: scope })
                    .then(function () { return SetaeOffline.getSpiders({ scope: scope }); })
                    .then(deliver)
                    .catch(function () { deliver(serverSpiders); });
            },
            error: function (xhr) {
                if (window.SetaeOffline && (!navigator.onLine || xhr.status === 0)) {
                    SetaeOffline.getSpiders({ scope: scope }).then(function (spiders) {
                        if (scope === 'active') {
                            SetaeCore.state.cachedSpiders = spiders;
                            SetaeCore.state.mySpidersLoaded = true;
                        }
                        if (callback) callback(spiders);
                        document.dispatchEvent(new CustomEvent('setae:offline-state', {
                            detail: { offline: true, fallback: true }
                        }));
                    }).catch(function () {
                        if (typeof requestOptions.onError === 'function') requestOptions.onError(xhr);
                    });
                    return;
                }
                if (typeof requestOptions.onError === 'function') requestOptions.onError(xhr);
                else if (!requestOptions.silent) SetaeCore.showToast('読み込みエラーが発生しました。', 'error');
            }
        });
    }

    function fetchArchivedSpiders(callback) {
        return fetchMySpiders(callback, { scope: 'archived', silent: true });
    }

    function fetchCareSummary(callback) {
        if (useOfflineStore()) {
            return localRequest(SetaeOffline.getCareSummary(), function (data) {
                SetaeCore.state.careSummary = data || null;
                if (callback) callback(data);
            });
        }

        return $.ajax({
            url: root + '/care-summary',
            method: 'GET',
            cache: false,
            beforeSend: function (xhr) { xhr.setRequestHeader('X-WP-Nonce', nonce); },
            success: function (data) {
                SetaeCore.state.careSummary = data || null;
                if (callback) callback(data);
            }
        });
    }

    function fetchBabyGroups(callback, errorCallback) {
        return $.ajax({
            url: root + '/baby-groups',
            method: 'GET',
            cache: false,
            timeout: 15000,
            beforeSend: function (xhr) { xhr.setRequestHeader('X-WP-Nonce', nonce); },
            success: function (data) { if (callback) callback(data); },
            error: function (xhr) {
                if (errorCallback) errorCallback(xhr);
                else SetaeCore.showToast('ベビー管理の読み込みに失敗しました', 'error');
            }
        });
    }

    function createBabyGroup(data, callback, errorCallback) {
        return $.ajax({
            url: root + '/baby-groups',
            method: 'POST',
            data: data,
            timeout: 15000,
            beforeSend: function (xhr) { xhr.setRequestHeader('X-WP-Nonce', nonce); },
            success: function (res) { if (callback) callback(res); },
            error: function (xhr) {
                const msg = xhr.responseJSON && xhr.responseJSON.message ? xhr.responseJSON.message : 'ベビー群の作成に失敗しました';
                SetaeCore.showToast(msg, 'error');
                if (errorCallback) errorCallback(xhr);
            }
        });
    }

    function getBabyGroup(id, callback, errorCallback) {
        return $.ajax({
            url: root + '/baby-groups/' + id,
            method: 'GET',
            cache: false,
            timeout: 15000,
            beforeSend: function (xhr) { xhr.setRequestHeader('X-WP-Nonce', nonce); },
            success: function (res) { if (callback) callback(res); },
            error: function (xhr) {
                if (errorCallback) errorCallback(xhr);
                else SetaeCore.showToast('ベビー群の詳細取得に失敗しました', 'error');
            }
        });
    }

    function updateBabyGroup(id, data, callback) {
        return $.ajax({
            url: root + '/baby-groups/' + id,
            method: 'POST',
            data: data,
            timeout: 15000,
            beforeSend: function (xhr) { xhr.setRequestHeader('X-WP-Nonce', nonce); },
            success: function (res) { if (callback) callback(res); },
            error: function (xhr) {
                const msg = xhr.responseJSON && xhr.responseJSON.message ? xhr.responseJSON.message : 'ベビー群の更新に失敗しました';
                SetaeCore.showToast(msg, 'error');
            }
        });
    }

    function deleteBabyGroup(id, callback) {
        return $.ajax({
            url: root + '/baby-groups/' + id,
            method: 'DELETE',
            timeout: 15000,
            beforeSend: function (xhr) { xhr.setRequestHeader('X-WP-Nonce', nonce); },
            success: function (res) { if (callback) callback(res); },
            error: function (xhr) {
                const msg = xhr.responseJSON && xhr.responseJSON.message ? xhr.responseJSON.message : 'ベビー群の削除に失敗しました';
                SetaeCore.showToast(msg, 'error');
            }
        });
    }

    function bulkUpdateBabyGroup(id, data, callback) {
        return $.ajax({
            url: root + '/baby-groups/' + id + '/bulk',
            method: 'POST',
            data: data,
            timeout: 15000,
            beforeSend: function (xhr) { xhr.setRequestHeader('X-WP-Nonce', nonce); },
            success: function (res) { if (callback) callback(res); },
            error: function (xhr) {
                const msg = xhr.responseJSON && xhr.responseJSON.message ? xhr.responseJSON.message : '一括記録に失敗しました';
                SetaeCore.showToast(msg, 'error');
            }
        });
    }

    function promoteBabyToSpiders(id, data, callback) {
        return $.ajax({
            url: root + '/baby-groups/' + id + '/promote',
            method: 'POST',
            data: data,
            timeout: 30000,
            beforeSend: function (xhr) { xhr.setRequestHeader('X-WP-Nonce', nonce); },
            success: function (res) { if (callback) callback(res); },
            error: function (xhr) {
                const msg = xhr.responseJSON && xhr.responseJSON.message ? xhr.responseJSON.message : 'マイ個体への移動に失敗しました';
                SetaeCore.showToast(msg, 'error');
            }
        });
    }

    function qrRequest(path, method, data, callback, errorCallback) {
        return $.ajax({
            url: root + path,
            method: method,
            data: data || {},
            cache: method === 'GET' ? false : undefined,
            timeout: method === 'POST' ? (path === '/qr/records' ? 60000 : 30000) : 15000,
            beforeSend: function (xhr) { xhr.setRequestHeader('X-WP-Nonce', nonce); },
            success: function (response) {
                if (callback) callback(response);
            },
            error: function (xhr) {
                if (errorCallback) {
                    errorCallback(xhr);
                    return;
                }
                const message = xhr && xhr.responseJSON && xhr.responseJSON.message
                    ? xhr.responseJSON.message
                    : 'QR管理の処理に失敗しました。';
                SetaeCore.showToast(message, 'error');
            }
        });
    }

    function fetchQrTargets(params, callback, errorCallback) {
        return qrRequest('/qr/targets', 'GET', params, callback, errorCallback);
    }

    function resolveQrTarget(code, callback, errorCallback) {
        return qrRequest('/qr/resolve', 'POST', { code: code }, callback, errorCallback);
    }

    function saveQrRecords(data, callback, errorCallback) {
        return qrRequest('/qr/records', 'POST', data, callback, errorCallback);
    }

    function updateQrSpiderSettings(id, data, callback, errorCallback) {
        return qrRequest('/qr/spiders/' + encodeURIComponent(id) + '/settings', 'POST', data, callback, errorCallback);
    }

    function fetchQrTransfers(callback, errorCallback) {
        return qrRequest('/qr/transfers', 'GET', {}, callback, errorCallback);
    }

    function respondQrTransfer(id, action, callback, errorCallback) {
        return qrRequest('/qr/transfers/' + encodeURIComponent(id), 'POST', { action: action }, callback, errorCallback);
    }

    function markQrNotificationsRead(callback, errorCallback) {
        return qrRequest('/qr/notifications/read', 'POST', {}, callback, errorCallback);
    }

    // [Fix] オブジェクトだけでなくFormDataも扱える汎用的な更新関数
    function updateSpider(id, data, callback, errorCallback) {
        if (useOfflineStore()) {
            return localRequest(SetaeOffline.updateSpider(id, data), callback, errorCallback);
        }
        const isFormData = data instanceof FormData;

        return $.ajax({
            url: root + '/spiders/' + id,
            method: 'POST',
            beforeSend: function (xhr) { xhr.setRequestHeader('X-WP-Nonce', nonce); },
            data: data,
            // FormDataの場合は以下2行が必須
            processData: isFormData ? false : true,
            contentType: isFormData ? false : 'application/x-www-form-urlencoded; charset=UTF-8',
            success: function (res) {
                if (window.SetaeOffline && res && res.data) {
                    SetaeOffline.cacheSpiderDetail(res.data).catch(function () {});
                }
                if (callback) callback(res);
            },
            error: function (xhr) {
                if (errorCallback) {
                    errorCallback(xhr);
                    return;
                }
                const message = xhr && xhr.responseJSON && xhr.responseJSON.message
                    ? xhr.responseJSON.message
                    : '更新に失敗しました。';
                SetaeCore.showToast(message, 'error');
            }
        });
    }

    function setSpiderArchived(id, archived, callback, errorCallback) {
        return updateSpider(id, { archived: archived ? 1 : 0 }, callback, errorCallback);
    }

    function setSpiderFavorite(id, isFavorite, callback, errorCallback) {
        if (useOfflineStore()) {
            return localRequest(SetaeOffline.updateSpider(id, { is_favorite: !!isFavorite }), function (response) {
                if (callback) callback({
                    success: true,
                    is_favorite: !!isFavorite,
                    data: response && response.data ? response.data : null
                });
            }, errorCallback);
        }

        return $.ajax({
            url: root + '/spiders/' + id + '/favorite',
            method: 'POST',
            data: { is_favorite: isFavorite ? 1 : 0 },
            beforeSend: function (xhr) { xhr.setRequestHeader('X-WP-Nonce', nonce); },
            success: function (response) { if (callback) callback(response); },
            error: function (xhr) {
                if (errorCallback) {
                    errorCallback(xhr);
                    return;
                }
                SetaeCore.showToast('お気に入りを更新できませんでした。', 'error');
            }
        });
    }

    function feederRequest(path, method, data, callback, errorCallback) {
        return $.ajax({
            url: root + path,
            method: method,
            data: data || {},
            cache: method === 'GET' ? false : undefined,
            timeout: 15000,
            beforeSend: function (xhr) { xhr.setRequestHeader('X-WP-Nonce', nonce); },
            success: function (response) {
                if (callback) callback(response);
            },
            error: function (xhr) {
                if (errorCallback) {
                    errorCallback(xhr);
                    return;
                }
                const message = xhr && xhr.responseJSON && xhr.responseJSON.message
                    ? xhr.responseJSON.message
                    : '餌管理の更新に失敗しました。';
                SetaeCore.showToast(message, 'error');
            }
        });
    }

    function fetchFeederDashboard(callback, errorCallback) {
        return feederRequest('/feeders', 'GET', {}, callback, errorCallback);
    }

    function recordFeederAction(data, callback, errorCallback) {
        return feederRequest('/feeders/actions', 'POST', data, callback, errorCallback);
    }

    function createFeederEggBatch(data, callback, errorCallback) {
        return feederRequest('/feeders/eggs', 'POST', data, callback, errorCallback);
    }

    function updateFeederEggBatch(id, data, callback, errorCallback) {
        return feederRequest('/feeders/eggs/' + encodeURIComponent(id), 'POST', data, callback, errorCallback);
    }

    // 既存の名称も維持（互換性のため）
    function updateSpiderStatus(id, status, callback, errorCallback) {
        return updateSpider(id, { status: status }, callback, errorCallback);
    }

    function logEvent(id, type, date, data, file, callback, errorCallback) {
        if (useOfflineStore()) {
            return localRequest(SetaeOffline.createLog(id, type, date, data, file), function (res) {
                if (res && res.care_summary) SetaeCore.state.careSummary = res.care_summary;
                if (callback) callback(res);
            }, errorCallback);
        }

        // FormData オブジェクトの作成
        const formData = new FormData();
        formData.append('type', type);
        formData.append('date', date);
        formData.append('data', JSON.stringify(data));

        // ファイルがある場合のみ追加 (キー名は 'image')
        if (file) {
            formData.append('image', file);
        }

        return $.ajax({
            url: root + '/spider/' + id + '/events',
            method: 'POST',
            beforeSend: function (xhr) { xhr.setRequestHeader('X-WP-Nonce', nonce); },
            data: formData,
            processData: false, // FormData送信に必須
            contentType: false, // FormData送信に必須
            success: function (res) {
                if (res && res.care_summary) {
                    SetaeCore.state.careSummary = res.care_summary;
                }
                if (window.SetaeOffline && res && res.spider) {
                    SetaeOffline.cacheSpiderDetail(res.spider).catch(function () {});
                }
                if (callback) callback(res);
            },
            error: function (xhr) {
                if (errorCallback) {
                    errorCallback(xhr);
                    return;
                }

                const message = xhr && xhr.responseJSON && xhr.responseJSON.message
                    ? xhr.responseJSON.message
                    : '通信状態を確認して、もう一度お試しください。';
                SetaeCore.showToast('記録の保存に失敗しました: ' + message, 'error');
            }
        });
    }

    function deleteLog(logId, callback, errorCallback) {
        if (useOfflineStore()) {
            return localRequest(SetaeOffline.deleteLog(logId), callback, errorCallback);
        }
        return $.ajax({
            url: root + '/logs/' + logId,
            method: 'DELETE',
            timeout: 15000,
            beforeSend: function (xhr) {
                xhr.setRequestHeader('X-WP-Nonce', nonce);
            },
            success: function (response) {
                if (callback) callback(response);
            },
            error: function (xhr) {
                if (errorCallback) {
                    errorCallback(xhr);
                    return;
                }
                SetaeCore.showToast('削除に失敗しました', 'error');
            }
        });
    }

    function updateLog(logId, data, callback, errorCallback) {
        if (useOfflineStore()) {
            return localRequest(SetaeOffline.updateLog(logId, data), callback, errorCallback);
        }
        return $.ajax({
            url: root + '/logs/' + logId,
            method: 'POST',
            beforeSend: function (xhr) { xhr.setRequestHeader('X-WP-Nonce', nonce); },
            data: data,
            success: function (res) {
                if (callback) callback(res);
            },
            error: function (xhr) {
                if (errorCallback) {
                    errorCallback(xhr);
                    return;
                }
                SetaeCore.showToast('ログの更新に失敗しました', 'error');
            }
        });
    }

    function fetchSpecies(search, callback) {
        const term = String(search || '').trim().toLowerCase();
        const cacheKey = 'setae_species_search_v1';
        let cachedSearches = {};
        try {
            cachedSearches = JSON.parse(localStorage.getItem(cacheKey) || '{}') || {};
        } catch (error) {}

        function cachedResults() {
            if (Array.isArray(cachedSearches[term])) return cachedSearches[term];
            const seen = {};
            const results = [];
            Object.keys(cachedSearches).forEach(function (key) {
                (cachedSearches[key] || []).forEach(function (species) {
                    const haystack = [species.title, species.ja_name, species.genus].join(' ').toLowerCase();
                    if (haystack.indexOf(term) === -1 || seen[species.id]) return;
                    seen[species.id] = true;
                    results.push(species);
                });
            });
            return results.slice(0, 30);
        }

        if (!navigator.onLine) {
            return localRequest(Promise.resolve(cachedResults()), callback);
        }

        return $.ajax({
            url: root + '/species',
            method: 'GET',
            data: { search: search },
            success: function (results) {
                cachedSearches[term] = Array.isArray(results) ? results.slice(0, 40) : [];
                const keys = Object.keys(cachedSearches);
                while (keys.length > 20) {
                    delete cachedSearches[keys.shift()];
                }
                try { localStorage.setItem(cacheKey, JSON.stringify(cachedSearches)); } catch (error) {}
                if (callback) callback(results);
            },
            error: function (xhr) {
                if (xhr.status === 0 && callback) callback(cachedResults());
            }
        });
    }


    function getSpiderDetail(id, callback, errorCallback) {
        if (useOfflineStore() || Number(id) < 0) {
            return localRequest(SetaeOffline.getSpiderDetail(id), callback, errorCallback);
        }
        return $.ajax({
            url: root + '/spider/' + id,
            method: 'GET',
            cache: false,
            timeout: 15000,
            beforeSend: function (xhr) { xhr.setRequestHeader('X-WP-Nonce', nonce); },
            success: function (data) {
                if (window.SetaeOffline) SetaeOffline.cacheSpiderDetail(data).catch(function () {});
                if (callback) callback(data);
            },
            error: function (xhr) {
                if (window.SetaeOffline && (!navigator.onLine || xhr.status === 0)) {
                    localRequest(SetaeOffline.getSpiderDetail(id), callback, errorCallback);
                    return;
                }
                if (errorCallback) {
                    errorCallback(xhr);
                    return;
                }
                SetaeCore.showToast('詳細の取得に失敗しました', 'error');
            }
        });
    }

    function addSpider(data, successCb, errorCb) {
        if (useOfflineStore()) {
            return localRequest(SetaeOffline.createSpider(data), successCb, errorCb);
        }
        return $.ajax({
            url: root + '/spiders',
            method: 'POST',
            beforeSend: function (xhr) { xhr.setRequestHeader('X-WP-Nonce', nonce); },
            data: data,
            processData: false,
            contentType: false,
            success: function (res) {
                if (successCb) successCb(res);
            },
            error: function (xhr) {
                if (errorCb) {
                    errorCb(xhr);
                } else {
                    SetaeCore.showToast('作成に失敗しました: ' + (xhr.responseJSON ? xhr.responseJSON.message : xhr.statusText), 'error');
                }
            }
        });
    }

    function createSpider(data, callback) {
        if (useOfflineStore()) {
            return localRequest(SetaeOffline.createSpider(data), callback);
        }
        return $.ajax({
            url: root + '/spiders',
            method: 'POST',
            beforeSend: function (xhr) { xhr.setRequestHeader('X-WP-Nonce', nonce); },
            data: data,
            processData: false,
            contentType: false,
            success: function (res) {
                if (callback) callback(res);
            },
            error: function (xhr) {
                SetaeCore.showToast('作成に失敗しました: ' + (xhr.responseJSON ? xhr.responseJSON.message : xhr.statusText), 'error');
            }
        });
    }

    function getSpiderEvents(id, callback, errorCallback) {
        if (useOfflineStore() || Number(id) < 0) {
            return localRequest(SetaeOffline.getSpiderEvents(id), callback, errorCallback);
        }
        return $.ajax({
            url: root + '/spider/' + id + '/events?per_page=100',
            method: 'GET',
            timeout: 15000,
            beforeSend: function (xhr) { xhr.setRequestHeader('X-WP-Nonce', nonce); },
            success: function (data) {
                if (window.SetaeOffline) SetaeOffline.cacheServerLogs(id, data).catch(function () {});
                if (callback) callback(data);
            },
            error: function (xhr) {
                if (window.SetaeOffline && (!navigator.onLine || xhr.status === 0)) {
                    localRequest(SetaeOffline.getSpiderEvents(id), callback, errorCallback);
                    return;
                }
                if (errorCallback) errorCallback(xhr);
            }
        });
    }

    function deleteSpider(id, callback, errorCallback) {
        if (useOfflineStore() || Number(id) < 0) {
            return localRequest(SetaeOffline.deleteSpider(id), callback, errorCallback);
        }
        return $.ajax({
            url: root + '/spiders/' + id,
            method: 'DELETE',
            timeout: 15000,
            beforeSend: function (xhr) { xhr.setRequestHeader('X-WP-Nonce', nonce); },
            success: function (data) { if (callback) callback(data); },
            error: function (xhr) {
                if (errorCallback) errorCallback(xhr);
                else SetaeCore.showToast('個体を削除できませんでした。', 'error');
            }
        });
    }

    function getSpeciesStats(speciesId) {
        return $.ajax({
            url: root + '/species/' + speciesId + '/stats',
            method: 'GET',
            beforeSend: function (xhr) {
                xhr.setRequestHeader('X-WP-Nonce', nonce);
            }
        });
    }

    function fetchCareFeed(params, callback, errorCallback) {
        params = params || {};
        if (!params.page) params.page = 1;

        return $.ajax({
            url: root + '/care-feed',
            method: 'GET',
            data: params,
            cache: false,
            timeout: 15000,
            beforeSend: function (xhr) { xhr.setRequestHeader('X-WP-Nonce', nonce); },
            success: function (data) { if (callback) callback(data); },
            error: function (xhr) {
                if (errorCallback) errorCallback(xhr);
                else SetaeCore.showToast('ケアフィードの読み込みに失敗しました', 'error');
            }
        });
    }

    function getCareFeedDetail(id, page, callback, options) {
        if (typeof page === 'function') {
            callback = page;
            page = 1;
        }

        const params = { page: page || 1 };
        if (options && options.focus_comment) {
            params.focus_comment = options.focus_comment;
        }

        return $.ajax({
            url: root + '/care-feed/' + id,
            method: 'GET',
            data: params,
            beforeSend: function (xhr) { xhr.setRequestHeader('X-WP-Nonce', nonce); },
            success: function (data) { if (callback) callback(data); },
            error: function () { SetaeCore.showToast('ケア記録の読み込みに失敗しました', 'error'); }
        });
    }

    function postCareFeedComment(id, content, callback, options) {
        const data = { content: content };
        if (options && options.parent_id) {
            data.parent_id = options.parent_id;
        }

        return $.ajax({
            url: root + '/care-feed/' + id + '/comments',
            method: 'POST',
            data: data,
            beforeSend: function (xhr) { xhr.setRequestHeader('X-WP-Nonce', nonce); },
            success: function (data) { if (callback) callback(data); },
            error: function (xhr) {
                const msg = xhr.responseJSON && xhr.responseJSON.message ? xhr.responseJSON.message : 'コメント投稿に失敗しました';
                SetaeCore.showToast(msg, 'error');
            }
        });
    }

    function unshareCareFeedItem(id, callback) {
        return $.ajax({
            url: root + '/care-feed/' + id,
            method: 'DELETE',
            beforeSend: function (xhr) { xhr.setRequestHeader('X-WP-Nonce', nonce); },
            success: function (data) { if (callback) callback(data); },
            error: function (xhr) {
                const msg = xhr.responseJSON && xhr.responseJSON.message ? xhr.responseJSON.message : '共有解除に失敗しました';
                SetaeCore.showToast(msg, 'error');
            }
        });
    }

    function shareLogToCareFeed(id, callback, errorCallback) {
        if (useOfflineStore() || Number(id) < 0) {
            return localRequest(
                Promise.reject(new Error('お世話フィードへの共有は、無料登録後にオンラインで利用できます。')),
                null,
                errorCallback
            );
        }
        return $.ajax({
            url: root + '/logs/' + id + '/share',
            method: 'POST',
            beforeSend: function (xhr) { xhr.setRequestHeader('X-WP-Nonce', nonce); },
            success: function (data) { if (callback) callback(data); },
            error: function (xhr) {
                if (errorCallback) {
                    errorCallback(xhr);
                    return;
                }
                const msg = xhr.responseJSON && xhr.responseJSON.message ? xhr.responseJSON.message : '共有に失敗しました';
                SetaeCore.showToast(msg, 'error');
            }
        });
    }

    function deleteCareFeedComment(id, callback) {
        return $.ajax({
            url: root + '/care-feed/comments/' + id,
            method: 'DELETE',
            beforeSend: function (xhr) { xhr.setRequestHeader('X-WP-Nonce', nonce); },
            success: function (data) { if (callback) callback(data); },
            error: function (xhr) {
                const msg = xhr.responseJSON && xhr.responseJSON.message ? xhr.responseJSON.message : 'コメント削除に失敗しました';
                SetaeCore.showToast(msg, 'error');
            }
        });
    }

    function reportCareFeedItem(id, reason, callback) {
        return $.ajax({
            url: root + '/care-feed/' + id + '/report',
            method: 'POST',
            data: { reason: reason || '' },
            beforeSend: function (xhr) { xhr.setRequestHeader('X-WP-Nonce', nonce); },
            success: function (data) { if (callback) callback(data); },
            error: function (xhr) {
                const msg = xhr.responseJSON && xhr.responseJSON.message ? xhr.responseJSON.message : '通報に失敗しました';
                SetaeCore.showToast(msg, 'error');
            }
        });
    }

    function reactToCareFeedItem(id, reaction, callback) {
        return $.ajax({
            url: root + '/care-feed/' + id + '/reaction',
            method: 'POST',
            data: { reaction: reaction },
            beforeSend: function (xhr) { xhr.setRequestHeader('X-WP-Nonce', nonce); },
            success: function (data) { if (callback) callback(data); },
            error: function (xhr) {
                const msg = xhr.responseJSON && xhr.responseJSON.message ? xhr.responseJSON.message : 'リアクションに失敗しました';
                SetaeCore.showToast(msg, 'error');
            }
        });
    }

    function reportCareFeedComment(id, reason, callback) {
        return $.ajax({
            url: root + '/care-feed/comments/' + id + '/report',
            method: 'POST',
            data: { reason: reason || '' },
            beforeSend: function (xhr) { xhr.setRequestHeader('X-WP-Nonce', nonce); },
            success: function (data) { if (callback) callback(data); },
            error: function (xhr) {
                const msg = xhr.responseJSON && xhr.responseJSON.message ? xhr.responseJSON.message : '通報に失敗しました';
                SetaeCore.showToast(msg, 'error');
            }
        });
    }

    function fetchCareFeedUnread(callback) {
        return $.ajax({
            url: root + '/care-feed/unread',
            method: 'GET',
            cache: false,
            beforeSend: function (xhr) { xhr.setRequestHeader('X-WP-Nonce', nonce); },
            success: function (data) { if (callback) callback(data); }
        });
    }

    function markCareFeedRead(callback) {
        return $.ajax({
            url: root + '/care-feed/mark-read',
            method: 'POST',
            beforeSend: function (xhr) { xhr.setRequestHeader('X-WP-Nonce', nonce); },
            success: function (data) { if (callback) callback(data); }
        });
    }

    function fetchSocialRelationships(callback) {
        return $.ajax({
            url: root + '/social/relationships',
            method: 'GET',
            cache: false,
            beforeSend: function (xhr) { xhr.setRequestHeader('X-WP-Nonce', nonce); },
            success: function (data) { if (callback) callback(data); },
            error: function (xhr) {
                const msg = xhr.responseJSON && xhr.responseJSON.message ? xhr.responseJSON.message : 'フォロー設定の読み込みに失敗しました';
                SetaeCore.showToast(msg, 'error');
            }
        });
    }

    function requestSocialRelationship(userId, relationship, method, callback) {
        return $.ajax({
            url: root + '/social/users/' + userId + '/' + relationship,
            method: method,
            beforeSend: function (xhr) { xhr.setRequestHeader('X-WP-Nonce', nonce); },
            success: function (data) { if (callback) callback(data); },
            error: function (xhr) {
                const msg = xhr.responseJSON && xhr.responseJSON.message ? xhr.responseJSON.message : '表示設定の更新に失敗しました';
                SetaeCore.showToast(msg, 'error');
            }
        });
    }

    function followUser(userId, callback) {
        return requestSocialRelationship(userId, 'follow', 'POST', callback);
    }

    function unfollowUser(userId, callback) {
        return requestSocialRelationship(userId, 'follow', 'DELETE', callback);
    }

    function blockUser(userId, callback) {
        return requestSocialRelationship(userId, 'block', 'POST', callback);
    }

    function unblockUser(userId, callback) {
        return requestSocialRelationship(userId, 'block', 'DELETE', callback);
    }

    // --- Community API Start ---

    function fetchTopics(params, callback, errorCallback) {
        // Handle optional params
        if (typeof params === 'function') {
            callback = params;
            params = {};
        }

        // Default params
        params = params || {};
        if (!params.page) params.page = 1;
        if (!params.type) params.type = 'all';
        if (!params.sort) params.sort = 'updated';
        if (!params.s) params.s = '';
        if (!params.species_id) params.species_id = '';

        return $.ajax({
            url: root + '/topics',
            method: 'GET',
            data: params,
            cache: false,
            timeout: 15000,
            beforeSend: function (xhr) { xhr.setRequestHeader('X-WP-Nonce', nonce); },
            success: function (data) { if (callback) callback(data); },
            error: function (xhr) {
                if (errorCallback) errorCallback(xhr);
                else SetaeCore.showToast('トピックの読み込みに失敗しました', 'error');
            }
        });
    }

    function createTopic(data, callback) {
        const isMultipart = typeof FormData !== 'undefined' && data instanceof FormData;
        const options = {
            url: root + '/topics',
            method: 'POST',
            data: data,
            beforeSend: function (xhr) { xhr.setRequestHeader('X-WP-Nonce', nonce); },
            success: function (res) { if (callback) callback(res); },
            error: function () { SetaeCore.showToast('トピック作成に失敗しました', 'error'); }
        };

        if (isMultipart) {
            options.processData = false;
            options.contentType = false;
        }

        return $.ajax(options);
    }

    function getTopicDetail(id, page, callback) {
        // 第2引数が関数の場合の互換性維持
        if (typeof page === 'function') {
            callback = page;
            page = 1;
        }

        $.ajax({
            url: root + '/topics/' + id,
            method: 'GET',
            data: { page: page || 1 }, // ページ番号を送信
            beforeSend: function (xhr) { xhr.setRequestHeader('X-WP-Nonce', nonce); },
            success: function (data) { if (callback) callback(data); },
            error: function () { SetaeCore.showToast('トピック詳細の取得に失敗しました', 'error'); }
        });
    }

    function fetchCommunityUnread(callback) {
        return $.ajax({
            url: root + '/topics/unread',
            method: 'GET',
            cache: false,
            beforeSend: function (xhr) { xhr.setRequestHeader('X-WP-Nonce', nonce); },
            success: function (data) { if (callback) callback(data); }
        });
    }

    function fetchCommunitySpeciesPulse(callback) {
        return $.ajax({
            url: root + '/topics/species-pulse',
            method: 'GET',
            data: { limit: 5 },
            cache: false,
            beforeSend: function (xhr) { xhr.setRequestHeader('X-WP-Nonce', nonce); },
            success: function (data) { if (callback) callback(data); }
        });
    }

    function markCommunityTopicRead(id, callback) {
        return $.ajax({
            url: root + '/topics/' + id + '/mark-read',
            method: 'POST',
            beforeSend: function (xhr) { xhr.setRequestHeader('X-WP-Nonce', nonce); },
            success: function (data) { if (callback) callback(data); }
        });
    }

    function markAllCommunityRead(callback) {
        return $.ajax({
            url: root + '/topics/mark-read',
            method: 'POST',
            beforeSend: function (xhr) { xhr.setRequestHeader('X-WP-Nonce', nonce); },
            success: function (data) { if (callback) callback(data); }
        });
    }

    function reactToTopic(id, reaction, callback) {
        return $.ajax({
            url: root + '/topics/' + id + '/reactions',
            method: 'POST',
            data: { reaction: reaction },
            beforeSend: function (xhr) { xhr.setRequestHeader('X-WP-Nonce', nonce); },
            success: function (data) { if (callback) callback(data); },
            error: function () { SetaeCore.showToast('リアクションに失敗しました', 'error'); }
        });
    }

    function reactToTopicComment(id, reaction, callback) {
        return $.ajax({
            url: root + '/topics/comments/' + id + '/reactions',
            method: 'POST',
            data: { reaction: reaction },
            beforeSend: function (xhr) { xhr.setRequestHeader('X-WP-Nonce', nonce); },
            success: function (data) { if (callback) callback(data); },
            error: function () { SetaeCore.showToast('リアクションに失敗しました', 'error'); }
        });
    }

    function updateTopicStatus(id, status, callback) {
        return $.ajax({
            url: root + '/topics/' + id + '/status',
            method: 'POST',
            data: { status: status },
            beforeSend: function (xhr) { xhr.setRequestHeader('X-WP-Nonce', nonce); },
            success: function (data) { if (callback) callback(data); },
            error: function (xhr) {
                const msg = xhr.responseJSON && xhr.responseJSON.message ? xhr.responseJSON.message : '状態の更新に失敗しました';
                SetaeCore.showToast(msg, 'error');
            }
        });
    }

    function setBestAnswer(topicId, commentId, callback) {
        return $.ajax({
            url: root + '/topics/' + topicId + '/best-answer',
            method: 'POST',
            data: { comment_id: commentId || 0 },
            beforeSend: function (xhr) { xhr.setRequestHeader('X-WP-Nonce', nonce); },
            success: function (data) { if (callback) callback(data); },
            error: function (xhr) {
                const msg = xhr.responseJSON && xhr.responseJSON.message ? xhr.responseJSON.message : 'ベスト回答の更新に失敗しました';
                SetaeCore.showToast(msg, 'error');
            }
        });
    }

    function postComment(topicId, content, file, callback) {
        // FormDataを作成
        const formData = new FormData();
        formData.append('content', content);

        // ファイルがある場合のみ追加
        if (file) {
            formData.append('image', file);
        }

        return $.ajax({
            url: root + '/topics/' + topicId + '/comments',
            method: 'POST',
            data: formData,    // ★変更: オブジェクトではなくFormDataを送信
            processData: false, // ★追加: FormData送信に必須
            contentType: false, // ★追加: FormData送信に必須
            beforeSend: function (xhr) { xhr.setRequestHeader('X-WP-Nonce', nonce); },
            success: function (res) { if (callback) callback(res); },
            error: function (xhr) {
                const msg = xhr.responseJSON && xhr.responseJSON.message ? xhr.responseJSON.message : 'コメント投稿に失敗しました';
                SetaeCore.showToast(msg, 'error');
            }
        });
    }

    // --- Community API End ---

    return {
        fetchAppBootstrap: fetchAppBootstrap,
        fetchOperations: fetchOperations,
        registerUser: registerUser,
        fetchSession: fetchSession,
        createSession: createSession,
        deleteSession: deleteSession,
        requestPasswordReset: requestPasswordReset,
        verifyEmail: verifyEmail,
        fetchCurrentUser: fetchCurrentUser,
        updateCurrentUser: updateCurrentUser,
        submitSpeciesSuggestion: submitSpeciesSuggestion,
        trackMetricEvent: trackMetricEvent,
        fetchMySpiders: fetchMySpiders,
        fetchArchivedSpiders: fetchArchivedSpiders,
        fetchBabyGroups: fetchBabyGroups,
        createBabyGroup: createBabyGroup,
        getBabyGroup: getBabyGroup,
        updateBabyGroup: updateBabyGroup,
        deleteBabyGroup: deleteBabyGroup,
        bulkUpdateBabyGroup: bulkUpdateBabyGroup,
        promoteBabyToSpiders: promoteBabyToSpiders,
        fetchQrTargets: fetchQrTargets,
        resolveQrTarget: resolveQrTarget,
        saveQrRecords: saveQrRecords,
        updateQrSpiderSettings: updateQrSpiderSettings,
        fetchQrTransfers: fetchQrTransfers,
        respondQrTransfer: respondQrTransfer,
        markQrNotificationsRead: markQrNotificationsRead,
        updateSpider: updateSpider,
        setSpiderArchived: setSpiderArchived,
        setSpiderFavorite: setSpiderFavorite,
        updateSpiderStatus: updateSpiderStatus,
        createSpider: createSpider,
        addSpider: addSpider,
        getSpiderDetail: getSpiderDetail,
        getSpiderEvents: getSpiderEvents,
        deleteSpider: deleteSpider,
        getSpeciesDetail: function (id, callback, errorCallback) {
            $.ajax({
                url: root + '/species/' + id,
                method: 'GET',
                success: function (data) { if (callback) callback(data); },
                error: function (xhr) {
                    if (errorCallback) errorCallback(xhr);
                    SetaeCore.showToast('種情報の取得に失敗しました', 'error');
                }
            });
        },
        fetchCareSummary: fetchCareSummary,
        fetchFeederDashboard: fetchFeederDashboard,
        recordFeederAction: recordFeederAction,
        createFeederEggBatch: createFeederEggBatch,
        updateFeederEggBatch: updateFeederEggBatch,
        logEvent: logEvent,
        deleteLog: deleteLog,
        updateLog: updateLog,
        fetchSpecies: fetchSpecies,
        searchSpecies: fetchSpecies, // Alias
        getSpeciesStats: getSpeciesStats, // Add to public interface
        fetchCareFeed: fetchCareFeed,
        getCareFeedDetail: getCareFeedDetail,
        postCareFeedComment: postCareFeedComment,
        unshareCareFeedItem: unshareCareFeedItem,
        shareLogToCareFeed: shareLogToCareFeed,
        deleteCareFeedComment: deleteCareFeedComment,
        reportCareFeedItem: reportCareFeedItem,
        reactToCareFeedItem: reactToCareFeedItem,
        reportCareFeedComment: reportCareFeedComment,
        fetchCareFeedUnread: fetchCareFeedUnread,
        markCareFeedRead: markCareFeedRead,
        fetchSocialRelationships: fetchSocialRelationships,
        followUser: followUser,
        unfollowUser: unfollowUser,
        blockUser: blockUser,
        unblockUser: unblockUser,
        fetchTopics: fetchTopics,
        createTopic: createTopic,
        getTopicDetail: getTopicDetail,
        fetchCommunityUnread: fetchCommunityUnread,
        fetchCommunitySpeciesPulse: fetchCommunitySpeciesPulse,
        markCommunityTopicRead: markCommunityTopicRead,
        markAllCommunityRead: markAllCommunityRead,
        reactToTopic: reactToTopic,
        reactToTopicComment: reactToTopicComment,
        updateTopicStatus: updateTopicStatus,
        setBestAnswer: setBestAnswer,
        postComment: postComment
    };

})(jQuery);
