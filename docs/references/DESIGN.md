---
name: Deco Derivative Guilds
colors:
  surface: '#09151c'
  surface-dim: '#09151c'
  surface-bright: '#2f3b43'
  surface-container-lowest: '#041016'
  surface-container-low: '#111d24'
  surface-container: '#152128'
  surface-container-high: '#202b33'
  surface-container-highest: '#2b363e'
  on-surface: '#d8e4ee'
  on-surface-variant: '#d7c3b0'
  inverse-surface: '#d8e4ee'
  inverse-on-surface: '#26323a'
  outline: '#9f8e7d'
  outline-variant: '#524436'
  surface-tint: '#ffb962'
  primary: '#ffbd6e'
  on-primary: '#472a00'
  primary-container: '#e99f3e'
  on-primary-container: '#5f3900'
  inverse-primary: '#865300'
  secondary: '#4adadc'
  on-secondary: '#003737'
  secondary-container: '#00b8ba'
  on-secondary-container: '#004344'
  tertiary: '#ffb8ad'
  on-tertiary: '#680200'
  tertiary-container: '#ff8f7d'
  on-tertiary-container: '#83160b'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffddb9'
  primary-fixed-dim: '#ffb962'
  on-primary-fixed: '#2b1700'
  on-primary-fixed-variant: '#663e00'
  secondary-fixed: '#6df7f8'
  secondary-fixed-dim: '#4adadc'
  on-secondary-fixed: '#002020'
  on-secondary-fixed-variant: '#004f50'
  tertiary-fixed: '#ffdad4'
  tertiary-fixed-dim: '#ffb4a8'
  on-tertiary-fixed: '#410100'
  on-tertiary-fixed-variant: '#8a1c10'
  background: '#09151c'
  on-background: '#d8e4ee'
  surface-variant: '#2b363e'
typography:
  display-hero:
    fontFamily: Bodoni Moda
    fontSize: 56px
    fontWeight: '700'
    lineHeight: 64px
    letterSpacing: -0.02em
  display-hero-mobile:
    fontFamily: Bodoni Moda
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: Bodoni Moda
    fontSize: 36px
    fontWeight: '600'
    lineHeight: 44px
    letterSpacing: 0.02em
  headline-lg-mobile:
    fontFamily: Bodoni Moda
    fontSize: 26px
    fontWeight: '600'
    lineHeight: 34px
    letterSpacing: 0.01em
  headline-md:
    fontFamily: Bodoni Moda
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: 0.04em
  title-lg:
    fontFamily: Hanken Grotesk
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Hanken Grotesk
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 26px
  body-md:
    fontFamily: Hanken Grotesk
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 22px
  label-caps:
    fontFamily: Hanken Grotesk
    fontSize: 12px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.14em
  data-mono-lg:
    fontFamily: JetBrains Mono
    fontSize: 20px
    fontWeight: '500'
    lineHeight: 26px
  data-mono-md:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  data-mono-sm:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '400'
    lineHeight: 14px
rounded:
  sm: 0.5rem
  DEFAULT: 1rem
  md: 1.5rem
  lg: 2rem
  xl: 3rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-mobile: 0.75rem
  margin: 2.5rem
  margin-mobile: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

This design system synthesizes vintage 1930s Art Deco travel-and-cocktail noir with high-conviction modern financial technology. Evoking the moody nocturnal luxury of an exclusive rooftop speakeasy overlooking a moonlit skyline, the interface blends tactical options trading mechanics with competitive guild governance. 

The aesthetic is built around:
- **Atmospheric Nocturne:** Velvet midnight teals and deep slate charcoal foundations juxtaposed against gilded gold embellishments and parchment typography.
- **Architectural Art Deco Geometry:** Streamline Moderne silhouettes, stepped borders, balanced symmetry, and elongated pill badges inspired by vintage club placards.
- **Fintech Precision:** Razor-sharp typography and monospace numeric layouts for complex Greek metrics (Delta, Theta, Implied Volatility), consensus voting mechanics, and covered call payoff matrices.
- **Tactile Opulence:** Restrained metallic gold leaf highlights (`#E99F3E`), glowing neon poolside cyan accents (`#2BC6C8`) representing active yields, and crisp high-trust curves with a velvety matte surface.

## Colors

The palette directly honors the vintage poster's chiaroscuro palette: deep twilight navy and teal architecture, illuminated poolside water, glowing cocktail amber, and crisp parchment cream printing.

### Functional Roles:
- **Canvas & Surface Tier (`#08141B`, `#0F202B`, `#14191E`):** Deep Midnight Teal forms the foundational background, while Slate Charcoal creates card containers and trading matrix cells.
- **Primary / Gilded Accent (`#E99F3E`, `#F5B04A`):** Warm Ochre and Amber Gold signify liquidity, guild prestige, treasury totals, and primary call-to-actions.
- **Secondary / Poolside Cyan (`#2BC6C8`, `#3AB0C8`):** Saturated neon teal inspired by the illuminated pool water, used for positive PnL, optimal strike bands, active token rewards, and live trade signals.
- **Tertiary / Downside Risk (`#E05A47`):** Warm terracotta coral red representing assignment risk, Delta drawdowns, and stop warnings without breaking the period palette.
- **Parchment Neutrals (`#F7F2E4`, `#EFE7D3`, `#8B9DA8`):** Vintage cream replaces harsh digital whites for headings and primary metrics, drastically reducing eye strain during late-night derivatives monitoring.

