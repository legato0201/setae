/**
 * Setae App Tutorial Module
 * 初回起動時にアプリの使い方をガイドするオーバーレイ機能
 */
var SetaeTutorial = (function ($) {
    'use strict';

    const STORAGE_KEY = 'setae_tutorial_seen_v1';

    // チュートリアルのステップ定義
    const steps = [
        {
            target: null,
            title: 'Welcome to Setae!',
            text: 'Setaeへようこそ！<br>あなたのタランチュラ・奇蟲ライフを管理するアプリです。<br>主要な機能の使いかたを簡単にご紹介します。',
            position: 'center'
        },
        {
            target: '#btn-add-spider',
            title: '個体の登録',
            text: 'まずはここをタップして、<br>あなたの飼育している個体を登録しましょう。',
            position: 'bottom'
        },
        {
            // 修正: :visible をつけて表示中の要素（マイリスト側）だけを狙う
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
            // 修正: ボタン自体が非表示エリアにあるため、targetをnull(中央表示)に変更して確実に読ませる
            target: null,
            title: 'ブリーディングローン',
            text: 'BL掲示板機能も搭載。<br>お婿さんやお嫁さんを募集・検索して、繁殖のパートナーを見つけましょう。',
            position: 'center'
        },
        {
            target: null,
            title: '準備完了！',
            text: 'それでは、Setaeでの管理をお楽しみください！',
            position: 'center'
        }
    ];

    let currentStepIndex = 0;
    let $overlay, $spotlight, $tooltip;

    /**
     * 初期化処理
     */
    function init() {
        if (localStorage.getItem(STORAGE_KEY)) {
            console.log('Tutorial already seen.');
            return;
        }

        setTimeout(() => {
            // マイリストが表示されている場合のみ開始
            if ($('#section-my').is(':visible')) {
                createElements();
                showStep(0);
            }
        }, 1000);
    }

    /**
     * 要素生成
     */
    function createElements() {
        if ($('#setae-tutorial-spotlight').length) return; // 二重生成防止

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

        // イベントバインド（offしてからonで重複防止）
        $(document).off('click', '#st-btn-next').on('click', '#st-btn-next', function (e) {
            e.preventDefault();
            e.stopPropagation();
            nextStep();
        });

        $(document).off('click', '#st-btn-skip').on('click', '#st-btn-skip', function (e) {
            e.preventDefault();
            e.stopPropagation();
            endTutorial();
        });

        $(window).on('resize.setaeTutorial', () => {
            if (currentStepIndex >= 0 && $tooltip && $tooltip.is(':visible')) {
                showStep(currentStepIndex);
            }
        });
    }

    /**
     * ステップ表示
     */
    function showStep(index) {
        if (index >= steps.length) {
            endTutorial();
            return;
        }

        const step = steps[index];
        // ターゲット指定があり、かつjQueryで見つかり、かつ表示されているか？
        const $target = (step.target) ? $(step.target).filter(':visible').first() : null;

        // ターゲット指定があるのに見つからない場合はスキップ
        if (step.target && (!$target || !$target.length)) {
            console.warn(`Tutorial target skipped: ${step.target}`);
            // 再帰呼び出しになるため、少し遅延させてスタックあふれ防止
            setTimeout(() => showStep(index + 1), 10);
            return;
        }

        currentStepIndex = index;

        // テキスト更新
        $('#st-title').text(step.title);
        $('#st-text').html(step.text);
        $('#st-counter').text(`${index + 1} / ${steps.length}`);
        $('#st-btn-next').text(index === steps.length - 1 ? 'Finish' : 'Next');

        // 位置合わせ
        if ($target && $target.length) {
            const offset = $target.offset();
            const width = $target.outerWidth();
            const height = $target.outerHeight();

            // スポットライト表示
            $spotlight.css({
                top: offset.top - 5,
                left: offset.left - 5,
                width: width + 10,
                height: height + 10,
                display: 'block',
                position: 'absolute',
                borderRadius: '8px',
                boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.75)',
                zIndex: 10000,
                pointerEvents: 'none',
                transition: 'all 0.3s ease'
            });

            placeTooltip(offset.top, offset.left, width, height, step.position);
        } else {
            // 中央表示モード
            $spotlight.css({
                top: '50%',
                left: '50%',
                width: 0,
                height: 0,
                boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.75)'
            });

            $tooltip.css({
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: 10001
            }).removeClass('arrow-top arrow-bottom');
        }

        $tooltip.fadeIn(200);
    }

    function placeTooltip(targetTop, targetLeft, targetW, targetH, position) {
        const tooltipW = 280;
        const spacing = 15;
        let screenW = $(window).width();

        // 横位置の計算（画面端配慮）
        let left = targetLeft + (targetW / 2) - (tooltipW / 2);
        if (left < 10) left = 10;
        if (left + tooltipW > screenW - 10) left = screenW - tooltipW - 10;

        $tooltip.removeClass('arrow-top arrow-bottom');
        let top;

        if (position === 'top') {
            top = targetTop - $tooltip.outerHeight() - spacing;
            // 上に見切れる場合は下に表示
            if (top < 10) {
                top = targetTop + targetH + spacing;
                $tooltip.addClass('arrow-top');
            } else {
                $tooltip.addClass('arrow-bottom');
            }
        } else {
            // default to bottom
            top = targetTop + targetH + spacing;
            $tooltip.addClass('arrow-top');
        }

        $tooltip.css({
            top: top,
            left: left,
            transform: 'none',
            zIndex: 10001
        });
    }

    function nextStep() {
        showStep(currentStepIndex + 1);
    }

    function endTutorial() {
        if ($spotlight) $spotlight.fadeOut(300, function () { $(this).remove(); });
        if ($tooltip) $tooltip.fadeOut(300, function () { $(this).remove(); });
        $(window).off('resize.setaeTutorial');
        localStorage.setItem(STORAGE_KEY, 'true');
    }

    function resetAndStart() {
        localStorage.removeItem(STORAGE_KEY);
        // 要素が残っていれば消す
        $('#setae-tutorial-spotlight, #setae-tutorial-tooltip').remove();
        init();
    }

    return {
        init: init,
        reset: resetAndStart
    };

})(jQuery);