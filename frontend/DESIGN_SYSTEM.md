# Race Result Dashboard: Design System & AI Prompt

## 1. Optimized AI Prompt (The "Master" Prompt)

> **Task:** Develop a premium Race Results Web Dashboard.
> **Core Logic:** Real-time BIB number search functionality and a dynamic global leaderboard.
> **Aesthetic:** Modern-Athletic / Precision-Sport style. Avoid generic "model" layouts; prioritize data density with high-end UI finishes.
> **Color Specs:** Primary Blue (#2563EB), Accent Red (#FF0E65), Base White (#FFFFFF).
> **UI Requirements:** Implement sophisticated hover states, glassmorphism on navigation components, and a "strong/healthy" bold typography hierarchy.

---

## 2. Visual Identity (Design System)

### **Core Palette**

- **Primary Action (Blue):** `#2563EB` — Used for navigation, primary buttons, and BIB focus.
- **Energy Accent (Red):** `#FF0E65` — Used for "Live" status, top-rank highlights, and critical CTA hover states.
- **Surface (White/Grey):** `#FFFFFF` for cards; `#F8FAFC` for background tracking.
- **Typography (Slate):** `#1E293B` — Used for maximum readability on race data.

### **Interactive Elements (Hover & Feedback)**

- **The "Lift" Effect:** Leaderboard rows should use `transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1)`. On hover: `transform: translateX(4px);` with a `#FF0E65` left-border accent.
- **The "Glass" Header:** `background: rgba(255, 255, 255, 0.7); backdrop-filter: blur(12px);` for the sticky leaderboard header.
- **Search Interaction:** The BIB search bar expands slightly on focus with a `0 0 0 4px rgba(37, 99, 235, 0.2)` outer glow.

### **Typography & Grid**

- **Headings:** Heavyweight Sans-Serif (Inter/Oswald) - All Caps for race titles.
- **Data Points:** Monospace or high-legibility Sans for BIB numbers and Finish Times.
- **Grid:** 12-column responsive grid with 24px gutters.

---

## 3. Component Specifications

| Component        | Style Detail                                                      |
| :--------------- | :---------------------------------------------------------------- |
| **BIB Search**   | Floating center-top, high-shadow, bold input text.                |
| **Leaderboard**  | Zebra-striped rows (`#F1F5F9`), interactive on hover.             |
| **Status Badge** | Rounded-pill shape, `#FF0E65` pulse animation for "Active" races. |
| **Result Cards** | 6px border-radius, subtle border-bottom, high contrast.           |
