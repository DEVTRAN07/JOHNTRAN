use rand::seq::SliceRandom;
use serde::Serialize;
use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Serialize)]
struct Output {
    #[serde(rename = "imagePath")]
    image_path: Option<String>,
    #[serde(rename = "imageUrl")]
    image_url: Option<String>,
    error: Option<String>,
}

fn print_json(image_path: Option<String>, image_url: Option<String>, error: Option<String>) {
    let out = Output { image_path, image_url, error };
    match serde_json::to_string(&out) {
        Ok(s) => println!("{s}"),
        Err(_) => println!(r#"{{\"imagePath\":null,\"imageUrl\":null,\"error\":\"json serialize failed\"}}"#),
    }
}

fn temp_image_path() -> PathBuf {
    let nanos = SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_nanos()).unwrap_or(0);
    let mut p = std::env::temp_dir();
    p.push(format!("girl_{nanos}_{}.jpg", std::process::id()));
    p
}

async fn run() -> Result<(String, String), String> {
    let urls: Vec<String> = serde_json::from_str(include_str!("../../../assets/girl.json"))
        .map_err(|e| format!("failed to parse girl.json: {e}"))?;
    if urls.is_empty() { return Err("girl.json is empty".to_string()); }
    let url = urls.choose(&mut rand::thread_rng()).cloned().ok_or_else(|| "failed to pick url".to_string())?;
    let client = reqwest::Client::builder().user_agent("Mozilla/5.0").build().map_err(|e| format!("failed to build client: {e}"))?;
    let resp = client.get(&url)
        .header("Referer", "https://imgur.com/")
        .header("Accept", "image/*,*/*;q=0.8")
        .send().await.map_err(|e| format!("request failed: {e}"))?;
    if !resp.status().is_success() { return Err(format!("http status {}", resp.status())); }
    let bytes = resp.bytes().await.map_err(|e| format!("failed to read body: {e}"))?;
    if bytes.is_empty() { return Err("downloaded image is empty".to_string()); }
    let path = temp_image_path();
    fs::write(&path, &bytes).map_err(|e| format!("failed to write file: {e}"))?;
    Ok((path.to_string_lossy().into_owned(), url))
}

#[tokio::main]
async fn main() {
    match run().await {
        Ok((image_path, image_url)) => print_json(Some(image_path), Some(image_url), None),
        Err(e) => print_json(None, None, Some(e)),
    }
}
