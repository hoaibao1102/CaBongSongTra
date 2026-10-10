export const publicContent: Record<
  string,
  Record<"vi" | "en", { title: string; body: string }>
> = {
  privacy: {
    vi: {
      title: "Quyền riêng tư",
      body: "Thông tin tên, điện thoại, địa chỉ, khu vực và ghi chú được gửi để xử lý đơn hàng. Không nhập thông tin thanh toán hoặc thông tin nhạy cảm vào ghi chú. Trình duyệt chỉ lưu ngôn ngữ và dữ liệu kỹ thuật thử lại trong phiên, không lưu nội dung khách hàng. Cookie phiên bảo vệ đăng nhập. Đơn vị kiểm soát dữ liệu, thời hạn lưu trữ và kênh thực hiện quyền riêng tư cần được chủ cửa hàng xác minh trước khi mở bán.",
    },
    en: {
      title: "Privacy",
      body: "Name, phone, address, area and notes are sent to process orders. Do not enter payment credentials or sensitive information in notes. Browser storage contains language preference and tab-scoped technical retry metadata, not customer form contents. A session cookie supports sign-in. The operator must verify the data controller, retention periods and privacy-request channel before launch.",
    },
  },
  terms: {
    vi: {
      title: "Điều kiện đặt hàng",
      body: "Gửi đơn là yêu cầu chờ xác nhận, không phải cam kết giữ hàng. Giá và tồn kho được kiểm tra trên máy chủ. Trang này không thu thanh toán thẻ. Phí vận chuyển, thời gian giao, chính sách đổi trả và thông tin pháp nhân chưa được xác minh; cần được cửa hàng xác nhận trước khi giao dịch. Nội dung mô tả quy trình hiện tại, không phải phê duyệt pháp lý hoặc chính sách bán hàng đã được duyệt.",
    },
    en: {
      title: "Order terms",
      body: "Submitting an order is a pending request, not a stock reservation. The server checks prices and availability. This site does not collect card payments. Delivery charges, delivery times, return policy and seller legal identity must be verified and confirmed before a transaction. This describes the current workflow; it is not legal approval or an approved sales policy.",
    },
  },
  contact: {
    vi: {
      title: "Liên hệ",
      body: "Thông tin liên hệ chính thức, địa chỉ kinh doanh và danh tính pháp lý chưa được xác minh. Không có số điện thoại hoặc email giả được công bố. Nếu đã có đơn, giữ mã đơn và sử dụng kênh cửa hàng mà bạn đã xác minh độc lập. Không gửi mật khẩu, mã khôi phục hoặc thông tin ngân hàng. Chủ cửa hàng cần bổ sung kênh hỗ trợ đã xác minh trước khi mở bán.",
    },
    en: {
      title: "Contact",
      body: "Official contact details, business address and seller legal identity are not yet verified. No placeholder phone number or email is published. If you have an order, keep its code and use a shop channel you have independently verified. Never share passwords, reset tokens or bank credentials. The operator must publish a verified support channel before launch.",
    },
  },
  "label-safety": {
    vi: {
      title: "Nhãn và an toàn thực phẩm",
      body: "Sản phẩm là cá: kiểm tra cảnh báo dị ứng cá và toàn bộ thành phần trên nhãn thực tế. Chưa có danh sách thành phần, chứng nhận hoặc hướng dẫn bảo quản đã xác minh trên website. Kiểm tra mã lô, hạn dùng, niêm phong và điều kiện bảo quản in trên bao bì; không dùng hàng hết hạn, rò rỉ hoặc có dấu hiệu hỏng. Không suy luận hạn dùng từ hình minh họa. Yêu cầu nhãn thực tế trước khi mua nếu có dị ứng hoặc nhu cầu ăn uống đặc biệt.",
    },
    en: {
      title: "Label and food safety",
      body: "This is a fish product: check fish allergen warnings and the full ingredients on the actual label. Verified ingredients, certifications and storage instructions are not yet published here. Check the lot code, expiry, seal and storage instructions printed on the package; do not consume expired, leaking or spoiled products. Do not infer shelf life from illustrations. Request the actual label before purchase if you have allergies or dietary requirements.",
    },
  },
};
export function sitemapEntries(origin?: string) {
  try {
    const url = new URL(origin!);
    if (url.origin !== origin || !/^https?:$/.test(url.protocol)) return [];
  } catch {
    return [];
  }
  return [
    "",
    ...Object.keys(publicContent),
    ...[300, 400, 600].map((size) => `products/CBST-${size}`),
  ].map((path) => ({ url: `${origin}/${path}` }));
}
