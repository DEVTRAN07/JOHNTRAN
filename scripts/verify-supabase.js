/**
 * Kiểm tra kết nối Supabase: có tìm thấy 3 bảng không + đọc/ghi thử.
 * Cách dùng:
 *   SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_SERVICE_KEY=eyJ... \
 *   node scripts/verify-supabase.js
 */
const { SupabaseStore } = require("../core/storage/supabase");

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;

  if (!url || !key) {
    console.log("❌ Thieu SUPABASE_URL hoac SUPABASE_SERVICE_KEY");
    process.exit(1);
  }

  console.log(`→ Ket noi ${url} ...`);
  const store = new SupabaseStore(url, key);

  try {
    await store.ready();
  } catch (error) {
    console.log(`❌ Khong ket noi duoc: ${error.message}`);
    console.log("   Kiem tra lai URL + service_role key, hoac schema chua chay (supabase/schema.sql).");
    process.exit(1);
  }

  console.log("✅ Ket noi OK — bang da ton tai (schema da chay)");
  console.log(`   bot_threads: ${store.count("Threads")} dong | bot_users: ${store.count("Users")} | bot_metrics: ${store.count("Metrics")} dong`);

  // Test ghi + doc + xoa
  const testId = "verify_test";
  store.set("Threads", "threadId", testId, { ping: true, ts: Date.now() });
  await new Promise((r) => setTimeout(r, 800));
  const row = store.get("Threads", "threadId", testId);
  console.log(`✅ Ghi/doc thu: ${row && row.data.ping ? "OK" : "FAIL"}`);

  store.delete("Threads", "threadId", testId);
  await new Promise((r) => setTimeout(r, 800));
  console.log(`✅ Xoa thu: ${store.has("Threads", "threadId", testId) ? "FAIL" : "OK"}`);

  console.log("\n🎉 Supabase san sang — gio deploy Koyeb voi 2 bien nay.");
  process.exit(0);
}

main().catch((error) => {
  console.log(`❌ Loi: ${error.message}`);
  process.exit(1);
});
