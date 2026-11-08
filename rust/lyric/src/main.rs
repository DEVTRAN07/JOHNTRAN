use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::env;
use std::process;

const LRCLIB_BASE: &str = "https://lrclib.net/api";

#[derive(Debug, Deserialize, Serialize)]
struct SearchItem {
    id: i64,
    name: Option<String>,
    #[serde(rename = "artistName")]
    artist_name: Option<String>,
    #[serde(rename = "albumName")]
    album_name: Option<String>,
    duration: Option<f64>,
    instrumental: Option<bool>,
}

#[derive(Debug, Deserialize)]
struct GetResponse {
    #[serde(rename = "syncedLyrics")]
    synced_lyrics: Option<String>,
    #[serde(rename = "plainLyrics")]
    plain_lyrics: Option<String>,
    instrumental: Option<bool>,
}

fn print_json(v: &Value) {
    match serde_json::to_string(v) {
        Ok(s) => println!("{s}"),
        Err(e) => {
            println!("{{\"error\":\"json serialization failed: {}\"}}", e);
        }
    }
}

fn usage_and_exit() -> ! {
    print_json(&json!({
        "error": "usage: lyric <artist> <track> | lyric --search <query>"
    }));
    process::exit(1);
}

fn encode_component(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for b in s.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(b as char)
            }
            b' ' => out.push_str("%20"),
            _ => out.push_str(&format!("%{:02X}", b)),
        }
    }
    out
}

async fn search(client: &reqwest::Client, query: &str) -> Result<Value, String> {
    let url = format!(
        "{LRCLIB_BASE}/search?query={}&limit=5",
        encode_component(query)
    );
    let resp = client
        .get(&url)
        .header("User-Agent", "lyric-cli/0.1.0")
        .send()
        .await
        .map_err(|e| e.to_string())?;
    let status = resp.status();
    if status == reqwest::StatusCode::NOT_FOUND {
        return Ok(json!([]));
    }
    if !status.is_success() {
        return Err(format!("http {}", status.as_u16()));
    }
    let items: Vec<SearchItem> = resp.json().await.map_err(|e| e.to_string())?;
    let out: Vec<Value> = items
        .into_iter()
        .map(|it| {
            json!({
                "id": it.id,
                "name": it.name,
                "artistName": it.artist_name,
                "albumName": it.album_name,
                "duration": it.duration.map(|d| d.round() as i64),
                "instrumental": it.instrumental.unwrap_or(false),
            })
        })
        .collect();
    Ok(Value::Array(out))
}

async fn fetch_lyrics(client: &reqwest::Client, artist: &str, track: &str) -> Result<Value, String> {
    let url = format!(
        "{LRCLIB_BASE}/get/{}/{}",
        encode_component(artist),
        encode_component(track)
    );
    let resp = client
        .get(&url)
        .header("User-Agent", "lyric-cli/0.1.0")
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if resp.status() == reqwest::StatusCode::NOT_FOUND {
        return Ok(json!({
            "synced": null,
            "plain": null,
            "instrumental": false,
            "error": "not found"
        }));
    }
    if !resp.status().is_success() {
        return Err(format!("http {}", resp.status().as_u16()));
    }
    let data: GetResponse = resp.json().await.map_err(|e| e.to_string())?;
    Ok(json!({
        "synced": data.synced_lyrics,
        "plain": data.plain_lyrics,
        "instrumental": data.instrumental.unwrap_or(false),
        "error": null
    }))
}

#[tokio::main]
async fn main() {
    let args: Vec<String> = env::args().skip(1).collect();
    if args.is_empty() {
        usage_and_exit();
    }

    let client = reqwest::Client::new();

    if args[0] == "--search" {
        if args.len() < 2 {
            print_json(&json!({"error": "missing query"}));
            process::exit(1);
        }
        let query = args[1..].join(" ");
        match search(&client, &query).await {
            Ok(v) => print_json(&v),
            Err(e) => print_json(&json!({"error": e})),
        }
        return;
    }

    if args.len() < 2 {
        usage_and_exit();
    }
    let artist = &args[0];
    let track = args[1..].join(" ");
    match fetch_lyrics(&client, artist, &track).await {
        Ok(v) => print_json(&v),
        Err(e) => print_json(&json!({
            "synced": null,
            "plain": null,
            "instrumental": false,
            "error": e
        })),
    }
}
