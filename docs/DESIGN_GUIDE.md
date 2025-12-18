# Context Pack - Design Guide

## Design Philosophy

Context Pack follows an **enterprise-grade, minimal design aesthetic** inspired by Vercel, Stripe, and Linear. The focus is on:

- **Professionalism over vibrancy**: Trust and credibility through restraint
- **Tables over cards**: Data sheets and specifications instead of bento boxes
- **Typography over containers**: Hierarchy through type, not backgrounds
- **Monochrome with strategic accents**: Purple highlights only where meaningful
- **Technical precision**: Clean interfaces that feel like infrastructure tools

**Anti-Patterns to Avoid**:
- ❌ Colorful "bento box" grid layouts
- ❌ Multiple accent colors (rainbow security icons)
- ❌ Rounded glassmorphic cards everywhere
- ❌ Vibe-coded aesthetics (playful, consumer-focused)
- ❌ Gradients and decorative elements

## Brand Identity

### Logo
- **Primary Logo**: Logo2.png
- **Usage**: Navigation bar, favicons, social previews
- **Sizes**: 
  - Nav: 25x25px
  - Favicon: 32x32px
  - Apple Icon: 180x180px
  - OG Image: 1200x630px

### Color Palette

#### Core Colors (Enterprise Dark Theme)
```css
/* Background Colors - Pure Dark */
--bg-primary: #080a09          /* Main background (nearly black) */
--bg-secondary: #0a0c0b         /* Section backgrounds */
--bg-elevated: #0E0E0E          /* Modals, dropdowns */

/* Text Colors - Monochrome Scale */
--text-white: #ffffff           /* Primary headings */
--text-gray-300: #d1d5db        /* Body text */
--text-gray-400: #9ca3af        /* Secondary text */
--text-gray-500: #6b7280        /* Muted text */
--text-gray-600: #4b5563        /* Tertiary text */

/* Border Colors - Subtle Separation */
--border-white-5: rgba(255, 255, 255, 0.05)   /* Very subtle */
--border-white-10: rgba(255, 255, 255, 0.10)  /* Default dividers */
--border-white-20: rgba(255, 255, 255, 0.20)  /* Emphasized */
--border-white-30: rgba(255, 255, 255, 0.30)  /* Interactive */

/* Accent Color - Strategic Purple */
--accent-purple-400: #c084fc   /* Primary accent (links, highlights) */
--accent-purple-300: #d8b4fe   /* Hover state */
```

#### Strategic Use of Purple
Purple should be used **sparingly** for:
- Key technical specifications (e.g., "AES-256", "TLS 1.3")
- Important guarantees (e.g., "never used", "Zero lock-in")
- Links and interactive elements
- Pipeline indicators and node dots

**Do NOT use purple for**:
- Large backgrounds or cards
- Decorative elements
- Section headers (use white instead)

## Typography

### Font Family
- **Primary**: Inter (Google Fonts)
- **Monospace**: `font-mono` for technical specs, code, email addresses
- **Fallback**: system-ui, -apple-system, sans-serif

### Font Sizes (Enterprise Scale)
```css
/* Headers - Restrained */
.text-5xl { font-size: 3rem; }      /* 48px - Page titles */
.text-4xl { font-size: 2.25rem; }   /* 36px - Hero headings */
.text-3xl { font-size: 1.875rem; }  /* 30px - Section headings */
.text-2xl { font-size: 1.5rem; }    /* 24px - Subsections */

/* Body - Readable */
.text-lg  { font-size: 1.125rem; }  /* 18px - Large body */
.text-base { font-size: 1rem; }     /* 16px - Default */
.text-sm  { font-size: 0.875rem; }  /* 14px - Table text */
.text-xs  { font-size: 0.75rem; }   /* 12px - Labels, monospace specs */
```

### Font Weights
- **Regular**: 400 - Body text
- **Medium**: 500 - Navigation
- **Semibold**: 600 - Table headers, subsections
- **Bold**: 700 - Section headings

### Typography Best Practices
✅ Use **bold white** for section headers  
✅ Use **gray-400** for body text  
✅ Use **gray-500** for descriptions  
✅ Use **monospace** for technical specs (→ .json, AES-256)  
✅ Keep line lengths readable (max-w-5xl)  

## Layout Patterns

### Table/Data Sheet Format (Preferred)
Use a 2-column grid with left-aligned labels:

