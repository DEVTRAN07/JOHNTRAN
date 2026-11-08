use fontdue::{Font, FontSettings};
use rand::seq::SliceRandom;
use std::fs;
use std::path::{Path, PathBuf};
use tiny_skia::{Color, FillRule, LinearGradient, Paint, PathBuilder, Pixmap, Point, RadialGradient, Rect, SpreadMode, Stroke, Transform, GradientStop, PremultipliedColorU8};

pub const WIDTH: u32 = 1280;
pub const DESIGN_WIDTH: u32 = 750;

#[inline]
pub fn s(px: f32) -> f32 { (px * WIDTH as f32 / DESIGN_WIDTH as f32).round() }

#[derive(Clone, Copy, Debug)]
pub struct Rgba(pub u8, pub u8, pub u8, pub f32);

impl Rgba {
    pub fn from_hex(hex: &str, a: f32) -> Self {
        let h = hex.trim_start_matches('#');
        if h.len() != 6 { return Rgba(255, 255, 255, a); }
        let r = u8::from_str_radix(&h[0..2], 16).unwrap_or(255);
        let g = u8::from_str_radix(&h[2..4], 16).unwrap_or(255);
        let b = u8::from_str_radix(&h[4..6], 16).unwrap_or(255);
        Rgba(r, g, b, a)
    }
    pub fn color(self) -> Color {
        Color::from_rgba8(self.0, self.1, self.2, (self.3.clamp(0.0, 1.0) * 255.0) as u8)
    }
    pub fn a(self, a: f32) -> Self { Rgba(self.0, self.1, self.2, a) }
}

#[derive(Clone)]
pub struct Palette {
    pub bg0: Rgba, pub bg1: Rgba, pub bg2: Rgba,
    pub ink: Rgba, pub ink2: Rgba, pub mute: Rgba,
    pub accent: Rgba, pub accent2: Rgba,
    pub green: Rgba, pub red: Rgba, pub gold: Rgba,
}

pub fn default_palette() -> Palette {
    Palette {
        bg0: Rgba::from_hex("#08080a", 1.0), bg1: Rgba::from_hex("#101012", 1.0), bg2: Rgba::from_hex("#17171a", 1.0),
        ink: Rgba::from_hex("#f6f2e7", 1.0), ink2: Rgba::from_hex("#bcb6a6", 1.0), mute: Rgba::from_hex("#7d7768", 1.0),
        accent: Rgba::from_hex("#d4af37", 1.0), accent2: Rgba::from_hex("#c9cdd3", 1.0),
        green: Rgba::from_hex("#8fbf9f", 1.0), red: Rgba::from_hex("#c4594e", 1.0), gold: Rgba::from_hex("#d4af37", 1.0),
    }
}

#[derive(Clone)]
pub struct ThemeStyle {
    pub panel_bg: Rgba, pub panel_border_alpha: f32, pub panel_line_width: f32,
    pub panel_radius: f32, pub btn_radius: f32, pub frame: bool,
    pub bg_image_alpha: f32, pub shade: Rgba, pub foil: bool,
}

pub fn default_style() -> ThemeStyle {
    ThemeStyle {
        panel_bg: Rgba(22, 21, 18, 0.86), panel_border_alpha: 0.42, panel_line_width: 1.0,
        panel_radius: 0.0, btn_radius: 0.0, frame: true,
        bg_image_alpha: 0.12, shade: Rgba(8, 8, 10, 0.78), foil: true,
    }
}


