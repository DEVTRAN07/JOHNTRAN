use crate::theme::*;
use serde_json::Value;

fn get_str(v: &Value, k: &str) -> String {
    v.get(k).and_then(|x| x.as_str()).unwrap_or("").to_string()
}
fn get_i64(v: &Value, k: &str) -> i64 {
    v.get(k).and_then(|x| x.as_i64().or_else(|| x.as_f64().map(|f| f as i64))).unwrap_or(0)
}
fn get_arr<'a>(v: &'a Value, k: &str) -> Vec<&'a Value> {
    v.get(k).and_then(|x| x.as_array()).map(|a| a.iter().collect()).unwrap_or_default()
}

pub fn dispatch(spec: &Value) -> Result<Vec<u8>, String> {
    let t = get_str(spec, "type");
    match t.as_str() {
        "search_grid" | "music_search" => render_search_grid(spec),
        "now_playing" | "music_now" => render_now_playing(spec),
        "menu" | "menu_grid" => render_menu_grid(spec),
        "vip" | "card" | "vip_card" => render_vip_card(spec),
        _ => Err(format!("unknown type: {}", t)),
    }
}

pub fn render_search_grid(spec: &Value) -> Result<Vec<u8>, String> {
    let fonts = Fonts::load();
    let pal = default_palette();
    let style = default_style();
    let w = WIDTH;
    let query = get_str(spec, "query");
    let source = { let s = get_str(spec, "source"); if s.is_empty() { "SOUNDCLOUD".into() } else { s } };
    let page = get_i64(spec, "page").max(1);
    let total_pages = get_i64(spec, "totalPages").max(1);
    let tracks = get_arr(spec, "tracks");
    let per_page = 9usize; let cols = 3usize;
    let shown: Vec<&Value> = tracks.into_iter().take(per_page).collect();
    let rows = ((shown.len().max(1)) + cols - 1) / cols;
    let gap_x = s(22.0); let gap_y = s(16.0);
    let card_w = (w as f32 - s(50.0) - gap_x * (cols as f32 - 1.0)) / cols as f32;
    let art = s(190.0); let card_h = art + s(98.0);
    let header_h = s(104.0); let footer_h = s(126.0);
    let h = (header_h + rows as f32 * card_h + (rows.saturating_sub(1)) as f32 * gap_y + footer_h) as u32;
    let mut pm = new_pixmap(w, h);
    paint_background(&mut pm, w, h, &pal, &style);

    label(&mut pm, &fonts, &format!("TÌM NHẠC • {}", source), w as f32/2.0, s(34.0), s(13.0), pal.accent, "center");
    draw_text_max(&mut pm, &fonts, "JT-Display-Bold", &query, w as f32/2.0, s(68.0), s(28.0), pal.ink, "center", Some(w as f32 - s(130.0)));
    foil(&mut pm, w as f32/2.0 - s(70.0), s(80.0), s(140.0), &pal, &style);
    draw_text(&mut pm, &fonts, "JT-Mono", &format!("♪ {} bài  •  # {}  •  * nghe nhiều nhất", shown.len(), source), w as f32/2.0, s(96.0), s(15.0), pal.ink2, "center");

    for (index, track) in shown.iter().enumerate() {
        let col = index % cols; let row = index / cols;
        let x = s(25.0) + col as f32 * (card_w + gap_x);
        let y = header_h + row as f32 * (card_h + gap_y);
        panel(&mut pm, x, y, card_w, card_h, s(16.0), pal.accent, &style);
        let art_x = x + (card_w - art)/2.0; let art_y = y + s(10.0);
        fill_round_rect(&mut pm, art_x, art_y, art, art, s(16.0), Rgba(56,189,248,36.0));
        draw_text(&mut pm, &fonts, "JT", "♪", art_x + art/2.0, art_y + art/2.0 + s(22.0), s(54.0), pal.accent, "center");
        fill_round_rect(&mut pm, art_x+s(8.0), art_y+s(8.0), s(34.0), s(26.0), s(8.0), Rgba(7,10,20,209.0));
        draw_text(&mut pm, &fonts, "JT-Bold", &format!("{}", index+1), art_x+s(25.0), art_y+s(26.0), s(16.0), pal.accent, "center");
        let title = get_str(track, "title"); let artist = get_str(track, "artist");
        let title_y = art_y + art + s(26.0);
        draw_text_max(&mut pm, &fonts, "JT-Round-Bold", &title, x+card_w/2.0, title_y, s(16.0), pal.ink, "center", Some(card_w - s(22.0)));
        draw_text_max(&mut pm, &fonts, "JT-Mono", &artist, x+card_w/2.0, title_y+s(20.0), s(12.0), pal.ink2, "center", Some(card_w - s(22.0)));
        let plays = get_i64(track, "plays"); let likes = get_i64(track, "likes");
        let (tag_label, tag_bg, tag_stroke) = if plays >= likes {
            (format!("o {} lượt nghe", short_plays(plays)), Rgba(34,197,94,46.0), pal.green)
        } else { (format!("♥ {} thích", short_plays(likes)), Rgba(239,68,68,46.0), pal.red) };
        let tag_w = (measure_text(&fonts, "JT-Bold", &tag_label, s(12.0)) + s(18.0)).min(card_w - s(16.0));
        let tag_x = x + (card_w - tag_w)/2.0; let tag_y = y + card_h - s(30.0); let tag_h = s(22.0);
        fill_round_rect(&mut pm, tag_x, tag_y - tag_h/2.0 - s(4.0), tag_w, tag_h, s(11.0), tag_bg);
        stroke_round_rect(&mut pm, tag_x, tag_y - tag_h/2.0 - s(4.0), tag_w, tag_h, s(11.0), tag_stroke, s(1.5));
        draw_text_max(&mut pm, &fonts, "JT-Bold", &tag_label, x+card_w/2.0, tag_y+s(2.0), s(12.0), tag_stroke, "center", Some(tag_w - s(8.0)));
    }

    let foot_y = h as f32 - footer_h + s(4.0);
    let btn_w = (w as f32 - s(50.0) - s(20.0)) / 3.0;
    let (c_prev, c_out, c_next) = random_accent();
    draw_text(&mut pm, &fonts, "JT-Bold", &format!("Trang {}/{}", page, total_pages), w as f32/2.0, foot_y+s(24.0), s(20.0), pal.ink, "center");
    let btn_y = foot_y + s(38.0);
    button(&mut pm, &fonts, s(25.0), btn_y, btn_w, s(42.0), "< PREV", c_prev, &style);
    button(&mut pm, &fonts, s(25.0)+btn_w+s(10.0), btn_y, btn_w-s(10.0), s(42.0), "x OUT", c_out, &style);
    button(&mut pm, &fonts, s(25.0)+btn_w*2.0+s(20.0), btn_y, btn_w, s(42.0), "NEXT >", c_next, &style);
    draw_text(&mut pm, &fonts, "JT-Mono", ">> scl <số> để tải bài  •  gõ trần next / prev / out", w as f32/2.0, foot_y+s(92.0), s(14.0), pal.ink2, "center");
    encode_png(&pm)
}

