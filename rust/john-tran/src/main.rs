use std::path::PathBuf;
use std::process::{exit, Stdio};
use std::time::Duration;
use tokio::process::Command;
use tokio::signal::unix::{signal, SignalKind};
use tokio::time::timeout;

fn banner() {
    println!("╔══════════════════════════════════╗");
    println!("║  JOHN TRAN BOT  v1.2.0  (Rust)   ║");
    println!("╚══════════════════════════════════╝");
}

fn bridge_bin() -> PathBuf {
    std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|d| d.to_path_buf()))
        .unwrap_or_default()
        .join("bridge")
}

async fn spawn_node() -> tokio::process::Child {
    Command::new("node")
        .arg("JohnTran.js")
        .stdin(Stdio::inherit())
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit())
        .env("JT_PANEL_CHILD", "0")
        .env("JT_BOT_NAME", "john-tran")
        .env("JT_BRIDGE_PORT", "4317")
        .spawn()
        .expect("failed to spawn node JohnTran.js")
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();
    banner();

    let mut bridge = if bridge_bin().exists() {
        Command::new(&bridge_bin()).spawn().ok()
    } else {
        None
    };

    loop {
        let mut child = spawn_node().await;

        let (restart, child_exited) = tokio::select! {
            _ = async {
                signal(SignalKind::interrupt())
                    .expect("failed to install SIGINT handler")
                    .recv()
                    .await
            } => (false, false),
            _ = async {
                signal(SignalKind::terminate())
                    .expect("failed to install SIGTERM handler")
                    .recv()
                    .await
            } => (false, false),
            status = child.wait() => {
                let code = status.map(|s| s.code().unwrap_or(1)).unwrap_or(1);
                println!("[rust] Child exited with code {code}");
                (code == 2, true)
            }
        };

        if !child_exited {
            println!("[rust] Forwarding shutdown to child");
            if let Some(pid) = child.id() {
                let _ = Command::new("kill").arg("-TERM").arg(pid.to_string()).spawn();
            }
            match timeout(Duration::from_secs(10), child.wait()).await {
                Ok(_) => println!("[rust] Child exited"),
                Err(_) => {
                    let _ = child.start_kill();
                    let _ = child.wait().await;
                    println!("[rust] Child killed after timeout");
                }
            }
        }

        if !restart {
            if let Some(mut b) = bridge.take() {
                let _ = b.kill().await;
                let _ = b.wait().await;
            }
            println!("[rust] Shutdown complete");
            exit(0);
        }

        println!("[rust] Restarting...");
    }
}