pub fn sanitize_glyphs(text: &str) -> String {
    let mut out = text.to_string();
    let map: &[(&str, &str)] = &[
        ("ᴶᴼᴴᴺ ᵀᴿᴬᴺ", "JOHN TRAN"), ("ᴶᴼᴴᴺ", "JOHN"), ("ᵀᴿᴬᴺ", "TRAN"),
        ("⌨️","»"),("⌨","»"),("🔗","»"),("📄","»"),("📡","#"),("📺","▶"),
        ("❌","×"),("🚫","×"),("✖","×"),("❎","×"),
        ("🎵","♪"),("🎧","♫"),("🎼","♪"),("❤️","♥"),("❤","♥"),("😽","♥"),("💔","×"),
        ("👤","o"),("👥","oo"),("🙂","o"),("🔥","*"),("⭐","★"),("🌟","★"),("🏆","★"),("👑","♛"),
        ("🔎","?"),("🔍","?"),("❓","?"),("❔","?"),("💡","i"),("ℹ️","i"),
        ("⏳","..."),("⏰","◷"),("⏱","◷"),("🎯",">"),("👉",">"),("▶️","▶"),("◀️","◀"),
        ("📌","•"),("📍","•"),("💰","$"),("💵","$"),("🎲","?"),("🃏","?"),
        ("💬","◌"),("🗨️","◌"),("🖼️","▣"),("🖼","▣"),("🌐","@"),("📎","♦"),
        ("🤖","✦"),("🧠","✦"),("✅","✓"),("✔️","✓"),("⚡","⚡"),("➜",">"),("✕","×"),("›",">"),("·","-"),
    ];
    for (k, v) in map { out = out.replace(k, v); }
    out.chars().filter(|c| {
        let u = *c as u32;
        !((0x1F000..=0x1FAFF).contains(&u) || (0x1F1E6..=0x1F1FF).contains(&u) || u==0xFE0F
          || (0x2600..=0x26CF).contains(&u) || (0x2700..=0x27BF).contains(&u)
          || (0x1D00..=0x1D7F).contains(&u) || (0x2070..=0x209F).contains(&u))
    }).collect()
}

pub fn new_pixmap(w: u32, h: u32) -> Pixmap { Pixmap::new(w, h).expect("pixmap") }

pub fn fill_rect(pm: &mut Pixmap, x: f32, y: f32, w: f32, h: f32, color: Rgba) {
    if let Some(r) = Rect::from_xywh(x, y, w, h) {
        let mut p = Paint::default(); p.set_color(color.color()); p.anti_alias = true;
        pm.fill_rect(r, &p, Transform::identity(), None);
    }
}

pub fn round_rect_path(x: f32, y: f32, w: f32, h: f32, r: f32) -> Option<tiny_skia::Path> {
    let r = r.min(w/2.0).min(h/2.0).max(0.0);
    let mut pb = PathBuilder::new();
    pb.move_to(x+r,y); pb.line_to(x+w-r,y); pb.quad_to(x+w,y,x+w,y+r);
    pb.line_to(x+w,y+h-r); pb.quad_to(x+w,y+h,x+w-r,y+h);
    pb.line_to(x+r,y+h); pb.quad_to(x,y+h,x,y+h-r);
    pb.line_to(x,y+r); pb.quad_to(x,y,x+r,y); pb.close(); pb.finish()
}
pub fn fill_round_rect(pm: &mut Pixmap, x:f32,y:f32,w:f32,h:f32,r:f32,color:Rgba){
    if let Some(path)=round_rect_path(x,y,w,h,r){ let mut p=Paint::default(); p.set_color(color.color()); p.anti_alias=true; pm.fill_path(&path,&p,FillRule::Winding,Transform::identity(),None); }
}
pub fn stroke_round_rect(pm: &mut Pixmap, x:f32,y:f32,w:f32,h:f32,r:f32,color:Rgba,width:f32){
    if let Some(path)=round_rect_path(x,y,w,h,r){ let mut p=Paint::default(); p.set_color(color.color()); p.anti_alias=true; let st=Stroke{width,..Default::default()}; pm.stroke_path(&path,&p,&st,Transform::identity(),None); }
}

pub fn project_root() -> PathBuf {
    if let Ok(exe) = std::env::current_exe() {
        let mut cur = exe.as_path();
        for _ in 0..8 {
            if let Some(parent) = cur.parent() {
                if parent.join("assets/bg/theme.jpg").exists() { return parent.to_path_buf(); }
                cur = parent;
            }
        }
    }
    if let Ok(cwd) = std::env::current_dir() {
        let mut cur = cwd.as_path();
        for _ in 0..6 {
            if cur.join("assets/bg/theme.jpg").exists() { return cur.to_path_buf(); }
            match cur.parent() { Some(p) => cur = p, None => break }
        }
    }
    PathBuf::from(".")
}

