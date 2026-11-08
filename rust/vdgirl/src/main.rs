use anyhow::{Context, Result};
use serde::Serialize;
use serde_json;
use std::path::PathBuf;
use std::process::Command;

#[derive(Serialize)]
struct Output {
    video_url: String,
    thumbnail_url: String,
    duration: f64,
    width: u32,
    height: u32,
    metadata: serde_json::Value,
}

#[derive(serde::Deserialize)]
struct ProbeFormat { duration: Option<String> }
#[derive(serde::Deserialize)]
struct ProbeStream { width: Option<u32>, height: Option<u32> }
#[derive(serde::Deserialize)]
struct Probe { format: Option<ProbeFormat>, streams: Option<Vec<ProbeStream>> }

async fn download(url: &str, dest: &PathBuf) -> Result<()> {
    let client = reqwest::Client::new();
    let resp = match client.get(url).send().await {
        Ok(r) => r,
        Err(e) if e.is_connect() => {
            let ips = ["1.1.1.1", "8.8.8.8"];
            let mut last = e;
            let mut ok = None;
            for ip in ips {
                let c = reqwest::Client::builder().resolve("files.catbox.moe", format!("{}:443", ip).parse().unwrap()).build().unwrap();
                match c.get(url).send().await {
                    Ok(r) => { ok = Some(r); break; }
                    Err(e2) => last = e2,
                }
            }
            match ok { Some(r) => r, None => return Err(last.into()) }
        }
        Err(e) => return Err(e.into()),
    };
    let bytes = resp.bytes().await.context("read bytes")?;
    std::fs::write(dest, &bytes).context("write file")?;
    Ok(())
}

#[tokio::main]
async fn main() -> Result<()> {
    let args: Vec<String> = std::env::args().collect();
    if args.len() < 2 { eprintln!("usage: vdgirl <video_url>"); std::process::exit(1); }
    let video_url = args[1].clone();
    let tmp = std::env::temp_dir().join(format!("vdgirl_{}", std::process::id()));
    std::fs::create_dir_all(&tmp)?;
    let video_path = tmp.join("video.mp4");
    let thumb_path = tmp.join("thumb.jpg");
    download(&video_url, &video_path).await.context("download")?;
    let out = Command::new("ffprobe").args(["-v","error","-show_entries","format=duration:stream=width,height","-of","json"]).arg(&video_path).output().context("ffprobe")?;
    let probe: Probe = serde_json::from_slice(&out.stdout).context("parse probe")?;
    let duration: f64 = probe.format.as_ref().and_then(|f| f.duration.as_ref()).and_then(|s| s.parse().ok()).unwrap_or(0.0);
    let (width, height) = probe.streams.as_ref().and_then(|s| s.first()).map(|s| (s.width.unwrap_or(0), s.height.unwrap_or(0))).unwrap_or((0,0));
    let _ = Command::new("ffmpeg").args(["-y","-i"]).arg(&video_path).args(["-ss","0","-vframes","1"]).arg(&thumb_path).output();
    let thumbnail_url = thumb_path.to_string_lossy().to_string();
    let metadata = serde_json::json!({"duration": duration, "width": width, "height": height});
    let output = Output { video_url: video_url.clone(), thumbnail_url, duration, width, height, metadata };
    println!("{}", serde_json::to_string(&output)?);
    Ok(())
}
