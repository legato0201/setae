var SetaeCore = (function ($) {
    'use strict';

    // State Management
    let state = {
        apiRoot: (typeof SetaeSettings !== 'undefined') ? SetaeSettings.api_root + 'setae/v1' : '',
        nonce: (typeof SetaeSettings !== 'undefined') ? SetaeSettings.nonce : '',
        currentUserId: (typeof SetaeSettings !== 'undefined') ? SetaeSettings.current_user_id : 0, // ★Added: Store User ID
        cachedSpiders: [],
        currentDeck: localStorage.getItem('setae_my_deck') || 'all',
        currentViewMode: localStorage.getItem('setae_my_view') || 'list',
        currentSort: localStorage.getItem('setae_my_sort') || 'hungriest',
        currentSearch: localStorage.getItem('setae_my_search') || '',

        // Encyclopedia State
        encSearch: localStorage.getItem('setae_enc_search') || '',
        encFilter: localStorage.getItem('setae_enc_filter') || 'all',
        encSort: localStorage.getItem('setae_enc_sort') || 'name',

        feedTypes: (typeof SetaeSettings !== 'undefined' && SetaeSettings.feed_types) ? SetaeSettings.feed_types : ['Cricket', 'Dubia']
    };

    // Global Utilities
    function showToast(message, type = 'info') {
        const container = $('#setae-toast-container');
        if (container.length === 0) {
            $('body').append('<div id="setae-toast-container"></div>');
        }

        const toast = $(`<div class="setae-toast ${type}">${message}</div>`);
        $('#setae-toast-container').append(toast);

        setTimeout(() => {
            toast.css('animation', 'fadeOutRight 0.5s forwards');
            setTimeout(() => toast.remove(), 500);
        }, 3000);
    }

    function formatDateShort(dateStr) {
        if (!dateStr) return null;
        const parts = dateStr.split('-');
        if (parts.length === 3) return `${parts[1]}.${parts[2]}`; // MM.DD
        return dateStr;
    }

    function formatRelativeDate(dateStr) {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        const diff = new Date() - date;
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));

        if (days === 0) return 'Today';
        if (days === 1) return 'Yesterday';
        if (days < 30) return `${days}d ago`;
        if (days < 365) return `${Math.floor(days / 30)}m ago`;
        return `${Math.floor(days / 365)}y ago`;
    }

    // Public Interface
    return {
        state: state,
        showToast: showToast,
        formatDateShort: formatDateShort,
        formatRelativeDate: formatRelativeDate
    };

})(jQuery);
