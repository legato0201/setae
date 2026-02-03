var SetaeUI = (function ($) {
    'use strict';

    // ==========================================
    // Initialization & Event Listeners
    // ==========================================
    $(document).ready(function () {
        initListeners();
        checkInitialLoad();
    });

    function initListeners() {
        // Tab Navigation
        $('.setae-nav-item').on('click', handleTabClick);

        // Deck Filters
        $('.deck-pill').on('click', SetaeUIList.handleDeckFilterClick);

        // Sort Menu
        $(document).on('click', '#btn-sort-menu', SetaeUIList.toggleSortMenu);
        $(document).on('click', '.sort-option', SetaeUIList.handleSortOptionClick);
        $(document).on('click', SetaeUIList.closeSortMenuOutside);
        $(window).on('resize scroll', SetaeUIList.closeSortMenu);

        // List Item Click (Detail View)
        $(document).on('click', '.setae-spider-list-row', SetaeUIList.handleListItemClick);

        // Search Input
        $(document).on('input', '#setae-spider-search', SetaeUIList.handleSearchInput);

        $(document).on('click', function (e) {
            // Close Context Menu if click outside
            if (!$(e.target).closest('.setae-context-menu').length && !$(e.target).closest('.btn-feed-smart').length) {
                $('.setae-context-menu').remove();
            }
        });

        // Log Modal
        $(document).on('click', '.log-type-btn, .type-btn-sm', SetaeUILogModal.handleLogTypeClick);
        $(document).on('click', '#btn-add-log', function () { SetaeUILogModal.openLogModal(null); });
        $(document).on('submit', '#setae-log-form', SetaeUILogModal.handleLogSubmit);
        $(document).on('click', '.setae-close', function () { $(this).closest('.setae-modal').fadeOut(); });

        // Edit Prey List
        $(document).on('click', '#btn-manage-feed-types', SetaeUILogModal.renderEditPreyListModal);

        // Species Detail Back Button
        $(document).on('click', '#btn-back-to-enc', function () {
            $('#section-enc-detail').hide();
            $('#section-enc').fadeIn(200);
        });

        // Species Card Click
        $(document).on('click', '.setae-species-card', function () {
            const id = $(this).data('id');
            if (id) SetaeUI.openSpeciesDetail(id);
        });

        // Detail View Back Button
        $(document).on('click', '#btn-back-to-list', function () {
            $('#section-my-detail').hide();
            $('#section-my').fadeIn();
            SetaeAPI.fetchMySpiders(SetaeUIList.init);
        });

        // Scroll Shadow
        $(window).on('scroll', function () { handleToolbarShadow($(this).scrollTop()); });

        // Swipe Actions (Mobile)
        if (SetaeUIActions) {
            $(document).on('touchstart', '.setae-spider-list-row', SetaeUIActions.handleTouchStart);
            $(document).on('touchmove', '.setae-spider-list-row', SetaeUIActions.handleTouchMove);
            $(document).on('touchend', '.setae-spider-list-row', SetaeUIActions.handleTouchEnd);

            // Desktop Hover Actions is now handled by SetaeUIDesktop (app-ui-desktop.js)
            // SetaeUIActions.initDesktopHoverLogic();
        }
    }

    function checkInitialLoad() {
        if ($('#section-my').is(':visible')) {
            SetaeAPI.fetchMySpiders(SetaeUIList.init);
        }
    }

    // ==========================================
    // Species Logic
    // ==========================================
    function openSpeciesDetail(id) {
        $('#section-enc').hide();
        $('#section-enc-detail').show().scrollTop(0);
        $('#enc-detail-title').text('Loading...');
        $('#enc-gallery-grid').html('<p style="text-align:center;">Loading...</p>');

        SetaeAPI.getSpeciesDetail(id, function (data) {
            $('#enc-detail-title').text(data.title);
            $('#enc-detail-name').text(data.title);
            $('#enc-detail-genus').text(data.genus || '');
            $('#enc-detail-description').html(data.description ? data.description.replace(/\n/g, '<br>') : 'No description available.');
            $('#enc-detail-lifespan').text(data.lifespan || '-');
            $('#enc-detail-size').text(data.size ? data.size + ' cm' : '-');
            $('#enc-detail-temperament').text(data.temperament || 'Unknown');
            $('#enc-detail-keeping').html(`🔥 ${data.keeping_count} Keeping`);

            if (data.thumb) {
                $('#enc-detail-image').attr('src', data.thumb).show();
            } else {
                $('#enc-detail-image').hide();
            }

            // Gallery
            const gallery = $('#enc-gallery-grid');
            gallery.empty();
            const emptyMsg = $('#enc-gallery-empty');

            if (data.featured_images && data.featured_images.length > 0) {
                emptyMsg.hide();
                data.featured_images.forEach(imgUrl => {
                    gallery.append(`
                        <div style="height:100px; overflow:hidden; border-radius:4px;">
                            <img src="${imgUrl}" style="width:100%; height:100%; object-fit:cover;">
                        </div>
                    `);
                });
            } else {
                emptyMsg.show();
            }
        });
    }

    // ==========================================
    // Navigation
    // ==========================================
    function handleTabClick() {
        const target = $(this).data('target');
        $('.setae-nav-item').removeClass('active');
        $(this).addClass('active');
        $('.setae-section').hide();
        $('#' + target).fadeIn(200);

        if (target === 'section-my') {
            SetaeAPI.fetchMySpiders(SetaeUIList.init);
        } else if (target === 'section-enc') {
            loadSpeciesBook();
        }
    }

    function loadSpeciesBook() {
        const $grid = $('#setae-species-grid');
        if ($grid.children().length > 0 && !$grid.data('dirty')) return; // Cache

        $grid.html('<div style="text-align:center; padding:20px;">Loading...</div>');
        SetaeAPI.fetchSpecies('', function (speciesList) {
            $grid.empty();
            if (!speciesList || speciesList.length === 0) {
                $grid.html('<p style="text-align:center;">No species found.</p>');
                return;
            }

            speciesList.forEach(sp => {
                const keepingCount = sp.keeping_count || 0;
                const keepingBadge = keepingCount > 0
                    ? `<div style="position:absolute; top:8px; left:8px; background:rgba(0,0,0,0.6); color:#fff; font-size:10px; padding:3px 8px; border-radius:12px; backdrop-filter:blur(4px);">🔥 ${keepingCount} Keeping</div>`
                    : '';

                // Temperament Color Border
                let borderColor = '#eee';
                if (sp.temperament_slug === 'aggressive') borderColor = '#e74c3c';
                if (sp.temperament_slug === 'defensive') borderColor = '#f39c12';
                if (sp.temperament_slug === 'docile') borderColor = '#2ecc71';
                if (sp.temperament_slug === 'nervous') borderColor = '#9b59b6';

                const card = `
                    <div class="setae-card setae-species-card" data-id="${sp.id}" style="padding:0; overflow:hidden; border-top: 3px solid ${borderColor}; position:relative; cursor:pointer;">
                        ${keepingBadge}
                        <img src="${sp.thumb || 'https://placehold.co/300x200/eee/999?text=SP'}" 
                             style="width:100%; height:140px; object-fit:cover;">
                        <div style="padding:12px;">
                            <div style="color:#888; font-size:11px; font-style:italic; margin-bottom:2px;">${sp.genus || ''}</div>
                            <h4 style="margin:0 0 5px 0; font-size:15px;">${sp.title}</h4>
                            <div style="font-size:12px; color:#555;">${sp.habitat || ''}</div>
                        </div>
                    </div>
                `;
                $grid.append(card);
            });
            $grid.data('dirty', false);
        });
    }

    function handleToolbarShadow(scrollTop) {
        if (scrollTop > 10) $('.setae-toolbar-container').addClass('sticky-shadow');
        else $('.setae-toolbar-container').removeClass('sticky-shadow');
    }

    // ==========================================
    // Backward Compatibility & Globals
    // ==========================================

    // Ensure modules are loaded
    if (typeof SetaeUIDetail !== 'undefined') {
        window.loadSpiderDetail = SetaeUIDetail.loadSpiderDetail;
        window.deleteSpider = SetaeUIDetail.deleteSpider;
    }

    if (typeof SetaeUIActions !== 'undefined') {
        window.handleQuickAction = SetaeUIActions.handleQuickAction;
        // executeSwipeAction is also attached to window in some legacy logic maybe?
        window.executeSwipeAction = SetaeUIActions.executeSwipeAction;

        // Expose handlePreySelect if needed (it was in renderer)
        // But log-modal handles it.
    }

    if (typeof SetaeUILogModal !== 'undefined') {
        // savePreyList/resetPreyListToDefault are attached to window in log-modal.js
        window.handlePreySelect = SetaeUILogModal.handlePreySelect;
    }

    // Public API
    return {
        initListeners: initListeners,
        renderMySpiders: SetaeUIList.renderMySpiders,
        openSpeciesDetail: openSpeciesDetail
    };

})(jQuery);
