/**
 * Setae App Tutorial Module
 * - Scenarios: Main, AddSpider, SwipeGuide
 * - Features: Mobile optimized, Scroll lock, Dynamic positioning
 */
var SetaeTutorial = (function ($) {
    'use strict';

    // シナリオごとの完了フラグ管理キー
    const KEYS = {
        MAIN: 'setae_tutorial_main_v1',
        ADD: 'setae_tutorial_add_v1',
        SWIPE: 'setae_tutorial_swipe_v1'
    };

    // --- シナリオ定義 ---
    const scenarios = {
        // 1. メイン画面
        main: [
            {
                target: null,
                title: 'Welcome to Setae!',
                text: 'Setaeへようこそ！<br>あなたのタランチュラ・奇蟲ライフを管理するアプリです。<br>主要な機能の使いかたを簡単にご紹介します。',
                position: 'center'
            },
            {
                target: '#btn-add-spider',
                title: '個体の登録',
                text: 'まずはここをタップして、<br>あなたの飼育している個体を登録しましょう。<br>(※この後、実際の登録画面でもガイドが表示されます)',
                position: 'bottom'
            },
            {
                target: '.setae-decks-scroll:visible',
                title: 'フィルタリング',
                text: '「空腹」「脱皮前」などのステータスで<br>個体をすばやく絞り込むことができます。',
                position: 'bottom'
            },
            {
                target: '#setae-spider-search',
                title: '検索機能',
                text: '個体が増えてきても大丈夫。<br>名前や種類ですぐに検索できます。',
                position: 'bottom'
            },
            {
                target: '.setae-nav-item[data-target="section-enc"]',
                title: 'みんなで作る図鑑',
                text: 'ここから図鑑にアクセスできます。<br>あなたの個体の写真や飼育情報を送って、<br>一緒に図鑑を充実させていきましょう！',
                position: 'top'
            },
            {
                target: '.setae-nav-item[data-target="section-com"]',
                title: '交流掲示板',
                text: '飼育の質問や雑談はこちらから。<br>他のユーザーと交流して、<br>悩みを解決したり情報をシェアしましょう。',
                position: 'top'
            },
            {
                target: '.setae-nav-item[data-target="section-bl"]',
                title: 'BL Match',
                text: 'ブリーディングローン（繁殖貸与）の<br>パートナー募集や検索はこちらから。<br>新しい繁殖の機会を見つけましょう。',
                position: 'top'
            },
            {
                target: null,
                title: '準備完了！',
                text: 'それでは、Setaeでの管理をお楽しみください！',
                position: 'center'
            }
        ],

        // 2. 新規登録画面（モーダル）
        add_spider: [
            {
                target: '.setae-radio-group',
                title: 'カテゴリー選択',
                text: 'まずは生き物のカテゴリーを選んでください。<br>タランチュラ以外にもサソリや植物なども管理できます。',
                position: 'bottom'
            },
            {
                target: '#spider-species-search',
                title: '種類の検索',
                text: 'ここに学名や和名を入力すると候補が表示されます。<br>データベースから選ぶことで、詳細な飼育情報を自動で紐付けることができます。',
                position: 'top'
            },
            {
                target: '.setae-file-upload-wrapper',
                title: '写真の登録',
                text: 'お気に入りの写真を登録しましょう。<br>一覧や詳細画面のトップに表示されます。',
                position: 'top'
            },
            {
                target: '#spider-name',
                title: '名前・管理ID',
                text: '個体の愛称や、「No.01」などの管理番号を入力できます。<br>空欄の場合は種類名が自動で設定されます。',
                position: 'top'
            },
            {
                target: '#form-add-spider button[type="submit"]',
                title: '登録完了',
                text: '入力が終わったら登録ボタンを押してください。<br>これであなたのコレクションに追加されます！',
                position: 'top'
            }
        ],

        // 3. スワイプ操作ガイド（リストに個体がある場合のみ）
        swipe_guide: [
            {
                target: '.setae-spider-list-row:first',
                title: 'クイックアクション',
                text: '登録ありがとうございます！<br>リストのカードには便利な操作が隠されています。',
                position: 'bottom'
            },
            {
                target: '.setae-spider-list-row:first',
                title: '状態に合わせたスマート操作',
                text: 'カードを<b>左右にスワイプ</b>すると、その時の状態に合わせたアクション（給餌、拒食、脱皮記録など）が実行されます。<br>生き物の種類やタイミングによって操作が変わるので、アイコンを確認して活用してください。',
                position: 'bottom'
            },
            {
                target: '.setae-spider-list-row:first',
                title: 'タップで「詳細」',
                text: 'カード自体をタップすると詳細画面へ移動します。<br>成長ログやグラフを確認してみましょう。',
                position: 'bottom'
            }
        ]
    };

    let activeScenario = null;
    let currentStepIndex = 0;
    let $spotlight, $tooltip;

    /**
     * Main Scenario Init
     */
    function initMain() {
        if (localStorage.getItem(KEYS.MAIN)) return;
        setTimeout(() => {
            if ($('#section-my').is(':visible') && !$('.setae-modal').is(':visible')) {
                startScenario('main');
            }
        }, 1000);
    }

    /**
     * Add Spider Scenario Init
     */
    function initAddSpider() {
        if (localStorage.getItem(KEYS.ADD)) return;
        setTimeout(() => {
            if ($('#modal-add-spider').is(':visible')) {
                $('#modal-add-spider .setae-modal-content').scrollTop(0);
                startScenario('add_spider');
            }
        }, 500);
    }

    /**
     * Swipe Guide Init
     * リスト描画後に呼び出す
     */
    function initSwipe() {
        // すでに見た、またはリストに個体がない場合は実行しない
        if (localStorage.getItem(KEYS.SWIPE)) return;

        setTimeout(() => {
            const $rows = $('.setae-spider-list-row');
            if ($rows.length > 0 && $('#section-my').is(':visible') && !$('.setae-modal').is(':visible')) {
                // スクロール位置を一番上へ
                $('html, body').scrollTop(0);
                startScenario('swipe_guide');
            }
        }, 800);
    }

    function startScenario(scenarioName) {
        if (!scenarios[scenarioName]) return;

        activeScenario = scenarioName;
        currentStepIndex = 0;
        createElements();
        showStep(0);
    }

    function createElements() {
        if ($('#setae-tutorial-spotlight').length) return;

        $spotlight = $('<div id="setae-tutorial-spotlight"></div>');
        $tooltip = $(`
            <div id="setae-tutorial-tooltip">
                <div class="st-content">
                    <h3 id="st-title"></h3>
                    <p id="st-text"></p>
                </div>
                <div class="st-footer">
                    <span id="st-counter"></span>
                    <div class="st-actions">
                        <button id="st-btn-skip">Skip</button>
                        <button id="st-btn-next">Next</button>
                    </div>
                </div>
            </div>
        `);

        $('body').append($spotlight, $tooltip);

        $(document).off('click', '#st-btn-next').on('click', '#st-btn-next', function (e) {
            e.preventDefault(); e.stopPropagation(); nextStep();
        });
        $(document).off('click', '#st-btn-skip').on('click', '#st-btn-skip', function (e) {
            e.preventDefault(); e.stopPropagation(); endTutorial();
        });

        $(window).on('resize.setaeTutorial', () => {
            if (activeScenario && $tooltip && $tooltip.is(':visible')) {
                showStep(currentStepIndex);
            }
        });
    }

    function showStep(index) {
        const scenario = scenarios[activeScenario];
        if (index >= scenario.length) {
            endTutorial();
            return;
        }

        const step = scenario[index];
        const $target = (step.target) ? $(step.target).filter(':visible').first() : null;

        if (step.target && (!$target || !$target.length)) {
            console.warn(`Tutorial target skipped: ${step.target}`);
            setTimeout(() => showStep(index + 1), 10);
            return;
        }

        currentStepIndex = index;

        $('#st-title').text(step.title);
        $('#st-text').html(step.text);
        $('#st-counter').text(`${index + 1} / ${scenario.length}`);
        $('#st-btn-next').text(index === scenario.length - 1 ? 'Finish' : 'Next');

        if ($target && $target.length) {
            const offset = $target.offset();
            const width = $target.outerWidth();
            const height = $target.outerHeight();

            $spotlight.css({
                top: offset.top - 5,
                left: offset.left - 5,
                width: width + 10,
                height: height + 10,
                display: 'block',
                position: 'absolute',
                borderRadius: '8px',
                boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.75)',
                zIndex: 100000,
                pointerEvents: 'none',
                transition: 'all 0.3s ease'
            });

            placeTooltip($target, offset, width, height, step.position);
            $tooltip.css('zIndex', 100001);

        } else {
            // Center
            $spotlight.css({
                top: '50%', left: '50%', width: 0, height: 0,
                boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.75)',
                zIndex: 100000
            });
            $tooltip.css({
                top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                zIndex: 100001
            }).removeClass('arrow-top arrow-bottom');
            $tooltip[0].style.setProperty('--st-arrow-left', '50%');
        }

        $tooltip.fadeIn(200);
    }

    function placeTooltip($target, targetOffset, targetW, targetH, preferredPosition) {
        const winW = $(window).width();
        const winH = $(window).height();
        const screenMargin = 10;

        const maxTooltipW = 280;
        const tooltipW = Math.min(maxTooltipW, winW - (screenMargin * 2));
        $tooltip.css('width', tooltipW);

        const tooltipH = $tooltip.outerHeight() || 150;
        const spacing = 15;

        // Horizontal
        const targetCenterX = targetOffset.left + (targetW / 2);
        let left = targetCenterX - (tooltipW / 2);
        if (left < screenMargin) left = screenMargin;
        if (left + tooltipW > winW - screenMargin) left = winW - tooltipW - screenMargin;

        // Arrow
        let arrowPercent = ((targetCenterX - left) / tooltipW) * 100;
        arrowPercent = Math.max(10, Math.min(90, arrowPercent));
        $tooltip[0].style.setProperty('--st-arrow-left', arrowPercent + '%');

        // Vertical Flip
        $tooltip.removeClass('arrow-top arrow-bottom');
        let top;
        let finalPos = preferredPosition;

        if (preferredPosition === 'top') {
            if (targetOffset.top - tooltipH - spacing < 0) {
                finalPos = 'bottom';
            }
        } else {
            if (targetOffset.top + targetH + tooltipH + spacing > winH) {
                finalPos = 'top';
            }
        }

        if (finalPos === 'top') {
            top = targetOffset.top - tooltipH - spacing;
            $tooltip.addClass('arrow-bottom');
        } else {
            top = targetOffset.top + targetH + spacing;
            $tooltip.addClass('arrow-top');
        }

        $tooltip.css({ top: top, left: left, transform: 'none' });
    }

    function nextStep() {
        showStep(currentStepIndex + 1);
    }

    function endTutorial() {
        if ($spotlight) $spotlight.fadeOut(300, function () { $(this).remove(); });
        if ($tooltip) $tooltip.fadeOut(300, function () { $(this).remove(); });
        $(window).off('resize.setaeTutorial');

        // フラグ保存
        if (activeScenario === 'main') localStorage.setItem(KEYS.MAIN, 'true');
        else if (activeScenario === 'add_spider') localStorage.setItem(KEYS.ADD, 'true');
        else if (activeScenario === 'swipe_guide') localStorage.setItem(KEYS.SWIPE, 'true');

        activeScenario = null;
    }

    function resetAndStart() {
        Object.values(KEYS).forEach(k => localStorage.removeItem(k));
        $('#setae-tutorial-spotlight, #setae-tutorial-tooltip').remove();
        initMain();
    }

    return {
        init: initMain,
        initAddSpider: initAddSpider,
        initSwipe: initSwipe,
        reset: resetAndStart
    };

})(jQuery);