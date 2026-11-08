use crate::{Store, StoreError};
pub async fn is_admin(store: &Store, uid: &str) -> bool {
    store.get(&format!("admin:{}", uid)).await.ok().flatten().map(|v| v=="1").unwrap_or(false)
}
pub async fn is_support(store: &Store, uid: &str) -> bool {
    store.get(&format!("support:{}", uid)).await.ok().flatten().map(|v| v=="1").unwrap_or(false)
}
