# assets/spam — BỘ NGÔN TỪ SPAM

Chứa các câu dùng cho lệnh `/spam`. **Không cần sửa code** — chỉ cần sửa file `.txt` ở đây.

## Cách thêm câu
- Mỗi file `.txt` trong thư mục này được bot nạp.
- Mỗi **dòng** = một câu spam.
- Dòng bắt đầu bằng `#` là chú thích, bot bỏ qua.
- Dòng trắng bỏ qua.
- Có thể thêm nhiều file (vd `words.txt`, `thỉnh_thoảng.txt`) — bot gộp tất cả.

## Cách dùng trong nhóm
```
/spam @bạn                → spam câu ngẫu nhiên, có tag người kia, lặp 20 lần
/spam @bạn -t 0           → spam KHÔNG giới hạn, dừng bằng /spam off
/spam @bạn -t 50 -d 1     → 50 lần, mỗi 1 giây
/spam @bạn Xin chào       → dùng câu tự gõ thay vì câu trong folder
/spam off                 → dừng
/spam reload              → nạp lại file sau khi sửa
```

## Lưu ý
- Chỉ admin bot (role 2) dùng được.
- Mỗi nhóm chỉ chạy 1 job spam; gõ `/spam off` để dừng trước khi bật job mới.
