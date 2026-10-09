const zaloPhone = process.env.NEXT_PUBLIC_ZALO_PHONE?.trim() || "0702478561";

export const site = {
  name: "Cá Bống Sông Trà",
  fullName: "Cá Bống Sông Trà – Đặc sản Quảng Ngãi",
  eyebrow: "ĐẶC SẢN QUẢNG NGÃI · CÓ HÀNG TẠI TP.HCM",
  headline: "Cá Bống Sông Trà — Hương vị Quảng Ngãi trong bữa cơm nhà",
  tagline: "Hương vị quê nhà, tiện cho bữa cơm gia đình.",
  intro:
    "Cá bống Sông Trà kho đậm đà, gợi nhớ hương vị Quảng Ngãi. Sản phẩm có hàng tại TP.HCM; khách liên hệ qua Zalo để được tư vấn lựa chọn hũ phù hợp và xác nhận phương án giao hàng.",
  description:
    "Khám phá cá bống Sông Trà Quảng Ngãi đóng hũ, 3 quy cách 300 g, 400 g và 600 g. Xem giá, thông tin sản phẩm và liên hệ đặt mua qua Zalo tại TP.HCM.",
  region:
    "TP. Thủ Đức (ưu tiên khu vực Quận 9 cũ), nhận giao các khu vực khác tại TP.HCM tùy đơn thực tế",
  contactName: "Hoài Bảo",
  zaloPhone,
  zaloDirectLink: `https://zalo.me/${zaloPhone}`,
  zaloQrLink: `https://zalo.me/${zaloPhone}`,
  zaloQrImage: "/images/zalo-qr.png",
  siteUrl:
    process.env.NEXT_PUBLIC_SITE_URL || "https://ca-bong-song-tra.vercel.app",
};

export type Product = {
  id: string;
  code: string;
  name: string;
  shortName: string;
  netWeight: string;
  grossWeightEstimate: string;
  price: number;
  image: string;
  description: string;
  caption: string;
  badge?: string;
  buttonText: string;
  zaloMessage: string;
};

export const products: Product[] = [
  {
    id: "nho",
    code: "CBST-300",
    name: " Hũ nhỏ",
    shortName: "Hũ nhỏ 300g",
    netWeight: "300 g",
    grossWeightEstimate: "Khối lượng chuẩn: 300 g",
    price: 109000,
    image: "/images/gia-size-nho.png",
    description:
      "Quy cách 300 g. Phù hợp cho khách muốn thử hương vị cá bống Sông Trà trước khi chọn hũ lớn hơn.",
    caption: "Dễ thử vị",
    buttonText: "Hỏi mua hũ nhỏ qua Zalo",
    zaloMessage:
      "Chào shop, mình muốn hỏi mua 1 hũ cá bống Sông Trà loại nhỏ 300g (109.000đ). Shop báo giúp mình phí giao và hạn sử dụng nhé.",
  },
  {
    id: "vua",
    code: "CBST-400",
    name: " Hũ vừa",
    shortName: "Hũ vừa 400g",
    netWeight: "400 g",
    grossWeightEstimate: "Khối lượng chuẩn: 400 g",
    price: 139000,
    image: "/images/gia-size-vua.png",
    description:
      "Quy cách 400 g. Một lựa chọn trung gian cho bữa cơm gia đình, đậm đà và vừa vặn.",
    caption: "Lựa chọn phổ biến",
    badge: "Bán chạy nhất",
    buttonText: "Hỏi mua hũ vừa qua Zalo",
    zaloMessage:
      "Chào shop, mình muốn hỏi mua 1 hũ cá bống Sông Trà loại vừa 400g (139.000đ). Shop báo giúp mình phí giao và hạn sử dụng nhé.",
  },
  {
    id: "lon",
    code: "CBST-600",
    name: "Hũ lớn",
    shortName: "Hũ lớn 600g",
    netWeight: "600 g",
    grossWeightEstimate: "Khối lượng chuẩn: 600 g",
    price: 199000,
    image: "/images/gia-size-lon.png",
    description:
      "Quy cách 600 g. Lựa chọn dung lượng lớn hơn khi khách có nhu cầu sử dụng nhiều hoặc bữa cơm đông thành viên.",
    caption: "Tiết kiệm hơn",
    badge: "Tiết kiệm",
    buttonText: "Hỏi mua hũ lớn qua Zalo",
    zaloMessage:
      "Chào shop, mình muốn hỏi mua 1 hũ cá bống Sông Trà loại lớn 600g (199.000đ). Shop báo giúp mình phí giao và hạn sử dụng nhé.",
  },
];

