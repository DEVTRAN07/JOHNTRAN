pub mod music_ui;
pub mod reply;
pub mod styled;

pub use music_ui::{now_playing, search_list, usage_list, Track};
pub use reply::{ReplyBuilder, SendOptions};
pub use styled::{
    frame, plain, StyledText, TextPart, ZaloStyleSpan, ZaloStyledMessage, STYLE_BOLD, STYLE_GREEN,
    STYLE_ORANGE, STYLE_RED, STYLE_YELLOW,
};

// Compatibility alias matching requested API shape.
pub type Reply = ReplyBuilder;
