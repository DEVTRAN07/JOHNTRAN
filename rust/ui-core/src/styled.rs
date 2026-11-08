use serde::{Deserialize, Serialize};

/// Zalo text style codes (from zalo-client TextStyle).
/// Colors and Bold/Big/Small are mutually exclusive per style segment in usage,
/// but we store them and emit as the Zalo API expects.
pub const STYLE_RED: u8 = 1;      // TextStyle.Red
pub const STYLE_ORANGE: u8 = 2;   // TextStyle.Orange
pub const STYLE_YELLOW: u8 = 3;   // TextStyle.Yellow
pub const STYLE_GREEN: u8 = 4;    // TextStyle.Green
pub const STYLE_BOLD: u8 = 5;     // TextStyle.Bold (convention; actual mapping depends on client)

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct TextPart {
    pub text: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bold: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub size: Option<u8>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub style: Option<u8>,
}

/// Zalo styled-text output format: {"msg": "...", "styles": [{"start":N,"len":N,"st":N}, ...]}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ZaloStyledMessage {
    pub msg: String,
    pub styles: Vec<ZaloStyleSpan>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ZaloStyleSpan {
    pub start: usize,
    pub len: usize,
    pub st: u8,
}

#[derive(Debug, Clone, Default)]
pub struct StyledText {
    pub parts: Vec<TextPart>,
}

impl StyledText {
    pub fn new() -> Self {
        Self { parts: Vec::new() }
    }

    pub fn add(&mut self, text: &str, bold: bool, color: Option<&str>, size: Option<u8>) -> &mut Self {
        let (style, bold_flag, color_val) = resolve_style(bold, color);
        self.parts.push(TextPart {
            text: text.to_string(),
            bold: bold_flag,
            color: color_val,
            size,
            style,
        });
        self
    }

    pub fn bold(&mut self, text: &str) -> &mut Self {
        self.parts.push(TextPart {
            text: text.to_string(),
            bold: Some(true),
            color: None,
            size: None,
            style: Some(STYLE_BOLD),
        });
        self
    }

    pub fn normal(&mut self, text: &str) -> &mut Self {
        self.parts.push(TextPart {
            text: text.to_string(),
            bold: None,
            color: None,
            size: None,
            style: None,
        });
        self
    }

    pub fn error(&mut self, text: &str) -> &mut Self {
        self.parts.push(TextPart {
            text: text.to_string(),
            bold: None,
            color: Some("#ff0000".to_string()),
            size: None,
            style: Some(STYLE_RED),
        });
        self
    }

    pub fn success(&mut self, text: &str) -> &mut Self {
        self.parts.push(TextPart {
            text: text.to_string(),
            bold: None,
            color: Some("#00aa00".to_string()),
            size: None,
            style: Some(STYLE_GREEN),
        });
        self
    }

    pub fn warn(&mut self, text: &str) -> &mut Self {
        self.parts.push(TextPart {
            text: text.to_string(),
            bold: None,
            color: Some("#ccaa00".to_string()),
            size: None,
            style: Some(STYLE_YELLOW),
        });
        self
    }

    pub fn info(&mut self, text: &str) -> &mut Self {
        self.parts.push(TextPart {
            text: text.to_string(),
            bold: None,
            color: Some("#ff8800".to_string()),
            size: None,
            style: Some(STYLE_ORANGE),
        });
        self
    }

    /// Build Zalo styled-text JSON: {"msg": "...", "styles": [{"start":N,"len":N,"st":N}]}
    /// Offsets are UTF-16 code units to match Node/JS behavior in the reference implementation.
    pub fn to_zalo_message(&self) -> ZaloStyledMessage {
        let mut msg = String::new();
        let mut styles: Vec<ZaloStyleSpan> = Vec::new();
        let mut offset: usize = 0; // UTF-16 units

        for part in &self.parts {
            let len = utf16_len(&part.text);
            if let Some(st) = part.style {
                if len > 0 {
                    styles.push(ZaloStyleSpan { start: offset, len, st });
                }
            }
            msg.push_str(&part.text);
            offset += len;
        }

        ZaloStyledMessage { msg, styles }
    }

    /// Zalo styled-text JSON string.
    pub fn to_json(&self) -> String {
        serde_json::to_string(&self.to_zalo_message()).unwrap_or_else(|_| "{\"msg\":\"\",\"styles\":[]}".to_string())
    }

    /// Plain text fallback (all parts concatenated).
    pub fn to_plain_string(&self) -> String {
        self.parts.iter().map(|p| p.text.as_str()).collect()
    }
}

impl std::fmt::Display for StyledText {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.to_plain_string())
    }
}

pub fn utf16_len(s: &str) -> usize {
    s.encode_utf16().count()
}

/// Compute UTF-16 offset of a joined line array up to (but not including) index ,
/// assuming lines joined by '\n' — matches Node's offsetOf in music/ui.js.
pub fn offset_of_lines(lines: &[String], i: usize) -> usize {
    let mut offset = 0usize;
    for (j, line) in lines.iter().enumerate() {
        if j >= i { break; }
        offset += utf16_len(line) + 1; // +1 for '\n'
    }
    offset
}

fn resolve_style(bold: bool, color: Option<&str>) -> (Option<u8>, Option<bool>, Option<String>) {
    // Match Node/Zalo behavior: in practice color and bold are sent as separate style
    // concepts, but Zalo's simple style API uses a single  per span. Prefer color
    // style when both are requested (matches how themes are applied), but keep bold flag.
    let st = if let Some(c) = color {
        color_to_style(c)
    } else if bold {
        Some(STYLE_BOLD)
    } else {
        None
    };
    (st, if bold { Some(true) } else { None }, color.map(|s| s.to_string()))
}

