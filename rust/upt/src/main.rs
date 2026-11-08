use serde_json::json;
use std::io::Write;
use std::process::{Command, Stdio};

fn run_cmd(cmd: &str, args: &[&str]) -> String {
    Command::new(cmd)
        .args(args)
        .output()
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .unwrap_or_default()
}

#[tokio::main]
async fn main() {
    let uptime_out = run_cmd("uptime", &[]);
    let ps_out = run_cmd("ps", &["-e"]);
    let process_count = ps_out.lines().count().saturating_sub(1);
    let node_ver = run_cmd("node", &["--version"]);

    let (total_mem, free_mem) = if cfg!(target_os = "macos") {
        let total = run_cmd("sysctl", &["-n", "hw.memsize"])
            .parse::<u64>()
            .unwrap_or(0);
        let vm = run_cmd("vm_stat", &[]);
        let page_size: u64 = 4096;
        let mut free_pages: u64 = 0;
        for line in vm.lines() {
            if line.contains("Pages free") || line.contains("Pages inactive") {
                if let Some(v) = line.split(':').nth(1) {
                    let v = v.trim().trim_end_matches('.');
                    free_pages += v.parse::<u64>().unwrap_or(0);
                }
            }
        }
        (total / 1024 / 1024, free_pages * page_size / 1024 / 1024)
    } else {
        let meminfo = std::fs::read_to_string("/proc/meminfo").unwrap_or_default();
        let mut total = 0u64;
        let mut avail = 0u64;
        for line in meminfo.lines() {
            if line.starts_with("MemTotal:") {
                total = line.split_whitespace().nth(1).and_then(|s| s.parse().ok()).unwrap_or(0) / 1024;
            } else if line.starts_with("MemAvailable:") {
                avail = line.split_whitespace().nth(1).and_then(|s| s.parse().ok()).unwrap_or(0) / 1024;
            }
        }
        (total, avail)
    };

    let used_mem = total_mem.saturating_sub(free_mem);

    let cpu = if cfg!(target_os = "macos") {
        let top = run_cmd("top", &["-l", "1", "-n", "0"]);
        top.lines()
            .find(|l| l.contains("CPU usage"))
            .map(|l| l.to_string())
            .unwrap_or_else(|| "n/a".into())
    } else {
        let stat = std::fs::read_to_string("/proc/stat").unwrap_or_default();
        stat.lines().next().unwrap_or("cpu").to_string()
    };

    let canvas_path = "/tmp/upt.png".to_string();
    let spec = json!({
        "type": "vip",
        "title": "System Dashboard",
        "subtitle": uptime_out,
        "icon": "⚡",
        "footer": "JOHN TRAN",
        "rows": [
            { "lines": [format!("Uptime: {}", uptime_out)] },
            { "lines": [format!("CPU: {}", cpu)] },
            { "lines": [format!("Memory: {} MB / {} MB", used_mem, total_mem)] },
            { "lines": [format!("Processes: {}", process_count)] },
            { "lines": [format!("Node: {}", node_ver)] }
        ]
    });

    let exe = std::env::current_exe().unwrap_or_default();
    let dir = exe.parent().unwrap_or(std::path::Path::new("."));
    let canvas_bin = dir.join("canvas-render");
    let canvas_bin = if canvas_bin.exists() {
        canvas_bin
    } else {
        std::path::PathBuf::from("canvas-render")
    };

    let mut child = Command::new(&canvas_bin)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .spawn();
    if let Ok(mut c) = child {
        if let Some(stdin) = c.stdin.as_mut() {
            let _ = stdin.write_all(spec.to_string().as_bytes());
        }
        drop(c.stdin.take());
        if let Ok(out) = c.wait_with_output() {
            if out.status.success() {
                let _ = std::fs::write(&canvas_path, &out.stdout);
            }
        }
    }

    let result = json!({
        "canvasPath": canvas_path,
        "uptime": uptime_out,
        "cpu": cpu,
        "memory": format!("{} MB / {} MB", used_mem, total_mem),
        "error": null
    });
    println!("{}", result);
}