pub struct Fonts {
    pub regular: Font, pub bold: Font,
    pub display: Font, pub display_bold: Font,
    pub round: Font, pub round_bold: Font,
    pub mono: Font, pub mono_bold: Font,
}

fn load_font(path: &Path) -> Option<Font> {
    let data = fs::read(path).ok()?;
    Font::from_bytes(data.clone(), FontSettings::default()).ok()
        .or_else(|| Font::from_bytes(data, FontSettings { collection_index: 0, scale: 40.0, load_substitutions: false }).ok())
        .or_else(|| {
            let data2 = fs::read(path).ok()?;
            Font::from_bytes(data2, FontSettings { collection_index: 1, scale: 40.0, load_substitutions: false }).ok()
        })
}
fn find_font(cands: &[&str]) -> Option<Font> {
    for c in cands { let p = Path::new(c); if p.exists() { if let Some(f) = load_font(p) { return Some(f); } } }
    None
}

impl Fonts {
    pub fn load() -> Self {
        let regular = find_font(&["/System/Library/Fonts/Supplemental/Arial.ttf","/usr/share/fonts/truetype/dejavu/DejaSans.ttf","/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf","C:\\Windows\\Fonts\\arial.ttf"]).expect("no system font");
        let bold = find_font(&["/System/Library/Fonts/Supplemental/Arial Bold.ttf","/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf","C:\\Windows\\Fonts\\arialbd.ttf"]).unwrap_or_else(|| regular.clone());
        let display = find_font(&["/System/Library/Fonts/Supplemental/Georgia.ttf","/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf","C:\\Windows\\Fonts\\georgia.ttf"]).unwrap_or_else(|| regular.clone());
        let display_bold = find_font(&["/System/Library/Fonts/Supplemental/Georgia Bold.ttf","/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf","C:\\Windows\\Fonts\\georgiab.ttf"]).unwrap_or_else(|| bold.clone());
        let round = find_font(&["/System/Library/Fonts/Supplemental/Arial Rounded Bold.ttf","/System/Library/Fonts/Avenir.ttc","/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"]).unwrap_or_else(|| regular.clone());
        let round_bold = find_font(&["/System/Library/Fonts/Avenir Next.ttc","/System/Library/Fonts/Supplemental/Arial Bold.ttf","/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"]).unwrap_or_else(|| bold.clone());
        let mono = find_font(&["/System/Library/Fonts/Menlo.ttc","/System/Library/Fonts/Supplemental/Courier New.ttf","/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"]).unwrap_or_else(|| regular.clone());
        let mono_bold = find_font(&["/System/Library/Fonts/Supplemental/Courier New Bold.ttf","/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf","C:\\Windows\\Fonts\\consolab.ttf"]).unwrap_or_else(|| bold.clone());
        Self { regular, bold, display, display_bold, round, round_bold, mono, mono_bold }
    }
    pub fn pick(&self, family: &str) -> &Font {
        match family {
            "JT-Bold" => &self.bold, "JT-Display" => &self.display, "JT-Display-Bold" => &self.display_bold,
            "JT-Round" => &self.round, "JT-Round-Bold" => &self.round_bold,
            "JT-Mono" => &self.mono, "JT-Mono-Bold" => &self.mono_bold, _ => &self.regular,
        }
    }
}