pub fn render_now_playing(spec: &Value) -> Result<Vec<u8>, String> {
    let fonts = Fonts::load();
    let pal = default_palette();
    let style = default_style();
    let w = WIDTH; let cover_size = s(300.0); let h = s(470.0) as u32;
    let mut pm = new_pixmap(w, h);
    paint_background(&mut pm, w, h, &pal, &style);
    let track = spec.get("track").unwrap_or(spec);
    let source = { let s = get_str(spec, "sourceLabel"); if s.is_empty() { get_str(track, "source") } else { s } };
    let title = get_str(track, "title"); let artist = get_str(track, "artist");
    let duration = get_i64(track, "duration"); let plays = get_i64(track, "plays");

    draw_text(&mut pm, &fonts, "JT", "♪", s(24.0), s(56.0), s(34.0), pal.accent, "left");
    draw_text(&mut pm, &fonts, "JT-Display-Bold", "ĐANG PHÁT", w as f32/2.0, s(56.0), s(32.0), pal.ink, "center");
    let cx = (w as f32 - cover_size)/2.0; let cy = s(74.0);
    panel(&mut pm, cx, cy, cover_size, cover_size, s(20.0), pal.accent, &style);
    draw_text(&mut pm, &fonts, "JT", "♪", cx+cover_size/2.0, cy+cover_size/2.0+s(22.0), s(70.0), pal.accent, "center");
    draw_text_max(&mut pm, &fonts, "JT-Display-Bold", &title, w as f32/2.0, cy+cover_size+s(52.0), s(26.0), pal.ink, "center", Some(w as f32 - s(60.0)));
    draw_text_max(&mut pm, &fonts, "JT-Mono", &format!("♫ {}  •  ◷ {}", artist, format_duration(duration)), w as f32/2.0, cy+cover_size+s(84.0), s(18.0), pal.ink2, "center", Some(w as f32 - s(60.0)));
    let plays_txt = if plays>0 { format!("  •  o {} lượt nghe", short_plays(plays)) } else { String::new() };
    draw_text_max(&mut pm, &fonts, "JT-Bold", &format!("# {}{}", source, plays_txt), w as f32/2.0, cy+cover_size+s(114.0), s(16.0), pal.accent, "center", Some(w as f32 - s(60.0)));
    draw_text(&mut pm, &fonts, "JT", "> Đang tải file nhạc, vui lòng chờ...", w as f32/2.0, h as f32 - s(34.0), s(15.0), pal.ink2, "center");
    encode_png(&pm)
}

