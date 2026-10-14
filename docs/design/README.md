# UI design

The requester supplied this design on 2026-10-15 ("this will be the ui design") as a Stitch export called _CatalystCore Analytics Dashboard_. It is saved here as it came. D-030 in `DECISIONS.md` says how it is used.

The design is the **look and the shell**. It is not the scope: the PRD still decides what V1 contains (D-001), and the product rules in `AGENTS.md` win wherever the design disagrees with them.

## Files

| Path                          | What it is                                                                                       |
| ----------------------------- | ------------------------------------------------------------------------------------------------ |
| `DESIGN.md`                   | The design system: colors, type, spacing, elevation, shapes, components. Read this first.        |
| `screens/*.png`               | One screenshot per screen (list below).                                                          |
| `reference/*.html`            | Stitch's HTML for each screen. Use it to check spacing and structure. Do not copy it into the app. |

The reference HTML loads the Tailwind CDN script and the Material Symbols icon font and carries made-up names and numbers. The app uses Tailwind 4 with CSS-variable tokens and inline SVG icons, so nothing from the HTML is imported.

## Screens and the phase that builds them

| Design screen                       | Screenshot                   | Our screen                                                                          | Phase     |
| ----------------------------------- | ---------------------------- | ----------------------------------------------------------------------------------- | --------- |
| Overview                            | `screens/overview.png`       | Overview: KPI row, users chart, acquisition summary, app table                      | P3        |
| Products                            | `screens/products.png`       | Apps: list, add, edit (admin), connection state                                     | **P2**    |
| Product detail (Grind Quest)        | `screens/product-detail.png` | App detail: users, growth chart with timeline markers, retention and cohort matrix  | P3        |
| Audience and Retention              | `screens/audience-retention.png` | Cohort matrix and retention curves, inside App detail (a portfolio view is optional) | P3        |
| Performance Reports and Exports     | `screens/reports.png`        | Weekly report preview, stored reports, PDF and CSV                                  | P8        |
| Data Connections and Telemetry      | `screens/settings-connections.png` | Settings: GA4 connection status and test (P4), studio settings (P10); Users stays as built in P1 | P4, P10   |

## What we take from it

- **Shell.** Fixed 240px left rail (brand tile, menu, footer), 56px top bar (studio name and page, data-source pill, date range control, signed-in person), content up to 1600px wide, 16px outer margin on phones and 32px on desktop. Below the desktop width the rail becomes a row of links under the top bar.
- **Look.** Cool slate neutrals, one indigo accent, teal for positive movement, amber for warnings, rose for errors. Borders first, only light shadows. Radius 12px for cards, 10px for buttons and fields, 6px for chips; circles only for avatars and status dots. Controls are 36px high, table rows 44px.
- **Type.** Inter for text, JetBrains Mono for identifiers (package names, IDs), tabular numbers wherever numbers line up.
- **Icons.** 1.5px stroke, 16px inline and 20px in the menu. Drawn as inline SVG, so there is no icon font or extra dependency.
- **Patterns.** Metric cards (label, big number, change, comparison text), the segmented date range control, status chips, banded cohort heatmap, the "sample data" pill.

The tokens live in `apps/web/src/index.css` (names such as `bg-canvas`, `bg-surface`, `text-fg`, `border-line`, `bg-accent`), for light and dark. Components use tokens only.

## Where we differ, and why

| Design                                         | Here                                                                                      | Why                                                                                  |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Light theme only                               | Light and dark, with a toggle (system by default). The dark palette is derived from the light one. | The requester asked for both; `AGENTS.md` requires both.                          |
| "Products"                                     | "Apps"                                                                                    | The PRD's word and the code's (`apps`). One label to change if "Products" is preferred. |
| "CatalystCore Studios", "Alex Vance", "CatalystCore OS v1.0.4", the logo image | Studio name and logo from `settings/studio`; the person and role from the session; no version line | D-019: nothing is hard-coded to one studio.                                  |
| Menu with Audience, Retention, Revenue, Quality & Stability | Menu lists only screens that exist                                               | Retention lives in App detail; Revenue and Quality are not in V1.                    |
| "Sample studio dataset active"                 | "Demo data", in the same place and style                                                  | D-003 names the label.                                                               |
| "Firebase & Play Console Synced 12m ago", "All sources healthy" | Shows the real state of the active data source, or nothing                  | No claim without data.                                                               |

## What we do not build

Each item is either outside the PRD's V1 or breaks a product rule. If the requester wants any of them, it is a scope change (PRD section 22, V2).

- **Revenue, in-app purchases, AdMob, ARPU, eCPM** (D-013): the Revenue screen says "Not connected".
- **Crash rate, ANRs, Quality & Stability, Play vitals, SDK health, Crashlytics traces**: not in the PRD.
- **Platform and OS breakdowns, hardware profiles, geographies and tiers, lifecycle stages**: not in the PRD.
- **Benchmarks** ("genre baseline", "Play Console benchmark", "above genre bmk") and **audit statuses** such as "Exceeding Target": the numbers are not ours and would read as facts.
- **"Retention multipliers", "driven by", "confidence score", "event lift"**: causal or inferred claims. Observed changes may be shown as "observed" or "correlated" (AGENTS.md).
- **"Verified", "cryptographically verified", "data freshness 100%", report hashes and signatures**: not true of what we measure.
- **Pipelines, BigQuery, Play Console and App Store Connect connectors, ingestion cadence, GDPR toggles, alert thresholds, founder and billing panels, "New Pipeline", "Upload .p8 key"**: the dashboard reads GA4 through the Data API (D-004) and has no ingestion layer.
- **Schedule Digest, daily executive digest**: automated reports are V2.
- **Notification bell**: no notifications in V1.

Things the design shows that we will build later, in the phase that owns them: "Compare: previous period" and the peak marker (P3), "Compare Selected" and the app comparison matrix (P7), timeline annotations on the chart (P7), export buttons and the report archive (P8), connection test and sync status (P4), metric lineage as a provenance map (P4 to P9).
