import { escapeHtml, genderLabel, safeHttpUrl } from '../components/ui.js';
import { mediaImage, renderMediaFrame } from '../components/media.js';
import {
  emptyBlock,
  excerpt,
  formatDate,
  list,
  loadingBlock
} from '../components/content.js';
import {
  actionRow,
  button,
  contentAction,
  emptyState,
  fileField,
  linkButton,
  searchControl,
  selectControl,
  tabPanel,
  tabs,
  textButton,
  textareaField
} from '../components/primitives.js';

export function renderCommunity({ tab = 'care', authenticated = false, data = {}, loading = false }) {
  const availableTabs = authenticated
    ? [['care', 'お世話フィード'], ['topics', '相談'], ['breeding', '繁殖募集'], ['species', '図鑑']]
    : [['topics', '相談'], ['breeding', '繁殖募集'], ['species', '図鑑']];
  const active = availableTabs.some(([key]) => key === tab) ? tab : 'topics';
  let content;
  if (loading) content = loadingBlock('交流データを読み込み中…', 'ledger');
  else if (data.error) content = emptyState('', {
    title: [401, 403].includes(Number(data.error.status)) ? 'この内容を表示する権限がありません' : '交流の内容を読み込めませんでした',
    description: [401, 403].includes(Number(data.error.status)) ? 'ログイン状態を確認してください。' : '通信環境を確認して、もう一度読み込んでください。',
    reason: [401, 403].includes(Number(data.error.status)) ? 'permission' : 'error',
    iconName: [401, 403].includes(Number(data.error.status)) ? 'lock' : 'warning',
    action: [401, 403].includes(Number(data.error.status)) ? 'show-login' : 'retry-community',
    actionLabel: [401, 403].includes(Number(data.error.status)) ? 'ログイン' : '再読み込み',
    primary: true
  });
  else if (active === 'care') content = data.careDetail
    ? renderCareDetail(data.careDetail, authenticated)
    : renderCareFeed(data.careFeed, data.careFilters);
  else if (active === 'species') content = data.speciesDetail
    ? renderSpeciesDetail(data.speciesDetail, authenticated)
    : renderSpeciesList(data.species, data.speciesSearch);
  else if (active === 'breeding') content = renderBreedingBoard(data.breedingListings);
  else content = data.topicDetail
    ? renderTopicDetail(data.topicDetail, authenticated)
    : renderTopicList(data.topics, data.topicFilters, authenticated);

  return `
    <div class="page community-page">
      <header class="page-header compact-header">
        <div><div class="eyebrow">交流</div><h1>${active === 'care' ? 'お世話フィード' : active === 'species' ? '図鑑' : active === 'breeding' ? '繁殖募集' : '相談'}</h1></div>
        <div class="community-header-actions">${active === 'topics' && authenticated && !data.topicDetail ? button('相談を投稿', { action: 'new-topic', primary: true }) : ''}${!authenticated ? button('ログイン', { action: 'show-login', primary: true }) : ''}</div>
      </header>
      ${tabs(availableTabs.map(([id, label]) => ({ id, label })), {
    activeId: active,
    action: 'community-tab',
    dataKey: 'tab',
    label: '交流画面',
    className: 'community-tabs',
    idPrefix: 'community',
    panelId: 'community-tabpanel'
  })}
      ${tabPanel(content, {
    id: 'community-tabpanel',
    idPrefix: 'community',
    activeId: active,
    className: 'section community-content',
    tag: 'div'
  })}
    </div>
  `;
}

function renderBreedingBoard(data) {
  const items = list(data, ['items', 'candidates'])
    .map((item) => ({ ...item, contactUrl: httpsContactUrl(item.contact_url || item.breeding_contact_url) }))
    .filter((item) => item.contactUrl);
  return `
    <div class="breeding-board-intro">
      <div><div class="eyebrow">繁殖募集</div><strong>繁殖協力を募集している個体</strong></div>
      <p>募集者との連絡や条件調整は、各募集に掲載された外部連絡先で行います。SETAE内に申請・個別メッセージ機能はありません。</p>
    </div>
    ${items.length ? `<div class="breeding-listing-list">${items.map(renderBreedingListing).join('')}</div>` : emptyBlock('現在公開されている繁殖募集はありません。')}
  `;
}

