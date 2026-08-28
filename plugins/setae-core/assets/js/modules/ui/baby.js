var SetaeUIBaby = (function ($) {
    'use strict';

    let currentGroupId = null;
    let currentGroup = null;
    let currentFilter = 'all';
    let isBound = false;
    let speciesSearchTimer = null;
    let parentOptionsLoaded = false;
    let parentSpiders = [];
    let isGroupManageOpen = false;
    let activeGroups = [];
    let archivedGroups = [];
    let currentGroupScope = 'active';
    let createModalOpen = false;
    let createModalTrigger = null;

    function confirmBabyAction(options) {
        if (SetaeCore && typeof SetaeCore.confirmAction === 'function') {
            return SetaeCore.confirmAction(options);
        }
        return Promise.resolve(window.confirm(String(options && options.message ? options.message : 'この操作を続けますか？')));
    }

    function escapeHtml(value) {
        return String(value === null || value === undefined ? '' : value).replace(/[&<>"']/g, function (char) {
            return {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#039;'
            }[char];
        });
    }

    function today() {
        const now = new Date();
        const local = new Date(now.getTime() - (now.getTimezoneOffset() * 60000));
        return local.toISOString().split('T')[0];
    }

    function bind() {
        if (isBound) return;
        isBound = true;

        $(document).on('submit', '#baby-group-form', handleCreateGroup);
        $(document).on('click', '.baby-group-card', handleGroupClick);
        $(document).on('submit', '#baby-bulk-form', handleBulkSubmit);
        $(document).on('click', '.baby-code-cell', handleCodeCellClick);
        $(document).on('click', '#baby-select-all-alive', handleSelectAllAlive);
        $(document).on('click', '#baby-clear-selection', handleClearSelection);
        $(document).on('input', '#baby-bulk-codes', handleBulkCodesInput);
        $(document).on('change', '#baby-bulk-event', handleBulkCodesInput);
        $(document).on('click', '.baby-filter-btn', handleFilterClick);
        $(document).on('click', '#baby-copy-all-codes', handleCopyAllCodes);
        $(document).on('click', '#baby-copy-alive-codes', handleCopyAliveCodes);
        $(document).on('click', '#baby-print-labels', handlePrintLabels);
        $(document).on('click', '#baby-download-csv', handleDownloadCsv);
        $(document).on('click', '.baby-range-chip', handleRangeChipClick);
        $(document).on('click', '.baby-recent-item', handleRecentItemClick);
        $(document).on('input', '#baby-group-species', handleSpeciesSearchInput);
        $(document).on('click', '#baby-species-suggestions .baby-suggestion-item', handleSpeciesSuggestionClick);
        $(document).on('input', '#baby-parent-search', handleParentFilterInput);
        $(document).on('click', '#baby-toggle-create', handleToggleCreate);
        $(document).on('click', '.js-open-baby-create', handleToggleCreate);
        $(document).on('click', '.js-close-baby-create', function (e) {
            e.preventDefault();
            setCreateFormOpen(false);
        });
        $(document).on('input', '#baby-group-prefix, #baby-group-count', handleBabyNumberInput);
        $(document).on('click', '#baby-toggle-group-settings', handleToggleGroupSettings);
        $(document).on('submit', '#baby-group-settings-form', handleUpdateGroup);
        $(document).on('click', '#baby-delete-group', handleDeleteGroup);
        $(document).on('click', '#baby-archive-group', handleArchiveGroup);
        $(document).on('click', '#baby-restore-group', handleRestoreGroup);
        $(document).on('click', '#baby-promote-selected', handlePromoteSelected);
        $(document).on('click', '.baby-group-scope-btn', handleGroupScopeClick);
        $(document).on('click', '.baby-parent-visual', handleParentVisualClick);
        $(document).on('click', '.js-retry-baby-groups', function () {
            loadGroups(currentGroupId);
        });
        $(document).on('click', '.js-retry-baby-detail', function () {
            const id = $(this).data('id');
            if (id) loadGroupDetail(id);
        });
        $(document).on('click', function (e) {
            if (!$(e.target).closest('#baby-species-search-wrapper').length) {
                $('#baby-species-suggestions').hide();
            }
        });
        $(document).on('keydown.setaeBabyCreate', function (e) {
            if (!createModalOpen) return;
            if (e.key === 'Escape') {
                e.preventDefault();
                if ($('#baby-species-suggestions').is(':visible')) {
                    $('#baby-species-suggestions').hide();
                } else {
                    setCreateFormOpen(false);
                }
                return;
            }
            if (e.key === 'Tab') trapBabyCreateFocus(e);
        });
    }

    function loadGroups(selectId) {
        bind();
        ensureParentOptions();
        $('#baby-group-list').attr('aria-busy', 'true').html(`
            <div class="setae-view-state" role="status">
                <span class="setae-view-state-mark" aria-hidden="true"></span>
                <strong>ベビー群を読み込んでいます</strong>
            </div>
        `);

        SetaeAPI.fetchBabyGroups(function (res) {
            $('#baby-group-list').removeAttr('aria-busy');
            activeGroups = res && Array.isArray(res.items) ? res.items : [];
            archivedGroups = res && Array.isArray(res.archived_items) ? res.archived_items : [];

            const targetId = selectId || currentGroupId;
            const targetGroup = findGroupById(targetId);
            if (targetGroup) {
                currentGroupScope = targetGroup.archived ? 'archived' : 'active';
            }

            renderBabyDashboard(res && res.summary ? res.summary : null);
            renderGroupScope();

            const visibleGroups = getGroupsForCurrentScope();
            const resolvedId = targetGroup ? targetGroup.id : (visibleGroups[0] && visibleGroups[0].id);
            if (resolvedId) {
                loadGroupDetail(resolvedId);
            } else {
                currentGroupId = null;
                currentGroup = null;
                renderEmptyDetail();
            }
        }, function (xhr) {
            const message = SetaeCore.getErrorMessage
                ? SetaeCore.getErrorMessage(xhr, '通信状態を確認して、もう一度お試しください。')
                : '通信状態を確認して、もう一度お試しください。';
            $('#baby-group-list').removeAttr('aria-busy').html(`
                <div class="setae-view-state is-error" role="alert">
                    <span class="setae-view-state-mark" aria-hidden="true"></span>
                    <strong>ベビー群を読み込めませんでした</strong>
                    <p>${escapeHtml(message)}</p>
                    <button type="button" class="js-retry-baby-groups">もう一度読み込む</button>
                </div>
            `);
            $('#baby-group-detail').html('');
        });
    }

    function findGroupById(id) {
        if (!id) return null;
        return activeGroups.concat(archivedGroups).find(function (group) {
            return String(group.id) === String(id);
        }) || null;
    }

    function getGroupsForCurrentScope() {
        return currentGroupScope === 'archived' ? archivedGroups : activeGroups;
    }

    function renderGroupScope() {
        const visibleGroups = getGroupsForCurrentScope();
        renderGroupScopeTabs();
        renderGroupList(visibleGroups);
        updateBabyNumberPreview();
    }

    function renderGroupScopeTabs() {
        const $tabs = $('#baby-group-scope-tabs');
        if (!$tabs.length) return;

        $tabs.html(`
            <button type="button" class="baby-group-scope-btn${currentGroupScope === 'active' ? ' active' : ''}" data-scope="active" role="tab" aria-selected="${currentGroupScope === 'active' ? 'true' : 'false'}">管理中 <b>${escapeHtml(activeGroups.length)}</b></button>
            <button type="button" class="baby-group-scope-btn${currentGroupScope === 'archived' ? ' active' : ''}" data-scope="archived" role="tab" aria-selected="${currentGroupScope === 'archived' ? 'true' : 'false'}">アーカイブ <b>${escapeHtml(archivedGroups.length)}</b></button>
        `);
    }

    function handleGroupScopeClick(e) {
        e.preventDefault();
        const scope = $(this).data('scope') === 'archived' ? 'archived' : 'active';
        if (scope === currentGroupScope) return;

        currentGroupScope = scope;
        currentGroupId = null;
        currentGroup = null;
        isGroupManageOpen = false;
        renderGroupScope();

        const groups = getGroupsForCurrentScope();
        if (groups.length) {
            loadGroupDetail(groups[0].id);
        } else {
            renderEmptyDetail();
        }
    }

    function ensureParentOptions() {
        if (parentOptionsLoaded) {
            renderParentOptions();
            return;
        }

        if (Array.isArray(SetaeCore.state.cachedSpiders) && SetaeCore.state.cachedSpiders.length) {
            parentOptionsLoaded = true;
            parentSpiders = SetaeCore.state.cachedSpiders;
            renderParentOptions();
            return;
        }

        if (SetaeAPI.fetchMySpiders) {
            SetaeAPI.fetchMySpiders(function (spiders) {
                parentOptionsLoaded = true;
                parentSpiders = Array.isArray(spiders) ? spiders : [];
                renderParentOptions();
            });
        } else {
            parentOptionsLoaded = true;
            parentSpiders = Array.isArray(SetaeCore.state.cachedSpiders) ? SetaeCore.state.cachedSpiders : [];
            renderParentOptions();
        }
    }

    function renderParentOptions(spiders) {
        if (Array.isArray(spiders)) {
            parentSpiders = spiders;
        }
        const $selects = $('.baby-parent-select');
        if (!$selects.length) return;

        const selectedIds = $selects.map(function () {
            return String($(this).val() || '');
        }).get().filter(Boolean);
        const filtered = getFilteredParentSpiders();
        const byId = new Map(parentSpiders.map(spider => [String(spider.id), spider]));

        selectedIds.forEach(function (id) {
            if (!filtered.some(spider => String(spider.id) === id) && byId.has(id)) {
                filtered.push(byId.get(id));
            }
        });

        const options = ['<option value="">未選択</option>'].concat(filtered.map(spider => {
            const title = spider.title || '個体';
            const species = spider.species_name ? ' / ' + spider.species_name : '';
            return `<option value="${escapeHtml(spider.id)}">${escapeHtml(title + species)}</option>`;
        })).join('');

        $selects.each(function () {
            const value = $(this).val();
            $(this).html(options);
            if (value) {
                $(this).val(value);
            }
        });
    }

    function getFilteredParentSpiders() {
        const speciesId = String($('#baby-group-species-id').val() || '');
        const speciesTerm = normalizeSearchTerm($('#baby-group-species').val());
        const parentSearch = normalizeSearchTerm($('#baby-parent-search').val());
        const hasSpeciesFilter = !!speciesId || speciesTerm.length >= 2;

        return parentSpiders.filter(function (spider) {
            const spiderSpeciesId = String(spider.species_id || '');
            const speciesName = normalizeSearchTerm(spider.species_name || '');
            const title = normalizeSearchTerm(spider.title || '');
            const speciesMatches = !hasSpeciesFilter
                || (speciesId && spiderSpeciesId === speciesId)
                || (!speciesId && speciesName.indexOf(speciesTerm) !== -1);
            const searchMatches = !parentSearch
                || title.indexOf(parentSearch) !== -1
                || speciesName.indexOf(parentSearch) !== -1;
            return speciesMatches && searchMatches;
        });
    }

    function normalizeSearchTerm(value) {
        return String(value || '').normalize('NFKC').trim().toLowerCase();
    }

    function handleParentFilterInput() {
        renderParentOptions();
    }

    function setCreateFormOpen(isOpen) {
        const $modal = $('#baby-create-modal');
        if (!$modal.length) return;

        if (isOpen) {
            if (!createModalOpen) createModalTrigger = document.activeElement;
            createModalOpen = true;
            prepareCreateFormDefaults();
            updateBabyNumberPreview();
            $modal.css('display', 'flex').attr('aria-hidden', 'false');
            $('body').addClass('setae-baby-create-open');
            $('#baby-toggle-create').attr('aria-expanded', 'true');
            window.setTimeout(function () {
                $('#baby-group-name').trigger('focus');
            }, 40);
            return;
        }

        createModalOpen = false;
        $modal.hide().attr('aria-hidden', 'true');
        $('body').removeClass('setae-baby-create-open');
        $('#baby-toggle-create').attr('aria-expanded', 'false');
        $('#baby-species-suggestions').hide();
        if (createModalTrigger && document.contains(createModalTrigger)) {
            createModalTrigger.focus();
        }
    }

    function handleToggleCreate(e) {
        e.preventDefault();
        setCreateFormOpen(true);
    }

    function trapBabyCreateFocus(e) {
        const dialog = document.querySelector('#baby-create-modal .baby-create-dialog');
        if (!dialog) return;
        const focusable = Array.from(dialog.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')).filter(function (element) {
            return !element.hidden && element.offsetParent !== null;
        });
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
        }
    }

    function prepareCreateFormDefaults() {
        const hasDraft = String($('#baby-group-name').val() || '').trim()
            || String($('#baby-group-species').val() || '').trim()
            || String($('#baby-group-parent-note').val() || '').trim();
        const currentPrefix = normalizeBabyPrefix($('#baby-group-prefix').val());
        if (!hasDraft && (!currentPrefix || findPrefixConflict(currentPrefix))) {
            $('#baby-group-prefix').val(suggestAvailablePrefix());
        }
    }

    function handleBabyNumberInput(e) {
        if (e && e.target && e.target.id === 'baby-group-prefix') {
            const normalized = normalizeBabyPrefix(e.target.value);
            if (e.target.value !== normalized) e.target.value = normalized;
        }
        updateBabyNumberPreview();
    }

    function normalizeBabyPrefix(value) {
        return String(value || '').normalize('NFKC').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    }

    function getUsedBabyPrefixes() {
        return activeGroups.concat(archivedGroups).reduce(function (map, group) {
            const prefix = normalizeBabyPrefix(group && group.prefix);
            if (prefix && !map.has(prefix)) map.set(prefix, group);
            return map;
        }, new Map());
    }

    function findPrefixConflict(prefix) {
        return getUsedBabyPrefixes().get(normalizeBabyPrefix(prefix)) || null;
    }

    function suggestAvailablePrefix() {
        const used = getUsedBabyPrefixes();
        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        for (let index = 0; index < alphabet.length; index++) {
            const candidate = alphabet.charAt(index);
            if (!used.has(candidate)) return candidate;
        }
        for (let suffix = 2; suffix <= 999; suffix++) {
            for (let index = 0; index < alphabet.length; index++) {
                const candidate = alphabet.charAt(index) + suffix;
                if (!used.has(candidate)) return candidate;
            }
        }
        return 'B' + Date.now().toString(36).slice(-5).toUpperCase();
    }

    function updateBabyNumberPreview() {
        const prefix = normalizeBabyPrefix($('#baby-group-prefix').val());
        const countValue = parseInt($('#baby-group-count').val(), 10);
        const count = Math.max(1, Math.min(500, Number.isFinite(countValue) ? countValue : 1));
        const displayPrefix = prefix || 'B';
        const padding = Math.max(3, String(count).length);
        const firstCode = formatBabyCode(displayPrefix, 1, padding);
        const lastCode = formatBabyCode(displayPrefix, count, padding);
        const conflict = findPrefixConflict(displayPrefix);
        const $feedback = $('#baby-prefix-feedback');
        const $input = $('#baby-group-prefix');
        const $submit = $('#baby-group-form button[type="submit"]');

        $('#baby-number-preview').text(firstCode + '-' + lastCode + 'で作成');
        $feedback.removeClass('is-error is-ok');
        $input.removeClass('is-invalid');

        if (!prefix) {
            $feedback.addClass('is-error').text('半角英数字で頭文字を入力してください');
            $input.addClass('is-invalid');
            $submit.prop('disabled', true);
            return;
        }

        if (conflict) {
            const scope = conflict.archived ? 'アーカイブ済み' : '管理中';
            $feedback.addClass('is-error').text(scope + 'の「' + (conflict.name || displayPrefix) + '」で使用中です');
            $input.addClass('is-invalid');
            $submit.prop('disabled', true);
            return;
        }

        $feedback.addClass('is-ok').text('この頭文字は使用できます');
        $submit.prop('disabled', false);
    }

    function getSelectedParentSpiderIds() {
        return $('.baby-parent-select').map(function () {
            return $(this).val();
        }).get().filter(Boolean).filter(function (id, index, ids) {
            return ids.indexOf(id) === index;
        });
    }

    function renderBabyVisual(image, label, className) {
        const hasImage = !!String(image || '').trim();
        if (!hasImage) {
            return `<span class="baby-visual ${className || ''} is-fallback" aria-hidden="true">🕷</span>`;
        }
        return `<span class="baby-visual ${className || ''} has-image"><img src="${escapeHtml(image)}" alt="${escapeHtml(label || '')}" loading="lazy"></span>`;
    }

    function renderGroupVisual(group, className) {
        const label = group.species_name || group.name || 'ベビー群';
        return renderBabyVisual(group.species_image, label, className || 'baby-group-visual');
    }

    function renderParentVisuals(parents) {
        if (!Array.isArray(parents) || !parents.length) return '';

        return `
            <div class="baby-parent-visuals" aria-label="親個体">
                ${parents.map(function (parent) {
                    const label = parent.title || '親個体';
                    return `
                        <button type="button" class="baby-parent-visual" data-spider-id="${escapeHtml(parent.id)}" title="親個体 ${escapeHtml(label)} を開く">
                            ${renderBabyVisual(parent.image, label, 'baby-parent-avatar')}
                            <span>${escapeHtml(label)}</span>
                        </button>
                    `;
                }).join('')}
            </div>
        `;
    }

    function renderBabyDashboard(summary) {
        const $dashboard = $('#baby-dashboard');
        if (!$dashboard.length) return;

        const data = summary && typeof summary === 'object' ? summary : {};
        const groupsTotal = parseInt(data.groups_total, 10) || 0;
        if (!groupsTotal) {
            $dashboard.hide().empty();
            return;
        }

        const species = Array.isArray(data.species) ? data.species : [];
        const visibleSpecies = species.slice(0, 8);
        const moreSpecies = species.length - visibleSpecies.length;
        const speciesHtml = visibleSpecies.length ? `
            <div class="baby-dashboard-species">
                <div class="baby-dashboard-species-head">
                    <strong>種類ごとの飼育記録</strong>
                    <span>${escapeHtml(data.archived_groups || 0)}群をアーカイブ</span>
                </div>
                <div class="baby-dashboard-species-list">
                    ${visibleSpecies.map(function (item) {
                        const count = parseInt(item.count, 10) || 0;
                        const groups = parseInt(item.groups, 10) || 0;
                        return `
                            <div class="baby-dashboard-species-item">
                                ${renderBabyVisual(item.image, item.name || '種類未設定', 'baby-dashboard-species-image')}
                                <div>
                                    <strong>${escapeHtml(item.name || '種類未設定')}</strong>
                                    <span>${escapeHtml(count)}匹を管理 / ${escapeHtml(groups)}群</span>
                                </div>
                            </div>
                        `;
                    }).join('')}
                    ${moreSpecies > 0 ? `<span class="baby-dashboard-species-more">ほか ${escapeHtml(moreSpecies)}種類</span>` : ''}
                </div>
            </div>
        ` : '';

        $dashboard.html(`
            <div class="baby-dashboard-overview">
                <div class="baby-dashboard-intro">
                    <div>
                        <span>ベビー飼育の記録</span>
                        <strong>${escapeHtml(groupsTotal)}群の歩み</strong>
                    </div>
                    <p>いま管理しているベビーと、これまでの飼育記録</p>
                </div>
                <div class="baby-dashboard-metrics">
                    <span><b>${escapeHtml(data.babies_total || 0)}</b>累計管理</span>
                    <span><b>${escapeHtml(data.currently_managed || 0)}</b>現在管理</span>
                    <span><b>${escapeHtml(data.transferred || 0)}</b>マイ個体へ</span>
                    <span><b>${escapeHtml(data.rehomed || 0)}</b>譲渡</span>
                    <span><b>${escapeHtml(data.dead || 0)}</b>死亡</span>
                </div>
            </div>
            ${speciesHtml}
        `).show();
    }

    function renderGroupList(groups) {
        const $list = $('#baby-group-list');
        if (!$list.length) return;

        if (!groups.length) {
            const isArchived = currentGroupScope === 'archived';
            $list.html(`
                <div class="setae-empty-state baby-empty">
                    <span class="empty-icon">#</span>
                    <h3>${isArchived ? 'アーカイブ済みの群はありません' : 'ベビー群を追加しましょう'}</h3>
                    <p>${isArchived ? '管理を終えたベビー群の記録がここに並びます。' : 'ベビーは個体カードを増やさず、A001-A100のような番号でまとめて管理できます。'}</p>
                    ${isArchived ? '' : '<button type="button" class="baby-empty-create js-open-baby-create" aria-haspopup="dialog" aria-controls="baby-create-modal">最初のベビー群を追加</button>'}
                </div>
            `);
            return;
        }

        $list.html(groups.map(group => {
            const stats = group.stats || {};
            const padding = Math.max(3, String(group.count || '').length);
            const firstCode = formatBabyCode(group.prefix || 'B', 1, padding);
            const lastCode = formatBabyCode(group.prefix || 'B', parseInt(group.count, 10) || 0, padding);
            const archived = !!group.archived;
            return `
                <button type="button" class="setae-card baby-group-card${String(group.id) === String(currentGroupId) ? ' active' : ''}${archived ? ' is-archived' : ''}" data-id="${escapeHtml(group.id)}">
                    <div class="baby-group-card-head">
                        ${renderGroupVisual(group, 'baby-group-visual')}
                        <div class="baby-group-card-identity">
                            <strong>${escapeHtml(group.name)}</strong>
                            <span>${escapeHtml(firstCode)}-${escapeHtml(lastCode)}</span>
                            ${group.species_name ? `<em>${escapeHtml(group.species_name)}</em>` : ''}
                            ${archived ? '<i>アーカイブ</i>' : ''}
                        </div>
                    </div>
                    ${renderGroupMiniStats(stats)}
                    ${renderGroupStatusPills(stats)}
                </button>
            `;
        }).join(''));
    }

    function renderGroupStatusPills(stats) {
        const alive = parseInt(stats.alive, 10) || 0;
        const molted = parseInt(stats.molted, 10) || 0;
        const rehomed = parseInt(stats.rehomed, 10) || 0;
        const dead = parseInt(stats.dead, 10) || 0;
        const transferred = parseInt(stats.transferred, 10) || 0;
        const pills = [
            `<span>管理 ${escapeHtml(alive)}</span>`,
            `<span>脱皮 ${escapeHtml(molted)}</span>`
        ];
        if (rehomed) pills.push(`<span>譲渡 ${escapeHtml(rehomed)}</span>`);
        if (transferred) pills.push(`<span>マイ個体 ${escapeHtml(transferred)}</span>`);
        if (dead) pills.push(`<span>死亡 ${escapeHtml(dead)}</span>`);
        return `<div class="baby-group-stats">${pills.join('')}</div>`;
    }

    function renderGroupMiniStats(stats) {
        const total = Math.max(parseInt(stats.total, 10) || 0, 1);
        const alivePct = Math.round(((parseInt(stats.alive, 10) || 0) / total) * 100);
        const transferredPct = Math.round(((parseInt(stats.transferred, 10) || 0) / total) * 100);
        const rehomedPct = Math.round(((parseInt(stats.rehomed, 10) || 0) / total) * 100);
        const deadPct = Math.round(((parseInt(stats.dead, 10) || 0) / total) * 100);
        const moltedPct = Math.round(((parseInt(stats.molted, 10) || 0) / total) * 100);

        return `
            <div class="baby-group-mini-chart" aria-label="ベビー群の状態">
                <div class="baby-group-survival">
                    <span class="is-alive" style="width:${alivePct}%"></span>
                    <span class="is-transferred" style="width:${transferredPct}%"></span>
                    <span class="is-rehomed" style="width:${rehomedPct}%"></span>
                    <span class="is-dead" style="width:${deadPct}%"></span>
                </div>
                <div class="baby-group-molt">
                    <span style="width:${moltedPct}%"></span>
                </div>
            </div>
        `;
    }

    function renderEmptyDetail() {
        const isArchived = currentGroupScope === 'archived';
        $('#baby-group-detail').html(`
            <div class="setae-card baby-guide-card">
                <strong>${isArchived ? 'アーカイブ済みのベビー群を選択してください' : '付箋運用をアプリに写す場所'}</strong>
                <p>${isArchived ? '管理を終えた群の記録をここから確認できます。' : 'ケースには A001 のように番号を貼り、脱皮・死亡・譲渡が起きた番号だけ後からまとめて入力します。'}</p>
            </div>
        `);
    }

    function loadGroupDetail(id) {
        if (String(id) !== String(currentGroupId)) {
            isGroupManageOpen = false;
        }
        currentGroupId = id;
        $('#baby-group-detail').attr('aria-busy', 'true').html(`
            <div class="setae-view-state" role="status">
                <span class="setae-view-state-mark" aria-hidden="true"></span>
                <strong>ベビー群の詳細を読み込んでいます</strong>
            </div>
        `);

        SetaeAPI.getBabyGroup(id, function (group) {
            $('#baby-group-detail').removeAttr('aria-busy');
            currentGroup = group;
            currentGroupId = group.id;
            $('.baby-group-card').removeClass('active');
            $(`.baby-group-card[data-id="${group.id}"]`).addClass('active');
            renderGroupDetail(group);
        }, function (xhr) {
            const message = SetaeCore.getErrorMessage
                ? SetaeCore.getErrorMessage(xhr, '通信状態を確認して、もう一度お試しください。')
                : '通信状態を確認して、もう一度お試しください。';
            $('#baby-group-detail').removeAttr('aria-busy').html(`
                <div class="setae-view-state is-error" role="alert">
                    <span class="setae-view-state-mark" aria-hidden="true"></span>
                    <strong>ベビー群の詳細を読み込めませんでした</strong>
                    <p>${escapeHtml(message)}</p>
                    <button type="button" class="js-retry-baby-detail" data-id="${escapeHtml(id)}">もう一度読み込む</button>
                </div>
            `);
        });
    }

    function renderGroupDetail(group) {
        const stats = group.stats || {};
        const items = Array.isArray(group.items) ? group.items : [];
        const birth = group.birth_date ? `<span>孵化/発見 ${escapeHtml(group.birth_date)}</span>` : '';
        const species = group.species_name ? `<span>${escapeHtml(group.species_name)}</span>` : '';
        const parents = Array.isArray(group.parent_spiders) ? group.parent_spiders : [];
        const parentNote = group.parent_note ? `<p class="baby-parent-note">${escapeHtml(group.parent_note)}</p>` : '';
        const isArchived = !!group.archived;
        const canPromote = isPremiumUser();
        const promoteButtonClass = canPromote ? '' : ' is-premium-locked';
        const promoteButtonTitle = canPromote ? '選択した番号をマイ個体へ移動' : 'プレミアム会員限定';

        $('#baby-group-detail').html(`
            <div class="setae-card baby-detail-card">
                <div class="baby-detail-summary">
                    <div class="baby-detail-identity-wrap">
                        ${renderGroupVisual(group, 'baby-detail-visual')}
                        <div class="baby-detail-identity">
                            <div class="baby-detail-title-row">
                                <strong>${escapeHtml(group.name)}</strong>
                                ${isArchived ? '<span class="baby-detail-archive-badge">アーカイブ</span>' : ''}
                            </div>
                            <div class="baby-detail-meta">
                                ${birth}
                                ${species}
                                <span>総数 ${escapeHtml(stats.total || group.count || 0)}</span>
                            </div>
                            ${renderParentVisuals(parents)}
                            ${parentNote}
                        </div>
                    </div>
                    <div class="baby-detail-summary-side">
                        <div class="baby-detail-counts">
                            <span>管理 <b>${escapeHtml(stats.alive || 0)}</b></span>
                            <span>脱皮済 <b>${escapeHtml(stats.molted || 0)}</b></span>
                            <span>譲渡 <b>${escapeHtml(stats.rehomed || 0)}</b></span>
                            <span>死亡 <b>${escapeHtml(stats.dead || 0)}</b></span>
                            <span>マイ個体 <b>${escapeHtml(stats.transferred || 0)}</b></span>
                        </div>
                        <div class="baby-detail-manage-actions">
                            <button type="button" id="baby-toggle-group-settings" class="care-feed-action-btn" aria-controls="baby-group-settings" aria-expanded="${isGroupManageOpen ? 'true' : 'false'}" title="ベビー群の名前、アーカイブ、削除を管理">群を管理</button>
                        </div>
                    </div>
                </div>

                ${renderGroupManagement(group)}
                ${renderStatsPanel(stats, isArchived)}

                <div class="baby-detail-actions">
                    <div class="baby-copy-row">
                        <button type="button" id="baby-copy-all-codes" class="care-feed-action-btn">付箋用番号コピー</button>
                        <button type="button" id="baby-copy-alive-codes" class="care-feed-action-btn">管理中番号コピー</button>
                        <button type="button" id="baby-download-csv" class="care-feed-action-btn">CSV保存</button>
                        <button type="button" id="baby-print-labels" class="care-feed-action-btn">QRラベル</button>
                    </div>
                </div>

                ${isArchived
                    ? renderArchivedGroupWorkspace(group, items)
                    : renderActiveGroupWorkspace(group, items, canPromote, promoteButtonClass, promoteButtonTitle)}
            </div>
        `);

        currentFilter = 'all';
        updateSelectedCount();
        updateBulkPreview();
    }

    function renderActiveGroupWorkspace(group, items, canPromote, promoteButtonClass, promoteButtonTitle) {
        const prefix = escapeHtml(group.prefix || 'B');
        return `
            <div class="baby-workspace">
                <aside class="baby-command-panel">
                    <form id="baby-bulk-form" class="baby-bulk-form">
                        <div class="baby-bulk-row">
                            <label>
                                <span>記録</span>
                                <select id="baby-bulk-event" class="setae-input">
                                    <option value="molt">脱皮</option>
                                    <option value="dead">死亡</option>
                                    <option value="rehomed">譲渡</option>
                                    <option value="alive">管理を再開</option>
                                </select>
                            </label>
                            <label class="baby-date-field">
                                <span>日付</span>
                                <span class="baby-date-control">
                                    <input type="date" id="baby-bulk-date" class="setae-input" value="${today()}">
                                </span>
                            </label>
                        </div>
                        <label>
                            <span>番号</span>
                            <textarea id="baby-bulk-codes" class="setae-input" rows="2" placeholder="${prefix}001, ${prefix}005-${prefix}010"></textarea>
                        </label>
                        <div id="baby-code-preview" class="baby-code-preview" aria-live="polite">
                            番号を入力すると、記録前に対象件数を確認できます。
                        </div>
                        ${renderRangePresets(items)}
                        <label>
                            <span>メモ（任意）</span>
                            <input type="text" id="baby-bulk-note" class="setae-input" placeholder="例: 譲渡先へお渡し、まとめて確認">
                        </label>
                        <div class="baby-bulk-actions">
                            <span id="baby-selected-count">0件選択中</span>
                            <button type="button" id="baby-select-all-alive" class="setae-btn setae-btn-secondary">管理中を選択</button>
                            <button type="button" id="baby-clear-selection" class="setae-btn setae-btn-secondary">選択解除</button>
                            <button type="button" id="baby-promote-selected" class="setae-btn setae-btn-secondary${promoteButtonClass}" title="${escapeHtml(promoteButtonTitle)}" data-premium-required="${canPromote ? '0' : '1'}">マイ個体へ移動</button>
                            <button type="submit" class="setae-btn setae-btn-primary">まとめて記録</button>
                        </div>
                    </form>

                    ${renderRecentItems(items)}
                </aside>

                ${renderEditableNumberPanel(items)}
            </div>
        `;
    }

    function renderEditableNumberPanel(items) {
        return `
            <section class="baby-number-panel">
                <div class="baby-number-toolbar">
                    <div class="baby-number-heading">
                        <strong>番号一覧</strong>
                        <span>クリックで選択、状態ごとに絞り込み</span>
                    </div>
                    <div class="baby-filter-row" aria-label="表示切替">
                        <button type="button" class="baby-filter-btn active" data-filter="all">すべて</button>
                        <button type="button" class="baby-filter-btn" data-filter="unrecorded">未記録</button>
                        <button type="button" class="baby-filter-btn" data-filter="molted">脱皮済</button>
                        <button type="button" class="baby-filter-btn" data-filter="dead">死亡</button>
                        <button type="button" class="baby-filter-btn" data-filter="rehomed">譲渡済</button>
                        <button type="button" class="baby-filter-btn" data-filter="transferred">マイ個体</button>
                    </div>
                </div>

                <div class="baby-grid" aria-label="ベビー番号一覧">
                    ${items.map(renderBabyCell).join('')}
                </div>
            </section>
        `;
    }

    function renderArchivedGroupWorkspace(group, items) {
        const archivedDate = group.archived_at ? String(group.archived_at).slice(0, 10) : '';
        return `
            <div class="baby-archive-workspace">
                <div class="baby-archive-notice">
                    <div>
                        <strong>この群はアーカイブに保存されています</strong>
                        <span>${archivedDate ? `アーカイブ日 ${escapeHtml(archivedDate)}` : '記録はいつでも確認できます'}</span>
                    </div>
                    <p>一括記録やマイ個体への移動は止めています。再び管理する場合は「群を管理」から戻してください。</p>
                </div>
                <section class="baby-number-panel is-readonly">
                    <div class="baby-number-toolbar">
                        <div class="baby-number-heading">
                            <strong>番号の記録</strong>
                            <span>状態と履歴を読み取り専用で表示</span>
                        </div>
                    </div>
                    <div class="baby-grid" aria-label="アーカイブされたベビー番号一覧">
                        ${items.map(renderBabyCell).join('')}
                    </div>
                </section>
            </div>
        `;
    }

    function renderGroupManagement(group) {
        const isOpen = isGroupManageOpen;
        const archiveAction = group.archived
            ? '<button type="button" id="baby-restore-group" class="setae-btn setae-btn-secondary baby-restore-group">管理中に戻す</button>'
            : '<button type="button" id="baby-archive-group" class="setae-btn setae-btn-secondary baby-archive-group">アーカイブ</button>';
        return `
            <section id="baby-group-settings" class="baby-group-management${isOpen ? ' is-open' : ''}" aria-hidden="${isOpen ? 'false' : 'true'}">
                <form id="baby-group-settings-form" class="baby-group-settings-form">
                    <label>
                        <span>管理名</span>
                        <input type="text" id="baby-edit-group-name" class="setae-input" value="${escapeHtml(group.name)}" maxlength="120" required>
                    </label>
                    <div class="baby-group-settings-actions">
                        <button type="submit" class="setae-btn setae-btn-primary">名前を保存</button>
                        ${archiveAction}
                        <button type="button" id="baby-delete-group" class="setae-btn setae-btn-secondary baby-delete-group">この群を削除</button>
                    </div>
                </form>
            </section>
        `;
    }

    function renderStatsPanel(stats, isArchived) {
        const total = Math.max(parseInt(stats.total, 10) || 0, 0);
        const denominator = total || 1;
        const alive = Math.max(parseInt(stats.alive, 10) || 0, 0);
        const dead = Math.max(parseInt(stats.dead, 10) || 0, 0);
        const transferred = Math.max(parseInt(stats.transferred, 10) || 0, 0);
        const rehomed = Math.max(parseInt(stats.rehomed, 10) || 0, 0);
        const molted = Math.max(parseInt(stats.molted, 10) || 0, 0);
        const alivePct = Math.round((alive / denominator) * 100);
        const deadPct = Math.round((dead / denominator) * 100);
        const transferredPct = Math.round((transferred / denominator) * 100);
        const rehomedPct = Math.round((rehomed / denominator) * 100);
        const moltedPct = Math.round((molted / denominator) * 100);

        return `
            <div class="baby-stats-panel">
                <div class="baby-stats-header">
                    <strong>育成の流れ</strong>
                    <span>${escapeHtml(total)}匹中 ${escapeHtml(alive)}匹${isArchived ? 'を記録として保存中' : 'が管理中'}</span>
                </div>
                <div class="baby-survival-bar" aria-label="管理中、マイ個体、譲渡、死亡の割合">
                    <span class="is-alive" style="width:${alivePct}%"></span>
                    <span class="is-transferred" style="width:${transferredPct}%"></span>
                    <span class="is-rehomed" style="width:${rehomedPct}%"></span>
                    <span class="is-dead" style="width:${deadPct}%"></span>
                </div>
                <div class="baby-stats-metrics">
                    <span><b>${escapeHtml(alivePct)}%</b> 生存</span>
                    <span><b>${escapeHtml(moltedPct)}%</b> 脱皮経験</span>
                    <span><b>${escapeHtml(transferred)}</b> マイ個体へ</span>
                    <span><b>${escapeHtml(rehomed)}</b> 譲渡</span>
                    <span><b>${escapeHtml(dead)}</b> 死亡</span>
                </div>
                <div class="baby-molt-progress" aria-label="脱皮経験の割合">
                    <span style="width:${moltedPct}%"></span>
                </div>
            </div>
        `;
    }

    function getBabyItemStatus(item) {
        if (item && (item.status === 'transferred' || item.transferred_spider_id)) return 'transferred';
        if (item && item.status === 'rehomed') return 'rehomed';
        if (item && item.status === 'dead') return 'dead';
        return 'alive';
    }

    function isBabyItemClosed(item) {
        const status = getBabyItemStatus(item);
        return status === 'transferred' || status === 'rehomed';
    }

    function renderBabyCell(item) {
        const status = getBabyItemStatus(item);
        const isDead = status === 'dead';
        const isTransferred = status === 'transferred';
        const isRehomed = status === 'rehomed';
        const isMolted = !!item.last_molt;
        const bucket = isTransferred
            ? 'transferred'
            : (isRehomed ? 'rehomed' : (isDead ? 'dead' : (isMolted ? 'molted' : 'unrecorded')));
        const label = isTransferred
            ? 'マイ個体へ移動'
            : (isRehomed
                ? `譲渡 ${item.rehomed_date || ''}`
                : (isDead ? `死亡 ${item.death_date || ''}` : (isMolted ? `脱皮 ${item.last_molt}` : '未記録')));
        const details = buildItemDetail(item, label);
        return `
            <button type="button" class="baby-code-cell${isDead ? ' is-dead' : ''}${isMolted ? ' is-molted' : ''}${isTransferred ? ' is-transferred' : ''}${isRehomed ? ' is-rehomed' : ''}" data-code="${escapeHtml(item.code)}" data-status="${escapeHtml(status)}" data-filter="${bucket}" data-spider-id="${escapeHtml(item.transferred_spider_id || '')}" aria-label="${escapeHtml(details)}" title="${escapeHtml(details)}">
                <strong>${escapeHtml(item.code)}</strong>
                <span>${escapeHtml(label)}</span>
            </button>
        `;
    }

    function renderRangePresets(items) {
        if (!items.length) return '';

        const chunks = [];
        for (let i = 0; i < items.length; i += 10) {
            const chunk = items.slice(i, i + 10);
            const first = chunk[0] && chunk[0].code;
            const last = chunk[chunk.length - 1] && chunk[chunk.length - 1].code;
            const codes = chunk
                .filter(item => !isBabyItemClosed(item))
                .map(item => item.code)
                .filter(Boolean)
                .join(', ');
            if (first && last && codes) {
                chunks.push(`
                    <button type="button" class="baby-range-chip" data-codes="${escapeHtml(codes)}">
                        ${escapeHtml(first)}-${escapeHtml(last)}
                    </button>
                `);
            }
        }

        return `
            <div class="baby-range-panel" aria-label="番号範囲の入力補助">
                <div class="baby-section-title">
                    <strong>10匹ごとに選択</strong>
                    <span>範囲を押すと番号欄に入ります</span>
                </div>
                <div class="baby-range-row">
                    ${chunks.join('')}
                </div>
            </div>
        `;
    }

    function renderRecentItems(items) {
        const recent = items
            .filter(item => item.updated_at || item.last_molt || item.death_date || item.rehomed_at || item.transferred_at)
            .sort((a, b) => String(b.updated_at || b.transferred_at || b.rehomed_at || b.death_date || b.last_molt).localeCompare(String(a.updated_at || a.transferred_at || a.rehomed_at || a.death_date || a.last_molt)))
            .slice(0, 6);

        if (!recent.length) return '';

        return `
            <div class="baby-recent-panel">
                <div class="baby-section-title">
                    <strong>最近の記録</strong>
                    <span>押すと番号を選択します</span>
                </div>
                <div class="baby-recent-list">
                    ${recent.map(renderRecentItem).join('')}
                </div>
            </div>
        `;
    }

    function renderRecentItem(item) {
        const status = getBabyItemStatus(item);
        const label = status === 'transferred'
            ? 'マイ個体へ移動'
            : (status === 'rehomed'
                ? `譲渡 ${item.rehomed_date || ''}`
                : (status === 'dead' ? `死亡 ${item.death_date || ''}` : (item.last_molt ? `脱皮 ${item.last_molt}` : '更新あり')));
        const note = item.note ? `<em>${escapeHtml(item.note)}</em>` : '';
        return `
            <button type="button" class="baby-recent-item" data-code="${escapeHtml(item.code)}">
                <strong>${escapeHtml(item.code)}</strong>
                <span>${escapeHtml(label)}</span>
                ${note}
            </button>
        `;
    }

    function buildItemDetail(item, label) {
        const parts = [item.code, label];
        if (Array.isArray(item.molts) && item.molts.length) {
            parts.push('脱皮履歴: ' + item.molts.join(', '));
        }
        if (item.note) {
            parts.push('メモ: ' + item.note);
        }
        if (item.transferred_spider_id) {
            parts.push('マイ個体ID: ' + item.transferred_spider_id);
        }
        if (item.rehomed_date) {
            parts.push('譲渡日: ' + item.rehomed_date);
        }
        return parts.join(' / ');
    }

    function handleSpeciesSearchInput() {
        const term = String($(this).val() || '').trim();
        $('#baby-group-species-id').val('');
        renderParentOptions();

        if (speciesSearchTimer) {
            clearTimeout(speciesSearchTimer);
        }

        if (term.length < 2) {
            $('#baby-species-suggestions').hide().empty();
            return;
        }

        speciesSearchTimer = setTimeout(function () {
            SetaeAPI.searchSpecies(term, function (results) {
                renderSpeciesSuggestions(results || []);
            });
        }, 250);
    }

    function renderSpeciesSuggestions(results) {
        const $suggestions = $('#baby-species-suggestions');
        if (!$suggestions.length) return;

        if (!results.length) {
            $suggestions.hide().empty();
            return;
        }

        $suggestions.html(results.slice(0, 8).map(species => {
            const jaName = species.ja_name ? `<span>${escapeHtml(species.ja_name)}</span>` : '';
            return `
                <button type="button" class="baby-suggestion-item" data-id="${escapeHtml(species.id)}" data-name="${escapeHtml(species.title)}">
                    <strong>${escapeHtml(species.title)}</strong>
                    ${jaName}
                </button>
            `;
        }).join('')).show();
    }

    function handleSpeciesSuggestionClick(e) {
        e.preventDefault();
        $('#baby-group-species').val($(this).data('name') || '');
        $('#baby-group-species-id').val($(this).data('id') || '');
        $('#baby-species-suggestions').hide().empty();
        renderParentOptions();
    }

    function handleCreateGroup(e) {
        e.preventDefault();

        const form = $('#baby-group-form')[0];
        const prefix = normalizeBabyPrefix($('#baby-group-prefix').val());
        const conflict = findPrefixConflict(prefix);
        if (!prefix || conflict) {
            updateBabyNumberPreview();
            $('#baby-group-prefix').trigger('focus');
            SetaeCore.showToast(conflict ? 'この番号の頭文字はすでに使用されています' : '番号の頭文字を入力してください', 'error');
            return;
        }
        if (form && !form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const $btn = $('#baby-group-form button[type="submit"]');
        const originalButtonText = $btn.text();
        $btn.prop('disabled', true).text('追加中...');

        const request = SetaeAPI.createBabyGroup({
            name: $('#baby-group-name').val(),
            prefix: prefix,
            count: $('#baby-group-count').val(),
            birth_date: $('#baby-group-birth-date').val(),
            species_id: $('#baby-group-species-id').val(),
            species_name: $('#baby-group-species').val(),
            parent_spider_ids: getSelectedParentSpiderIds().join(','),
            parent_note: $('#baby-group-parent-note').val()
        }, function (group) {
            SetaeCore.showToast('ベビー群を追加しました', 'success');
            $('#baby-group-form')[0].reset();
            $('#baby-group-prefix').val('A');
            $('#baby-group-count').val('100');
            $('#baby-group-species-id').val('');
            $('#baby-parent-search').val('');
            $('.baby-parent-select').val('');
            $('#baby-species-suggestions').hide().empty();
            setCreateFormOpen(false);
            currentGroupId = group.id;
            loadGroups(group.id);

            if (typeof SetaeCore.track === 'function') {
                SetaeCore.track('baby_group_create', { count: group.count || 0 });
            }
        }, function (xhr) {
            const code = xhr && xhr.responseJSON ? xhr.responseJSON.code : '';
            if (code === 'duplicate_baby_prefix') {
                loadGroups(currentGroupId);
                window.setTimeout(updateBabyNumberPreview, 0);
            }
        });

        if (request && request.always) {
            request.always(function () {
                $btn.prop('disabled', false).text(originalButtonText);
                updateBabyNumberPreview();
            });
        }
    }

    function handleGroupClick() {
        const id = $(this).data('id');
        if (id) loadGroupDetail(id);
    }

    function handleParentVisualClick(e) {
        e.preventDefault();
        e.stopPropagation();
        const spiderId = $(this).data('spider-id');
        if (spiderId) openSpiderFromBaby(spiderId);
    }

    function handleToggleGroupSettings(e) {
        e.preventDefault();
        if (!currentGroup) return;

        isGroupManageOpen = !isGroupManageOpen;
        const $settings = $('#baby-group-settings');
        $settings.toggleClass('is-open', isGroupManageOpen).attr('aria-hidden', isGroupManageOpen ? 'false' : 'true');
        $('#baby-toggle-group-settings').attr('aria-expanded', isGroupManageOpen ? 'true' : 'false');

        if (isGroupManageOpen) {
            window.setTimeout(function () {
                $('#baby-edit-group-name').trigger('focus').select();
            }, 0);
        }
    }

    function handleUpdateGroup(e) {
        e.preventDefault();
        if (!currentGroupId) return;

        const name = String($('#baby-edit-group-name').val() || '').trim();
        if (!name) {
            SetaeCore.showToast('管理名を入力してください', 'error');
            $('#baby-edit-group-name').trigger('focus');
            return;
        }

        const $form = $('#baby-group-settings-form');
        const $buttons = $form.find('button');
        const $save = $form.find('button[type="submit"]');
        const originalText = $save.text();
        $buttons.prop('disabled', true);
        $save.text('保存中...');

        const request = requestBabyGroupUpdate(currentGroupId, { name: name }, function (group) {
            isGroupManageOpen = false;
            currentGroup = group;
            currentGroupId = group.id;
            renderGroupDetail(group);
            loadGroups(group.id);
            SetaeCore.showToast('ベビー群の名前を更新しました', 'success');

            if (typeof SetaeCore.track === 'function') {
                SetaeCore.track('baby_group_rename', { group_id: group.id });
            }
        });

        if (request && request.always) {
            request.always(function () {
                $buttons.prop('disabled', false);
                $save.text(originalText);
            });
        }
    }

    function handleDeleteGroup(e) {
        e.preventDefault();
        if (!currentGroupId || !currentGroup) return;

        const groupId = currentGroupId;
        const groupName = currentGroup.name || 'このベビー群';
        confirmBabyAction({
            title: 'ベビー群を削除',
            message: '「' + groupName + '」を削除します。削除後は元に戻せません。',
            details: [
                'ベビー群の番号と記録が削除されます',
                'マイ個体へ移動済みの個体と履歴は残ります'
            ],
            confirmLabel: '削除する',
            tone: 'danger'
        }).then(function (confirmed) {
            if (!confirmed || String(currentGroupId) !== String(groupId)) return;

            const $form = $('#baby-group-settings-form');
            const $buttons = $form.find('button');
            const $deleteButton = $('#baby-delete-group');
            const originalText = $deleteButton.text();
            $buttons.prop('disabled', true);
            $deleteButton.text('削除中...');

            const request = requestBabyGroupDelete(groupId, function () {
                isGroupManageOpen = false;
                currentGroupId = null;
                currentGroup = null;
                $('#baby-group-detail').html('<div class="setae-card baby-loading">一覧を更新中...</div>');
                loadGroups();
                SetaeCore.showToast('ベビー群を削除しました', 'success');

                if (typeof SetaeCore.track === 'function') {
                    SetaeCore.track('baby_group_delete');
                }
            });

            if (request && request.always) {
                request.always(function () {
                    $buttons.prop('disabled', false);
                    $deleteButton.text(originalText);
                });
            }
        });
    }

    function handleArchiveGroup(e) {
        e.preventDefault();
        updateGroupArchive(true);
    }

    function handleRestoreGroup(e) {
        e.preventDefault();
        updateGroupArchive(false);
    }

    function updateGroupArchive(shouldArchive) {
        if (!currentGroupId || !currentGroup) return;

        const groupId = currentGroupId;
        const groupName = currentGroup.name || 'このベビー群';
        if (shouldArchive) {
            confirmBabyAction({
                title: 'ベビー群をアーカイブ',
                message: '「' + groupName + '」を管理中の一覧から移します。',
                details: [
                    '番号、写真、脱皮・死亡・譲渡の記録は残ります',
                    'いつでも管理中へ戻せます'
                ],
                confirmLabel: 'アーカイブする'
            }).then(function (confirmed) {
                if (confirmed && String(currentGroupId) === String(groupId)) {
                    performGroupArchive(groupId, true);
                }
            });
            return;
        }

        performGroupArchive(groupId, false);
    }

    function performGroupArchive(groupId, shouldArchive) {
        const $form = $('#baby-group-settings-form');
        const $buttons = $form.find('button');
        const $action = shouldArchive ? $('#baby-archive-group') : $('#baby-restore-group');
        const originalText = $action.text();
        $buttons.prop('disabled', true);
        $action.text(shouldArchive ? 'アーカイブ中...' : '戻しています...');

        const request = requestBabyGroupUpdate(groupId, {
            name: currentGroup.name,
            archived: shouldArchive ? 1 : 0
        }, function (group) {
            isGroupManageOpen = false;
            currentGroup = group;
            currentGroupId = group.id;
            currentGroupScope = group.archived ? 'archived' : 'active';
            loadGroups(group.id);
            SetaeCore.showToast(shouldArchive ? 'ベビー群をアーカイブしました' : 'ベビー群を管理中へ戻しました', 'success');
        });

        if (request && request.always) {
            request.always(function () {
                $buttons.prop('disabled', false);
                $action.text(originalText);
            });
        }
    }

    function handleBulkSubmit(e) {
        e.preventDefault();
        if (!currentGroupId) return;
        if (currentGroup && currentGroup.archived) {
            SetaeCore.showToast('アーカイブ中のベビー群は、再開してから記録してください', 'error');
            return;
        }

        const parsed = parseCodesFromInput($('#baby-bulk-codes').val());
        if (!parsed.codes.length) {
            SetaeCore.showToast('記録する番号を入力してください', 'error');
            updateBulkPreview();
            return;
        }
        if (parsed.invalid.length) {
            SetaeCore.showToast('範囲外または未登録の番号があります', 'error');
            updateBulkPreview();
            if (typeof SetaeCore.track === 'function') {
                SetaeCore.track('baby_bulk_invalid_block', {
                    count: parsed.invalid.length
                });
            }
            return;
        }
        if (parsed.blocked.length) {
            SetaeCore.showToast('譲渡済み・移動済み、または現在の記録を追加できない番号が含まれています', 'error');
            updateBulkPreview();
            return;
        }

        const event = $('#baby-bulk-event').val();
        if (event === 'dead' && parsed.codes.length >= 10) {
            confirmBabyAction({
                title: '死亡記録を確認',
                message: parsed.codes.length + '件を死亡として記録します。対象番号に誤りがないか確認してください。',
                details: parsed.codes.slice(0, 8).concat(parsed.codes.length > 8 ? ['ほか ' + (parsed.codes.length - 8) + '件'] : []),
                confirmLabel: parsed.codes.length + '件を記録する',
                tone: 'danger'
            }).then(function (confirmed) {
                if (typeof SetaeCore.track === 'function') {
                    SetaeCore.track('baby_bulk_large_dead_confirm', {
                        count: parsed.codes.length,
                        confirmed: confirmed ? 1 : 0
                    });
                }
                if (confirmed) performBulkUpdate(event);
            });
            return;
        }

        performBulkUpdate(event);
    }

    function performBulkUpdate(event) {
        const $btn = $('#baby-bulk-form button[type="submit"]');
        $btn.prop('disabled', true).text('記録中...');

        const request = SetaeAPI.bulkUpdateBabyGroup(currentGroupId, {
            event: event,
            date: $('#baby-bulk-date').val(),
            codes: $('#baby-bulk-codes').val(),
            note: $('#baby-bulk-note').val()
        }, function (res) {
            SetaeCore.showToast((res.updated || 0) + '件を記録しました', 'success');
            $('#baby-bulk-codes').val('');
            $('#baby-bulk-note').val('');
            $('.baby-code-cell.is-selected').removeClass('is-selected');
            currentGroup = res.group;
            renderGroupDetail(res.group);
            loadGroups(res.group.id);

            if (typeof SetaeCore.track === 'function') {
                SetaeCore.track('baby_bulk_update', {
                    event: event,
                    count: res.updated || 0
                });
            }
        });

        if (request && request.always) {
            request.always(function () {
                $btn.prop('disabled', false).text('まとめて記録');
            });
        }
    }

    function getSelectedCodes() {
        return $('.baby-code-cell.is-selected').map(function () {
            return $(this).data('code');
        }).get();
    }

    function syncSelectedCodes() {
        $('#baby-bulk-codes').val(getSelectedCodes().join(', '));
        updateSelectedCount();
        updateBulkPreview();
    }

    function handleCodeCellClick(e) {
        e.preventDefault();
        if (currentGroup && currentGroup.archived) return;

        const status = $(this).data('status');
        if (status === 'transferred') {
            const spiderId = $(this).data('spider-id');
            if (spiderId) openSpiderFromBaby(spiderId);
            return;
        }
        if (status === 'rehomed' && $('#baby-bulk-event').val() !== 'alive') {
            SetaeCore.showToast('譲渡済みを再管理するには、記録を「管理を再開」に切り替えてください', 'error');
            return;
        }
        if (status === 'dead' && $('#baby-bulk-event').val() !== 'alive') {
            SetaeCore.showToast('死亡記録を戻すには、記録を「管理を再開」に切り替えてください', 'error');
            return;
        }
        $(this).toggleClass('is-selected');
        syncSelectedCodes();
    }

    function handleSelectAllAlive(e) {
        e.preventDefault();
        $('.baby-code-cell').removeClass('is-selected');
        $('.baby-code-cell').filter(function () {
            const status = $(this).data('status');
            return status === 'alive' && $(this).is(':visible');
        }).addClass('is-selected');
        syncSelectedCodes();
    }

    function handleClearSelection(e) {
        e.preventDefault();
        $('.baby-code-cell').removeClass('is-selected');
        $('#baby-bulk-codes').val('');
        updateSelectedCount();
        updateBulkPreview();
    }

    function handleBulkCodesInput() {
        const parsed = updateBulkPreview();
        $('.baby-code-cell').removeClass('is-selected');
        parsed.codes.forEach(function (code) {
            const $cell = $(`.baby-code-cell[data-code="${code}"]`);
            const canResumeRehomed = $cell.data('status') === 'rehomed' && $('#baby-bulk-event').val() === 'alive';
            if ($cell.data('status') !== 'transferred' && ($cell.data('status') !== 'rehomed' || canResumeRehomed)) {
                $cell.addClass('is-selected');
            }
        });
        updateSelectedCount();
    }

    function handleFilterClick(e) {
        e.preventDefault();
        currentFilter = $(this).data('filter') || 'all';
        $('.baby-code-cell').removeClass('is-selected is-focus');
        $('#baby-bulk-codes').val('');
        applyBabyFilter();
        updateSelectedCount();
        updateBulkPreview();

        if (typeof SetaeCore.track === 'function') {
            SetaeCore.track('baby_filter_change', { filter: currentFilter });
        }
    }

    function applyBabyFilter() {
        $('.baby-filter-btn').removeClass('active');
        $(`.baby-filter-btn[data-filter="${currentFilter}"]`).addClass('active');

        $('.baby-code-cell').each(function () {
            const bucket = $(this).data('filter');
            const visible = currentFilter === 'all' || bucket === currentFilter;
            $(this).toggle(visible);
        });
    }

    function updateSelectedCount() {
        const count = getSelectedCodes().length;
        $('#baby-selected-count').text(count + '件選択中');
    }

    function handlePromoteSelected(e) {
        e.preventDefault();
        if (!currentGroupId) return;
        if (currentGroup && currentGroup.archived) {
            SetaeCore.showToast('アーカイブ中のベビー群は、再開してからマイ個体へ移動してください', 'error');
            return;
        }

        if (!isPremiumUser()) {
            SetaeCore.showToast('マイ個体への移動はプレミアム会員限定です', 'error');
            return;
        }

        const codes = getSelectedCodes();
        if (!codes.length) {
            SetaeCore.showToast('マイ個体へ移動する番号を選択してください', 'error');
            return;
        }
        const hasIneligibleCode = codes.some(function (code) {
            const item = getCurrentItems().find(function (candidate) {
                return String(candidate.code) === String(code);
            });
            return getBabyItemStatus(item) !== 'alive';
        });
        if (hasIneligibleCode) {
            SetaeCore.showToast('マイ個体へ移動できるのは、現在管理中の番号だけです', 'error');
            return;
        }

        const $btn = $('#baby-promote-selected');
        const originalText = $btn.text();
        $btn.prop('disabled', true).text('移動中...');

        let request = null;
        try {
            request = promoteBabyGroupToSpiders(currentGroupId, {
                codes: codes.join(', ')
            }, function (res) {
                const created = res && Array.isArray(res.created) ? res.created : [];
                const historyCount = created.reduce(function (total, item) {
                    return total + (parseInt(item.history_count, 10) || 0);
                }, 0);
                const historyMessage = historyCount ? '（履歴 ' + historyCount + '件を引き継ぎ）' : '';
                SetaeCore.showToast(created.length + '件をマイ個体へ移動しました' + historyMessage, 'success');
                $('.baby-code-cell.is-selected').removeClass('is-selected');
                $('#baby-bulk-codes').val('');

                if (res && res.group) {
                    currentGroup = res.group;
                    renderGroupDetail(res.group);
                    loadGroups(res.group.id);
                }

                const afterRefresh = function () {
                    if (created.length === 1 && created[0].spider_id) {
                        openSpiderFromBaby(created[0].spider_id);
                    } else {
                        openMyListFromBaby();
                    }
                };

                if (SetaeAPI.fetchMySpiders) {
                    SetaeAPI.fetchMySpiders(function (spiders) {
                        parentSpiders = Array.isArray(spiders) ? spiders : [];
                        parentOptionsLoaded = true;
                        afterRefresh();
                    }, {
                        silent: true,
                        onError: function () {
                            SetaeCore.state.mySpidersLoaded = false;
                            afterRefresh();

                            if (created.length > 1 && window.SetaeUIList && SetaeUIList.renderLoadError) {
                                SetaeUIList.renderLoadError('移動は完了しました。一覧を再読み込みしてください。');
                            } else {
                                SetaeCore.showToast('移動は完了しました。一覧の更新はあとで再試行できます。', 'warning');
                            }
                        }
                    });
                } else {
                    afterRefresh();
                }
            });
        } catch (error) {
            SetaeCore.showToast('マイ個体への移動に失敗しました', 'error');
            $btn.prop('disabled', false).text(originalText);
            return;
        }

        if (request && request.always) {
            request.always(function () {
                $btn.prop('disabled', false).text(originalText);
            });
        } else {
            $btn.prop('disabled', false).text(originalText);
        }
    }

    function promoteBabyGroupToSpiders(id, data, callback) {
        if (typeof SetaeAPI !== 'undefined' && typeof SetaeAPI.promoteBabyToSpiders === 'function') {
            return SetaeAPI.promoteBabyToSpiders(id, data, callback);
        }

        return $.ajax({
            url: SetaeCore.state.apiRoot + '/baby-groups/' + id + '/promote',
            method: 'POST',
            data: data,
            timeout: 30000,
            beforeSend: function (xhr) { xhr.setRequestHeader('X-WP-Nonce', SetaeCore.state.nonce); },
            success: function (res) { if (callback) callback(res); },
            error: function (xhr) {
                const msg = xhr.responseJSON && xhr.responseJSON.message ? xhr.responseJSON.message : 'マイ個体への移動に失敗しました';
                SetaeCore.showToast(msg, 'error');
            }
        });
    }

    function requestBabyGroupUpdate(id, data, callback) {
        if (typeof SetaeAPI !== 'undefined' && typeof SetaeAPI.updateBabyGroup === 'function') {
            return SetaeAPI.updateBabyGroup(id, data, callback);
        }

        return $.ajax({
            url: SetaeCore.state.apiRoot + '/baby-groups/' + id,
            method: 'POST',
            data: data,
            timeout: 15000,
            beforeSend: function (xhr) { xhr.setRequestHeader('X-WP-Nonce', SetaeCore.state.nonce); },
            success: function (res) { if (callback) callback(res); },
            error: function (xhr) {
                const msg = xhr.responseJSON && xhr.responseJSON.message ? xhr.responseJSON.message : 'ベビー群の更新に失敗しました';
                SetaeCore.showToast(msg, 'error');
            }
        });
    }

    function requestBabyGroupDelete(id, callback) {
        if (typeof SetaeAPI !== 'undefined' && typeof SetaeAPI.deleteBabyGroup === 'function') {
            return SetaeAPI.deleteBabyGroup(id, callback);
        }

        return $.ajax({
            url: SetaeCore.state.apiRoot + '/baby-groups/' + id,
            method: 'DELETE',
            timeout: 15000,
            beforeSend: function (xhr) { xhr.setRequestHeader('X-WP-Nonce', SetaeCore.state.nonce); },
            success: function (res) { if (callback) callback(res); },
            error: function (xhr) {
                const msg = xhr.responseJSON && xhr.responseJSON.message ? xhr.responseJSON.message : 'ベビー群の削除に失敗しました';
                SetaeCore.showToast(msg, 'error');
            }
        });
    }

    function isPremiumUser() {
        const currentUser = (typeof SetaeSettings !== 'undefined' && SetaeSettings.current_user) ? SetaeSettings.current_user : {};
        return currentUser.is_premium === true || currentUser.is_premium === 1 || currentUser.is_premium === '1';
    }

    function openMyListFromBaby() {
        if (window.SetaeUI && typeof SetaeUI.syncPrimaryNav === 'function') {
            SetaeUI.syncPrimaryNav('section-my');
        } else {
            $('.setae-nav-item').removeClass('active').removeAttr('aria-current');
            $('.setae-nav-item[data-target="section-my"]').addClass('active').attr('aria-current', 'page');
        }
        $('.setae-section').hide();
        $('#section-my').fadeIn(200);
        window.scrollTo(0, 0);

        if (window.SetaeUIList && SetaeUIList.init) {
            SetaeUIList.init();
        } else if (window.SetaeUI && SetaeUI.renderMySpiders) {
            SetaeUI.renderMySpiders();
        }
    }

    function openSpiderFromBaby(spiderId) {
        if (window.SetaeUI && typeof SetaeUI.syncPrimaryNav === 'function') {
            SetaeUI.syncPrimaryNav('section-my');
        } else {
            $('.setae-nav-item').removeClass('active').removeAttr('aria-current');
            $('.setae-nav-item[data-target="section-my"]').addClass('active').attr('aria-current', 'page');
        }
        $('.setae-section').hide();
        $('#section-my-detail').fadeIn(200);

        if (window.SetaeUIDetail && SetaeUIDetail.loadSpiderDetail) {
            try {
                localStorage.setItem('setae_detail_tab_v1', 'tab-history');
            } catch (err) {}
            SetaeUIDetail.loadSpiderDetail(spiderId);
        } else {
            openMyListFromBaby();
        }
    }

    function handleCopyAllCodes(e) {
        e.preventDefault();
        copyCodesForItems(getCurrentItems(), '付箋用番号をコピーしました', 'all');
    }

    function handleCopyAliveCodes(e) {
        e.preventDefault();
        copyCodesForItems(getCurrentItems().filter(item => getBabyItemStatus(item) === 'alive'), '管理中の番号をコピーしました', 'alive');
    }

    function handleDownloadCsv(e) {
        e.preventDefault();
        const items = getCurrentItems();
        if (!currentGroup || !items.length) {
            SetaeCore.showToast('保存できるデータがありません', 'error');
            return;
        }

        const csv = buildBabyCsv(currentGroup, items);
        const fileName = 'setae-baby-' + safeFileName(currentGroup.name || 'group') + '-' + today().replace(/-/g, '') + '.csv';
        downloadTextFile(fileName, '\ufeff' + csv, 'text/csv;charset=utf-8;');
        SetaeCore.showToast('CSVを保存しました', 'success');

        if (typeof SetaeCore.track === 'function') {
            SetaeCore.track('baby_csv_download', {
                count: items.length
            });
        }
    }

    function handlePrintLabels(e) {
        e.preventDefault();
        const items = getCurrentItems();
        if (!currentGroup || !items.length) {
            SetaeCore.showToast('印刷できる番号がありません', 'error');
            return;
        }

        if (window.SetaeUIQR && typeof SetaeUIQR.openForBabies === 'function') {
            SetaeUIQR.openForBabies(currentGroup, items, getSelectedCodes());
            return;
        }

        SetaeCore.showToast('QR管理を読み込めませんでした', 'error');
    }

    function handleRangeChipClick(e) {
        e.preventDefault();
        const codesText = $(this).attr('data-codes') || '';
        const codes = codesText.split(',').map(code => code.trim()).filter(Boolean);
        if (!codes.length) return;

        currentFilter = 'all';
        applyBabyFilter();
        $('.baby-code-cell').removeClass('is-selected is-focus');
        $('#baby-bulk-codes').val(codesText);

        codes.forEach(function (code) {
            const $cell = $(`.baby-code-cell[data-code="${code}"]`);
            if ($cell.data('status') !== 'transferred' && $cell.data('status') !== 'rehomed') {
                $cell.addClass('is-selected');
            }
        });
        updateSelectedCount();
        updateBulkPreview();

        const $firstCell = $(`.baby-code-cell[data-code="${codes[0]}"]`);
        if ($firstCell.length && $firstCell[0].scrollIntoView) {
            $firstCell[0].scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
        }

        if (typeof SetaeCore.track === 'function') {
            SetaeCore.track('baby_range_select', {
                count: codes.length
            });
        }
    }

    function handleRecentItemClick(e) {
        e.preventDefault();
        const code = $(this).data('code');
        if (!code) return;

        currentFilter = 'all';
        applyBabyFilter();
        $('.baby-code-cell').removeClass('is-selected is-focus');

        const $cell = $(`.baby-code-cell[data-code="${code}"]`);
        if ($cell.data('status') === 'transferred') {
            const spiderId = $cell.data('spider-id');
            if (spiderId) openSpiderFromBaby(spiderId);
            return;
        }
        if ($cell.data('status') === 'rehomed' && $('#baby-bulk-event').val() !== 'alive') {
            SetaeCore.showToast('譲渡済みを再管理するには、記録を「管理を再開」に切り替えてください', 'error');
            return;
        }
        $cell.addClass('is-selected is-focus');
        syncSelectedCodes();

        if ($cell.length && $cell[0].scrollIntoView) {
            $cell[0].scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
        }
    }

    function getCurrentItems() {
        return currentGroup && Array.isArray(currentGroup.items) ? currentGroup.items : [];
    }

    function updateBulkPreview() {
        const parsed = parseCodesFromInput($('#baby-bulk-codes').val());
        const $preview = $('#baby-code-preview');
        if (!$preview.length) return parsed;

        const event = $('#baby-bulk-event').val();
        const eventLabel = getBulkEventLabel(event);
        const chips = [];

        if (!parsed.raw.trim()) {
            $preview.removeClass('is-warning is-error').html('番号を入力すると、記録前に対象件数を確認できます。');
            return parsed;
        }

        chips.push(`<span>対象 <b>${parsed.codes.length}</b>件</span>`);
        chips.push(`<span>${escapeHtml(eventLabel)}として記録</span>`);

        if (parsed.invalid.length) {
            chips.push(`<span class="is-bad">未一致: ${escapeHtml(parsed.invalid.slice(0, 5).join(', '))}${parsed.invalid.length > 5 ? '...' : ''}</span>`);
        }

        if (parsed.blocked.length) {
            chips.push(`<span class="is-bad">記録不可: ${escapeHtml(parsed.blocked.slice(0, 5).join(', '))}${parsed.blocked.length > 5 ? '...' : ''}</span>`);
        }

        if (event === 'dead' && parsed.codes.length >= 10 && !parsed.invalid.length && !parsed.blocked.length) {
            chips.push('<span class="is-bad">大量死亡記録です</span>');
        }

        $preview
            .toggleClass('is-error', parsed.invalid.length > 0 || parsed.blocked.length > 0)
            .toggleClass('is-warning', event === 'dead' && parsed.codes.length >= 10 && !parsed.invalid.length && !parsed.blocked.length)
            .html(chips.join(''));

        return parsed;
    }

    function parseCodesFromInput(value) {
        const raw = String(value || '');
        const items = getCurrentItems();
        const codeSet = new Set(items.map(item => String(item.code || '').toUpperCase()));
        const itemByCode = new Map(items.map(item => [String(item.code || '').toUpperCase(), item]));
        const event = $('#baby-bulk-event').val() || 'molt';
        const group = currentGroup || {};
        const prefix = String(group.prefix || '').toUpperCase();
        const count = parseInt(group.count, 10) || items.length;
        const padding = getCodePadding(prefix, count, items);
        const normalized = raw.normalize('NFKC')
            .toUpperCase()
            .replace(/[、，\r\n\t]/g, ',')
            .replace(/[〜～~]/g, '-')
            .replace(/\s*-\s*/g, '-')
            .replace(/\s+/g, ',');
        const parts = normalized.split(',').map(part => part.trim()).filter(Boolean);
        const codes = [];
        const invalid = [];
        const blocked = [];

        parts.forEach(function (part) {
            if (part.indexOf('-') !== -1) {
                const range = part.split('-').map(valuePart => valuePart.trim()).filter(Boolean);
                if (range.length < 2) {
                    invalid.push(part);
                    return;
                }

                const start = codeToNumber(range[0], prefix);
                const end = codeToNumber(range[1], prefix);
                if (!isValidNumber(start, count) || !isValidNumber(end, count)) {
                    invalid.push(part);
                    return;
                }

                const min = Math.min(start, end);
                const max = Math.max(start, end);
                for (let i = min; i <= max; i++) {
                    const code = formatBabyCode(prefix, i, padding);
                    if (codeSet.has(code)) {
                        if (isBabyItemBlockedForEvent(itemByCode.get(code), event)) {
                            blocked.push(code);
                        } else {
                            codes.push(code);
                        }
                    } else {
                        invalid.push(code);
                    }
                }
                return;
            }

            const number = codeToNumber(part, prefix);
            const code = formatBabyCode(prefix, number, padding);
            if (isValidNumber(number, count) && codeSet.has(code)) {
                if (isBabyItemBlockedForEvent(itemByCode.get(code), event)) {
                    blocked.push(code);
                } else {
                    codes.push(code);
                }
            } else {
                invalid.push(part);
            }
        });

        return {
            raw: raw,
            codes: Array.from(new Set(codes)),
            invalid: Array.from(new Set(invalid)),
            blocked: Array.from(new Set(blocked))
        };
    }

    function isBabyItemBlockedForEvent(item, event) {
        const status = getBabyItemStatus(item);
        if (status === 'transferred') return true;
        if (status === 'rehomed') return event !== 'alive';
        return status === 'dead' && event !== 'alive';
    }

    function getCodePadding(prefix, count, items) {
        const sample = items.find(item => item && item.code);
        if (sample && sample.code) {
            const numberPart = String(sample.code).toUpperCase().replace(prefix, '').replace(/[^0-9]/g, '');
            if (numberPart.length) return numberPart.length;
        }
        return Math.max(3, String(count || '').length);
    }

    function codeToNumber(value, prefix) {
        let text = String(value || '').trim().toUpperCase();
        if (prefix && text.indexOf(prefix) === 0) {
            text = text.slice(prefix.length);
        }
        text = text.replace(/[^0-9]/g, '');
        return text ? parseInt(text, 10) : 0;
    }

    function isValidNumber(number, count) {
        return Number.isFinite(number) && number >= 1 && number <= count;
    }

    function formatBabyCode(prefix, number, padding) {
        return prefix + String(number).padStart(padding, '0');
    }

    function getBulkEventLabel(event) {
        if (event === 'dead') return '死亡';
        if (event === 'rehomed') return '譲渡';
        if (event === 'alive') return '管理再開';
        return '脱皮';
    }

    function buildBabyCsv(group, items) {
        const rows = [[
            '管理名',
            '番号',
            '状態',
            '最終脱皮日',
            '脱皮履歴',
            '死亡日',
            '譲渡日',
            'メモ',
            '更新日時'
        ]];

        items.forEach(function (item) {
            rows.push([
                group.name || '',
                item.code || '',
                getBabyItemStatus(item) === 'transferred' ? 'マイ個体へ移動' : (getBabyItemStatus(item) === 'rehomed' ? '譲渡' : (getBabyItemStatus(item) === 'dead' ? '死亡' : '生存')),
                item.last_molt || '',
                Array.isArray(item.molts) ? item.molts.join(' / ') : '',
                item.death_date || '',
                item.rehomed_date || '',
                item.note || '',
                item.updated_at || ''
            ]);
        });

        return rows.map(row => row.map(csvEscape).join(',')).join('\r\n');
    }

    function csvEscape(value) {
        const text = String(value == null ? '' : value);
        return '"' + text.replace(/"/g, '""') + '"';
    }

    function safeFileName(value) {
        return String(value || 'group').replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '-').slice(0, 60);
    }

    function downloadTextFile(fileName, content, type) {
        const blob = new Blob([content], { type: type || 'text/plain;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(function () {
            URL.revokeObjectURL(url);
        }, 1000);
    }

    function buildLabelPrintHtml(group, items) {
        const meta = [
            group.species_name || '',
            group.birth_date ? '孵化/発見 ' + group.birth_date : ''
        ].filter(Boolean).join(' / ');

        return `
            <div id="baby-label-print-root" class="baby-label-print-root" aria-hidden="true">
                <div class="baby-label-print-head">
                    <strong>${escapeHtml(group.name)}</strong>
                    <span>${escapeHtml(meta || 'ベビー管理ラベル')}</span>
                </div>
                <div class="baby-label-sheet">
                    ${items.map(item => renderPrintLabel(group, item, meta)).join('')}
                </div>
            </div>
        `;
    }

    function renderPrintLabel(group, item, meta) {
        const itemStatus = getBabyItemStatus(item);
        const status = itemStatus === 'transferred'
            ? 'マイ個体へ移動'
            : (itemStatus === 'rehomed'
                ? '譲渡'
                : (itemStatus === 'dead' ? '死亡' : (item.last_molt ? '脱皮 ' + item.last_molt : '未記録')));
        return `
            <div class="baby-print-label">
                <strong>${escapeHtml(item.code)}</strong>
                <span>${escapeHtml(group.name || '')}</span>
                <em>${escapeHtml(meta || status)}</em>
            </div>
        `;
    }

    function copyCodesForItems(items, successMessage, scope) {
        const codes = items.map(item => item.code).filter(Boolean);
        if (!codes.length) {
            SetaeCore.showToast('コピーできる番号がありません', 'error');
            return;
        }

        copyText(codes.join('\n'), function () {
            SetaeCore.showToast(successMessage, 'success');
            if (typeof SetaeCore.track === 'function') {
                SetaeCore.track('baby_codes_copy', {
                    scope: scope,
                    count: codes.length
                });
            }
        });
    }

    function copyText(text, onSuccess) {
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text).then(onSuccess).catch(function () {
                fallbackCopyText(text, onSuccess);
            });
            return;
        }
        fallbackCopyText(text, onSuccess);
    }

    function fallbackCopyText(text, onSuccess) {
        const $textarea = $('<textarea readonly></textarea>').val(text).css({
            position: 'fixed',
            top: '-1000px',
            left: '-1000px'
        });
        $('body').append($textarea);
        $textarea[0].select();
        document.execCommand('copy');
        $textarea.remove();
        onSuccess();
    }

    return {
        loadGroups: loadGroups
    };
})(jQuery);
