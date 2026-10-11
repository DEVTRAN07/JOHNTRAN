/**
 * Chuyển dữ liệu từ JSON store local (data/store.json) lên Supabase.
 * Chạy 1 lần trước khi deploy Koyeb (hoặc khi muốn đồng bộ lại settings).
 *
 *   SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_SERVICE_KEY=eyJ... \
 *   node scripts/migrate-to-supabase.js [đường-dẫn-store.json]
 */
const fs = require("fs");
const path = require("path");
const { SupabaseStore } = require("../core/storage/supabase");

const storePath = process.argv[2] || path.join(__dirname, "..", "data", "store.json");

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    console.log("❌ Thiếu SUPABASE_URL hoặc SUPABASE_SERVICE_KEY");
    process.exit(1);
  }
  if (!fs.existsSync(storePath)) {
    console.log(`❌ Không tìm thấy ${storePath}`);
    process.exit(1);
  }

  const local = JSON.parse(fs.readFileSync(storePath, "utf8"));
  const store = new SupabaseStore(url, key);
  await store.ready();

  const tableMap = { Users: "Users", Threads: "Threads", Metrics: "Metrics" };
  let migrated = 0;

  for (const [tableName, rows] of Object.entries(local)) {
    if (!Array.isArray(rows) && typeof rows !== "object") continue;
    const list = Array.isArray(rows) ? rows : Object.values(rows);
    for (const row of list) {
      if (!row || !row[Object.keys(row).find((k) => k !== "data" && k !== "updatedAt")]) continue;
      const idField = Object.keys(row).find((k) => k !== "data" && k !== "updatedAt");
      const id = row[idField];
      if (!id) continue;
      store.set(tableName, idField, id, row.data || {}, { id });
      migrated += 1;
    }
  }

  // đợi các upsert ngầm hoàn tất
  await new Promise((r) => setTimeout(r, 2500));

  console.log(`✅ Đã chuyển ${migrated} bản ghi lên Supabase`);
  console.log(`   bot_threads: ${store.count("Threads")} | bot_users: ${store.count("Users")} | bot_metrics: ${store.count("Metrics")}`);
  process.exit(0);
}

main().catch((error) => {
  console.log(`❌ Lỗi: ${error.message}`);
  process.exit(1);
});
