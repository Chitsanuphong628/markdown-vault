# Nota Design System Specification (`DESIGN.md`)

> **Philosophy**: Developer-First, Fast, Minimalist, High Contrast.  
> No marketing fluff, no AI-slop gradients, no generic card bloat. Engineered with precision like Raycast, Linear, and GitHub CLI.

---

## 1. Color Palette & Theming
Nota adheres strictly to a deep-monochrome dark foundation with a single energetic Indigo/Purple accent:

| Token | Hex Value | Usage |
| :--- | :--- | :--- |
| **Canvas / Root** | `#090a0f` | Background of application & viewports |
| **Surface / Card** | `#0f1117` | Modals, panels, sidebars, floating widgets |
| **Surface Raised** | `#161922` | Codeblocks, inputs, active tree rows, tooltips |
| **Border Subtle** | `#222634` | 1px clean separators, table dividers |
| **Border Active** | `#4f46e5` | Active focus rings, selected outlines |
| **Foreground Primary** | `#f3f4f6` | Headings, document titles, primary text |
| **Foreground Muted** | `#9ca3af` | Secondary labels, descriptions, metadata |
| **Foreground Subtle** | `#6b7280` | Placeholders, icons in idle state, hotkey hints |
| **Accent Primary** | `#6366f1` | Indigo button fills, interactive triggers, logo |
| **Success Status** | `#10b981` | Live indicator, copied badges, public links |
| **Danger Status** | `#f43f5e` | Destructive deletes, fatal error toasts |

---

## 2. Typography
- **UI Sans-Serif**: Clean system font stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`) with compact letter-spacing (`tracking-tight`).
- **Code & Developer HUD**: Monospace (`ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`) for tool names, IDs, hotkey badges, and configurations.
- **Rules**:
  - Avoid oversized promotional headings inside working dialogs.
  - Labels use uppercase tracking (`text-[10px] uppercase tracking-wider font-semibold text-neutral-400`).

---

## 3. Component Guidelines

### A. Settings Modal (Developer HUD Pattern)
- **Header**: Minimal 48px height with clean title, logo icon, hotkey tag (`ESC` / `⌘,`), and dismiss cross.
- **Navigation**: Clean left sidebar with 1px border separator.
- **Copyable Command / Config**: Single-click copyable blocks with monospace code snippets and concise status indicators.
- **Tool Listing**: Compact table/list layout with method tags (`GET`, `POST`, `RPC`) and exact symbol names instead of heavy colorful cards.

### B. Workspace Sidebar
- Smooth collapsible folder tree with exact line indentation.
- Native HTML5 Drag & Drop with 1px outline dropzone indicators.
- Quick actions (`New Note`, `New Folder`, `Import`) grouped compactly.

### C. Markdown Viewer & Editor
- Dynamic Table of Contents (TOC) following viewport scroll smoothly.
- Syntax-highlighted codeblocks (`atom-one-dark`) with instant copy buttons.
- AST-mapped interactive task lists allowing click-anywhere toggle.
- Dynamic Mermaid diagram generator directly from ` ```mermaid ` blocks.
