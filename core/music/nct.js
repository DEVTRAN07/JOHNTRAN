const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const http = require("../http");
const logger = require("../../utils/logger");
const { createTrack } = require("./models");

const SOURCE = "NhacCuaTui";
const API_BASE = "https://graph.nhaccuatui.com";
const WASM_URL = "https://static.nct.vn/nct-web/wasm/nctsign.wasm";
const WASM_PATH = path.join(__dirname, "..", "..", "data", "nctsign.wasm");

let wasmInstance = null;
let cachedDeviceId = null;

const BASE_HEADERS = () => {
  const timestamp = String(Date.now());
  const deviceId = cachedDeviceId || (cachedDeviceId = crypto.randomUUID().replace(/-/g, ""));
  return {
    Authorization: "",
    "x-nct-token": "",
    "x-nct-deviceid": deviceId,
    "x-nct-time": timestamp,
    "x-nct-language": "vi",
    "X-nct-uuid": deviceId,
    "X-nct-userid": "0",
    "x-nct-os": "h5",
    "x-nct-appid": "46",
    "X-nct-version": "1",
    timestamp,
    "x-partner": ""
  };
};

async function loadWasm() {
  if (wasmInstance) return wasmInstance;

  let wasmBuffer = null;
  try {
    wasmBuffer = fs.readFileSync(WASM_PATH);
  } catch {
    const { buffer } = await http.getBuffer(WASM_URL, { timeout: 30000 });
    fs.mkdirSync(path.dirname(WASM_PATH), { recursive: true });
    fs.writeFileSync(WASM_PATH, buffer);
    wasmBuffer = buffer;
  }

  const noop = { proc_exit: () => {} };
  const { instance } = await WebAssembly.instantiate(wasmBuffer, { env: noop, wasi_snapshot_preview1: noop });
  wasmInstance = instance;
  return instance;
}

function writeString(exports, memory, text) {
  const bytes = Buffer.from(text, "utf8");
  const pointer = exports.malloc(bytes.length + 1);
  if (!pointer) throw new Error("WASM malloc thất bại");
  const view = new Uint8Array(memory.buffer, pointer, bytes.length + 1);
  view.set(bytes);
  view[bytes.length] = 0;
  return { pointer, length: bytes.length };
}

function readCString(memory, pointer, maxLength) {
  const view = new Uint8Array(memory.buffer, pointer, maxLength);
  let end = 0;
  while (end < maxLength && view[end] !== 0) end += 1;
  return Buffer.from(view.subarray(0, end)).toString("utf8");
}

async function makeSign(fullUrl, method, headers) {
  const wasm = await loadWasm();
  const exports = wasm.exports;
  const memory = exports.memory;
  const urlRef = writeString(exports, memory, fullUrl);
  const methodRef = writeString(exports, memory, method);
  let headerString = "";
  for (const key of Object.keys(headers)) {
    headerString += `${encodeURIComponent(key)}$${encodeURIComponent(headers[key])}$`;
  }
  const headerRef = writeString(exports, memory, headerString);
  const outputPointer = exports.malloc(1024);
  if (!outputPointer) throw new Error("WASM malloc thất bại");

  exports.NctSign_makeUrlSignWithHeader(
    urlRef.pointer, urlRef.length,
    methodRef.pointer, methodRef.length,
    headerRef.pointer, headerRef.length,
    outputPointer
  );
  const signed = readCString(memory, outputPointer, 1024);
  exports.free(outputPointer);
  exports.free(urlRef.pointer);
  exports.free(methodRef.pointer);
  exports.free(headerRef.pointer);

  return (signed.match(/[0-9a-f]+/) || [""])[0];
}

async function apiGet(apiPath, params = {}) {
  const headers = BASE_HEADERS();
  const query = new URLSearchParams({ ...params, timestamp: headers.timestamp });
  const fullUrl = `${API_BASE}${apiPath}?${query.toString()}`;
  const sign = await makeSign(fullUrl, "GET", headers);
  const { data } = await http.getJson(fullUrl, {
    headers: {
      ...headers,
      "X-sign": sign,
      Referer: "https://www.nhaccuatui.com/",
      "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15"
    }
  });
  return data;
}

function toTrack(item) {
  return createTrack({
    id: item.key,
    title: item.name,
    artist: item.artistName,
    duration: item.duration,
    thumbnail: item.image,
    source: SOURCE,
    sourceUrl: item.linkShare
  });
}

async function search(query, limit) {
  const response = await apiGet("/api/v1/search/all", { keyword: query });
  const songs = response?.data?.songs || [];
  return songs.slice(0, limit).map(toTrack);
}

async function resolve(track, options = {}) {
  const wantQuality = Number(options.quality) === 320 ? "320" : "128";
  const response = await apiGet(`/api/v1/song/detail/${encodeURIComponent(track.id)}`);
  const streams = response?.data?.streamURL || [];
  const free = streams.filter((item) => !item.onlyVIP);
  const preferred = free.find((item) => item.type === wantQuality)
    || free.find((item) => item.type === "128")
    || free.find((item) => item.type === "320")
    || streams[0];
  if (!preferred || !preferred.stream) {
    const error = new Error("Bài hát này không có link phát hợp lệ (có thể cần VIP)");
    error.notAvailable = true;
    throw error;
  }
  return preferred.stream;
}

async function getLyric(trackId) {
  let response = await apiGet(`/api/v1/song/lyric/detail/${encodeURIComponent(trackId)}`);
  let data = response?.data || {};
  if (!data.sentences && !data.lyric && !data.content) {
    response = await apiGet("/api/v1/song/lyric/detail", { key: trackId });
    data = response?.data || {};
  }
  if (process.env.JT_DEBUG_LYRIC) console.log("NCT_LYRIC_RAW:", JSON.stringify(data).slice(0, 300));
  if (Array.isArray(data.sentences)) {
    return data.sentences
      .map((sentence) => (sentence.words || []).map((word) => word.data).join(" "))
      .filter(Boolean)
      .join("\n");
  }
  return data.lyric || data.content || "";
}

module.exports = { name: "nct", label: SOURCE, search, resolve, getLyric };
