/**
 * Setae App Tutorial Module
 * - Scenarios: Main, AddSpider, SwipeGuide, Encyclopedia, EditSuggestion, EncyclopediaDetail
 * - Features: Mobile optimized, Scroll lock, Dynamic positioning, Auto-scroll
 */
var SetaeTutorial = (function ($) {
    'use strict';

    // シナリオごとの完了フラグ管理キー
    const KEYS = {
        MAIN: 'setae_tutorial_main_v1',
        ADD: 'setae_tutorial_add_v1',
        SWIPE: 'setae_tutorial_swipe_v1',
        ENC: 'setae_tutorial_enc_v1',
        EDIT_SUGGEST: 'setae_tutorial_edit_v1',
        ENC_DETAIL: 'setae_tutorial_enc_detail_v1', // ← 追加: 図鑑詳細用
        ADD_LOG: 'setae_tutorial_add_log_v1', // ← 追加: 記録を追加用
        MY_DETAIL: 'setae_tutorial_my_detail_v2' // ← 追加: 個体詳細画面用
    };

    // --- シナリオ定義 ---
    const scenarios = {
        // 1. メイン画面
        main: [
            { target: null, title: 'Welcome to Setae!', text: 'Setaeへようこそ！<br>あなたのタランチュラ・奇蟲ライフを管理するアプリです。<br>主要な機能の使いかたを簡単にご紹介します。', position: 'center' },
            { target: '#btn-add-spider', title: '個体の登録', text: 'まずはここをタップして、<br>あなたの飼育している個体を登録しましょう。<br>(※この後、実際の登録画面でもガイドが表示されます)', position: 'bottom' },
            { target: '.setae-decks-scroll:visible', title: 'フィルタリング', text: '「空腹」「脱皮前」などのステータスで<br>個体をすばやく絞り込むことができます。', position: 'bottom' },
            { target: '#setae-spider-search', title: '検索機能', text: '個体が増えてきても大丈夫。<br>名前や種類ですぐに検索できます。', position: 'bottom' },
            { target: '.setae-nav-item[data-target="section-enc"]', title: 'みんなで作る図鑑', text: 'ここから図鑑にアクセスできます。<br>あなたの個体の写真や飼育情報を送って、<br>一緒に図鑑を充実させていきましょう！', position: 'top' },
            { target: '.setae-nav-item[data-target="section-com"]', title: '交流掲示板', text: '飼育の質問や雑談はこちらから。<br>他のユーザーと交流して、<br>悩みを解決したり情報をシェアしましょう。', position: 'top' },
            { target: '.setae-nav-item[data-target="section-bl"]', title: 'BL Match', text: 'ブリーディングローン（繁殖貸与）の<br>パートナー募集や検索はこちらから。<br>新しい繁殖の機会を見つけましょう。', position: 'top' },
            { target: null, title: '準備完了！', text: 'それでは、Setaeでの管理をお楽しみください！', position: 'center' }
        ],

        // 2. 新規登録画面（モーダル）
        add_spider: [
            { target: '.setae-radio-group', title: 'カテゴリー選択', text: 'まずは生き物のカテゴリーを選んでください。<br>タランチュラ以外にもサソリや植物なども管理できます。', position: 'bottom' },
            { target: '#spider-species-search', title: '種類の検索', text: 'ここに学名や和名を入力すると候補が表示されます。<br>データベースから選ぶことで、詳細な飼育情報を自動で紐付けることができます。', position: 'top' },
            { target: '.setae-file-upload-wrapper', title: '写真の登録', text: 'お気に入りの写真を登録しましょう。<br>一覧や詳細画面のトップに表示されます。', position: 'top' },
            { target: '#spider-name', title: '名前・管理ID', text: '個体の愛称や、「No.01」などの管理番号を入力できます。<br>空欄の場合は種類名が自動で設定されます。', position: 'top' },
            { target: '#form-add-spider button[type="submit"]', title: '登録完了', text: '入力が終わったら登録ボタンを押してください。<br>これであなたのコレクションに追加されます！', position: 'top' }
        ],

        // 3. スワイプ操作ガイド
        swipe_guide: [
            { target: '.setae-spider-list-row:first', title: 'クイックアクション', text: '登録ありがとうございます！<br>リストのカードには便利な操作が隠されています。', position: 'bottom' },
            { target: '.setae-spider-list-row:first', title: '状態に合わせたスマート操作', text: 'カードを<b>左右にスワイプ</b>すると、その時の状態に合わせたアクションが実行されます。<br>生き物の種類やタイミングによって操作が変わるので、アイコンを確認して活用してください。', position: 'bottom' },
            { target: '.setae-spider-list-row:first', title: 'タップで「詳細」', text: 'カード自体をタップすると詳細画面へ移動します。<br>成長ログやグラフを確認してみましょう。', position: 'bottom' }
        ],

        // 4. 図鑑画面
        encyclopedia: [
            { target: null, title: '図鑑へようこそ！', text: 'ここはみんなで作る生き物のデータベースです。<br>飼育に必要な情報や写真を共有しましょう。', position: 'center' },
            { target: '#setae-enc-search', title: '種類の検索', text: '学名や和名を入力して、<br>気になる生き物をすぐに探すことができます。', position: 'bottom' },
            //            { target: '#btn-request-species', title: '追加リクエスト', text: 'もし探している種類が図鑑にない場合は、<br>ここから追加のリクエストを送ることができます。', position: 'bottom' },
            { target: '.species-card:first', title: '詳細を見る', text: 'カードをタップすると、適温や湿度などの詳細データと、<br>みんなが投稿した写真ギャラリーを見ることができます。', position: 'bottom' }
        ],

        // 5. 編集提案・情報提供モーダル
        edit_suggestion: [
            { target: null, title: '情報提供ありがとうございます！', text: 'あなたの知識や写真が、Setaeの図鑑をより豊かにします。<br>わかる範囲で構いませんので、情報をご提供ください。', position: 'center' },
            { target: '#edit-image-placeholder', title: 'ベストショットの提供', text: 'ご自身で撮影された、その種類の特徴がよくわかる<br>ベストショットをアップロードしてください。<br><br><b style="color:#d35400;">🎁 画像が採用されると、あなたの生体登録枠が「＋１」されます！</b>', position: 'bottom' },
            { target: '#setae-species-edit-form .setae-form-group:eq(1)', title: '基本データの入力', text: '和名、適温、性格などの基本データを入力します。<br>不明な項目は空欄のままで大丈夫です。', position: 'bottom' },
            { target: 'textarea[name="suggested_description"]', title: '特徴や飼育のコツ', text: 'その他、飼育時の注意点や固有の特徴があれば、<br>こちらの補足情報にぜひ記載してください。', position: 'top' },
            { target: '#setae-species-edit-form button[type="submit"]', title: '提案を送信', text: '入力が終わったらここをタップして送信してください。<br>内容を確認後、図鑑に反映されます！', position: 'top' }
        ],

        // 6. 図鑑詳細ページ
        encyclopedia_detail: [
            { target: null, title: '種別詳細ページ', text: 'ここでは、この生き物に関する詳しいデータや、<br>みんなが投稿した写真ギャラリーを見ることができます。', position: 'center' },
            { target: '#btn-open-edit-modal', title: '情報・写真の提供', text: '<b>Setaeの図鑑はみんなで作る参加型です！</b><br>右上のこのアイコンをタップして、あなたが知っている情報や、ご自身で撮影したベストショットをぜひ提供してください。', position: 'bottom' },
            { target: '#enc-detail-keeping', title: '飼育者数', text: 'Setae内でこの種類を飼育している人の数です。<br>人気度が一目でわかります。', position: 'top' },
            { target: '#section-enc-detail .setae-card:last', title: 'ギャラリー', text: 'みんなが投稿したベストショットがここに並びます。<br>あなたの写真で図鑑を彩りましょう！', position: 'top' }
        ],

        // 7. 記録を追加モーダル
        add_log: [
            { target: null, title: '飼育記録をつけましょう', text: '日々の給餌や脱皮、成長の様子を記録して、<br>個体の状態をしっかり管理できます。', position: 'center' },
            { target: '.type-group', title: 'イベントの種類', text: '給餌、脱皮、サイズ測定などの<br>イベントタイプを選択します。', position: 'bottom' },
            { target: '.toggle-refused', title: '拒食の記録', text: '餌を与えて食べなかった場合は「拒食」をオンに。<br>次の給餌タイミングの参考になります。', position: 'top' },
            { target: '.upload-group', title: '写真とBest Shot', text: 'カメラアイコンから写真を添付できます。<br><br><b style="color:#d35400;">📸 写真を追加した際に表示される「Best Shot」をオンにして保存すると、あなたの写真がみんなの図鑑にも投稿されます！</b><br><span style="font-size:11px; color:#888;">(※図鑑への反映は承認制です)</span>', position: 'top' },
            { target: '.setae-btn-submit', title: '記録を保存', text: '日付やメモを入力したら、<br>ここをタップして記録を保存しましょう！', position: 'top' }
        ],

        // 8. 個体詳細画面
        my_detail: [
            { target: null, title: '個体詳細', text: 'ここは個体の詳細画面です。<br>日々の成長や給餌の記録を確認・管理できます。', position: 'center' },
            { target: '.setae-detail-tabs', title: '情報の切り替え', text: '「概要」でグラフや最新ステータスを確認し、<br>「履歴」で過去の記録をタイムラインで振り返ることができます。', position: 'bottom' },
            { target: '#btn-add-log', title: '記録の追加', text: '右下のこのボタンから、いつでも給餌や脱皮などの<br>新しい記録を追加できます。', position: 'top' },
            { target: '#btn-edit-spider-trigger', title: '個体情報の編集', text: '名前の変更やプロフ画像の更新、<br>死亡時のステータス変更はこちらから行えます。', position: 'bottom' },
            { target: '#btn-tab-settings', title: 'ブリーディングローン(BL)', text: '「設定 / BL」タブから、この個体を<br>繁殖パートナーとしてコミュニティに公開・募集できます。', position: 'bottom' }
        ]
    };

    let activeScenario = null;
    let currentStepIndex = 0;
    let $spotlight, $tooltip;

    // --- 初期化と監視ロジック ---

    function initMain() {
        if (localStorage.getItem(KEYS.MAIN)) return;
        setTimeout(() => {
            if ($('#section-my').is(':visible') && !$('.setae-modal').is(':visible')) {
                startScenario('main');
            }
        }, 1000);
    }

    function initAddSpider() {
        if (localStorage.getItem(KEYS.ADD)) return;
        let attempts = 0;
        const checkInterval = setInterval(() => {
            attempts++;
            if ($('#modal-add-spider').is(':visible')) {
                clearInterval(checkInterval);
                startScenario('add_spider');
            } else if (attempts > 20) {
                clearInterval(checkInterval);
            }
        }, 500);
    }

    function initSwipe() {
        if (localStorage.getItem(KEYS.SWIPE)) return;
        setTimeout(() => {
            if ($('.setae-spider-list-row').length > 0 && $('#section-my').is(':visible') && !$('.setae-modal').is(':visible')) {
                startScenario('swipe_guide');
            }
        }, 800);
    }

    function initEncyclopedia() {
        if (localStorage.getItem(KEYS.ENC)) return;
        let attempts = 0;
        const checkInterval = setInterval(() => {
            attempts++;
            if ($('#section-enc').is(':visible') && !$('.setae-modal').is(':visible') && $('.species-card').length > 0) {
                clearInterval(checkInterval);

                // --- 追加: 図鑑チュートリアル開始前に最上部へスクロール ---
                window.scrollTo(0, 0);
                $('#section-enc').scrollTop(0);
                // --------------------------------------------------------

                startScenario('encyclopedia');
            } else if (attempts > 40) {
                clearInterval(checkInterval);
            }
        }, 500);
    }

    function initEditSuggestion() {
        if (localStorage.getItem(KEYS.EDIT_SUGGEST)) return;
        let attempts = 0;
        const checkInterval = setInterval(() => {
            attempts++;
            if ($('#setae-species-edit-modal').is(':visible')) {
                clearInterval(checkInterval);
                startScenario('edit_suggestion');
            } else if (attempts > 20) {
                clearInterval(checkInterval);
            }
        }, 500);
    }

    // ★図鑑詳細用の監視
    function initEncyclopediaDetail() {
        if (localStorage.getItem(KEYS.ENC_DETAIL)) return;
        let attempts = 0;
        const checkInterval = setInterval(() => {
            attempts++;
            if ($('#section-enc-detail').is(':visible') && $('#enc-detail-title').text() !== '') {
                clearInterval(checkInterval);
                startScenario('encyclopedia_detail');
            } else if (attempts > 20) {
                clearInterval(checkInterval);
            }
        }, 500);
    }

    // ★記録を追加モーダル用の監視
    function initAddLog() {
        if (localStorage.getItem(KEYS.ADD_LOG)) return;
        let attempts = 0;
        const checkInterval = setInterval(() => {
            attempts++;
            if ($('#setae-log-form').is(':visible')) {
                clearInterval(checkInterval);
                startScenario('add_log');
            } else if (attempts > 20) {
                clearInterval(checkInterval);
            }
        }, 500);
    }

    // ★個体詳細画面用の監視
    function initMyDetail() {
        if (localStorage.getItem(KEYS.MY_DETAIL)) return;
        let attempts = 0;
        const checkInterval = setInterval(() => {
            attempts++;
            if ($('#section-my-detail').is(':visible') && !$('.setae-modal').is(':visible')) {
                clearInterval(checkInterval);
                startScenario('my_detail');
            } else if (attempts > 20) {
                clearInterval(checkInterval);
            }
        }, 500);
    }

    // イベントの自己監視
    $(document).ready(function () {
        // ① 図鑑タブがクリックされたとき
        $(document).on('click', '.setae-nav-item[data-target="section-enc"]', function () {
            initEncyclopedia();
        });

        // ② 編集モーダルが開かれたとき
        $(document).on('click', '#btn-open-edit-modal, .btn-open-edit-modal', function () {
            initEditSuggestion();
        });

        // ③ 個体登録ボタンがクリックされたとき
        $(document).on('click', '#btn-add-spider', function () {
            initAddSpider();
        });

        // ④ 図鑑詳細ページが開かれたとき【追加】
        $(document).on('click', '.js-open-species-detail', function () {
            initEncyclopediaDetail();
        });

        // ⑤ ページ読み込み時に最初から図鑑タブが表示されている場合の対応
        if ($('#section-enc').is(':visible')) {
            initEncyclopedia();
        }

        // ⑥ 動的に開く画面・モーダル用の汎用クリック監視
        $(document).on('click', function () {
            setTimeout(() => {
                // 記録を追加モーダル
                if (!localStorage.getItem(KEYS.ADD_LOG) && $('#setae-log-form').is(':visible')) {
                    initAddLog();
                }
                // 個体詳細画面の検知
                if (!localStorage.getItem(KEYS.MY_DETAIL) && $('#section-my-detail').is(':visible') && !$('.setae-modal').is(':visible')) {
                    initMyDetail();
                }
            }, 300);
        });
    });

    // --- シナリオ実行 ---

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

            // 自動スクロール処理（要素が見える位置までスムーズに移動）
            $target[0].scrollIntoView({ behavior: 'smooth', block: 'center' });

            // スクロール完了を少し待ってからスポットライトを配置
            setTimeout(() => {
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
                $tooltip.css('zIndex', 100001).fadeIn(200);
            }, 300);

        } else {
            // Targetがない場合は画面中央
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
            $tooltip.fadeIn(200);
        }
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

        // 水平位置の計算
        const targetCenterX = targetOffset.left + (targetW / 2);
        let left = targetCenterX - (tooltipW / 2);
        if (left < screenMargin) left = screenMargin;
        if (left + tooltipW > winW - screenMargin) left = winW - tooltipW - screenMargin;

        // 吹き出しの矢印位置
        let arrowPercent = ((targetCenterX - left) / tooltipW) * 100;
        arrowPercent = Math.max(10, Math.min(90, arrowPercent));
        $tooltip[0].style.setProperty('--st-arrow-left', arrowPercent + '%');

        // 垂直位置の計算
        $tooltip.removeClass('arrow-top arrow-bottom');
        let top;
        let finalPos = preferredPosition;

        if (preferredPosition === 'top') {
            if (targetOffset.top - tooltipH - spacing < $(window).scrollTop()) finalPos = 'bottom';
        } else {
            if (targetOffset.top + targetH + tooltipH + spacing > $(window).scrollTop() + winH) finalPos = 'top';
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
        // 次のステップの前に一度隠すことでスクロール中のズレを防止
        $tooltip.hide();
        showStep(currentStepIndex + 1);
    }

    function endTutorial() {
        if ($spotlight) $spotlight.fadeOut(300, function () { $(this).remove(); });
        if ($tooltip) $tooltip.fadeOut(300, function () { $(this).remove(); });
        $(window).off('resize.setaeTutorial');

        if (activeScenario === 'main') localStorage.setItem(KEYS.MAIN, 'true');
        else if (activeScenario === 'add_spider') localStorage.setItem(KEYS.ADD, 'true');
        else if (activeScenario === 'swipe_guide') localStorage.setItem(KEYS.SWIPE, 'true');
        else if (activeScenario === 'encyclopedia') localStorage.setItem(KEYS.ENC, 'true');
        else if (activeScenario === 'edit_suggestion') localStorage.setItem(KEYS.EDIT_SUGGEST, 'true');
        else if (activeScenario === 'encyclopedia_detail') localStorage.setItem(KEYS.ENC_DETAIL, 'true'); // ← 追加
        else if (activeScenario === 'add_log') localStorage.setItem(KEYS.ADD_LOG, 'true'); // ← 追加
        else if (activeScenario === 'my_detail') localStorage.setItem(KEYS.MY_DETAIL, 'true'); // ← 追加

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
        initEncyclopedia: initEncyclopedia,
        initEditSuggestion: initEditSuggestion,
        initEncyclopediaDetail: initEncyclopediaDetail, // ← 公開メソッドに追加
        initAddLog: initAddLog, // ← 追加
        initMyDetail: initMyDetail, // ← 追加
        reset: resetAndStart
    };

})(jQuery);