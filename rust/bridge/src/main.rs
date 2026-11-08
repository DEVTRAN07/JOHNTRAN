use axum::{routing::{get, post}, Router, Json, http::StatusCode};
use serde_json::{json, Value};
use std::net::SocketAddr;
use tokio::process::Command;
use tokio::time::{timeout, Duration};

async fn health() -> Json<Value> {
    Json(json!({"status":"ok","service":"john-tran-bridge","version":"1.2.0"}))
}

fn binary_path(name: &str) -> std::path::PathBuf {
    let exe_dir = std::env::current_exe().ok().and_then(|p| p.parent().map(|d| d.to_path_buf())).unwrap_or_default();
    let cand1 = exe_dir.join(name);
    if cand1.exists() { return cand1; }
    let cand2 = std::path::PathBuf::from(format!("../{}/target/release/{}", name, name));
    if cand2.exists() { return cand2; }
    cand1
}

async fn run_binary(bin: &str, stdin: &[u8]) -> Result<Vec<u8>, String> {
    let path = binary_path(bin);
    let mut child = Command::new(&path)
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("spawn {}: {}", path.display(), e))?;
    if let Some(mut s) = child.stdin.take() {
        use tokio::io::AsyncWriteExt;
        s.write_all(stdin).await.map_err(|e| e.to_string())?;
        s.shutdown().await.map_err(|e| e.to_string())?;
    }
    let out = timeout(Duration::from_secs(30), child.wait_with_output())
        .await
        .map_err(|_| "timeout".to_string())?
        .map_err(|e| e.to_string())?;
    if !out.status.success() {
        return Err(String::from_utf8_lossy(&out.stderr).to_string());
    }
    Ok(out.stdout)
}

async fn render(Json(spec): Json<Value>) -> Result<(StatusCode, Vec<u8>), (StatusCode, Json<Value>)> {
    let input = serde_json::to_vec(&spec).unwrap_or_default();
    match run_binary("canvas-render", &input).await {
        Ok(bytes) => Ok((StatusCode::OK, bytes)),
        Err(e) => Err((StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e})))),
    }
}

async fn image(Json(spec): Json<Value>) -> Result<(StatusCode, Vec<u8>), (StatusCode, Json<Value>)> {
    let input = serde_json::to_vec(&spec).unwrap_or_default();
    match run_binary("image-proc", &input).await {
        Ok(bytes) => Ok((StatusCode::OK, bytes)),
        Err(e) => Err((StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e})))),
    }
}

async fn media(Json(spec): Json<Value>) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let input = serde_json::to_vec(&spec).unwrap_or_default();
    match run_binary("media", &input).await {
        Ok(bytes) => {
            let v: Value = serde_json::from_slice(&bytes).unwrap_or(Value::Null);
            Ok(Json(v))
        }
        Err(e) => Err((StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e})))),
    }
}

#[tokio::main]
async fn main() {
    let port: u16 = std::env::var("BRIDGE_PORT").ok().and_then(|s| s.parse().ok()).unwrap_or(4317);
    let app = Router::new()
        .route("/health", get(health))
        .route("/render", post(render))
        .route("/image", post(image))
        .route("/media", post(media));
    let addr = SocketAddr::from(([127,0,0,1], port));
    eprintln!("bridge listening on {addr}");
    let listener = tokio::net::TcpListener::bind(addr).await.expect("bind");
    axum::serve(listener, app).await.expect("serve");
}
