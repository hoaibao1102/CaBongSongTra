# PROJECT CONTEXT — CÁ BỐNG SÔNG TRÀ QUẢNG NGÃI

> **Tài liệu ngữ cảnh nguồn (source of truth) cho chủ dự án, thành viên, AI và developer.**  
> Phiên bản: **1.1** · Ngày cập nhật: **09/10/2026** · Múi giờ: **Asia/Ho_Chi_Minh**  
> Trạng thái: **READY FOR IMPLEMENTATION — P0a**; quyết định canonical nằm trong `DOCS_DECISION_LOG.md`.  
> Phạm vi: chiến lược kinh doanh, sản phẩm, vận hành, tài chính, team, marketing, website Next.js và kế hoạch hệ thống quản trị.  
> Tài liệu này bổ sung cho `KE_HOACH_FULLSTACK_CA_BONG_SONG_TRA_V1.md` (đặc tả/lộ trình triển khai) và tài liệu thông tin sản phẩm cho website.

---

## 0. Cách đọc tài liệu và mức độ xác nhận

**Quy ước trạng thái để tránh AI/developer biến giả định thành sự thật:**

- **[ĐÃ CHỐT]**: nguyên tắc/thông tin người chủ dự án đã xác nhận.
- **[HIỆN CÓ]**: thông tin được cung cấp và đang sử dụng, nhưng có thể cần cập nhật khi phát sinh thực tế.
- **[ĐỀ XUẤT]**: thiết kế/giải pháp khuyến nghị, **chưa được xem là quyết định cuối**.
- **[CẦN XÁC MINH]**: thiếu căn cứ/nhãn/chứng từ hoặc cần người chủ dự án phê duyệt trước khi công khai/vận hành.
- **[KHÔNG ĐƯỢC TỰ SUY DIỄN]**: ranh giới bắt buộc để không tạo sai số liệu hoặc cam kết.

**Thứ tự ưu tiên khi có mâu thuẫn:** (1) thông tin người chủ dự án xác nhận mới nhất; (2) nhãn sản phẩm/chứng từ/điều kiện thật; (3) context này; (4) Master Plan kỹ thuật; (5) mã nguồn và dữ liệu mẫu cũ. Mọi khác biệt phải được nêu ra trước khi chỉnh sửa dữ liệu thật. Đặc biệt, **300/400/600g là khối lượng tịnh** theo cập nhật mới nhất của chủ dự án; **không quay lại 250/300/500g** như một số bản thảo trước đây.

**Hai lớp thông tin:** `PUBLIC` (được đưa lên website sau kiểm chứng) và `INTERNAL` (vốn, giá nhập, biên lợi nhuận, số điện thoại khách, hoa hồng, tồn kho chi tiết, hoạt động của thành viên). Không làm rò rỉ INTERNAL sang API công khai, HTML được render hoặc JavaScript phía trình duyệt.

---

## 1. Bản sắc và mục tiêu dự án

- **[ĐÃ CHỐT] Tên dự án/sản phẩm:** Cá Bống Sông Trà — đặc sản Quảng Ngãi.
- **[ĐÃ CHỐT] Mô hình:** nhập hàng từ nguồn cung để bán lại; **chưa tự sản xuất**, chưa mở đại lý.
- **[ĐÃ CHỐT] Địa bàn:** Quận 9 cũ / TP Thủ Đức, TP.HCM; ưu tiên Võ Văn Hát, Lò Lu và Dĩ An; tiếp cận cộng đồng người Quảng Ngãi/miền Trung tại TP.HCM.
- **[ĐÃ CHỐT] Vốn khởi điểm:** **3.000.000đ**; không có tiền thuê mặt bằng; chưa có nhân sự lương cố định.
- **[ĐÃ CHỐT] Tôn chỉ:** **Đi nhỏ – test nhanh – kiểm soát rủi ro – có dữ liệu mới mở rộng**. *Simple first, but money, data and responsibility must be clear.*
- **[ĐÃ CHỐT] Định vị:** “Cá bống Sông Trà Quảng Ngãi – giá hợp lý, có hàng tại TP.HCM, tiện mua, giao nhanh, mang hương vị quê nhà.” Không đua giá thấp nhất, chưa tự nhận cao cấp/premium khi thương hiệu mới.
- **[ĐÃ CHỐT] Mục tiêu giai đoạn đầu:** bán khoảng **20–30 hũ**, có khoảng **10 khách thật**, nhận feedback thật, có vài khách mua lần hai, tìm size/kênh bán hiệu quả, đánh giá vòng quay vốn.
- **[ĐÃ CHỐT] Chiến lược mở rộng:** 30 hũ bán ổn → cân nhắc 50; 50 hũ bán ổn → cân nhắc 80–100. **Không tăng nhập vì lợi nhuận lý thuyết đẹp**; review sau 2–3 tháng với lợi nhuận thực, dòng tiền, tồn kho, khách quay lại, marketing và team.

### 1.1 Điều KHÔNG phải mục tiêu giai đoạn đầu

- Không xây marketplace, giao hàng toàn quốc tự động, hệ thống đại lý, ERP, microservices, ứng dụng mobile native.
- Không chạy quảng cáo lớn trước khi chứng minh kênh/đơn hiệu quả.
- Không tạo nhu cầu công nghệ vượt quá doanh số thực tế.
- Không giao giá vốn, lợi nhuận toàn dự án hoặc dữ liệu khách của tất cả thành viên cho tài khoản thông thường.

## 2. Khách hàng và nhu cầu

**Nhóm khách chính [ĐÃ CHỐT]:**
1. Người Quảng Ngãi/miền Trung sống tại TP.HCM muốn tìm hương vị quê nhà.
2. Gia đình muốn món mặn tiện lợi cho bữa cơm.
3. Người yêu thích đặc sản địa phương.
4. Khách mua làm quà là phân khúc có thể thử **sau**, chưa ưu tiên ban đầu.

**Giá trị đề xuất:** món đặc sản tiện mua tại TP.HCM; giá/size công khai; có ảnh thật; liên hệ nhanh; tư vấn, giao hàng minh bạch. Không tự tuyên bố thành phần, quy trình, chứng nhận, hạn dùng, xuất xứ chi tiết hay tiêu chuẩn vệ sinh nếu chưa có bằng chứng.

**Hành trình khách mong muốn:** xem bài Facebook Group → xem ảnh/caption → bấm website (nếu cần thêm tin cậy) → xem size/giá/chính sách → nhấn Zalo → xác nhận tồn, địa chỉ, ship, tổng tiền → team tạo đơn nội bộ → giao/thu tiền → xin feedback → theo dõi lần mua tiếp. Website là kênh giới thiệu và chuyển đổi sang Zalo, **không phải checkout online** ở V1.

## 3. Sản phẩm, quy cách và giá bán

### 3.1 Bảng chuẩn DUY NHẤT [ĐÃ CHỐT]

| SKU đề xuất | Tên hiển thị | Khối lượng tịnh | Giá nhập/hũ | Giá bán niêm yết/hũ | Chênh lệch bán − nhập/hũ |
|---|---|---:|---:|---:|---:|
| `CBST-300` | Cá bống Sông Trà hũ 300g | **300g** | **65.000đ** | **109.000đ** | **44.000đ** |
| `CBST-400` | Cá bống Sông Trà hũ 400g | **400g** | **95.000đ** | **139.000đ** | **44.000đ** |
| `CBST-600` | Cá bống Sông Trà hũ 600g | **600g** | **140.000đ** | **199.000đ** | **59.000đ** |