function renderBreedingListing(item) {
  const species = item.species_name || item.species || '種類不明';
  const title = item.spider_name || item.name || item.title || '個体';
  const image = safeHttpUrl(item.image || item.thumb);
  return `
    <article class="breeding-listing-row">
      <div class="breeding-listing-media">${renderMediaFrame({ src: image, alt: title, scientificName: species, classification: item.classification, ratio: 'card', compact: true })}</div>
      <div class="breeding-listing-body">
        <div class="breeding-listing-heading"><div><span class="eyebrow">繁殖募集</span><strong>${escapeHtml(title)}</strong><em>${escapeHtml(species)}</em></div><span class="status-chip">募集中</span></div>
        <dl class="breeding-listing-facts">
          <div><dt>性別</dt><dd>${escapeHtml(genderLabel(item.gender))}</dd></div>
          <div><dt>最終脱皮</dt><dd>${escapeHtml(item.last_molt ? formatDate(item.last_molt) : '未記録')}</dd></div>
        </dl>
        ${item.bl_terms || item.terms ? `<p class="breeding-listing-terms">${escapeHtml(item.bl_terms || item.terms)}</p>` : ''}
        <div class="breeding-listing-owner"><span>募集者</span><strong>${escapeHtml(item.owner_name || '利用者')}</strong></div>
        ${linkButton(item.contact_label || '外部連絡先を開く', { href: item.contactUrl, iconName: 'externalLink', className: 'breeding-contact-action', external: true })}
      </div>
    </article>
  `;
}

function httpsContactUrl(value) {
  const url = safeHttpUrl(value);
  if (!url) return '';
  try {
    return new URL(url).protocol === 'https:' ? url : '';
  } catch {
    return '';
  }
}

function renderCareFeed(data, filters = {}) {
  const items = list(data, ['items']);
  const filtered = (filters.scope || 'all') !== 'all';
  return `
    <div class="community-filter-row">
      ${selectControl({
    value: filters.scope || 'all',
    label: '表示',
    role: 'care-scope',
    options: [
      { value: 'all', label: 'すべて' },
      { value: 'following', label: 'フォロー中' },
      { value: 'mine', label: '自分の投稿' }
    ]
  })}
      ${selectControl({
    value: filters.sort || 'active',
    label: '並び順',
    role: 'care-sort',
    options: [
      { value: 'active', label: '更新順' },
      { value: 'new', label: '投稿日順' }
    ]
  })}
    </div>
    <output class="community-result-count" aria-live="polite">${items.length}件${filtered ? ` · 表示：${filters.scope === 'mine' ? '自分の投稿' : 'フォロー中'}` : ''}</output>
    ${items.length ? `<div class="feed-stream">${items.map(renderCareEntry).join('')}</div>` : emptyState('', {
      title: filtered ? 'この表示条件の共有記録はありません' : '共有記録はまだありません',
      description: filtered ? '表示条件を「すべて」に戻してください。' : 'お世話記録を共有すると、ここに表示されます。',
      reason: filtered ? 'filtered' : 'initial',
      iconName: 'community',
      action: filtered ? 'clear-care-filters' : '',
      actionLabel: filtered ? 'すべて表示' : ''
    })}
  `;
}

function renderCareEntry(item) {
  const author = item.author || {};
  const image = safeHttpUrl(item.image || item.fallback_image);
  const contentHtml = `<div class="discussion-author feed-entry-head">${avatar(author.avatar, author.initial || author.name)}<div><strong>${escapeHtml(author.name || '利用者')}</strong><span>${formatDate(item.last_activity_at || item.created_at, true)}</span></div><span class="status-chip">${escapeHtml(item.type_label || item.type || '記録')}</span></div><div class="feed-entry-subject"><strong>${escapeHtml(item.spider?.title || '個体')}</strong><em>${escapeHtml(item.spider?.species_name || '')}</em></div>${item.note ? `<p>${escapeHtml(item.note)}</p>` : ''}${image ? mediaImage({ src: image, alt: '', className: 'feed-image', width: 1200, height: 900 }) : ''}`;
  return `<article class="feed-entry">${contentAction({
    contentHtml,
    action: 'open-care-feed',
    data: { 'feed-id': item.id },
    className: 'feed-entry-main',
    ariaLabel: `${author.name || '利用者'}の${item.type_label || item.type || '記録'}を開く`
  })}<div class="discussion-actions">${renderReactions(item.reactions, item.id, 'care-react')}${textButton(`コメント ${item.comment_count || 0}`, { action: 'open-care-feed', data: { 'feed-id': item.id } })}</div></article>`;
}

