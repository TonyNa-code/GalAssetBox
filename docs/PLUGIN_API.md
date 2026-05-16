# GalAssetBox 授权插件接口

GalAssetBox 可以通过本地 JavaScript 插件识别自定义资源格式，或为自制、开源、官方导出、明确授权的项目接入轻量转换逻辑。

这个接口不是破解接口。插件不得内置第三方游戏密钥、破解规则、DRM 绕过、授权校验绕过或联网上传。

## 当前能力

当前版本已经有：

- 插件注册表
- 插件安全策略校验
- 插件页展示
- 扫描后显示已启用插件的匹配结果
- 用户确认后执行已启用插件
- 插件启用/停用开关
- 浏览器本地保存插件状态
- 手动导入可信本地 `.js` 插件
- 手动导入可信插件包文件夹
- 插件安装区元数据展示
- 插件输出路径安全校验
- 独立插件输出目录
- 授权插件 Markdown / CSV 报告

## 插件文件

内置插件放在：

```text
src/authorized-plugins.js
```

外部插件可以在 `插件` 页点击 `导入本地插件` 选择 `.js` 或 `.gabplugin.js` 文件。外部插件是本地 JavaScript 代码，必须来自可信来源，并且仍然要通过安全策略校验。

插件包可以在 `插件` 页点击 `导入插件包` 选择一个包含 `plugin.json` 的文件夹。

页面加载顺序是：

```html
<script src="./src/plugin-host.js"></script>
<script src="./src/authorized-plugins.js"></script>
<script src="./src/app.js"></script>
```

## 最小插件模板

```js
window.GalAssetBoxPluginHost.registerAuthorizedPlugin({
  id: "my-team.my-authorized-format",
  name: "我的授权格式适配器",
  description: "只用于自己项目或明确授权项目的资源格式。",
  enabled: false,
  capabilities: ["inspect", "authorized-transform-template"],
  policy: {
    requiresUserAuthorization: true,
    localOnly: true,
    noDrmBypass: true,
    noBundledThirdPartyKeys: true,
  },
  notes: "不要写入第三方游戏密钥、破解规则或 DRM 绕过流程。",
  match(record) {
    if (record.ext !== "myvnpack") return null;
    return {
      confidence: "medium",
      label: "我的授权格式",
      note: "扫描命中，等待用户确认后才能执行后续转换。",
    };
  },
  async transform({ readText }) {
    const source = await readText();
    return [
      {
        path: "example.txt",
        text: source,
        type: "text/plain;charset=utf-8",
      },
    ];
  },
});
```

## `match(record)`

`record` 字段：

- `path`: 相对路径
- `name`: 文件名
- `ext`: 小写扩展名
- `size`: 文件大小
- `categoryId`: GalAssetBox 当前分类
- `action`: `copy`、`index-only` 或 `skip`

返回 `null` 表示不匹配。

返回对象表示匹配：

```js
{
  confidence: "high",
  label: "格式名称",
  note: "显示给用户看的说明"
}
```

## `transform(context)`

只有声明了 `transform` 的插件才会显示为“可执行”。执行前用户必须选择输出文件夹，并在确认弹窗中确认授权。

`context` 字段：

- `record`: 和 `match(record)` 类似的文件信息
- `match`: `match(record)` 返回的说明信息
- `file`: 浏览器 File 对象
- `readText()`: 读取源文件文本
- `readArrayBuffer()`: 读取源文件二进制内容

`transform` 返回数组，每一项是要写出的文件：

```js
[
  {
    path: "scenario/scene01.txt",
    text: "hello",
    type: "text/plain;charset=utf-8",
  },
  {
    path: "image.bin",
    bytes: new Uint8Array([1, 2, 3]),
    type: "application/octet-stream",
  },
]
```

允许的内容字段：

- `text`
- `bytes`
- `arrayBuffer`
- `blob`

限制：

- 单个插件匹配项最多输出 500 个文件
- 输出路径不能包含 `..`
- 输出路径会被清理为安全文件名
- 所有结果都写入 `10_授权插件输出/<plugin id>/...`

## 示例授权包

仓库里有一个安全示例：

```text
examples/demo.gabpack.json
```

这个示例只演示“自制/授权格式如何声明开放文件”，不包含任何第三方游戏规则、密钥、破解或 DRM 绕过逻辑。

## 插件开关

用户可以在 `插件` 页启用、停用或恢复默认插件状态。

开关状态存在浏览器本地 `localStorage`，键名是：

```text
GalAssetBox.plugin.enabled.v1
```

这个设置不会上传，也不会修改插件文件本身。

## 插件元数据

插件脚本可以声明：

