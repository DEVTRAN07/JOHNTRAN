use serde::Serialize;
use serde_json;
use std::path::PathBuf;
use std::process::Command;

#[derive(Serialize)]
struct Output { audio_path: String, duration: f64, error: Option<String> }

#[derive(serde::Deserialize)]
struct ProbeFormat { duration: Option<String> }
#[derive(serde::Deserialize)]
struct Probe { format: Option<ProbeFormat> }

fn host_of(url: &str) -> String {
    let s = url.trim();
    let s = if let Some(i) = s.find("://") { &s[i + 3..] } else { s };
    let host = s.split('/').next().unwrap_or(s);
    let host = host.split(':').next().unwrap_or(host);
    host.to_string()
}

async fn download(url: &str, dest: &PathBuf) -> Result<(), String> {
    let client = reqwest::Client::new();
    let resp = match client.get(url).send().await {
        Ok(r) => r,
        Err(e) if e.is_connect() || e.is_request() => {
            let host = host_of(url);
            let mut last = e;
            let mut ok = None;
            for ip in ["1.1.1.1", "8.8.8.8"] {
                let addr = format!("{}:443", ip).parse().unwrap();
                let c = reqwest::Client::builder().resolve(&host, addr).build().map_err(|e| e.to_string())?;
                match c.get(url).send().await {
                    Ok(r) => { ok = Some(r); break; }
                    Err(e2) => last = e2,
                }
            }
            match ok { Some(r) => r, None => return Err(last.to_string()) }
        }
        Err(e) => return Err(e.to_string()),
    };
    let bytes = resp.bytes().await.map_err(|e| e.to_string())?;
    std::fs::write(dest, &bytes).map_err(|e| e.to_string())?;
    Ok(())
}

#[tokio::main]
async fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.len() < 2 { eprintln!("usage: getvoice <video_url>"); std::process::exit(1); }
    let video_url = args[1].clone();
    let tmp = std::env::temp_dir().join(format!("getvoice_{}", std::process::id()));
    let _ = std::fs::create_dir_all(&tmp);
    let video_path = tmp.join("in.mp4");
    let mp3_path = tmp.join("out.mp3");

    let result = async {
        download(&video_url, &video_path).await.map_err(|e| e)?;
        let out = Command::new("ffprobe").args(["-v","error","-show_entries","format=duration","-of","json"]).arg(&video_path).output().map_err(|e| e.to_string())?;
        let probe: Probe = serde_json::from_slice(&out.stdout).map_err(|e| e.to_string())?;
        let duration: f64 = probe.format.as_ref().and_then(|f| f.duration.as_ref()).and_then(|s| s.parse().ok()).unwrap_or(0.0);
        let status = Command::new("ffmpeg").args(["-y","-i"]).arg(&video_path).args(["-vn","-acodec","libmp3lame","-q:a","2"]).arg(&mp3_path).status().map_err(|e| e.to_string())?;
        if !status.success() { return Err("ffmpeg failed".to_string()); }
        Ok((mp3_path.to_string_lossy().to_string(), duration))
    }.await;

    match result {
        Ok((audio_path, duration)) => {
            let output = Output { audio_path, duration, error: None };
            println!("{}", serde_json::to_string(&output).unwrap());
        }
        Err(e) => {
            let output = Output { audio_path: String::new(), duration: 0.0, error: Some(e) };
            println!("{}", serde_json::to_string(&output).unwrap());
            std::process::exit(1);
        }
    }
}
