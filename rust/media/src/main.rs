use serde::Deserialize;
use std::process::Command;

#[derive(Deserialize)]
struct Spec {
    op: String,
    #[serde(default)]
    input: String,
    #[serde(default)]
    output: String,
    #[serde(default)]
    duration: f64,
    #[serde(default)]
    is_still: bool,
    #[serde(default)]
    time: f64,
}

fn ffmpeg_path() -> String {
    std::env::var("FFMPEG_PATH").unwrap_or_else(|_| "ffmpeg".to_string())
}

fn run(spec: &Spec) -> Result<String, String> {
    let ffmpeg = ffmpeg_path();
    match spec.op.as_str() {
        "convert_framed" => {
            let frame = std::path::PathBuf::from(std::env::current_dir().unwrap_or_default()).join("khung-stk/hoa-anh-dao.png");
            let frame_str = frame.to_string_lossy().to_string();
            let out = Command::new(&ffmpeg)
                .args(["-y", "-i", &spec.input, "-i", &frame_str])
                .args(["-filter_complex",
                    "[0:v]fps=15,scale=360:360:force_original_aspect_ratio=increase:flags=lanczos,crop=360:360,format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='alpha(X,Y)*if(lte(hypot(X-179.5,Y-179.5),180),1,0)'[circle];\
                     [1:v]scale=480:480:flags=lanczos,format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='alpha(X,Y)*if(gt(hypot(X-239.5,Y-239.5),180),1,0)'[frame];\
                     [frame][circle]overlay=60:60:shortest=1,scale=480:480:flags=lanczos,format=rgba[framed]"])
                .args(["-map", "[framed]", "-vcodec", "libwebp", "-loop", "0", "-q:v", "65", &spec.output])
                .output()
                .map_err(|e| format!("ffmpeg spawn: {}", e))?;
            if out.status.success() {
                Ok(format!(r#"{{"ok":true,"path":"{}"}}"#, spec.output))
            } else {
                Ok(format!(r#"{{"ok":false,"error":"{}"}}"#, String::from_utf8_lossy(&out.stderr).chars().take(200).collect::<String>()))
            }
        }
        "convert_static" => {
            let out = Command::new(&ffmpeg)
                .args(["-y", "-loop", "1", "-i", &spec.input, "-t", "2.5"])
                .args(["-filter_complex",
                    "scale=480:480:force_original_aspect_ratio=increase:flags=lanczos,crop=480:480[content];\
                     [content]geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='alpha(X,Y)*if(lte(hypot(X-239.5,Y-239.5),240),1,0)'"])
                .args(["-vcodec", "libwebp", "-loop", "0", &spec.output])
                .output()
                .map_err(|e| format!("ffmpeg spawn: {}", e))?;
            if out.status.success() {
                Ok(format!(r#"{{"ok":true,"path":"{}"}}"#, spec.output))
            } else {
                Ok(format!(r#"{{"ok":false,"error":"{}"}}"#, String::from_utf8_lossy(&out.stderr).chars().take(200).collect::<String>()))
            }
        }
        "probe" => {
            let out = Command::new("ffprobe")
                .args(["-v", "json", "-show_format", "-show_streams", &spec.input])
                .output()
                .map_err(|e| format!("ffprobe spawn: {}", e))?;
            if out.status.success() {
                Ok(String::from_utf8_lossy(&out.stdout).to_string())
            } else {
                Ok(format!(r#"{{"ok":false,"error":"{}"}}"#, String::from_utf8_lossy(&out.stderr).chars().take(200).collect::<String>()))
            }
        }
        "thumbnail" => {
            let out = Command::new(&ffmpeg)
                .args(["-y", "-i", &spec.input, "-ss", &format!("{}", spec.time), "-vframes", "1", &spec.output])
                .output()
                .map_err(|e| format!("ffmpeg spawn: {}", e))?;
            if out.status.success() {
                Ok(format!(r#"{{"ok":true,"path":"{}"}}"#, spec.output))
            } else {
                Ok(format!(r#"{{"ok":false,"error":"{}"}}"#, String::from_utf8_lossy(&out.stderr).chars().take(200).collect::<String>()))
            }
        }
        _ => Ok(format!(r#"{{"ok":false,"error":"unknown op: {}"}}"#, spec.op)),
    }
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.len() < 2 {
        eprintln!("usage: media '<json_spec>'");
        std::process::exit(1);
    }
    let spec: Spec = match serde_json::from_str(&args[1]) {
        Ok(s) => s,
        Err(e) => {
            eprintln!("json parse error: {}", e);
            std::process::exit(1);
        }
    };
    match run(&spec) {
        Ok(json) => println!("{}", json),
        Err(e) => {
            eprintln!("{}", e);
            std::process::exit(1);
        }
    }
}