**Bắt buộc về khối lượng:** 300g, 400g, 600g là **khối lượng tịnh của cá VÀ nước kho, KHÔNG bao gồm hũ hoặc bao bì**. Không mô tả đây là khối lượng riêng của phần cá. Các quy cách 250/300/500g trong bản nháp/đáp án cũ là **thông tin lỗi thời**, không được sao chép lên website hay hệ thống mới. Nếu nhãn thực tế khác dữ liệu này, cần xác minh và chốt lại trước khi công khai.

Giá nhập và giá bán là **đầu vào hiện có cho thử nghiệm**; không mặc định đây là giá thị trường hay bất biến. **44k/44k/59k chỉ là chênh lệch trước chi phí** (theo bảng giá và vốn hiện có), không phải lợi nhuận ròng. Không đưa giá vốn/chênh lệch này ra PUBLIC.

### 3.2 Nội dung sản phẩm được phép hiển thị

- Tên sản phẩm, khối lượng tịnh, giá bán, ảnh thật, mô tả ngắn có căn cứ, hướng dẫn liên hệ Zalo.
- Vị trí hàng sẵn có tại TP.HCM **nếu có tồn thực tế**; giao nhanh chỉ hứa hẹn nếu khả năng giao cụ thể đã được xác nhận.
- Giá/khuyến mãi sau khi admin duyệt, thời gian áp dụng, điều kiện và số lượng giới hạn nếu có.
- Thông tin thành phần/NSX/HSD/cơ sở sản xuất/xuất xứ/hướng dẫn bảo quản chỉ đăng theo **nhãn và xác nhận chính thức từ nhà sản xuất**.

### 3.3 Nội dung chưa có đủ căn cứ [CẦN XÁC MINH]

- Thành phần đầy đủ, dị ứng, tỷ lệ cá so với nước kho, thông số dinh dưỡng, giấy tờ/công bố thực phẩm.
- Ngày sản xuất, hạn sử dụng theo từng lô, điều kiện nhiệt độ, số lô, địa chỉ và tên đơn vị chịu trách nhiệm.
- Chính sách đổi trả/hoàn tiền cụ thể và điều kiện bảo đảm giao hàng.
- Chi phí bao bì phụ, cước nhập phân bổ theo hũ, ship thực tế, hao hụt theo lô.

## 4. Bảo quản, hạn sử dụng và an toàn thực phẩm

- **[HIỆN CÓ, CHƯA DÙNG LÀ CAM KẾT CÔNG KHAI]** Thông tin truyền đạt hiện tại: bảo quản ngăn mát khoảng **3–4 tháng**, bên ngoài khoảng **1 tháng**.
- **[ĐÃ CHỐT]** Luôn ưu tiên thông tin thực tế trên nhãn và văn bản/xác nhận của nhà sản xuất, gồm nhiệt độ, bao bì còn nguyên hay đã mở, điều kiện vận chuyển và HSD theo lô. **Không tự cam kết “để ngoài 1 tháng” hoặc “ngăn mát 4 tháng” lên website** nếu chưa có xác minh hợp lệ.
- **[ĐỀ XUẤT]** Nội dung web trước xác minh: “Vui lòng xem hướng dẫn bảo quản và hạn sử dụng ghi trên nhãn sản phẩm. Liên hệ Zalo để được cung cấp thông tin theo lô hàng hiện có.”
- **[ĐỀ XUẤT]** Mỗi lô quản lý `batch_code`, `received_at`, `manufactured_at` nếu biết, `expires_at` theo nhãn, `storage_instructions`, `quantity_received`, `quantity_available`, `unit_cost` và ảnh nhãn/chứng từ.
- **[ĐÃ CHỐT]** Theo dõi FIFO (nhập trước xuất trước) và hạn dùng từng lô. **[ĐỀ XUẤT]** Cảnh báo lô gần hết hạn và ưu tiên FEFO (hết hạn trước xuất trước) khi có hạn dùng rõ ràng, vẫn đáp ứng mục tiêu luân chuyển tồn kho.
- Không bán sản phẩm đã hết hạn/không rõ tình trạng; hàng hỏng/đổi trả phải phân loại rõ, không tự động nhập lại kho bán được.

## 5. Vốn, nhập hàng, tiền mặt

### 5.1 Kế hoạch nhập lần đầu [ĐÃ CHỐT DƯỚI DẠNG DỰ KIẾN]

| Quy cách | Số lượng | Giá vốn/hũ | Tổng vốn hàng |
|---|---:|---:|---:|
| 300g | 15 | 65.000đ | 975.000đ |
| 400g | 8 | 95.000đ | 760.000đ |
| 600g | 5 | 140.000đ | 700.000đ |
| **Tổng** | **28 hũ** | | **2.435.000đ** |

- Vốn ban đầu: **3.000.000đ**.
- Vốn hàng dự kiến: **2.435.000đ**.
- Dự phòng còn lại: **565.000đ** cho cước nhập, ship hỗ trợ, marketing, phát sinh, nhập bù hũ bán chạy.
- **[CẦN XÁC MINH]** Số lượng này đã nhập thực tế chưa? Không đánh dấu hàng “có sẵn” hoặc ghi nhận tồn thật chỉ từ **kế hoạch**.

### 5.2 Nguyên tắc tài chính bất biến

**Doanh thu ≠ lãi gộp ≠ lợi nhuận chia ≠ lợi nhuận ròng dự án ≠ dòng tiền.**

- Doanh thu hàng bán: tiền hàng thực bán sau giảm giá (quy định chính sách ghi nhận riêng các khoản thu/chi ship).
- Giá vốn: theo đơn vị/lô đã xuất; không lấy giá nhập mới để hồi tố đơn cũ.
- Chênh lệch trước chi phí: doanh thu tiền hàng − giá vốn.
- **Lợi nhuận để chia theo đơn:** tổng tiền khách thực trả − giá vốn − **chi phí trực tiếp của đơn**; trong chi phí trực tiếp phải ghi đúng tiền ship/thu hộ để tránh tính hai lần.
- Lợi nhuận ròng dự án: phần còn lại sau tất cả chi phí dự án (bao gồm phân bổ marketing, cước nhập, vận hành, KPI/thưởng, hao hụt, hoàn trả và các khoản phát sinh), đồng thời hạch toán phần chi trả thành viên theo cách nhất quán.
- Dòng tiền: thực thu − thực chi trong kỳ; đơn ghi nhận doanh thu mà khách chưa thanh toán **chưa làm tăng tiền mặt**.
- Không tính đơn hủy vào doanh thu thực hiện. Đơn hoàn/đổi cần chứng từ điều chỉnh cả doanh thu, kho và hoa hồng.
- Không nhập hết tiền mặt thành hàng tồn; theo dõi tiền mặt, tồn kho, công nợ, thời gian quay vòng vốn.

### 5.3 Ví dụ chuẩn để đối chiếu

Hũ 600g niêm yết 199.000đ, giá vốn 140.000đ, **không chi phí phát sinh**: lợi nhuận chia 59.000đ → chủ 60% = **35.400đ**, thành viên 40% = **23.600đ**. 

