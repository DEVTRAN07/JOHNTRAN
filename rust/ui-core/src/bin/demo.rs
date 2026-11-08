use ui_core::{StyledText, Track, now_playing, search_list};

fn main() {
    let mut s = StyledText::new();
    s.bold("Hello").normal(" ").error("world").normal("
Name: ").success("Alice");
    println!("--- StyledText JSON ---");
    println!("{}", s.to_json());
    println!("--- Plain ---");
    println!("{}", s.to_plain_string());

    let tracks = vec![
        Track { title: "Song A".into(), artist: "Artist B".into(), duration: Some(125) },
        Track { title: "Song C".into(), artist: "Artist D".into(), duration: Some(61) },
    ];
    println!("--- Search List JSON ---");
    println!("{}", serde_json::to_string_pretty(&search_list("YouTube", "lofi", &tracks, 1, 2)).unwrap());

    println!("--- Now Playing JSON ---");
    println!("{}", serde_json::to_string_pretty(&now_playing(&tracks[0], "YouTube")).unwrap());
}
