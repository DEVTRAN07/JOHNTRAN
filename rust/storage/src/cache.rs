use std::collections::HashMap;
pub struct LruCache<K,V> { map: HashMap<K,V>, cap: usize }
impl<K,V> LruCache<K,V> where K: std::cmp::Eq + std::hash::Hash + Clone { pub fn new(cap: usize) -> Self { Self { map: HashMap::new(), cap } } }