Nếu người bán giảm giá được duyệt 10.000đ và shop thực chịu 15.000đ ship, khách trả tiền hàng 189.000đ (không thu ship), lợi nhuận chia **34.000đ** → chủ 20.400đ, thành viên 13.600đ. Chỉ là ví dụ; nếu khách trả ship, ghi khoản thu ship và chi ship đúng tài khoản, **không trừ ship hai lần**.

## 6. Team, vai trò và cơ chế hợp tác

- **[ĐÃ CHỐT]** Chủ dự án góp vốn, kiểm soát nguồn hàng/kho chung, quản lý dòng tiền, chịu rủi ro tồn kho, tham gia marketing/vận hành.
- **[HIỆN CÓ]** Dự kiến **4 thành viên hỗ trợ** ngoài chủ, tổng **5 người**. Thành viên hỗ trợ đăng bài, tìm khách, viết nội dung, tư vấn, chốt đơn, giao hàng, chăm sóc khách.
- **[ĐÃ CHỐT]** “Cùng làm – cùng phát triển – cùng hưởng lợi”. Không chia cổ phần trong 2–3 tháng đầu; không mở đại lý; không cho thành viên tự nhập hàng rồi bán lại dưới hệ thống chung; không tồn kho riêng; không tự đặt giá/khuyến mãi.
- **[ĐÃ CHỐT]** Một bảng giá chung, một nguồn/kho chung. Thành viên không được tự giảm giá, tạo combo, freeship, voucher, tăng hoa hồng; mọi chiến dịch cần admin phê duyệt.
- **[ĐÃ CHỐT]** Mỗi đơn cần rõ người chịu trách nhiệm chính, nguồn khách, người giao, thời điểm xác nhận, thanh toán và chi phí liên quan.

### 6.1 Commission 60/40 [ĐÃ CHỐT]

- Với đơn do một thành viên phụ trách từ tìm khách đến chốt/giao theo phân công: **chủ nhận 60% – thành viên nhận 40%** trên **lợi nhuận chia**, KHÔNG phải trên doanh thu.
- Công thức gốc: `profit_share_base = customer_actual_payment - cost_of_goods_sold - direct_order_costs` (chuẩn hóa các khoản thu hộ và ship để tránh trừ trùng).
- Nếu lợi nhuận chia ≤ 0: **không tự phát sinh commission dương**; chính sách xử lý lỗ cần admin duyệt.
- Chi phí giao xa: hỗ trợ xăng/ship hoặc trừ trước khi chia để thành viên không phải tự chịu toàn bộ phí giao xa từ hoa hồng.
- Đơn đã chốt phải lưu `unit_price_snapshot`, `unit_cost_snapshot`, `promotion_snapshot`, `commission_rate_snapshot`, `direct_cost_snapshot`; đổi bảng giá sau này không sửa quá khứ.

### 6.2 Các quyết định còn phải chốt [CẦN XÁC MINH]

1. Commission đủ điều kiện thanh toán ở trạng thái nào? **[ĐỀ XUẤT]** giao xong + thu đủ tiền + đối soát chi phí.
2. Hai thành viên cùng một đơn thì chia phần 40% thế nào? **[ĐỀ XUẤT V1]** một người phụ trách chính; ngoại lệ do admin duyệt.
3. Đơn do chủ tự tìm/chốt có ghi 40% thành viên không? **[ĐỀ XUẤT]** không, thiết kế quy tắc riêng cho đơn chủ phụ trách.
4. Quy trình xử lý trả hàng/hoàn tiền sau khi đã trả hoa hồng? **[ĐỀ XUẤT]** điều chỉnh vào kỳ đối soát sau kèm audit log.
5. Chi phí ship do khách trả, chủ trả hay thành viên ứng hộ được ghi nhận với tài khoản/luồng đối soát nào? Cần một quy tắc thống nhất.

## 7. Giá chung, ship, giảm giá, khuyến mãi

- **[ĐÃ CHỐT]** Ưu tiên khách tự trả ship khi hợp lý; phí ship phải được thông báo trước khi chốt.
- **[ĐÃ CHỐT]** Mọi giảm giá, combo, voucher và freeship phải do admin duyệt và được theo dõi chi phí thật.
- **[ĐỀ XUẤT]** Mỗi chiến dịch có mã, tên, loại (`amount`, `percentage`, `free_shipping`, `bundle` về sau), điều kiện áp dụng, giới hạn chiết khấu, thời gian hiệu lực, giới hạn số lượt/ngân sách, sản phẩm áp dụng, trạng thái duyệt, người tạo/duyệt.
- **[ĐỀ XUẤT V1]** Chỉ hỗ trợ *một ưu đãi cho một đơn* để tránh cộng dồn phức tạp, có thể bổ sung sau khi test.
- **[ĐỀ XUẤT]** Khuyến mãi phải hiển thị **tác động đến lợi nhuận dự kiến** trước khi bật; nếu lợi nhuận không dương, cảnh báo hoặc chặn theo quyền.
- **[ĐỀ XUẤT]** Chiến dịch hết hạn phải dừng chính xác, không chỉ dựa vào xóa cache; lúc chốt đơn luôn kiểm tra hiệu lực khuyến mãi phía server.
- **[CẦN XÁC MINH]** Mức ngân sách/chiết khấu tối đa được phép, chiến dịch có áp dụng đồng thời nhiều đơn từ cùng khách hay không, ai được kích hoạt/hủy giữa chừng.

## 8. Marketing và kênh phân phối

- **[ĐÃ CHỐT]** Giai đoạn hiện tại ưu tiên **Facebook Group địa phương**, chưa tập trung phát triển Fanpage và chưa chạy ads lớn; Fanpage có thể mở về sau.
- Khu vực tìm hội nhóm: TP Thủ Đức/Quận 9, Võ Văn Hát, Lò Lu, Dĩ An, cộng đồng người Quảng Ngãi/miền Trung.
- Nội dung bài: câu chuyện quê nhà, ảnh thật hũ cá/bữa cơm, giá chính xác và khối lượng tịnh, cách đặt hàng, hàng đang có tại TP.HCM nếu thật, feedback thật.
- **[ĐÃ CHỐT]** Không spam hội nhóm, không đăng feedback giả, không tự cam kết HSD hoặc công dụng.
- Nhật ký đăng bài cần có: ngày, giờ, group, thành viên phụ trách, chủ đề, caption, ảnh cần chuẩn bị, trạng thái `Chưa đăng/Đã đăng/Hoãn/Bị từ chối`, kết quả nếu theo dõi được.
- **[ĐÃ CHỐT]** Nếu chạy ads: theo dõi ngân sách, lượt inbox, đơn, doanh thu, chi phí/đơn, tỷ lệ chốt; không tăng chi khi chưa chứng minh hiệu quả.
- **[ĐỀ XUẤT]** Dùng link UTM theo group/chiến dịch; ghi nguồn khách theo lựa chọn chuẩn thay vì tự nhập nhiều tên biến thể. UTM/click Zalo chỉ là **tín hiệu quan tâm**, không đồng nghĩa đơn hàng.

## 9. Dữ liệu đơn hàng, khách hàng và mua lại

**Dữ liệu theo dõi [ĐÃ CHỐT]:** ngày/mã đơn, khách, mã khách/SĐT, khu vực, sản phẩm, số lượng, đơn giá, doanh thu, giá vốn, phí ship thu/chi, giảm giá, chi phí khác, lợi nhuận, 60%/40%, người phụ trách, nguồn khách, trạng thái, khách mới/cũ, feedback, hoàn/hủy, thanh toán.

