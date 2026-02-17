/**
 * Setae App Tutorial Module
 * 初回起動時にアプリの使い方をガイドするオーバーレイ機能
 */
var SetaeTutorial = (function ($) {
    'use strict';

    const STORAGE_KEY = 'setae_tutorial_seen_v1'; // バージョン管理用にv1をつける

    // チュートリアルのステップ定義
    // target: ハイライトする要素のセレクタ (nullの場合は画面中央)
    // title: タイトル
    // text: 説明文
    // position: 吹き出しの位置 ('bottom', 'top', 'center')
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
            target: '.setae-decks-scroll',
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
            target: '#btn-bl-board',
            title: 'ブリーディングローン',
            text: 'BL掲示板では、お婿さんやお嫁さんを<br>募集・検索することができます。',
            position: 'top' // 下の方にあるボタンと想定
        },
        {
            target: null,
            title: '準備完了！',
            text: 'それでは、Setaeでの管理をお楽しみください！',
            position: 'center'
        }
    ];

    let currentStepIndex = 0;

    // --- DOM Elements ---
    let $overlay, $spotlight, $tooltip;

    /**
     * 初期化処理
     */
    function init() {
        // すでに閲覧済みなら実行しない
        if (localStorage.getItem(STORAGE_KEY)) {
            console.log('Tutorial already seen.');
            return;
        }

        // DOMの準備が整ってから開始（少し遅延させるとUIの崩れを防げます）
        setTimeout(() => {
            // 現在 "My Spiders" (#section-my) が表示されているか確認
            // ※チュートリアルはメイン画面で開始することを想定
            if ($('#section-my').is(':visible')) {
                createElements();
                showStep(0);
            }
        }, 1000);
    }

    /**
     * 必要なHTML要素を生成してbodyに追加
     */
    function createElements() {
        // 1. スポットライト（ハイライト用）
        $spotlight = $('<div id="setae-tutorial-spotlight"></div>');

        // 2. ツールチップ（説明文用）
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

        // イベントハンドラ
        $('#st-btn-next').on('click', nextStep);
        $('#st-btn-skip').on('click', endTutorial);

        // ウィンドウリサイズ時に位置調整
        $(window).on('resize.setaeTutorial', () => {
            if (currentStepIndex >= 0) showStep(currentStepIndex);
        });
    }

    /**
     * ステップを表示
     */
    function showStep(index) {
        if (index >= steps.length) {
            endTutorial();
            return;
        }

        const step = steps[index];
        const $target = step.target ? $(step.target) : null;

        // ターゲットが指定されているが存在しない、または非表示の場合はスキップ
        if (step.target && (!$target.length || !$target.is(':visible'))) {
            console.warn(`Tutorial target not found: ${step.target}`);
            nextStep();
            return;
        }

        currentStepIndex = index;

        // --- テキスト更新 ---
        $('#st-title').text(step.title);
        $('#st-text').html(step.text);
        $('#st-counter').text(`${index + 1} / ${steps.length}`);
        $('#st-btn-next').text(index === steps.length - 1 ? 'Finish' : 'Next');

        // --- スポットライトとツールチップの位置計算 ---
        if ($target) {
            // 要素をハイライトする場合
            const offset = $target.offset();
            const width = $target.outerWidth();
            const height = $target.outerHeight();

            // スポットライトを要素に合わせる
            // box-shadowを使って周囲を暗くするテクニック
            $spotlight.css({
                top: offset.top - 5, // 少し余白
                left: offset.left - 5,
                width: width + 10,
                height: height + 10,
                display: 'block',
                position: 'absolute',
                borderRadius: '8px',
                boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.75)', // これが暗幕になる
                zIndex: 10000,
                pointerEvents: 'none', // クリックは通さない（チュートリアル中は操作させない場合）
                transition: 'all 0.3s ease'
            });

            // ツールチップの位置
            placeTooltip(offset.top, offset.left, width, height, step.position);

        } else {
            // 画面中央（Welcomeメッセージなど）
            $spotlight.css({
                top: '50%',
                left: '50%',
                width: 0,
                height: 0,
                boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.75)'
            });

            // ツールチップを中央配置
            $tooltip.css({
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: 10001
            });

            // 矢印を消す
            $tooltip.removeClass('arrow-top arrow-bottom');
        }

        $tooltip.fadeIn(200);
    }

    /**
     * ツールチップの配置計算
     */
    function placeTooltip(targetTop, targetLeft, targetW, targetH, position) {
        const tooltipW = 280; // CSSで設定する幅と合わせる
        // const tooltipH = $tooltip.outerHeight(); // 可変なので計算時に取得も可だが、簡易計算する

        let top, left;
        const spacing = 15;

        // モバイル対応: 画面幅からはみ出さないように調整
        let screenW = $(window).width();
        left = targetLeft + (targetW / 2) - (tooltipW / 2);

        // 画面左端・右端のガード
        if (left < 10) left = 10;
        if (left + tooltipW > screenW - 10) left = screenW - tooltipW - 10;

        $tooltip.removeClass('arrow-top arrow-bottom');

        if (position === 'top') {
            top = targetTop - $tooltip.outerHeight() - spacing;
            $tooltip.addClass('arrow-bottom');
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
        $spotlight.fadeOut(300, function () { $(this).remove(); });
        $tooltip.fadeOut(300, function () { $(this).remove(); });
        $(window).off('resize.setaeTutorial');

        // 次回から表示しないように記録
        localStorage.setItem(STORAGE_KEY, 'true');
    }

    // デバッグ用: 強制的にチュートリアルを開始するメソッド
    function resetAndStart() {
        localStorage.removeItem(STORAGE_KEY);
        init();
    }

    return {
        init: init,
        reset: resetAndStart
    };

})(jQuery);
