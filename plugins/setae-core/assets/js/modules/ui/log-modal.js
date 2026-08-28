var SetaeUILogModal = (function ($) {
    'use strict';

    const DEFAULT_PREY_LIST = [
        'ショウジョウバエ',
        'コオロギ',
        'レッドローチ',
        'デュビア',
        'ピンキー'
    ];

    // ▼▼▼ 追加: 植物用のデフォルト選択肢 ▼▼▼
    const DEFAULT_WATERING_LIST = [
        '通常の水やり',
        '葉水',
        '液肥',
        '底面給水・ソーキング'
    ];

    let dailyStreakInviteText = '';
    let dailyStreakInviteUrl = '';
    let dailyStreakLogId = null;
    let currentLogIsPlant = false;
    let currentLogSpiderId = null;
    let logSubmitMode = 'stay';
    let logSaveNextId = null;
    const LAST_FEED_CHOICE_KEY = 'setae_last_feed_choice_v1';
    const LOG_DRAFT_KEY = 'setae_log_drafts_v1';
    const LOG_DRAFT_MAX_AGE_MS = 1000 * 60 * 60 * 48;
    let isRestoringDraft = false;

    const NOTE_TEMPLATES = {
        animal: {
            feed: ['食いつき良好', '食べ残しなし', '反応弱め', '拒食', '水皿補充'],
            molt: ['脱皮完了', '脱皮前かも', '体色変化', '無事確認', '触らず様子見'],
            growth: ['サイズ測定', '体格良好', '少し大きくなった', '体重感あり', '写真あり'],
            note: ['元気', '巣作り中', '隠れている', '活発', '要観察']
        },
        plant: {
            feed: ['水やり済み', '用土乾き気味', '葉の張り良好', '葉水', '様子見'],
            molt: ['植え替え済み', '用土交換', '根の状態確認', '水やり控えめ', '活着待ち'],
            growth: ['新芽あり', '葉色良好', '少し大きくなった', 'サイズ測定', '写真あり'],
            note: ['葉色良好', '置き場所変更', '新芽確認', '乾き気味', '要観察']
        }
    };

    function escapeHtml(value) {
        return String(value || '').replace(/[&<>"']/g, function (char) {
            return {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#039;'
            }[char];
        });
    }

    function cloneCareSummary(summary) {
        if (!summary) return null;

        try {
            return JSON.parse(JSON.stringify(summary));
        } catch (e) {
            return Object.assign({}, summary);
        }
    }

    function readLastFeedChoices() {
        try {
            const raw = localStorage.getItem(LAST_FEED_CHOICE_KEY);
            const parsed = raw ? JSON.parse(raw) : {};
            return parsed && typeof parsed === 'object' ? parsed : {};
        } catch (e) {
            return {};
        }
    }

    function getLastFeedChoice(spiderId) {
        if (!spiderId) return '';
        const choices = readLastFeedChoices();
        return choices[String(spiderId)] || '';
    }

    function saveLastFeedChoice(spiderId, value) {
        if (!spiderId || !value) return;

        try {
            const choices = readLastFeedChoices();
            choices[String(spiderId)] = value;
            localStorage.setItem(LAST_FEED_CHOICE_KEY, JSON.stringify(choices));
        } catch (e) {
            // localStorageが使えない環境では保存しない。
        }
    }

    function getPreferredFeedChoice(spider, isPlant) {
        const stored = getLastFeedChoice(spider && spider.id ? spider.id : currentLogSpiderId);
        if (stored) return stored;

        if (!isPlant && spider && spider.last_prey) {
            return spider.last_prey;
        }

        return isPlant ? DEFAULT_WATERING_LIST[0] : 'デュビア';
    }

    function updateLastFeedChoiceHint(value, label = '前回') {
        const $hint = $('#log-feed-last-choice');
        if (!$hint.length) return;

        if (value) {
            $hint.text(`${label}: ${value}`).attr('title', `${label}: ${value}`).show();
        } else {
            $hint.hide().text('').removeAttr('title');
        }
    }

    function updateSaveNextButton(spiderId) {
        const $button = $('#btn-log-save-next');
        const $actions = $('.log-submit-actions');
        logSaveNextId = null;

        if (!$button.length || !window.SetaeUIList || !SetaeUIList.getAdjacentSpider) {
            $button.hide();
            $actions.removeClass('has-next');
            return;
        }

        const adjacent = SetaeUIList.getAdjacentSpider(spiderId);
        const next = adjacent && adjacent.next ? adjacent.next : null;

        if (!next || !next.id) {
            $button.hide().removeData('next-id').removeAttr('title');
            $actions.removeClass('has-next');
            return;
        }

        logSaveNextId = next.id;
        $button
            .text('保存して次へ')
            .data('next-id', next.id)
            .attr('title', next.title || next.species_name || '次の個体')
            .show();
        $actions.addClass('has-next');
    }

    function readLogDrafts() {
        try {
            const raw = localStorage.getItem(LOG_DRAFT_KEY);
            const parsed = raw ? JSON.parse(raw) : {};
            return parsed && typeof parsed === 'object' ? parsed : {};
        } catch (e) {
            return {};
        }
    }

    function writeLogDrafts(drafts) {
        try {
            localStorage.setItem(LOG_DRAFT_KEY, JSON.stringify(drafts || {}));
        } catch (e) {
            // localStorageが使えない環境では何もしない。
        }
    }

    function getLogDraft(spiderId) {
        if (!spiderId) return null;

        const draft = readLogDrafts()[String(spiderId)] || null;
        if (!draft || !draft.updated_at || (Date.now() - draft.updated_at) > LOG_DRAFT_MAX_AGE_MS) {
            clearLogDraft(spiderId);
            return null;
        }

        return draft;
    }

    function clearLogDraft(spiderId) {
        if (!spiderId) return;

        const drafts = readLogDrafts();
        if (drafts[String(spiderId)]) {
            delete drafts[String(spiderId)];
            writeLogDrafts(drafts);
        }
    }

    function canUseOnlineSharing() {
        return !(window.SetaeOffline && SetaeOffline.shouldUseLocal())
            && !(window.SetaeSettings && (SetaeSettings.guest_mode || SetaeSettings.offline_session));
    }

    function collectLogDraft() {
        return {
            type: $('#log-type').val() || 'feed',
            date: $('#log-date').val() || getLocalDateByOffset(0),
            note: $('#log-note').val() || '',
            prey: $('#log-feed-prey-select').val() || '',
            refused: $('#log-feed-refused').is(':checked'),
            size: $('#log-size').val() || '',
            share_feed: canUseOnlineSharing() && $('#log-share-feed').is(':checked'),
            updated_at: Date.now()
        };
    }

    function hasMeaningfulDraft(draft) {
        if (!draft) return false;
        if ((draft.note || '').trim()) return true;
        if ((draft.size || '').trim()) return true;
        if (draft.refused) return true;
        if (draft.date && draft.date !== getLocalDateByOffset(0)) return true;
        if (draft.type && draft.type !== 'feed') return true;
        return false;
    }

    function saveLogDraft() {
        if (isRestoringDraft || !currentLogSpiderId) return;

        const draft = collectLogDraft();
        if (!hasMeaningfulDraft(draft)) {
            clearLogDraft(currentLogSpiderId);
            return;
        }

        const drafts = readLogDrafts();
        drafts[String(currentLogSpiderId)] = draft;
        writeLogDrafts(drafts);
    }

    function showLogDraftBanner() {
        $('#log-draft-banner').css('display', 'flex');
    }

    function hideLogDraftBanner() {
        $('#log-draft-banner').hide();
    }

    function resetLogFormDefaults() {
        const spider = (SetaeCore.state && Array.isArray(SetaeCore.state.cachedSpiders))
            ? SetaeCore.state.cachedSpiders.find(s => String(s.id) === String(currentLogSpiderId))
            : null;

        isRestoringDraft = true;
        try {
            $(`.log-type-btn[data-val="feed"], .type-btn-sm[data-val="feed"]`).trigger('click');
            setLogDateByOffset(0);
            $('#log-note').val('');
            $('#log-size').val('');
            $('#log-feed-refused').prop('checked', false);
            $('#log-share-feed').prop(
                'checked',
                canUseOnlineSharing() && localStorage.getItem('setae_share_feed_default') === '1'
            );

            const preferredFeedChoice = getPreferredFeedChoice(spider, currentLogIsPlant);
            $('#log-feed-prey-select').val(preferredFeedChoice);
            renderLogPreyButtons(currentLogIsPlant);
            updateLastFeedChoiceHint(getLastFeedChoice(currentLogSpiderId) || (!currentLogIsPlant && spider && spider.last_prey ? spider.last_prey : ''));

            syncDateQuickChips();
            syncShareFeedHint();
            syncNoteChipState();
        } finally {
            isRestoringDraft = false;
        }
    }

    function discardLogDraft() {
        if (!currentLogSpiderId) return;

        clearLogDraft(currentLogSpiderId);
        hideLogDraftBanner();
        resetLogFormDefaults();
        SetaeCore.showToast('下書きを破棄しました', 'info');

        if (typeof SetaeCore.track === 'function') {
            SetaeCore.track('log_draft_discard');
        }
    }

    function restoreLogDraft(spiderId) {
        const draft = getLogDraft(spiderId);
        if (!hasMeaningfulDraft(draft)) return false;

        isRestoringDraft = true;
        try {
            const type = draft.type || 'feed';
            $(`.log-type-btn[data-val="${type}"], .type-btn-sm[data-val="${type}"]`).trigger('click');
            $('#log-date').val(draft.date || getLocalDateByOffset(0));
            $('#log-note').val(draft.note || '');
            $('#log-size').val(draft.size || '');
            $('#log-feed-refused').prop('checked', !!draft.refused);
            $('#log-share-feed').prop('checked', canUseOnlineSharing() && !!draft.share_feed);

            if (draft.prey) {
                $('#log-feed-prey-select').val(draft.prey);
                renderLogPreyButtons(currentLogIsPlant);
                updateLastFeedChoiceHint(draft.prey, '下書き');
            }

            syncDateQuickChips();
            syncShareFeedHint();
            syncNoteChipState();
        } finally {
            isRestoringDraft = false;
        }

        SetaeCore.showToast('前回の下書きを復元しました', 'info');
        showLogDraftBanner();
        if (typeof SetaeCore.track === 'function') {
            SetaeCore.track('log_draft_restored', {
                type: draft.type || 'feed'
            });
        }
        return true;
    }

    function getLocalDateByOffset(offsetDays = 0) {
        const now = new Date();
        now.setDate(now.getDate() + offsetDays);
        const localDate = new Date(now.getTime() - (now.getTimezoneOffset() * 60000));
        return localDate.toISOString().split('T')[0];
    }

    function syncDateQuickChips() {
        const value = $('#log-date').val();
        $('.log-date-chip').removeClass('active');
        $('.log-date-chip').each(function () {
            const offset = parseInt($(this).data('offset'), 10) || 0;
            $(this).toggleClass('active', value === getLocalDateByOffset(offset));
        });
    }

    function setLogDateByOffset(offsetDays, source = 'default') {
        $('#log-date').val(getLocalDateByOffset(offsetDays));
        syncDateQuickChips();

        if (source === 'quick' && typeof SetaeCore.track === 'function') {
            SetaeCore.track('log_date_quick_select', {
                offset: offsetDays
            });
        }
        saveLogDraft();
    }

    // モジュール内に追加: 画像プレビュー等のイベント設定
    function bindLogImageEvents() {
        // アップロードボタン -> ファイル選択発火
        $('#btn-trigger-upload').off('click').on('click', function () {
            $('#log-image').click();
        });

        // ファイル選択時 -> プレビュー表示
        $('#log-image').off('change').on('change', function (e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function (e) {
                    $('#preview-img-tag').attr('src', e.target.result);
                    $('#log-image-preview').show();

                    // 写真がある時だけBest Shotを有効化する
                    $('#btn-trigger-upload').hide();

                    $('.toggle-best-shot').removeClass('is-disabled');
                    $('#log-best-shot').prop('disabled', false);
                    syncShareFeedHint();
                }
                reader.readAsDataURL(file);
            }
        });

        // 削除ボタン -> クリア
        $('#btn-remove-image').off('click').on('click', function () {
            $('#log-image').val('');
            $('#preview-img-tag').attr('src', '');
            $('#log-image-preview').hide();

            $('#btn-trigger-upload').show();

            $('.toggle-best-shot').addClass('is-disabled').css('display', 'flex');
            $('#log-best-shot').prop('checked', false).prop('disabled', true);
            syncShareFeedHint();
        });
    }

    function hasShareableLogContent() {
        const note = ($('#log-note').val() || '').trim();
        const fileInput = $('#log-image')[0];
        const hasImage = !!(fileInput && fileInput.files && fileInput.files.length > 0);
        return !!note || hasImage || $('#log-best-shot').is(':checked');
    }

    function syncShareFeedHint() {
        if (!canUseOnlineSharing()) {
            $('.toggle-share-feed').removeClass('is-recommended');
            return;
        }
        const checked = $('#log-share-feed').is(':checked');
        const recommended = hasShareableLogContent() && !checked;
        $('.toggle-share-feed').toggleClass('is-recommended', recommended);

        const $hint = $('#log-share-hint');
        if (!$hint.length) return;

        if (checked) {
            $hint.text('保存するとお世話フィードにも表示されます。');
        } else if (recommended) {
            $hint.text('写真やメモがある記録は共有しやすくなります。');
        } else {
            $hint.text('共有はいつでもオン・オフできます。');
        }
    }

    function getNoteTemplates(type) {
        const group = currentLogIsPlant ? NOTE_TEMPLATES.plant : NOTE_TEMPLATES.animal;
        return group[type] || group.note || [];
    }

    function syncNoteChipState() {
        const note = ($('#log-note').val() || '');
        $('.log-note-chip').each(function () {
            const value = $(this).data('note') || '';
            $(this).toggleClass('active', !!value && note.indexOf(value) !== -1);
        });
    }

    function renderNoteSuggestions(type) {
        const $container = $('#log-note-suggestions');
        if (!$container.length) return;

        const templates = getNoteTemplates(type || $('#log-type').val() || 'note');
        if (!templates.length) {
            $container.hide().empty();
            return;
        }

        $container.html(templates.map(note => `
            <button type="button" class="log-note-chip" data-note="${escapeHtml(note)}">${escapeHtml(note)}</button>
        `).join('')).css('display', 'flex');
        syncNoteChipState();
    }

    function handleNoteChipClick() {
        const value = $(this).data('note') || '';
        if (!value) return;

        const $note = $('#log-note');
        const current = ($note.val() || '').trim();
        const next = current
            ? (current.indexOf(value) === -1 ? `${current}、${value}` : current)
            : value;

        $note.val(next).trigger('input');
        syncNoteChipState();

        if (typeof SetaeCore.track === 'function') {
            SetaeCore.track('log_note_template_click', {
                type: $('#log-type').val() || '',
                mode: currentLogIsPlant ? 'plant' : 'animal'
            });
        }
        saveLogDraft();
    }

    function copyShareText(text) {
        if (SetaeCore && typeof SetaeCore.copyText === 'function') {
            return SetaeCore.copyText(text);
        }
        if (navigator.clipboard && window.isSecureContext) {
            return navigator.clipboard.writeText(text);
        }

        return new Promise(function (resolve, reject) {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.setAttribute('readonly', '');
            textarea.style.position = 'fixed';
            textarea.style.left = '-9999px';
            textarea.style.top = '0';
            document.body.appendChild(textarea);
            textarea.select();

            try {
                const successful = document.execCommand('copy');
                document.body.removeChild(textarea);
                successful ? resolve() : reject(new Error('copy_failed'));
            } catch (error) {
                document.body.removeChild(textarea);
                reject(error);
            }
        });
    }

    function showManualCopy(title, text) {
        if (SetaeCore && typeof SetaeCore.requestText === 'function') {
            return SetaeCore.requestText({
                title: title,
                message: '自動でコピーできませんでした。下の内容を選択してコピーしてください。',
                inputLabel: title,
                value: text,
                maxLength: Math.max(500, String(text || '').length + 20),
                confirmLabel: '閉じる'
            });
        }
        window.prompt(title, text);
        return Promise.resolve(null);
    }

    function ensureShareCompleteModal() {
        if ($('#setae-share-complete-modal').length) return;

        $('body').append(`
            <div id="setae-share-complete-modal" class="setae-modal" style="display:none;">
                <div class="setae-modal-content setae-share-complete-modal">
                    <button type="button" class="setae-close" id="close-share-complete-modal">&times;</button>
                    <span class="setae-share-complete-kicker">共有完了</span>
                    <h3>お世話記録を共有しました</h3>
                    <p>このリンクにはあなたの紹介コードが含まれます。見た人が登録すると、お互いの登録枠が増えます。</p>
                    <input type="text" id="setae-share-complete-url" class="setae-input" readonly>
                    <div class="setae-share-complete-actions">
                        <button type="button" class="setae-btn setae-btn-primary" id="btn-copy-care-share-url">リンクをコピー</button>
                        <button type="button" class="setae-btn setae-btn-secondary" id="btn-open-care-feed-after-share">お世話フィードを見る</button>
                    </div>
                </div>
            </div>
        `);

        $(document).on('click', '#close-share-complete-modal', function () {
            $('#setae-share-complete-modal').fadeOut(160);
        });

        $(document).on('click', '#btn-copy-care-share-url', function () {
            const $btn = $(this);
            const originalText = $btn.text();
            const url = $('#setae-share-complete-url').val();
            if (!url) return;

            $btn.prop('disabled', true).text('コピー中...');
            copyShareText(url).then(function () {
                $btn.text('コピーしました');
                SetaeCore.showToast('共有リンクをコピーしました', 'success');
                if (typeof SetaeCore.track === 'function') {
                    SetaeCore.track('care_feed_share_link_copy');
                }
                setTimeout(function () {
                    $btn.text(originalText).prop('disabled', false);
                }, 1300);
            }).catch(function () {
                showManualCopy('共有リンク', url);
                $btn.text(originalText).prop('disabled', false);
            });
        });

        $(document).on('click', '#btn-open-care-feed-after-share', function () {
            $('#setae-share-complete-modal').fadeOut(120);
            $('.setae-nav-item[data-target="section-care-feed"]').trigger('click');
        });
    }

    function showShareCompleteModal(shareUrl) {
        if (!shareUrl) return;

        ensureShareCompleteModal();
        $('#setae-share-complete-url').val(shareUrl);
        $('#setae-share-complete-modal').fadeIn(180).css('display', 'flex');
    }

    function getReferralInviteUrl() {
        const user = (typeof SetaeSettings !== 'undefined' && SetaeSettings.current_user) ? SetaeSettings.current_user : {};
        const code = user && user.referral_code ? user.referral_code : '';
        const siteUrl = (typeof SetaeSettings !== 'undefined' && SetaeSettings.site_url) ? SetaeSettings.site_url : window.location.origin;

        if (!code) return siteUrl;

        try {
            const url = new URL(siteUrl, window.location.origin);
            url.searchParams.set('ref', code);
            return url.toString();
        } catch (e) {
            return siteUrl + (siteUrl.indexOf('?') === -1 ? '?' : '&') + 'ref=' + encodeURIComponent(code);
        }
    }

    function buildDailyStreakInviteText(summary) {
        const streak = parseInt(summary && summary.streak, 10) || 1;
        const user = (typeof SetaeSettings !== 'undefined' && SetaeSettings.current_user) ? SetaeSettings.current_user : {};
        const code = user && user.referral_code ? user.referral_code : '';

        let text = `Setaeで今日のお世話記録を残しました。\n連続 ${streak}日、飼育ログを継続中です。`;
        if (code) {
            text += `\n\n登録時に紹介コード「${code}」を使うと、生体登録枠が+1されます。`;
        }
        return text;
    }

    function shouldShowDailyStreakAchievement(previousSummary, nextSummary, sharedToFeed) {
        if (sharedToFeed || !previousSummary || !nextSummary || !nextSummary.today) return false;
        if (nextSummary.last_check_date !== nextSummary.today) return false;
        if (previousSummary.last_check_date === nextSummary.today) return false;

        const seenKey = 'setae_daily_streak_seen_' + nextSummary.today;
        if (localStorage.getItem(seenKey) === '1') return false;

        localStorage.setItem(seenKey, '1');
        return true;
    }

    function renderDailyStreakWeek(summary) {
        const week = summary && Array.isArray(summary.week) ? summary.week : [];
        if (!week.length) return '';

        return `
            <div class="setae-daily-streak-week" aria-label="直近7日の記録">
                ${week.map(day => `
                    <span class="setae-daily-streak-day${day.checked ? ' is-checked' : ''}${day.date === summary.today ? ' is-today' : ''}">
                        <i></i>
                        <em>${escapeHtml(day.label || '')}</em>
                    </span>
                `).join('')}
            </div>
        `;
    }

    function ensureDailyStreakModal() {
        if ($('#setae-daily-streak-modal').length) return;

        $('body').append(`
            <div id="setae-daily-streak-modal" class="setae-modal" style="display:none;">
                <div class="setae-modal-content setae-daily-streak-modal">
                    <button type="button" class="setae-close" id="close-daily-streak-modal">&times;</button>
                    <span class="setae-daily-streak-kicker">今日の記録完了</span>
                    <h3 id="setae-daily-streak-title">連続記録</h3>
                    <p id="setae-daily-streak-message"></p>
                    <div id="setae-daily-streak-week-wrap"></div>
                    <div class="setae-daily-streak-actions">
                        <button type="button" class="setae-btn setae-btn-primary" id="btn-share-daily-streak-log">お世話フィードに共有</button>
                        <button type="button" class="setae-btn setae-btn-primary" id="btn-copy-daily-streak-invite">紹介文をコピー</button>
                        <button type="button" class="setae-btn setae-btn-secondary" id="btn-share-daily-streak-x">Xで共有</button>
                    </div>
                </div>
            </div>
        `);

        $(document).on('click', '#close-daily-streak-modal', function () {
            $('#setae-daily-streak-modal').fadeOut(160);
        });

        $(document).on('click', '#btn-copy-daily-streak-invite', function () {
            const $btn = $(this);
            const originalText = $btn.text();
            if (!dailyStreakInviteText) return;

            $btn.prop('disabled', true).text('コピー中...');
            copyShareText(dailyStreakInviteText + '\n' + dailyStreakInviteUrl).then(function () {
                $btn.text('コピーしました');
                SetaeCore.showToast('紹介文をコピーしました', 'success');
                if (typeof SetaeCore.track === 'function') {
                    SetaeCore.track('daily_streak_invite_copy');
                }
                setTimeout(function () {
                    $btn.text(originalText).prop('disabled', false);
                }, 1300);
            }).catch(function () {
                showManualCopy('紹介文', dailyStreakInviteText + '\n' + dailyStreakInviteUrl);
                $btn.text(originalText).prop('disabled', false);
            });
        });

        $(document).on('click', '#btn-share-daily-streak-log', function () {
            const $btn = $(this);
            const originalText = $btn.text();

            if (!canUseOnlineSharing()) {
                $btn.hide();
                SetaeCore.showToast('お世話フィードへの共有は、無料登録後に利用できます', 'warning');
                return;
            }

            if (!dailyStreakLogId || !SetaeAPI.shareLogToCareFeed) {
                SetaeCore.showToast('共有できる記録が見つかりません', 'warning');
                return;
            }

            $btn.prop('disabled', true).text('共有中...');
            SetaeAPI.shareLogToCareFeed(dailyStreakLogId, function (response) {
                SetaeCore.showToast('お世話フィードに共有しました', 'success');
                $('#setae-daily-streak-modal').fadeOut(120);

                if (window.SetaeUI && SetaeUI.loadCareFeed) {
                    SetaeUI.loadCareFeed();
                }

                if (response && response.share_url) {
                    showShareCompleteModal(response.share_url);
                }

                if (typeof SetaeCore.track === 'function') {
                    SetaeCore.track('daily_streak_share_to_feed');
                    SetaeCore.track('care_feed_share_success', {
                        source: 'daily_streak_modal'
                    });
                }

                $btn.text(originalText).prop('disabled', false);
            }).always(function () {
                $btn.text(originalText).prop('disabled', false);
            });
        });

        $(document).on('click', '#btn-share-daily-streak-x', function () {
            if (!dailyStreakInviteText) return;

            const url = 'https://twitter.com/intent/tweet?text='
                + encodeURIComponent(dailyStreakInviteText)
                + '&url='
                + encodeURIComponent(dailyStreakInviteUrl);
            window.open(url, '_blank', 'noopener,noreferrer');
            if (typeof SetaeCore.track === 'function') {
                SetaeCore.track('daily_streak_invite_x');
            }
        });
    }

    function showDailyStreakModal(summary, logId) {
        if (!summary) return;

        const streak = parseInt(summary.streak, 10) || 1;
        const bestStreak = parseInt(summary.best_streak, 10) || streak;
        const title = streak <= 1 ? '連続記録が始まりました' : `連続 ${streak}日`;
        const message = bestStreak <= streak
            ? '今日の記録で、自己ベストを更新しています。'
            : '明日も1件残すと、この連続記録を伸ばせます。';

        dailyStreakInviteText = buildDailyStreakInviteText(summary);
        dailyStreakInviteUrl = getReferralInviteUrl();
        dailyStreakLogId = logId || null;

        ensureDailyStreakModal();
        $('#setae-daily-streak-title').text(title);
        $('#setae-daily-streak-message').text(message);
        $('#setae-daily-streak-week-wrap').html(renderDailyStreakWeek(summary));
        $('#btn-share-daily-streak-log')
            .toggle(canUseOnlineSharing() && !!dailyStreakLogId)
            .prop('disabled', !canUseOnlineSharing() || !dailyStreakLogId);
        $('#setae-daily-streak-modal').fadeIn(180).css('display', 'flex');

        if (typeof SetaeCore.track === 'function') {
            SetaeCore.track('daily_streak_modal_seen', {
                streak: streak,
                best_streak: bestStreak
            });
        }
    }

    function openLogModal(eOrId = null, initialType = 'feed') {
        // eOrId could be event object or ID string/number
        let idToUse = null;
        if (eOrId && (typeof eOrId === 'string' || typeof eOrId === 'number')) {
            idToUse = eOrId;
        } else if (SetaeUIDetail && SetaeUIDetail.getCurrentSpiderId) {
            const val = $('#log-spider-id').val();
            if (val) idToUse = val;
        }

        // If still null, try to find from open detail section
        if (!idToUse && $('#section-my-detail').is(':visible')) {
            const text = $('#detail-spider-id-badge').text().replace('#', '');
            if (text) idToUse = text;
        }

        if (!idToUse) return;

        // ★追加: 現在の個体データを取得して分類判定
        const spider = SetaeCore.state.cachedSpiders ? SetaeCore.state.cachedSpiders.find(s => s.id == idToUse) : null;
        const cls = spider ? (spider.classification || 'tarantula') : 'tarantula';
        const isPlant = (cls === 'plant');
        currentLogIsPlant = isPlant;
        currentLogSpiderId = idToUse;
        logSubmitMode = 'stay';
        logSaveNextId = null;
        isRestoringDraft = true;
        hideLogDraftBanner();

        // ★追加: ボタン・ラベルの書き換え
        const $modal = $('#setae-log-modal');
        const $btnFeed = $modal.find('button[data-val="feed"]');
        const $btnMolt = $modal.find('button[data-val="molt"]');

        if (isPlant) {
            // 植物モード
            $btnFeed.html('💧').attr('title', '水やり');
            $btnMolt.html('🪴').attr('title', '植え替え');
            $('#log-feed-options label').first().text('水やりの種類（任意）');

            // ▼▼▼ 追加: 植物の場合は生き物用の設定ボタンを隠す ▼▼▼
            $('#btn-manage-feed-types').hide();
        } else {
            // 通常モード
            $btnFeed.html('🦗').attr('title', '給餌');
            $btnMolt.html('🧬').attr('title', '脱皮');
            $('#log-feed-options label').first().text('餌');

            // ▼▼▼ 追加: 生き物の場合は設定ボタンを表示 ▼▼▼
            $('#btn-manage-feed-types').show();
        }

        $('#setae-log-form')[0].reset();

        // 画像プレビューのリセット
        $('#log-image').val('');
        $('#log-image-preview').hide();
        $('#preview-img-tag').attr('src', '');

        // ▼▼▼ 追加: UIの初期状態セット（ボタン表示、トグル非表示） ▼▼▼
        $('#btn-trigger-upload').show();

        // 【修正】トグルの表示制御を植物対応に変更
        // 一旦すべてのトグルを隠す
        $('.setae-toggle-wrapper').hide();

        // 植物でなければ「拒食 (Refused)」トグルを表示する
        if (!isPlant) {
            $('.toggle-refused').css('display', 'flex');
        }
        const onlineSharing = canUseOnlineSharing();
        $('.log-share-options').toggle(onlineSharing);
        $('.toggle-best-shot').addClass('is-disabled').css('display', onlineSharing ? 'flex' : 'none');
        $('#log-best-shot').prop('checked', false).prop('disabled', true);
        $('.toggle-share-feed').css('display', onlineSharing ? 'flex' : 'none');
        $('#log-share-feed')
            .prop('disabled', !onlineSharing)
            .prop('checked', onlineSharing && localStorage.getItem('setae_share_feed_default') === '1');

        // イベントバインド (まだ行われていなければ)
        bindLogImageEvents();
        $('#log-share-feed').off('change.setaeShareFeed').on('change.setaeShareFeed', function () {
            localStorage.setItem('setae_share_feed_default', $(this).is(':checked') ? '1' : '0');
            syncShareFeedHint();
            saveLogDraft();
        });
        $('#log-note').off('input.setaeShareFeed').on('input.setaeShareFeed', function () {
            syncShareFeedHint();
            syncNoteChipState();
            saveLogDraft();
        });
        $('#log-best-shot').off('change.setaeShareFeed').on('change.setaeShareFeed', function () {
            syncShareFeedHint();
            saveLogDraft();
        });
        $('#log-size, #log-feed-refused').off('input.setaeDraft change.setaeDraft').on('input.setaeDraft change.setaeDraft', saveLogDraft);
        $('#btn-log-draft-discard').off('click.setaeDraftDiscard').on('click.setaeDraftDiscard', discardLogDraft);
        $(document).off('click.setaeNoteChip').on('click.setaeNoteChip', '.log-note-chip', handleNoteChipClick);
        $('#btn-log-save-next').off('click.setaeSaveNext').on('click.setaeSaveNext', function () {
            const nextId = $(this).data('next-id') || logSaveNextId;
            if (!nextId) return;
            logSubmitMode = 'next';
            logSaveNextId = nextId;
            $('#setae-log-form').trigger('submit');
        });
        $('#setae-log-form .setae-btn-submit').off('click.setaeSaveStay').on('click.setaeSaveStay', function () {
            logSubmitMode = 'stay';
        });
        $('.log-date-chip').off('click.setaeDateQuick').on('click.setaeDateQuick', function () {
            const offset = parseInt($(this).data('offset'), 10) || 0;
            setLogDateByOffset(offset, 'quick');
        });
        $('#log-date').off('change.setaeDateQuick input.setaeDateQuick').on('change.setaeDateQuick input.setaeDateQuick', function () {
            syncDateQuickChips();
            saveLogDraft();
        });
        syncShareFeedHint();

        setLogDateByOffset(0);

        $('#log-spider-id').val(idToUse);
        updateSaveNextButton(idToUse);
        const preferredFeedChoice = getPreferredFeedChoice(spider, isPlant);
        $('#log-feed-prey-select').val(preferredFeedChoice);
        updateLastFeedChoiceHint(getLastFeedChoice(idToUse) || (!isPlant && spider && spider.last_prey ? spider.last_prey : ''));
        // ▼▼▼ 修正: isPlantフラグを渡す ▼▼▼
        renderLogPreyButtons(isPlant);

        // ▼▼▼ 追加: 前回のサイズ情報を取得して表示 ▼▼▼
        $('#log-size').val('');
        $('#log-prev-size-label').hide();
        let prevSize = '';
        if (spider && spider.size) {
            prevSize = spider.size;
        }
        if (prevSize && prevSize !== '--' && prevSize !== '未設定') {
            $('#log-prev-size-val').text(prevSize);
            $('#log-prev-size-label').show();
        }
        // ▲▲▲ 追加ここまで ▲▲▲

        $('#setae-log-modal').fadeIn();

        const typeToSelect = (typeof initialType === 'string') ? initialType : 'feed';
        $(`.log-type-btn[data-val="${typeToSelect}"], .type-btn-sm[data-val="${typeToSelect}"]`).trigger('click');
        renderNoteSuggestions(typeToSelect);
        isRestoringDraft = false;
        restoreLogDraft(idToUse);
    }

    // ▼▼▼ 修正: 引数 isPlant を追加（デフォルトは false） ▼▼▼
    function renderLogPreyButtons(isPlant = false) {
        const container = $('#log-feed-prey-buttons');
        container.empty();

        let types;

        // ▼▼▼ 追加: 植物か生き物かでリストを分岐 ▼▼▼
        if (isPlant) {
            types = DEFAULT_WATERING_LIST;
        } else {
            if (!SetaeCore.state.feedTypes || SetaeCore.state.feedTypes.length === 0) {
                SetaeCore.state.feedTypes = DEFAULT_PREY_LIST;
            }
            types = SetaeCore.state.feedTypes;
        }

        const currentVal = $('#log-feed-prey-select').val();
        if (currentVal && !types.includes(currentVal)) {
            types = [currentVal].concat(types);
        }

        types.forEach(t => {
            container.append(`<button type="button" class="prey-btn" data-val="${t}">${t}</button>`);
        });

        $('.prey-btn').on('click', function () {
            const val = $(this).data('val');
            $('#log-feed-prey-select').val(val);
            $('.prey-btn').removeClass('active');
            $(this).addClass('active');
            updateLastFeedChoiceHint(val, '選択中');
            saveLogDraft();
        });

        if (currentVal) {
            $(`.prey-btn[data-val="${currentVal}"]`).addClass('active');
        } else {
            $('.prey-btn:first').trigger('click');
        }
    }

    function handleLogTypeClick() {
        $('.log-type-btn, .type-btn-sm').removeClass('active');
        $(this).addClass('active');

        const val = $(this).data('val');
        $('#log-type').val(val);

        $('.log-option-group').hide();

        if (val === 'feed') {
            $('#log-feed-options').show();
            $('.options-container').show();
        } else if (val === 'growth' || val === 'molt') {
            $('#log-growth-options').show();
            $('.options-container').show();
        } else {
            $('.options-container').hide();
        }

        renderNoteSuggestions(val);
        saveLogDraft();
    }

    function handleLogSubmit(e) {
        e.preventDefault();

        // ▼▼▼ 追加: ボタンの取得と無効化 ▼▼▼
        const $submitBtn = $('#setae-log-form').find('button[type="submit"]');
        const $saveNextBtn = $('#btn-log-save-next');
        const originalBtnText = $submitBtn.text();
        const originalNextText = $saveNextBtn.text();
        const afterSaveMode = (logSubmitMode === 'next' && logSaveNextId) ? 'next' : 'stay';
        const nextSpiderId = logSaveNextId;

        if ($submitBtn.prop('disabled')) return; // 念のため二重チェック

        $submitBtn.prop('disabled', true).text('保存中...');
        $saveNextBtn.prop('disabled', true);
        if (afterSaveMode === 'next') {
            $saveNextBtn.text('保存中...');
        }
        // ▲▲▲ 追加ここまで ▲▲▲

        const restoreSubmitButtons = function () {
            $submitBtn.prop('disabled', false).text(originalBtnText);
            $saveNextBtn.prop('disabled', false).text(originalNextText);
            logSubmitMode = 'stay';
        };

        const id = $('#log-spider-id').val();
        const type = $('#log-type').val();
        const date = $('#log-date').val();
        const note = $('#log-note').val();

        // [追加] ファイル入力を取得
        const fileInput = $('#log-image')[0];
        const file = (fileInput && fileInput.files.length > 0) ? fileInput.files[0] : null;

        let dataPayload = {};
        let feedChoice = '';
        if (type === 'feed') {
            const prey = $('#log-feed-prey-select').val();
            const refused = $('#log-feed-refused').is(':checked');
            if (!prey && !refused) {
                SetaeCore.showToast('餌の種類または拒食を選択してください', 'warning');
                // バリデーションエラー時はボタンを元に戻す
                restoreSubmitButtons();
                return;
            }
            feedChoice = prey;
            dataPayload = { prey_type: prey, refused: refused };
        } else if (type === 'growth') {
            // ▼▼▼ 修正: 数値のみを抽出して送信 ▼▼▼
            let rawSize = $('#log-size').val();
            if (rawSize) {
                // 万が一コピペ等で「cm」が含まれても数字と小数点以外を除去する
                rawSize = rawSize.toString().replace(/[^\d.]/g, '');
                dataPayload = { size: rawSize };
            }
            // ▲▲▲ 修正ここまで ▲▲▲
        }

        if (note && note.trim() !== '') {
            dataPayload.note = note;
        }

        // [追加] Best Shot フラグ
        if (canUseOnlineSharing() && !$('#log-best-shot').prop('disabled') && $('#log-best-shot').is(':checked')) {
            dataPayload.is_best_shot = true;
        }

        const sharedToFeed = canUseOnlineSharing() && $('#log-share-feed').is(':checked');
        if (sharedToFeed) {
            dataPayload.share_to_feed = true;
        }

        const previousCareSummary = cloneCareSummary(SetaeCore.state ? SetaeCore.state.careSummary : null);

        // [変更] API呼び出しにfile引数を追加
        SetaeAPI.logEvent(id, type, date, dataPayload, file, (response) => {
            SetaeCore.showToast(sharedToFeed ? '記録を追加し、お世話フィードに共有しました' : '記録を追加しました', 'success');
            clearLogDraft(id);
            if (typeof SetaeCore.track === 'function') {
                SetaeCore.track('log_create_success', {
                    type: type,
                    has_image: !!file,
                    shared: sharedToFeed
                });
            }
            if (type === 'feed' && feedChoice) {
                saveLastFeedChoice(id, feedChoice);
                if (typeof SetaeCore.track === 'function') {
                    SetaeCore.track('log_feed_choice_saved', {
                        mode: currentLogIsPlant ? 'plant' : 'animal'
                    });
                }
            }
            if (sharedToFeed && typeof SetaeCore.track === 'function') {
                SetaeCore.track('care_feed_share_success', {
                    type: type,
                    has_image: !!file
                });
            }
            $('#setae-log-modal').fadeOut();
            hideLogDraftBanner();
            $('#setae-log-form')[0].reset();

            // [追加] 画像プレビューのリセット
            $('#log-image-preview').hide();
            $('#preview-img-tag').attr('src', '');
            $('#log-image').val('');

            // UI状態のリセット
            $('#btn-trigger-upload').show();
            $('.toggle-best-shot').addClass('is-disabled').css('display', 'flex');
            $('#log-best-shot').prop('checked', false).prop('disabled', true);

            // ▼▼▼ 追加: ボタンを元の状態に戻す ▼▼▼
            restoreSubmitButtons();

            if (window.SetaeUIDetail) {
                if (SetaeUIDetail.loadSpiderLogs) {
                    SetaeUIDetail.loadSpiderLogs(id);
                }
            }
            if (window.SetaeUIList && SetaeUIList.updateSpiderCard && response && response.spider) {
                SetaeUIList.updateSpiderCard(id, response.spider, {
                    state: 'updated',
                    label: '更新済み'
                });
            } else if (window.SetaeUIList && SetaeUIList.renderMySpiders) {
                SetaeAPI.fetchMySpiders(SetaeUIList.renderMySpiders);
            }
            if (sharedToFeed && $('#section-care-feed').is(':visible') && window.SetaeUI && SetaeUI.loadCareFeed) {
                SetaeUI.loadCareFeed();
            }

            if (afterSaveMode === 'next' && nextSpiderId && window.SetaeUIDetail && SetaeUIDetail.loadSpiderDetail) {
                SetaeUIDetail.loadSpiderDetail(nextSpiderId);
                if (typeof SetaeCore.track === 'function') {
                    SetaeCore.track('log_save_next_click', {
                        type: type
                    });
                }
            }

            if (afterSaveMode !== 'next' && sharedToFeed && response && response.share_url) {
                showShareCompleteModal(response.share_url);
            }

            if (afterSaveMode !== 'next' && response && response.care_summary && shouldShowDailyStreakAchievement(previousCareSummary, response.care_summary, sharedToFeed)) {
                showDailyStreakModal(response.care_summary, response.id);
            }
        }, function (xhr) {
            restoreSubmitButtons();

            const message = xhr && xhr.responseJSON && xhr.responseJSON.message
                ? xhr.responseJSON.message
                : '通信状態を確認して、もう一度お試しください。';
            SetaeCore.showToast('記録を保存できませんでした。入力内容は残っています。', 'error');
            console.warn('Setae log save failed:', message);

            if (typeof SetaeCore.track === 'function') {
                SetaeCore.track('log_create_error', {
                    type: type,
                    has_image: !!file,
                    shared: sharedToFeed
                });
            }
        });
    }

    // ==========================================
    // Prey List Edit
    // ==========================================
    function renderEditPreyListModal() {
        if ($('#modal-edit-prey-list').length === 0) {
            $('body').append(`
            <div id="modal-edit-prey-list" class="setae-modal" style="display:none; z-index:100000;">
                <div class="setae-modal-content" style="max-width:400px;">
                    <button type="button" class="setae-close" id="close-edit-prey-list" aria-label="閉じる">&times;</button>
                    <h3>餌リストの編集</h3>
                    <textarea id="edit-prey-textarea" class="setae-input" style="height:200px;"></textarea>
                    
                    <div style="margin-top:10px; display:flex; justify-content:space-between;">
                        <button type="button" id="btn-reset-prey-list" class="setae-btn setae-btn-secondary" style="color:#666; border:1px solid #ccc;">
                            初期リストに戻す
                         </button>
                         <button type="button" id="btn-save-prey-list" class="setae-btn setae-btn-primary">保存</button>
                    </div>
                </div>
            </div>`);
        }

        const currentList = SetaeCore.state.feedTypes || DEFAULT_PREY_LIST;
        $('#edit-prey-textarea').val(currentList.join('\n'));
        $('#modal-edit-prey-list').fadeIn();
    }

    function savePreyList() {
        const text = $('#edit-prey-textarea').val();
        const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        if (lines.length === 0) {
            SetaeCore.showToast('餌を1種類以上入力してください', 'error');
            $('#edit-prey-textarea').trigger('focus');
            return;
        }

        SetaeCore.state.feedTypes = lines;
        
        // ▼ 追加: ローカルストレージにJSON形式で永続化
        localStorage.setItem('setae_feed_types', JSON.stringify(lines));
        
        SetaeCore.showToast('リストを更新しました', 'success');
        $('#modal-edit-prey-list').fadeOut();
        renderLogPreyButtons();
    }

    function resetPreyListToDefault() {
        const confirmation = SetaeCore.confirmAction
            ? SetaeCore.confirmAction({
                title: '餌リストを初期化',
                message: '編集中の餌リストを初期状態へ戻します。保存するまでは確定されません。',
                confirmLabel: '初期リストに戻す'
            })
            : Promise.resolve(window.confirm('初期リストに戻しますか？'));

        confirmation.then(function (confirmed) {
            if (confirmed) $('#edit-prey-textarea').val(DEFAULT_PREY_LIST.join('\n')).trigger('focus');
        });
    }

    $(document).on('click', '#close-edit-prey-list', function () {
        $('#modal-edit-prey-list').fadeOut(140);
    });
    $(document).on('click', '#btn-save-prey-list', savePreyList);
    $(document).on('click', '#btn-reset-prey-list', resetPreyListToDefault);

    // Context Menu Action (exposed but relies on SetaeUIActions or SetaeAPI)
    function handlePreySelect(id, prey) {
        $('.setae-context-menu').remove();
        // Call global handleQuickAction (from actions.js)
        if (window.handleQuickAction) {
            handleQuickAction(id, 'feed', { prey: prey });
        } else {
            console.error('handleQuickAction not found');
        }
    }

    // Expose select globals for inline onclick handlers if needed
    window.savePreyList = savePreyList;
    window.resetPreyListToDefault = resetPreyListToDefault;

    return {
        openLogModal: openLogModal,
        handleLogSubmit: handleLogSubmit,
        handleLogTypeClick: handleLogTypeClick,
        renderEditPreyListModal: renderEditPreyListModal,
        savePreyList: savePreyList,
        resetPreyListToDefault: resetPreyListToDefault,
        handlePreySelect: handlePreySelect
    };

})(jQuery);
