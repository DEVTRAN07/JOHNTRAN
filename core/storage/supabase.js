// Storage adapter cho Supabase
const { createClient } = require("@supabase/supabase-js");

const TABLE_MAP = {
  Users: "bot_users",
  Threads: "bot_threads",
  Metrics: "bot_metrics",
  BotStats: "bot_stats",
  MediaCache: "bot_media_cache"
};

const SYNC_INTERVAL = Number(process.env.SUPABASE_SYNC_MS) || 30000;
const BACKOFF_CAP = 5 * 60 * 1000;
const LOG_COOLDOWN = 60 * 1000;

class SupabaseStore {
  constructor(url, serviceKey) {
    if (!url || !serviceKey) {
      throw new Error("Thiếu SUPABASE_URL hoặc SUPABASE_SERVICE_KEY");
    }
    this.url = url;
    this.client = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    this.mirror = { Users: {}, Threads: {}, Metrics: {} };
    this.retryQueue = [];
    this.syncing = null;
    this.lastSyncAt = 0;
    this.syncError = null;
    this.classified = null;
    this.consecutiveFailures = 0;
    this.lastFailureLogAt = 0;
    this.nextSyncDelay = SYNC_INTERVAL;
    this.readyPromise = this.sync().then(() => {
      this.syncError = null;
    }).catch((error) => {
      this.syncError = error.message;
      this.classified = this.classifyError(error);
      console.log(`[supabase] Lần đồng bộ đầu thất bại: ${error.message}`);
    });
    this.scheduleInterval(SYNC_INTERVAL);
  }

  scheduleInterval(delay) {
    if (this.interval) clearInterval(this.interval);
    this.interval = setInterval(() => {
      this.sync().catch((error) => {
        console.log(`[supabase] Đồng bộ lỗi: ${error.message}`);
      });
      this.flushRetry().catch(() => {});
    }, delay);
    this.interval.unref?.();
  }

  classifyError(err) {
    const msg = String((err && err.message) || err || "").toLowerCase();
    const netPatterns = ["fetch failed", "econnreset", "enotfound", "eai_again", "getaddrinfo", "econnrefused", "etimedout", "timeout", "abort", "socket"];
    const cfgPatterns = ["invalid api key", "jwt", "row level security", "unauthorized", "permission denied"];
    if (netPatterns.some((p) => msg.includes(p))) return "network";
    if (cfgPatterns.some((p) => msg.includes(p))) return "config";
    return "unknown";
  }

  safeHost() {
    try { return new URL(this.url).host; } catch { return ""; }
  }

  logFailure(msg, classified) {
    const now = Date.now();
    if (now - this.lastFailureLogAt < LOG_COOLDOWN) return;
    this.lastFailureLogAt = now;
    const host = this.safeHost();
    console.log(`[supabase] ${classified} failure${host ? ` (${host})` : ""}: ${msg}`);
  }

  async ready() {
    await this.readyPromise;
    if (this.syncError && this.lastSyncAt === 0) {
      console.log(`[supabase] ready: ${this.syncError}`);
    }
    return this.getStatus();
  }

  tableFor(name) {
    const table = TABLE_MAP[name];
    if (!table) throw new Error(`Bảng Supabase không tồn tại: ${name}`);
    return table;
  }

