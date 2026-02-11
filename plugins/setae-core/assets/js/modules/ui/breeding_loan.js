var SetaeUIBL = (function ($) {
    'use strict';

    function init() {
        // Tab Switching
        $('#btn-bl-board').on('click', function () {
            switchView('board');
        });
        $('#btn-bl-contracts').on('click', function () {
            switchView('contracts');
        });

        // Load Data is NOT called here anymore.
    }

    function switchView(view) {
        $('.setae-toolbar button').removeClass('active');
        if (view === 'board') {
            $('#btn-bl-board').addClass('active');
            $('#bl-board-view').show();
            $('#bl-contracts-view').hide();
            loadRecruits();
        } else {
            $('#btn-bl-contracts').addClass('active');
            $('#bl-board-view').hide();
            $('#bl-contracts-view').show();
            // loadContracts(); // Future implementation
            $('#setae-contracts-list').html('<p style="padding:20px; text-align:center; color:#999;">Coming Soon...</p>');
        }
    }

    function loadRecruits() {
        const container = $('#setae-bl-grid');
        container.html('<div class="setae-loading">Loading...</div>');

        $.ajax({
            url: SetaeSettings.api_root + 'setae/v1/bl-candidates',
            method: 'GET',
            beforeSend: function (xhr) {
                xhr.setRequestHeader('X-WP-Nonce', SetaeSettings.nonce);
            },
            success: function (response) {
                renderGrid(response);
            },
            error: function () {
                container.html('<p style="color:red; text-align:center;">Failed to load data.</p>');
            }
        });
    }

    function renderGrid(spiders) {
        const container = $('#setae-bl-grid');
        container.empty();

        if (!spiders || spiders.length === 0) {
            container.html('<p style="padding:20px; text-align:center; color:#999; grid-column:1/-1;">募集中 (Recruiting) の個体はいません。</p>');
            return;
        }

        spiders.forEach(spider => {
            // Gender default
            const gender = spider.gender || 'unknown';

            const card = `
            <div class="setae-card bl-card gender-${gender}" data-id="${spider.id}">
                <div class="bl-badge">Recruiting</div>
                <div class="bl-species">${spider.species}</div>
                <div class="bl-name">${spider.title}</div>
                <div class="bl-owner">Owner: ${spider.owner_name}</div>
                <div class="bl-actions" style="margin-top:10px;">
                    <button class="setae-btn-sm btn-view-detail" data-id="${spider.id}">View</button>
                    <!-- <button class="setae-btn-sm btn-request-loan" data-id="${spider.id}">Request</button> -->
                </div>
            </div>
            `;
            container.append(card);
        });

        // Event for view button
        $('.btn-view-detail').on('click', function () {
            const id = $(this).data('id');
            if (window.SetaeUIDetail && SetaeUIDetail.loadSpiderDetail) {
                SetaeUIDetail.loadSpiderDetail(id);
            }
        });
    }

    return {
        init: init,
        loadRecruits: loadRecruits
    };

})(jQuery);