**[ĐÃ CHỐT]** Xác định khách mua lại bằng **mã khách hoặc SĐT đã chuẩn hóa**, không chỉ dựa vào tên. Phân biệt:
- **Số đơn mua lại:** số đơn hợp lệ của khách mà trước đó đã có ít nhất một đơn hợp lệ.
- **Số khách duy nhất quay lại:** số khách riêng biệt đã có **từ 2 đơn hợp lệ trở lên**.

**[ĐỀ XUẤT]** Đơn nháp/hủy không được tính là lần mua. Xác định thứ tự theo ngày hoàn thành (có tie-breaker ổn định), không theo lúc tạo bản nháp.

**Bảo vệ dữ liệu:** chỉ cho thành viên thấy khách/đơn được giao hoặc thuộc phạm vi cấp quyền; giới hạn xuất CSV, ghi audit log sửa SĐT, không đưa PII vào analytics phía client; sao lưu có kiểm soát truy cập.

## 10. Excel quản lý hiện tại

**[HIỆN CÓ] Excel V5 gồm 5 sheet:**
1. `Dashboard` — KPI và biểu đồ.
2. `Don_hang` — doanh thu, giá vốn, chi phí, lợi nhuận và 60/40.
3. `Group_khach_hang` — danh sách group (bao gồm khu vực gần nhà).
4. `Nhat_ky_dang_bai` — timeline/caption/đăng bài.
5. `Cai_dat` — giá, SKU, thành viên, danh mục dùng cho dropdown.

**Ưu tiên:** ít sheet, không nhập trùng, dropdown nhất quán, công thức rõ, dashboard trực quan, không tính đơn hủy. Khi sửa file phải QC công thức, dropdown, biểu đồ và dữ liệu mẫu; **không nói đã QC nếu chưa kiểm thử**.

**Vai trò trong chuyển đổi:** Excel là nguồn đối chiếu/backup khi hệ thống web chưa ổn định. **[ĐỀ XUẤT]** Sau khi backend xong, nhập dữ liệu sạch một lần (mapping SKU, mã khách, trạng thái, nhân viên), chạy song song ngắn hạn, xác nhận số lượng/tiền trước khi chuyển nguồn chính; hỗ trợ xuất Excel/CSV từ Dashboard.

## 11. Website khách hàng — hiện trạng và định hướng

- **[ĐÃ CHỐT]** Website Next.js đã được triển khai trên Vercel: **https://ca-bong-song-tra.vercel.app/**.
- **[ĐÃ CHỐT]** Phong cách UI: **A — hiện đại tối giản**, sáng, khoảng trắng thoáng, typography dễ đọc, ưu tiên ảnh sản phẩm thật và responsive/mobile-first.
- **[ĐÃ CHỐT]** Trang công khai chủ yếu **ảnh + thông tin + nút Zalo**, không có checkout/giỏ hàng tại V1.
- **[ĐÃ CHỐT THEO THẢO LUẬN]** Không thích icon con cá generic ở Header; hướng khuyến nghị là bỏ icon cá, sử dụng wordmark “Cá Bống Sông Trà” và dòng “Đặc sản Quảng Ngãi”; favicon có thể dùng chữ `ST`. Nếu code hiện tại chưa cập nhật, cần kiểm tra và sửa có kiểm thử.
- **[HIỆN CÓ]** Nội dung định hướng: Hero, 3 card sản phẩm, câu chuyện Sông Trà, hướng dẫn đặt hàng, FAQ/bảo quản có căn cứ, liên hệ và nút Zalo nổi.
- **[ĐÃ XÁC MINH SOURCE LOCAL]** Source dùng Next.js 15.5.27 khi build, React 19.1.x, App Router; typecheck/build pass ngày 09/10/2026. Số/link Zalo và ảnh production vẫn phải được owner xác nhận trước go-live.
- **[CẦN XÁC MINH]** Nội dung quy cách/hạn bảo quản trên website đang chạy; nếu trái với mục 3/4 phải ưu tiên sửa.

### 11.1 Ranh giới nội dung public

Có thể hiển thị: tên thương hiệu, câu chuyện, ảnh chính xác, trọng lượng tịnh đúng nhãn, giá hiện hành, chương trình được duyệt, FAQ theo thông tin đã xác minh, Zalo, khu vực phục vụ, chính sách rõ ràng.

**Không** hiển thị: giá nhập, lợi nhuận, tỷ lệ hoa hồng nội bộ, dữ liệu kho theo lô có yếu tố nhạy cảm, thông tin thành viên/khách, doanh số cá nhân, báo cáo và token dịch vụ.

## 12. Lý do phát triển Backend/Admin

Chủ dự án muốn **thao tác dễ hơn Excel**, có **chiến dịch khuyến mãi** và tác động lợi nhuận tự động, **quản lý kho dễ hơn**, đồng thời **không cần sửa code mỗi khi chỉnh giá, mô tả, ảnh và ưu đãi**. Website khách vẫn phải tải nhanh.

**[ĐỀ XUẤT ĐƯỢC ƯU TIÊN]** Một repo Next.js, hai khu vực:
- `/` — storefront công khai, render/cache tối ưu, Zalo CTA.
- `/login`, `/admin/*` — app nội bộ có xác thực, phân quyền và dữ liệu động.
- Dữ liệu chung trong **Supabase PostgreSQL**, Auth và Storage nếu thực sự cần.
- Backend qua Next.js Server Actions/Route Handlers và **database functions/transactions** cho thao tác tiền/kho nhạy cảm.
- Không tách NestJS/Express/microservice ở giai đoạn này, trừ khi yêu cầu thật chứng minh cần thiết.

**[ĐỀ XUẤT]** Thư mục tổng quát:

```text
app/
  (store)/page.tsx
  (auth)/login/page.tsx
  admin/{page.tsx,products,inventory,orders,promotions,customers,team,kpi,...}
  api/...
components/{store,admin,ui}/
lib/{supabase,auth,services,validations,permissions,cache}/
data/ (chỉ seed/static không nhạy cảm)
supabase/{migrations,seed.sql,functions}/
tests/{unit,integration,e2e}/
docs/
```

**Quy tắc kiến trúc:** UI không tự quyết giá/chiết khấu/hoa hồng/được bán hay không; server/database mới là nơi kiểm tra quyền, đối chiếu tồn, tính toán và commit dữ liệu.

## 13. Module quản trị V1 và scope chi tiết

### 13.1 Authentication & phân quyền

- **[ĐỀ XUẤT]** Supabase Auth; tài khoản nội bộ được admin mời, không mở self-register công khai.
- Role tối thiểu: `owner_admin`, `member`. Nếu sau này có người chỉ giao hàng hoặc quản kho, thêm role khi thật cần.
- Admin: CRUD sản phẩm, giá, khuyến mãi, nhập kho, xem tất cả đơn và đối soát/chi trả.
- Member: tạo đơn và sửa đơn trong phạm vi cho phép, tra cứu sản phẩm/tồn **khả dụng tổng hợp**, xem KPI/commission **của mình**; không sửa giá vốn/giá chung/cấu hình chia.
- Bảo vệ **từng mutation**, không chỉ ẩn menu; kết hợp RLS và kiểm tra server, chống IDOR.
- Tất cả cập nhật giá, duyệt khuyến mãi, nhập kho, hoàn tiền, sửa commission phải lưu audit log.

