# Context Pack - Design Guide

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

#### Dark Theme (Default)
```css
/* Background Colors */
--bg-primary: #1d1d1d        /* Main dark background */
--bg-secondary: #0E0E0E      /* Header/footer background */
--bg-card: #181818           /* Card backgrounds */
--bg-card-hover: #333333     /* Interactive card hover */
--bg-card-elevated: #2d2d2d  /* Elevated/modal backgrounds */

/* Accent Colors */
--accent-primary: rgba(102, 57, 208, 0.65)      /* Purple primary */
--accent-primary-hover: rgba(99, 51, 210, 0.733) /* Purple hover */
--accent-primary-light: rgba(115, 59, 246, 0.457) /* Light purple */
--accent-primary-dark: #1d4ed8                   /* Dark blue accent */

/* Text Colors */
--text-primary: #ffffff      /* Primary white text */
--text-secondary: #e5e7eb    /* Light gray text */
--text-muted: #9ca3af        /* Muted gray */
--text-disabled: #6b7280     /* Disabled state */

/* Border Colors */
--border-primary: #323232    /* Subtle borders */
--border-secondary: #3a3a3a  /* Secondary borders */
--border-card: #2e2e2e       /* Card borders */

/* Status Colors */
--status-success: #10b981    /* Green */
--status-warning: #f59e0b    /* Amber */
--status-error: #ef4444      /* Red */
```

#### Light Theme
```css
/* Background Colors */
--bg-primary: #ffffff        /* Clean white */
--bg-secondary: #f8f9fa      /* Light gray */
--bg-card: #ffffff           /* Card white */
--bg-card-hover: #f8f9fa     /* Subtle hover */

/* Accent Colors */
--accent-primary: rgba(79, 41, 167, 0.832)      /* Purple primary */
--accent-primary-hover: rgba(104, 57, 214, 0.837) /* Purple hover */
--accent-primary-light: rgb(76, 37, 167)         /* Light purple */

/* Text Colors */
--text-primary: #1f2328      /* Dark text */
--text-secondary: #413c43    /* Gray text */
--text-muted: #848d97        /* Muted text */
```

## Typography

### Font Family
- **Primary**: Inter (Google Fonts)
- **Fallback**: system-ui, -apple-system, sans-serif

### Font Sizes
```css
.text-h1  { font-size: 3.5rem; }   /* 56px - Hero headings */
.text-h2  { font-size: 2.25rem; }  /* 36px - Section headings */
.text-h3  { font-size: 1.875rem; } /* 30px - Subsection headings */
.text-lg  { font-size: 1.125rem; } /* 18px - Large body */
.text-base { font-size: 1rem; }    /* 16px - Default body */
.text-sm  { font-size: 0.875rem; } /* 14px - Small text */
.text-xs  { font-size: 0.75rem; }  /* 12px - Captions */
```

### Font Weights
- **Light**: 300 - Subtle text
- **Regular**: 400 - Body text
- **Medium**: 500 - Nav links, buttons
- **Semibold**: 600 - Headings, emphasis
- **Bold**: 700 - Strong emphasis

## Layout

### Navigation
```
Structure: Logo | Nav Links | [Spacer] | Status | User Profile | Credits
- Logo: 25x25px + "Context Pack" text
- Nav Links: Home, Packs, Pricing, Docs
- Status: Green dot indicator
- User: Avatar + dropdown
- Credits: Card with balance display
```

### Spacing Scale
```css
gap-1: 0.25rem    /* 4px - Tight spacing */
gap-2: 0.5rem     /* 8px - Small spacing */
gap-3: 0.75rem    /* 12px - Default spacing */
gap-4: 1rem       /* 16px - Medium spacing */
gap-6: 1.5rem     /* 24px - Large spacing */
gap-8: 2rem       /* 32px - Section spacing */
gap-12: 3rem      /* 48px - Major sections */
gap-16: 4rem      /* 64px - Hero spacing */
```

### Border Radius
```css
rounded-md: 6px    /* Default cards */
rounded-lg: 8px    /* Buttons, inputs */
rounded-xl: 12px   /* Large cards */
rounded-2xl: 16px  /* Hero sections */
rounded-full: 50%  /* Avatars, badges */
```

## Components

### Buttons

#### Primary Button (CTA)
```css
Background: white
Text: black
Font: 600 semibold
Padding: 0.75rem 1.5rem
Rounded: rounded-xl (12px)
Hover: bg-gray-100
Shadow: shadow-lg
```

#### Secondary Button
```css
Background: bg-card (#181818)
Text: white
Border: 1px solid border-primary
Padding: 0.75rem 1.5rem
Rounded: rounded-xl
Hover: bg-card-hover
```

#### Credit Button
```css
Background: bg-gray-800
Border: 1px solid gray-700
Icon: CreditCard (gray-400)
Text: "Credits" (gray-400) + Balance (white, bold)
Hover: bg-gray-700, border-gray-600
```

### Cards
```css
Background: var(--bg-card)
Border: 1px solid var(--border-card)
Rounded: rounded-xl (12px)
Padding: 1.5rem (24px)
Shadow: shadow-md
Hover: bg-card-hover, border-border-accent
Transition: all 200ms
```

### Inputs
```css
Background: var(--bg-input)
Border: 1px solid var(--border-primary)
Rounded: rounded-lg (8px)
Padding: 0.75rem 1rem
Text: var(--text-primary)
Focus: border-accent-primary, ring-accent-primary
```

