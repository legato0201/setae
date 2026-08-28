import { emptyState } from '../components/primitives.js';

export function renderPlaceholder(title, eyebrow, description) {
  return `
    <div class="page">
      <header class="page-header">
        <div>
          <div class="eyebrow">${eyebrow}</div>
          <h1>${title}</h1>
        </div>
      </header>
      ${emptyState(description)}
    </div>
  `;
}
