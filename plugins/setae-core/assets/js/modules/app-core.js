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

        // Safari/iOS対策: "YYYY-MM-DD" を "YYYY/MM/DD" に置換してからパースする
        const safeDateStr = dateStr.replace(/-/g, '/');
        const date = new Date(safeDateStr);

        if (isNaN(date.getTime())) return '-';

        const i18n = (typeof setaeI18n !== 'undefined') ? setaeI18n : {};
        const now = new Date();

        // 1. 時刻情報が含まれているか判定 (例: "2026-02-19 14:30:00" なら length > 10)
        // 時刻が含まれているデータ（ログやコメントなど）にのみ、細かい時間表記を適用する
        const hasTime = dateStr.trim().length > 10;

        if (hasTime) {
            const diffMs = now - date;
            const diffSec = Math.floor(diffMs / 1000);
            const diffMin = Math.floor(diffSec / 60);
            const diffHour = Math.floor(diffMin / 60);

            // 未来の時間が渡された場合の保護（端末の時計ズレなど）
            if (diffSec >= 0) {
                if (diffSec < 60) return i18n.just_now || 'たった今';
                if (diffMin < 60) return diffMin + (i18n.mins_ago || '分前');
                if (diffHour < 24) return diffHour + (i18n.hours_ago || '時間前');
            }
        }

        // 2. 日付のみのデータ、または24時間以上経過したデータは、時刻を0時にして「日数差」を出す
        now.setHours(0, 0, 0, 0);
        const targetDate = new Date(date);
        targetDate.setHours(0, 0, 0, 0);

        const diffTime = Math.abs(now - targetDate);
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return i18n.today || '今日';
        if (diffDays === 1) return i18n.yesterday || '昨日';
        if (diffDays < 30) return diffDays + (i18n.days_ago || '日前');
        if (diffDays < 365) return Math.floor(diffDays / 30) + (i18n.months_ago || 'ヶ月前');
        return Math.floor(diffDays / 365) + (i18n.years_ago || '年前');
    }

    // Public Interface
    return {
        state: state,
        showToast: showToast,
        formatDateShort: formatDateShort,
        formatRelativeDate: formatRelativeDate
    };

})(jQuery);
