use serde::Serialize;
use std::env;
use std::fs::File;
use std::io::Write;
use std::path::PathBuf;
use std::process;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

#[derive(Serialize)]
struct Output {
    #[serde(rename = "videoPath")]
    video_path: Option<String>,
    size: u64,
    error: Option<String>,
}

fn print_error(msg: impl Into<String>) -> ! {
    let out = Output {
        video_path: None,
        size: 0,
        error: Some(msg.into()),
    };
    println!("{}", serde_json::to_string(&out).unwrap_or_else(|_| {
        "{\"videoPath\":null,\"size\":0,\"error\":\"serialization error\"}".to_string()
    }));
    process::exit(1);
}

fn temp_video_path() -> PathBuf {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let pid = process::id();
    std::env::temp_dir().join(format!("getvd_{pid}_{nanos}.mp4"))
}

#[tokio::main]
async fn main() {
    let url = match env::args().nth(1) {
        Some(u) if !u.trim().is_empty() => u,
        _ => print_error("usage: getvd <video_url>"),
    };

    let client = match reqwest::Client::builder()
        .timeout(Duration::from_secs(120))
        .build()
    {
        Ok(c) => c,
        Err(e) => print_error(format!("failed to build http client: {e}")),
    };

    let resp = match client.get(&url).send().await {
        Ok(r) => r,
        Err(e) => print_error(format!("request failed: {e}")),
    };

    if !resp.status().is_success() {
        print_error(format!("http error: {}", resp.status()));
    }

    let bytes = match resp.bytes().await {
        Ok(b) => b,
        Err(e) => print_error(format!("failed to read response body: {e}")),
    };

    let path = temp_video_path();
    let mut file = match File::create(&path) {
        Ok(f) => f,
        Err(e) => print_error(format!("failed to create temp file: {e}")),
    };

    if let Err(e) = file.write_all(&bytes) {
        print_error(format!("failed to write temp file: {e}"));
    }

    let size = bytes.len() as u64;
    let out = Output {
        video_path: Some(path.to_string_lossy().into_owned()),
        size,
        error: None,
    };

    match serde_json::to_string(&out) {
        Ok(s) => println!("{s}"),
        Err(e) => print_error(format!("failed to serialize output: {e}")),
    }
}
