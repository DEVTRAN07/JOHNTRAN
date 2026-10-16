// Storage adapter cho Supabase — thay JSON store khi deploy lên Koyeb
// (container Koyeb mất file khi restart, Supabase giữ dữ liệu bền vững).
//
// Thiết kế MIRROR: nạp toàn bộ bảng vào RAM lúc khởi động → đọc ĐỒNG BỘ như JsonStore
// (controller và plugin không cần sửa gì), ghi thì cập nhật RAM ngay + đẩy ngầm lên
// Supabase (fire-and-forget có retry). Nhắc lại DB mỗi 30s để bắt thay đổi từ bot con khác.
const { createClient } = require("@supabase/supabase-js");

const TABLE_MAP = {
  Users: "bot_users",
  Threads: "bot_threads",
  Metrics: "bot_metrics",
  BotStats: "bot_stats",
  MediaCache: "bot_media_cache" // cache metadata media (url → {title, author, duration, videoUrl, thumbnail})
};

const SYNC_INTERVAL = Number(process.env.SUPABASE_SYNC_MS) || 30000;

class SupabaseStore {
  constructor(url, serviceKey) {
    if (!url || !serviceKey) {
      throw new Error("Thiếu SUPABASE_URL hoặc SUPABASE_SERVICE_KEY");
    }
    this.client = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    this.mirror = { Users: {}, Threads: {}, Metrics: {} };
    this.retryQueue = [];
    this.syncing = null;
    this.lastSyncAt = 0;
    this.syncError = null;
    this.readyPromise = this.sync().catch((error) => {
      // Không nạp được lần đầu vẫn cho bot chạy (sẽ thử lại theo chu kỳ)
      this.syncError = error.message;
      console.log(`[supabase] Lần đồng bộ đầu thất bại: ${error.message}`);
    });
    this.interval = setInterval(() => {
      this.sync().catch((error) => console.log(`[supabase] Đồng bộ lỗi: ${error.message}`));
      this.flushRetry().catch(() => {});
    }, SYNC_INTERVAL);
    this.interval.unref?.();
  }

  async ready() {
    await this.readyPromise;
    // Chưa đồng bộ được lần nào → báo lỗi để caller biết (URL/key sai, schema thiếu...)
    if (this.syncError && this.lastSyncAt === 0) {
      throw new Error(this.syncError);
    }
    this.syncError = null;
  }

  tableFor(name) {
    const table = TABLE_MAP[name];
    if (!table) throw new Error(`Bảng Supabase không tồn tại: ${name}`);
    return table;
  }

  async sync() {
    if (this.syncing) return this.syncing;
    this.syncing = (async () => {
      for (const [storeTable, dbTable] of Object.entries(TABLE_MAP)) {
        const { data, error } = await this.client
          .from(dbTable)
          .select("id, data, updated_at");
        if (error) {
          // Bảng chưa tạo (thiếu schema) → coi như rỗng, không làm sập cả sync
          if (/Could not find the table/i.test(error.message)) {
            this.mirror[storeTable] = {};
            continue;
          }
          throw new Error(`Supabase ${dbTable}: ${error.message}`);
        }
        const next = {};
        for (const row of data || []) {
          next[String(row.id)] = { ...row, data: row.data || {} };
        }
        this.mirror[storeTable] = next;
      }
      this.lastSyncAt = Date.now();
      this.syncError = null;
      return true;
    })().finally(() => { this.syncing = null; });
    return this.syncing;
  }

  // Ghi NGẦM lên Supabase, thất bại thì xếp hàng retry
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
      console.log(`[supabase] Ghi ${op} thất bại, xếp retry: ${error.message}`);
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

  // ===== API ĐỒNG BỘ (giống JsonStore) =====
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
    // JSON store ghi đĩa; Supabase đã ghi ngầm theo từng thao tác
    return true;
  }
}

module.exports = { SupabaseStore };
