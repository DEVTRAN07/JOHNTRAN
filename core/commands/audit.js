// Kiểm tra lệnh còn thiếu API key / endpoint / config nào.
// Mỗi lệnh khai báo config.requires = [{ key: "services.media_downloader_url", label: "Endpoint", optional: true }]
// key là đường dẫn trong config (vd "services.media_downloader_url").

function getPathValue(config, keyPath) {
  return keyPath.split(".").reduce((obj, key) => (obj == null ? undefined : obj[key]), config);
}

function isMissing(value) {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "boolean") return value === false;
  return false;
}

function commandStatus(name, pluginConfig) {
  const requires = Array.isArray(pluginConfig.requires) ? pluginConfig.requires : [];
  const missing = [];
  const optional = [];

  for (const req of requires) {
    if (!req?.key) continue;
    const value = getPathValue(global.config, req.key);
    if (isMissing(value)) {
      (req.optional ? optional : missing).push(req.label || req.key);
    }
  }

  return {
    name,
    category: pluginConfig.category || "Khác",
    description: pluginConfig.description || "",
    role: pluginConfig.role || 0,
    usage: pluginConfig.usage || name,
    ready: missing.length === 0,
    missing,
    optionalMissing: optional
  };
}

function getAllCommandStatus() {
  const config = global.config || {};
  const commands = (global.client?.commands) || new Map();
  const list = [];
  for (const [key, plugin] of commands) {
    list.push(Object.assign(commandStatus(key, plugin.config || {}), { config: undefined }));
  }
  return list.sort((a, b) => a.name.localeCompare(b.name));
}

function summarize(list) {
  return {
    total: list.length,
    ready: list.filter((c) => c.ready).length,
    blocked: list.filter((c) => !c.ready).length,
    blockedList: list.filter((c) => !c.ready).map((c) => ({ name: c.name, missing: c.missing }))
  };
}

module.exports = { getAllCommandStatus, summarize };