export const comparisonImages = [
  {
    id: "bang-size",
    title: "Bảng quy cách & Kích thước thực tế",
    subtitle: "So sánh chiều cao, đường kính và hình dáng 3 size hũ",
    image: "/images/bang-size.png",
    alt: "Bảng kích thước hũ cá bống Sông Trà 300g, 400g và 600g",
  },
  {
    id: "bang-gia",
    title: "Bảng giá niêm yết 3 quy cách",
    subtitle: "Giá bán tham khảo công khai, minh bạch theo từng loại hũ",
    image: "/images/bang-gia.png",
    alt: "Bảng giá cá bống Sông Trà Quảng Ngãi 3 loại hũ",
  },
];

export const faqs = [
  {
    q: "Có mấy loại hũ cá bống Sông Trà?",
    a: "Hiện có 3 quy cách chuẩn: hũ nhỏ 300 g, hũ vừa 400 g và hũ lớn 600 g.",
  },
  {
    q: "Giá từng loại hũ là bao nhiêu?",
    a: "Hũ nhỏ 109.000đ, hũ vừa 139.000đ và hũ lớn 199.000đ. Phí giao hàng chưa bao gồm trong giá và sẽ được thông báo cụ thể theo khu vực trước khi chốt đơn.",
  },
  {
    q: "Có hàng sẵn tại TP.HCM không?",
    a: "Có sẵn hàng phục vụ khách tại TP.HCM; ưu tiên khu vực TP Thủ Đức (Quận 9 cũ). Khách có thể liên hệ Zalo để xác nhận lượng tồn kho và thời gian giao hàng thuận tiện nhất.",
  },
  {
    q: "Sản phẩm bảo quản như thế nào?",
    a: "Bảo quản theo đúng thông tin hướng dẫn ghi trên nhãn sản phẩm. Bạn có thể nhắn Zalo để nhận ảnh chụp nhãn thực tế và hướng dẫn chi tiết của lô hàng hiện tại.",
  },
  {
    q: "Hạn sử dụng của sản phẩm là bao lâu?",
    a: "Ngày sản xuất và hạn sử dụng được xác định theo từng lô/hũ và thể hiện rõ trên nhãn bao bì. Shop luôn đối chiếu hạn còn lại của lô hàng trước khi gửi cho quý khách.",
  },
  {
    q: "Sau khi mở nắp thì dùng trong bao lâu?",
    a: "Thực hiện theo chỉ dẫn trên nhãn/nhà sản xuất. Quý khách nên dùng muỗng/đũa khô sạch để lấy thực phẩm, đậy kín nắp và bảo quản mát sau mỗi lần dùng.",
  },
  {
    q: "Có giao hàng tận nơi không?",
    a: "Có thể sắp xếp giao hàng tận nơi tùy khu vực tại TP.HCM và tình trạng đơn. Phí vận chuyển và thời gian dự kiến sẽ được xác nhận cụ thể trước khi gửi hàng.",
  },
  {
    q: "Làm sao để đặt hàng?",
    a: "Rất nhanh chóng: Bạn chọn loại hũ muốn mua trên web, bấm nút 'Hỏi mua qua Zalo', gửi số lượng và khu vực nhận hàng. Shop sẽ xác nhận tồn kho, giá thanh toán và phương thức giao ngay lập tức.",
  },
  {
    q: "Sản phẩm có cay không?",
    a: "Cá bống kho có gia vị đậm đà và vị cay the nhẹ đặc trưng của tiêu ớt xứ Quảng. Quý khách có thể nhắn tin Zalo để hỏi chi tiết về mức độ cay của mẻ cá hiện tại trước khi đặt.",
  },
  {
    q: "Có được đổi trả nếu có vấn đề không?",
    a: "Nếu sản phẩm gặp sự cố bao bì rò rỉ, nứt vỡ hoặc nhầm quy cách trong quá trình giao hàng, quý khách vui lòng chụp ảnh/video gửi ngay qua Zalo để shop xử lý và hỗ trợ kịp thời.",
  },
];

export const servingSuggestions = [
  {
    title: "Ăn cùng cơm trắng nóng hổi",
    desc: "Cá bống săn chắc, thơm mùi tiêu ớt, rưới chút nước kho đậm đà lên chén cơm nóng là bữa ăn trở nên tròn vị.",
    tag: "Đưa cơm",
  },
  {
    title: "Chấm rau củ luộc thanh mát",
    desc: "Nước kho sánh đậm chấm cùng đĩa rau luộc (bầu luộc, rau muống, đậu bắp) giúp cân bằng vị giác tuyệt hảo.",
    tag: "Thanh mát",
  },
  {
    title: "Mâm cơm gia đình ấm cúng",
    desc: "Kết hợp thêm tô canh chua hoặc canh rau ngót nấu tôm là có ngay mâm cơm chuẩn vị quê nhà cho cả nhà.",
    tag: "Gia đình",
  },
];

export function formatVnd(amount: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(amount);
}
