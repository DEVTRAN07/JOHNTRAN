use std::collections::HashMap;
use std::fs;
use crate::StoreError;

fn read_file(path: &str) -> HashMap<String,String> {
    fs::read_to_string(path).ok().and_then(|s| serde_json::from_str(&s).ok()).unwrap_or_default()
}
fn write_file(path: &str, data: &HashMap<String,String>) -> Result<(), StoreError> {
    let s = serde_json::to_string_pretty(data).map_err(StoreError::Json)?;
    fs::write(path, s)?;
    Ok(())
}
pub async fn get(path: &str, key: &str) -> Result<Option<String>, StoreError> { Ok(read_file(path).get(key).cloned()) }
pub async fn set(path: &str, key: &str, value: &str) -> Result<(), StoreError> { let mut d=read_file(path); d.insert(key.to_string(),value.to_string()); write_file(path,&d) }
pub async fn delete(path: &str, key: &str) -> Result<(), StoreError> { let mut d=read_file(path); d.remove(key); write_file(path,&d) }
pub async fn all(path: &str) -> Result<HashMap<String,String>, StoreError> { Ok(read_file(path)) }
