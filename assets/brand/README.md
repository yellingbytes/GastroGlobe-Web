# GastroGlobe mark

A globe drawn on the atlas's square grid, with a fork in negative space. The
single-color silhouette stays recognizable when color or detail is unavailable.

- `gastroglobe-mark.svg`: editable master, transparent background, dark ink.
- `gastroglobe-mark.png`: transparent 512px export.
- `favicon.svg`: paper-backed icon with the small equator details removed.
- `favicon-16.png`, `favicon-32.png`, `favicon-48.png`: browser exports. The 16px
  version has a hand-hinted fork so its tines align to whole pixels.
- `/favicon.ico`: the three PNG sizes in a single browser-compatible container.
- `apple-touch-icon.png`: opaque 180px icon, with room for the system's mask.
- `app-icon-512.png`: opaque 512px icon.
- `logo-preview.png`: light, reversed, and small-size examples.

Ink: `#23201b`. Paper: `#efeae0`. Leave at least one eighth of the mark's width as
clear space around it. Use the simplified favicon at 24px and below. Reverse the
ink to paper when using the transparent mark on a dark background.

Rebuild PNG and ICO exports with `node scripts/build-brand-icons.mjs` when Sharp
is installed. A bundled Sharp installation can be selected by setting
`GASTROGLOBE_SHARP_PATH` to its package directory.
