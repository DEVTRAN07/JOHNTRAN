use image::imageops::FilterType;
use serde::Deserialize;
use serde_json::Value;
use std::io::{self, Read, Write};

#[derive(Deserialize)]
struct Spec { op: String, width: Option<u32>, height: Option<u32>, size: Option<u32> }

fn main() {
    let mut input = Vec::new();
    if io::stdin().read_to_end(&mut input).is_err() { eprintln!("stdin read error"); std::process::exit(1); }
    // try parse spec from args or expect JSON header + raw image not supported here; simple CLI: reads JSON with base64? No — easier: take JSON spec as argv[1], read image bytes from stdin.
    let spec_json = std::env::args().nth(1).unwrap_or_else(|| r#"{"op":"to_png"}"#.into());
    let spec: Spec = serde_json::from_str(&spec_json).unwrap_or(Spec{op:"to_png".into(), width:None, height:None, size:None});
    let img = match image::load_from_memory(&input) {
        Ok(i) => i,
        Err(e) => { eprintln!("decode error: {e}"); std::process::exit(1); }
    };
    let out = match spec.op.as_str() {
        "resize" => {
            let w = spec.width.unwrap_or(256); let h = spec.height.unwrap_or(256);
            img.resize_exact(w, h, FilterType::Lanczos3)
        }
        "round" => {
            let s = spec.size.unwrap_or(256);
            let resized = img.resize_exact(s, s, FilterType::Lanczos3).to_rgba8();
            let mut out = resized.clone();
            let c = s as f32 / 2.0; let r = c;
            for y in 0..s { for x in 0..s {
                let dx = x as f32 + 0.5 - c; let dy = y as f32 + 0.5 - c;
                if dx*dx + dy*dy > r*r { out.get_pixel_mut(x,y).0[3] = 0; }
            }}
            image::DynamicImage::ImageRgba8(out)
        }
        _ => img,
    };
    let mut buf = Vec::new();
    if out.write_to(&mut std::io::Cursor::new(&mut buf), image::ImageFormat::Png).is_err() {
        eprintln!("encode error"); std::process::exit(1);
    }
    let _ = io::stdout().write_all(&buf);
}
