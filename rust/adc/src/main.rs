use serde::Serialize;
use std::process;
use url::form_urlencoded;

#[derive(Serialize)]
struct Output {
    #[serde(skip_serializing_if = "Option::is_none")]
    code: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    url: Option<String>,
    error: Option<String>,
}

fn print<T: Serialize>(val: &T) {
    let s = serde_json::to_string(val).unwrap_or_else(|_| "{}".to_string());
    println!("{s}");
}

fn usage() -> ! {
    eprintln!("Usage: adc get <pastebin_or_dpaste_url> | adc upload <code>");
    process::exit(1);
}

#[tokio::main]
async fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.len() < 3 {
        usage();
    }
    match args[1].as_str() {
        "get" => run_get(&args[2]).await,
        "upload" => run_upload(&args[2]).await,
        _ => usage(),
    }
}

fn extract_id(url: &str) -> (String, String) {
    let url = url.trim();
    let rest = url
        .strip_prefix("https://")
        .or_else(|| url.strip_prefix("http://"))
        .unwrap_or(url);
    let mut parts = rest.splitn(2, "/");
    let host = parts.next().unwrap_or("").to_string();
    let path = parts.next().unwrap_or("");
    let id = path.split("/").next().unwrap_or("").split(".").next().unwrap_or("").to_string();
    (host, id)
}

async fn run_get(url: &str) {
    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0")
        .build()
        .unwrap_or_else(|_| reqwest::Client::new());

    let (host, id) = extract_id(url);

    let code = if host.contains("pastebin") && !id.is_empty() {
        fetch_text(&client, &format!("https://pastebin.com/raw/{id}")).await
    } else if host.contains("dpaste") && !id.is_empty() {
        fetch_text(&client, &format!("https://dpaste.com/{id}.txt")).await
    } else {
        Err("Could not extract id from URL".to_string())
    };

    match code {
        Ok(c) => print(&Output { code: Some(c), url: None, error: None }),
        Err(e) => print(&Output { code: None, url: None, error: Some(e) }),
    }
}

async fn fetch_text(client: &reqwest::Client, url: &str) -> Result<String, String> {
    let resp = client.get(url).send().await.map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("HTTP {}", resp.status()));
    }
    resp.text().await.map_err(|e| e.to_string())
}

async fn run_upload(code: &str) {
    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0")
        .build()
        .unwrap_or_else(|_| reqwest::Client::new());

    let encoded: String = form_urlencoded::Serializer::new(String::new())
        .append_pair("content", code)
        .append_pair("syntax", "text")
        .append_pair("expiry_days", "7")
        .finish();

    let resp = client
        .post("https://dpaste.com/api/v2/")
        .header("Content-Type", "application/x-www-form-urlencoded")
        .body(encoded)
        .send()
        .await;

    match resp {
        Ok(r) => {
            let text = r.text().await.unwrap_or_default();
            let trimmed = text.trim();
            if trimmed.starts_with("https://dpaste.com/") {
                print(&Output { code: None, url: Some(trimmed.to_string()), error: None });
            } else {
                print(&Output { code: None, url: None, error: Some("Invalid response from dpaste".to_string()) });
            }
        }
        Err(e) => print(&Output { code: None, url: None, error: Some(e.to_string()) }),
    }
}