pub fn render_menu_grid(spec: &Value) -> Result<Vec<u8>, String> {
    let fonts = Fonts::load();
    let pal = default_palette();
    let style = default_style();
    let w = WIDTH;
    let cols = 3usize; let margin_x = s(25.0); let gap_x = s(10.0); let gap_y = s(10.0);
    let header_h = s(66.0); let card_h = s(82.0); let footer_h = s(82.0);
    let commands = get_arr(spec, "commands");
    let rows = ((commands.len().max(1)) + cols - 1) / cols;
    let card_w = (w as f32 - margin_x*2.0 - gap_x*(cols as f32 - 1.0)) / cols as f32;
    let h = (header_h + rows as f32 * card_h + (rows.saturating_sub(1)) as f32 * gap_y + footer_h) as u32;
    let mut pm = new_pixmap(w, h);
    paint_background(&mut pm, w, h, &pal, &style);
    let prefix = { let p = get_str(spec, "prefix"); if p.is_empty() { "!".into() } else { p } };
    let page = get_i64(spec, "page").max(1); let total_pages = get_i64(spec, "totalPages").max(1);
    let total_cmds = get_i64(spec, "totalCommands");
    let bot_ver = get_str(spec, "botVersion");
    let req_name = { let n = get_str(spec, "requesterName"); if n.is_empty() { "Người dùng".into() } else { n } };

    draw_text(&mut pm, &fonts, "JT-Round-Bold", "Tất cả lệnh", margin_x, s(42.0), s(29.0), Rgba(255,250,245,255.0), "left");
    draw_text(&mut pm, &fonts, "JT-Bold", &format!("Trang {}/{}", page, total_pages), w as f32 - margin_x, s(42.0), s(19.0), Rgba(216,220,230,255.0), "right");

    let icons = ["*","♪","◆","●","▣","#","★","◈","+","▲","♧","◉"];
    let cat_colors = [Rgba(139,114,232,255.0),Rgba(75,143,245,255.0),Rgba(230,129,184,255.0),Rgba(238,189,67,255.0),Rgba(88,169,200,255.0),Rgba(165,104,213,255.0)];
    for (i, cmd) in commands.iter().enumerate() {
        let col = i % cols; let row = i / cols;
        let x = margin_x + col as f32 * (card_w + gap_x);
        let y = header_h + row as f32 * (card_h + gap_y);
        let name = get_str(cmd, "name"); let usage = { let u = get_str(cmd,"usage"); if u.is_empty() { name.clone() } else { u } };
        let cat = get_str(cmd, "category");
        let accent = cat_colors[(i + cat.len()) % cat_colors.len()];
        fill_round_rect(&mut pm, x, y, card_w, card_h, s(12.0), Rgba(42,48,62,245.0));
        stroke_round_rect(&mut pm, x, y, card_w, card_h, s(12.0), Rgba(255,255,255,230.0), s(1.0).max(1.0));
        fill_round_rect(&mut pm, x+s(12.0), y+s(20.0), s(42.0), s(42.0), s(12.0), accent);
        draw_text(&mut pm, &fonts, "JT-Bold", icons[i % icons.len()], x+s(33.0), y+s(47.0), s(22.0), Rgba(255,255,255,255.0), "center");
        draw_text_max(&mut pm, &fonts, "JT-Round-Bold", &name, x+s(62.0), y+s(34.0), s(17.0), Rgba(255,255,255,255.0), "left", Some(card_w - s(78.0)));
        draw_text_max(&mut pm, &fonts, "JT", &format!("{}{}", prefix, usage), x+s(62.0), y+s(54.0), s(11.0), Rgba(197,202,218,255.0), "left", Some(card_w - s(78.0)));
        draw_text_max(&mut pm, &fonts, "JT-Bold", &cat.to_uppercase(), x+s(62.0), y+s(71.0), s(9.0), accent, "left", Some(card_w - s(78.0)));
        draw_text(&mut pm, &fonts, "JT", ">", x+card_w-s(15.0), y+s(51.0), s(20.0), Rgba(174,183,201,255.0), "center");
    }
    let foot_y = h as f32 - footer_h + s(4.0);
    fill_round_rect(&mut pm, margin_x, foot_y, w as f32 - margin_x*2.0, s(58.0), s(14.0), Rgba(19,21,28,245.0));
    stroke_round_rect(&mut pm, margin_x, foot_y, w as f32 - margin_x*2.0, s(58.0), s(14.0), Rgba(255,255,255,224.0), s(1.0).max(1.0));
    let ax = margin_x + s(12.0); let ay = foot_y + (s(58.0)-s(42.0))/2.0;
    fill_round_rect(&mut pm, ax, ay, s(42.0), s(42.0), s(21.0), Rgba(98,106,121,255.0));
    draw_text_max(&mut pm, &fonts, "JT-Round-Bold", &req_name, ax+s(52.0), foot_y+s(35.0), s(17.0), Rgba(255,255,255,255.0), "left", Some((w as f32 - margin_x*2.0)*0.47));
    draw_text(&mut pm, &fonts, "JT", &format!("{} lệnh", total_cmds), ax+s(52.0), foot_y+s(51.0), s(11.0), Rgba(197,202,218,255.0), "left");
    draw_text(&mut pm, &fonts, "JT-Bold", &format!("v{}", bot_ver), w as f32 - margin_x - s(12.0), foot_y+s(26.0), s(13.0), Rgba(216,220,230,255.0), "right");
    draw_text(&mut pm, &fonts, "JT", &format!("Trang {}/{}", page, total_pages), w as f32 - margin_x - s(12.0), foot_y+s(46.0), s(11.0), Rgba(174,183,201,255.0), "right");
    draw_text(&mut pm, &fonts, "JT", "Gõ next / prev để chuyển trang  -  out để đóng", w as f32/2.0, h as f32 - s(7.0), s(10.0), Rgba(197,189,186,255.0), "center");
    encode_png(&pm)
}

