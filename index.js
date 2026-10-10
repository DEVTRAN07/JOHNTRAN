const { spawn } = require("child_process");
const logger = require("./utils/logger");
const semver = require("semver");
const configSystem = require("./core/config");

(async () => {
    await logger.printBanner();

    const nodeVersion = semver.parse(process.version);
    if (nodeVersion.major < 20) {
        logger.log(`Phiên bản Node.js ${process.version} không hỗ trợ. Vui lòng sử dụng Node.js 20 trở lên.`, "error");
        return process.exit(1);
    }

    let config;
    try {
        config = configSystem.load();
        global.config = config;
    } catch (error) {
        logger.log(`Lỗi cấu hình: ${error.message}`, "error");
        return process.exit(1);
    }

    if (config.panel?.enabled) {
        // ===== CHẾ ĐỘ PANEL: master chỉ quản lý, bot con chạy riêng từng tiến trình =====
        const { BotManager } = require("./panel/botManager");
        const { startPanel } = require("./panel/server");

        const manager = new BotManager();
        startPanel({ manager, config });

        logger.log("Panel mode: dùng web panel để tạo và quản lý bot con", "info");
        console.log(`Bot con đã lưu: ${manager.list().map((b) => b.name).join(", ") || "(chưa có)"}`);

        const shutdown = async () => {
            logger.log("Đang dừng tất cả bot con...", "warn");
            await manager.stopAll();
            process.exit(0);
        };
        process.on("SIGINT", shutdown);
        process.on("SIGTERM", shutdown);
        return;
    }

    // ===== CHẾ ĐỘ BOT ĐƠN: master giám sát 1 tiến trình JohnTran.js =====
    function startProject() {
        const child = spawn("node", ["JohnTran.js"], {
            cwd: __dirname,
            stdio: "inherit",
            shell: true,
            env: { ...process.env, JT_PANEL_CHILD: "0" }
        });

        child.on("close", (code) => {
            if (code === 2) {
                logger.log(`Khởi động lại...`, "warn");
                startProject();
            }
        });
    }

    startProject();
})();