pub fn color_to_style(color: &str) -> Option<u8> {
    match color.to_ascii_lowercase().as_str() {
        "#ff0000" | "red" => Some(STYLE_RED),
        "#ff8800" | "#ffa500" | "orange" => Some(STYLE_ORANGE),
        "#ccaa00" | "#ffff00" | "yellow" => Some(STYLE_YELLOW),
        "#00aa00" | "#00ff00" | "green" => Some(STYLE_GREEN),
        _ => None,
    }
}

/// Frame a body into a themed styled message, porting core/styled.js behavior.
/// kind: "error" | "success" | "info" | "warn"
pub fn frame(body: &[String], kind: &str) -> ZaloStyledMessage {
    let (icon, label, color_st) = theme(kind);
    let width: usize = 26;

    let header = format!("{} {}", icon, pad_label(label, width));
    let sep = "─".repeat(utf16_len(&header) + 4);
    let footer = "▔".repeat(utf16_len(&header) + 4);

    let mut msg_lines: Vec<String> = Vec::with_capacity(body.len() + 3);
    msg_lines.push(header.clone());
    msg_lines.push(sep.clone());
    msg_lines.extend(body.iter().cloned());
    msg_lines.push(footer.clone());

    let msg = msg_lines.join("\n");
    let mut styles: Vec<ZaloStyleSpan> = Vec::new();

    // Title = theme color
    styles.push(ZaloStyleSpan { start: 0, len: utf16_len(&header), st: color_st });

    // First body line bold if short (<= 80 chars by UTF-16 count approximation via char count/len used in JS length)
    let first_line_bold = if !body.is_empty() {
        let l = body[0].chars().count();
        l > 0 && l <= 80
    } else {
        false
    };
    if first_line_bold {
        let start = utf16_len(&msg_lines[0]) + 1 + utf16_len(&msg_lines[1]) + 1;
        styles.push(ZaloStyleSpan { start, len: utf16_len(&body[0]), st: STYLE_BOLD });
    }

    // "Label: value" lines -> bold label up to first ':'
    let mut offset = utf16_len(&msg_lines[0]) + 1 + utf16_len(&msg_lines[1]) + 1;
    for (i, line) in body.iter().enumerate() {
        if let Some(colon) = line.find(':') {
            let colon_chars = line[..colon].chars().count();
            if colon_chars > 0 && colon_chars <= 30 && !(i == 0 && first_line_bold) {
                // len in UTF-16 units up to and including ':'
                let label_part = &line[..=colon];
                styles.push(ZaloStyleSpan { start: offset, len: utf16_len(label_part), st: STYLE_BOLD });
            }
        }
        offset += utf16_len(line) + 1;
    }

    ZaloStyledMessage { msg, styles }
}

/// Plain styled message: no frame, just bold Label: prefixes.
pub fn plain(body: &[String]) -> ZaloStyledMessage {
    let msg = body.join("\n");
    let mut styles: Vec<ZaloStyleSpan> = Vec::new();
    let mut offset: usize = 0;
    for line in body {
        if let Some(colon) = line.find(':') {
            let colon_chars = line[..colon].chars().count();
            if colon_chars > 0 && colon_chars <= 30 {
                let label_part = &line[..=colon];
                styles.push(ZaloStyleSpan { start: offset, len: utf16_len(label_part), st: STYLE_BOLD });
            }
        }
        offset += utf16_len(line) + 1;
    }
    ZaloStyledMessage { msg, styles }
}

fn theme(kind: &str) -> (&'static str, &'static str, u8) {
    match kind {
        "error" => ("❌", "LỖI", STYLE_RED),
        "success" => ("✅", "HOÀN THÀNH", STYLE_GREEN),
        "warn" => ("▲", "CẢNH BÁO", STYLE_YELLOW),
        _ => ("◆", "THÔNG TIN", STYLE_ORANGE),
    }
}

fn pad_label(label: &str, width: usize) -> String {
    let plain_len = label.chars().count();
    let fill = width.saturating_sub(plain_len).max(2);
    format!("{}{}", label, " ".repeat(fill))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn styled_builder_json() {
        let mut s = StyledText::new();
        s.bold("Hello").normal(" world");
        let m = s.to_zalo_message();
        assert_eq!(m.msg, "Hello world");
        assert_eq!(m.styles.len(), 1);
        assert_eq!(m.styles[0].st, STYLE_BOLD);
        assert_eq!(m.styles[0].start, 0);
        assert_eq!(m.styles[0].len, 5);
    }

    #[test]
    fn frame_has_theme_color() {
        let m = frame(&["Title".into(), "Key: value".into()], "error");
        assert!(m.msg.contains("LỖI"));
        assert!(m.styles.iter().any(|s| s.st == STYLE_RED));
        assert!(m.styles.iter().any(|s| s.st == STYLE_BOLD));
    }

    #[test]
    fn plain_bolds_labels() {
        let m = plain(&["Name: Alice".into(), "no label".into()]);
        assert_eq!(m.styles.len(), 1);
        assert_eq!(m.styles[0].start, 0);
    }

    #[test]
    fn utf16_offset_emoji() {
        // ❌ is BMP (1 UTF-16 unit), as noted in reference; verify counting
        assert_eq!(utf16_len("❌"), 1);
        assert_eq!(utf16_len("A"), 1);
    }
}
