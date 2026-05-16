# Windows Packaging

GalAssetBox can build a Windows desktop package with Electron Builder.

## GitHub Actions

The easiest route is the included workflow:

```text
.github/workflows/build-desktop.yml
```

Run it from GitHub:

1. Open the repository on GitHub.
2. Go to `Actions`.
3. Choose `Build Desktop Packages`.
4. Click `Run workflow`.
5. Download the `GalAssetBox-windows` artifact after the run finishes.

The workflow runs:

```bash
npm ci
npm run release:check
npm run dist:win
```

It uploads the Windows `.exe` installer and `.zip` package from `dist/`.

## Local Windows Build

On a Windows machine with Node.js installed:

```bash
npm ci
npm run release:check
npm run dist:win
```

Generated files are written to:

```text
dist/
```

Expected outputs include:

```text
GalAssetBox-0.1.0-x64.exe
GalAssetBox-0.1.0-x64.zip
```

## Before Sharing

Do a real test on a copied sample folder before sharing a build:

1. Open GalAssetBox.
2. Choose a small source folder.
3. Choose an empty output folder.
4. Click `扫描素材`.
5. Check `整理前预检`.
6. Click `开始整理`.
7. Confirm `打开结果文件夹` opens the generated result directory.

The Windows package has the same safety boundary as the browser and macOS builds: local folders only, no upload, no game execution, no protected archive decryption, and no DRM bypass.
