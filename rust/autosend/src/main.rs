use rand::Rng;
use serde_json::json;
use std::env;

#[tokio::main]
async fn main() {
    let _ = env::args();
    let urls: Vec<String> = serde_json::from_str(include_str!("../../../assets/autosend.json")).unwrap_or_default();
    if urls.is_empty() {
        println!("{}", json!({"gifPath":"/tmp/autosend.gif","gifUrl":"","error":"no urls"}));
        return;
    }
    let url = {
        let mut rng = rand::thread_rng();
        urls[rng.gen_range(0..urls.len())].clone()
    };
    let client = reqwest::Client::new();
    let bytes = match client.get(&url).send().await {
        Ok(resp) => match resp.bytes().await {
            Ok(b) => b,
            Err(e) => { println!("{}", json!({"gifPath":"/tmp/autosend.gif","gifUrl":url,"error":e.to_string()})); return; }
        },
        Err(e) => { println!("{}", json!({"gifPath":"/tmp/autosend.gif","gifUrl":url,"error":e.to_string()})); return; }
    };
    let path = "/tmp/autosend.gif";
    if std::fs::write(path, &bytes).is_err() { return; }
    println!("{}", json!({"gifPath":path,"gifUrl":url,"error":null}));
}