```tsx
<div className="space-y-0">
  <div className="grid grid-cols-1 md:grid-cols-12 gap-4 py-6 border-b border-white/10">
    <div className="md:col-span-4">
      <h3 className="text-sm font-semibold text-white">Label</h3>
    </div>
    <div className="md:col-span-8">
      <p className="text-sm text-gray-400">Specification details</p>
    </div>
  </div>
</div>
```

### Pipeline Diagram (Technical Flows)
For "How It Works" or process flows:

```tsx
{/* Horizontal line connecting nodes */}
<div className="hidden md:block absolute top-8 left-0 right-0 h-px 
                bg-gradient-to-r from-transparent via-white/20 to-transparent" />

{/* Node indicators */}
<div className="w-4 h-4 rounded-full bg-purple-500/20 border-2 border-purple-500/50" />

{/* Step labels */}
<p className="text-xs font-mono text-gray-600">01</p>
<h3 className="text-base font-semibold text-white">STEP NAME</h3>

{/* Technical specs */}
<div className="space-y-1.5 font-mono text-xs text-gray-600">
  <div>→ .json</div>
  <div>→ .pdf</div>
</div>
```

### Section Spacing
```css
/* Between major sections */
space-y-32: 8rem (128px)

/* Within sections */
mb-20: 5rem (80px) for section headers
mb-12: 3rem (48px) for subsections
mb-4: 1rem (16px) for small groups
```

## Components

### Navigation Bar
```tsx
<header className="sticky top-0 z-50 bg-[#0E0E0E] border-b border-white/10">
  <div className="max-w-7xl mx-auto px-6 py-4">
    {/* Logo + Links + User */}
  </div>
</header>
```

**Dropdowns** (e.g., Sign Out):
```tsx
<div className="absolute top-full right-0 mt-4 min-w-max 
                bg-gray-900 border border-gray-700 rounded-lg shadow-2xl py-2 z-50">
  <button className="flex items-center gap-3 px-5 py-3 text-sm text-gray-400 
                     hover:text-white hover:bg-gray-800 transition-colors 
                     w-full text-left whitespace-nowrap">
    <LogOut className="h-4 w-4 flex-shrink-0" />
    Sign Out
  </button>
</div>
```

### Buttons

#### Primary CTA (Light)
```tsx
<button className="px-6 py-3 bg-white text-black font-semibold 
                   rounded-xl hover:bg-gray-100 transition-colors">
  Get Started
</button>
```

#### Secondary (Minimal)
```tsx
<button className="px-6 py-3 bg-white/[0.02] border border-white/10 
                   text-white rounded-xl hover:bg-white/[0.04] 
                   hover:border-white/20 transition-colors">
  Learn More
</button>
```

### Cards (Use Sparingly)
When cards are absolutely necessary:

```tsx
<div className="p-6 rounded-xl border border-white/10 bg-white/[0.02] 
                hover:border-white/20 transition-all">
  {/* Content */}
</div>
```

**Prefer tables over cards for most content.**

### Links
```tsx
{/* Internal navigation */}
<Link href="/security" className="text-gray-400 hover:text-white transition-colors">
  Documentation
</Link>

{/* Highlighted/CTA links */}
<Link href="/security" className="text-purple-400 hover:text-purple-300 transition-colors">
  Security whitepaper →
</Link>
```

## Page Patterns

### Hero Section
```tsx
<section className="py-32 px-6 bg-[#080a09]">
  <div className="max-w-5xl mx-auto">
    <p className="text-xs uppercase tracking-[0.2em] text-gray-500 mb-4 font-mono">
      Category
    </p>
    <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
      Page Title
    </h1>
    <p className="text-lg text-gray-500">
      Brief description of the page
    </p>
  </div>
</section>
```

### Content Section
```tsx
<section className="py-32 px-6 bg-[#080a09] relative border-t border-white/5">
  <div className="max-w-5xl mx-auto">
    {/* Section header */}
    <div className="mb-12">
      <h2 className="text-2xl font-bold text-white mb-2">Section Title</h2>
      <p className="text-sm text-gray-500">Section description</p>
    </div>
    
    {/* Table/grid content */}
    <div className="space-y-0">
      {/* Rows with border-b border-white/10 */}
    </div>
  </div>
</section>
```

## Mobile Responsiveness

### Breakpoints
```css
sm: 640px    /* Small tablets */
md: 768px    /* Tablets - table columns stack */
lg: 1024px   /* Laptops */
xl: 1280px   /* Desktops */
```

