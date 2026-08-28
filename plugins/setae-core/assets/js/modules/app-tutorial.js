/**
 * Context-aware onboarding for the current SETAE interface.
 */
var SetaeTutorial = (function ($) {
    'use strict';

    const KEYS = {
        MAIN: 'setae_tutorial_main_v2',
        ADD: 'setae_tutorial_add_v1',
        SWIPE: 'setae_tutorial_swipe_v2',
        ENC: 'setae_tutorial_enc_v1',
        EDIT_SUGGEST: 'setae_tutorial_edit_v1',
        ENC_DETAIL: 'setae_tutorial_enc_detail_v1',
        ADD_LOG: 'setae_tutorial_add_log_v2',
        MY_DETAIL: 'setae_tutorial_my_detail_v3'
    };

    const SCENARIO_KEYS = {
        main: KEYS.MAIN,
        add_spider: KEYS.ADD,
        swipe_guide: KEYS.SWIPE,
        encyclopedia: KEYS.ENC,
        edit_suggestion: KEYS.EDIT_SUGGEST,
        encyclopedia_detail: KEYS.ENC_DETAIL,
        add_log: KEYS.ADD_LOG,
        my_detail: KEYS.MY_DETAIL
    };

    const SCENARIO_LABELS = {
        main: 'はじめてガイド',
        add_spider: '個体の登録',
        swipe_guide: 'カード操作',
        encyclopedia: '図鑑',
        edit_suggestion: '図鑑への情報提供',
        encyclopedia_detail: '図鑑の詳細',
        add_log: '飼育記録',
        my_detail: '個体カルテ'
    };

    const scenarios = {
        main: [
            {
                target: null,
                title: 'SETAEを始めましょう',
                text: '個体ごとの給餌・脱皮・写真を、迷わず続けられる形で残せます。',
                guestText: '登録なしで{{limit}}匹まで、個体と飼育記録をこの端末に保存できます。'
            },
            {
                target: '#btn-add-spider',
                title: '最初の1匹を登録',
                text: '最初は種類と名前だけで十分です。写真や詳しい情報はあとから追加できます。',
                position: 'bottom'
            },
            {
                target: '#setae-spider-search',
                title: '個体をすぐ見つける',
                text: '名前や種類で検索できます。個体が増えても、見たいカルテへすぐ移動できます。',
                position: 'bottom'
            },
            {
                target: '#setae-guest-trial-bar',
                title: '体験データは端末に保存',
                text: '無料登録すると、この端末の個体と記録をそのままアカウントへ同期できます。',
                guestOnly: true,
                position: 'bottom'
            },
            {
                target: '.setae-nav-item[data-target="section-care-feed"]',
                title: '記録から交流へ',
                text: '飼育記録の共有や相談は「交流」にまとまっています。普段の管理から自然に移動できます。',
                accountOnly: true,
                position: 'top'
            },
            {
                target: null,
                title: '準備できました',
                text: 'まずは1匹登録して、今日のお世話を1件残してみましょう。'
            }
        ],
        add_spider: [
            {
                target: '.setae-radio-group',
                title: 'カテゴリー',
                text: '管理する生き物のカテゴリーを選びます。表示される記録項目も種類に合わせて変わります。',
                position: 'bottom'
            },
            {
                target: '#spider-species-search',
                title: '図鑑から種類を検索',
                text: 'タランチュラは学名・和名から候補を検索できます。未同定なら自由入力でも登録できます。',
                position: 'bottom'
            },
            {
                target: '#spider-name',
                title: '名前・管理番号',
                text: '普段呼ぶ名前や短い管理番号を入力します。空欄なら種類名が使われます。',
                position: 'top'
            },
            {
                target: '.setae-file-upload-wrapper',
                title: '写真は任意',
                text: '写真があると一覧とカルテが見分けやすくなります。あとから追加・変更もできます。',
                position: 'top'
            },
            {
                target: '#form-add-spider button[type="submit"]',
                title: '登録する',
                text: '入力内容を確認して登録します。体験モードではこの端末だけに保存されます。',
                position: 'top'
            }
        ],
        swipe_guide: [
            {
                target: '.setae-spider-list-row:first',
                title: 'タップとスワイプ',
                text: 'カードをタップすると個体カルテへ移動します。横に動かすと、その個体で使えるクイック記録が現れます。',
                position: 'bottom'
            },
            {
                target: '.setae-spider-list-row:first',
                title: '表示を確認して離す',
                text: 'カードをゆっくり横へ動かし、給餌・拒食・脱皮などの表示を確認してから指を離してください。',
                position: 'bottom'
            }
        ],
        encyclopedia: [
            {
                target: null,
                title: '飼育図鑑',
                text: '種類ごとの基礎情報に、SETAE内の飼育記録や相談をまとめて確認できます。'
            },
            {
                target: '#setae-enc-search',
                title: '種類を検索',
                text: '学名・和名から目的の種類を探せます。',
                position: 'bottom'
            },
            {
                target: '.species-card:first',
                title: '詳しい情報を見る',
                text: 'カードを開くと、飼育データ、写真、関連する記録や相談を確認できます。',
                position: 'bottom'
            }
        ],
        edit_suggestion: [
            {
                target: null,
                title: '図鑑へ情報を提供',
                text: 'ご自身で確認できる情報や撮影した写真を、わかる範囲で送信できます。'
            },
            {
                target: '#edit-image-placeholder',
                title: '写真を選択',
                text: '種類の特徴がわかる、ご自身で撮影した写真を選びます。',
                position: 'bottom'
            },
            {
                target: 'textarea[name="suggested_description"]',
                title: '飼育上の補足',
                text: '特徴、注意点、実際に役立った管理方法などを記入できます。',
                position: 'top'
            },
            {
                target: '#setae-species-edit-form button[type="submit"]',
                title: '提案を送信',
                text: '内容を確認して送信します。確認後、図鑑へ反映されます。',
                position: 'top'
            }
        ],
        encyclopedia_detail: [
            {
                target: null,
                title: '種類の詳細',
                text: '基礎情報、飼育傾向、写真、実際の記録をひとつの画面で確認できます。'
            },
            {
                target: '#enc-detail-keeping',
                title: 'SETAE内の飼育データ',
                text: 'この種類を管理している個体数や、蓄積された飼育情報を確認できます。',
                position: 'bottom'
            },
            {
                target: '#btn-open-edit-modal',
                title: '情報・写真を提供',
                text: '不足している情報や、ご自身で撮影した写真をここから提案できます。',
                position: 'bottom'
            }
        ],
        add_log: [
            {
                target: null,
                title: '今日の記録を残す',
                text: '種類、日付、必要なら写真やメモを選んで保存します。入力した内容は個体カルテに反映されます。',
                guestText: '種類、日付、必要なら写真やメモを選んで保存します。体験中の記録はこの端末に保存されます。'
            },
            {
                target: '.type-group',
                title: '記録の種類',
                text: '給餌、脱皮、成長、観察から、今回の内容に合うものを選びます。',
                position: 'bottom'
            },
            {
                target: '.upload-group',
                title: '写真とメモ',
                text: '写真を添えるとアルバムと成長の振り返りに残ります。短いメモだけでも十分です。',
                position: 'top'
            },
            {
                target: '.log-share-options',
                title: '共有は必要なときだけ',
                text: '公開したい記録だけ、お世話フィードへの共有を選べます。',
                accountOnly: true,
                position: 'top'
            },
            {
                target: '.setae-btn-submit',
                title: '記録を保存',
                text: '保存するとカルテと一覧の最新日付が更新されます。',
                position: 'top'
            }
        ],
        my_detail: [
            {
                target: null,
                title: '個体カルテ',
                text: '現在の状態、これまでの記録、写真、成長の流れを個体ごとに確認できます。'
            },
            {
                target: '.setae-spider-hero',
                title: 'いま知りたい状態',
                text: '最終給餌、最終脱皮、現在の状態を最初に確認できます。',
                position: 'bottom'
            },
            {
                target: '.setae-detail-tabs',
                title: 'カルテと全記録',
                text: '概要と写真は「カルテ」、過去の出来事は「すべての記録」で切り替えます。',
                position: 'bottom'
            },
            {
                target: '.detail-photo-panel',
                title: '記録写真のアルバム',
                text: '記録に添えた写真が日付順にまとまり、成長を写真で振り返れます。',
                position: 'top'
            },
            {
                target: '#btn-add-log',
                title: '記録を追加',
                text: '給餌、脱皮、成長、観察をここから追加します。',
                position: 'bottom'
            },
            {
                target: '#btn-edit-spider-trigger',
                title: '個体情報を編集',
                text: '名前、写真、種類、状態など、個体そのものの情報を変更できます。',
                position: 'bottom'
            },
            {
                target: '#btn-tab-settings',
                title: '公開・ラベル設定',
                text: 'QRラベルと公開範囲は設定から、繁殖募集は個体編集から管理できます。',
                accountOnly: true,
                position: 'bottom'
            }
        ]
    };

    let activeScenario = null;
    let activeSteps = [];
    let currentStepIndex = 0;
    let currentTarget = null;
    let $guard = null;
    let $spotlight = null;
    let $tooltip = null;
    let returnFocus = null;
    let positionTimer = 0;
    let positionFrame = 0;
    const pendingWatchers = {};

    function isGuest() {
        return !!(window.SetaeSettings && SetaeSettings.guest_mode);
    }

    function hasCompleted(scenarioName) {
        const key = SCENARIO_KEYS[scenarioName];
        return !!(key && localStorage.getItem(key));
    }

    function getScenarioSteps(scenarioName) {
        const guest = isGuest();
        const guestLimit = parseInt(
            window.SetaeSettings
            && SetaeSettings.current_user
            && SetaeSettings.current_user.spider_limit,
            10
        ) || 8;
        return (scenarios[scenarioName] || [])
            .filter(function (step) {
                if (step.guestOnly && !guest) return false;
                if (step.accountOnly && guest) return false;
                return true;
            })
            .map(function (step) {
                const resolved = Object.assign({}, step);
                if (guest && step.guestText) resolved.text = step.guestText;
                if (!guest && step.accountText) resolved.text = step.accountText;
                resolved.text = String(resolved.text || '').replace(/\{\{limit\}\}/g, String(guestLimit));
                return resolved;
            });
    }

    function scheduleScenario(scenarioName, condition, options) {
        const settings = Object.assign({
            delay: 400,
            interval: 400,
            attempts: 20
        }, options || {});

        if (activeScenario || hasCompleted(scenarioName) || pendingWatchers[scenarioName]) return;
        pendingWatchers[scenarioName] = true;

        window.setTimeout(function check() {
            if (activeScenario || hasCompleted(scenarioName)) {
                delete pendingWatchers[scenarioName];
                return;
            }

            if (condition()) {
                delete pendingWatchers[scenarioName];
                startScenario(scenarioName);
                return;
            }

            settings.attempts -= 1;
            if (settings.attempts <= 0) {
                delete pendingWatchers[scenarioName];
                return;
            }
            window.setTimeout(check, settings.interval);
        }, settings.delay);
    }

    function initMain() {
        scheduleScenario('main', function () {
            return $('#section-my').is(':visible') && !$('.setae-modal').is(':visible');
        }, { delay: 900, attempts: 8 });
    }

    function initAddSpider() {
        scheduleScenario('add_spider', function () {
            return $('#modal-add-spider').is(':visible');
        }, { delay: 250, attempts: 30 });
    }

    function initSwipe() {
        if (!hasCompleted('main')) return;
        scheduleScenario('swipe_guide', function () {
            return $('.setae-spider-list-row').length > 0
                && $('#section-my').is(':visible')
                && !$('.setae-modal').is(':visible');
        }, { delay: 700, attempts: 8 });
    }

    function initEncyclopedia() {
        scheduleScenario('encyclopedia', function () {
            return $('#section-enc').is(':visible')
                && !$('.setae-modal').is(':visible')
                && $('.species-card').length > 0;
        }, { delay: 300, attempts: 35 });
    }

    function initEditSuggestion() {
        scheduleScenario('edit_suggestion', function () {
            return $('#setae-species-edit-modal').is(':visible');
        }, { delay: 250, attempts: 25 });
    }

    function initEncyclopediaDetail() {
        scheduleScenario('encyclopedia_detail', function () {
            return $('#section-enc-detail').is(':visible')
                && String($('#enc-detail-title').text() || '').trim() !== '';
        }, { delay: 300, attempts: 25 });
    }

    function initAddLog() {
        scheduleScenario('add_log', function () {
            return $('#setae-log-modal').is(':visible') && $('#setae-log-form').is(':visible');
        }, { delay: 220, attempts: 25 });
    }

    function initMyDetail() {
        scheduleScenario('my_detail', function () {
            const detailName = String($('#detail-spider-name').text() || '').trim();
            return $('#section-my-detail').is(':visible')
                && detailName
                && detailName !== '読み込み中...'
                && !$('.setae-modal').is(':visible');
        }, { delay: 300, attempts: 25 });
    }

    function startScenario(scenarioName) {
        if (activeScenario || !scenarios[scenarioName]) return false;

        activeSteps = getScenarioSteps(scenarioName);
        if (!activeSteps.length) return false;

        activeScenario = scenarioName;
        currentStepIndex = 0;
        returnFocus = document.activeElement;
        createElements();
        $('body').addClass('setae-tutorial-open');
        showStep(0);

        if (window.SetaeCore && typeof SetaeCore.track === 'function') {
            SetaeCore.track('tutorial_start', {
                scenario: scenarioName,
                guest: isGuest()
            });
        }
        return true;
    }

    function createElements() {
        $('#setae-tutorial-guard, #setae-tutorial-spotlight, #setae-tutorial-tooltip').remove();

        $guard = $('<div id="setae-tutorial-guard" aria-hidden="true"></div>');
        $spotlight = $('<div id="setae-tutorial-spotlight" aria-hidden="true"></div>');
        $tooltip = $(`
            <section id="setae-tutorial-tooltip" role="dialog" aria-modal="true" aria-labelledby="st-title" aria-describedby="st-text">
                <header class="st-header">
                    <span id="st-context">はじめてガイド</span>
                    <button type="button" id="st-btn-close" aria-label="ガイドを閉じる">&times;</button>
                </header>
                <div class="st-content">
                    <h3 id="st-title"></h3>
                    <p id="st-text"></p>
                </div>
                <div class="st-progress" aria-hidden="true"><i></i></div>
                <footer class="st-footer">
                    <span id="st-counter"></span>
                    <div class="st-actions">
                        <button type="button" id="st-btn-skip">スキップ</button>
                        <button type="button" id="st-btn-next">次へ</button>
                    </div>
                </footer>
            </section>
        `);

        $('body').append($guard, $spotlight, $tooltip);

        const guardElement = $guard[0];
        guardElement.addEventListener('touchmove', preventManualScroll, { passive: false });
        guardElement.addEventListener('wheel', preventManualScroll, { passive: false });

        $(document)
            .off('click.setaeTutorial', '#st-btn-next')
            .on('click.setaeTutorial', '#st-btn-next', function (event) {
                event.preventDefault();
                event.stopPropagation();
                nextStep();
            })
            .off('click.setaeTutorial', '#st-btn-skip, #st-btn-close')
            .on('click.setaeTutorial', '#st-btn-skip, #st-btn-close', function (event) {
                event.preventDefault();
                event.stopPropagation();
                endTutorial(true);
            })
            .off('keydown.setaeTutorial')
            .on('keydown.setaeTutorial', function (event) {
                if (event.key === 'Escape' && activeScenario) {
                    endTutorial(true);
                    return;
                }
                if (event.key !== 'Tab' || !activeScenario || !$tooltip) return;

                const $focusable = $tooltip.find('button:visible:not(:disabled)');
                if (!$focusable.length) return;
                const first = $focusable[0];
                const last = $focusable[$focusable.length - 1];

                if (event.shiftKey && document.activeElement === first) {
                    event.preventDefault();
                    last.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                    event.preventDefault();
                    first.focus();
                }
            });

        $guard.on('click.setaeTutorial', function () {
            if (!$tooltip) return;
            $tooltip.removeClass('is-attention');
            window.requestAnimationFrame(function () {
                $tooltip.addClass('is-attention');
                window.setTimeout(function () {
                    if ($tooltip) $tooltip.removeClass('is-attention');
                }, 260);
            });
        });

        $(window)
            .off('resize.setaeTutorial orientationchange.setaeTutorial scroll.setaeTutorial')
            .on('resize.setaeTutorial orientationchange.setaeTutorial scroll.setaeTutorial', schedulePositionUpdate);

        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', schedulePositionUpdate);
            window.visualViewport.addEventListener('scroll', schedulePositionUpdate);
        }
    }

    function preventManualScroll(event) {
        event.preventDefault();
    }

    function showStep(index) {
        if (!activeScenario) return;
        if (index >= activeSteps.length) {
            endTutorial(false);
            return;
        }

        window.clearTimeout(positionTimer);
        if (positionFrame) window.cancelAnimationFrame(positionFrame);

        const step = activeSteps[index];
        const $target = step.target ? $(step.target).filter(':visible').first() : $();

        if (step.target && !$target.length) {
            window.setTimeout(function () { showStep(index + 1); }, 20);
            return;
        }

        currentStepIndex = index;
        currentTarget = $target.length ? $target[0] : null;

        $('#st-context').text(SCENARIO_LABELS[activeScenario] || 'SETAEガイド');
        $('#st-title').text(step.title);
        $('#st-text').html(step.text);
        $('#st-counter').text(`${index + 1} / ${activeSteps.length}`);
        $('#st-btn-next').text(index === activeSteps.length - 1 ? '完了' : '次へ');
        $('.st-progress i').css('width', `${((index + 1) / activeSteps.length) * 100}%`);

        $tooltip
            .removeClass('is-visible is-attention arrow-top arrow-bottom')
            .attr('data-step', String(index + 1));
        $spotlight.removeClass('is-visible');

        if (!currentTarget) {
            positionCenteredTooltip();
            return;
        }

        const reducedMotion = window.matchMedia
            && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        currentTarget.scrollIntoView({
            behavior: reducedMotion ? 'auto' : 'smooth',
            block: 'center',
            inline: 'nearest'
        });

        positionTimer = window.setTimeout(function () {
            positionCurrentStep(true);
        }, reducedMotion ? 30 : 280);
    }

    function getViewportRect() {
        const visual = window.visualViewport;
        const left = visual ? visual.offsetLeft : 0;
        const top = visual ? visual.offsetTop : 0;
        const width = visual ? visual.width : window.innerWidth;
        const height = visual ? visual.height : window.innerHeight;
        return {
            left: left,
            top: top,
            width: width,
            height: height,
            right: left + width,
            bottom: top + height
        };
    }

    function calculateTooltipPlacement(targetRect, tooltipSize, viewport, preferredPosition) {
        const margin = 14;
        const gap = 14;
        const width = Math.min(tooltipSize.width, Math.max(240, viewport.width - (margin * 2)));
        const height = tooltipSize.height;
        const availableAbove = targetRect.top - viewport.top - gap;
        const availableBelow = viewport.bottom - targetRect.bottom - gap;
        let position = preferredPosition === 'top' || preferredPosition === 'bottom'
            ? preferredPosition
            : (availableBelow >= availableAbove ? 'bottom' : 'top');

        if (position === 'top' && availableAbove < height && availableBelow > availableAbove) {
            position = 'bottom';
        } else if (position === 'bottom' && availableBelow < height && availableAbove > availableBelow) {
            position = 'top';
        }

        const minLeft = viewport.left + margin;
        const maxLeft = viewport.right - margin - width;
        const targetCenter = targetRect.left + (targetRect.width / 2);
        const left = Math.max(minLeft, Math.min(targetCenter - (width / 2), maxLeft));
        let top = position === 'top'
            ? targetRect.top - height - gap
            : targetRect.bottom + gap;
        top = Math.max(viewport.top + margin, Math.min(top, viewport.bottom - margin - height));

        const arrowLeft = Math.max(22, Math.min(targetCenter - left, width - 22));
        return {
            left: left,
            top: top,
            width: width,
            position: position,
            arrowLeft: arrowLeft
        };
    }

    function calculateCenteredTooltipPosition(viewport) {
        return {
            left: viewport.left + (viewport.width / 2),
            top: viewport.top + (viewport.height / 2)
        };
    }

    function positionCurrentStep(reveal) {
        if (!activeScenario || !$tooltip || !$spotlight) return;
        if (!currentTarget || !document.contains(currentTarget)) {
            positionCenteredTooltip();
            return;
        }

        const viewport = getViewportRect();
        const rect = currentTarget.getBoundingClientRect();
        const padding = 6;
        const spotlightLeft = Math.max(viewport.left + 4, rect.left - padding);
        const spotlightTop = Math.max(viewport.top + 4, rect.top - padding);
        const spotlightRight = Math.min(viewport.right - 4, rect.right + padding);
        const spotlightBottom = Math.min(viewport.bottom - 4, rect.bottom + padding);

        $spotlight.css({
            left: spotlightLeft,
            top: spotlightTop,
            width: Math.max(1, spotlightRight - spotlightLeft),
            height: Math.max(1, spotlightBottom - spotlightTop),
            borderRadius: getTargetRadius(currentTarget)
        });

        const tooltipWidth = Math.min(360, viewport.width - 28);
        $tooltip.css({
            display: 'block',
            visibility: 'hidden',
            width: tooltipWidth,
            left: viewport.left + 14,
            top: viewport.top + 14,
            transform: 'none'
        });

        const tooltipHeight = $tooltip.outerHeight() || 190;
        const step = activeSteps[currentStepIndex] || {};
        const placement = calculateTooltipPlacement({
            left: rect.left,
            right: rect.right,
            top: rect.top,
            bottom: rect.bottom,
            width: rect.width,
            height: rect.height
        }, {
            width: tooltipWidth,
            height: tooltipHeight
        }, viewport, step.position || 'auto');

        $tooltip
            .css({
                left: placement.left,
                top: placement.top,
                width: placement.width,
                visibility: 'visible',
                transform: 'none'
            })
            .toggleClass('arrow-bottom', placement.position === 'top')
            .toggleClass('arrow-top', placement.position === 'bottom');
        $tooltip[0].style.setProperty('--st-arrow-left', placement.arrowLeft + 'px');

        if (reveal !== false) {
            $spotlight.addClass('is-visible');
            $tooltip.addClass('is-visible');
            window.setTimeout(function () {
                if ($tooltip && $tooltip.hasClass('is-visible')) {
                    $('#st-btn-next').trigger('focus');
                }
            }, 140);
        }
    }

    function getTargetRadius(target) {
        const radius = parseFloat(window.getComputedStyle(target).borderRadius);
        if (!Number.isFinite(radius)) return 16;
        return Math.max(8, Math.min(18, radius + 2));
    }

    function positionCenteredTooltip(reveal) {
        if (!$tooltip || !$spotlight) return;
        const viewport = getViewportRect();
        const width = Math.min(360, viewport.width - 28);
        const center = calculateCenteredTooltipPosition(viewport);

        $spotlight.css({
            left: center.left,
            top: center.top,
            width: 1,
            height: 1,
            borderRadius: 16
        }).addClass('is-visible');

        $tooltip
            .removeClass('arrow-top arrow-bottom')
            .css({
                display: 'block',
                visibility: 'visible',
                width: width,
                left: center.left,
                top: center.top,
                transform: 'translate(-50%, -50%)'
            })
            .addClass('is-visible');
        $tooltip[0].style.setProperty('--st-arrow-left', '50%');

        if (reveal !== false) {
            window.setTimeout(function () {
                if ($tooltip && $tooltip.hasClass('is-visible')) {
                    $('#st-btn-next').trigger('focus');
                }
            }, 140);
        }
    }

    function schedulePositionUpdate() {
        if (!activeScenario) return;
        if (positionFrame) window.cancelAnimationFrame(positionFrame);
        positionFrame = window.requestAnimationFrame(function () {
            positionFrame = 0;
            if (currentTarget) positionCurrentStep(false);
            else positionCenteredTooltip(false);
        });
    }

    function nextStep() {
        if (!activeScenario) return;
        showStep(currentStepIndex + 1);
    }

    function endTutorial(skipped) {
        if (!activeScenario) return;
        const finishedScenario = activeScenario;
        const key = SCENARIO_KEYS[finishedScenario];
        if (key) localStorage.setItem(key, 'true');

        if (window.SetaeCore && typeof SetaeCore.track === 'function') {
            SetaeCore.track('tutorial_complete', {
                scenario: finishedScenario,
                skipped: !!skipped,
                guest: isGuest()
            });
        }

        destroyElements();

        if (!skipped && finishedScenario === 'main') {
            window.setTimeout(initSwipe, 650);
        }
    }

    function destroyElements() {
        window.clearTimeout(positionTimer);
        if (positionFrame) window.cancelAnimationFrame(positionFrame);
        positionFrame = 0;

        $(window).off('resize.setaeTutorial orientationchange.setaeTutorial scroll.setaeTutorial');
        $(document).off('.setaeTutorial');
        if (window.visualViewport) {
            window.visualViewport.removeEventListener('resize', schedulePositionUpdate);
            window.visualViewport.removeEventListener('scroll', schedulePositionUpdate);
        }

        $('body').removeClass('setae-tutorial-open');
        $('#setae-tutorial-guard, #setae-tutorial-spotlight, #setae-tutorial-tooltip').remove();

        if (returnFocus && document.contains(returnFocus) && typeof returnFocus.focus === 'function') {
            returnFocus.focus();
        }

        activeScenario = null;
        activeSteps = [];
        currentStepIndex = 0;
        currentTarget = null;
        returnFocus = null;
        $guard = null;
        $spotlight = null;
        $tooltip = null;
    }

    function resetAndStart() {
        Object.keys(KEYS).forEach(function (name) {
            localStorage.removeItem(KEYS[name]);
        });
        if (activeScenario) destroyElements();
        Object.keys(pendingWatchers).forEach(function (name) {
            delete pendingWatchers[name];
        });
        initMain();
    }

    $(document).ready(function () {
        $(document).on('click.setaeTutorialWatch', '.setae-nav-item[data-target="section-enc"]', initEncyclopedia);
        $(document).on('click.setaeTutorialWatch', '#btn-open-edit-modal, .btn-open-edit-modal', initEditSuggestion);
        $(document).on('click.setaeTutorialWatch', '#btn-add-spider, .js-open-add-spider', initAddSpider);
        $(document).on('click.setaeTutorialWatch', '.js-open-species-detail', initEncyclopediaDetail);
        $(document).on('click.setaeTutorialWatch', '#btn-add-log, .js-list-record, .js-today-log', initAddLog);
        $(document).on('click.setaeTutorialWatch', '.js-list-open, .setae-nickname, .js-today-open-spider', initMyDetail);

        if ($('#section-enc').is(':visible')) initEncyclopedia();
    });

    return {
        init: initMain,
        initAddSpider: initAddSpider,
        initSwipe: initSwipe,
        initEncyclopedia: initEncyclopedia,
        initEditSuggestion: initEditSuggestion,
        initEncyclopediaDetail: initEncyclopediaDetail,
        initAddLog: initAddLog,
        initMyDetail: initMyDetail,
        reset: resetAndStart,
        _calculateTooltipPlacement: calculateTooltipPlacement,
        _calculateCenteredTooltipPosition: calculateCenteredTooltipPosition
    };

})(jQuery);
