use serde::Serialize;

#[derive(Serialize)]
struct Output {
    link: String,
    error: Option<String>,
}

fn extract_url(text: &str) -> Option<String> {
    for prefix in ["https://", "http://"] {
        if let Some(idx) = text.find(prefix) {
            let rest = &text[idx..];
            let end = rest
                .find(|c: char| c.is_whitespace() || c == '"' || c == '<' || c == '>')
                .unwrap_or(rest.len());
            let url = rest[..end].trim_end_matches(|c: char| c == '.' || c == ',' || c == ';');
            if url.len() > prefix.len() {
                return Some(url.to_string());
            }
        }
    }
    None
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let text = if args.len() >= 2 {
        args[1..].join(" ")
    } else {
        String::new()
    };

    let out = match extract_url(&text) {
        Some(link) => Output { link, error: None },
        None => Output {
            link: String::new(),
            error: Some("no url found".to_string()),
        },
    };
    println!("{}", serde_json::to_string(&out).unwrap());
    if out.error.is_some() {
        std::process::exit(1);
    }
}