### 13.2 Products & Pricing

- Admin chỉnh tên, mô tả public, ảnh, tình trạng hiển thị, giá niêm yết, nhãn trạng thái bán được.
- SKU ổn định theo 300/400/600g; khối lượng tịnh phải đúng và không lẫn với khối lượng riêng của cá.
- Giá có `effective_from`, `effective_to` nếu cần lịch sử; đơn chốt lưu snapshot.
- Kiểm tra đầu vào: giá không âm, SKU không trùng, không được xóa sản phẩm đã xuất hiện trong đơn; chỉ soft-disable.
- Khi cập nhật: cache public được invalidation đúng phạm vi; nếu hỏng đồng bộ, không hiện giá thiếu kiểm chứng.

### 13.3 Inventory

- Không thiết kế tồn kho như chỉ một trường `quantity` dễ bị sửa tùy tiện.
- Lô nhập; nhật ký biến động (`receipt`, `reserve`, `release`, `fulfill`, `return_to_sellable`, `damage`, `adjustment`); tính tồn vật lý, tồn đang giữ, tồn khả dụng.
- **[ĐỀ XUẤT]** Đơn nháp không giữ hàng; khi admin/member xác nhận với khách → giữ hàng trong transaction có khóa/concurrency control; đơn hủy → release; hoàn tất → xuất kho; hoàn → chỉ nhập lại khi kiểm tra hàng còn bán được.
- **[CẦN CHỐT]** Thời điểm giữ kho, thời gian hết hạn giữ chỗ, giao hàng/thu tiền và quy trình hàng hoàn.
- Hệ thống phải ngăn hai người cùng giữ một hũ cuối; sử dụng transaction atomic, không chỉ kiểm tra số tồn trên UI.
- Theo dõi hạn từng lô, không xuất lô hết hạn, báo cáo chênh lệch giữa kiểm kê và số liệu.
- Cước nhập phân bổ vào cost of goods sold nếu phương pháp kế toán được chốt; cần thống nhất để không tính trùng với chi phí toàn dự án.

### 13.4 Orders & Customers

- Đơn có mã duy nhất, khách (mã/SĐT), người phụ trách, nguồn, địa chỉ/khu vực, dòng sản phẩm, số lượng, snapshot giá, chương trình áp dụng, ship thu/chi, chi phí khác, thanh toán, trạng thái, ghi chú, feedback.
- **[ĐỀ XUẤT]** Lifecycle: `draft` → `confirmed` (reserve) → `delivering` → `completed` (giao xong) hoặc `cancelled`; nhánh `returned/refunded` có điều chỉnh.
- Payment status **riêng** (`unpaid`, `partially_paid`, `paid`, `refunded`), không đánh đồng giao xong với đã thu tiền.
- Server kiểm tra giá/ưu đãi/tồn lần cuối trước confirm; khách được thông báo tổng tiền chính xác.
- Idempotency key cho tạo đơn và thao tác đổi trạng thái, tránh bấm hai lần sinh hai đơn/xuất hai lần.
- Không sửa ngược số liệu tài chính bằng cách ghi đè mất lịch sử; dùng adjustments có ghi nguyên nhân và người duyệt.

### 13.5 Promotions

- Tên/mã, thời gian theo múi giờ VN, loại giảm, mức giảm, giới hạn, phạm vi SKU, quota, trạng thái, audit/approver.
- Mỗi lần áp dụng đều kiểm tra thời gian, điều kiện, quota và ngân sách trên server.
- Chương trình áp dụng cho đơn chốt thì được snapshot; tắt chương trình không tự sửa đơn đã chốt.
- Admin xem simulation: giá sau giảm, chi phí trực tiếp dự kiến, phần chia 60/40, tác động ngân sách và khả năng âm lợi nhuận.
- Phải có thủ tục vô hiệu hóa khuyến mãi ngay khi có lỗi.

### 13.6 Finance, Commission, Reconciliation

- Module lợi nhuận chia phải dùng dữ liệu snapshot đã xác nhận; ghi tách ship khách trả, ship shop chịu, ship thành viên ứng và công nợ hoàn lại.
- **[ĐỀ XUẤT]** Commission states: `pending` → `eligible` → `approved` → `paid`, cộng `reversed/adjusted` khi hoàn/hủy/sửa chi phí.
- Báo cáo theo chu kỳ ngày/tuần/tháng; không ghi commission dương cho đơn không có lợi nhuận chia dương.
- KPI theo người, nhưng **lợi nhuận dự án** và **dòng tiền** là chỉ tiêu khác phần chia cho chủ.
- Có lịch sử phê duyệt/chốt kỳ, tránh người dùng sửa số đã trả mà không tạo bản điều chỉnh.

### 13.7 Marketing/Group module

- Có thể đưa danh sách group và nhật ký đăng bài từ Excel lên Dashboard ở **đợt sau** khi core vận hành đã ổn.
- **[ĐỀ XUẤT V1]** Để nguồn khách là dropdown và UTM; module content calendar chỉ làm nếu thực sự tiết kiệm thao tác so với Excel.

## 14. KPI từng thành viên: định nghĩa, công thức, công bằng

**[ĐÃ CHỐT]** Có thể theo dõi ngưỡng tham khảo **10/20/30/50 hũ/tháng**, nhưng **chưa chốt thưởng tiền**. KPI phải dựa trên số liệu thật, không phát sinh thưởng tự động nếu chưa có quy tắc được phê duyệt.

**Bộ chỉ số đề xuất:**

| KPI | Cách tính/ý nghĩa | Ghi chú |
|---|---|---|
| Đơn hoàn thành | Đếm đơn `completed` đủ điều kiện ghi nhận | Loại hủy, điều chỉnh hoàn |
| Hũ bán ròng | Tổng số lượng đã hoàn thành − số lượng hoàn trả hợp lệ | Không dùng đơn nháp |
| Doanh thu bán ròng | Doanh thu các đơn đủ điều kiện − hoàn/giảm điều chỉnh | Phân tách ship |
| Lợi nhuận chia do member tạo | Tổng `profit_share_base` từ đơn đủ điều kiện | Không bằng lợi nhuận ròng dự án |
| Commission đủ điều kiện | Tổng phần 40% đã đối soát, trước thanh toán | Cần audit |
| Commission đã trả | Tổng khoản thực chi cho member | Khác khoản phải trả |
| Số khách mới | Khách có đơn hợp lệ đầu tiên được quy cho member theo rule | Chốt attribution |
| Số đơn từ khách quay lại | Đơn hợp lệ của khách đã mua trước đó | Không trùng số khách |
| Số khách duy nhất quay lại | Số customer_id có ít nhất 2 đơn hợp lệ | Không dùng tên làm khóa |
| Lead/Inboxes | Số lượt liên hệ *thực ghi nhận* | Không tự suy ra từ website click |
| Tỷ lệ chốt | Đơn đủ điều kiện / lead đủ điều kiện | Chỉ tính nếu ghi lead đầy đủ |
| Ship/cost trung bình | Tổng chi phí giao/đơn có số liệu / số đơn tương ứng | Phân biệt công trả ship |
| Đơn hủy/hoàn | Số và tỷ lệ đơn hủy/hoàn | Theo nguyên nhân, không kết luận lỗi cá nhân ngay |
| Bài đăng/hiệu quả nguồn | Số bài đăng, đơn từ nguồn | Chỉ đo khi track có căn cứ |

