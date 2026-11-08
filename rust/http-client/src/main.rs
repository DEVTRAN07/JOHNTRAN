use serde::{Deserialize, Serialize};
use std::io::{self, Read};

#[derive(Serialize, Deserialize)]
struct Req { url: String, method: Option<String> }

fn main() {
    // minimal stub: reads JSON {url} from stdin, performs allowlist-checked GET, writes body to stdout.
    let mut input = String::new();
    let _ = io::stdin().read_to_string(&mut input);
    let req: Req = match serde_json::from_str(&input) { Ok(r)=>r, Err(e)=>{ eprintln!("json error: {e}"); std::process::exit(1); } };
    // Privacy allowlist (port stub): allow public https and localhost http
    let ok = req.url.starts_with("https://") || req.url.starts_with("http://localhost") || req.url.starts_with("http://127.0.0.1");
    if !ok { eprintln!("blocked by allowlist"); std::process::exit(1); }
    let client = reqwest::blocking::Client::builder().gzip(true).build().expect("client");
    let resp = match client.get(&req.url).send() { Ok(r)=>r, Err(e)=>{ eprintln!("http error: {e}"); std::process::exit(1); } };
    let bytes = match resp.bytes() { Ok(b)=>b, Err(e)=>{ eprintln!("body error: {e}"); std::process::exit(1); } };
    use std::io::Write;
    let _ = io::stdout().write_all(&bytes);
}
