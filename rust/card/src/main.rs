use serde::Serialize;
use serde_json::Value;
use std::fs;
use std::io::Write;
use std::process::Command;

#[derive(Debug, thiserror::Error)]
enum Error {
    #[error("usage: card <avatar_url> <name> <followers> <hearts> <videos> <following> <verified> <username> <bio>")]
    Usage,
    #[error("http: {0}")]
    Http(#[from] reqwest::Error),
    #[error("io: {0}")]
    Io(#[from] std::io::Error),
    #[error("json: {0}")]
    Json(#[from] serde_json::Error),
    #[error("render: {0}")]
    Render(String),
}

#[derive(Serialize)]
struct Output {
    #[serde(rename = "canvasPath")]
    canvas_path: Option<String>,
    error: Option<String>,
}

#[tokio::main]
async fn main() {
    match run().await {
        Ok(out) => {
            let _ = serde_json::to_writer(std::io::stdout(), &out);
        }
        Err(err) => {
            let out = Output { canvas_path: None, error: Some(err.to_string()) };
            let _ = serde_json::to_writer(std::io::stderr(), &out);
            std::process::exit(1);
        }
    }
}

async fn run() -> Result<Output, Error> {
    let args: Vec<String> = std::env::args().collect();
    if args.len() != 10 {
        return Err(Error::Usage);
    }
    let avatar_url = &args[1];
    let name = &args[2];
    let followers = &args[3];
    let hearts = &args[4];
    let videos = &args[5];
    let following = &args[6];
    let verified = &args[7];
    let username = &args[8];
    let bio = &args[9];

    let client = reqwest::Client::new();
    let _avatar = client.get(avatar_url).send().await?.bytes().await?;

    let verified_flag = verified == "true" || verified == "1";
    let icon = if verified_flag { "\u{2705}" } else { "\u{1F464}" };
    let verified_label = if verified_flag { "true" } else { "false" };

    let spec: Value = serde_json::json!({
        "type": "vip",
        "title": name,
        "subtitle": bio,
        "icon": icon,
        "footer": format!("@{}", username),
        "avatar": avatar_url,
        "rows": [
            { "label": "Followers", "lines": [followers] },
            { "label": "Hearts", "lines": [hearts] },
            { "label": "Videos", "lines": [videos] },
            { "label": "Following", "lines": [following] },
            { "label": "Username", "lines": [username] },
            { "label": "Verified", "lines": [verified_label] },
        ]
    });

    let exe = std::env::current_exe()?;
    let bin = exe
        .parent()
        .ok_or_else(|| Error::Io(std::io::Error::new(std::io::ErrorKind::NotFound, "no exe parent")))?
        .join("canvas-render");

    let mut child = Command::new(bin)
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| Error::Render(format!("spawn canvas-render: {e}")))?;

    {
        let stdin = child.stdin.as_mut().ok_or_else(|| {
            Error::Io(std::io::Error::new(std::io::ErrorKind::NotFound, "no canvas-render stdin"))
        })?;
        write!(stdin, "{spec}")?;
    }

    let output = child
        .wait_with_output()
        .map_err(|e| Error::Render(format!("wait canvas-render: {e}")))?;

    if !output.status.success() {
        return Err(Error::Render(String::from_utf8_lossy(&output.stderr).into_owned()));
    }

    fs::write("/tmp/card.png", &output.stdout)?;

    Ok(Output {
        canvas_path: Some("/tmp/card.png".into()),
        error: None,
    })
}