**KPI công bằng:**
- Không xếp hạng cứng chỉ theo doanh thu hay số hũ; người chạy đơn xa, đơn lớn/nhỏ và nguồn lead khác nhau.
- Đơn do chủ tự chốt hoặc có hai người phối hợp phải có rule attribution minh bạch.
- Báo cáo cá nhân nên có thời gian, số ngày hoạt động và loại công việc (tìm khách/chốt/giao), nhưng chưa mặc định KPI thưởng.
- Khi mới có vài chục đơn, chỉ báo cáo mô tả; **không dùng tỷ lệ chốt nhỏ mẫu để đánh giá năng lực chắc chắn**.
- Quản lý KPI không có nghĩa là chia cổ phần. Không tạo chế độ thưởng/đại lý mới khi chưa có duyệt.

## 15. Performance, UX và trải nghiệm mua hàng

**[ĐÃ CHỐT]** Ưu tiên hiệu suất tải nhanh, mobile-first, đơn giản và chi phí thấp.

**[ĐỀ XUẤT KIẾN TRÚC]:**
- Public site dùng Server Components mặc định, HTML/static hoặc cache cho dữ liệu ít đổi, phục vụ qua CDN; không yêu cầu client tải toàn bộ app quản trị.
- Admin area dynamic, có phân quyền; tách bundle route admin khỏi storefront.
- Cache dữ liệu public `products`, giá, nội dung phù hợp. Invalidate khi Admin chỉnh và giải quyết riêng **mốc thời gian khuyến mãi**. Tồn kho chuẩn và thanh toán **không quyết định dựa trên cache công khai**.
- Chốt đơn/server mutation đọc và kiểm tra lại giá, ưu đãi, tồn hiện hành trong transaction. Kịch bản public hiển thị giá cũ phải có chiến lược đồng bộ/ứng xử minh bạch.
- Ảnh thật đã tối ưu WebP/AVIF, `next/image`, xác định kích thước tránh CLS, preload/priority ảnh Hero hợp lý, lazy load phần dưới; không nén gây sai hình sản phẩm.
- Font tải tối ưu, hạn chế animation nặng, thư viện client không cần thiết, chat widget JS ngoài, tracking bên thứ ba.
- Dùng skeleton/loading state cho dashboard; thông báo thao tác thành công/thất bại rõ ràng; form nhập đơn có validation, lựa chọn gợi ý, thao tác tốt bằng một tay trên điện thoại.
- Chỉnh thông tin sản phẩm/giá/khuyến mãi trong Dashboard **không buộc deploy lại code**.

**Mục tiêu hiệu năng (TARGET, KHÔNG PHẢI SỐ ĐÃ ĐO):** LCP ≤ 2,5s; INP ≤ 200ms; CLS ≤ 0,1 cho phần lớn lượt truy cập thực tế (ngưỡng Core Web Vitals phù hợp) và mục tiêu Lighthouse Mobile ≥ 90 trong điều kiện thử có kiểm soát. Đo thực tế bằng lab + RUM, thiết bị yếu và mạng di động; không tuyên bố đạt nếu chưa đo.

**UX khách hàng:** thông tin 3 size rõ, **khối lượng tịnh chính xác**, giá, liên hệ Zalo trong tầm tay, không popup cản màn hình, CTA theo sản phẩm, FAQ ngắn, không hiển thị hàng có sẵn nếu thực tế không đủ.

**UX team:** tạo đơn nhanh trên điện thoại, ít trường nhập thừa, tự điền giá/giá vốn từ server, xem tồn khả dụng, lọc đơn của tôi, xác nhận quan trọng có cảnh báo, lịch sử thao tác dễ tra cứu. Admin cần bộ lọc ngày/nhân viên/kho/SKU, đối soát và xuất dữ liệu.

## 16. Bảo mật, DDoS, rate limit và chống gian lận

### 16.1 Threat model cơ bản

- Lưu lượng bot hoặc DDoS làm nghẽn web.
- Brute-force đăng nhập, đánh cắp session, spam form/API.
- Người dùng thường xem/sửa đơn của thành viên khác (IDOR), lộ giá vốn/PII.
- Gửi request trùng tạo đơn/xuất kho/khuyến mãi nhiều lần.
- User nhập giá/chi phí âm hoặc giả mạo commission.
- Rò secrets, lộ token service role lên browser/bundle/log.
- SQL injection/XSS/CSRF/SSRF qua đầu vào và upload.
- Lỗi kho/race condition dưới thao tác đồng thời.

### 16.2 Kiểm soát khuyến nghị

1. **Edge/provider protection:** tận dụng lớp DDoS nền tảng của hosting; kiểm tra chính sách WAF/rate limit **thực sự có trong gói đang dùng**, không giả định miễn phí mọi tính năng.
2. **App rate limiting:** login/OTP, upload, thao tác tạo đơn, áp mã giảm giá, tìm kiếm khách, export; khóa theo tổ hợp tài khoản/IP/endpoint (có giới hạn tránh chặn nhầm mạng chung). Nếu cần shared limiter trên serverless, dùng data store phân tán phù hợp; **không dựa hoàn toàn vào in-memory limiter**.
3. **Supabase Auth/RLS:** private-by-default cho bảng đơn, khách, giá vốn, kho, KPI; chức năng nội bộ kiểm role cả server-side; account member không tự nâng role.
4. **Transactions + constraints:** unique request id/idempotency, FK, CHECK giá/số lượng hợp lệ, ACID cho reserve/fulfill/rollback.
5. **Validation:** xác thực payload ở biên bằng schema; chống mass assignment, giới hạn kích thước, file type, số lượng record tải xuống.
6. **Session/secrets:** cookies hợp lý, rotate credentials, tách `NEXT_PUBLIC_*` và secret, không gửi service role key xuống frontend.
7. **Logging/alerts:** event bảo mật, login thất bại, thay giá, đổi tồn, cấp quyền, chi hoa hồng; mask PII, tránh log secrets.
8. **Backups/restore:** backup có kiểm thử phục hồi, không chỉ có nút Export; audit thay đổi quan trọng.
9. **Third-party:** hạn chế dependencies, quét lỗ hổng, cập nhật bảo mật, review cấu hình CSP/headers, kiểm soát upload.
10. **Fallback:** khi DB lỗi, website public vẫn hiển thị nội dung cache phù hợp hoặc trạng thái liên hệ Zalo; không hiển thị giá chưa chắc chắn như giá có hiệu lực nếu không xác thực được.

**Không có giải pháp nào bảo đảm “chống DDoS 100%”.** Mục tiêu là nhiều lớp giảm thiểu và khả năng khôi phục; test riêng năng lực hosting, quota và chi phí phát sinh.

## 17. Hosting và trạng thái deploy

- **[ĐÃ CHỐT]** Frontend Next.js **đang deploy được trên Vercel Free/Hobby**: https://ca-bong-song-tra.vercel.app/.
- **[ĐÃ ĐƯỢC CẢNH BÁO]** Vercel Hobby có giới hạn mục đích sử dụng theo điều khoản nhà cung cấp; **không mặc định việc deploy thành công đồng nghĩa có quyền sử dụng thương mại**. Khi kinh doanh thực tế cần tự kiểm tra điều khoản/gói hiện hành và chọn phương án phù hợp, tránh xây hệ thống phụ thuộc một giả định pháp lý sai.
- **[ĐỀ XUẤT]** Ưu tiên giữ Vercel để phát triển Next.js hiện tại; kết nối Supabase. Nếu ngân sách hosting thương mại không hợp lý, đánh giá Cloudflare Workers hoặc giải pháp khác **sau bài test tương thích/chi phí**, không di chuyển vì cảm tính.
- **[HIỆN CÓ]** Repository local và Git remote `https://github.com/hoaibao1102/CaBongSongTra.git` đã được nhận diện; remote không public khi kiểm tra ẩn danh. **[CẦN XÁC MINH]** quyền truy cập GitHub/Vercel, environment variables, domain, analytics, gói thực tế, Supabase region và chính sách backup/khôi phục.

