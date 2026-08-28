<?php
/**
 * Partial: Encyclopedia Detail View
 */
?>
<div id="section-enc-detail" class="setae-section enc-detail-view" style="display: none;">
    <header class="enc-detail-header">
        <button id="btn-back-to-enc" class="enc-detail-back" type="button" aria-label="図鑑一覧へ戻る">
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="m15 18-6-6 6-6"></path>
            </svg>
        </button>
        <div class="enc-detail-header-title">
            <span>図鑑</span>
            <strong id="enc-detail-title"><?php esc_html_e('読み込み中...', 'setae-core'); ?></strong>
        </div>
        <button id="btn-open-edit-modal" class="enc-detail-edit" type="button" aria-label="修正・情報提供">
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 20h9"></path>
                <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"></path>
            </svg>
        </button>
    </header>

    <div id="enc-detail-loading-spinner" class="enc-detail-loader" aria-live="polite">
        <span class="enc-loader-mark" aria-hidden="true"></span>
        <span>図鑑情報を読み込んでいます</span>
    </div>

    <div class="enc-detail-content" hidden>
        <section class="enc-detail-hero">
            <figure class="enc-detail-figure">
                <div class="enc-detail-image-placeholder" aria-hidden="true"></div>
                <img id="enc-detail-image" src="" alt="">
                <figcaption id="enc-detail-image-credit-overlay" hidden>
                    <span id="enc-detail-credit-avatar" class="enc-credit-avatar"></span>
                    <span>
                        <small>写真提供</small>
                        <strong id="enc-detail-credit-name"></strong>
                    </span>
                </figcaption>
            </figure>

            <div class="enc-detail-identity">
                <p id="enc-detail-genus" class="enc-detail-genus"></p>
                <p id="enc-detail-common-name" class="enc-detail-common-name"></p>
                <h1 id="enc-detail-name"><?php esc_html_e('種名', 'setae-core'); ?></h1>
                <div id="enc-detail-temperament-list" class="enc-detail-tags"></div>

                <dl class="enc-detail-metrics">
                    <div>
                        <dt>飼育者</dt>
                        <dd id="enc-detail-metric-keepers">0</dd>
                    </div>
                    <div>
                        <dt>公開記録</dt>
                        <dd id="enc-detail-metric-care">0</dd>
                    </div>
                    <div>
                        <dt>相談</dt>
                        <dd id="enc-detail-metric-topics">0</dd>
                    </div>
                    <div>
                        <dt>繁殖募集</dt>
                        <dd id="enc-detail-metric-breeding">0</dd>
                    </div>
                </dl>
            </div>
        </section>

        <nav class="enc-detail-tabs" role="tablist" aria-label="図鑑の表示内容">
            <button type="button" id="enc-tab-overview" class="active" role="tab" aria-selected="true" aria-controls="enc-panel-overview" tabindex="0" data-enc-panel="overview">概要</button>
            <button type="button" id="enc-tab-care" role="tab" aria-selected="false" aria-controls="enc-panel-care" tabindex="-1" data-enc-panel="care">飼育記録</button>
            <button type="button" id="enc-tab-topics" role="tab" aria-selected="false" aria-controls="enc-panel-topics" tabindex="-1" data-enc-panel="topics">相談</button>
            <button type="button" id="enc-tab-breeding" role="tab" aria-selected="false" aria-controls="enc-panel-breeding" tabindex="-1" data-enc-panel="breeding">繁殖</button>
            <button type="button" id="enc-tab-gallery" role="tab" aria-selected="false" aria-controls="enc-panel-gallery" tabindex="-1" data-enc-panel="gallery">写真</button>
            <button type="button" id="enc-tab-shops" role="tab" aria-selected="false" aria-controls="enc-panel-shops" tabindex="-1" data-enc-panel="shops">販売</button>
        </nav>

        <div class="enc-detail-workspace">
            <main class="enc-detail-main">
                <section id="enc-panel-overview" class="enc-detail-panel active" role="tabpanel" aria-labelledby="enc-tab-overview" data-enc-panel-content="overview">
                    <article class="enc-detail-article">
                        <div class="enc-section-heading">
                            <div>
                                <span>SPECIES PROFILE</span>
                                <h2>種の概要</h2>
                            </div>
                            <span id="enc-research-status" class="enc-research-status is-unreviewed">未調査</span>
                        </div>
                        <div id="enc-detail-description" class="enc-detail-description"></div>
                        <div id="enc-detail-content-sections" class="enc-content-sections"></div>
                    </article>

                    <section id="enc-research-section" class="enc-research-section">
                        <div class="enc-section-heading">
                            <div>
                                <span>RESEARCH SOURCES</span>
                                <h2>Codex調査・出典</h2>
                            </div>
                            <time id="enc-research-date"></time>
                        </div>
                        <div id="enc-research-sources" class="enc-source-list"></div>
                        <div id="enc-research-empty" class="enc-panel-empty" hidden>
                            <strong>出典の登録を準備中です</strong>
                            <p>飼育記録とは分けて、論文や学術データベースの根拠を順次追加します。</p>
                        </div>
                    </section>

                    <section id="enc-external-links-section" class="enc-external-links-section" hidden>
                        <div class="enc-section-heading">
                            <div>
                                <span>REFERENCE LINKS</span>
                                <h2>外部資料</h2>
                            </div>
                        </div>
                        <div id="enc-external-links" class="enc-external-links"></div>
                    </section>
                </section>

                <section id="enc-panel-care" class="enc-detail-panel" role="tabpanel" aria-labelledby="enc-tab-care" data-enc-panel-content="care" hidden>
                    <div class="enc-section-heading">
                        <div>
                            <span>REAL CARE DATA</span>
                            <h2>実際の飼育記録</h2>
                        </div>
                    </div>
                    <div id="enc-related-care-card">
                        <div id="enc-related-care" class="enc-related-list"></div>
                    </div>
                </section>

                <section id="enc-panel-topics" class="enc-detail-panel" role="tabpanel" aria-labelledby="enc-tab-topics" data-enc-panel-content="topics" hidden>
                    <div class="enc-section-heading enc-section-heading-actions">
                        <div>
                            <span>COMMUNITY</span>
                            <h2>相談記録</h2>
                        </div>
                        <div class="enc-related-actions">
                            <button type="button" id="btn-open-species-topic-list" class="enc-secondary-button js-open-species-topic-list">相談一覧</button>
                            <button type="button" id="btn-open-species-topic" class="enc-primary-button js-open-species-topic-modal">相談する</button>
                        </div>
                    </div>
                    <div id="enc-related-topics-card">
                        <div id="enc-related-topics" class="enc-related-list"></div>
                    </div>
                </section>

                <section id="enc-panel-breeding" class="enc-detail-panel" role="tabpanel" aria-labelledby="enc-tab-breeding" data-enc-panel-content="breeding" hidden>
                    <div class="enc-section-heading enc-section-heading-actions">
                        <div>
                            <span>BREEDING MATCH</span>
                            <h2>繁殖募集</h2>
                        </div>
                    </div>
                    <div id="enc-breeding-candidates" class="enc-breeding-grid"></div>
                </section>

                <section id="enc-panel-gallery" class="enc-detail-panel" role="tabpanel" aria-labelledby="enc-tab-gallery" data-enc-panel-content="gallery" hidden>
                    <div class="enc-section-heading">
                        <div>
                            <span>COMMUNITY ALBUM</span>
                            <h2>図鑑写真</h2>
                        </div>
                    </div>
                    <div id="enc-gallery-grid" class="enc-gallery-grid"></div>
                    <div id="enc-gallery-empty" class="enc-panel-empty" hidden>
                        <strong>写真はまだありません</strong>
                    </div>
                </section>

                <section id="enc-panel-shops" class="enc-detail-panel" role="tabpanel" aria-labelledby="enc-tab-shops" data-enc-panel-content="shops" hidden>
                    <div class="enc-section-heading">
                        <div>
                            <span>APPROVED SHOPS</span>
                            <h2>プロショップの販売情報</h2>
                        </div>
                        <span class="enc-approved-label">掲載審査済み</span>
                    </div>
                    <div id="enc-shop-links" class="enc-shop-list"></div>
                    <div id="enc-shop-empty" class="enc-panel-empty" hidden>
                        <strong>現在掲載中の販売情報はありません</strong>
                        <p>販売情報は、Setaeへ掲載申請し承認されたショップのみ表示されます。</p>
                        <a href="https://nakano2835.com/contact/" target="_blank" rel="noopener noreferrer">ショップ掲載のお問い合わせ</a>
                    </div>
                </section>
            </main>

            <aside class="enc-detail-aside">
                <section class="enc-facts-panel">
                    <div class="enc-section-heading">
                        <div>
                            <span>CARE RANGE</span>
                            <h2>飼育の目安</h2>
                        </div>
                    </div>
                    <dl class="enc-facts-grid">
                        <div><dt>生活型</dt><dd id="enc-detail-lifestyle">-</dd></div>
                        <div><dt>温度</dt><dd id="enc-detail-temp">-</dd></div>
                        <div><dt>湿度</dt><dd id="enc-detail-humidity">-</dd></div>
                        <div><dt>寿命</dt><dd id="enc-detail-lifespan">-</dd></div>
                        <div><dt>最大サイズ</dt><dd id="enc-detail-size">-</dd></div>
                        <div><dt>難易度</dt><dd id="enc-detail-difficulty">-</dd></div>
                    </dl>
                    <div id="enc-care-profile" class="enc-care-profile"></div>
                </section>

                <section class="enc-taxonomy-panel">
                    <div class="enc-section-heading">
                        <div>
                            <span>TAXONOMY</span>
                            <h2>分類・分布</h2>
                        </div>
                    </div>
                    <dl>
                        <div><dt>属</dt><dd id="enc-detail-taxonomy-genus">-</dd></div>
                        <div><dt>生息地域</dt><dd id="enc-detail-habitats">-</dd></div>
                        <div><dt>気質</dt><dd id="enc-detail-temperaments-text">-</dd></div>
                    </dl>
                </section>

                <a id="btn-search-inaturalist" class="enc-reference-link" href="https://www.inaturalist.org/" target="_blank" rel="noopener noreferrer">
                    <span>iNaturalist</span>
                    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M7 17 17 7M7 7h10v10"></path>
                    </svg>
                </a>
            </aside>
        </div>
    </div>
</div>