pub fn linear_gradient_rect(pm:&mut Pixmap,x:f32,y:f32,w:f32,h:f32,r:f32,x0:f32,y0:f32,x1:f32,y1:f32,stops:&[(f32,Rgba)]){
    let sg = match LinearGradient::new(Point::from_xy(x0,y0),Point::from_xy(x1,y1),stops.iter().map(|(p,c)| GradientStop::new(*p,c.color())).collect(),SpreadMode::Pad, Transform::identity()){Some(g)=>g,None=>return};
    let mut paint=Paint::default(); paint.shader=sg; paint.anti_alias=true;
    if r<=0.0 { if let Some(rect)=Rect::from_xywh(x,y,w,h){ pm.fill_rect(rect,&paint,Transform::identity(),None); } }
    else if let Some(path)=round_rect_path(x,y,w,h,r){ pm.fill_path(&path,&paint,FillRule::Winding,Transform::identity(),None); }
}
pub fn radial_glow(pm:&mut Pixmap,cx:f32,cy:f32,r:f32,color:Rgba){
    let sg = match RadialGradient::new(Point::from_xy(cx,cy),Point::from_xy(cx,cy),r.max(1.0),vec![GradientStop::new(0.0,color.color()),GradientStop::new(1.0,Rgba(0,0,0,0.0).color())],SpreadMode::Pad, Transform::identity()){Some(g)=>g,None=>return};
    let mut paint=Paint::default(); paint.shader=sg; paint.anti_alias=true;
    if let Some(rect)=Rect::from_xywh(0.0,0.0,pm.width() as f32,pm.height() as f32){ pm.fill_rect(rect,&paint,Transform::identity(),None); }
}
pub fn blend_image(pm:&mut Pixmap, img:&image::RgbaImage, ox:i32, oy:i32, alpha:f32){
    let (iw,ih)=img.dimensions(); let pw=pm.width() as i32; let ph=pm.height() as i32;
    let data = pm.pixels_mut();
    for y in 0..ih as i32 { let dy=oy+y; if dy<0||dy>=ph {continue;}
        for x in 0..iw as i32 { let dx=ox+x; if dx<0||dx>=pw {continue;}
            let sp=img.get_pixel(x as u32,y as u32).0; let sa=(sp[3] as f32/255.0)*alpha; if sa<=0.0 {continue;}
            let idx=(dy as u32*(pw as u32)+dx as u32) as usize;
            let dst=data[idx]; let da=dst.alpha() as f32/255.0; let dr=dst.red() as f32/255.0; let dg=dst.green() as f32/255.0; let db=dst.blue() as f32/255.0;
            let sr=sp[0] as f32/255.0; let sg=sp[1] as f32/255.0; let sb=sp[2] as f32/255.0;
            let out_a=sa+da*(1.0-sa); if out_a<=0.0 {continue;}
            let inv=1.0/out_a;
            let or=((sr*sa+dr*da*(1.0-sa))*inv*255.0) as u8;
            let og=((sg*sa+dg*da*(1.0-sa))*inv*255.0) as u8;
            let ob=((sb*sa+db*da*(1.0-sa))*inv*255.0) as u8;
            let oa=(out_a*255.0) as u8;
            data[idx]=PremultipliedColorU8::from_rgba(or,og,ob,oa).unwrap_or(dst);
        }
    }
}
pub fn paint_background(pm:&mut Pixmap, w:u32, h:u32, pal:&Palette, style:&ThemeStyle){
    let wf=w as f32; let hf=h as f32;
    linear_gradient_rect(pm,0.0,0.0,wf,hf,0.0,0.0,0.0,wf,hf,&[(0.0,pal.bg0),(0.5,pal.bg1),(1.0,pal.bg0)]);
    let bg=project_root().join("assets/bg/theme.jpg");
    if bg.exists(){ if let Ok(img)=image::open(&bg){
        let rgba=img.to_rgba8(); let (iw,ih)=rgba.dimensions();
        let scale=(wf/iw as f32).max(hf/ih as f32);
        let dw=(iw as f32*scale).max(1.0) as u32; let dh=(ih as f32*scale).max(1.0) as u32;
        let resized=image::imageops::resize(&rgba,dw,dh,image::imageops::FilterType::Triangle);
        let ox=((wf-dw as f32)/2.0) as i32; let oy=((hf-dh as f32)/2.0) as i32;
        blend_image(pm,&resized,ox,oy,style.bg_image_alpha);
    }}
    linear_gradient_rect(pm,0.0,0.0,wf,hf,0.0,0.0,0.0,0.0,hf,&[(0.0,style.shade.a(0.55)),(1.0,style.shade)]);
    radial_glow(pm,s(140.0),s(120.0),s(340.0),Rgba(212,175,55,0.10));
    radial_glow(pm,wf-s(140.0),s(120.0),s(340.0),Rgba(212,175,55,0.04));
    if style.frame {
        stroke_round_rect(pm,s(10.0),s(10.0),wf-s(20.0),hf-s(20.0),0.0,pal.accent.a(0.28),s(1.0).max(1.0));
        stroke_round_rect(pm,s(16.0),s(16.0),wf-s(32.0),hf-s(32.0),0.0,pal.accent.a(0.14),s(1.0).max(1.0));
    }
}
pub fn panel(pm:&mut Pixmap,x:f32,y:f32,w:f32,h:f32,r:f32,accent:Rgba,style:&ThemeStyle){
    let rr=if r>0.0 {r} else {s(style.panel_radius)};
    linear_gradient_rect(pm,x,y,w,h,rr,x,y,x+w*0.8,y+h,&[(0.0,Rgba(255,255,255,0.055)),(1.0,style.panel_bg)]);
    stroke_round_rect(pm,x,y,w,h,rr,accent.a(style.panel_border_alpha),style.panel_line_width.max(1.0));
    stroke_round_rect(pm,x+s(1.0),y+s(1.0),(w-s(2.0)).max(1.0),(h-s(2.0)).max(1.0),(rr-s(1.0)).max(0.0),Rgba(255,255,255,0.07),s(1.0).max(1.0));
}
pub fn foil(pm:&mut Pixmap,x:f32,y:f32,w:f32,pal:&Palette,style:&ThemeStyle){
    if !style.foil {return;}
    let steps=(w as i32).max(24);
    for i in 0..steps { let t=i as f32/steps as f32; let a=if t<0.55 {1.0-(t/0.55)*0.65} else {0.35*(1.0-(t-0.55)/0.45)}; fill_rect(pm,x+w*t,y,(w/steps as f32).ceil()+1.0,3.0,pal.accent.a(a.max(0.0))); }
}

