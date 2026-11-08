use serde::Deserialize;
use std::io::{self, Read};
use std::process::Command;

#[derive(Deserialize)]
struct Spec { op: String, input: String, output: Option<String>, args: Option<Vec<String>> }

fn main() {
    // ffmpeg orchestration wrapper stub: reads JSON spec from stdin, runs ffmpeg.
    let mut input = String::new();
    let _ = io::stdin().read_to_string(&mut input);
    let spec: Spec = match serde_json::from_str(&input) { Ok(s)=>s, Err(e)=>{ eprintln!("json error: {e}"); std::process::exit(1); } };
    let mut cmd = Command::new("ffmpeg");
    cmd.arg("-y").arg("-i").arg(&spec.input);
    if let Some(extra) = spec.args { for a in extra { cmd.arg(a); } }
    if let Some(out) = spec.output { cmd.arg(out); }
    let status = match cmd.status() { Ok(s)=>s, Err(e)=>{ eprintln!("ffmpeg exec error: {e}"); std::process::exit(1); } };
    if !status.success() { eprintln!("ffmpeg failed: {}", status); std::process::exit(1); }
    println!("{{\"ok\":true}}");
}
