use crate::styled::{frame, plain, ZaloStyledMessage};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SendOptions {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ttl: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub plain_text: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
}

#[derive(Debug, Clone, Default)]
pub struct ReplyBuilder;

impl ReplyBuilder {
    pub fn new() -> Self {
        Self
    }

    /// Default: styled plain text (bold labels) — like Reply.text without {plain:true}.
    pub fn text(&self, msg: &str, options: &SendOptions) -> ZaloStyledMessage {
        if options.plain_text.unwrap_or(false) {
            return ZaloStyledMessage {
                msg: msg.to_string(),
                styles: vec![],
            };
        }
        let lines: Vec<String> = msg.split('\n').map(|s| s.to_string()).collect();
        plain(&lines)
    }

    pub fn error(&self, msg: &str, _options: &SendOptions) -> ZaloStyledMessage {
        let lines: Vec<String> = msg.split('\n').map(|s| s.to_string()).collect();
        frame(&lines, "error")
    }

    pub fn success(&self, msg: &str, _options: &SendOptions) -> ZaloStyledMessage {
        let lines: Vec<String> = msg.split('\n').map(|s| s.to_string()).collect();
        frame(&lines, "success")
    }

    pub fn info(&self, msg: &str, _options: &SendOptions) -> ZaloStyledMessage {
        let lines: Vec<String> = msg.split('\n').map(|s| s.to_string()).collect();
        frame(&lines, "info")
    }

    pub fn warn(&self, msg: &str, _options: &SendOptions) -> ZaloStyledMessage {
        let lines: Vec<String> = msg.split('\n').map(|s| s.to_string()).collect();
        frame(&lines, "warn")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reply_variants() {
        let r = ReplyBuilder::new();
        let opt = SendOptions::default();
        assert!(r.error("x", &opt).msg.contains("LỖI"));
        assert!(r.success("x", &opt).msg.contains("HOÀN THÀNH"));
        assert!(r.info("x", &opt).msg.contains("THÔNG TIN"));
        assert!(r.warn("x", &opt).msg.contains("CẢNH BÁO"));
        let t = r.text("Name: A", &opt);
        assert!(!t.styles.is_empty());
    }
}