function renderCareDetail(data, authenticated) {
  const item = data.item || data;
  const comments = list(data.comments || item.comments, ['items']);
  const author = item.author || {};
  const image = safeHttpUrl(item.image || item.fallback_image);
  return `
    <div class="detail-back-row">${textButton('フィードへ戻る', { action: 'close-care-feed', className: 'back-action' })}</div>
    <article class="feed-article">
      <div class="discussion-author feed-entry-head">${avatar(author.avatar, author.initial || author.name)}<div><strong>${escapeHtml(author.name || '利用者')}</strong><span>${formatDate(item.created_at, true)}</span></div><span class="status-chip">${escapeHtml(item.type_label || item.type)}</span></div>
      ${authenticated ? socialActions(author.id || item.author_id, item.can_manage, author.following || item.viewer_following) : ''}
      <div class="feed-entry-subject"><strong>${escapeHtml(item.spider?.title || '個体')}</strong><em>${escapeHtml(item.spider?.species_name || '')}</em></div>
      ${item.note ? `<p class="detail-copy">${escapeHtml(item.note)}</p>` : ''}
      ${image ? mediaImage({ src: image, alt: '', className: 'feed-image detail-image', loading: 'eager', fetchPriority: 'high', width: 1200, height: 900 }) : ''}
      <div class="discussion-actions">${renderReactions(item.reactions, item.id, 'care-react')}${item.can_manage ? textButton('共有を解除', { action: 'unshare-care', data: { 'feed-id': item.id }, danger: true }) : textButton('通報', { action: 'report-care', data: { 'feed-id': item.id } })}</div>
    </article>
    <section class="discussion-section">
      <div class="section-header"><div class="section-title">コメント</div><span class="secondary">${escapeHtml(data.comments?.total ?? comments.length)}件</span></div>
      <div class="comment-thread">
        ${comments.length ? comments.map(renderCareComment).join('') : '<div class="empty-state">まだコメントはありません。</div>'}
        <form class="comment-form" data-role="care-comment-form" data-draft-policy="guard" data-feed-id="${escapeHtml(item.id)}">
          ${textareaField({ label: 'コメント', name: 'content', maxLength: 1000, required: true, placeholder: 'コメントを書く', rows: 3, className: 'comment-field' })}
          ${button('投稿する', { type: 'submit', primary: true })}
        </form>
      </div>
    </section>
  `;
}

function renderCareComment(comment) {
  const author = comment.author || {};
  return `
    <article class="comment-item ${comment.parent_id ? 'is-reply' : ''}">
      ${avatar(author.avatar, author.initial || author.name)}
      <div><div class="comment-meta"><strong>${escapeHtml(author.name || '利用者')}</strong><span>${formatDate(comment.date, true)}</span></div>${comment.parent_author ? `<span class="reply-label">${escapeHtml(comment.parent_author)}さんへの返信</span>` : ''}<p>${escapeHtml(comment.content)}</p><div class="comment-inline-actions">${textButton('返信', { action: 'reply-care-comment', data: { 'comment-id': comment.id, author: author.name || '' } })}${comment.can_delete ? textButton('削除', { action: 'delete-care-comment', data: { 'comment-id': comment.id }, danger: true }) : textButton('通報', { action: 'report-care-comment', data: { 'comment-id': comment.id } })}</div></div>
    </article>
  `;
}