**Environment deploy đề xuất:** local, preview/staging, production; secrets tách môi trường; migrations phải review; không auto chạy destructive migration vào production.

## 18. Database model đề xuất (chưa phải migration cuối)

| Bảng | Mục đích | Lưu ý bất biến |
|---|---|---|
| `profiles` | User và role | Không để user tự đổi role |
| `products` | Danh mục 3 SKU | Net weight chuẩn, không xóa lịch sử |
| `product_prices` | Lịch sử giá | Thời điểm hiệu lực |
| `inventory_batches` | Lô, HSD, giá nhập | Lưu source/chứng từ |
| `inventory_ledger` | Nhật ký biến động kho | Append-only/điều chỉnh có audit |
| `stock_reservations` | Giữ hàng cho đơn | Không cho reserve vượt tồn |
| `customers` | Khách/mã/SĐT | Chuẩn hóa SĐT, phân quyền |
| `orders` | Header đơn, trạng thái, thu/chi | Idempotency và snapshot |
| `order_items` | Dòng SKU/số lượng/giá | Snapshot giá/vốn |
| `payments` | Lịch sử thu/hoàn | Đối soát tiền thật |
| `order_costs` | Ship, hỗ trợ, chi khác | Không trừ trùng |
| `promotions` | Campaign, rule, ngân sách | Kiểm hiệu lực server |
| `promotion_redemptions` | Lượt dùng có chứng từ | Quota atomic |
| `commission_records` | Khoản chia 60/40 | Điều chỉnh thay vì ghi đè |
| `kpi_periods` / `kpi_results` | Báo cáo KPI | P0b; dựa trên đơn hợp lệ |
| `audit_logs` | Ai sửa gì, lúc nào | Không lộ thông tin bí mật |
| `marketing_groups` | Hội nhóm nguồn khách | Có thể triển khai sau |
| `posting_log` | Nhật ký đăng bài | Có thể triển khai sau |

**[ĐỀ XUẤT]** Tiền dùng VND integer (`bigint` khi cần), không dùng floating point cho tiền hoặc áp dụng tỷ lệ mà không có rule làm tròn. Timestamps lưu UTC, hiển thị Asia/Ho_Chi_Minh; ID bất biến. `commission_rate` lưu snapshot (60/40) để thay chính sách sau này không đổi lịch sử. Đặt index theo ngày, trạng thái, người phụ trách, khách, SKU/lô và unique order number.

## 19. Trạng thái dữ liệu, giao dịch và tính đúng

**Nguyên tắc hệ thống:**
- Các thay đổi về kho và đơn là **atomic**: chỉ ghi nhận thành công khi tất cả bước liên quan thành công.
- Confirm đơn phải đảm bảo **không oversell**; nếu không đủ hàng trả lỗi dễ hiểu, không âm kho.
- Thanh toán có thể nhiều lần; dòng tiền không suy từ `status=completed`.
- Tồn kho/hạn dùng không được tính dựa trên hình ảnh/chữ trên web công khai.
- Khuyến mãi phải được áp dụng theo rule và timestamp tại lúc chốt; không tin giá client gửi lên.
- Các đơn thành công sau đó hoàn/trả cần nghiệp vụ bù trừ tiền, kho, commission, KPI.
- Không xóa giao dịch đã xảy ra để làm “sạch” báo cáo; dùng reversal/adjustment.

**Các case kiểm thử bắt buộc:**
1. Hai member cùng đặt hũ cuối → đúng một reservation thành công.
2. Nhấn “Tạo đơn” hai lần / retry request → chỉ một đơn được tạo.
3. Admin đổi giá sau khi đơn đã xác nhận → đơn cũ giữ giá snapshot.
4. Khuyến mãi hết hạn đúng lúc chốt → server từ chối áp dụng nếu hết hiệu lực.
5. Member tự truyền giá âm/tăng quyền trong request → bị chặn.
6. Đơn giao thành công nhưng chưa thu tiền → không chi hoa hồng sớm theo chính sách.
7. Hoàn một phần đơn nhiều SKU → điều chỉnh đúng kho, doanh thu, commission.
8. Chi phí ship khách trả vs shop hỗ trợ → không tính trùng.
9. Lô hết hạn → không được xuất cho đơn.
10. Export dữ liệu member → chỉ phạm vi được phép.

## 20. Quan sát, backup, QA và vận hành

- **[ĐỀ XUẤT]** Monitor availability, page performance, JS errors, server errors, latency truy vấn, số lần login thất bại/rate-limited, API errors.
- Logs request có correlation ID nhưng không có SĐT nguyên vẹn/token/PII dư thừa.
- Xuất định kỳ snapshot đơn, kho, khách, commission; **backup Postgres** và kiểm thử restore (đặc biệt khi dùng free tier).
- Quy trình review hằng ngày: đơn chưa hoàn thành, tiền chưa thu, tồn thấp/gần HSD, phát sinh ship, đơn lỗi, khách cần chăm sóc.
- Quy trình review hằng tuần: đối soát tiền, chênh kho, hiệu quả group và thành viên, lợi nhuận thực, refund/hủy.
- Quy trình review 2–3 tháng: vòng quay vốn, % tồn, mua lại, lợi nhuận ròng, quyết định nhập thêm hay thay kênh.

**QA gates trước go-live:** unit tests công thức tài chính; integration tests mutation kho/đơn; E2E hành trình đăng nhập, tạo/xác nhận/hoàn đơn; quyền member/admin; mobile UX; audit logs; restore dữ liệu; kiểm tra Lighthouse & Web Vitals; dự phòng rollback khi schema/deploy lỗi. Không tuyên bố QC hoàn tất khi chưa chạy test thực tế.

## 21. Lộ trình ưu tiên phát triển thực tế

| Giai đoạn | Phạm vi | Điều kiện hoàn tất |
|---|---|---|
| 0. Audit & business rules | Rà source đang chạy, xác minh nhãn, giá, số điện thoại Zalo, quy tắc kho/hoa hồng | Không còn mâu thuẫn dữ liệu quan trọng |
| 1. Auth & data foundation | Supabase project, migrations, RLS, auth 5 user, admin shell | Member không truy cập dữ liệu cấm |
| 2. Products & Inventory | Quản trị sản phẩm/giá, lô nhập/xuất, tồn khả dụng | Race condition test không oversell |
| 3. Orders & Finance | Tạo đơn, trạng thái, khách, chi phí, công thức 60/40, đối soát | Đối chiếu đơn mẫu với Excel |
| 4. Promotions & KPI | Chiến dịch, hiệu lực thời gian, KPI member, báo cáo | Kết quả tính đúng, không âm commission tự động |
| 5. Public Sync & Performance | Giá/nội dung từ DB qua cache; SEO/ảnh/CTA | Site nhanh, admin đổi giá không cần deploy |
| 6. Security & Go-live | Rate limit, backup, audit, E2E, monitoring, rollback | Nghiệm thu và chuyển dữ liệu có kiểm soát |

