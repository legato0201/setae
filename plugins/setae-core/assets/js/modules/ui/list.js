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
                if (!s.last_feed) return true;
                const diff = new Date() - new Date(s.last_feed);
                return diff > (14 * 24 * 60 * 60 * 1000);
            }
            if (deck === 'pre_molt') return s.status === 'pre_molt';
            if (deck === 'sling') return (s.size && parseFloat(s.size) < 3);
            return true;
        });

        // Sort
        spiders.sort((a, b) => {
            const sort = SetaeCore.state.currentSort;
            if (sort === 'hungriest') {
                const da = a.last_feed ? new Date(a.last_feed).getTime() : 0;
                const db = b.last_feed ? new Date(b.last_feed).getTime() : 0;
                return da - db;
            }
            if (sort === 'name_asc') return (a.title || '').localeCompare(b.title || '');
            if (sort === 'newest') return b.id - a.id;
            if (sort === 'oldest') return a.id - b.id;
            return b.id - a.id;
        });

        updateDeckCounts();

        if (spiders.length === 0) {
            container.html('<div class="setae-card" style="text-align:center; padding:40px;"><p style="color:#999;">該当なし</p></div>');
            return;
        }

        spiders.forEach(spider => {
            container.append(renderSmartListItem(spider));
        });
    }

    function updateDeckCounts() {
        const counts = { all: 0, hungry: 0, pre_molt: 0, sling: 0 };
        SetaeCore.state.cachedSpiders.forEach(s => {
            counts.all++;
            if (!s.last_feed || (new Date() - new Date(s.last_feed) > 1209600000)) counts.hungry++;
            if (s.status === 'pre_molt') counts.pre_molt++;
            if (s.size && parseFloat(s.size) < 3) counts.sling++;
        });
        $(`.deck-pill[data-deck="all"] .count-badge`).text(counts.all);
        $(`.deck-pill[data-deck="hungry"] .count-badge`).text(counts.hungry);
        $(`.deck-pill[data-deck="pre_molt"] .count-badge`).text(counts.pre_molt);
        $(`.deck-pill[data-deck="sling"] .count-badge`).text(counts.sling);
    }

    function handleDeckFilterClick() {
        SetaeCore.state.currentDeck = $(this).data('deck');
        $('.deck-pill').removeClass('active');
        $(this).addClass('active');
        renderMySpiders();
    }

    function handleSearchInput() {
        SetaeCore.state.currentSearch = $(this).val();
        renderMySpiders();
    }

    // ==========================================
    // Smart List Item
    // ==========================================
    function renderSmartListItem(spider) {
        const status = spider.status || 'normal';
        const statusColor = getStatusColor(status);
        const thumb = spider.thumb || 'https://placehold.co/100x100/eee/999?text=SP';

        const feedRel = SetaeCore.formatRelativeDate(spider.last_feed);
        const moltRel = SetaeCore.formatRelativeDate(spider.last_molt);
        const prey = spider.last_prey || 'Cricket';

        const isHungry = !spider.last_feed || (new Date() - new Date(spider.last_feed) > (14 * 24 * 60 * 60 * 1000));
        const feedClass = isHungry ? 'meta-value alert-text' : 'meta-value';

        const steps = [
            { id: 'normal', label: 'Normal' },
            { id: 'fasting', label: 'Fasting' },
            { id: 'pre_molt', label: 'Pre-molt' },
            { id: 'post_molt', label: 'Post-molt' }
        ];
        let pipelineHtml = '<div class="setae-pipeline">';
        steps.forEach(step => {
            const activeClass = (status === step.id) ? 'active' : '';
            pipelineHtml += `
            <div class="pipeline-step ${activeClass}" data-step="${step.id}">
                <div class="pipeline-dot"></div>
                <div class="pipeline-label">${step.label}</div>
            </div>`;
        });
        pipelineHtml += '</div>';

        return `
            <div class="setae-spider-list-row" data-id="${spider.id}" data-status="${status}" data-prey="${prey}">
                <div class="setae-swipe-bg swipe-left"></div>
                <div class="setae-swipe-bg swipe-right"></div>
                <div class="setae-list-content">
                    <div class="setae-status-strip" style="background-color:${statusColor}"></div>
                    <div class="setae-avatar-container"><img src="${thumb}" class="setae-avatar-img" alt="Thumbnail"></div>
                    <div class="setae-info-column">
                        <div class="setae-scientific-name"><i>${spider.species_name || 'Unidentified'}</i></div>
                        <div class="setae-nickname-row">
                            <span class="setae-nickname">${spider.title}</span>
                        </div>
                    </div>
                    ${pipelineHtml}
                    <div class="setae-meta-column">
                        <div class="meta-row"><span class="meta-label">Feed</span><span class="${feedClass} meta-value">${feedRel}</span></div>
                        <div class="meta-row"><span class="meta-label">Molt</span><span class="meta-value">${moltRel}</span></div>
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

        var menuDiv = document.createElement('div');
        menuDiv.id = 'setae-sort-menu-v3';
        menuDiv.innerHTML = `
            <div class="sort-option active" data-sort="newest">📅 最新 (Newest)</div>
            <div class="sort-option" data-sort="oldest">📅 古い順 (Oldest)</div>
            <div class="sort-option" data-sort="name_asc">🔤 名前 (A-Z)</div>
            <div class="sort-option" data-sort="hungriest">🦗 空腹順 (Hungry)</div>
        `;
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
        SetaeCore.state.currentSort = $(this).data('sort');
        closeSortMenu();
        renderMySpiders();
    }

    return {
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
