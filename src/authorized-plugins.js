(function () {
  const host = window.GalAssetBoxPluginHost;
  if (!host) return;

  host.registerAuthorizedPlugin({
    id: "galassetbox.index-only.common-archives",
    name: "常见封包识别器",
    description: "只识别常见资源封包并写入清单，不拆包、不解密。",
    version: "0.1.0",
    author: "GalAssetBox",
    license: "MIT",
    enabled: true,
    defaultEnabled: true,
    capabilities: ["inspect", "manifest"],
    policy: {
      requiresUserAuthorization: true,
      localOnly: true,
      noDrmBypass: true,
      noBundledThirdPartyKeys: true,
    },
    match(record) {
      const archiveExts = new Set([
        "xp3",
        "rpa",
        "rpi",
        "nsa",
        "ns2",
        "sar",
        "arc",
        "pck",
        "dat",
        "pak",
        "wolf",
        "unity3d",
        "assets",
      ]);
      if (!archiveExts.has(record.ext)) return null;
      return {
        confidence: "high",
        label: "封包清单",
        note: "识别为资源封包；当前内置能力只做清单记录。",
      };
    },
  });

  host.registerAuthorizedPlugin({
    id: "galassetbox.creator-owned-gabpack-json",
    name: "授权 GAB JSON 包读取器",
    description: "读取自制或明确授权的 .gabpack.json 示例包，把包内声明的开放文件写入插件输出目录。",
    version: "0.1.0",
    author: "GalAssetBox",
    license: "MIT",
    enabled: true,
    defaultEnabled: true,
    capabilities: ["inspect", "authorized-transform"],
    policy: {
      requiresUserAuthorization: true,
      localOnly: true,
      noDrmBypass: true,
      noBundledThirdPartyKeys: true,
    },
    notes: "这是安全示例格式，不包含第三方游戏规则、密钥或 DRM 绕过逻辑。",
    match(record) {
      if (!record.path.toLowerCase().endsWith(".gabpack.json")) return null;
      return {
        confidence: "high",
        label: "授权 GAB JSON 包",
        note: "可在用户确认后读取 JSON 中声明的开放文件。",
      };
    },
    async transform({ readText }) {
      const text = await readText();
      const pack = JSON.parse(text);
      if (!pack || pack.format !== "GalAssetBox.authorizedPack.v1" || !Array.isArray(pack.files)) {
        throw new Error("不是 GalAssetBox 授权包格式。");
      }

      return pack.files.map((entry, index) => {
        if (!entry || typeof entry.path !== "string") {
          throw new Error(`files[${index}] 缺少 path。`);
        }
        if (typeof entry.text === "string") {
          return {
            path: entry.path,
            text: entry.text,
            type: entry.type || "text/plain;charset=utf-8",
          };
        }
        if (typeof entry.base64 === "string") {
          const binary = atob(entry.base64);
          const bytes = new Uint8Array(binary.length);
          for (let offset = 0; offset < binary.length; offset += 1) {
            bytes[offset] = binary.charCodeAt(offset);
          }
          return {
            path: entry.path,
            bytes,
            type: entry.type || "application/octet-stream",
          };
        }
        throw new Error(`files[${index}] 需要 text 或 base64。`);
      });
    },
  });

  host.registerAuthorizedPlugin({
    id: "example.creator-owned-light-transform-template",
    name: "授权轻量转换模板",
    description: "给自制游戏、开源项目或明确授权项目接入轻量转换逻辑的模板，默认关闭。",
    version: "0.1.0",
    author: "GalAssetBox",
    license: "MIT",
    enabled: false,
    defaultEnabled: false,
    capabilities: ["inspect", "authorized-transform-template"],
    policy: {
      requiresUserAuthorization: true,
      localOnly: true,
      noDrmBypass: true,
      noBundledThirdPartyKeys: true,
    },
    notes: "复制这个模板并改成自己的项目格式；不要写入第三方游戏密钥、破解规则或 DRM 绕过流程。",
    match(record) {
      if (record.ext !== "myvnpack") return null;
      return {
        confidence: "template",
        label: "授权转换模板",
        note: "示例扩展名，仅用于说明插件接口。",
      };
    },
  });
})();
