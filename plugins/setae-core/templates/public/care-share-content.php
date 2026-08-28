<?php
/** Only the allowlisted controller context is used in this view. */
if (!defined('ABSPATH')) {
    exit;
}
$care = $setae_care_share;
$item = $care['item'];
?>
<main id="setae-care-share-main" class="setae-care-share-main setae-public-surface-shell" tabindex="-1"
    data-care-share-page data-public-share-root
    data-share-title="<?php echo esc_attr($item['meta_title']); ?>"
    data-share-text="<?php echo esc_attr($item['share_text']); ?>"
    data-share-url="<?php echo esc_url($item['invite_share_url']); ?>"
    data-share-copy-text="<?php echo esc_attr($item['share_copy_text']); ?>">
    <article class="setae-care-share-record" aria-labelledby="setae-care-share-title">
        <header class="setae-care-share-heading">
            <p class="setae-public-section-label" lang="en">PUBLIC FIELD NOTE</p>
            <h1 id="setae-care-share-title"><?php echo esc_html($item['heading']); ?></h1>
            <div class="setae-care-share-identity">
                <p class="setae-care-share-code"><span class="setae-public-visually-hidden">管理番号 </span><?php echo esc_html($item['spider']['title']); ?></p>
                <p class="setae-care-share-taxon"><em><?php echo esc_html($item['spider']['species_name']); ?></em></p>
                <p class="setae-care-share-classification"><?php echo esc_html($item['classification_label']); ?></p>
            </div>
            <div class="setae-care-share-author">
                <span class="setae-care-share-avatar" aria-hidden="true">
                    <?php if ($item['author']['avatar']): ?>
                        <img src="<?php echo esc_url($item['author']['avatar']); ?>" alt="" width="44" height="44" loading="lazy" decoding="async">
                    <?php else: ?>
                        <span><?php echo esc_html($item['author']['initial']); ?></span>
                    <?php endif; ?>
                </span>
                <div class="setae-care-share-author-details">
                    <p class="setae-care-share-author-name"><?php echo esc_html($item['author']['name']); ?></p>
                    <div class="setae-care-share-author-meta">
                        <a class="setae-care-share-profile-link" href="<?php echo esc_url($item['author']['profile_url']); ?>">公開プロフィール<?php echo Setae_Public_Visual::icon('arrow-up-right'); ?></a>
                        <?php if ($item['created_at_iso']): ?><time datetime="<?php echo esc_attr($item['created_at_iso']); ?>" aria-label="公開日"><?php echo esc_html($item['published_date']); ?></time><?php else: ?><span><?php echo esc_html($item['published_date']); ?></span><?php endif; ?>
                    </div>
                </div>
            </div>
        </header>
        <figure class="setae-care-share-media">
            <?php if ($item['display_image']): ?>
                <img src="<?php echo esc_url($item['display_image']); ?>" alt="<?php echo esc_attr($item['og_image_alt']); ?>" width="4" height="3" loading="eager" decoding="async" fetchpriority="high">
            <?php else: ?>
                <?php echo Setae_Public_Visual::specimen_placeholder(array(
                    'classification' => $item['classification'],
                    'scientific_name' => $item['spider']['species_name'],
                    'code' => $item['spider']['title'],
                    'variant' => 'exhibit',
                    'show_taxon' => false,
                )); ?>
            <?php endif; ?>
        </figure>
        <dl class="setae-care-share-properties" aria-label="記録の詳細">
            <?php foreach ($item['properties'] as $property): ?>
                <div><dt><?php echo esc_html($property['label']); ?></dt><dd><?php echo esc_html($property['value']); ?></dd></div>
            <?php endforeach; ?>
        </dl>
        <p class="setae-care-share-note<?php echo $item['note'] === '' ? ' is-empty' : ''; ?>"><?php echo $item['note'] === '' ? 'メモはありません。' : nl2br(esc_html($item['note'])); ?></p>
    </article>
    <div class="setae-care-share-lower">
        <section class="setae-care-share-responses" aria-labelledby="setae-care-share-responses-title">
            <h2 id="setae-care-share-responses-title">反応・コメント</h2>
            <?php if ($item['reactions']): ?>
                <dl class="setae-care-share-reactions" aria-label="リアクション">
                    <?php foreach ($item['reactions'] as $reaction): ?>
                        <div><dt><?php echo esc_html($reaction['label']); ?></dt><dd><?php echo esc_html(number_format_i18n($reaction['count'])); ?></dd></div>
                    <?php endforeach; ?>
                </dl>
            <?php else: ?><p class="setae-care-share-muted">リアクションはまだありません。</p><?php endif; ?>
            <h3 class="setae-care-share-comments-heading">最新のコメント <span>最大3件</span></h3>
            <?php if ($item['comments']): ?>
                <ol class="setae-care-share-comments">
                    <?php foreach ($item['comments'] as $comment): ?>
                        <li class="setae-care-share-comment">
                            <div class="setae-care-share-comment-meta"><strong><?php echo esc_html($comment['author']['name']); ?></strong><?php if ($comment['datetime']): ?><time datetime="<?php echo esc_attr($comment['datetime']); ?>"><?php echo esc_html($comment['date']); ?></time><?php else: ?><span><?php echo esc_html($comment['date']); ?></span><?php endif; ?></div>
                            <p><?php echo nl2br(esc_html($comment['content'])); ?></p>
                        </li>
                    <?php endforeach; ?>
                </ol>
            <?php else: ?><p class="setae-care-share-muted">まだコメントはありません。</p><?php endif; ?>
            <p class="setae-care-share-readonly">コメントやリアクションはログイン後に利用できます。</p>
        </section>
        <aside class="setae-care-share-side" aria-label="SETAEと共有">
            <section class="setae-care-share-cta" aria-labelledby="setae-care-share-cta-title">
                <h2 id="setae-care-share-cta-title">SETAEで記録する</h2>
                <p>写真、給餌、脱皮。個体ごとの日々を残し、必要な記録だけを共有できます。</p>
                <?php if ($care['is_logged_in']): ?>
                    <a class="setae-public-button is-primary" href="<?php echo esc_url($care['actions']['app_url']); ?>">SETAEを開く</a>
                <?php elseif ($care['registration']['enabled']): ?>
                    <a class="setae-public-button is-primary" href="<?php echo esc_url($care['actions']['register_url']); ?>" data-public-register aria-haspopup="dialog" aria-controls="<?php echo esc_attr($care['registration']['id']); ?>">無料で記録を始める</a>
                <?php else: ?>
                    <a class="setae-public-button is-primary" href="<?php echo esc_url($care['actions']['login_url']); ?>">ログイン</a>
                    <p class="setae-care-share-muted">現在、新規登録の受付を停止しています。</p>
                <?php endif; ?>
            </section>
            <div class="setae-care-share-share" data-public-share-controls>
                <details class="setae-public-share-menu" data-public-share-menu>
                    <summary class="setae-public-button is-default"><?php echo Setae_Public_Visual::icon('share'); ?><span>共有</span></summary>
                    <div class="setae-public-share-options">
                        <button type="button" class="setae-public-button is-quiet" data-public-share-action="native" hidden>端末で共有</button>
                        <button type="button" class="setae-public-button is-quiet" data-public-share-action="link">リンクをコピー</button>
                        <button type="button" class="setae-public-button is-quiet" data-public-share-action="text">紹介文をコピー</button>
                        <a class="setae-public-button is-quiet" href="<?php echo esc_url($item['x_share_url']); ?>" target="_blank" rel="noopener noreferrer" data-public-share-action="x">Xで共有</a>
                        <a class="setae-public-button is-quiet" href="<?php echo esc_url($item['line_share_url']); ?>" target="_blank" rel="noopener noreferrer" data-public-share-action="line">LINEで共有</a>
                    </div>
                </details>
                <p class="setae-public-share-status" role="status" aria-live="polite" aria-atomic="true" data-public-share-status></p>
            </div>
        </aside>
    </div>
</main>
