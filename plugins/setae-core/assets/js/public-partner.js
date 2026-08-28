(function () {
    'use strict';
    var root = document.querySelector('main[data-public-share-root][data-partner-page]');
    if (!root || !window.SetaePublicShare) return;
    window.SetaePublicShare.mount(root, { eventPrefix: 'partner', viewEvent: 'partner_page_view' });
}());