pub fn render_vip_card(spec: &Value) -> Result<Vec<u8>, String> {
    let fonts = Fonts::load();
    let pal = default_palette();
    let style = default_style();
    let w = WIDTH; let padding = s(30.0);
    let title = get_str(spec, "title");
    let subtitle = get_str(spec, "subtitle");
    let icon = { let i = get_str(spec, "icon"); if i.is_empty() { "⚡".into() } else { i } };
    let footer = { let f = get_str(spec, "footer"); if f.is_empty() { "JOHN TRAN".into() } else { f } };
    let rows = get_arr(spec, "rows");
    let theme_name = get_str(spec, "theme");

    // measure height
    let mut h_est = s(120.0) + if subtitle.is_empty() { 0.0 } else { s(52.0) } + s(22.0);
    for row in &rows {
        let lines = if let Some(a) = row.get("lines").and_then(|x| x.as_array()) { a.len() } else { 1 };
        h_est += s(34.0) + lines as f32 * s(32.0) + s(18.0);
    }
    let h = (h_est + s(96.0)).max(s(260.0)) as u32;
    let mut pm = new_pixmap(w, h);
    paint_background(&mut pm, w, h, &pal, &style);

    let accent = match theme_name.as_str() {
        "error" => pal.red, "success" => pal.green, "warn" => pal.gold,
        "music" => pal.accent, "ai" => pal.accent2, _ => pal.accent,
    };
    let mut y = s(74.0);
    label(&mut pm, &fonts, "JOHN TRAN", padding, y - s(28.0), s(13.0), accent, "left");
    draw_text(&mut pm, &fonts, "JT", &icon, padding, y, s(34.0), accent, "left");
    draw_text_max(&mut pm, &fonts, "JT-Display-Bold", &title.to_uppercase(), padding+s(52.0), y, s(33.0), pal.ink, "left", Some(w as f32 - padding*2.0 - s(110.0)));
    foil(&mut pm, padding, y+s(14.0), s(90.0), &pal, &style);
    y += s(42.0);
    if !subtitle.is_empty() {
        draw_text_max(&mut pm, &fonts, "JT", &subtitle, padding, y+s(4.0), s(18.0), pal.ink2, "left", Some(w as f32 - padding*2.0));
        y += s(50.0);
    }
    for row in &rows {
        let lines_v: Vec<String> = if let Some(a) = row.get("lines").and_then(|x| x.as_array()) {
            a.iter().map(|v| v.as_str().unwrap_or("").to_string()).collect()
        } else if let Some(sv) = row.get("lines").and_then(|x| x.as_str()) { vec![sv.to_string()] } else { vec![] };
        let tone_err = get_str(row, "tone") == "error";
        let row_accent = if tone_err { pal.red } else { accent };
        let row_h = s(32.0) + lines_v.len() as f32 * s(26.0);
        panel(&mut pm, padding, y - s(18.0), w as f32 - padding*2.0, row_h, s(12.0), row_accent, &style);
        y += s(2.0);
        let rlabel = get_str(row, "label");
        if !rlabel.is_empty() { draw_text_max(&mut pm, &fonts, "JT", &rlabel, w as f32 - padding - s(170.0), y, s(14.0), pal.mute, "left", Some(s(150.0))); }
        let ricon = get_str(row, "icon");
        if !ricon.is_empty() { draw_text(&mut pm, &fonts, "JT", &ricon, padding+s(16.0), y+s(4.0), s(20.0), if tone_err { pal.red } else { pal.accent2 }, "left"); }
        let strong = row.get("strong").and_then(|x| x.as_bool()).unwrap_or(false);
        let mut ly = y;
        for line in &lines_v {
            ly += s(26.0);
            let fam = if strong { "JT-Bold" } else { "JT" };
            let col = if strong { pal.ink } else { pal.ink2 };
            draw_text_max(&mut pm, &fonts, fam, line, padding+s(44.0), ly, if strong { s(17.0) } else { s(16.0) }, col, "left", Some(w as f32 - padding*2.0 - s(62.0)));
        }
        y = ly + s(26.0);
    }
    draw_text(&mut pm, &fonts, "JT-Bold", &footer, w as f32/2.0, h as f32 - s(30.0), s(15.0), pal.mute, "center");
    encode_png(&pm)
}
