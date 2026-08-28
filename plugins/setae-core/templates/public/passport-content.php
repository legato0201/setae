<?php
if (!defined('ABSPATH')) {
    exit;
}
$passport = $setae_passport;
$identity = $passport['identity'];
$actions = $passport['actions'];
?>
<div class="setae-qr-public-page" data-passport-mode="<?php echo esc_attr($passport['mode']); ?>" data-public-share-title="<?php echo esc_attr($actions['share_title']); ?>" data-public-share-text="<?php echo esc_attr($actions['share_text']); ?>" data-public-share-url="<?php echo esc_url($actions['share_url']); ?>">
    <a class="setae-public-skip-link" href="#setae-passport-main">本文へ移動</a>
    <header class="setae-qr-public-header">
        <div class="setae-qr-header-inner">
            <?php echo Setae_Public_Identity::render_brand(); ?>
            <p class="setae-qr-public-context"><?php echo esc_html($passport['state_label']); ?></p>
            <nav class="setae-qr-header-actions" aria-label="公開ページ">
                <?php if ($passport['can_share']): ?>
                    <button type="button" class="setae-public-button is-quiet" data-setae-public-share><?php echo Setae_Public_Visual::icon('share'); ?><span>共有</span></button>
                <?php endif; ?>
                <a class="setae-public-button is-quiet" href="<?php echo esc_url($passport['is_logged_in'] ? $actions['app_url'] : $actions['login_url']); ?>"><?php echo $passport['is_logged_in'] ? 'アプリ' : 'ログイン'; ?></a>
            </nav>
        </div>
    </header>
    <main id="setae-passport-main" class="setae-qr-public-main" tabindex="-1">
        <?php foreach ($passport['messages'] as $message): ?>
            <p class="setae-public-status is-<?php echo esc_attr($message['type']); ?>" role="<?php echo $message['type'] === 'danger' ? 'alert' : 'status'; ?>"><?php echo esc_html($message['text']); ?></p>
        <?php endforeach; ?>
        <?php if ($passport['mode'] === 'private'): ?>
            <section class="setae-qr-private-state">
                <span class="setae-qr-private-mark" aria-hidden="true"><?php echo Setae_Public_Visual::icon('qr'); ?></span>
                <h1>非公開の管理QRです</h1>
                <p>このQRは所有者が個体管理に使用しています。<br>個体情報は公開されていません。</p>
                <a class="setae-public-button is-primary" href="<?php echo esc_url($actions['login_url']); ?>">ログイン</a>
            </section>
        <?php else: ?>
            <?php if ($passport['is_owner']): ?>
                <aside class="setae-qr-owner-toolbar" aria-label="所有者用の操作">
                    <div><p>この個体を管理しています</p><span class="setae-public-status">所有者だけに表示</span></div>
                    <div class="setae-qr-owner-actions">
                        <a class="setae-public-button is-primary" href="<?php echo esc_url($passport['owner']['manage_url']); ?>">アプリで管理</a>
                        <?php if ($passport['owner']['has_settings']): ?>
                            <a class="setae-public-button is-quiet" href="<?php echo esc_url($passport['owner']['settings_url']); ?>" aria-describedby="setae-owner-settings-hint">公開設定</a>
                            <a class="setae-public-button is-quiet" href="<?php echo esc_url($passport['owner']['qr_url']); ?>" aria-describedby="setae-owner-settings-hint">QR設定</a>
                        <?php endif; ?>
                    </div>
                    <?php if ($passport['owner']['has_settings']): ?><p id="setae-owner-settings-hint">公開範囲とQRの設定は、アプリの個体画面から変更できます。</p><?php endif; ?>
                </aside>
                <p class="setae-qr-preview-label">公開パスポートのプレビュー · <?php echo esc_html($passport['state_label']); ?></p>
                <?php if ($passport['owner']['private_identity']): ?>
                    <p class="setae-public-status is-warning">以下の個体情報は所有者だけに表示しています。訪問者には「非公開の管理QRです」と表示されます。</p>
                <?php endif; ?>
            <?php endif; ?>
            <?php if ($passport['visitor_mode'] === 'transfer'): ?>
                <p class="setae-qr-transfer-state"><span class="setae-public-status is-warning">引き継ぎ受付中</span> 引き継ぎのための基本情報です。生活史は公開されていません。</p>
            <?php endif; ?>
            <article class="setae-qr-profile" aria-labelledby="setae-passport-title">
                <figure class="setae-qr-profile-media">
                    <?php if ($passport['hero']): ?>
                        <button type="button" class="setae-qr-profile-photo js-setae-public-photo" data-public-photo-index="0" aria-label="<?php echo esc_attr($identity['title'] . 'の写真を拡大'); ?>" aria-haspopup="dialog" aria-controls="setae-public-photo-dialog">
                            <img src="<?php echo esc_url($passport['hero']['url']); ?>" alt="<?php echo esc_attr($identity['title'] . ' · ' . $passport['hero']['label']); ?>" width="4" height="3" loading="eager" decoding="async" fetchpriority="high">
                            <span class="setae-qr-photo-open" aria-hidden="true"><?php echo Setae_Public_Visual::icon('expand'); ?></span>
                        </button>
                        <figcaption class="setae-qr-media-caption"><span><?php echo esc_html($passport['hero']['label']); ?></span><span>写真<?php echo esc_html(number_format_i18n(count($passport['gallery']))); ?>点</span></figcaption>
                    <?php else: ?>
                        <?php echo Setae_Public_Visual::specimen_placeholder(array('classification' => $identity['classification'], 'scientific_name' => $identity['species_name'], 'code' => $identity['code'], 'variant' => 'exhibit')); ?>
                    <?php endif; ?>
                </figure>
                <div class="setae-qr-profile-body">
                    <div class="setae-qr-identity-heading">
                        <p class="setae-qr-public-kicker" lang="en">LIVING SPECIMEN PASSPORT</p>
                        <h1 id="setae-passport-title" class="setae-qr-scientific-name"><?php echo esc_html($identity['species_name']); ?></h1>
                        <p class="setae-qr-profile-name"><?php echo esc_html($identity['title']); ?></p>
                        <p class="setae-qr-public-code">管理番号 <strong><?php echo esc_html($identity['code']); ?></strong></p>
                    </div>
                    <dl class="setae-qr-public-facts">
                        <div><dt>性別</dt><dd><?php echo esc_html($identity['gender']); ?></dd></div>
                        <div><dt>齢期</dt><dd><?php echo esc_html($identity['stage']); ?></dd></div>
                        <div><dt>由来</dt><dd><?php echo esc_html($identity['origin']); ?></dd></div>
                        <?php if ($identity['family_name']): ?><div><dt>科名</dt><dd><?php echo esc_html($identity['family_name']); ?></dd></div><?php endif; ?>
                    </dl>
                    <div class="setae-qr-profile-status"><span class="setae-public-status"><?php echo esc_html($passport['state_label']); ?></span></div>
                </div>
            </article>

            <div class="setae-qr-public-layout">
                <div class="setae-qr-public-primary">
                    <?php if ($passport['visitor_mode'] === 'life_history'): ?>
                        <section aria-labelledby="setae-passport-summary-title">
                            <div class="setae-qr-section-heading"><h2 id="setae-passport-summary-title">飼育概要</h2><p>公開されている記録から</p></div>
                            <dl class="setae-qr-public-stats">
                                <?php foreach ($passport['summary'] as $fact): ?><div><dt><?php echo esc_html($fact['label']); ?></dt><dd><?php echo esc_html($fact['value']); ?><?php if (!empty($fact['note'])): ?><small><?php echo esc_html($fact['note']); ?></small><?php endif; ?></dd></div><?php endforeach; ?>
                            </dl>
                            <dl class="setae-qr-care-summary">
                                <?php foreach ($passport['care_summary'] as $fact): ?><div><dt><?php echo esc_html($fact['label']); ?></dt><dd><?php echo esc_html($fact['value']); ?></dd></div><?php endforeach; ?>
                            </dl>
                            <p class="setae-qr-summary-note">公開対象の生活史と公開写真の範囲で表示しています。非公開の記録は含みません。</p>
                        </section>
                        <?php $setae_history = $passport['history']['items']; $setae_history_owner = false; require SETAE_PLUGIN_DIR . 'templates/public/passport-history.php'; ?>
                        <section class="setae-qr-public-gallery" aria-labelledby="setae-passport-gallery-title">
                            <div class="setae-qr-section-heading"><h2 id="setae-passport-gallery-title">写真記録</h2><p>写真<?php echo esc_html(number_format_i18n(count($passport['gallery']))); ?>点<?php if ($passport['hero']): ?> · 主写真を含む<?php endif; ?></p></div>
                            <?php if (count($passport['gallery']) > 1): ?>
                                <div class="setae-qr-gallery-grid">
                                    <?php foreach (array_slice($passport['gallery'], 1, null, true) as $index => $photo): ?>
                                        <button type="button" class="setae-qr-gallery-item js-setae-public-photo" data-public-photo-index="<?php echo esc_attr($index); ?>" aria-label="<?php echo esc_attr($photo['label'] . ($photo['display_date'] ? ' · ' . $photo['display_date'] : '') . 'を拡大'); ?>" aria-haspopup="dialog" aria-controls="setae-public-photo-dialog">
                                            <img class="setae-qr-gallery-media" src="<?php echo esc_url($photo['url']); ?>" alt="<?php echo esc_attr($identity['title'] . ' · ' . $photo['label']); ?>" width="4" height="3" loading="lazy" decoding="async">
                                            <span class="setae-qr-gallery-caption"><strong><?php echo esc_html($photo['label']); ?></strong><?php if ($photo['date']): ?><time datetime="<?php echo esc_attr($photo['date']); ?>"><?php echo esc_html($photo['display_date']); ?></time><?php endif; ?></span>
                                        </button>
                                    <?php endforeach; ?>
                                </div>
                            <?php else: ?><p class="setae-qr-empty-note"><?php echo $passport['hero'] ? '公開写真は主写真の1点です。' : '公開されている写真はまだありません。'; ?></p><?php endif; ?>
                        </section>
                    <?php else: ?>
                        <section class="setae-qr-basic-note" aria-labelledby="setae-passport-scope-title"><h2 id="setae-passport-scope-title">このパスポートについて</h2><p><?php echo $passport['visitor_mode'] === 'private' ? '個体情報は非公開です。このプレビューは所有者だけが確認できます。' : '所有者が公開している基本情報を表示しています。飼育履歴は公開されていません。'; ?></p></section>
                    <?php endif; ?>
                    <?php if ($passport['is_owner']): ?>
                        <section class="setae-qr-owner-only" aria-labelledby="setae-owner-records-title">
                            <div class="setae-qr-section-heading"><h2 id="setae-owner-records-title">所有者用の飼育概要</h2><span class="setae-public-status">所有者だけに表示</span></div>
                            <p>ここから下は訪問者には表示されません。</p>
                            <dl class="setae-qr-public-stats"><?php foreach ($passport['owner']['summary'] as $fact): ?><div><dt><?php echo esc_html($fact['label']); ?></dt><dd><?php echo esc_html($fact['value']); ?></dd></div><?php endforeach; ?></dl>
                            <dl class="setae-qr-care-summary"><?php foreach ($passport['owner']['care_summary'] as $fact): ?><div><dt><?php echo esc_html($fact['label']); ?></dt><dd><?php echo esc_html($fact['value']); ?></dd></div><?php endforeach; ?></dl>
                            <?php $setae_history = $passport['owner']['history']; $setae_history_owner = true; require SETAE_PLUGIN_DIR . 'templates/public/passport-history.php'; ?>
                        </section>
                    <?php endif; ?>
                </div>
                <aside class="setae-qr-public-side" aria-label="共有と引き継ぎ">
                    <?php if ($actions['transfer_enabled'] && !$passport['is_owner']): ?>
                        <?php require SETAE_PLUGIN_DIR . 'templates/public/passport-transfer-state.php'; ?>
                    <?php endif; ?>
                    <?php if ($passport['can_share']): ?>
                        <section class="setae-qr-side-section">
                            <h2><?php echo $passport['visitor_mode'] === 'transfer' ? '引き継ぎページを共有' : 'この個体を共有'; ?></h2>
                            <p>このQRの短いURLで、公開されている情報を届けられます。</p>
                            <div class="setae-qr-share-actions"><button type="button" class="setae-public-button is-default" data-setae-public-share><?php echo Setae_Public_Visual::icon('share'); ?>共有</button><button type="button" class="setae-public-button is-quiet" data-setae-public-copy><?php echo Setae_Public_Visual::icon('copy'); ?>URLをコピー</button></div>
                        </section>
                    <?php endif; ?>
                    <?php if (!$passport['is_owner']): ?>
                        <section class="setae-qr-side-section">
                            <h2>この個体の記録を、次の飼育者へ。</h2><p>QRから個体情報と公開された履歴を確認できます。引き継ぎが承認されると、購入後の記録も同じ個体パスポートに続けて残せます。</p>
                            <?php if (!$passport['is_logged_in'] && !$actions['transfer_enabled'] && $passport['registration']['enabled']): ?>
                                <a class="setae-public-button is-primary" href="<?php echo esc_url($actions['register_url']); ?>" data-public-register aria-haspopup="dialog" aria-controls="<?php echo esc_attr($passport['registration']['id']); ?>">SETAEで飼育を始める</a>
                            <?php else: ?><a class="setae-qr-public-link" href="<?php echo esc_url($actions['home_url']); ?>">SETAEについて<?php echo Setae_Public_Visual::icon('arrow-up-right'); ?></a><?php endif; ?>
                        </section>
                    <?php endif; ?>
                </aside>
            </div>
            <?php if ($passport['gallery']): ?><?php require SETAE_PLUGIN_DIR . 'templates/public/passport-photo-dialog.php'; ?><?php endif; ?>
        <?php endif; ?>
    </main>
    <footer class="setae-qr-public-footer"><p>SETAE · Living Specimen Passport</p><a class="setae-qr-public-link" href="<?php echo esc_url($actions['home_url']); ?>">SETAEを開く</a></footer>
    <p class="setae-qr-public-toast" data-setae-public-toast role="status" aria-live="polite" aria-atomic="true"></p>
</div>
