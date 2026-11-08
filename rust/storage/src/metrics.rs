use crate::{Store, StoreError, DashMap};
use std::collections::HashMap;
pub fn track(buffer: &DashMap<String,i64>, event: &str, _props: Option<&HashMap<String,String>>) {
    let cur = buffer.get(&event.to_string()).unwrap_or(0);
    buffer.insert(event.to_string(), cur+1);
}
pub async fn flush(store: &Store, buffer: &DashMap<String,i64>) -> Result<(), StoreError> {
    for (k,v) in buffer.clone_inner() { store.set(&format!("metric:{}", k), &v.to_string()).await?; }
    Ok(())
}
