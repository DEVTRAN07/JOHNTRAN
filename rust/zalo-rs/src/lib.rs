use zalo_rs::client::ZaloClient;
use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoginResult {
    pub cookie: String,
    pub uid: String,
    pub api: String,
}

pub struct ZaloBot {
    client: ZaloClient,
    pub uid: String,
}

impl ZaloBot {
    pub async fn login_cookie(path: &Path) -> Result<Self, String> {
        let raw = std::fs::read_to_string(path).map_err(|e| e.to_string())?;
        let parsed: serde_json::Value = serde_json::from_str(&raw).map_err(|e| e.to_string())?;
        let cookie = parsed.get("cookie").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let uid = parsed.get("uid").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let api = parsed.get("api").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let client = ZaloClient::new(&cookie, &uid, &api).map_err(|e| e.to_string())?;
        Ok(Self { client, uid })
    }

    pub async fn login_qr() -> Result<(String, String), String> {
        let (qr, cookie) = ZaloClient::login_qr().await.map_err(|e| e.to_string())?;
        Ok((qr, cookie))
    }

    pub async fn listen(&self) -> Result<(), String> {
        self.client.listen().await.map_err(|e| e.to_string())
    }

    pub async fn send_message(&self, thread_id: &str, msg: &str) -> Result<(), String> {
        self.client.send_message(thread_id, msg).await.map_err(|e| e.to_string())
    }

    pub async fn send_attachment(&self, thread_id: &str, file: &str) -> Result<(), String> {
        self.client.send_attachment(thread_id, file).await.map_err(|e| e.to_string())
    }

    pub async fn get_group_info(&self, thread_id: &str) -> Result<serde_json::Value, String> {
        self.client.get_group_info(thread_id).await.map_err(|e| e.to_string())
    }

    pub async fn get_user_info(&self, uid: &str) -> Result<serde_json::Value, String> {
        self.client.get_user_info(uid).await.map_err(|e| e.to_string())
    }

    pub async fn find_user(&self, phone: &str) -> Result<serde_json::Value, String> {
        self.client.find_user(phone).await.map_err(|e| e.to_string())
    }
}
