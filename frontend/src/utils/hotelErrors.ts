export const hotelError = (failure: unknown) => {
  const code = (
    failure as { response?: { data?: { error?: { code?: string } } } }
  )?.response?.data?.error?.code;
  const messages: Record<string, string> = {
    DUPLICATE_ENTRY:
      "Mã khách sạn, tên đăng nhập hoặc email đã được sử dụng. Vui lòng kiểm tra lại.",
    VALIDATION_ERROR:
      "Thông tin chưa hợp lệ. Kiểm tra các trường, múi giờ và ngày bắt đầu/kết thúc.",
    ROLE_MISSING:
      "Chưa có vai trò ADMIN trong hệ thống. Cần khởi tạo vai trò trước khi tiếp nhận khách sạn.",
    HOTEL_NOT_FOUND: "Không tìm thấy khách sạn.",
    HOTEL_ADMIN_NOT_FOUND: "Không tìm thấy quản trị thuộc khách sạn này.",
    UNAUTHORIZED: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
    CONCURRENT_MODIFICATION:
      "Dữ liệu vừa thay đổi. Vui lòng tải lại và thử lại.",
  };
  return (
    (code && messages[code]) ||
    "Chưa thể hoàn tất yêu cầu. Vui lòng kiểm tra kết nối và thử lại."
  );
};
