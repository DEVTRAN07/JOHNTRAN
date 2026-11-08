pub mod models;
pub mod soundcloud;
pub mod command;

use std::collections::HashMap;
use serde::{Deserialize, Serialize};
use thiserror::Error;

pub struct HttpClient { allowed_hosts: Vec<String> }
impl HttpClient {
    pub fn new(allowed_hosts: Vec<String>) -> Self { Self { allowed_hosts } }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Track {
    pub id: String,
    pub title: String,
    pub artist: String,
    pub duration: i64,
    pub thumbnail: Option<String>,
    pub source: String,
    pub source_url: Option<String>,
    pub plays: i64,
    pub likes: i64,
    pub preview_url: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Pending {
    pub provider_name: String,
    pub tracks: Vec<Track>,
    pub query: String,
    pub page: i64,
    pub quality: Option<i64>,
}

#[derive(Error, Debug)]
pub enum MusicError {
    #[error("No results")]
    NoResults,
    #[error("Not available: {0}")]
    NotAvailable(String),
    #[error("Need credentials")]
    NeedCredentials,
    #[error("Privacy blocked")]
    PrivacyBlocked,
    #[error("Provider not found: {0}")]
    ProviderNotFound(String),
    #[error("Network error: {0}")]
    NetworkError(String),
    #[error("Parse error: {0}")]
    ParseError(String),
}

pub struct MusicEngine {
    http: HttpClient,
    pending_cache: HashMap<String, Pending>,
    resolve_cache: HashMap<String, String>,
}

impl MusicEngine {
    pub fn new(allowed_hosts: Vec<String>) -> Self {
        Self { http: HttpClient::new(allowed_hosts), pending_cache: HashMap::new(), resolve_cache: HashMap::new() }
    }
    pub async fn search(&mut self, _provider: &str, _query: &str, _limit: Option<i64>) -> Result<Vec<Track>, MusicError> { Ok(vec![]) }
    pub async fn resolve(&mut self, _provider: &str, _track: &Track) -> Result<String, MusicError> { Err(MusicError::NoResults) }
    pub fn set_pending(&mut self, key: &str, provider: &str, tracks: Vec<Track>, query: &str, page: i64) {
        self.pending_cache.insert(key.to_string(), Pending { provider_name: provider.to_string(), tracks, query: query.to_string(), page, quality: None });
    }
    pub fn get_pending(&self, key: &str) -> Option<&Pending> { self.pending_cache.get(key) }
    pub fn clear_pending(&mut self, key: &str) { self.pending_cache.remove(key); }
    pub fn pick_key(&self, thread_id: &str, user_id: &str) -> String { format!("{}:{}", thread_id, user_id) }
    pub async fn download_to_file(&self, _stream_url: &str, _extension: &str, _fallback_url: &str, _quality: Option<i64>) -> Result<String, MusicError> { Ok(String::new()) }
}