function renderTopicList(data, filters = {}, authenticated) {
  const items = list(data, ['items']);
  const hasFilters = Boolean(String(filters.search || '').trim() || filters.type);
  return `
    <form class="community-filter-row topic-filter" data-role="topic-search-form">
      ${searchControl({ name: 'search', value: filters.search || '', placeholder: '相談を検索', label: '相談を検索', clearAction: filters.search ? 'clear-topic-filters' : '', clearLabel: '相談の検索条件をクリア' })}
      ${selectControl({ name: 'type', value: filters.type || '', label: '相談の種類', options: [
    { value: '', label: 'すべての種類' },
    { value: 'question', label: '質問' },
    { value: 'breeding', label: '飼育' },
    { value: 'other', label: 'その他' }
  ] })}
      ${selectControl({ name: 'sort', value: filters.sort || 'updated', label: '並び順', options: [
    { value: 'updated', label: '更新順' },
    { value: 'newest', label: '新着順' },
    { value: 'momentum', label: '活発順' }
  ] })}
      ${button('検索', { type: 'submit' })}
    </form>
    ${!authenticated ? '<div class="public-notice">相談と図鑑はログインせず閲覧できます。投稿するにはログインしてください。</div>' : ''}
    <output class="community-result-count" aria-live="polite">${items.length}件${filters.type ? ` · 種類：${escapeHtml(topicType(filters.type))}` : ''}${filters.search ? ` · 検索：${escapeHtml(filters.search)}` : ''}</output>
    ${items.length ? `<div class="topic-registry">${items.map(renderTopicRow).join('')}</div>` : emptyState('', {
      title: hasFilters ? '条件に一致する相談はありません' : '相談はまだ投稿されていません',
      description: hasFilters ? '検索語または相談の種類を変更してください。' : authenticated ? '飼育で迷っていることを投稿できます。' : '投稿を始めるにはログインしてください。',
      reason: hasFilters ? 'filtered' : authenticated ? 'initial' : 'permission',
      iconName: hasFilters ? 'search' : 'community',
      action: hasFilters ? 'clear-topic-filters' : authenticated ? 'new-topic' : 'show-login',
      actionLabel: hasFilters ? '条件をクリア' : authenticated ? '相談を投稿' : 'ログイン',
      primary: !hasFilters
    })}
  `;
}

function renderTopicRow(topic) {
  const responseCount = Number(topic.comment_count || 0);
  const contentHtml = `<div class="topic-registry-main"><div class="topic-meta"><span>${escapeHtml(topicType(topic.type))}</span>${topic.is_resolved ? '<span class="resolved-label">解決済み</span>' : ''}<span>最新更新 ${formatDate(topic.updated_at || topic.date, true)}</span></div><h2>${escapeHtml(topic.title)}</h2><p>${escapeHtml(excerpt(topic.excerpt, 160))}</p><div class="author-inline">${avatar(topic.author_avatar, topic.author_initial || topic.author_name)}<span>${escapeHtml(topic.author_name || '利用者')}</span></div></div><div class="topic-response-count"><strong>${escapeHtml(responseCount)}</strong><span>返信</span></div>`;
  return contentAction({
    contentHtml,
    action: 'open-topic',
    data: { 'topic-id': topic.id },
    className: 'topic-registry-row',
    ariaLabel: `${topic.title}、${responseCount}件の返信`
  });
}

