# GalAssetBox

GalAssetBox 是一个本地优先的 galgame 资源整理器。

它面向合法拥有或获得授权的本地游戏/项目文件夹，把已经明文存在的开放格式素材按类别复制到一个新的整理结果文件夹：

- CG / 事件图
- 立绘
- 背景
- 音乐
- 语音
- 音效
- 视频
- 文本脚本

## 当前版本

当前包含两种使用方式：

- 网页版：直接打开 `index.html`，不需要安装依赖。
- 桌面版：使用 Electron 壳子，适合以后打包成双击运行的软件。

它可以：

- 选择游戏文件夹
- 选择输出文件夹
- 默认新手模式，只显示最常用整理流程
- 扫描后显示整理前预检，提示将整理数量、开放素材总数、封包和预计复制大小
- 扫描开放格式文件名、大小和路径
- 按分类复制素材并保留原始子目录结构
- 桌面版整理完成后可以一键打开结果文件夹
- 生成 `GalAssetBox_整理报告.md`
- 生成 `GalAssetBox_素材清单.csv`
- 识别 `.xp3`、`.rpa`、`.nsa`、`.pck`、`.dat` 等常见资源封包并写入清单
- 提供授权插件接口，用于自制、开源或明确授权项目的格式适配
- 用户确认后运行已启用的授权插件，把输出写入独立插件结果目录
- 在插件页启用/停用插件，状态保存在当前浏览器本地
- 从界面导入可信本地 `.js` 插件文件
- 从界面导入包含 `plugin.json` 的可信插件包文件夹
- 在插件安装区查看版本、作者、来源、入口文件和最近导入时间
- 导出可转发的 `求助摘要`，不包含素材内容、绝对本机路径、密钥或授权材料
- 在分类页添加简单分类规则，例如把路径包含 `tachie` 的开放图片识别为立绘

它不会：

- 提供游戏本体或素材下载
- 破解封包
- 绕过 DRM
- 运行游戏程序
- 上传本地文件
- 自动扫描用户没有选择的目录
- 内置第三方游戏密钥、破解规则或 DRM 绕过逻辑

## 使用方式

直接打开：

```text
index.html
```

如果浏览器不允许网页直接写入文件夹，用本地服务器打开：

```bash
cd GalAssetBox
python3 -m http.server 4174
```

然后访问：

```text
http://localhost:4174
```

推荐使用 Chrome 或 Edge。Safari / Firefox 可能只能生成素材清单，不能直接复制到输出文件夹。

## Desktop App

项目已经加入 Electron 桌面版：

- [DESKTOP.md](./docs/DESKTOP.md)
- [WINDOWS.md](./docs/WINDOWS.md)
- [RELEASE_CHECKLIST.md](./docs/RELEASE_CHECKLIST.md)
- [electron/main.js](./electron/main.js)
- [electron/preload.js](./electron/preload.js)
- [package.json](./package.json)
- [package-lock.json](./package-lock.json)

安装依赖后可以运行：

```bash
npm install
npm start
```

发布前自检：

```bash
npm run release:check
```

打包本机目录版：

```bash
npm run pack
```

打包 Windows 安装器和 zip：

```bash
npm run dist:win
```

也可以用 GitHub Actions 自动打包 Windows 产物，见 [WINDOWS.md](./docs/WINDOWS.md)。

在 macOS Apple Silicon 上，本机验证产物会出现在：

```text
dist/mac-arm64/GalAssetBox.app
```

桌面版会使用系统文件夹选择器和本地桥接层，浏览器版仍然可以继续直接打开 `index.html` 使用。

## 整理结果

输出文件夹里会生成类似这样的目录：

```text
GalAssetBox_整理结果_20260513_0030/
  01_CG/
  02_立绘/
  03_背景/
  04_其他图片/
  05_音乐/
  06_语音/
  07_音效/
  08_视频/
  09_文本脚本/
  GalAssetBox_整理报告.md
  GalAssetBox_素材清单.csv
```

素材会按原始相对路径放进去，尽量避免同名文件互相覆盖。

## 边界

GalAssetBox 只整理用户自己选择的本地文件夹中已经明文存在的开放格式文件。

加密或专有资源封包只做识别和清单提示，不做拆包、解密、破解或 DRM 绕过。

## 授权插件接口

项目里预留了本地授权插件接口：

- [PLUGIN_API.md](./docs/PLUGIN_API.md)
- [authorized-plugins.js](./src/authorized-plugins.js)
- [demo.gabpack.json](./examples/demo.gabpack.json)
- [external-demo-plugin.gabplugin.js](./examples/external-demo-plugin.gabplugin.js)
- [plugin-package-demo/](./examples/plugin-package-demo/)

这个接口适合接入自制游戏、开源项目、官方导出格式或明确授权的轻量转换逻辑。插件必须声明本地运行、用户授权、不绕过 DRM、不内置第三方密钥。

当前内置了一个安全示例插件：`授权 GAB JSON 包读取器`。它只读取 `.gabpack.json` 这种示例格式，不包含第三方游戏规则、密钥或 DRM 绕过逻辑。

插件页可以直接启用或停用插件，也可以恢复默认状态。这个设置只保存在当前浏览器，不会上传。

外部插件可以通过插件页的 `导入本地插件` 手动加载。导入的是本地 JavaScript 代码，只导入来源可信、用途明确、面向授权项目的插件。

插件包可以通过插件页的 `导入插件包` 手动加载。插件包目录需要包含 `plugin.json`，并由 `plugin.json` 的 `main` 指定入口脚本。

插件页的 `插件安装区` 会显示插件来源：

- `内置`
- `单文件`
- `插件包`

也会显示版本、作者、许可证、来源文件、入口脚本和导入时间。

## Demo Trial Run

插件页内置 `真实试跑向导`，可以用示例插件包完整跑一遍：

1. 选择游戏文件夹：`examples/plugin-package-demo/`
2. 选择任意输出文件夹
3. 在插件页点 `导入插件包`，仍然选择 `examples/plugin-package-demo/`
4. 点 `扫描素材`
5. 点 `运行授权插件`
6. 到输出文件夹查看 `GalAssetBox_授权插件结果_日期时间/10_授权插件输出/`

示例只处理 `sample.packagepack.json`，不包含第三方游戏规则、密钥、破解或 DRM 绕过逻辑。

运行完成后，插件页的 `最近输出结果` 会显示：

- 结果文件夹名
- `GalAssetBox_授权插件报告.md`
- `GalAssetBox_授权插件清单.csv`
- `10_授权插件输出/`
- 前几条实际写出的文件路径

## Diagnostic Package

插件页可以点击 `导出诊断包` 下载一个 JSON，方便别人帮忙排查。

诊断包包含：

- 扫描统计
- 相对路径文件清单
- 插件启用状态
- 插件来源和版本
- 当前插件匹配结果
- 最近一次插件运行摘要
- 最近日志

诊断包不包含：

- 游戏文件内容
- 图片、音乐、视频、文本正文
- 绝对本地路径
- 密钥或授权材料
