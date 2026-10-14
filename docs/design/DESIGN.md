---
name: CatalystCore Analytics Design System
colors:
  surface: '#faf8ff'
  surface-dim: '#d2d9f4'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f3ff'
  surface-container: '#eaedff'
  surface-container-high: '#e2e7ff'
  surface-container-highest: '#dae2fd'
  on-surface: '#131b2e'
  on-surface-variant: '#464555'
  inverse-surface: '#283044'
  inverse-on-surface: '#eef0ff'
  outline: '#777587'
  outline-variant: '#c7c4d8'
  surface-tint: '#4d44e3'
  primary: '#3525cd'
  on-primary: '#ffffff'
  primary-container: '#4f46e5'
  on-primary-container: '#dad7ff'
  inverse-primary: '#c3c0ff'
  secondary: '#006a61'
  on-secondary: '#ffffff'
  secondary-container: '#86f2e4'
  on-secondary-container: '#006f66'
  tertiary: '#703a00'
  on-tertiary: '#ffffff'
  tertiary-container: '#934e00'
  on-tertiary-container: '#ffd2b1'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e2dfff'
  primary-fixed-dim: '#c3c0ff'
  on-primary-fixed: '#0f0069'
  on-primary-fixed-variant: '#3323cc'
  secondary-fixed: '#89f5e7'
  secondary-fixed-dim: '#6bd8cb'
  on-secondary-fixed: '#00201d'
  on-secondary-fixed-variant: '#005049'
  tertiary-fixed: '#ffdcc3'
  tertiary-fixed-dim: '#ffb77d'
  on-tertiary-fixed: '#2f1500'
  on-tertiary-fixed-variant: '#6e3900'
  background: '#faf8ff'
  on-background: '#131b2e'
  surface-variant: '#dae2fd'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 36px
    fontWeight: '600'
    lineHeight: 44px
    letterSpacing: -0.025em
  display-lg-mobile:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.02em
  headline-sm:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.01em
  metric-stat:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.02em
  body-lg:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 22px
    letterSpacing: -0.005em
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0em
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: 0em
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.01em
  label-mono:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: 0em
  caption:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.02em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-desktop: 1.5rem
  margin: 1rem
  margin-desktop: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1.25rem
  space-xl: 2rem
---

## Brand & Style

This design system establishes a high-precision, developer-first analytics environment engineered for telemetry, cohort diagnostics, and performance attribution. Drawing functional elegance from tools like Linear and administrative rigor from platforms like the Google Play Console, the visual posture avoids ornamentation in favor of absolute signal clarity.

The aesthetic philosophy centers on **Refined Utility**:
- **Tone:** Methodical, mature, trustworthy, and calm. The interface recedes to make multi-series telemetry and operational data immediately legible.
- **Visual Discipline:** Zero decorative gradients, zero novelty blurs, zero skeumorphic visual weight. Hierarchy is established exclusively through typographic contrast, micro-borders, and disciplined spatial rhythm.
- **Emotional Response:** Empowers product managers and engineers with a feeling of absolute command over distributed metrics, unburdened by sensory clutter.

## Colors

The palette is engineered specifically for light mode clarity, leveraging cool slate anchors with dedicated functional semantic accents:

- **Canvas & Surface:** Base application canvas rests on `#F8FAFC` (Slate 50). Elevated dashboard cards, analytical tables, and interactive panels mount directly to pure `#FFFFFF`.
- **Primary Brand Accent (`#4F46E5`):** High-integrity Indigo. Reserved exclusively for definitive calls to action, active navigation affordances, selection rings, and high-priority chart trendlines.
- **Secondary (`#0D9488`):** Deep Teal. Dedicated to positive telemetry trajectories (e.g., retention lift, conversion growth, system operational healthy badges).
- **Tertiary (`#D97706`):** Warm Amber. Utilized for non-blocking alerts, latency degradation warnings, and pending ingest pipeline tokens.
- **Error / Critical (`#E11D48`):** Precision Rose. Reserved for ingestion failures, threshold violations, and destructive actions.
- **Neutral Palette:**
  - `neutral-900` (`#0F172A`): Primary headings, core metrics, table values.
  - `neutral-600` (`#475569`): Standard paragraph copy, active tab text.
  - `neutral-500` (`#64748B`): Metric delta labels, helper hints, empty state headers.
  - `neutral-200` (`#E2E8F0`): Primary structural micro-borders, partition dividers, and grid outlines.
  - `neutral-100` (`#F1F5F9`): Inactive track backgrounds, hover fills, code chip surfaces.

## Typography

The type system is powered by Inter, optimized for variable screens and high tabular data densities. Metric readouts and numeric tables must implement tabular lining figures (`font-variant-numeric: tabular-nums;`) to prevent baseline shifting across real-time polling updates.

- **Headlines & KPI Metric Display:** Use semibold weights (`600`) with tight tracking (`-0.02em`) to guarantee crisp visual presence at glance speeds.
- **Body & Metadata:** Uses regular (`400`) and medium (`500`) weights. Line heights are explicitly calibrated to compact vertical bounds, avoiding the sprawling line-height common in consumer media.
- **Telemetry Identifiers & Keys:** Paired with `JetBrains Mono` at `12px` for cluster nodes, SQL parameters, hash IDs, and endpoint paths.

## Layout & Spacing

The layout model utilizes a responsive 12-column fluid grid system bounded by a max container width of `1600px` for high-resolution diagnostic consoles.

