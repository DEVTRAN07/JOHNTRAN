use serde_json::json;
use std::env;
use std::process;

const TTS_URL: &str = "https://translate.google.com/translate_tts";
const MAX_CHUNK: usize = 180;
const MAX_TOTAL: usize = 900;

fn encode(s: &str) -> String {
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

fn split_chunks(text: &str) -> Vec<String> {
    let mut chunks = Vec::new();
    let mut current = String::new();
    for part in text.split_inclusive(|c| c == '.' || c == '!' || c == '?' || c == '\n') {
        let s = part.trim();
        if s.is_empty() { continue; }
        if !current.is_empty() && current.len() + s.len() + 1 > MAX_CHUNK {
            chunks.push(current.trim().to_string());
            current = s.to_string();
        } else {
            if !current.is_empty() { current.push(' '); }
            current.push_str(s);
        }
    }
    if !current.trim().is_empty() { chunks.push(current.trim().to_string()); }
    if chunks.is_empty() { chunks.push(text.trim().to_string()); }
    chunks.truncate((MAX_TOTAL + MAX_CHUNK - 1) / MAX_CHUNK);
    chunks
}

#[tokio::main]
async fn main() {
    let args: Vec<String> = env::args().skip(1).collect();
    if args.is_empty() {
        println!("{}", json!({"audioPath":null,"duration":0,"text":"","error":"missing text"}));
        process::exit(1);
    }
    let text = args[0].clone();
    let clean: String = text.trim().chars().take(MAX_TOTAL).collect();
    if clean.is_empty() {
        println!("{}", json!({"audioPath":null,"duration":0,"text":"","error":"empty text"}));
        process::exit(1);
    }

    let client = reqwest::Client::new();
    let chunks = split_chunks(&clean);
    let mut buf: Vec<u8> = Vec::new();
    for chunk in &chunks {
        let url = format!("{}?ie=UTF-8&client=tw-ob&tl=vi&q={}", TTS_URL, encode(chunk));
        match client.get(&url).send().await {
            Ok(resp) => match resp.bytes().await {
                Ok(b) => {
                    if b.len() < 200 {
                        println!("{}", json!({"audioPath":null,"duration":0,"text":clean,"error":"empty tts response"}));
                        process::exit(1);
                    }
                    buf.extend_from_slice(&b);
                }
                Err(e) => {
                    println!("{}", json!({"audioPath":null,"duration":0,"text":clean,"error":e.to_string()}));
                    process::exit(1);
                }
            },
            Err(e) => {
                println!("{}", json!({"audioPath":null,"duration":0,"text":clean,"error":e.to_string()}));
                process::exit(1);
            }
        }
    }

    let dir = env::temp_dir();
    let file_name = format!("tts_{}.mp3", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis());
    let path = dir.join(file_name);
    if let Err(e) = std::fs::write(&path, &buf) {
        println!("{}", json!({"audioPath":null,"duration":0,"text":clean,"error":e.to_string()}));
        process::exit(1);
    }
    let duration = clean.len() as f64 / 15.0;
    println!("{}", json!({
        "audioPath": path.to_string_lossy(),
        "duration": duration,
        "text": clean,
        "error": null
    }));
}
