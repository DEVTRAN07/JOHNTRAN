use image::imageops::{crop_imm, FilterType, resize, thumbnail};
use image::GenericImageView;
use serde::Deserialize;
use std::io::{self, Cursor, Write};

#[derive(Deserialize)]
struct Spec {
    op: String,
    w: Option<u32>,
    h: Option<u32>,
    size: Option<u32>,
    x: Option<u32>,
    y: Option<u32>,
}

fn fail(msg: &str) -> ! {
    eprintln!("{msg}");
    std::process::exit(1);
}

fn req(v: Option<u32>, what: &str) -> u32 {
    v.unwrap_or_else(|| fail(&format!("missing required field: {what}")))
}

fn round_clip(img: image::DynamicImage, size: u32) -> image::DynamicImage {
    let mut out = img.to_rgba8();
    let c = size as f32 / 2.0;
    let r2 = c * c;
    for y in 0..size {
        for x in 0..size {
            let dx = x as f32 + 0.5 - c;
            let dy = y as f32 + 0.5 - c;
            if dx * dx + dy * dy > r2 {
                out.get_pixel_mut(x, y).0[3] = 0;
            }
        }
    }
    image::DynamicImage::ImageRgba8(out)
}

fn cover_fit(img: &image::DynamicImage, size: u32) -> image::DynamicImage {
    let (w, h) = img.dimensions();
    let scale = f32::max(size as f32 / w as f32, size as f32 / h as f32);
    let nw = (w as f32 * scale) as u32;
    let nh = (h as f32 * scale) as u32;
    let resized = resize(img, nw, nh, FilterType::Triangle);
    let x = nw.saturating_sub(size) / 2;
    let y = nh.saturating_sub(size) / 2;
    crop_imm(&resized, x, y, size, size).to_image().into()
}

fn main() {
    let path = std::env::args().nth(1).unwrap_or_else(|| {
        fail("usage: image-proc <image_path> <json_spec>")
    });
    let spec_json = std::env::args().nth(2).unwrap_or_else(|| {
        fail("usage: image-proc <image_path> <json_spec>")
    });
    let spec: Spec = serde_json::from_str(&spec_json).unwrap_or_else(|e| {
        fail(&format!("invalid json spec: {e}"))
    });

    let img = image::open(&path).unwrap_or_else(|e| {
        fail(&format!("cannot open image {path}: {e}"))
    });

    let out = match spec.op.as_str() {
        "resize" => {
            let w = req(spec.w, "w");
            let h = req(spec.h, "h");
            image::DynamicImage::ImageRgba8(thumbnail(&img, w, h))
        }
        "round" => {
            let size = req(spec.size, "size");
            round_clip(image::DynamicImage::ImageRgba8(thumbnail(&img, size, size)), size)
        }
        "crop" => {
            let x = req(spec.x, "x");
            let y = req(spec.y, "y");
            let w = req(spec.w, "w");
            let h = req(spec.h, "h");
            let (iw, ih) = img.dimensions();
            let x = x.min(iw);
            let y = y.min(ih);
            let w = w.min(iw.saturating_sub(x));
            let h = h.min(ih.saturating_sub(y));
            crop_imm(&img, x, y, w, h).to_image().into()
        }
        "to_png" => img,
        "thumbnail" => {
            let size = req(spec.size, "size");
            round_clip(cover_fit(&img, size), size)
        }
        op => fail(&format!("unknown op: {op}")),
    };

    let mut buf = Vec::new();
    out.write_to(&mut Cursor::new(&mut buf), image::ImageFormat::Png)
        .unwrap_or_else(|e| fail(&format!("encode error: {e}")));
    io::stdout().write_all(&buf).unwrap_or_else(|e| fail(&format!("stdout write error: {e}")));
}
