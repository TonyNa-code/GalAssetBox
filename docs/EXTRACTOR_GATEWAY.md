# Extractor Gateway

GalAssetBox now has a desktop-only extractor gateway.

It is not a universal cracker. It is a local routing layer that detects file types, checks available tools, and sends authorized work to the right class of extractor.

## Layers

1. Common archives
   - Examples: `.zip`, `.rar`, `.7z`, `.tar`, `.gz`, `.iso`
   - Signature-detected common archives are also eligible, even when the extension is generic such as `.dat` or `.pak`
   - Tools: `7zz`, `7z`, `bsdtar`, `unar`
   - Current status: can extract to `GalAssetBox_通用解包结果_*/10_通用解包输出/`
   - After extraction, the desktop UI can register `10_通用解包输出/` as the new source and scan it directly.
   - Failed fallback attempts write to temporary directories and are cleaned before the next tool is tried.

2. Visual novel and game archives
   - Examples: `.xp3`, `.rpa`, `.nsa`, `.arc`, `.pck`, `.dat`, `.pak`
   - Tools: GARbro, Game Extractor, or a local authorized adapter
   - Current status: route planning only unless a trusted adapter is added

3. Unity assets
   - Examples: `.assets`, `.unity3d`, `.bundle`
   - Tool route: AssetRipper
   - Current status: route planning only

4. Game audio
   - Examples: `.hca`, `.adx`, `.awb`, `.wem`, `.fsb`
   - Tool route: `vgmstream-cli`; `ffmpeg` is only a helper for ordinary media and does not make game-audio routes ready by itself
   - Current status: route planning only

5. Media probe
   - Examples: `.movie`, common video containers
   - Tool route: `ffprobe` / `ffmpeg`
   - Current status: route planning only

6. Signature scan
   - For routed archive candidates, GalAssetBox reads a small header and reports what can be inferred.
   - This is not decryption and cannot recover compressed or protected content by itself.

## Safety Boundary

The gateway may call local command-line tools, but only inside folders the user selected in the desktop app.

It does not:

- run game executables
- upload files
- scan unrelated folders
- decrypt protected archives
- bypass DRM or authorization checks
- bundle third-party game keys

Common archive extraction writes to a separate result folder. After extraction, select that result folder as the source and scan again to classify CG, sprites, music, video, and text.

## Tool Configuration

The desktop app first looks for supported tools in PATH. If a tool is installed somewhere else, use the archive page's tool configuration area and choose the executable file manually.

Manual paths are stored in the app's local user-data configuration as `extractor-tools.json`.

The renderer UI shows only the tool name and executable file name. Diagnostic exports include availability, source type, and command file name, not the full local path.
IPC responses are sanitized before they reach the renderer; full executable paths stay in the Electron main process.

Manual configuration is for local extraction tools only. It does not grant permission to bypass DRM, provide keys, or unpack protected archives without authorization.

## Why This Exists

Game resource extensions are not reliable format names. A `.pak` from one engine can be completely different from a `.pak` from another engine.

The gateway keeps the app honest:

- ordinary archives go through ordinary archive tools
- known engines go through specialized tools or adapters
- ambiguous files are reported instead of guessed
- protected content stays outside the project scope
