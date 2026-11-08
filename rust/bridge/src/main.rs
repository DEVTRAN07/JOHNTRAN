use axum::{routing::{get, post}, Router, Json};
use serde_json::{json, Value};
use std::net::SocketAddr;

async fn health() -> Json<Value> { Json(json!({"ok": true, "service": "johntran-bridge"})) }
async fn render(Json(_spec): Json<Value>) -> Json<Value> {
    // Stub: local HTTP bridge will shell out to canvas-render/image-proc/media.
    // Full implementation wires child_process-style exec of sibling binaries.
    Json(json!({"ok": false, "error": "bridge stub: wire to canvas-render binary"}))
}

#[tokio::main]
async fn main() {
    let app = Router::new().route("/health", get(health)).route("/render", post(render));
    let addr = SocketAddr::from(([127,0,0,1], 4317));
    eprintln!("bridge listening on {addr}");
    let listener = tokio::net::TcpListener::bind(addr).await.expect("bind");
    axum::serve(listener, app).await.expect("serve");
}
