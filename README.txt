khoaguihuong — góc nhỏ để hai người viết thư và note cho nhau

TÍNH NĂNG
- Gửi cảm xúc và xem nhật ký cảm xúc.
- Viết thư, mỗi thư có mật khẩu riêng do người viết tự đặt. Danh sách chỉ hiện tên/tiêu đề; nội dung chỉ trả về sau khi máy chủ xác thực mật khẩu.
- Có thể xóa thư bằng đúng mật khẩu của thư đó. Xóa cần xác nhận.
- Viết note có tên/biệt danh và mật khẩu xóa riêng; xóa note cần đúng mật khẩu.
- Hỗ trợ Supabase để đồng bộ dữ liệu giữa hai thiết bị.

CHẠY LOCAL
1. Cài Node.js 18 trở lên.
2. Mở thư mục violet_atelier_push trong VS Code.
3. Chạy npm install
4. Sao chép .env.example thành .env nếu muốn kết nối Supabase.
5. Chạy npm start và mở http://localhost:3000

KẾT NỐI SUPABASE
1. Tạo project tại https://supabase.com/
2. Vào SQL Editor > New query, chạy toàn bộ supabase-setup.sql.
3. Vào Project Settings > API Keys và lấy Project URL cùng service_role/secret key.
4. Thêm vào biến môi trường của Render: SUPABASE_URL và SUPABASE_SERVICE_ROLE_KEY. Với chạy local, điền vào file .env.
5. TUYỆT ĐỐI không đưa SUPABASE_SERVICE_ROLE_KEY vào GitHub, frontend hoặc gửi cho người khác. Không commit file .env.
6. Triển khai lại Render và kiểm tra thử tạo/mở/xóa thư, thêm/xóa note từ hai thiết bị.

LƯU Ý QUAN TRỌNG
- Nếu chưa cấu hình Supabase, server dùng JSON cục bộ; trên hosting miễn phí dữ liệu cục bộ có thể mất khi máy chủ khởi động lại. Cần Supabase để đồng bộ và lưu bền vững.
- Mỗi thư và note có mật khẩu riêng. Hãy nhớ mật khẩu; không có chức năng khôi phục nếu quên.
- Xóa thư/note là thao tác vĩnh viễn.
- Vì website chưa có tài khoản cá nhân, người biết link có thể xem tiêu đề thư, gửi thư/note và cảm xúc. Nội dung thư yêu cầu mật khẩu riêng mới mở được. Chỉ chia sẻ link với người tin cậy.