### Badges
```css
Background: var(--accent-primary-light)
Text: var(--accent-primary)
Padding: 0.25rem 0.75rem
Rounded: rounded-full
Font: 0.875rem, 600 semibold
```

## Icons

### Icon Library
- **Lucide React**: Primary icon system
- **Size**: 20-24px default, 16-18px for small UI

### Common Icons
```typescript
import { 
  CreditCard,    // Credits display
  User,          // User profile
  Settings,      // Settings menu
  LogOut,        // Sign out
  Menu, X,       // Mobile menu toggle
  Sun, Moon,     // Theme toggle
  Home,          // Navigation
  Package,       // Packs
  DollarSign,    // Pricing
  BookOpen,      // Documentation
} from 'lucide-react'
```

## Shadows

### Shadow Scale
```css
shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.3)      /* Subtle depth */
shadow-md: 0 2px 6px rgba(0, 0, 0, 0.3)      /* Card elevation */
shadow-lg: 0 4px 12px rgba(0, 0, 0, 0.3)     /* Buttons, modals */
shadow-professional: 0 8px 25px -5px rgba(0, 0, 0, 0.3) /* Hero sections */
```

## Animation

### Transitions
```css
Default: transition-all 200ms ease
Hover: 150ms ease-out
Focus: 100ms ease-in
```

### Common Animations
```css
/* Fade In */
opacity: 0 → 1 (300ms)

/* Slide Up */
transform: translateY(20px) → translateY(0)
opacity: 0 → 1 (400ms)

/* Scale Hover */
transform: scale(1) → scale(1.05) (150ms)
```

## Responsive Breakpoints

```css
sm: 640px    /* Small tablets */
md: 768px    /* Tablets */
lg: 1024px   /* Small laptops */
xl: 1280px   /* Desktops */
2xl: 1536px  /* Large screens */
```

### Mobile-First Approach
- Default styles for mobile
- Use `md:` prefix for tablet+
- Use `lg:` prefix for desktop+

## Accessibility

### Color Contrast
- Text on dark: minimum 4.5:1 ratio
- Text on light: minimum 4.5:1 ratio
- Interactive elements: 3:1 ratio

### Focus States
```css
focus:outline-none
focus:ring-2
focus:ring-accent-primary
focus:ring-offset-2
focus:ring-offset-bg-primary
```

### Screen Readers
- Always include `alt` text for images
- Use `aria-label` for icon-only buttons
- Semantic HTML (`nav`, `main`, `section`, `article`)

## Best Practices

### Do's
✅ Use CSS variables for colors (var(--text-primary))
✅ Maintain consistent spacing (use spacing scale)
✅ Keep shadows subtle and consistent
✅ Use semantic class names
✅ Test both light and dark themes
✅ Ensure mobile responsiveness

### Don'ts
❌ Hardcode color values (#ffffff)
❌ Use random spacing values (padding: 13px)
❌ Mix border radius styles inconsistently
❌ Forget hover/focus states
❌ Ignore accessibility standards
❌ Create theme-specific components without testing both

## File Structure

```
frontend/
├── app/
│   ├── globals.css          # All design system variables
│   ├── layout.tsx           # Root layout with theme
│   └── page.tsx             # Homepage
├── components/
│   ├── Navigation.tsx       # Main nav component
│   ├── Footer.tsx           # Footer component
│   └── AuthModal.tsx        # Modal components
├── public/
│   ├── Logo2.png           # Primary logo
│   ├── og-image.png        # Social preview
│   └── images/             # Other assets
└── lib/
    └── supabase.ts         # Client utilities
```

## Component Examples

### Navigation Bar
```tsx
<header className="nav-header">
  <div className="nav-container">
    <div className="nav-content">
      {/* Left: Logo + Nav Links */}
      <Link href="/" className="nav-brand">
        <Image src="/Logo2.png" width={25} height={25} />
        <h1 className="nav-title">Context Pack</h1>
      </Link>
      
      <nav className="nav-links">
        <Link href="/" className="nav-link">Home</Link>
        <Link href="/packs" className="nav-link">Packs</Link>
        <Link href="/pricing" className="nav-link">Pricing</Link>
        <Link href="/docs" className="nav-link">Docs</Link>
      </nav>
      
      {/* Right: Status + User + Credits */}
      <div className="flex items-center gap-4">
        <Link href="/status">
          <div className="w-2 h-2 bg-green-400 rounded-full" />
        </Link>
        <UserDropdown />
        <CreditButton />
      </div>
    </div>
  </div>
</header>
```

### Card Component
```tsx
<div className="bg-card border border-card rounded-xl p-6 
                hover:bg-card-hover hover:border-border-accent 
                transition-all shadow-md">
  <h3 className="text-xl font-semibold text-primary mb-2">
    Card Title
  </h3>
  <p className="text-muted">
    Card description text
  </p>
</div>
```

### Button Component
```tsx
{/* Primary CTA */}
<button className="px-6 py-3 bg-white text-black font-semibold 
                   rounded-xl hover:bg-gray-100 shadow-lg 
                   transition-all">
  Get Started
</button>

{/* Secondary */}
<button className="px-6 py-3 bg-card border border-primary 
                   text-white rounded-xl hover:bg-card-hover 
                   transition-all">
  Learn More
</button>
```

---

**Last Updated**: December 7, 2025
**Version**: 1.0
**Maintainer**: Context Pack Team
