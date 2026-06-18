# StayBook Design System

## Brand & Style

The design system is rooted in the "Modern Heritage" aesthetic—a blend of classic hospitality elegance and contemporary digital precision. It is designed for high-end travelers who value reliability, ease of use, and a sense of "quiet luxury."

The visual style leans toward **Modern Minimalism** with a **Tactile** edge. It utilizes generous whitespace to reduce cognitive load during the booking process, while employing subtle textures and refined typography to evoke the feeling of a premium concierge service. The emotional response should be one of immediate calm, confidence, and anticipation of a high-quality stay.

---

## Colors

The palette is inspired by natural architectural materials.

| Token | Hex | Usage |
|-------|-----|-------|
| Primary | `#041627` | Critical functional elements like primary buttons and main navigation |
| Primary Container | `#1a2b3c` | Elevated primary surfaces |
| On Primary | `#ffffff` | Text on primary backgrounds |
| On Primary Container | `#8192a7` | Muted text on primary container |
| Inverse Primary | `#b7c8de` | Primary inverse for contrast surfaces |
| Secondary | `#775a19` | High-value highlights, ratings, premium tier indicators |
| Secondary Container | `#fed488` | Accent backgrounds |
| On Secondary Container | `#785a1a` | Text on secondary container |
| Tertiary | `#051913` | Success states and wellness features |
| Tertiary Container | `#1a2e27` | Elevated tertiary surfaces |
| On Tertiary Container | `#80968d` | Text on tertiary container |
| Error | `#ba1a1a` | Error states |
| Error Container | `#ffdad6` | Error backgrounds |
| On Error Container | `#93000a` | Text on error container |
| Background | `#fbf9fa` | Global background (warm off-white) |
| On Background | `#1b1c1d` | Primary text color |
| Surface | `#fbf9fa` | Cards and containers |
| Surface Dim | `#dbd9db` | Dimmed surfaces |
| Surface Bright | `#fbf9fa` | Bright surfaces |
| Surface Container Lowest | `#ffffff` | Pure white lifts |
| Surface Container Low | `#f5f3f4` | Subtle grouped backgrounds |
| Surface Container | `#efedef` | Default grouped backgrounds |
| Surface Container High | `#e9e7e9` | Elevated containers |
| Surface Container Highest | `#e4e2e3` | Highest container elevation |
| On Surface | `#1b1c1d` | Text on surfaces |
| On Surface Variant | `#44474c` | Secondary text |
| Inverse Surface | `#303032` | Dark inverse surfaces |
| Inverse On Surface | `#f2f0f2` | Text on inverse surfaces |
| Outline | `#74777d` | Borders and dividers |
| Outline Variant | `#c4c6cd` | Subtle borders |
| Surface Tint | `#4f6073` | Surface tint overlay |
| Surface Variant | `#e4e2e3` | Alternative surface color |
| Primary Fixed | `#d2e4fb` | Fixed primary color for specific components |
| Primary Fixed Dim | `#b7c8de` | Dimmed fixed primary |
| On Primary Fixed | `#0b1d2d` | Text on primary fixed |
| On Primary Fixed Variant | `#38485a` | Variant text on primary fixed |
| Secondary Fixed | `#ffdea5` | Fixed secondary color |
| Secondary Fixed Dim | `#e9c176` | Dimmed fixed secondary |
| On Secondary Fixed | `#261900` | Text on secondary fixed |
| On Secondary Fixed Variant | `#5d4201` | Variant text on secondary fixed |
| Tertiary Fixed | `#d0e8dd` | Fixed tertiary color |
| Tertiary Fixed Dim | `#b5ccc2` | Dimmed fixed tertiary |
| On Tertiary Fixed | `#0b1f19` | Text on tertiary fixed |
| On Tertiary Fixed Variant | `#364b43` | Variant text on tertiary fixed |

The palette is inspired by natural architectural materials:
- **Primary (Deep Navy):** Used for critical functional elements like primary buttons and main navigation to establish authority and trust.
- **Secondary (Soft Gold):** Used sparingly as an accent for high-value highlights, ratings, or premium tier indicators.
- **Tertiary (Sage):** Employed for success states and health/wellness-related features.
- **Neutral (Warm Off-White/Charcoal):** The background utilizes a warm off-white (`#fbf9fa`) to avoid the clinical feel of pure white, creating a more "inviting" atmosphere. Text hierarchy is strictly maintained through varying shades of charcoal rather than pure black.

---

## Typography

The system uses a serif/sans-serif pairing to balance tradition and modernity.

