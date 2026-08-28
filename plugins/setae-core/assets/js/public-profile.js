(function () {
    'use strict';

    var root = document.getElementById('setae-public-profile');
    if (!root) return;

    var status = root.querySelector('[data-public-profile-status]');
    function track(eventName, extra) {
        if (!window.SetaeCore || typeof window.SetaeCore.track !== 'function') return;
        window.SetaeCore.track(eventName, Object.assign({ id: Number(root.dataset.profileId || 0) }, extra || {}));
    }

    function announce(message) {
        if (status) status.textContent = message || '';
    }

    function legacyCopy(text) {
        var helper = document.createElement('textarea');
        helper.className = 'setae-public-profile-copy-helper';
        helper.value = text;
        helper.setAttribute('readonly', '');
        document.body.appendChild(helper);
        helper.select();
        var copied = false;
        try {
            copied = document.execCommand('copy');
        } catch (error) {
            copied = false;
        }
        helper.remove();
        return copied;
    }

    function copyText(text) {
        if (!text) return Promise.reject(new Error('コピーする内容がありません。'));
        if (navigator.clipboard && window.isSecureContext) {
            return navigator.clipboard.writeText(text).catch(function () {
                if (!legacyCopy(text)) throw new Error('コピーできませんでした。');
            });
        }
        return legacyCopy(text)
            ? Promise.resolve()
            : Promise.reject(new Error('コピーできませんでした。'));
    }

    function copied(button, message) {
        var original = button.textContent;
        button.textContent = 'コピーしました';
        announce(message);
        window.setTimeout(function () {
            if (button.isConnected) button.textContent = original;
        }, 1400);
    }

    function shareProfile() {
        var data = {
            title: root.dataset.shareTitle || document.title,
            text: root.dataset.shareText || '',
            url: root.dataset.shareUrl || window.location.href
        };
        track('public_profile_share');
        if (typeof navigator.share === 'function') {
            navigator.share(data).catch(function (error) {
                if (error && error.name === 'AbortError') return;
                copyText(data.url).then(function () {
                    announce('プロフィールリンクをコピーしました');
                }).catch(function () {
                    announce('共有できませんでした。');
                });
            });
            return;
        }
        copyText(data.url).then(function () {
            announce('プロフィールリンクをコピーしました');
        }).catch(function () {
            announce('共有できませんでした。');
        });
    }

    root.addEventListener('click', function (event) {
        var shareButton = event.target.closest('[data-public-profile-share]');
        if (shareButton) {
            event.preventDefault();
            shareProfile();
            return;
        }

        var copyButton = event.target.closest('[data-public-profile-copy], [data-public-profile-text]');
        if (copyButton) {
            event.preventDefault();
            var value = copyButton.dataset.publicProfileCopy || copyButton.dataset.publicProfileText || '';
            var message = copyButton.dataset.copyMessage || (copyButton.dataset.publicProfileText
                ? '紹介文をコピーしました'
                : 'プロフィールリンクをコピーしました');
            track(copyButton.dataset.publicProfileText ? 'public_profile_text_copy' : 'public_profile_link_copy');
            copyText(value).then(function () { copied(copyButton, message); }).catch(function () {
                announce('コピーできませんでした。');
            });
            return;
        }

    });

    root.querySelectorAll('[data-public-profile-x], [data-public-profile-line]').forEach(function (link) {
        link.addEventListener('click', function () {
            track(link.hasAttribute('data-public-profile-x') ? 'public_profile_x_click' : 'public_profile_line_click');
        });
    });

    document.addEventListener('click', function (event) {
        root.querySelectorAll('.setae-public-profile-share-menu[open]').forEach(function (menu) {
            if (!menu.contains(event.target)) menu.removeAttribute('open');
        });
    });

    track('public_profile_view');
}());