pub fn measure_text(fonts:&Fonts,family:&str,text:&str,size:f32)->f32{
    let font=fonts.pick(family); let t=sanitize_glyphs(text);
    let mut w=0.0f32; for ch in t.chars(){ w += font.metrics(ch,size).advance_width; } w
}
pub fn truncate_text(fonts:&Fonts,family:&str,text:&str,size:f32,max_w:f32)->String{
    let t=sanitize_glyphs(text); if measure_text(fonts,family,&t,size)<=max_w {return t;}
    let mut s=t; while s.chars().count()>1 { s.pop(); let cand=format!("{}…",s); if measure_text(fonts,family,&cand,size)<=max_w {return cand;} } "…".into()
}
fn draw_glyph(pm:&mut Pixmap, bitmap:&[u8], gw:i32, gh:i32, gx:i32, gy:i32, color:Rgba){
    let pw=pm.width() as i32; let ph=pm.height() as i32; let data=pm.pixels_mut();
    for row in 0..gh { let dy=gy+row; if dy<0||dy>=ph {continue;}
        for col in 0..gw { let dx=gx+col; if dx<0||dx>=pw {continue;}
            let cov=bitmap[(row*gw+col) as usize] as f32/255.0; if cov<=0.001 {continue;}
            let sa=color.3*cov; let idx=(dy as u32*(pw as u32)+dx as u32) as usize;
            let dst=data[idx]; let da=dst.alpha() as f32/255.0; let dr=dst.red() as f32/255.0; let dg=dst.green() as f32/255.0; let db=dst.blue() as f32/255.0;
            let sr=color.0 as f32/255.0; let sg=color.1 as f32/255.0; let sb=color.2 as f32/255.0;
            let out_a=sa+da*(1.0-sa); if out_a<=0.0 {continue;} let inv=1.0/out_a;
            let or=((sr*sa+dr*da*(1.0-sa))*inv*255.0) as u8; let og=((sg*sa+dg*da*(1.0-sa))*inv*255.0) as u8; let ob=((sb*sa+db*da*(1.0-sa))*inv*255.0) as u8;
            data[idx]=PremultipliedColorU8::from_rgba(or,og,ob,(out_a*255.0) as u8).unwrap_or(dst);
        }
    }
}
pub fn draw_text(pm:&mut Pixmap, fonts:&Fonts, family:&str, text:&str, x:f32, y:f32, size:f32, color:Rgba, align:&str){
    draw_text_max(pm, fonts, family, text, x, y, size, color, align, None);
}
pub fn draw_text_max(pm:&mut Pixmap, fonts:&Fonts, family:&str, text:&str, x:f32, y:f32, size:f32, color:Rgba, align:&str, max_w:Option<f32>){
    let font=fonts.pick(family);
    let t = match max_w { Some(mw) => truncate_text(fonts,family,text,size,mw), None => sanitize_glyphs(text) };
    let tw=measure_text(fonts,family,&t,size);
    let mut cx = match align { "center"=>x-tw/2.0, "right"=>x-tw, _=>x };
    for ch in t.chars(){ let (metrics,bitmap)=font.rasterize(ch,size);
        if metrics.width>0 && metrics.height>0 { let gx=(cx+metrics.xmin as f32).round() as i32; let gy=(y - metrics.height as f32 - metrics.ymin as f32).round() as i32; draw_glyph(pm,&bitmap,metrics.width as i32,metrics.height as i32,gx,gy,color); }
        cx += metrics.advance_width;
    }
}
pub fn label(pm:&mut Pixmap, fonts:&Fonts, text:&str, x:f32, y:f32, size:f32, color:Rgba, align:&str){
    let upper=sanitize_glyphs(text).to_uppercase();
    let spaced: String = upper.chars().map(|c| c.to_string()).collect::<Vec<_>>().join(" ");
    draw_text(pm,fonts,"JT-Bold",&spaced,x,y,size,color,align);
}
pub fn button(pm:&mut Pixmap, fonts:&Fonts, x:f32,y:f32,w:f32,h:f32, txt:&str, color:Rgba, style:&ThemeStyle){
    fill_round_rect(pm,x,y,w,h,s(style.btn_radius),color.a(0.18));
    stroke_round_rect(pm,x,y,w,h,s(style.btn_radius),color.a(0.6),s(1.5));
    draw_text(pm,fonts,"JT-Bold",txt,x+w/2.0,y+h/2.0+s(8.0),s(22.0),color,"center");
}
pub fn random_accent()->(Rgba,Rgba,Rgba){
    let sets:&[((&str,&str,&str))]=&[("#d4af37","#fbbf24","#c4594e"),("#d4af37","#8fbf9f","#5b8dd9"),("#c9cdd3","#d4af37","#b74134"),("#d4af37","#9d7bd8","#5fa8d3"),("#e0b84c","#7fb069","#c97b8a"),("#d4af37","#e07a5f","#81b29a")];
    let mut rng=rand::thread_rng(); let pick=*sets.choose(&mut rng).unwrap();
    (Rgba::from_hex(pick.0,1.0),Rgba::from_hex(pick.1,1.0),Rgba::from_hex(pick.2,1.0))
}
pub fn short_plays(n:i64)->String{ let v=n as f64; if v>=1e9{format!("{:.1}B",v/1e9)} else if v>=1e6{format!("{:.1}M",v/1e6)} else if v>=1e3{format!("{:.0}K",v/1e3)} else {format!("{}",n)} }
pub fn format_duration(secs:i64)->String{ format!("{}:{:02}", secs/60, secs%60) }
pub fn encode_png(pm:&Pixmap)->Result<Vec<u8>,String>{ pm.encode_png().map_err(|e|e.to_string()) }
