<?php
/** @var array $setae_context */
?>
<div class="setae-public-profile-page is-not-found">
    <header class="setae-public-profile-header">
        <div class="setae-public-profile-header-inner">
            <?php echo Setae_Public_Identity::render_brand(); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>
            <a class="setae-public-button setae-public-profile-button is-quiet" href="<?php echo esc_url($setae_context['home_url']); ?>">トップへ</a>
        </div>
    </header>
    <main class="setae-public-profile-not-found">
        <p class="setae-public-profile-eyebrow">KEEPER PROFILE</p>
        <h1>プロフィールが見つかりません</h1>
        <p>URLまたは紹介コードを確認してください。</p>
        <a class="setae-public-button setae-public-profile-button is-primary" href="<?php echo esc_url($setae_context['home_url']); ?>">SETAEトップへ</a>
    </main>
    <footer class="setae-public-profile-footer"><span>SETAE</span><span>Living Collection Ledger</span></footer>
</div>
