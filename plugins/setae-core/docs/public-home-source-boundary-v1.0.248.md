# Public Home source boundary — v1.0.248

## Scope

This release starts from `setae-core-1.0.247-wordpress.zip`. The archive contains the plugin, not a WordPress theme. It does not contain the main Marketing Home document. The Care Share and Partner migrations do not authorize a redesign of Marketing Home.

## Files confirmed inside the plugin

| File | Responsibility |
| --- | --- |
| `assets/css/public-home.css` | Marketing Home styles; it is not the page's HTML source. |
| `assets/css/public-foundation.css` | Shared public tokens and primitives. New Care Share and Partner document rules must remain scoped. |
| `includes/frontend/class-setae-public-home.php` | Detects the public front page and enqueues its Foundation and Home styles. It also exposes the separate public-surface enqueue methods. |
| `includes/class-setae-core.php` | Registers public controllers and their WordPress hooks. |
| `includes/frontend/class-setae-app-shell.php` | Existing app entry and login URL contracts used by Home and the public surfaces. |
| `assets/css/setae-global.css` | Existing global stylesheet; not a substitute source for Marketing Home markup. |

The plugin's `templates/public/` documents belong to Profile, Passport, Care Share, and Partner. None is a new Marketing Home template.

## Sources outside the plugin archive

The workspace contains `wp-content/themes/setae-theme/index.php`. Its front-page branch includes Marketing Home markup, WordPress queries, and links to registration, public content, and Partner. Related files include the theme's `header.php`, `footer.php`, `functions.php`, and styles/assets. These files are outside the specified plugin release archive.

Their presence in the workspace does not establish that this exact theme revision is active on the production site. A parent theme, child theme, assigned page template, stored page content, or WordPress front-page setting may affect the deployed Home. No deployed-theme equivalence was assumed in v1.0.248.

## Inputs required for a future Home redesign

Obtain the active parent/child theme names and exact source revisions, the actual front-page template and its referenced template parts, and the corresponding header, footer, stylesheet, and asset sources. Confirm the WordPress front-page assignment and provide only the relevant public page content and configuration, with private data removed. Confirm which plugin shortcodes or blocks the template invokes and the intended Home registration and login behavior.

Only after that source boundary is confirmed should Marketing Home be redesigned and checked against its actual rendered HTML. That is a separate task from this release.

## Boundaries preserved in v1.0.248

- Do not redesign or append speculative overrides to `public-home.css` or `setae-global.css`.
- Do not change theme Home markup, header/footer, theme assets, or front-page configuration.
- Do not replace or infer the Marketing Home document from a screenshot, stylesheet, or one of the other public templates.
- Do not change existing routes, query variables, referral codes, public handles, registration payloads, or app entry URLs as part of Home styling.
- Shared Foundation additions for Care Share and Partner must not change Home's page-specific layout or force Home to adopt the new dedicated documents.

The v1.0.248 dedicated documents and removal of the old Care Share/Partner assets are limited to those two migrated surfaces. Marketing Home remains outside this redesign.
