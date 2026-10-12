const fs = require("fs");
const card = require("/Users/devtran/Downloads/JOHNTRAN/core/canvas/profileCard");
card.render({ name: "TRẦN VĂN A", avatarBuffer: fs.readFileSync("/Users/devtran/Downloads/JOHNTRAN/assets/bg/theme.jpg"), rows: [["» Sinh nhật", "01/01/2000"], ["» Giới tính", "Nam"], ["» UID", "418669971689260834"]], link: "@tran.a" })
  .then((p) => { console.log("KTHUOC:", fs.statSync(p).size, "bytes"); process.exit(0); })
  .catch((e) => { console.error("ERR:", e.message); process.exit(1); });
