# UI Component Guide

Quick reference for building consistent, theme-aware components.

## Core Principles

1. **Always use theme variables** - Never hardcode colors (`text-white`, `bg-black`, `text-neutral-600`)
2. **Use `cn()` utility** - For conditional classes: `cn("base", condition && "conditional")`
3. **Semantic naming** - Use `primary`, `destructive` not `blue`, `red`

---

## Theme Variables

### Backgrounds
`bg-background` `bg-sidebar` `bg-chat` `bg-input-background` `bg-card` `bg-muted` `bg-accent`

### Text
`text-foreground` `text-muted-foreground` `text-card-foreground` `text-primary` `text-destructive`

### Borders & Inputs
`border-border` `border-input` `ring-ring`

### Interactive
`hover:bg-accent` `hover:text-accent-foreground` `focus:ring-ring`

---

## Common Patterns

### Buttons
```tsx
// Primary
<button className="bg-primary text-primary-foreground hover:bg-primary/90">Submit</button>

// Destructive
<button className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</button>

// Ghost
<button className="hover:bg-accent hover:text-accent-foreground">Action</button>
```

### Cards
```tsx
<div className="rounded-lg border border-border bg-card p-6">
  <h3 className="text-lg font-semibold text-card-foreground">Title</h3>
  <p className="text-sm text-muted-foreground">Description</p>
</div>
```

### Forms
```tsx
<label className="block text-sm font-medium text-foreground mb-1">Field</label>
<input className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-ring focus:ring-1 focus:ring-ring" />
<p className="text-sm text-destructive">Error message</p>
```

### Tables
```tsx
<thead>
  <tr className="border-b border-border bg-muted">
    <th className="px-4 py-2 text-xs font-semibold text-muted-foreground">Header</th>
  </tr>
</thead>
<tbody>
  <tr className="border-b border-border hover:bg-accent">
    <td className="px-4 py-3 text-sm text-foreground">Content</td>
  </tr>
</tbody>
```

### Status Indicators
```tsx
// Error
<div className="bg-destructive/10 text-destructive-foreground border border-destructive/20">Error</div>

// Badge
<span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">Info</span>
```

---

## Using `cn()`

```tsx
import { cn } from "@/lib/utils";

// Conditionals
<div className={cn("base", isActive && "bg-accent", variant === "primary" && "text-primary")}>

// Merging
<div className={cn("base-class", className)}>
```

---

## Do's and Don'ts

### ✅ DO
```tsx
<div className="bg-card text-card-foreground border border-border">
<div className={cn("base", condition && "conditional")}>
<button className="bg-destructive text-destructive-foreground">Delete</button>
<div className="bg-foreground/80">  // Opacity overlay
```

### ❌ DON'T
```tsx
<div className="bg-white text-black">              // ❌
<div className="text-neutral-600">                // ❌
<div className="bg-blue-100 text-blue-800">        // ❌
<div style={{ backgroundColor: '#fff' }}>         // ❌
<div className="bg-card text-neutral-600">        // ❌
```

---

## Quick Checklist

- [ ] No hardcoded colors (`white`, `black`, `neutral-*`, `gray-*`, `blue-*`)
- [ ] All colors use theme variables
- [ ] `cn()` used for conditionals
- [ ] Works in light and dark modes
- [ ] Borders use `border-border` or `border-input`

---

## Reference

- Theme variables: `/src/app/globals.css`
- Examples: `/src/components` and `/src/components/ui`
