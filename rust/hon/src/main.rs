use rand::Rng;
use serde::Serialize;
use std::path::PathBuf;

#[derive(Serialize)]
struct Output {
    #[serde(rename = "gifPath")]
    gif_path: String,
    #[serde(rename = "gifUrl")]
    gif_url: String,
    error: Option<String>,
}

fn fail(msg: impl Into<String>) -> Output {
    Output {
        gif_path: String::new(),
        gif_url: String::new(),
        error: Some(msg.into()),
    }
}

#[tokio::main]
async fn main() {
    let urls: Vec<String> = match serde_json::from_str(include_str!("../assets/hon.json")) {
        Ok(v) => v,
        Err(e) => {
            let out = fail(format!("load urls failed: {e}"));
            println!("{}", serde_json::to_string(&out).unwrap());
            std::process::exit(1);
        }
    };

    let url = urls[rand::thread_rng().gen_range(0..urls.len())].clone();
    let out_path = PathBuf::from("/tmp/hon.gif");

    let client = reqwest::Client::new();
    let result = async {
        let resp = client
            .get(&url)
            .send()
            .await
            .map_err(|e| format!("download failed: {e}"))?;
        let status = resp.status();
        if !status.is_success() {
            return Err(format!("download failed: HTTP {status}"));
        }
        let bytes = resp
            .bytes()
            .await
            .map_err(|e| format!("read body failed: {e}"))?;
        std::fs::write(&out_path, &bytes).map_err(|e| format!("save failed: {e}"))?;
        Ok::<_, String>(())
    }
    .await;

    match result {
        Ok(()) => {
            let out = Output {
                gif_path: out_path.to_string_lossy().to_string(),
                gif_url: url,
                error: None,
            };
            println!("{}", serde_json::to_string(&out).unwrap());
        }
        Err(e) => {
            let out = fail(e);
            println!("{}", serde_json::to_string(&out).unwrap());
            std::process::exit(1);
        }
    }
}
