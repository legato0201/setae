jQuery(document).ready(function ($) {
    'use strict';

    console.log('Setae App Initializing...');

    // Modules are now self-initializing via app-ui-renderer.js (Controller)
    // and actions.js handles swipe/click logic.

    if (typeof SetaeUIDesktop !== 'undefined') {
        SetaeUIDesktop.init();
    }

});
