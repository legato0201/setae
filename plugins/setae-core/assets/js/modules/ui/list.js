var SetaeUIList = (function ($) {
    'use strict';

    function renderMySpiders() {
        const container = $('#setae-spider-list');
        container.empty().removeClass('setae-grid').addClass('setae-list-container');

        // Filter
        let spiders = SetaeCore.state.cachedSpiders.filter(s => {
            if (SetaeCore.state.currentSearch) {
                const q = SetaeCore.state.currentSearch.toLowerCase();
                const name = (s.title || '').toLowerCase();
                const species = (s.species_name || '').toLowerCase();
                if (!name.includes(q) && !species.includes(q)) return false;
            }
            const deck = SetaeCore.state.currentDeck;
            if (deck === 'hungry') {
                // ▼ 修正: API側で計算されたフラグを使用
                return s.is_hungry === true;
            }
            if (deck === 'pre_molt') return s.status === 'pre_molt';

            // カテゴリーフィルター処理
            if (deck.startsWith('cat_')) {
                const targetCat = deck.replace('cat_', '');
                const myCat = s.classification || 'tarantula'; // 未設定ならtarantula扱い

                // 'other'を選択した場合は、明示的な'other'に加えて定義外の値も表示する
                if (targetCat === 'other') {
                    const knownCats = ['tarantula', 'scorpion', 'reptile', 'plant'];
                    return myCat === 'other' || !knownCats.includes(myCat);
                }

                return myCat === targetCat;
            }

            return true;
        });

        // Sort
        spiders.sort((a, b) => {
            const sort = SetaeCore.state.currentSort || 'priority';

            if (sort === 'priority') {
                // Priority Score Logic
                const getScore = (s) => {
                    let score = 0;
                    if (s.status === 'pre_molt') score += 100;
                    if (s.status === 'fasting') score -= 50;
                    if (s.last_feed) {
                        const days = (new Date() - new Date(s.last_feed)) / (1000 * 60 * 60 * 24);
                        score += days;
                    } else {
                        score += 30;
                    }
                    return score;
                };
                return getScore(b) - getScore(a);
            }

            if (sort === 'classification') {
                const cA = (a.classification || 'tarantula');
                const cB = (b.classification || 'tarantula');
                if (cA !== cB) return cA.localeCompare(cB);
                return (a.title || '').localeCompare(b.title || '');
            }

            if (sort === 'species_asc') {
                const sA = (a.species_name || '').toLowerCase();
                const sB = (b.species_name || '').toLowerCase();
                if (sA !== sB) return sA.localeCompare(sB);
                return (a.title || '').localeCompare(b.title || '');
            }

            if (sort === 'hungriest') {
                const tA = a.last_feed ? new Date(a.last_feed).getTime() : 0;
                const tB = b.last_feed ? new Date(b.last_feed).getTime() : 0;
                return tA - tB;
            }

            if (sort === 'molt_oldest') {
                const tA = a.last_molt ? new Date(a.last_molt).getTime() : Date.now();
                const tB = b.last_molt ? new Date(b.last_molt).getTime() : Date.now();
                return tA - tB;
            }

            if (sort === 'name_asc') return (a.title || '').localeCompare(b.title || '');
            if (sort === 'newest') return b.id - a.id;

            return b.id - a.id; // Default newest
        });

        updateDeckCounts();

        if (spiders.length === 0) {
            container.html('<div class="setae-card" style="text-align:center; padding:40px;"><p style="color:#999;">該当なし</p></div>');
            return;
        }

        let lastSpecies = null;
        spiders.forEach(spider => {
            // Species Header for multi-level sort
            if (SetaeCore.state.currentSort === 'species_asc') {
                const currentSpecies = spider.species_name || 'Unidentified';
                if (currentSpecies !== lastSpecies) {
                    // Count how many of this species
                    const count = spiders.filter(s => (s.species_name || 'Unidentified') === currentSpecies).length;
                    container.append(`
                        <div class="setae-list-header" style="padding:8px 12px; background:#f9f9f9; color:#666; font-size:13px; font-weight:bold; border-bottom:1px solid #eee; margin-top:0;">
                            ${currentSpecies} <span style="font-weight:normal; color:#999; margin-left:5px;">(${count})</span>
                        </div>
                    `);
                    lastSpecies = currentSpecies;
                }
            }
            container.append(renderSmartListItem(spider));
        });
    }

    function updateDeckCounts() {
        const categories = ['tarantula', 'scorpion', 'reptile', 'plant', 'other'];
        const counts = { all: 0, hungry: 0, pre_molt: 0 };
        categories.forEach(key => counts['cat_' + key] = 0);

        SetaeCore.state.cachedSpiders.forEach(s => {
            counts.all++;

            // ▼ 修正: API側で計算されたフラグを使用
            if (s.is_hungry) counts.hungry++;
            if (s.status === 'pre_molt') counts.pre_molt++;

            const cls = s.classification || 'tarantula';
            if (categories.includes(cls)) {
                counts['cat_' + cls]++;
            } else {
                counts['cat_other']++;
            }
        });

        $(`.deck-pill[data-deck="all"] .count-badge`).text(counts.all);
        $(`.deck-pill[data-deck="hungry"] .count-badge`).text(counts.hungry);
        $(`.deck-pill[data-deck="pre_molt"] .count-badge`).text(counts.pre_molt);

        let activeCategoryCount = 0;
        categories.forEach(key => {
            if (counts['cat_' + key] > 0) activeCategoryCount++;
        });

        categories.forEach(key => {
            const $btn = $(`.deck-pill[data-deck="cat_${key}"]`);
            const count = counts['cat_' + key];

            $btn.find('.count-badge').text(count);

            if (count === 0 || activeCategoryCount <= 1) {
                $btn.hide();
            } else {
                $btn.show();
            }
        });
    }

    function handleDeckFilterClick() {
        const deck = $(this).data('deck');
        SetaeCore.state.currentDeck = deck;
        localStorage.setItem('setae_my_deck', deck);
        $('.deck-pill[data-deck]').removeClass('active');
        $(this).addClass('active');
        renderMySpiders();
    }

    function handleSearchInput() {
        const query = $(this).val();
        SetaeCore.state.currentSearch = query;
        localStorage.setItem('setae_my_search', query);
        renderMySpiders();
    }

    // ==========================================
    // Smart List Item
    // ==========================================
    // ==========================================
    // Smart List Item (Classification Aware)
    // ==========================================
    function renderSmartListItem(spider) {
        // 分類を取得 (未設定なら tarantula)
        const cls = spider.classification || 'tarantula';
        const status = spider.status || 'normal';
        const statusColor = getStatusColor(status);
        const thumb = spider.thumb || 'https://placehold.co/100x100/eee/999?text=SP';

        const feedRel = SetaeCore.formatRelativeDate(spider.last_feed);
        const moltRel = SetaeCore.formatRelativeDate(spider.last_molt);
        const prey = spider.last_prey || '';

        // 空腹/水切れ判定
        const isHungry = spider.is_hungry;
        const feedClass = isHungry ? 'meta-value alert-text' : 'meta-value';

        // --- 分類ごとのUI設定 ---
        let steps = [];
        let labelFeed = 'Feed';
        let labelMolt = 'Molt';
        let icon = ''; // 必要に応じて種別アイコンを表示

        switch (cls) {
            case 'plant':
                // 植物: パイプラインなし、ラベル変更
                steps = [];
                labelFeed = 'Water';
                labelMolt = 'Repot';
                icon = '🌿';
                break;

            case 'reptile':
                // 爬虫類: サイクル簡略化
                // 修正: ラベルを日本語化 (Refused -> 拒食, Shedding -> 脱皮前)
                steps = [
                    { id: 'normal', label: '通常' },
                    { id: 'fasting', label: '拒食' },
                    { id: 'pre_molt', label: '脱皮前' }
                ];
                labelFeed = 'Feed';
                labelMolt = 'Shed';
                icon = '🦎';
                break;

            case 'scorpion':
                // サソリ: タランチュラと同じだがアイコン変更
                // 修正: ラベルを日本語化
                steps = [
                    { id: 'normal', label: '通常' },
                    { id: 'fasting', label: '拒食' },
                    { id: 'pre_molt', label: '脱皮前' },
                    { id: 'post_molt', label: '脱皮後' }
                ];
                icon = '🦂';
                break;

            case 'tarantula':
            default:
                // タランチュラ (デフォルト)
                // 修正: ラベルを日本語化
                steps = [
                    { id: 'normal', label: '通常' },
                    { id: 'fasting', label: '拒食' },
                    { id: 'pre_molt', label: '脱皮前' },
                    { id: 'post_molt', label: '脱皮後' }
                ];
                icon = ''; // 写真があればアイコン不要、または 🕷️
                break;
        }

        // --- パイプラインHTML生成 ---
        let pipelineHtml = '';
        if (steps.length > 0) {
            pipelineHtml = '<div class="setae-pipeline">';
            steps.forEach(step => {
                const activeClass = (status === step.id) ? 'active' : '';
                pipelineHtml += `
                <div class="pipeline-step ${activeClass}" data-step="${step.id}">
                    <div class="pipeline-dot"></div>
                    <div class="pipeline-label">${step.label}</div>
                </div>`;
            });
            pipelineHtml += '</div>';
        } else {
            // ステップが無い場合（植物など）は余白調整のみ
            pipelineHtml = '<div style="margin-bottom: 8px;"></div>';
        }

        // --- HTML出力 ---
        return `
            <div class="setae-spider-list-row" data-id="${spider.id}" data-status="${status}" data-prey="${prey}">
                <div class="setae-swipe-bg swipe-left"></div>
                <div class="setae-swipe-bg swipe-right"></div>
                <div class="setae-list-content">
                    <div class="setae-status-strip" style="background-color:${statusColor}"></div>
                    
                    <div class="setae-avatar-container">
                        <img src="${thumb}" class="setae-avatar-img" alt="Thumbnail">
                        ${icon ? `<span style="position:absolute; bottom:-5px; right:-5px; font-size:16px; background:#fff; border-radius:50%; padding:2px;">${icon}</span>` : ''}
                    </div>

                    <div class="setae-info-column">
                        <div class="setae-scientific-name"><i>${spider.species_name || 'Unidentified'}</i></div>
                        <div class="setae-nickname-row">
                            <span class="setae-nickname">${spider.title}</span>
                        </div>
                    </div>

                    ${pipelineHtml}

                    <div class="setae-meta-column">
                        <div class="meta-row">
                            <span class="meta-label">${labelFeed}</span>
                            <span class="${feedClass} meta-value">${feedRel}</span>
                        </div>
                        <div class="meta-row">
                            <span class="meta-label">${labelMolt}</span>
                            <span class="meta-value">${moltRel}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    function getStatusColor(status) {
        switch (status) {
            case 'fasting': return '#ff9800';
            case 'pre_molt': return '#e74c3c';
            case 'post_molt': return '#9c27b0';
            case 'refused': return '#f44336';
            default: return '#2ecc71';
        }
    }

    function handleListItemClick(e) {
        // ボタンクリックやスワイプ中の誤タップ防止
        if ($(e.target).is('button') || $(e.target).closest('button').length) return;

        // モバイルのスワイプ判定
        const content = this.querySelector('.setae-list-content');
        if (content.style.transform && content.style.transform !== 'translateX(0px)' && content.style.transform !== '') return;

        const id = $(this).data('id');
        // Detailモジュールへ委譲
        if (window.SetaeUIDetail && SetaeUIDetail.loadSpiderDetail) {
            SetaeUIDetail.loadSpiderDetail(id);
        } else {
            console.error('SetaeUIDetail not loaded');
        }
    }

    // ==========================================
    // Sort Menu
    // ==========================================
    function toggleSortMenu(e) {
        e.preventDefault(); e.stopPropagation();
        var $existing = $('#setae-sort-menu-v3');
        if ($existing.length > 0) { $existing.remove(); return; }

        // ▼ 修正開始: 現在のソート状態を取得して active クラスを判定する関数を追加
        const currentSort = SetaeCore.state.currentSort || 'priority';
        const getActiveClass = (sortKey) => (sortKey === currentSort ? ' active' : '');

        var menuDiv = document.createElement('div');
        menuDiv.id = 'setae-sort-menu-v3';
        // HTML生成部分で getActiveClass を使用するように変更
        menuDiv.innerHTML = `
            <div class="sort-group-label" style="padding:4px 16px; font-size:11px; color:#888; font-weight:bold; background:#fafafa; margin-bottom:4px;">ケア優先</div>
            <div class="sort-option${getActiveClass('priority')}" data-sort="priority">🔥 メンテナンス優先 (Priority)</div>
            <div class="sort-option${getActiveClass('hungriest')}" data-sort="hungriest">🍽 給餌が必要な順</div>
            
            <div class="sort-group-label" style="padding:4px 16px; font-size:11px; color:#888; font-weight:bold; background:#fafafa; margin:4px 0;">個体管理</div>
            <div class="sort-option${getActiveClass('classification')}" data-sort="classification">📂 カテゴリー順</div>
            <div class="sort-option${getActiveClass('species_asc')}" data-sort="species_asc">🧬 種類・学名順</div>
            <div class="sort-option${getActiveClass('molt_oldest')}" data-sort="molt_oldest">⏳ 脱皮日が古い順</div>
            <div class="sort-option${getActiveClass('name_asc')}" data-sort="name_asc">🔤 名前・ID順 (A-Z)</div>
            <div class="sort-option${getActiveClass('newest')}" data-sort="newest">🆕 登録が新しい順</div>
        `;
        // ▲ 修正終了
        document.body.appendChild(menuDiv);

        var rect = $(this)[0].getBoundingClientRect();
        $(menuDiv).css({
            position: 'fixed', top: (rect.bottom + 10) + 'px', left: Math.max(10, rect.right - 200) + 'px',
            background: '#fff', border: '1px solid rgba(0,0,0,0.1)', borderRadius: '12px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.15)', zIndex: 999999, width: '200px', padding: '8px 0'
        });
        $('.sort-option').css({ padding: '10px 16px', cursor: 'pointer', fontSize: '14px' });
    }
    function closeSortMenu() { $('#setae-sort-menu-v3').remove(); }
    function closeSortMenuOutside(e) {
        if (!$(e.target).closest('#btn-sort-menu').length && !$(e.target).closest('#setae-sort-menu-v3').length) {
            closeSortMenu();
        }
    }
    function handleSortOptionClick() {
        const sort = $(this).data('sort');
        SetaeCore.state.currentSort = sort;
        localStorage.setItem('setae_my_sort', sort);
        closeSortMenu();
        renderMySpiders();
    }

    function refresh() {
        SetaeAPI.fetchMySpiders(renderMySpiders);
    }

    /**
     * 初期化：現在のステートをUIに反映させる
     */
    function init() {
        // 1. 検索クエリの復元
        if (SetaeCore.state.currentSearch) {
            $('#setae-spider-search').val(SetaeCore.state.currentSearch);
        }

        // 2. デッキ（フィルター）の復元
        if (SetaeCore.state.currentDeck) {
            $('.deck-pill[data-deck]').removeClass('active');
            $(`.deck-pill[data-deck="${SetaeCore.state.currentDeck}"]`).addClass('active');
        }

        // 3. 初回レンダリング
        renderMySpiders();
    }

    return {
        init: init,
        refresh: refresh, // ★追加: これにより add-spider.js から SetaeUIList.refresh() が呼べるようになります
        renderMySpiders: renderMySpiders,
        handleDeckFilterClick: handleDeckFilterClick,
        handleSearchInput: handleSearchInput,
        handleListItemClick: handleListItemClick,
        toggleSortMenu: toggleSortMenu,
        handleSortOptionClick: handleSortOptionClick,
        closeSortMenuOutside: closeSortMenuOutside,
        closeSortMenu: closeSortMenu
    };

})(jQuery);
