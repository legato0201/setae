# SETAE Visual Audit v1.0.241

Audit date: 2026-08-26  
Baseline: SETAE Core 1.0.240  
Direction: Natural History x Laboratory x Quiet Premium Workbench

## Method

The audit was completed before v1.0.241 visual changes. Evidence came from the v1.0.240 Light/Dark release screenshots at 390, 768, and wide desktop widths, the release harness, the product fixtures, and a source-level review of rendered markup and the CSS ownership map.

Each item below describes an observed issue, not a retrospective justification for a CSS change.

## Findings

| ID | Screen / scope | Category | Severity | Problem | Direction |
|---|---|---|---|---|---|
| VC-001 | Global | Typography | Blocker | `--font-ui` names Inter although no Inter asset is shipped. Rendering therefore varies by platform. | Use the explicit system UI stack and no external font dependency. |
| VC-002 | Global | Typography | High | Font weights 650, 680, 740, and 750 are mixed with 400/500/600/700. System fonts resolve those intermediate weights inconsistently. | Introduce four semantic weight tokens and map each role deliberately. |
| VC-003 | Global headings | Hierarchy | High | English eyebrow labels use zero tracking and often compete with Japanese headings instead of supporting them. | Give true eyebrows controlled tracking and remove repeated decorative eyebrows from ordinary subsections. |
| VC-004 | Metrics / registries | Alignment | High | Dates, IDs, counts, temperatures, humidity, and task totals do not share a complete tabular-numeral contract. | Apply one numeric typography contract to code, date, metric, and numeric value roles. |
| VC-005 | Global icons | Icon | Medium | Common icons are repeatedly sized at 16, 18, 20, and 24px without semantic roles. Optical centers vary between controls. | Add icon size tokens; size wrappers only so custom SVG fill/stroke remains intact. |
| VC-006 | Selection / focus | Control state | Blocker | Selected, multi-selected, and keyboard-focused states use screen-specific accent lines, outlines, and inset shadows. | Add selected background/border tokens; keep focus as the single 2px focus ring and checkboxes as multi-selection. |
| VC-007 | Overlay surfaces | Surface | High | Popover, modal, toast, update notice, and settings overlay shadows use several direct definitions. | Limit elevation to semantic overlay shadow tokens. |
| VC-008 | Row primitives | Spacing | Blocker | `.action-row` and related reusable rows use vertical padding with zero horizontal inset, allowing text and status to touch container rules. | Introduce normal and compact row inset tokens and assign inset ownership once. |
| VC-009 | Page layout | Alignment | High | Headers, toolbars, and bodies do not consistently share 16/24/32px page gutters. Several wide fixtures read as a narrow strip in a large canvas. | Define viewport gutter tokens and align page header, toolbar, and body starts. |
| VC-010 | Forms | Control state | High | Focus rings vary between a 2px/2px and 2px/3px contract and use `--accent` directly. Labels, hints, errors, and placeholders also lack one shared hierarchy. | Use `--focus-ring`, one offset, semantic label/hint/error rules, and a theme-aware placeholder token. |
| VC-011 | Buttons / async | Feedback | High | Busy feedback can replace labels without an explicit inline-size contract; button states are distributed across selectors. | Preserve the label region during busy state and define default, hover, pressed, focus, disabled, and busy consistently. |
| VC-012 | Motion | Motion | Medium | Existing transitions only expose fast/standard timing; overlay entrance, exit, and reduced-motion behavior are not expressed as a complete craft contract. | Add enter/exit/emphasized tokens and restrict movement to overlays and feedback. |
| VC-013 | Desktop App Rail | Navigation | High | The active item is indicated mainly by a thin left line; text and icon hierarchy are too close to hover/inactive states. | Combine the straight indicator with `--bg-selected`, primary text, and semibold weight. |
| VC-014 | Desktop App Rail | Spacing | Medium | Brand, primary navigation, library, divider, and account use slightly different inset and section rhythms. | Align labels and links; use 24px major and 12px footer rhythms. |
| VC-015 | Mobile App Bar / Navigation | Navigation | High | Active bottom-nav state is subtle and the record action reads as a separate raised control in some states. Brand/action optical sizes are not tokenized. | Use a 2px top indicator, accent icon, semibold label, equal item height, 22px brand mark, and 44px targets. |
| VC-016 | Page headers | Hierarchy | High | Header grammar varies between pages; title, metadata, tabs, and multiple equally strong actions do not always form one predictable sequence. | Standardize one visible h1, one primary action, optional secondary/menu, then tabs or toolbar. |
| VC-017 | Today | Density | High | Task rows are visually compressed, content sits near rules, counters do not align as a numeric set, and completed/upcoming states compete with due work. | Apply common task-row inset, align metrics, center row actions, and lower handled/upcoming emphasis. |
| VC-018 | Collection Registry | Control state | High | Selected rows use an accent edge but no selected background; hover and selected are not sufficiently distinct. Batch toolbar geometry can shift. | Use shared selected tokens while retaining neutral rules and stable toolbar height. |
| VC-019 | Collection Photo | Spacing | High | Caption content and status have insufficient edge breathing room; selected/focus treatment needs to belong to the photo frame rather than a transformed side marker. | Keep 4:3 geometry, add 12-16px caption inset, and separate selected frame from keyboard focus. |
| VC-020 | Collection Inspector | Hierarchy | Medium | Identity, metadata, and care actions have uneven section spacing. Several similarly strong actions compete near the bottom. | Preserve 300px width, establish one primary action, and route secondary actions through the existing menu. |
| VC-021 | Specimen Detail | Hierarchy | High | Photo, repeated identity, physical-label actions, and many English subsection eyebrows create competing visual anchors. Property label widths also vary. | Keep specimen identity primary, reduce decorative eyebrows, and unify property/ledger rhythm. |
| VC-022 | Specimen Intake | Spacing | High | Section navigation, form body, and footer are structurally sound but label/control/hint rhythm and active-section emphasis vary. | Use shared form rhythm, selected state, and a stable mobile footer boundary without cardifying sections. |
| VC-023 | Quick Record | Feedback | High | Launcher action rows inherit edge-tight spacing; selected specimen context and sticky footer boundary are weak, and busy layout stability is implicit. | Apply row inset, quiet identity context, explicit body/footer divider, stable busy width, and aligned stepper geometry. |
| VC-024 | Records | Alignment | High | Ledger marker/date/action baselines are loose and desktop content remains unnecessarily narrow. Mobile metadata and action compete in the same line. | Apply ledger grid/rhythm, tabular values, row inset, and responsive stacking without hiding data. |
| VC-025 | Nursery | Hierarchy | Medium | Registry rows are generally clear, but right-side living counts sit close to the edge and detail subsections repeat English eyebrows. Destructive actions can read like normal actions. | Apply shared row inset/rhythm, reduce eyebrow repetition, and keep mortality destructive only in context. |
| VC-026 | Husbandry | Density | High | Registry comparison is weakened by a narrow content column and loose alignment among code, status, occupancy, temperature, and humidity. | Use workspace width, shared registry inset, tabular environment metrics, and subdued archive/exit actions. |
| VC-027 | QR / Label Studio | Surface | High | App controls and the physical-paper preview are not always separated by a clear canvas hierarchy; label preview shadows use bespoke values. | Keep all physical geometry unchanged while giving the preview a quiet app canvas and tokenized overlay elevation. |
| VC-028 | Community | Hierarchy | Medium | Feed/topic/species rows use slightly different insets and metadata emphasis; species `.surface` ownership is inconsistent between photo and ordinary content. | Keep feed posts unframed, align content rows, and reserve surfaces for real photo frames. |
| VC-029 | Settings | Surface | High | Settings mostly follows unframed sections, but About still wraps ordinary sections in generic surfaces and active navigation uses a local inset shadow. | Remove decorative surfaces, use selected tokens, and align section save actions. |
| VC-030 | Auth | Alignment | High | Brand lockup, eyebrow, form width, and panel spacing are coherent but use local weight/geometry choices; the release-harness nav also visually intrudes on audit captures. | Reuse brand/typography tokens and common panel geometry at 320px and above. |
| VC-031 | Boot / Connection Error | Feedback | Medium | Brand and status/error are present, but loading and connection feedback do not yet share the same hierarchy and banner language. | Pair brand with concise state copy and shared loading/error feedback patterns. |
| VC-032 | Modal / Sheet / Update Notice | Motion | High | Elevation and entrance behavior are component-specific, and update feedback can feel detached from the overlay family. | Use overlay tokens, restrained 4-8px movement, and one reduced-motion contract. |
| VC-033 | Loading / Empty / Error | Feedback | High | Skeleton and empty/error treatments are structurally available but do not demonstrate registry, ledger, photo, property, and form-specific shapes together. | Add a visual craft harness with content-shaped skeletons and common empty/error hierarchy. |
| VC-034 | Global semantic color | Color | High | Light-theme secondary text, warning, and success tokens fall below a dependable 4.5:1 text contrast threshold on their normal surfaces. | Calibrate semantic colors and enforce Light/Dark contrast in the existing contrast test. |

## `.surface` inventory

| Location | Classification | Decision |
|---|---|---|
| Community species index photo | Photo surface | Keep; the surface frames media. |
| Community species detail image | Photo surface | Keep; the surface frames media and attribution. |
| Placeholder page empty state | Unnecessary | Remove the generic surface; the empty-state primitive owns spacing. |
| Settings application information | Unnecessary | Remove; ordinary settings sections remain unframed. |
| Settings rights information | Unnecessary | Remove; ordinary settings sections remain unframed. |
| Legacy care workspace wrapper | Unnecessary | Remove or neutralize; task groups and rules own the hierarchy. |

## Release validation boundary

Automated browser geometry, Light/Dark, state, contrast, and token contracts can be verified locally. Physical iPhone Safari/PWA date fields, installed-PWA update behavior, QR camera/image import, and A4/tape output require real devices. Until those results are recorded, v1.0.241 is a **CANDIDATE**, not FINAL.