function renderTopicDetail(topic, authenticated) {
  const comments = list(topic, ['comments']);
  return `
    <div class="detail-back-row">${textButton('相談一覧へ戻る', { action: 'close-topic', className: 'back-action' })}</div>
    <article class="topic-article">
      <div class="topic-meta"><span>${escapeHtml(topicType(topic.type))}</span>${topic.is_resolved ? '<span class="resolved-label">解決済み</span>' : ''}<span>${formatDate(topic.updated_at || topic.date, true)}</span></div>
      <h1>${escapeHtml(topic.title)}</h1>
      <div class="author-inline">${avatar(topic.author_avatar, topic.author_initial || topic.author_name)}<span>${escapeHtml(topic.author_name || '利用者')}</span></div>
      ${authenticated ? socialActions(topic.author_id || topic.author?.id, topic.can_manage, topic.viewer_following || topic.author?.following) : ''}
      ${safeHttpUrl(topic.image) ? mediaImage({ src: topic.image, alt: topic.image_alt || '', className: 'topic-image', loading: 'eager', fetchPriority: 'high', width: 1200, height: 900 }) : ''}
      <p class="detail-copy preserve-lines">${escapeHtml(excerpt(topic.content, 10000))}</p>
      ${authenticated ? `<div class="discussion-actions">${renderReactions(topic.reactions, topic.id, 'topic-react')}${topic.can_manage ? textButton(topic.is_resolved ? '未解決へ戻す' : '解決済みにする', { action: 'topic-status', data: { 'topic-id': topic.id, status: topic.is_resolved ? 'open' : 'resolved' } }) : ''}</div>` : ''}
    </article>
    <section class="discussion-section">
      <div class="section-header"><div class="section-title">返信</div><span class="secondary">${comments.length}件</span></div>
      <div class="comment-thread">
        ${comments.length ? comments.map((comment) => renderTopicComment(comment, topic)).join('') : '<div class="empty-state">まだ返信はありません。</div>'}
        ${authenticated ? `<form class="comment-form has-file" data-role="topic-comment-form" data-draft-policy="guard" data-topic-id="${escapeHtml(topic.id)}">${textareaField({ label: '返信', name: 'content', maxLength: 1000, required: true, placeholder: '返信を書く', rows: 3, className: 'comment-field' })}${fileField({ label: '写真', name: 'image', accept: 'image/*', buttonLabel: '写真を選ぶ', className: 'comment-file' })}${button('投稿する', { type: 'submit', primary: true })}</form>` : `<div class="login-prompt"><span>返信するにはログインしてください。</span>${button('ログイン', { action: 'show-login', primary: true })}</div>`}
      </div>
    </section>
  `;
}

function renderTopicComment(comment, topic) {
  return `
    <article class="comment-item ${comment.is_best_answer ? 'is-best' : ''}">
      ${avatar(comment.author_avatar, comment.author_initial || comment.author_name)}
      <div><div class="comment-meta"><strong>${escapeHtml(comment.author_name || '利用者')}</strong><span>${formatDate(comment.date, true)}</span>${comment.is_best_answer ? '<span class="resolved-label">ベスト回答</span>' : ''}</div><p class="preserve-lines">${escapeHtml(excerpt(comment.content, 5000))}</p>${safeHttpUrl(comment.image) ? mediaImage({ src: comment.image, alt: '', className: 'comment-image', width: 800, height: 600 }) : ''}<div class="discussion-actions">${renderReactions(comment.reactions, comment.id, 'topic-comment-react')}${topic.can_manage ? textButton(comment.is_best_answer ? 'ベスト回答を解除' : 'ベスト回答', { action: 'best-answer', data: { 'topic-id': topic.id, 'comment-id': comment.is_best_answer ? 0 : comment.id } }) : ''}</div></div>
    </article>
  `;
}

function renderSpeciesList(data, search = '') {
  const items = list(data, ['items']);
  return `
    <form class="community-filter-row species-filter" data-role="species-search-form">
      ${searchControl({ name: 'search', value: search, placeholder: '学名・和名で検索', label: '図鑑を検索', clearAction: search ? 'clear-species-search' : '', clearLabel: '図鑑の検索条件をクリア' })}
      ${button('検索', { type: 'submit' })}
    </form>
    <output class="community-result-count" aria-live="polite">${items.length}件${search ? ` · 検索：${escapeHtml(search)}` : ''}</output>
    ${items.length ? `<div class="species-photo-index">${items.map(renderSpeciesIndexItem).join('')}</div>` : emptyState('', {
      title: search ? '条件に一致する図鑑データはありません' : '図鑑データはまだありません',
      description: search ? '学名または和名を変更してください。' : '公開できる図鑑データが追加されると、ここに表示されます。',
      reason: search ? 'filtered' : 'initial',
      iconName: search ? 'search' : 'collection',
      action: search ? 'clear-species-search' : '',
      actionLabel: search ? '検索をクリア' : ''
    })}
  `;
}

