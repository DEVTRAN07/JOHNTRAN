use crate::styled::{offset_of_lines, utf16_len, ZaloStyleSpan, ZaloStyledMessage, STYLE_BOLD, STYLE_ORANGE};
use serde::{Deserialize, Serialize};

const WIDTH: usize = 30;

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq)]
pub struct Track {
    pub title: String,
    pub artist: String,
    pub duration: Option<i64>,
}

fn pad(text: &str, width: usize) -> String {
    let char_len = text.chars().count();
    let fill = width.saturating_sub(char_len).max(2);
    format!("{}{}", text, " ".repeat(fill))
}

fn rule(len: usize) -> String {
    "━".repeat(len)
}

pub fn format_duration(seconds: Option<i64>) -> String {
    match seconds {
        Some(s) if s >= 0 => {
            let m = s / 60;
            let r = s % 60;
            format!("{}:{:02}", m, r)
        }
        _ => "—".to_string(),
    }
}

// ── Danh sách kết quả tìm kiếm
pub fn search_list(
    provider_label: &str,
    query: &str,
    tracks: &[Track],
    page: i64,
    total_pages: i64,
) -> ZaloStyledMessage {
    let mut lines: Vec<String> = Vec::new();
    lines.push(format!("♪ {}", pad(&format!("NHẠC · {}", provider_label), WIDTH)));
    lines.push(rule(WIDTH + 8));
    lines.push(format!(
        "🔍 \"{}\" — {} bài · trang {}/{}",
        query,
        tracks.len(),
        page,
        total_pages
    ));
    lines.push(String::new());

    let mut styles: Vec<ZaloStyleSpan> = Vec::new();
    styles.push(ZaloStyleSpan {
        start: 0,
        len: utf16_len(&lines[0]),
        st: STYLE_BOLD,
    });
    // Orange search description line (index 2)
    styles.push(ZaloStyleSpan {
        start: offset_of_lines(&lines, 2),
        len: utf16_len(&lines[2]),
        st: STYLE_ORANGE,
    });

    for (i, track) in tracks.iter().enumerate() {
        let num = format!("{:2}", i + 1);
        let dur = format_duration(track.duration);
        let line = format!(
            "{}. ♪ {} — {}  [{}]",
            num, track.title, track.artist, dur
        );
        let start = offset_of_lines(&lines, lines.len());
        // bold: number + ". ♪ " + title
        let prefix = format!("{}. ♪ {}", num, track.title);
        styles.push(ZaloStyleSpan {
            start,
            len: utf16_len(&prefix),
            st: STYLE_BOLD,
        });
        lines.push(line);
    }

    lines.push(String::new());
    lines.push(format!(
        "▸ Gõ SỐ (1-{}) để nghe · next/prev đổi trang · out đóng",
        tracks.len()
    ));

    ZaloStyledMessage {
        msg: lines.join("
"),
        styles,
    }
}

// ── Hướng dẫn dùng
pub fn usage_list(provider: &str, label: &str) -> ZaloStyledMessage {
    usage_list_with_prefix(provider, label, "/")
}

pub fn usage_list_with_prefix(provider: &str, label: &str, prefix: &str) -> ZaloStyledMessage {
    let lines: Vec<String> = vec![
        format!("♪ {}", pad(&format!("NHẠC · {}", label), WIDTH)),
        rule(WIDTH + 8),
        "Cách dùng:".to_string(),
        format!("{0}{1} <từ khóa>  → tìm bài", prefix, provider),
        format!("{0}{1} <số>       → nghe bài đã tìm", prefix, provider),
        "gõ trần số (1-8)         → nghe nhanh, không cần lệnh".to_string(),
        format!("{0}{1} next/prev  → đổi trang", prefix, provider),
        format!("{0}{1} out        → đóng danh sách", prefix, provider),
    ];
    let mut styles: Vec<ZaloStyleSpan> = Vec::new();
    styles.push(ZaloStyleSpan {
        start: 0,
        len: utf16_len(&lines[0]),
        st: STYLE_BOLD,
    });
    for i in 3..lines.len() {
        if let Some(space) = lines[i].find(' ') {
            if space > 0 {
                let pre = &lines[i][..space];
                styles.push(ZaloStyleSpan {
                    start: offset_of_lines(&lines, i),
                    len: utf16_len(pre),
                    st: STYLE_BOLD,
                });
            }
        }
    }
    ZaloStyledMessage {
        msg: lines.join("
"),
        styles,
    }
}

// ── NOW PLAYING
pub fn now_playing(track: &Track, source_label: &str) -> ZaloStyledMessage {
    let dur = format_duration(track.duration);
    let artist = if track.artist.is_empty() {
        "—"
    } else {
        &*track.artist
    };
    let lines: Vec<String> = vec![
        format!("♪ {}", pad(&format!("ĐANG PHÁT · {}", source_label), WIDTH)),
        rule(WIDTH + 8),
        format!("Bài hát: {}", track.title),
        format!("Nghệ sĩ: {}", artist),
        format!("Thời lượng: {}", dur),
    ];
    let mut styles: Vec<ZaloStyleSpan> = Vec::new();
    styles.push(ZaloStyleSpan {
        start: 0,
        len: utf16_len(&lines[0]),
        st: STYLE_BOLD,
    });
    for i in 2..lines.len() {
        if let Some(colon) = lines[i].find(':') {
            let label_part = &lines[i][..=colon];
            styles.push(ZaloStyleSpan {
                start: offset_of_lines(&lines, i),
                len: utf16_len(label_part),
                st: STYLE_BOLD,
            });
        }
    }
    ZaloStyledMessage {
        msg: lines.join("
"),
        styles,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::styled::STYLE_BOLD;

    #[test]
    fn search_list_basic() {
        let tracks = vec![Track {
            title: "A".into(),
            artist: "B".into(),
            duration: Some(125),
        }];
        let m = search_list("YT", "q", &tracks, 1, 1);
        assert!(m.msg.contains("NHẠC"));
        assert!(m.styles.iter().any(|s| s.st == STYLE_BOLD));
    }

    #[test]
    fn now_playing_bolds_labels() {
        let t = Track {
            title: "T".into(),
            artist: "A".into(),
            duration: Some(60),
        };
        let m = now_playing(&t, "Y");
        assert!(m.msg.contains("Bài hát:"));
        assert!(m.styles.len() >= 4);
    }
}
