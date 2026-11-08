use serde_json::Value;
use std::io::{self, Write};
use std::process::{Command, Stdio};

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.len() < 2 {
        eprintln!("usage: menu <json_spec>");
        std::process::exit(1);
    }

    let spec_raw = &args[1];
    let mut spec: Value = match serde_json::from_str(spec_raw) {
        Ok(v) => v,
        Err(e) => {
            eprintln!("json parse error: {e}");
            std::process::exit(1);
        }
    };

    // Ensure canvas-render receives {"type":"menu", ...spec}
    if let Value::Object(ref mut map) = spec {
        map.entry("type".to_string())
            .or_insert_with(|| Value::String("menu".to_string()));
    } else {
        eprintln!("json spec must be an object");
        std::process::exit(1);
    }

    let exe = std::env::current_exe().unwrap_or_default();
    let dir = exe.parent().unwrap_or(std::path::Path::new("."));
    let canvas_bin = {
        let local = dir.join("canvas-render");
        if local.exists() {
            local
        } else {
            std::path::PathBuf::from("canvas-render")
        }
    };

    let mut child = match Command::new(&canvas_bin)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::inherit())
        .spawn()
    {
        Ok(c) => c,
        Err(e) => {
            eprintln!("failed to spawn canvas-render ({}): {e}", canvas_bin.display());
            std::process::exit(1);
        }
    };

    if let Some(mut stdin) = child.stdin.take() {
        if let Err(e) = stdin.write_all(spec.to_string().as_bytes()) {
            eprintln!("stdin write error: {e}");
            std::process::exit(1);
        }
    }

    let output = match child.wait_with_output() {
        Ok(o) => o,
        Err(e) => {
            eprintln!("canvas-render wait error: {e}");
            std::process::exit(1);
        }
    };

    if !output.status.success() {
        eprintln!("canvas-render exited with status {}", output.status);
        std::process::exit(1);
    }

    if let Err(e) = io::stdout().write_all(&output.stdout) {
        eprintln!("stdout write error: {e}");
        std::process::exit(1);
    }
}
