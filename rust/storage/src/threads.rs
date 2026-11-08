use crate::{Store, ThreadData, StoreError};
use std::collections::HashMap;
pub async fn get_data(store: &Store, thread_id: &str) -> Result<ThreadData, StoreError> {
    match store.get(thread_id).await? {
        Some(v) => serde_json::from_str(&v).map_err(StoreError::Json),
        None => Ok(ThreadData::default()),
    }
}
pub async fn set_data(store: &Store, thread_id: &str, data: &ThreadData) -> Result<(), StoreError> {
    let v = serde_json::to_string(data).map_err(StoreError::Json)?;
    store.set(thread_id, &v).await
}
pub async fn get_all_thread_data(store: &Store) -> Result<HashMap<String, ThreadData>, StoreError> {
    let all = store.all().await?;
    let mut out = HashMap::new();
    for (k,v) in all { if let Ok(d) = serde_json::from_str(&v) { out.insert(k,d); } }
    Ok(out)
}
