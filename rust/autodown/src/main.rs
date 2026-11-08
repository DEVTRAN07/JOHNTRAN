use serde::{Deserialize, Serialize};
use serde_json::json;
use std::env;
use thiserror::Error;
use url::Url;

#[derive(Error, Debug)]
enum AutodownError {
    #[error("missing URL argument")]
    MissingUrl,
    #[error("request failed: {0}")]
    Request(#[from] reqwest::Error),
    #[error("invalid JSON: {0}")]
    Json(#[from] serde_json::Error),
    #[error("API error: {0}")]
    Api(String),
}

#[derive(Debug, Serialize)]
struct Output {
    platform: String,
    #[serde(rename = "mediaUrl")]
    media_url: String,
    #[serde(rename = "thumbnailUrl")]
    thumbnail_url: String,
    title: String,
    duration: i64,
    width: i64,
    height: i64,
    error: Option<String>,
}

fn as_str(v: Option<&serde_json::Value>) -> String {
    match v {
        Some(serde_json::Value::String(s)) => s.clone(),
        Some(serde_json::Value::Null) | None => String::new(),
        Some(other) => other.to_string().trim_matches('"').to_string(),
    }
}
fn as_i64(v: Option<&serde_json::Value>) -> i64 {
    match v {
        Some(serde_json::Value::Number(n)) => n.as_i64().unwrap_or(0),
        Some(serde_json::Value::String(s)) => s.parse().unwrap_or(0),
        _ => 0,
    }
}

fn detect_platform(url: &str) -> String {
    let host = Url::parse(url).map(|u| u.host_str().unwrap_or("").to_lowercase()).unwrap_or_default();
    if host.contains("tiktok.com") { return "tiktok".into(); }
    if host.contains("youtube.com") || host == "youtu.be" { return "youtube".into(); }
    if host.contains("facebook.com") || host == "fb.watch" { return "facebook".into(); }
    if host.contains("instagram.com") { return "instagram".into(); }
    "generic".into()
}

fn extract_url(text: &str) -> Option<String> {
    let re = regex::Regex::new(r#"https?://[^\\s<>"'\\]]+"#).ok()?;
    re.find(text).map(|m| m.as_str().trim_end_matches(|c: char| ",;:!?".contains(c)).to_string())
}

async fn fetch_tiktok(client: &reqwest::Client, url: &str) -> Result<Output, AutodownError> {
    let api = format!("https://www.tikwm.com/api/?url={}&hd=1", { let e: String = url::form_urlencoded::byte_serialize(url.as_bytes()).collect(); e });
    let resp: serde_json::Value = client.get(&api).header("User-Agent","Mozilla/5.0").send().await?.json().await?;
    let code = resp.get("code").and_then(|v| v.as_i64()).unwrap_or(-1);
    if code != 0 && code != 200 { return Err(AutodownError::Api(resp.get("msg").and_then(|v|v.as_str()).unwrap_or("no data").to_string())); }
    let d = resp.get("data").ok_or_else(|| AutodownError::Api("missing data".into()))?;
    let video_url = {
        let v = as_str(d.get("hdplay"));
        if !v.is_empty() { v } else { let v = as_str(d.get("play")); if !v.is_empty() { v } else { as_str(d.get("wmplay")) } }
    };
    let thumbnail = {
        let v = as_str(d.get("cover"));
        if !v.is_empty() { v } else { as_str(d.get("origin_cover")) }
    };
    Ok(Output {
        platform: "tiktok".into(),
        media_url: video_url,
        thumbnail_url: thumbnail,
        title: as_str(d.get("title")),
        duration: as_i64(d.get("duration")),
        width: as_i64(d.get("width")),
        height: as_i64(d.get("height")),
        error: None,
    })
}

async fn fetch_noembed(client: &reqwest::Client, url: &str, platform: &str) -> Result<Output, AutodownError> {
    let api = format!("https://noembed.com?url={}", { let e: String = url::form_urlencoded::byte_serialize(url.as_bytes()).collect(); e });
    let resp: serde_json::Value = client.get(&api).send().await?.json().await?;
    Ok(Output {
        platform: platform.into(),
        media_url: as_str(resp.get("url")),
        thumbnail_url: as_str(resp.get("thumbnail_url")),
        title: as_str(resp.get("title")),
        duration: as_i64(resp.get("duration")),
        width: 0,
        height: 0,
        error: None,
    })
}

#[tokio::main]
async fn main() {
    let args: Vec<String> = env::args().collect();
    let text = args.get(1).cloned().unwrap_or_default();
    let client = reqwest::Client::new();

    let url = match extract_url(&text) {
        Some(u) => u,
        None => { println!("{}", json!({"platform":"","mediaUrl":"","thumbnailUrl":"","title":"","duration":0,"width":0,"height":0,"error":"no URL found"})); return; }
    };
    let platform = detect_platform(&url);

    let result = match platform.as_str() {
        "tiktok" => fetch_tiktok(&client, &url).await,
        "youtube" | "facebook" | "instagram" => fetch_noembed(&client, &url, &platform).await,
        _ => Err(AutodownError::Api(format!("unsupported platform: {}", platform))),
    };

    match result {
        Ok(out) => println!("{}", serde_json::to_string(&out).unwrap_or_else(|e| json!({"error": e.to_string()}).to_string())),
        Err(e) => println!("{}", json!({"platform":platform,"mediaUrl":"","thumbnailUrl":"","title":"","duration":0,"width":0,"height":0,"error": e.to_string()})),
    }
}