| Style | Font | Size | Weight | Line Height | Letter Spacing |
|-------|------|------|--------|-------------|----------------|
| Headline H1 | Libre Caslon Text | 48px | 700 | 1.2 | -0.02em |
| Headline H1 Mobile | Libre Caslon Text | 32px | 700 | 1.2 | - |
| Headline H2 | Libre Caslon Text | 36px | 600 | 1.3 | - |
| Headline H2 Mobile | Libre Caslon Text | 28px | 600 | 1.3 | - |
| Headline H3 | Libre Caslon Text | 24px | 600 | 1.4 | - |
| Headline H4 | Plus Jakarta Sans | 20px | 600 | 1.5 | - |
| Body Lg | Plus Jakarta Sans | 18px | 400 | 1.6 | - |
| Body Md | Plus Jakarta Sans | 16px | 400 | 1.6 | - |
| Body Sm | Plus Jakarta Sans | 14px | 400 | 1.5 | - |
| Label Md | Plus Jakarta Sans | 12px | 600 | 1 | 0.05em |

- **Headlines:** `Libre Caslon Text` provides an editorial, sophisticated feel. Large headlines should use tighter letter-spacing to maintain a "locked-in" premium look.
- **Body & UI:** `Plus Jakarta Sans` is used for all functional text. Its modern, slightly rounded apertures ensure high legibility in dense data views (like booking summaries) while remaining friendly.
- **Labels:** Small caps or increased letter spacing should be used for secondary metadata (e.g., "PER NIGHT" or "NON-REFUNDABLE") to differentiate functional data from narrative text.

---

## Layout & Spacing

The layout follows a **Fixed-Fluid Hybrid** model. While the content is constrained to a 1200px central container on desktop to maintain readability, background elements and image galleries may bleed to the edges of the viewport to create an immersive experience.

- **Grid:** A 12-column grid is used for desktop, 8-column for tablet, and 4-column for mobile.
- **Rhythm:** An 8px baseline grid governs vertical rhythm. All component heights and internal padding must be multiples of 4px.
- **Density:** High-end hospitality design requires "breathing room." Use `xl` (40px) or `2xl` (64px) spacing between major sections to emphasize the premium nature of the content.

### Spacing Scale

| Token | Value |
|-------|-------|
| Unit | 4px |
| xs | 4px |
| sm | 8px |
| md | 16px |
| lg | 24px |
| xl | 40px |
| 2xl | 64px |
| Container Max | 1200px |
| Gutter | 24px |

---

## Elevation & Depth

Depth is created through **Tonal Layering** and **Ambient Shadows**.

- **Surfaces:** The base background is the warm off-white. Interactive cards and containers use a pure white (`#ffffff`) surface to "lift" them off the page.
- **Shadows:** Avoid heavy, black shadows. Use soft, diffused shadows with a slight navy tint (`rgba(26, 43, 60, 0.05)`) to maintain the brand color harmony.
- **Interactions:** On hover, cards should subtly lift (increase blur and decrease y-offset) to signal interactivity without breaking the clean aesthetic.

---

## Shapes

The shape language is "Softly Geometric."

| Token | Radius |
|-------|--------|
| sm | 0.25rem (4px) |
| DEFAULT | 0.5rem (8px) |
| md | 0.75rem (12px) |
| lg | 1rem (16px) |
| xl | 1.5rem (24px) |
| full | 9999px |

- **Standard Components:** A radius of 8px (`0.5rem`) is the default for buttons, input fields, and small cards.
- **Large Containers:** Hero images and large promotional cards use 16px (`1rem`) to feel more approachable and modern.
- **Interactive Elements:** Checkboxes and radio buttons should maintain a crisp but slightly softened edge to match the UI.

---

## Components

### Buttons

- **Primary:** Deep Navy background, White text. High contrast, no border.
- **Secondary:** Clear background, Deep Navy border (1px), Deep Navy text.
- **Accent:** Soft Gold background for "Book Now" or "VIP" actions only.

### Cards

White background with an 8px radius and a 1px "Ghost Border" (`#EAE9E6`) instead of heavy shadows for a cleaner look.

### Inputs

Precise, 48px height for touch targets. Use the label-md typography for floating labels. Focus state is a 1px Gold border.

### Badges

Use Tertiary (Sage) for "Available" or "Eco-friendly" status, and a muted Gray for "Sold Out." Badges should use a pill shape (rounded-xl).

### Navigation

A transparent header that transitions to a solid Warm Off-White on scroll. Use high-contrast navy for links to ensure accessibility against imagery.

### Date Picker

Should emphasize the range selection using a Soft Gold translucent highlight between start and end dates.

---

## Usage Notes

- Maintain generous whitespace to reinforce the premium hospitality feel.
- Use the secondary gold accent sparingly to preserve its impact.
- Prioritize high contrast for accessibility, especially for booking actions and pricing.
- Reserve pure white (`#ffffff`) for lifted cards and containers; use the warm off-white background for the main canvas.
