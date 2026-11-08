use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Serialize)]
struct Output {
    nickname: String,
    username: String,
    avatar: String,
    bio: String,
    followers: u64,
    likes: u64,
    error: Option<String>,
}

#[derive(Debug, Deserialize)]
struct OEmbed {
    #[serde(default)]
    author_name: Option<String>,
    #[serde(default)]
    author_url: Option<String>,
    #[serde(default)]
    thumbnail_url: Option<String>,
    #[serde(default)]
    description: Option<String>,
    #[serde(default)]
    followers: Option<u64>,
    #[serde(default)]
    likes: Option<u64>,
}

fn fail(msg: impl Into<String>) -> Output {
    Output {
        nickname: String::new(),
        username: String::new(),
        avatar: String::new(),
        bio: String::new(),
        followers: 0,
        likes: 0,
        error: Some(msg.into()),
    }
}

#[derive(Debug, Error)]
enum FbError {
    #[error("no input provided")]
    NoInput,
    #[error("failed to parse facebook url: {0}")]
    ParseUrl(String),
    #[error("oembed request failed: {0}")]
    OEmbed(String),
    #[error("oembed response invalid: {0}")]
    OEmbedInvalid(String),
}

fn parse_facebook_url(input: &str) -> Result<String, FbError> {
    let input = input.trim();
    if input.is_empty() {
        return Err(FbError::NoInput);
    }

    if input.starts_with("http://") || input.starts_with("https://") {
        let parsed = url::Url::parse(input).map_err(|e| FbError::ParseUrl(e.to_string()))?;
        let host = parsed.host_str().unwrap_or("");
        if host.contains("facebook.com") {
            return Ok(input.to_string());
        }
        return Err(FbError::ParseUrl(format!("not a facebook url: {input}")));
    }

    let username = input.trim_start_matches('/').trim();
    if username.is_empty() {
        return Err(FbError::NoInput);
    }
    if username.chars().all(|c| c.is_ascii_digit()) {
        Ok(format!("https://www.facebook.com/profile.php?id={username}"))
    } else {
        Ok(format!("https://www.facebook.com/{username}"))
    }
}

async fn fetch_oembed(client: &reqwest::Client, url: &str) -> Result<OEmbed, FbError> {
    let encoded: String = url
        .as_bytes()
        .iter()
        .flat_map(|&b| match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => vec![(b as char).to_string()],
            _ => vec![format!("%{:02X}", b)],
        })
        .collect::<Vec<String>>()
        .join("");
    let fb_endpoint = format!("https://www.facebook.com/plugins/oembed?url={encoded}");
    let noembed_endpoint = format!("https://noembed.com?url={encoded}");

    let resp = client.get(&fb_endpoint).send().await;
    let resp = match resp {
        Ok(r) if r.status().is_success() => r,
        _ => client
            .get(&noembed_endpoint)
            .send()
            .await
            .map_err(|e| FbError::OEmbed(e.to_string()))?,
    };
    if !resp.status().is_success() {
        return Err(FbError::OEmbed(format!("HTTP {}", resp.status())));
    }
    resp.json::<OEmbed>()
        .await
        .map_err(|e| FbError::OEmbedInvalid(e.to_string()))
}

fn oembed_to_output(oembed: OEmbed) -> Output {
    let author_name = oembed.author_name.unwrap_or_default();
    let username = oembed
        .author_url
        .and_then(|u| url::Url::parse(&u).ok())
        .and_then(|parsed| parsed.path_segments().and_then(|mut s| s.next_back()).map(|s| s.to_string()))
        .unwrap_or_default();
    Output {
        nickname: author_name,
        username,
        avatar: oembed.thumbnail_url.unwrap_or_default(),
        bio: oembed.description.unwrap_or_default(),
        followers: oembed.followers.unwrap_or(0),
        likes: oembed.likes.unwrap_or(0),
        error: None,
    }
}

#[tokio::main]
async fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.len() < 2 {
        let out = fail("usage: infofb <facebook_username_or_uid_or_link>");
        println!("{}", serde_json::to_string(&out).unwrap());
        std::process::exit(1);
    }

    let input = args[1].clone();
    let fb_url = match parse_facebook_url(&input) {
        Ok(u) => u,
        Err(e) => {
            let out = fail(e.to_string());
            println!("{}", serde_json::to_string(&out).unwrap());
            std::process::exit(1);
        }
    };

    let client = reqwest::Client::new();
    let result = fetch_oembed(&client, &fb_url).await;

    match result {
        Ok(oembed) => {
            let out = oembed_to_output(oembed);
            println!("{}", serde_json::to_string(&out).unwrap());
        }
        Err(e) => {
            let out = fail(e.to_string());
            println!("{}", serde_json::to_string(&out).unwrap());
            std::process::exit(1);
        }
    }
}