function renderSpeciesIndexItem(species) {
  const image = speciesImage(species);
  const commonName = species.ja_name || species.common_name_ja || species.title;
  const scientificName = species.scientific_name || species.title;
  const tags = (species.lifestyles || []).map((term) => `<span>${escapeHtml(term.name || term)}</span>`).join('');
  const contentHtml = `<div class="species-index-photo surface">${renderMediaFrame({ src: image.url, alt: image.alt, scientificName, ratio: 'card', compact: true })}</div><div class="species-index-caption"><strong>${escapeHtml(commonName)}</strong><em>${escapeHtml(scientificName)}</em><div class="species-tags">${tags}${species.temperature ? `<span>${escapeHtml(species.temperature)}℃</span>` : ''}</div></div>`;
  return `<article class="species-index-item">${contentAction({
    contentHtml,
    action: 'open-species',
    data: { 'species-id': species.id },
    className: 'species-index-open',
    ariaLabel: `${commonName}、${scientificName}を開く`
  })}${speciesAttribution(image, 'species-image-credit')}</article>`;
}

function renderSpeciesDetail(species, authenticated) {
  const sources = list(species.research, ['sources']).filter((source) => safeHttpUrl(source.url));
  const relatedTopics = list(species.related_topics, ['items']);
  const shops = list(species._ads, ['shops']).filter((shop) => safeHttpUrl(shop.url));
  const image = speciesImage(species);
  return `
    <div class="detail-back-row">${textButton('図鑑へ戻る', { action: 'close-species', className: 'back-action' })}</div>
    <article class="species-detail-layout">
      <aside>
        <div class="surface species-detail-image">${renderMediaFrame({ src: image.url, alt: image.alt, scientificName: species.scientific_name || species.title, attribution: speciesAttributionContent(image), ratio: 'exhibit' })}</div>
        <dl class="detail-metrics">
          ${detailMetric('温度', species.temperature ? `${species.temperature}℃` : '')}
          ${detailMetric('湿度', species.humidity ? `${species.humidity}%` : '')}
          ${detailMetric('大きさ', species.size)}
          ${detailMetric('寿命', species.lifespan)}
          ${detailMetric('生活様式', species.lifestyle)}
          ${detailMetric('生息地', species.habitat)}
        </dl>
      </aside>
      <div class="species-detail-content">
        <div class="eyebrow">自然史図鑑</div>
        <h1>${escapeHtml(species.ja_name || species.common_name_ja || species.title)}</h1>
        <div class="detail-scientific">${escapeHtml(species.scientific_name || species.title)}</div>
        ${species._stats ? `<div class="species-community-stat"><strong>${escapeHtml(species._stats.keeping_count || 0)}</strong><span>人がこの種を飼育中</span></div>` : ''}
        <p class="detail-copy preserve-lines">${escapeHtml(excerpt(species.description || species.excerpt, 12000))}</p>
        ${relatedTopics.length ? `<section class="section"><div class="section-header"><div class="section-title">この種の相談</div></div><div class="related-topic-list">${relatedTopics.map((topic) => actionRow({ label: topic.title, trailingLabel: `${topic.comment_count || 0}件の返信`, action: 'open-topic', data: { 'topic-id': topic.id } })).join('')}</div></section>` : ''}
        ${shops.length ? `<section class="section"><div class="section-header"><div class="section-title">取扱情報</div><span class="secondary">承認済みショップ</span></div><div class="shop-list">${shops.map((shop) => `<a class="shop-item" href="${escapeHtml(safeHttpUrl(shop.url))}" target="_blank" rel="noopener sponsored">${safeHttpUrl(shop.image) ? mediaImage({ src: shop.image, alt: '', width: 96, height: 96 }) : ''}<span><strong>${escapeHtml(shop.shop_name)}</strong><small>${escapeHtml([shop.price_label, shop.stock_label].filter(Boolean).join(' / '))}</small><em>${escapeHtml(shop.cta_label || '販売情報を見る')}</em></span></a>`).join('')}</div></section>` : ''}
        ${sources.length ? `<section class="section"><div class="section-header"><div class="section-title">参考資料</div></div><div class="source-list">${sources.map((source) => `<a href="${escapeHtml(safeHttpUrl(source.url))}" target="_blank" rel="noopener"><strong>${escapeHtml(source.title)}</strong><span>${escapeHtml([source.authors?.join(', '), source.year].filter(Boolean).join(' / '))}</span></a>`).join('')}</div></section>` : ''}
        ${authenticated ? `<section class="section"><div class="section-header"><div class="section-title">情報修正を提案</div></div><form class="species-suggestion-form" data-role="species-suggestion-form" data-draft-policy="persist" data-draft-type="species-suggestion" data-species-id="${escapeHtml(species.id)}">${textareaField({ label: '説明・修正内容', name: 'suggested_description', maxLength: 2000, required: true, rows: 5 })}${button('提案を送信', { type: 'submit' })}</form></section>${button('この種で個体登録', { action: 'register-from-species', data: { 'species-id': species.id }, primary: true })}` : `<div class="login-prompt"><span>修正提案や個体登録にはログインしてください。</span>${button('ログイン', { action: 'show-login', primary: true })}</div>`}
      </div>
    </article>
  `;
}

