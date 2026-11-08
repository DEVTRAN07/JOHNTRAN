use std::collections::HashMap;
use std::sync::Mutex;
use serde::{Deserialize, Serialize};
use thiserror::Error;

pub struct DashMap<K, V>(Mutex<HashMap<K, V>>);
impl<K, V> DashMap<K, V> where K: std::cmp::Eq + std::hash::Hash + Clone, V: Clone {
    pub fn new() -> Self { Self(Mutex::new(HashMap::new())) }
    pub fn insert(&self, k: K, v: V) { self.0.lock().unwrap().insert(k, v); }
    pub fn get(&self, k: &K) -> Option<V> { self.0.lock().unwrap().get(k).cloned() }
    pub fn remove(&self, k: &K) { self.0.lock().unwrap().remove(k); }
    pub fn clone_inner(&self) -> HashMap<K, V> { self.0.lock().unwrap().clone() }
}
impl<K,V> Default for DashMap<K,V> where K: std::cmp::Eq + std::hash::Hash + Clone, V: Clone {
    fn default() -> Self { Self::new() }
}

#[derive(Error, Debug)]
pub enum StoreError { #[error("io: {0}")] Io(#[from] std::io::Error), #[error("json: {0}")] Json(#[from] serde_json::Error), #[error("other: {0}")] Other(String) }

pub enum StoreBackend { Json(String), Supabase { url: String, key: String, mirror: DashMap<String, String> } }

pub struct Store { pub backend: StoreBackend }

impl Store {
    pub fn new_json(path: &str) -> Self { Self { backend: StoreBackend::Json(path.to_string()) } }
    pub fn new_supabase(url: &str, key: &str) -> Self { Self { backend: StoreBackend::Supabase { url: url.to_string(), key: key.to_string(), mirror: DashMap::new() } } }
    pub async fn get(&self, key: &str) -> Result<Option<String>, StoreError> {
        match &self.backend { StoreBackend::Json(p) => crate::json::get(p, key).await, StoreBackend::Supabase { mirror, .. } => Ok(mirror.get(&key.to_string())) }
    }
    pub async fn set(&self, key: &str, value: &str) -> Result<(), StoreError> {
        match &self.backend { StoreBackend::Json(p) => crate::json::set(p, key, value).await, StoreBackend::Supabase { mirror, .. } => { mirror.insert(key.to_string(), value.to_string()); Ok(()) } }
    }
    pub async fn delete(&self, key: &str) -> Result<(), StoreError> {
        match &self.backend { StoreBackend::Json(p) => crate::json::delete(p, key).await, StoreBackend::Supabase { mirror, .. } => { mirror.remove(&key.to_string()); Ok(()) } }
    }
    pub async fn all(&self) -> Result<HashMap<String, String>, StoreError> {
        match &self.backend { StoreBackend::Json(p) => crate::json::all(p).await, StoreBackend::Supabase { mirror, .. } => Ok(mirror.clone_inner()) }
    }
}

#[derive(Serialize, Deserialize, Default, Clone)]
pub struct ThreadData {
    pub prefix: Option<String>,
    pub disabled_commands: Option<Vec<String>>,
    pub admin_only: Option<bool>,
    pub support_only: Option<bool>,
    pub box_only: Option<bool>,
    pub menu_page: Option<i64>,
    pub welcome: Option<bool>,
    pub anti_spam: Option<bool>,
}

pub struct ThreadStore { pub store: Store }
impl ThreadStore {
    pub async fn get_data(&self, thread_id: &str) -> Result<ThreadData, StoreError> { crate::threads::get_data(&self.store, thread_id).await }
    pub async fn set_data(&self, thread_id: &str, data: &ThreadData) -> Result<(), StoreError> { crate::threads::set_data(&self.store, thread_id, data).await }
}
pub struct UserStore { pub store: Store }
impl UserStore {
    pub async fn is_admin(&self, uid: &str) -> bool { crate::users::is_admin(&self.store, uid).await }
    pub async fn is_support(&self, uid: &str) -> bool { crate::users::is_support(&self.store, uid).await }
}
pub struct Metrics { pub store: Store, pub buffer: DashMap<String, i64> }
impl Metrics {
    pub fn track(&self, event: &str, props: Option<&HashMap<String, String>>) { crate::metrics::track(&self.buffer, event, props); }
    pub async fn flush(&self) -> Result<(), StoreError> { crate::metrics::flush(&self.store, &self.buffer).await }
}

pub mod json;
pub mod supabase;
pub mod threads;
pub mod users;
pub mod metrics;
pub mod cache;
