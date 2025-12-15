# Vaporwave Space Theme

This theme introduces a cohesive "Vaporwave Space" aesthetic for the Threads UI while keeping the underlying Bootstrap structure intact.

## Design Tokens
The theme exposes CSS variables in `app/assets/stylesheets/nymspace_vaporwave.scss` for quick customization:

- `--bg`: page background base color
- `--surface` / `--surface2`: layered surface backgrounds
- `--border`: subtle outline color
- `--text`: primary text color
- `--muted`: secondary text and metadata
- `--primary`: main highlight/magenta accent
- `--accent`: cyan accent
- `--danger`: destructive actions
- `--success`: positive actions
- `--glow`: reusable soft glow shadow
- `--radius-sm` / `--radius-md` / `--radius-lg`: rounding scale for controls and cards

Update these variables to tweak the look without hunting through component rules.

## Key Treatments
- **Background**: layered gradients with a CSS-only starfield; applied via the `vaporwave-space` body class.
- **Navigation and surfaces**: translucent panels with subtle glows and softened borders.
- **Buttons and inputs**: unified gradients, clear focus rings, and rounded edges for consistency and accessibility.
- **Chat UI**: differentiated incoming/outgoing message bubbles, timestamp badges, and a glowing "Cloak: ON" privacy chip.
- **Devise/Rails Admin**: inherits the same background, typography, and control styling for a consistent experience across pages.

## Usage
- The theme is imported from `app/assets/stylesheets/application.scss`.
- Keep layouts using the `vaporwave-space` class on `<body>` to preserve the background and base colors.
- Prefer existing Bootstrap/rails view structures; add lightweight classes only when a new hook is needed.

