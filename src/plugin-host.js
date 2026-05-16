(function () {
  const API_VERSION = "0.5.0";
  const STORAGE_KEY = "GalAssetBox.plugin.enabled.v1";
  const plugins = [];
  let importContext = null;
  const requiredPolicyFlags = [
    "requiresUserAuthorization",
    "localOnly",
    "noDrmBypass",
    "noBundledThirdPartyKeys",
  ];

  function registerAuthorizedPlugin(plugin) {
    validatePlugin(plugin);
    if (plugins.some((item) => item.id === plugin.id)) {
      throw new Error(`Duplicate GalAssetBox plugin id: ${plugin.id}`);
    }
    const savedState = getSavedEnabledState();
    plugins.push({
      ...plugin,
      enabled: Object.prototype.hasOwnProperty.call(savedState, plugin.id)
        ? savedState[plugin.id] === true
        : plugin.enabled === true,
      capabilities: Array.isArray(plugin.capabilities) ? plugin.capabilities : [],
      version: stringOr(plugin.version, importContext?.version || "0.1.0"),
      author: stringOr(plugin.author, importContext?.author || ""),
      license: stringOr(plugin.license, importContext?.license || ""),
      source: importContext ? importContext.sourceType : plugin.source || "built-in",
      sourceName: importContext?.sourceName || plugin.sourceName || "built-in",
      sourceMain: importContext?.sourceMain || "",
      packageId: importContext?.packageId || "",
      packageName: importContext?.packageName || "",
      packageDescription: importContext?.packageDescription || "",
      importedAt: importContext ? new Date().toISOString() : "",
    });
  }

  function validatePlugin(plugin) {
    if (!plugin || typeof plugin !== "object") throw new Error("Plugin must be an object.");
    for (const key of ["id", "name", "description"]) {
      if (!plugin[key] || typeof plugin[key] !== "string") {
        throw new Error(`Plugin is missing string field: ${key}`);
      }
    }
    if (!/^[a-z0-9][a-z0-9._-]*$/i.test(plugin.id)) {
      throw new Error(`Plugin id is invalid: ${plugin.id}`);
    }
    if (typeof plugin.match !== "function") {
      throw new Error(`Plugin match must be a function: ${plugin.id}`);
    }
    if (plugin.transform && typeof plugin.transform !== "function") {
      throw new Error(`Plugin transform must be a function: ${plugin.id}`);
    }
    const policy = plugin.policy || {};
    for (const flag of requiredPolicyFlags) {
      if (policy[flag] !== true) {
        throw new Error(`Plugin ${plugin.id} must explicitly set policy.${flag} = true`);
      }
    }
  }

  function getPlugins() {
    return plugins.slice();
  }

  function getPlugin(id) {
    return plugins.find((plugin) => plugin.id === id) || null;
  }

  function setPluginEnabled(id, enabled) {
    const plugin = getPlugin(id);
    if (!plugin) throw new Error(`Unknown plugin id: ${id}`);
    plugin.enabled = enabled === true;
    const savedState = getSavedEnabledState();
    savedState[id] = plugin.enabled;
    saveEnabledState(savedState);
    return plugin.enabled;
  }

  function resetPluginEnabledState() {
    saveEnabledState({});
    for (const plugin of plugins) {
      plugin.enabled = plugin.defaultEnabled === true;
    }
  }

  function beginExternalPluginImport(sourceInfo) {
    if (sourceInfo && typeof sourceInfo === "object") {
      importContext = {
        sourceType: sourceInfo.sourceType === "package" ? "package" : "external-file",
        sourceName: String(sourceInfo.sourceName || "external plugin"),
        sourceMain: String(sourceInfo.sourceMain || ""),
        packageId: String(sourceInfo.packageId || ""),
        packageName: String(sourceInfo.packageName || ""),
        packageDescription: String(sourceInfo.packageDescription || ""),
        version: String(sourceInfo.version || ""),
        author: String(sourceInfo.author || ""),
        license: String(sourceInfo.license || ""),
      };
      return;
    }
    importContext = {
      sourceType: "external-file",
      sourceName: String(sourceInfo || "external plugin"),
      sourceMain: "",
      packageId: "",
      packageName: "",
      packageDescription: "",
      version: "",
      author: "",
      license: "",
    };
  }

  function endExternalPluginImport() {
    importContext = null;
  }

  function describePlugins() {
    return plugins.map((plugin) => ({
      id: plugin.id,
      name: plugin.name,
      description: plugin.description,
      version: plugin.version || "",
      author: plugin.author || "",
      license: plugin.license || "",
      enabled: plugin.enabled,
      defaultEnabled: plugin.defaultEnabled === true,
      capabilities: plugin.capabilities.slice(),
      canTransform: typeof plugin.transform === "function",
      source: plugin.source || "built-in",
      sourceName: plugin.sourceName || "",
      sourceMain: plugin.sourceMain || "",
      packageId: plugin.packageId || "",
      packageName: plugin.packageName || "",
      packageDescription: plugin.packageDescription || "",
      importedAt: plugin.importedAt || "",
      policy: { ...plugin.policy },
      notes: plugin.notes || "",
    }));
  }

  function stringOr(value, fallback) {
    return typeof value === "string" && value ? value : fallback;
  }

  function getSavedEnabledState() {
    try {
      const raw = window.localStorage?.getItem(STORAGE_KEY);
      const state = raw ? JSON.parse(raw) : {};
      return state && typeof state === "object" && !Array.isArray(state) ? state : {};
    } catch {
      return {};
    }
  }

  function saveEnabledState(state) {
    try {
      window.localStorage?.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // localStorage can be unavailable in strict browser privacy modes.
    }
  }

  window.GalAssetBoxPluginHost = {
    apiVersion: API_VERSION,
    registerAuthorizedPlugin,
    getPlugins,
    setPluginEnabled,
    resetPluginEnabledState,
    beginExternalPluginImport,
    endExternalPluginImport,
    describePlugins,
  };
})();
