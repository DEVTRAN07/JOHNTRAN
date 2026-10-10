module.exports = async function handler(request, response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Cache-Control", "no-store");
  return response.status(200).json({
    status: "ok",
    layer: "vercel-edge",
    service: "JOHNTRAN Control",
    node: process.version,
    region: process.env.VERCEL_REGION || "unknown",
    time: new Date().toISOString(),
    note: "Vercel chi host status/control. Bot Zalo (WebSocket 24/7) chay tren Render/Koyeb - xem README muc Chay 24/7."
  });
};