### Mobile Patterns
```tsx
{/* Stack table columns on mobile */}
<div className="grid grid-cols-1 md:grid-cols-12 gap-4 py-6">
  <div className="md:col-span-4">Label</div>
  <div className="md:col-span-8">Value</div>
</div>

{/* Hide pipeline line on mobile */}
<div className="hidden md:block absolute top-8 h-px bg-white/20" />

{/* Responsive text sizes */}
<h1 className="text-3xl md:text-4xl lg:text-5xl font-bold">
```

## Icons (Lucide React)

### Strategic Icon Use
✅ Navigation items  
✅ User actions (LogOut, Settings)  
✅ Technical indicators (small, monochrome)  
❌ Large decorative icons in colored boxes  
❌ Multiple colored section icons (green/blue/purple/yellow)  

```tsx
import { ArrowRight, LogOut } from 'lucide-react'

{/* Small, inline icons */}
<ArrowRight className="w-3 h-3" />
<LogOut className="h-4 w-4 flex-shrink-0" />
```

## Shadows (Minimal)

Enterprise designs use very subtle shadows:

```css
/* Dropdowns and modals only */
box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.5);

/* No shadows on cards or sections */
```

## Animation (Restrained)

```css
/* Default transitions */
transition-colors duration-200

/* Hover effects */
hover:translate-x-1 transition-transform  /* Arrow links */
hover:bg-white/[0.04]                     /* Subtle highlights */

/* No elaborate animations or parallax effects */
```

## Accessibility

### Color Contrast
- White text on dark background: Excellent (21:1)
- Gray-400 text on dark: Good (7:1)
- Purple-400 accents: Acceptable (4.5:1)

### Focus States
```tsx
focus:outline-none
focus:ring-2
focus:ring-purple-400
focus:ring-offset-2
focus:ring-offset-[#080a09]
```

### Semantic HTML
```tsx
<main>
  <section>
    <h1>...</h1>
    {/* Use proper heading hierarchy */}
  </section>
</main>
```

## Best Practices

### Do's ✅
- Use **table layouts** for specifications
- Keep **monochromatic** color scheme (white/gray)
- Add **purple** only for key highlights
- Use **horizontal lines** for structure (`border-b border-white/10`)
- Employ **typography** for hierarchy
- Keep **spacing** consistent (8rem between sections)
- Use **monospace font** for technical specs
- Maintain **professional tone** throughout

### Don'ts ❌
- Don't create colorful card grids
- Don't use multiple accent colors
- Don't add decorative gradients
- Don't make rounded glassmorphic boxes
- Don't use large colored icons as section headers
- Don't add playful or consumer-focused elements
- Don't use arbitrary spacing values

## Example Comparisons

### ❌ Avoid: Vibe-Coded
```tsx
{/* Colorful cards with icons */}
<div className="grid grid-cols-3 gap-6">
  <div className="p-6 bg-gradient-to-br from-blue-500/10 to-purple-500/10 
                  rounded-2xl border border-blue-500/20">
    <Shield className="h-8 w-8 text-green-400 mb-3" />
    <h3 className="text-lg font-semibold">256-bit Encryption</h3>
  </div>
</div>
```

### ✅ Prefer: Enterprise
```tsx
{/* Clean table row */}
<div className="grid grid-cols-12 gap-4 py-6 border-b border-white/10">
  <div className="col-span-4">
    <h3 className="text-sm font-semibold text-white">Encryption</h3>
  </div>
  <div className="col-span-8">
    <p className="text-sm text-gray-400">
      <span className="text-purple-400">AES-256</span> bit at rest, 
      <span className="text-purple-400">TLS 1.3</span> in transit
    </p>
  </div>
</div>
```

## File Structure

```
frontend/
├── app/
│   ├── globals.css          # Design system variables
│   ├── layout.tsx           # Root layout
│   ├── page.tsx             # Landing page (enterprise tables)
│   └── security/
│       └── page.tsx         # Security whitepaper (data sheet format)
├── components/
│   ├── Navigation.tsx       # Main nav
│   ├── ExportGuide.tsx      # Landing sections
│   └── DocsLayout.tsx       # Documentation pages
└── public/
    ├── Logo2.png           # Brand logo
    └── og-image.png        # Social preview
```

---

**Design Philosophy**: Lines > Boxes. Typography > Decoration. Restraint > Vibrancy.

**Last Updated**: December 17, 2025  
**Version**: 2.0 (Enterprise Redesign)  
**Maintainer**: Context Pack Team