  async sync() {
    if (this.syncing) return this.syncing;
    this.syncing = (async () => {
      let anySuccess = false;
      let firstError = null;
      let firstClassified = null;
      for (const [storeTable, dbTable] of Object.entries(TABLE_MAP)) {
        let data, error;
        try {
          const res = await this.client.from(dbTable).select("id, data, updated_at");
          data = res.data;
          error = res.error;
        } catch (e) {
          error = e;
        }
        if (error) {
          if (/Could not find the table/i.test(String(error.message || error))) {
            this.mirror[storeTable] = this.mirror[storeTable] || {};
            continue;
          }
          const classified = this.classifyError(error);
          const msg = `Supabase ${dbTable}: ${error.message || error}`;
          if (!firstError) { firstError = msg; firstClassified = classified; }
          this.logFailure(msg, classified);
          this.syncError = msg;
          this.classified = classified;
          if (!this.mirror[storeTable]) this.mirror[storeTable] = {};
          continue;
        }
        anySuccess = true;
        const next = {};
        for (const row of data || []) {
          next[String(row.id)] = { ...row, data: row.data || {} };
        }
        this.mirror[storeTable] = next;
      }
      if (firstError && !anySuccess) {
        this.consecutiveFailures += 1;
        this.syncError = firstError;
        this.classified = firstClassified;
        this.nextSyncDelay = Math.min(SYNC_INTERVAL * Math.pow(2, this.consecutiveFailures), BACKOFF_CAP);
        this.scheduleInterval(this.nextSyncDelay);
        throw new Error(firstError);
      }
      if (firstError) {
        this.consecutiveFailures += 1;
        this.syncError = firstError;
        this.classified = firstClassified;
      } else {
        this.consecutiveFailures = 0;
        this.syncError = null;
        this.classified = null;
        this.nextSyncDelay = SYNC_INTERVAL;
        this.scheduleInterval(SYNC_INTERVAL);
      }
      this.lastSyncAt = Date.now();
      return true;
    })().finally(() => { this.syncing = null; });
    return this.syncing;
  }

  push(dbTable, op, payload) {
    const run = async () => {
      if (op === "upsert") {
        const { error } = await this.client.from(dbTable).upsert(payload, { onConflict: "id" });
        if (error) throw new Error(error.message);
      } else if (op === "delete") {
        const { error } = await this.client.from(dbTable).delete().eq("id", payload.id);
        if (error) throw new Error(error.message);
      }
    };
    run().catch((error) => {
      const classified = this.classifyError(error);
      if (classified === "network") {
        this.logFailure(`Ghi ${op} thất bại, xếp retry: ${error.message}`, classified);
      } else {
        console.log(`[supabase] Ghi ${op} thất bại, xếp retry: ${error.message}`);
      }
      this.retryQueue.push({ dbTable, op, payload });
    });
  }

  async flushRetry() {
    if (this.retryQueue.length === 0) return;
    const queue = this.retryQueue;
    this.retryQueue = [];
    for (const job of queue) {
      this.push(job.dbTable, job.op, job.payload);
    }
  }

  getStatus() {
    return {
      ok: !this.syncError && this.lastSyncAt > 0,
      lastSyncAt: this.lastSyncAt,
      syncError: this.syncError,
      consecutiveFailures: this.consecutiveFailures,
      classified: this.classified
    };
  }

  get(tableName, idField, id) {
    const key = String(id);
    const row = this.mirror[tableName]?.[key];
    return row ? { ...row } : null;
  }

  has(tableName, idField, id) {
    return Boolean(this.mirror[tableName]?.[String(id)]);
  }

  set(tableName, idField, id, dataObj, extra = {}) {
    const table = this.tableFor(tableName);
    const key = String(id);
    const payload = {
      id: key,
      data: dataObj,
      ...extra,
      updated_at: new Date().toISOString()
    };
    if (!this.mirror[tableName]) this.mirror[tableName] = {};
    this.mirror[tableName][key] = payload;
    this.push(table, "upsert", payload);
    return payload;
  }

  delete(tableName, idField, id) {
    const table = this.tableFor(tableName);
    const key = String(id);
    const existed = Boolean(this.mirror[tableName]?.[key]);
    if (this.mirror[tableName]) delete this.mirror[tableName][key];
    if (existed) this.push(table, "delete", { id: key });
    return existed;
  }

  all(tableName) {
    return Object.values(this.mirror[tableName] || {});
  }

  count(tableName) {
    return Object.keys(this.mirror[tableName] || {}).length;
  }

  flushSync() {
    return true;
  }
}

module.exports = { SupabaseStore };
