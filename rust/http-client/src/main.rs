use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::io::{self, Read};

pub struct DoHResolver { pub ip: String, pub host: String }

pub struct HttpError { pub message: String }

pub struct Response { pub status: u16, pub body: Vec<u8>, pub content_type: String }

pub struct HttpClient { allowed_hosts: Vec<String>, doh_resolvers: Vec<DoHResolver> }

impl HttpClient {
    pub fn new(allowed_hosts: Vec<String>) -> Self {
        let resolvers = vec![
            DoHResolver { ip: "1.1.1.1".into(), host: "cloudflare-dns.com".into() },
            DoHResolver { ip: "1.0.0.1".into(), host: "cloudflare-dns.com".into() },
            DoHResolver { ip: "8.8.8.8".into(), host: "dns.google".into() },
            DoHResolver { ip: "8.8.4.4".into(), host: "dns.google".into() },
        ];
        Self { allowed_hosts, doh_resolvers: resolvers }
    }
    pub fn host_allowed(&self, url: &str) -> bool {
        let host = host_of(url);
        if self.allowed_hosts.is_empty() { return true; }
        self.allowed_hosts.iter().any(|a| host == *a || host.ends_with(&format!(".{}", a)))
    }
    pub async fn request(&self, url: &str, method: &str, headers: Option<serde_json::Value>, body: Option<String>) -> Result<Response, HttpError> {
        if !self.host_allowed(url) { return Err(HttpError { message: format!("host not allowed: {}", url) }); }
        let client = Client::builder().gzip(true).build().map_err(|e| HttpError { message: e.to_string() })?;
        let m = method.to_uppercase();
        let mut req = client.request(m.parse().unwrap_or(reqwest::Method::GET), url);
        if let Some(h) = headers { if let Some(obj) = h.as_object() { for (k, v) in obj { if let Some(s) = v.as_str() { req = req.header(k, s); } } } }
        if let Some(b) = body { req = req.body(b); }
        let resp = req.send().await.map_err(|e| HttpError { message: e.to_string() })?;
        let status = resp.status().as_u16();
        let ct = resp.headers().get("content-type").and_then(|v| v.to_str().ok()).unwrap_or("").to_string();
        let bytes = resp.bytes().await.map_err(|e| HttpError { message: e.to_string() })?.to_vec();
        Ok(Response { status, body: bytes, content_type: ct })
    }
    pub async fn get_json(&self, url: &str, headers: Option<serde_json::Value>) -> Result<serde_json::Value, HttpError> {
        let r = self.request(url, "GET", headers, None).await?;
        serde_json::from_slice(&r.body).map_err(|e| HttpError { message: e.to_string() })
    }
    pub async fn get_buffer(&self, url: &str, headers: Option<serde_json::Value>) -> Result<Vec<u8>, HttpError> {
        let r = self.request(url, "GET", headers, None).await?;
        Ok(r.body)
    }
}

fn host_of(url: &str) -> String {
    if let Some(rest) = url.split("://").nth(1) { rest.split("/").next().unwrap_or("").split(":").next().unwrap_or("").to_string() } else { String::new() }
}

#[derive(Deserialize)]
struct ReqSpec { url: String, method: Option<String>, headers: Option<serde_json::Value> }

#[derive(Serialize)]
struct Out { status: u16, body: String, #[serde(rename="contentType")] content_type: String }

fn main() {
    let mut input = String::new();
    let _ = io::stdin().read_to_string(&mut input);
    let spec: ReqSpec = match serde_json::from_str(&input) { Ok(r) => r, Err(e) => { eprintln!("json error: {e}"); std::process::exit(1); } };
    let c = reqwest::blocking::Client::builder().gzip(true).build().expect("client");
    let method = spec.method.clone().unwrap_or_else(|| "GET".to_string());
    let mut req = c.request(method.parse().unwrap_or(reqwest::Method::GET), &spec.url);
    if let Some(h) = spec.headers { if let Some(obj)=h.as_object(){ for (k,v) in obj { if let Some(s)=v.as_str(){ req=req.header(k,s); } } } }
    let resp = match req.send() { Ok(r)=>r, Err(e)=>{ eprintln!("{}", e); std::process::exit(1); } };
    let status = resp.status().as_u16();
    let ct = resp.headers().get("content-type").and_then(|v|v.to_str().ok()).unwrap_or("").to_string();
    let bytes = match resp.bytes() { Ok(b)=>b.to_vec(), Err(e)=>{ eprintln!("{}", e); std::process::exit(1); } };
    let body = String::from_utf8_lossy(&bytes).to_string();
    let out = Out { status, body, content_type: ct };
    println!("{}", serde_json::to_string(&out).unwrap());
}