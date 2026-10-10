const NOT_CONFIGURED_MESSAGE = "Tính năng này chưa được cấu hình bởi admin bot (không có endpoint trong config.yml → services).";

function serviceUrl(name) {
  const url = global.config?.services?.[name];
  if (url && String(url).trim()) return String(url).trim().replace(/\/+$/, "");
  return null;
}

function requireService(name) {
  const url = serviceUrl(name);
  if (!url) {
    const error = new Error(NOT_CONFIGURED_MESSAGE);
    error.notConfigured = true;
    throw error;
  }
  return url;
}

function configuredServices() {
  return Object.entries(global.config?.services || {})
    .filter(([, value]) => value && String(value).trim())
    .map(([name]) => name);
}

module.exports = { serviceUrl, requireService, configuredServices, NOT_CONFIGURED_MESSAGE };
