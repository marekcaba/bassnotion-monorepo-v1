# UI Component Inventory

**BassNotion Frontend Component Library Tracker**

> 📋 This document tracks all UI components across different libraries to maintain consistency and avoid duplication.

## Overview

BassNotion uses a **multi-library approach** for maximum flexibility and best-in-class components. This inventory helps us:
- Track what components we have from which libraries
- Avoid duplicate implementations
- Maintain consistent design patterns
- Plan future component additions

---

## Current Libraries

### 🎨 **Primary Libraries**
- **shadcn/ui** - Base UI components (Radix UI + Tailwind)
- **Radix UI** - Accessibility primitives (underlying shadcn/ui)
- **Framer Motion** - Animations and transitions
- **Lucide React** - Icon library

### 🔧 **Utility Libraries**
- **class-variance-authority** - Component variants
- **tailwind-merge** - Tailwind class merging
- **clsx** - Conditional class names

---

## Component Inventory

### 📋 **Forms & Inputs**

| Component | Library | File | Status | Notes |
|-----------|---------|------|--------|-------|
| `Button` | shadcn/ui | `button.tsx` | ✅ Active | Base button component |
| `Input` | shadcn/ui | `input.tsx` | ✅ Active | Text input field |
| `Label` | shadcn/ui | `label.tsx` | ✅ Active | Form labels |
| `Form` | shadcn/ui | `form.tsx` | ✅ Active | Form provider + utilities |
| `FormField` | shadcn/ui | `form.tsx` | ✅ Active | Form field wrapper |
| `FormItem` | shadcn/ui | `form.tsx` | ✅ Active | Form item container |
| `FormLabel` | shadcn/ui | `form.tsx` | ✅ Active | Form-aware label |
| `FormControl` | shadcn/ui | `form.tsx` | ✅ Active | Form control wrapper |
| `FormDescription` | shadcn/ui | `form.tsx` | ✅ Active | Form field description |
| `FormMessage` | shadcn/ui | `form.tsx` | ✅ Active | Form error messages |

### 🎛️ **Navigation & Layout**

| Component | Library | File | Status | Notes |
|-----------|---------|------|--------|-------|
| `Tabs` | shadcn/ui | `tabs.tsx` | ✅ Active | Tab navigation |
| `TabsList` | shadcn/ui | `tabs.tsx` | ✅ Active | Tab list container |
| `TabsTrigger` | shadcn/ui | `tabs.tsx` | ✅ Active | Individual tab trigger |
| `TabsContent` | shadcn/ui | `tabs.tsx` | ✅ Active | Tab content panel |
| `TransitionLink` | Custom | `transition-link.tsx` | ✅ Active | Animated page transitions |

### 🗂️ **Data Display**

| Component | Library | File | Status | Notes |
|-----------|---------|------|--------|-------|
| `Card` | shadcn/ui | `card.tsx` | ✅ Active | Base card component |
| `CardHeader` | shadcn/ui | `card.tsx` | ✅ Active | Card header section |
| `CardTitle` | shadcn/ui | `card.tsx` | ✅ Active | Card title |
| `CardDescription` | shadcn/ui | `card.tsx` | ✅ Active | Card description |
| `CardContent` | shadcn/ui | `card.tsx` | ✅ Active | Card main content |
| `CardFooter` | shadcn/ui | `card.tsx` | ✅ Active | Card footer section |
| `Badge` | shadcn/ui | `badge.tsx` | ✅ Active | Status badges |

### 🔧 **Utility & Feedback**

| Component | Library | File | Status | Notes |
|-----------|---------|------|--------|-------|
| `Toast` | shadcn/ui | `toast.tsx` | ✅ Active | Toast notifications |
| `Toaster` | shadcn/ui | `toaster.tsx` | ✅ Active | Toast container |
| `Loading` | Custom | `loading.tsx` | ✅ Active | Loading spinner |
| `ErrorMessage` | Custom | `error-message.tsx` | ✅ Active | Error display |
| `Icons` | Custom | `icons.tsx` | ✅ Active | Icon collection |

### 🔐 **Authentication**

| Component | Library | File | Status | Notes |
|-----------|---------|------|--------|-------|
| `AuthGuard` | Custom | `auth-guard.tsx` | ✅ Active | Route protection |
| `GoogleSignInButton` | Custom | `google-sign-in-button.tsx` | ✅ Active | Google OAuth button |

### 📱 **Responsive & Layout**

| Component | Library | File | Status | Notes |
|-----------|---------|------|--------|-------|
| `ResponsiveContainer` | Custom | `responsive-container.tsx` | ✅ Active | Responsive wrapper |
| `ResponsiveGrid` | Custom | `responsive-container.tsx` | ✅ Active | Responsive grid layout |
| `ResponsiveCard` | Custom | `responsive-container.tsx` | ✅ Active | Responsive card wrapper |
| `ResponsiveDebug` | Custom | `responsive-debug.tsx` | ✅ Active | Debug responsive breakpoints |
| `BreakpointIndicator` | Custom | `responsive-debug.tsx` | ✅ Active | Show current breakpoint |
| `ResponsiveTestGrid` | Custom | `responsive-debug.tsx` | ✅ Active | Test responsive layouts |

