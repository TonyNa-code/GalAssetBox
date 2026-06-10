# Safety and Legal Boundaries

GalAssetBox is an asset organizer, not a cracking or piracy tool.

## Allowed Scope

- Work on folders the user explicitly selects
- Copy open, loose files such as PNG, JPG, OGG, WAV, MP4, TXT, KS, RPY, JSON, and CSV
- Preserve original relative paths under category folders
- Generate local Markdown and CSV manifests
- Identify common resource archives as index-only records
- Route ordinary archive extraction through local tools such as 7-Zip, bsdtar, or unar after user confirmation
- Report recommended external-tool or adapter routes for ambiguous engine archives
- Store user-selected extractor executable paths locally when configured manually
- Register local authorized plugins for creator-owned, open-source, official-export, or explicitly licensed formats

## Out of Scope

- Providing games or copyrighted assets
- Circumventing DRM
- Sharing cracks, serials, keys, or bypass instructions
- Decrypting protected archives
- Unpacking proprietary resource archives without permission
- Bundling third-party game keys, cracking rules, or DRM bypass logic
- Uploading user game files to a third-party server

## Privacy Model

The static app runs in the browser. It only sees folders or files the user chooses.

The direct organizer uses the browser File System Access API:

- read permission for the selected source folder
- write permission for the selected output folder
- no telemetry
- no network upload
- no background scan outside selected folders

## Archive and Extractor Handling

Files such as `.xp3`, `.rpa`, `.nsa`, `.pck`, `.dat`, `.pak`, and Unity asset bundles are recorded in the manifest and routed through the extractor gateway.

Ordinary outer archives such as `.zip`, `.rar`, `.7z`, and `.tar` can be extracted by desktop builds through local tools. Extracted output is written to a separate result folder and can be scanned again.

Engine-specific or protected archives require an authorized adapter or external tool route. 受保护或未授权的引擎封包不拆包、不解密，不会通过 bundled third-party keys 提取。

Manual extractor paths are local configuration only. They are not uploaded, and diagnostic exports should not include the full path.

## Authorized Plugin Guardrails

Plugins must declare:

- user authorization is required
- local-only processing
- no DRM bypass
- no bundled third-party keys

The built-in app can run enabled transform plugins only after the user explicitly confirms the run and chooses an output folder.

Plugin output is written to a separate result directory, and output paths are validated to prevent directory traversal.

Plugin enablement is stored locally in the browser and can be reset from the plugin page.

External plugin import is manual and confirmation-gated. Imported plugins are local JavaScript files, so users should only load trusted files for authorized projects.

Plugin package import is also manual and confirmation-gated. A package manifest helps users inspect the package, but the plugin script must still pass the enforced runtime policy validation.

The plugin install area displays source metadata so users can distinguish built-in plugins, single-file imports, and package imports before enabling or running them.

The trial-run guide uses only local demo files under `examples/plugin-package-demo/` and does not contain third-party game data or DRM bypass behavior.

The output preview only shows paths for files written in the user-selected output folder. It does not expose or upload file contents.

Diagnostic package export is local-only. It contains metadata and relative paths, not asset contents, absolute paths, keys, or license material.

Help summary export is also local-only and designed for sharing with helpers. It contains aggregate counts, archive extension counts, plugin state, custom classification rules, and sanitized log highlights, but not asset contents, absolute local paths, keys, or license material.

## Desktop Bridge

The Electron desktop bridge only exposes local folder selection, selected-folder scanning, selected-file reads for authorized plugins, selected ordinary-archive extraction through local tools, writes to the selected output folder, and opening paths inside selected folders.

It does not run game executables, scan unrelated folders in the background, upload files, decrypt protected archives, bundle third-party keys, or bypass DRM.
