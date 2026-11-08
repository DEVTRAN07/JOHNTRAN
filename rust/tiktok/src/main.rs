use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::env;
use thiserror::Error;
use url::form_urlencoded;

#[derive(Error, Debug)]
enum TikTokError {
    #[error("missing URL argument")]
    MissingUrl,
    #[error("request failed: {0}")]
    Request(#[from] reqwest::Error),
    #[error("invalid JSON response: {0}")]
    Json(#[from] serde_json::Error),
    #[error("API error: {0}")]
    Api(String),
}

#[derive(Debug, Deserialize)]
struct TikwmResponse {
    code: Option<i64>,
    msg: Option<String>,
    data: Option<Value>,
}

#[derive(Debug, Serialize)]
struct Author {
    nickname: String,
    avatar: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct Output {
    title: String,
    author: Author,
    duration: i64,
    width: i64,
    height: i64,
    video_url: String,
    image_url: String,
    music_url: String,
}

fn as_str(v: Option<&Value>) -> String {
    match v {
        Some(Value::String(s)) => s.clone(),
        Some(Value::Null) | None => String::new(),
        Some(other) => other.to_string().trim_matches('"').to_string(),
    }
}

fn as_i64(v: Option<&Value>) -> i64 {
    match v {
        Some(Value::Number(n)) => n.as_i64().unwrap_or(0),
        Some(Value::String(s)) => s.parse().unwrap_or(0),
        _ => 0,
    }
}

async fn fetch_tiktok(input_url: &str) -> Result<Output, TikTokError> {
    let encoded: String = form_urlencoded::byte_serialize(input_url.as_bytes()).collect();
    let api_url = format!("https://www.tikwm.com/api/?url={}&hd=1", encoded);

    let client = reqwest::Client::new();
    let resp = client
        .get(&api_url)
        .header("User-Agent", "Mozilla/5.0")
        .send()
        .await?
        .error_for_status()?;

    let body = resp.text().await?;
    let parsed: TikwmResponse = serde_json::from_str(&body)?;

    if parsed.code.unwrap_or(-1) != 0 {
        let msg = parsed.msg.unwrap_or_else(|| "unknown API error".to_string());
        return Err(TikTokError::Api(msg));
    }

    let data = parsed
        .data
        .ok_or_else(|| TikTokError::Api("missing data".to_string()))?;

    let author = data.get("author");
    let nickname = as_str(author.and_then(|a| a.get("nickname")));
    let avatar = as_str(author.and_then(|a| a.get("avatar")));

    let video_url = {
        let v = as_str(data.get("video_url"));
        if !v.is_empty() {
            v
        } else {
            let v = as_str(data.get("hdplay"));
            if !v.is_empty() { v } else { as_str(data.get("play")) }
        }
    };
    let image_url = {
        let v = as_str(data.get("cover"));
        if !v.is_empty() { v } else { as_str(data.get("origin_cover")) }
    };
    let music_url = {
        let v = as_str(data.get("music_url"));
        if !v.is_empty() {
            v
        } else {
            let v = as_str(data.get("music"));
            if !v.is_empty() { v } else { as_str(data.get("music_info").and_then(|m| m.get("play"))) }
        }
    };

    Ok(Output {
        title: as_str(data.get("title")),
        author: Author { nickname, avatar },
        duration: as_i64(data.get("duration")),
        width: as_i64(data.get("width")),
        height: as_i64(data.get("height")),
        video_url,
        image_url,
        music_url,
    })
}

#[tokio::main]
async fn main() {
    let input = env::args().nth(1);
    let result = match input.as_deref() {
        Some(url) if !url.is_empty() => fetch_tiktok(url).await,
        _ => Err(TikTokError::MissingUrl),
    };

    match result {
        Ok(out) => match serde_json::to_string(&out) {
            Ok(s) => println!("{}", s),
            Err(e) => println!("{}", json!({"error": e.to_string()})),
        },
        Err(e) => {
            println!("{}", json!({"error": e.to_string()}));
        }
    }
}
