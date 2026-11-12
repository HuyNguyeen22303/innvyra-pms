export const hotelError = (failure: unknown) => {
  const code = (
    failure as { response?: { data?: { error?: { code?: string } } } }
  )?.response?.data?.error?.code;
  const messages: Record<string, string> = {
    PLAN_CODE_EXISTS: "Mã gói đã được sử dụng.",
    PLAN_UNAVAILABLE:
      "Gói không còn nhận đăng ký. Hãy tải lại và chọn gói khác.",
    SUBSCRIPTION_OVERLAP:
      "Kỳ sử dụng trùng kỳ đã ghi nhận. Chọn ngày bắt đầu sau ngày kết thúc kỳ trước.",
    PERIOD_IN_PAST: "Ngày bắt đầu phải từ hôm nay theo múi giờ khách sạn.",
    PLAN_BELOW_USAGE:
      "Hạn mức gói thấp hơn số phòng hoặc tài khoản đang hoạt động. Cần giảm số lượng hoặc chọn gói lớn hơn.",
    SUBSCRIPTION_LIMIT_REACHED:
      "Đã đạt hạn mức phòng hoặc tài khoản hoạt động. Liên hệ Innvyra để đổi gói.",
    HOTEL_STATUS_UNCHANGED: "Trạng thái khách sạn đã thay đổi. Hãy tải lại.",
    HOTEL_SUSPENDED:
      "Khách sạn đang tạm ngừng sử dụng PMS. Vui lòng liên hệ Innvyra.",
    FEE_TOO_LARGE:
      "Tổng phí vượt giới hạn. Giảm số tháng hoặc kiểm tra lại giá gói.",
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