**[ĐỀ XUẤT THỰC DỤNG]** Có thể gộp tiến độ, nhưng **không bỏ test tài chính/kho/quyền** để ra mắt nhanh. Giữ Excel làm đối chiếu giai đoạn đầu. Đừng chờ xây hết Marketing CRM/ads rồi mới dùng quản lý đơn.

## 22. Decision baseline và thay đổi nghiệp vụ

Toàn bộ câu hỏi Q01–Q23 trước đây đã được hợp nhất vào `DOCS_DECISION_LOG.md`. Tài liệu này không còn tự duy trì ID quyết định để tránh cùng một mã mang hai nghĩa.

- Quyết định chặn implementation phải có trạng thái `APPROVED` trước khi mở task liên quan.
- Quyết định chỉ chặn go-live như ảnh nhãn, tồn vật lý, Zalo và hosting có thể song song triển khai bằng dữ liệu staging, nhưng không được giả lập thành dữ liệu production.
- Khi owner thay đổi một quyết định, phải cập nhật Decision Log, Data Dictionary, API contract, acceptance criteria và test liên quan trong cùng pull request.

## 23. Nguyên tắc tư vấn và hành vi bắt buộc cho AI/developer

1. **Phản biện độc lập**, không mặc định tán thành đề xuất của chủ dự án; chỉ ra rủi ro, nguyên nhân, số liệu, lựa chọn thay thế và kết luận rõ.
2. Không trình bày giả định như sự thật; dùng trạng thái **ĐÃ CHỐT / ĐỀ XUẤT / CẦN XÁC MINH**.
3. **Tiền, kho, hoa hồng, dữ liệu khách và phân quyền phải chính xác trước hiệu ứng UI.**
4. **300/400/600g là khối lượng tịnh của cá và nước kho, KHÔNG gồm bao bì.** Không dùng quy cách cũ.
5. Không tự khẳng định hạn sử dụng, thành phần/chứng nhận, số cá riêng, chất lượng hay công dụng chưa có căn cứ.
6. Không tự cho thành viên mở đại lý, có kho riêng hoặc tự tạo giá/khuyến mãi.
7. Commission 60/40 tính trên lợi nhuận chia theo đơn, **không phải doanh thu**.
8. Không đánh đồng lợi nhuận chia theo đơn với lợi nhuận ròng dự án; không đánh đồng ghi nhận doanh thu với tiền thực thu.
9. Không tính đơn hủy vào doanh thu; không chia hoa hồng dương tự động cho đơn hòa vốn/lỗ.
10. Dùng ID/SĐT chuẩn hóa để nhận diện khách cũ, không lấy tên làm khóa duy nhất.
11. Website public phải mobile-first và nhanh; dashboard private phải chính xác, dễ nhập, có audit và hạn chế quyền.
12. Không over-engineer: một Next.js app và Supabase đủ dùng ở V1 nếu được thiết kế đúng.
13. Ưu tiên ảnh thật, phản hồi thật và bài Group không spam; chưa chạy ads lớn.
14. Kiểm tra luật/quy định/điều khoản dịch vụ/thị trường theo nguồn **mới nhất** trước khi đưa ra kết luận pháp lý/giá/hosting.
15. Không nói build, QA, bảo mật, backup hay tốc độ “đã đạt” nếu chưa chạy kiểm thử và có bằng chứng.
16. Khi chỉnh code hoặc Excel, ưu tiên **không làm mất dữ liệu cũ**, backup trước migration và có đường rollback.
17. Công khai mức chi phí vận hành có rủi ro và giới hạn các free tier; không xem hạ tầng miễn phí là bảo đảm vô thời hạn.
18. Không đưa bí mật, service-role key, token, dữ liệu PII, giá vốn, commission nội bộ vào client bundles hoặc log public.
19. Hỏi những quyết định thiếu ảnh hưởng trực tiếp đến database hoặc tiền, nhưng **không tự tạo công việc thừa**; chốt default có ghi nhãn khi phù hợp.
20. Thứ tự ưu tiên kinh doanh: **bán được → khách thấy ngon → khách quay lại → team bán đều → vốn quay vòng → lợi nhuận thực → mới scale**.

## 24. Mẫu handoff để tiếp tục công việc ở cuộc trò chuyện mới

> Tôi đang phát triển dự án kinh doanh cá bống Sông Trà Quảng Ngãi tại TP Thủ Đức, vốn khởi điểm 3 triệu, team dự kiến 5 người. Hãy đọc toàn bộ `PROJECT_CONTEXT_CA_BONG_SONG_TRA_FULL.md` làm nguồn ngữ cảnh và `KE_HOACH_FULLSTACK_CA_BONG_SONG_TRA_V1.md` làm lộ trình kỹ thuật. Website Next.js hiện deploy tại https://ca-bong-song-tra.vercel.app/. Muốn giữ storefront nhanh, xây admin/backoffice dùng chung dữ liệu Supabase để quản lý sản phẩm, giá, tồn theo lô, đơn hàng, khuyến mãi, lợi nhuận chia 60/40 và KPI nhân viên. Ưu tiên tính chính xác tài chính/kho, bảo mật, mobile UX, chi phí thấp. Phân biệt dữ kiện đã chốt, đề xuất và điểm cần xác minh. **Sản phẩm có khối lượng tịnh 300g/400g/600g gồm cá và nước kho, không gồm hũ/bao bì.** Không sử dụng thông số 250/300/500g. Bắt đầu bằng audit repository/schema, chốt các câu hỏi tác động dữ liệu, sau đó triển khai theo milestone có test và rollback. Không khẳng định đã QC khi chưa kiểm thử.

## 25. Changelog và mâu thuẫn đã giải quyết

- **09/10/2026:** Tạo file ngữ cảnh đầy đủ để handoff.
- **Cập nhật trọng lượng quan trọng:** 300/400/600g là **khối lượng tịnh của cá và nước kho**. Mọi mô tả trước đó gọi đây là khối lượng *cả hũ* hoặc khẳng định 250/300/500g là quy cách hiện hành đều **không còn đúng với dữ kiện mới nhất**.
- **Website:** đã có Next.js storefront deploy Vercel; không xây lại từ đầu nếu không có lý do kỹ thuật.
- **Kiến trúc:** source local Next.js đã được kiểm tra và build thành công; Next.js + Supabase trong một repo là baseline P0a. Chưa có Supabase/admin và chưa có kết quả Lighthouse/RUM production.
- **Scope:** nhu cầu admin trở nên thiết thực vì cần quản lý giá/khuyến mãi/kho và team dễ nhập đơn; vẫn triển khai nhỏ, đo hiệu quả và giữ backup Excel.

---

**Kết luận nguồn ngữ cảnh:** Đây là một dự án kinh doanh nhỏ đang kiểm chứng thị trường; công nghệ chỉ có ý nghĩa nếu làm giảm sai sót, tiết kiệm thời gian vận hành, bảo vệ vốn và giúp ra quyết định bằng dữ liệu. Không chạy theo độ phức tạp. Mọi thứ liên quan **số tiền, khối lượng, HSD, tồn kho và trách nhiệm** phải có nguồn xác nhận và lịch sử kiểm tra được.
