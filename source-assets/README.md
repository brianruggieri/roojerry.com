# Source Assets

Drop **original, unoptimised** images here.  
The asset pipeline (`npm run assets`) will compress, convert and deploy them
into `static/img/` automatically.

## Directory layout

Mirror the structure you want under `static/img/`:

```
source-assets/
├── projects/
│   ├── daily-digest/
│   │   └── digest-hero.png      ← raw screenshot / export
│   └── nurbits/
│       └── nurbits-hero.jpg
├── achievements/
│   └── coin-clicker-gold.png
├── me-illustration.png
└── manifest.json                ← auto-generated, do not edit
```

After running `npm run assets`, the pipeline produces:

```
static/img/
├── projects/daily-digest/
│   ├── digest-hero.png          ← optimised PNG
│   └── digest-hero.webp         ← WebP variant
└── ...
```

## Commands

| Command              | Description                                    |
| -------------------- | ---------------------------------------------- |
| `npm run assets`     | Process new & changed images                   |
| `npm run assets:check` | Verify all sources are up-to-date (CI gate) |
| `npm run assets:clean` | Remove generated outputs & manifest          |

## Supported formats

PNG, JPG/JPEG, GIF, TIFF, BMP, SVG.  
Raster images get a compressed original **plus** a WebP version.  
SVGs are copied as-is (vector, no raster conversion).

## How it works

1. Each source file is hashed (SHA-256).
2. The hash is compared against `manifest.json`.
3. Changed files are compressed with [sharp](https://sharp.pixelplumbing.com/):
   - **PNG** → `compressionLevel: 9` + adaptive filtering
   - **JPG** → MozJPEG `quality: 82`
   - **WebP** → `quality: 80, effort: 6`
4. Outputs land in `static/img/` and the manifest is updated.

Unchanged images are skipped — the pipeline is idempotent.