```js
{
  version: "0.1.0",
  author: "Your team",
  license: "MIT",
}
```

插件包导入时，`plugin.json` 里的 `version`、`author`、`license`、`description` 也会显示在插件安装区。插件脚本自己的字段优先级更高；没有写时使用插件包清单里的值。

插件来源会显示为：

- `内置`
- `单文件`
- `插件包`

## 外部插件导入

外部插件文件示例：

```text
examples/external-demo-plugin.gabplugin.js
```

测试数据示例：

```text
examples/external-demo-pack.externaldemo.json
```

导入流程：

1. 打开 `插件` 页。
2. 点击 `导入本地插件`。
3. 选择 `.js` 或 `.gabplugin.js` 插件文件。
4. 阅读确认弹窗。
5. 导入后插件会出现在插件列表，来源标记为 `外部导入`。

限制：

- 单个插件文件最大 1 MB
- 只接受 `.js` / `.gabplugin.js`
- 插件必须调用 `registerAuthorizedPlugin`
- 插件必须声明安全策略
- 插件只在当前页面会话中加载；刷新页面后需要重新导入
- 启用/停用状态会存在浏览器本地

外部插件本质上是本地 JavaScript 代码。只导入你信任的插件，不要导入来源不明的文件。

## 插件包结构

插件包示例：

```text
examples/plugin-package-demo/
  plugin.json
  plugin.gabplugin.js
  sample.packagepack.json
  README.md
```

`plugin.json` 示例：

```json
{
  "format": "GalAssetBox.pluginPackage.v1",
  "id": "example.package-demo-authorized-pack",
  "name": "插件包示例：授权 JSON 包",
  "version": "0.1.0",
  "main": "plugin.gabplugin.js",
  "description": "演示 GalAssetBox 插件包目录结构，只处理 packagepack.json 示例格式。",
  "safety": {
    "requiresUserAuthorization": true,
    "localOnly": true,
    "noDrmBypass": true,
    "noBundledThirdPartyKeys": true
  }
}
```

插件包导入限制：

- 文件夹里需要且只能有一个 `plugin.json`
- `format` 必须是 `GalAssetBox.pluginPackage.v1`
- `main` 必须指向包内 `.js` 或 `.gabplugin.js`
- `main` 不能包含 `..`
- 包内文件总大小最大 2 MB
- `main` 文件最大 1 MB
- 插件仍然必须调用 `registerAuthorizedPlugin`
- 插件仍然必须声明安全策略
- 插件包只在当前页面会话中加载；刷新页面后需要重新导入

`plugin.json` 的 `safety` 字段用于给人检查包声明；真正执行时仍以插件脚本里的 `policy` 为强制校验。

## 真实试跑向导

插件页会根据当前状态显示试跑步骤是否完成：

- 是否选择源目录
- 是否选择输出目录
- 是否导入 `example.package-demo-authorized-pack`
- 插件是否启用
- 是否扫描到 `sample.packagepack.json`
- 是否满足运行条件

这个向导用于验证插件包导入和授权插件执行流程，不会自动选择文件夹或绕过浏览器权限。

## 输出结果预览

授权插件运行完成后，插件页会显示最近一次运行结果：

- result root folder name
- Markdown report path
- CSV manifest path
- plugin output root path
- first written output paths
- failed rows, if any

This preview is UI-only and stored in the current page session. Refreshing the page clears it, but the files already written to the selected output folder remain there.

## Diagnostic Package

The plugin page can export a diagnostic JSON:

```json
{
  "format": "GalAssetBox.diagnostic.v1"
}
```

It contains:

- app and plugin API version
- source/output folder names only
- scan counts
- relative-path manifest metadata
- plugin metadata and enablement state
- current plugin matches
- last plugin run summary
- recent log lines

It does not contain:

- file contents
- asset bytes
- absolute local paths
- keys or license material

## 必填安全策略

每个插件必须显式声明：

```js
policy: {
  requiresUserAuthorization: true,
  localOnly: true,
  noDrmBypass: true,
  noBundledThirdPartyKeys: true,
}
```

缺少这些字段时，插件会被拒绝注册。

## 不允许做的事

- 自动提取第三方游戏密钥
- 内置第三方游戏密钥
- 绕过正版授权、DRM、登录、联网校验
- 提供破解补丁、序列号、绕过步骤
- 上传用户文件到外部服务器
- 在用户未明确选择的目录里扫描文件

## 适合做的事

- 自己制作的游戏资源包
- 开源游戏资源格式
- 官方提供的导出包
- 明确授权的汉化、调试、备份流程
- 只解析文件头、清单、索引的识别插件
- 用户手动提供授权材料后的轻量转换
