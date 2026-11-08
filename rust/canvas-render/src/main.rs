mod theme;
mod render;

use std::io::{self, Read, Write};
use serde_json::Value;

fn main() {
    let mut input = String::new();
    if let Err(e) = io::stdin().read_to_string(&mut input) {
        eprintln!("stdin read error: {e}");
        std::process::exit(1);
    }
    let spec: Value = match serde_json::from_str(&input) {
        Ok(v) => v,
        Err(e) => {
            eprintln!("json parse error: {e}");
            std::process::exit(1);
        }
    };
    let png = match render::dispatch(&spec) {
        Ok(b) => b,
        Err(e) => {
            eprintln!("render error: {e}");
            std::process::exit(1);
        }
    };
    if let Err(e) = io::stdout().write_all(&png) {
        eprintln!("stdout write error: {e}");
        std::process::exit(1);
    }
}