## Typography

Typography establishes an intentional contrast between vintage luxury and cryptographic precision:
- **Bodoni Moda:** High-contrast, dramatic serif with an architectural presence. Used in uppercase for grand titles, strike levels, and guild heraldry.
- **Hanken Grotesk:** Crisp, unpretentious grotesque that ensures legibility in syndicate proposals, strategy explanations, and voting rationales.
- **JetBrains Mono:** Dedicated exclusively to numeric payloads, Options Greeks ($\Delta, \Theta, \text{IV}$), strike spreads, countdown timers, and consensus token counts.

## Layout & Spacing

The layout is structured around an asymmetrical, architectural 12-column grid system reminiscent of stepped art deco skyscrapers.

- **Desktop (1200px+):** 12 columns with `2.5rem` outer margins and `1.5rem` gutters. Layouts partition cleanly between strategy visualization (8 columns) and guild consensus/order execution (4 columns).
- **Tablet (768px - 1199px):** 8 columns with `1.5rem` margins and `1rem` gutters. Payoff diagrams and option tables collapse into stacked full-width segments.
- **Mobile (320px - 767px):** 4 columns with `1rem` margins and `0.75rem` gutters. Monospaced financial tables feature horizontal sticky headers for strike comparisons.
- **Rhythm & Cadence:** Vertical spacing enforces structured grouping. Data modules use tight inner gaps (`space-xs` to `space-sm`), while card containers utilize generous padding (`space-lg`) to maintain editorial breathing room.

## Elevation & Depth

Rather than conventional drop shadows, depth is achieved through **tonal framing and illuminated gold filigree borders**:

- **Ground (Level 0):** Background foundation in Midnight Teal (`#08141B`) overlaid with a faint 3% monochromatic stipple grain texture.
- **Containers (Level 1):** Slate Charcoal (`#0F202B`) cards bound by 1px hairline borders of burnished gold with 30% alpha (`rgba(233, 159, 62, 0.3)`).
- **Interactive Floating Panels (Level 2):** Raised trading dialogue boxes and popovers (`#14191E`) paired with crisp multi-tier borders: an inner 1px border in Amber Gold (`#E99F3E`) and an ambient neon glow (`0 8px 32px rgba(43, 198, 200, 0.12)`).
- **Deco Stepped Edges:** Cards occasionally employ double inset hairline borders (2px offset) to emulate luxury stationery and vintage club tickets.

## Shapes

The shape system adopts the iconic rounded geometry seen in vintage cabaret placards and hotel signage:
- **Pill Geometry:** Interactive status badges, epoch countdown banners, and primary voting actions use elongated capsules (`border-radius: 9999px`), directly mirroring the pill-shaped time banners from the reference poster.
- **Hybrid Structural Cards:** Dashboard modules and data cards retain subtle corner radiuses (`8px` to `12px`) to preserve dense tabular alignment while contrasting against hyper-rounded capsule pills.

## Components

### Buttons
- **Primary Guild Action:** Solid Amber Gold (`#E99F3E`) pill button with Midnight Teal (`#08141B`) bold typography. Hover triggers an inner gold luminescence with a crisp transform scale (`1.02`).
- **Secondary Strategy Button:** Transparent pill with a 1.5px Poolside Cyan (`#2BC6C8`) border and matching cyan text; fills to `rgba(43, 198, 200, 0.15)` on hover.
- **Ghost/Tertiary:** Minimalist parchment link with a stepped baseline indicator.

### Art Deco Pill Badges & Chips
- **Status Badges:** Directly inspired by the "SATURDAY NOVEMBER 7" badge from the reference art. Features an amber-orange solid fill, deep navy uppercase type (`label-caps`), and a surrounding double hairline stroke.
- **Greek & Volatility Chips:** Dark charcoal capsules bordered with muted gold, hosting monospaced values (`IV: 48.2%`, `Δ: 0.28`).

### Options Matrix & Strike Tables
- High-density rows with alternating subtle charcoal stripes.
- Strike price in bold Bodoni serif, flanked by monospaced bid/ask spreads.
- In-the-money indicators marked by a Poolside Cyan vertical accent line along the left edge.

### Payoff Curves & Guild Voting Consensus
- **Payoff Chart:** Deep slate canvas with neon cyan profit regions and warm coral red maximum-loss zones, charted with high-precision vector lines.
- **Consensus Bars:** Stepped horizontal gauges showing collective guild voting on covered call strikes, filled with glowing amber gold against midnight teal tracks.

### Input Fields & Sliders
- Dark recessed input wells (`#08141B`) with vintage parchment input text (`#F7F2E4`) and focused borders shifting to crisp Poolside Cyan.