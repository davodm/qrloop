# qrloop web importer

Vite camera demo that accumulates qrloop frames until the payload is complete.

Uses `BarcodeDetector` when available, with a `jsQR` fallback.

```bash
# from repo root
yarn build
cd examples/web-importer
yarn
yarn dev
```

Point the camera at the looping QR codes from [`../web-exporter`](../web-exporter).