- **Grid Adaptability:**
  - **Desktop (>= 1280px):** 12-column system, 24px (`1.5rem`) gutters, and 32px (`2rem`) canvas outer margin. The primary navigation rail remains anchored at a fixed width of `240px`.
  - **Tablet (768px – 1279px):** 6-column system, 16px (`1rem`) gutters, 20px outer margin. Side-by-side metric charts fold into single vertical stacks.
  - **Mobile (< 768px):** 4-column system, 12px gutters, 16px (`1rem`) outer margin. Data tables convert into swipeable horizontal cards or collapsible row matrices.
- **Spacing Principle:** Built strictly upon a 4px layout scale. Padding inside cards is standardly set to `space-lg` (20px), while micro controls and toolbar clusters utilize `space-xs` (4px) and `space-sm` (8px) for high compact density.

## Elevation & Depth

Visual hierarchy does not depend on heavy shadows or layered translucent blurs. Instead, depth is achieved through structural layering and razor-thin micro-shadows:

- **Border-First Architecture:** Every raised element relies on a 1px solid border (`#E2E8F0`). Borders delineate edge geometry before elevation comes into play.
- **Base Level (Canvas):** Tone `#F8FAFC`. Zero elevation, zero shadows.
- **Level 1 (Cards, Data Grids, Toolbar Panels):** Grounded `#FFFFFF` surface with a 1px `#E2E8F0` stroke, accompanied by a restrained resting micro-shadow: `0 1px 2px 0 rgba(15, 23, 42, 0.04)`.
- **Level 2 (Dropdowns, Popovers, Date Pickers, Hover States):** Surface `#FFFFFF` with 1px `#E2E8F0` border and medium ambient dispersion: `0 4px 6px -1px rgba(15, 23, 42, 0.07), 0 2px 4px -2px rgba(15, 23, 42, 0.05)`.
- **Level 3 (Command Palette, Modals, Critical Diagnostics Overlays):** Surface `#FFFFFF` with 1px `#CBD5E1` border and deep atmospheric drop: `0 20px 25px -5px rgba(15, 23, 42, 0.08), 0 8px 10px -6px rgba(15, 23, 42, 0.04)`. Accompanied by a non-blurred `#0F172A` backdrop mask set to `20%` opacity.

## Shapes

The geometric posture of this system maintains a standardized radius spectrum of **10px to 12px**:

- **Standard Cards, Dashboard Modules, and Modals:** Apply an exact corner radius of `12px` (`rounded-lg`).
- **Interactive Controls (Buttons, Form Inputs, Segmented Tabs):** Apply an exact corner radius of `10px` to maintain geometric harmony inside container cards.
- **Chips, Key Status Badges, and Micro-Indicators:** Apply `6px` (`rounded-md`) to avoid over-rounding or juvenile pill aesthetics.
- **Pills / Circles:** Strictly prohibited for general UI containers, cards, and buttons. Circular shapes (`rounded-full`) are reserved solely for user profile avatars and status ping dots.

## Components

### Buttons & Actions
- **Primary:** Background `#4F46E5`, foreground `#FFFFFF`, height `36px`, padding `0 14px`, radius `10px`. Hover brings background to `#4338CA`. Subtle inset top highlight: `inset 0 1px 0 0 rgba(255, 255, 255, 0.15)`.
- **Secondary / Outline:** Background `#FFFFFF`, foreground `#0F172A`, 1px border `#E2E8F0`. Hover triggers background `#F8FAFC` and border `#CBD5E1`.
- **Ghost:** Zero border, zero background fill, foreground `#475569`. Hover sets background `#F1F5F9` and foreground `#0F172A`.

### Status Chips & Data Badges
- **Height:** 22px; inline padding: 6px 8px; radius: 6px.
- **Positive Lift / Active (Teal):** Background `#F0FDFA`, border `1px solid #CCFBF1`, text `#0F766E`, font-size `11px`, weight `500`. Includes a 6px static indicator circle `#0D9488`.
- **Warning / Degraded (Amber):** Background `#FFFBEB`, border `1px solid #FEF3C7`, text `#B45309`.
- **Neutral Code Chip:** Background `#F1F5F9`, border `1px solid #E2E8F0`, text `#475569`, monospace font.

### Form Inputs & Selectors
- **Input Fields:** Height `36px`, surface `#FFFFFF`, border `1px solid #E2E8F0`, text `#0F172A`, placeholder `#94A3B8`, radius `10px`.
- **Focus State:** 1px border `#4F46E5` accompanied by a 3px outer focus halo: `0 0 0 3px rgba(79, 70, 229, 0.12)`.
- **Checkboxes & Radios:** Size `16px`, border `1.5px solid #CBD5E1`, radius `4px` (checkbox) or `100%` (radio). Checked state fills `#4F46E5` with `#FFFFFF` check icon.

### Metric Cards & Data Grids
- **Metric Cards:** `#FFFFFF` canvas, `12px` border radius, `1px solid #E2E8F0` boundary, `20px` interior padding. Structured with small uppercase or subdued label on top (`12px`, `#64748B`), bold numeric value (`28px`, `#0F172A`), followed by delta badge and comparison string (`vs last 30 days`).
- **Telemetry Data Tables:** Crisp row height at `44px`. Table header rests on `#F8FAFC` with bottom divider `1px solid #E2E8F0`, header text uppercase `11px`, weight `600`, tracking `0.04em` in `#64748B`. Row borders `1px solid #F1F5F9` with instantaneous subtle hover fill `#F8FAFC`.

### Iconography & Affordances
- **Style:** Clean 1.5px stroke width (Lucide-standard), sized strictly to `16x16px` for inline context and `20x20px` for top-level navigation.