### 🎭 **Overlays & Modals**

| Component | Library | File | Status | Notes |
|-----------|---------|------|--------|-------|
| `Dialog` | shadcn/ui | `dialog.tsx` | ✅ Active | Modal dialogs |
| `AlertDialog` | shadcn/ui | `alert-dialog.tsx` | ✅ Active | Confirmation dialogs |
| `DropdownMenu` | shadcn/ui | `dropdown-menu.tsx` | ✅ Active | Dropdown menus |

---

## 🚀 **Planned Additions**

### HeroUI Components (Priority)
- [ ] `Table` - Advanced data tables
- [ ] `DatePicker` - Date selection
- [ ] `Select` - Enhanced select dropdown
- [ ] `Autocomplete` - Search with suggestions
- [ ] `Pagination` - Page navigation
- [ ] `Modal` - Advanced modal system

### Aceternity UI Components (Priority)
- [ ] `BackgroundBeams` - Animated backgrounds
- [ ] `HeroSection` - Landing page heroes
- [ ] `FloatingNav` - Floating navigation
- [ ] `CardHover` - Interactive cards
- [ ] `TextGenerateEffect` - Text animations

### Other Potential Libraries
- [ ] **Mantine** - Rich components (DatePicker, RichTextEditor)
- [ ] **React Aria** - Accessibility primitives
- [ ] **Headless UI** - Unstyled components

---

## 📏 **Design System Rules**

### Color Palette
- Primary: `bg-primary`, `text-primary`
- Secondary: `bg-secondary`, `text-secondary`
- Accent: `bg-accent`, `text-accent`
- Destructive: `bg-destructive`, `text-destructive`
- Muted: `bg-muted`, `text-muted-foreground`

### Sizing Scale
- **xs**: `h-4 w-4` (16px)
- **sm**: `h-6 w-6` (24px)
- **md**: `h-8 w-8` (32px)
- **lg**: `h-10 w-10` (40px)
- **xl**: `h-12 w-12` (48px)

### Border Radius
- **none**: `rounded-none`
- **sm**: `rounded-sm`
- **md**: `rounded-md`
- **lg**: `rounded-lg`
- **xl**: `rounded-xl`
- **full**: `rounded-full`

---

## 🛠️ **Integration Guidelines**

### Adding New Components

1. **Choose the Right Library**
   - Use shadcn/ui for standard components
   - Use HeroUI for advanced data components
   - Use Aceternity for marketing/hero components
   - Create custom for unique needs

2. **Installation Process**
   ```bash
   # For shadcn/ui
   pnpm dlx shadcn-ui@latest add button
   
   # For HeroUI
   pnpm add @heroui/react
   
   # For Aceternity (copy source)
   # Copy component code to custom directory
   ```

3. **File Organization**
   ```
   src/shared/components/ui/
   ├── shadcn/          # shadcn/ui components
   ├── heroui/          # HeroUI components
   ├── aceternity/      # Aceternity components
   └── custom/          # Custom components
   ```

4. **Import Rules** (Follow project standards)
   ```typescript
   // Relative imports - add .js extension
   import { Button } from './button.js'
   
   // Alias imports - no extension
   import { Button } from '@/shared/components/ui/button'
   ```

### Component Wrapper Pattern
Create wrappers for external components to maintain consistency:

```typescript
// Wrapper example
import { Button as HeroButton } from '@heroui/react'

export function Button({ variant = 'default', ...props }) {
  return (
    <HeroButton 
      variant={variant}
      className={cn('your-custom-classes', props.className)}
      {...props}
    />
  )
}
```

---

## 📊 **Usage Statistics**

| Library | Components | Usage | Maintenance |
|---------|------------|-------|-------------|
| shadcn/ui | 15+ | 🔥 High | ✅ Stable |
| Custom | 10+ | 🔥 High | ⚠️ Manual |
| HeroUI | 0 | 📋 Planned | ✅ Stable |
| Aceternity | 0 | 📋 Planned | ⚠️ Manual |

---

## 🔄 **Maintenance Tasks**

### Monthly
- [ ] Update component usage statistics
- [ ] Review new components from libraries
- [ ] Check for deprecated components
- [ ] Update documentation

### Quarterly
- [ ] Audit unused components
- [ ] Review design system consistency
- [ ] Plan new component additions
- [ ] Performance review

---

## 📚 **Resources**

- [shadcn/ui Documentation](https://ui.shadcn.com/)
- [HeroUI Documentation](https://www.heroui.com/)
- [Aceternity UI Components](https://ui.aceternity.com/)
- [Radix UI Documentation](https://www.radix-ui.com/)
- [Tailwind CSS Documentation](https://tailwindcss.com/)

---

**Last Updated**: January 2025  
**Maintained By**: BassNotion Team  
**Next Review**: February 2025 