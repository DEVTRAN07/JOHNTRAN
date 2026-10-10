const RUNTIME_URL = process.env.JT_STATUS_URL || "";

module.exports = async function handler(request, response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Cache-Control", "no-store");

  if (!RUNTIME_URL) {
    return response.status(200).json({
      configured: false,
      message: "Chua cau hinh JT_STATUS_URL (URL health cua bot tren Render/Koyeb)"
    });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const upstream = await fetch(`${RUNTIME_URL.replace(/\/+$/, "")}/health`, {
      signal: controller.signal,
      headers: { "User-Agent": "JOHNTRAN-Status/1.0" }
    });
    const data = await upstream.json().catch(() => null);
    return response.status(200).json({ configured: true, reachable: upstream.ok, runtime: data });
  } catch (error) {
    return response.status(200).json({
      configured: true,
      reachable: false,
      error: error.name === "AbortError" ? "timeout" : error.message
    });
  } finally {
    clearTimeout(timer);
  }
};
