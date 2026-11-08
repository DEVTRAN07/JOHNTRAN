use image::{imageops::FilterType, GenericImageView, ImageFormat};
use serde::Serialize;
use std::path::PathBuf;

#[derive(Serialize)]
struct Output {
    #[serde(rename = "pngPath")]
    png_path: String,
    width: u32,
    height: u32,
    error: Option<String>,
}

fn fail(msg: impl Into<String>) -> Output {
    Output {
        png_path: String::new(),
        width: 0,
        height: 0,
        error: Some(msg.into()),
    }
}

async fn download(client: &reqwest::Client, url: &str) -> Result<Vec<u8>, String> {
    let resp = client
        .get(url)
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
    Ok(bytes.to_vec())
}

fn normalize_png(bytes: &[u8], out_path: &PathBuf) -> Result<(u32, u32), String> {
    let img = image::load_from_memory(bytes).map_err(|e| format!("decode failed: {e}"))?;
    let (w, h) = img.dimensions();
    let max_dim = 256u32;
    let (nw, nh) = if w > max_dim || h > max_dim {
        let scale = (max_dim as f32 / w as f32).min(max_dim as f32 / h as f32);
        let nw = ((w as f32) * scale).round().max(1.0) as u32;
        let nh = ((h as f32) * scale).round().max(1.0) as u32;
        (nw, nh)
    } else {
        (w.max(1), h.max(1))
    };
    let out = if nw == w && nh == h {
        img
    } else {
        image::DynamicImage::ImageRgba8(image::imageops::resize(
            &img.to_rgba8(),
            nw,
            nh,
            FilterType::Lanczos3,
        ))
    };
    out.save_with_format(out_path, ImageFormat::Png)
        .map_err(|e| format!("encode png failed: {e}"))?;
    Ok((nw, nh))
}

#[tokio::main]
async fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.len() < 2 {
        let out = fail("usage: getavt <avatar_url>");
        println!("{}", serde_json::to_string(&out).unwrap());
        std::process::exit(1);
    }
    let url = args[1].clone();
    let out_path = std::env::temp_dir().join("avt.png");

    let client = reqwest::Client::new();
    let result = async {
        let bytes = download(&client, &url).await?;
        let (width, height) = normalize_png(&bytes, &out_path)?;
        Ok::<_, String>((width, height))
    }
    .await;

    match result {
        Ok((width, height)) => {
            let out = Output {
                png_path: out_path.to_string_lossy().to_string(),
                width,
                height,
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
