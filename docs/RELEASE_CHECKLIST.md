# Release Checklist

Use this before sharing a GalAssetBox build with other people.

## Local Checks

Run:

```bash
npm ci
npm run release:check
```

The release check verifies:

- required app, docs, Electron, plugin, and workflow files exist
- Electron dependency versions are pinned
- Electron renderer isolation and sandbox settings are present
- desktop bridge access stays limited to selected folders
- plugin safety wording and policy markers are present
- Windows packaging scripts and workflow are present
- help summary and category-rule features are present
- text files do not contain obvious local paths, private emails, old project names, or assistant transcript wording
- generated folders such as `node_modules/` and `dist/` are ignored
- dependency audit passes at `moderate` or higher, excluding optional packages

## Browser Smoke Test

Run:

```bash
python3 -m http.server 4174 --bind 127.0.0.1
```

Open:

```text
http://127.0.0.1:4174/
```

Check:

- `新手模式` hides advanced actions
- `高级功能` shows plugin, manifest, sample, and help-summary actions
- `npm run gateway:check` passes before packaging
- `载入样例` works
- `整理前预检` appears after sample data loads
- `分类` page can add and delete a simple classification rule
- `导出求助摘要` downloads a Markdown file

Stop the server after testing.

## Desktop Smoke Test

Run:

```bash
npm start
```

Check:

- the desktop window opens
- source and output folder pickers open native dialogs
- the app does not ask for unrelated folders

For a local macOS directory package:

```bash
npm run pack
```

Then launch:

```text
dist/mac-arm64/GalAssetBox.app
```

## Windows Build

Use GitHub Actions:

```text
Build Desktop Packages
```

Download:

```text
GalAssetBox-windows
```

Windows runtime behavior is not considered verified until someone opens the Windows build on a real Windows machine and completes a small copied-folder test.

## Sharing Boundary

Do not share:

- game files
- extracted copyrighted assets
- third-party keys
- protected archive decryption steps
- DRM or authorization bypass instructions

It is fine to share:

- the GalAssetBox source code
- the desktop app package
- local-only demo plugin files
- help summaries that contain only metadata and sanitized logs