function speciesImage(species = {}) {
  const representative = species.representative_image || {};
  return {
    url: safeHttpUrl(representative.url || species.thumb),
    alt: representative.alt || species.scientific_name || species.title || '',
    credit: representative.credit || species.image_credit || {},
    source_url: safeHttpUrl(representative.source_url),
    license: representative.license || {},
    changes: representative.changes || ''
  };
}

function speciesAttribution(image = {}, className = 'media-attribution') {
  const content = speciesAttributionContent(image);
  return content ? `<div class="${escapeHtml(className)}">${content}</div>` : '';
}

function speciesAttributionContent(image = {}) {
  const creditText = String(image.credit?.text || '').trim();
  const sourceUrl = safeHttpUrl(image.source_url);
  const licenseLabel = String(image.license?.label || '').trim();
  const licenseUrl = safeHttpUrl(image.license?.url);
  if (!creditText && !sourceUrl && !licenseLabel && !image.changes) return '';
  const credit = creditText
    ? (sourceUrl ? `<a href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(creditText)}</a>` : escapeHtml(creditText))
    : '';
  const license = licenseLabel
    ? (licenseUrl ? `<a href="${escapeHtml(licenseUrl)}" target="_blank" rel="license noopener noreferrer">${escapeHtml(licenseLabel)}</a>` : escapeHtml(licenseLabel))
    : '';
  const source = sourceUrl && !creditText
    ? `<a href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener noreferrer">Source</a>`
    : '';
  return [credit ? `Photo: ${credit}` : '', license, source, image.changes ? `Changes: ${escapeHtml(image.changes)}` : ''].filter(Boolean).join(' · ');
}

function renderReactions(reactions = {}, id, action) {
  return Object.entries(reactions || {}).map(([key, reaction]) => button(`${reaction.label || key} ${reaction.count || 0}`, {
    action,
    className: `reaction-button ${reaction.active ? 'is-active' : ''}`,
    data: { 'target-id': id, reaction: key }
  })).join('');
}

function socialActions(userId, isMine, following) {
  if (!userId || isMine) return '';
  return `<div class="social-inline-actions">${textButton(following ? 'フォロー中' : 'フォロー', { action: following ? 'unfollow-inline' : 'follow-user', data: { 'user-id': userId } })}${textButton('ブロック', { action: 'request-block-user', data: { 'user-id': userId }, danger: true })}</div>`;
}

function avatar(url, initial) {
  const avatarUrl = safeHttpUrl(url);
  return avatarUrl
    ? mediaImage({ src: avatarUrl, alt: '', className: 'author-avatar', width: 40, height: 40 })
    : `<span class="author-avatar author-initial" aria-hidden="true">${escapeHtml(String(initial || '?').slice(0, 1))}</span>`;
}

function detailMetric(label, value) {
  return `<div class="detail-metric-row"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value || '—')}</dd></div>`;
}

function topicType(type) {
  return ({ question: '質問', breeding: '飼育', identification: '同定', chat: '雑談', other: 'その他' })[type] || '相談';
}
