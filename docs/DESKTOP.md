# Desktop App Notes

GalAssetBox has an Electron shell for a local double-click desktop app.

## Run Locally

Install dependencies once:

```bash
npm install
```

Start the desktop app:

```bash
npm start
```

## Package

Directory package:

```bash
npm run pack
```

Installer/distributable:

```bash
npm run dist
```

Windows installer and zip:

```bash
npm run dist:win
```

For GitHub Actions packaging, see [WINDOWS.md](./WINDOWS.md).

Current local verification on macOS Apple Silicon:

- `npm install`
- `npm run check`
- `npm start`
- `npm run pack`
- `dist/mac-arm64/GalAssetBox.app/Contents/MacOS/GalAssetBox`

The verified directory package is written to:

```text
dist/mac-arm64/GalAssetBox.app
```

`dist/` is ignored by Git because it is generated output.

## What the Desktop Bridge Adds

The browser version still works as before. In Electron, the preload bridge exposes local-only helpers for:

- choosing source and output folders with native dialogs
- scanning selected folders
- copying open-format assets to the selected output folder
- opening the generated result folder after a completed run
- reading files for authorized plugins
- writing authorized plugin output and reports

The bridge does not upload files, run game executables, decrypt protected archives, bundle third-party keys, or bypass DRM.

## Security Defaults

- `nodeIntegration` is disabled in the renderer
- `contextIsolation` is enabled
- renderer sandboxing is enabled
- only the small `GalAssetBoxDesktop` bridge is exposed
- bridge file reads/writes are limited to folders the user selected in native dialogs
- all output paths are sanitized
- relative paths containing `..` are rejected

Desktop packaging is preparation work. Before public release, test on a clean Windows machine with a copied sample folder and verify the generated output package manually.

Known release polish still left:

- add a custom app icon
- configure release signing/notarization if distributing outside local testing
- run a clean Windows package test before publishing a Windows installer
