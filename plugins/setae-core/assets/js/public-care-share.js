(function () {
    'use strict';
    var root = document.querySelector('main[data-public-share-root][data-care-share-page]');
    if (!root || !window.SetaePublicShare) return;
    window.SetaePublicShare.mount(root, { eventPrefix: 'care_share', viewEvent: 'care_share_view' });
}());
