/**
 * Vietnamese Contract Templates
 * Mẫu hợp đồng chuẩn pháp lý Việt Nam
 */

export interface ContractTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  icon: string; // Lucide icon name
  color: string; // Tailwind color
  content: string; // HTML content
  signers: Array<{
    role: string;
    defaultName?: string;
  }>;
}

export const CONTRACT_TEMPLATES: ContractTemplate[] = [
  {
    id: 'blank',
    name: 'Văn bản trống',
    category: 'Khác',
    description: 'Bắt đầu từ trang giấy trắng',
    icon: 'FileText',
    color: 'gray',
    content: '<p><br></p>',
    signers: [
      { role: 'Bên A' },
      { role: 'Bên B' },
    ],
  },
  {
    id: 'money-receipt',
    name: 'Giấy biên nhận tiền',
    category: 'Tài chính',
    description: 'Biên lai nhận tiền cơ bản',
    icon: 'Receipt',
    color: 'green',
    content: `<p style="margin-bottom: 16px;">Tôi đã nhận của:</p>

<p><strong>Họ và tên người gửi:</strong> ...................................................................</p>
<p><strong>Đơn vị/Địa chỉ:</strong> ...................................................................</p>
<p><strong>Số CMND/CCCD:</strong> .......................... Nơi cấp: ..........................</p>

<p style="margin-top: 20px;"><strong>Số tiền:</strong> .......................... VNĐ</p>
<p><strong>Bằng chữ:</strong> ...................................................................</p>

<p style="margin-top: 20px;"><strong>Lý do nộp:</strong> ...................................................................</p>

<p style="margin-top: 20px;">Tôi làm giấy biên nhận này để làm bằng chứng.</p>`,
    signers: [
      { role: 'Người nhận tiền', defaultName: '' },
      { role: 'Người gửi tiền', defaultName: '' },
    ],
  },
  {
    id: 'labor-contract',
    name: 'Hợp đồng lao động',
    category: 'Lao động',
    description: 'Hợp đồng lao động có thời hạn/không thời hạn',
    icon: 'Briefcase',
    color: 'blue',
    content: `<p style="margin-bottom: 16px;">Chúng tôi gồm:</p>

<p style="font-weight: bold; margin-top: 24px;">BÊN A: NGƯỜI SỬ DỤNG LAO ĐỘNG</p>
<p>Tên công ty/tổ chức: ...................................................................</p>
<p>Địa chỉ: ...................................................................</p>
<p>Điện thoại: .......................... MST: ..........................</p>
<p>Người đại diện: .......................... Chức vụ: ..........................</p>

<p style="font-weight: bold; margin-top: 24px;">BÊN B: NGƯỜI LAO ĐỘNG</p>
<p>Họ và tên: ...................................................................</p>
<p>Sinh ngày: ......./......./....... Giới tính: ............</p>
<p>CMND/CCCD số: .......................... Ngày cấp: ......./......./....... Nơi cấp: ..........................</p>
<p>Địa chỉ thường trú: ...................................................................</p>
<p>Nơi ở hiện nay: ...................................................................</p>
<p>Điện thoại: .......................... Email: ..........................</p>

<p style="font-weight: bold; margin-top: 24px;">HAI BÊN THỎA THUẬN KÝ HỢP ĐỒNG LAO ĐỘNG VỚI CÁC ĐIỀU KHOẢN SAU:</p>

<p style="font-weight: bold; margin-top: 20px;">Điều 1: Thời hạn hợp đồng</p>
<p>Hợp đồng này có hiệu lực từ ngày ... tháng ... năm 20... đến ngày ... tháng ... năm 20...</p>

<p style="font-weight: bold; margin-top: 20px;">Điều 2: Công việc và địa điểm làm việc</p>
<p>- Bên B được tuyển dụng vào vị trí: ...................................................................</p>
<p>- Địa điểm làm việc: ...................................................................</p>
<p>- Mô tả công việc: ...................................................................</p>

<p style="font-weight: bold; margin-top: 20px;">Điều 3: Thời giờ làm việc và thời giờ nghỉ ngơi</p>
<p>- Thời giờ làm việc: 8 giờ/ngày, 48 giờ/tuần (từ thứ Hai đến thứ Sáu)</p>
<p>- Thời giờ nghỉ ngơi: Nghỉ Chủ nhật, các ngày lễ, Tết theo quy định của pháp luật</p>

<p style="font-weight: bold; margin-top: 20px;">Điều 4: Tiền lương</p>
<p>- Mức lương: .......................... đồng/tháng</p>
<p>- Hình thức trả lương: Chuyển khoản, vào ngày ... hàng tháng</p>
<p>- Phụ cấp (nếu có): ...................................................................</p>

<p style="font-weight: bold; margin-top: 20px;">Điều 5: Chế độ đào tạo, bồi dưỡng nâng cao trình độ</p>
<p>Bên A có trách nhiệm đào tạo, bồi dưỡng nâng cao trình độ chuyên môn nghiệp vụ cho Bên B theo quy định.</p>

<p style="font-weight: bold; margin-top: 20px;">Điều 6: Bảo hiểm xã hội, bảo hiểm y tế</p>
<p>Bên A đóng bảo hiểm xã hội, bảo hiểm y tế, bảo hiểm thất nghiệp cho Bên B theo quy định của pháp luật.</p>

<p style="font-weight: bold; margin-top: 20px;">Điều 7: Quyền và nghĩa vụ của Bên A</p>
<p>- Tạo điều kiện làm việc, trả lương đầy đủ, đúng hạn</p>
<p>- Chấp hành đúng các quy định về lao động</p>

<p style="font-weight: bold; margin-top: 20px;">Điều 8: Quyền và nghĩa vụ của Bên B</p>
<p>- Thực hiện đầy đủ nhiệm vụ được giao</p>
<p>- Tuân thủ nội quy, quy định của công ty</p>
<p>- Bảo mật thông tin công ty</p>

<p style="font-weight: bold; margin-top: 20px;">Điều 9: Chấm dứt hợp đồng</p>
<p>Hợp đồng chấm dứt khi hết hạn hoặc theo thỏa thuận của hai bên. Bên nào đơn phương chấm dứt hợp đồng phải báo trước ít nhất 30 ngày.</p>

<p style="font-weight: bold; margin-top: 20px;">Điều 10: Cam kết</p>
<p>Hai bên cam kết thực hiện đúng các điều khoản đã thỏa thuận. Mọi tranh chấp sẽ được giải quyết trên tinh thần hòa giải, thương lượng.</p>

<p style="margin-top: 32px;">Hợp đồng được lập thành 02 (hai) bản có giá trị pháp lý như nhau, mỗi bên giữ 01 bản.</p>

<p style="margin-top: 16px; font-style: italic; color: #666; font-size: 14px;">
  (Chữ ký các bên sẽ được tự động thêm vào cuối hợp đồng)
</p>`,
    signers: [
      { role: 'Người sử dụng lao động', defaultName: 'Bên A' },
      { role: 'Người lao động', defaultName: 'Bên B' },
    ],
  },
  {
    id: 'rental-contract',
    name: 'Hợp đồng thuê nhà',
    category: 'Bất động sản',
    description: 'Hợp đồng thuê nhà ở, văn phòng, mặt bằng',
    icon: 'Home',
    color: 'green',
    content: `<p style="margin-bottom: 16px;">Chúng tôi gồm:</p>

<p style="font-weight: bold; margin-top: 24px;">BÊN A: BÊN CHO THUÊ</p>
<p>Họ và tên: ...................................................................</p>
<p>CMND/CCCD số: .......................... Ngày cấp: ......./......./....... Nơi cấp: ..........................</p>
<p>Địa chỉ thường trú: ...................................................................</p>
<p>Điện thoại: .......................... Email: ..........................</p>

<p style="font-weight: bold; margin-top: 24px;">BÊN B: BÊN THUÊ</p>
<p>Họ và tên: ...................................................................</p>
<p>CMND/CCCD số: .......................... Ngày cấp: ......./......./....... Nơi cấp: ..........................</p>
<p>Địa chỉ thường trú: ...................................................................</p>
<p>Điện thoại: .......................... Email: ..........................</p>

<p style="font-weight: bold; margin-top: 24px;">HAI BÊN THỎA THUẬN KÝ HỢP ĐỒNG THUÊ NHÀ VỚI CÁC ĐIỀU KHOẢN SAU:</p>

<p style="font-weight: bold; margin-top: 20px;">Điều 1: Đối tượng cho thuê</p>
<p>Bên A đồng ý cho Bên B thuê nhà tại địa chỉ: ...................................................................</p>
<p>Diện tích: .......... m². Mục đích sử dụng: ...................................................................</p>

<p style="font-weight: bold; margin-top: 20px;">Điều 2: Thời hạn thuê</p>
<p>Thời hạn thuê: ........ tháng, từ ngày ... tháng ... năm 20... đến ngày ... tháng ... năm 20...</p>

<p style="font-weight: bold; margin-top: 20px;">Điều 3: Giá thuê và phương thức thanh toán</p>
<p>- Giá thuê: .......................... đồng/tháng</p>
<p>- Tiền đặt cọc: .......................... đồng (Sẽ hoàn trả khi hết hợp đồng nếu không có vi phạm)</p>
<p>- Thanh toán: Vào ngày ... hàng tháng, bằng tiền mặt/chuyển khoản</p>

<p style="font-weight: bold; margin-top: 20px;">Điều 4: Trách nhiệm của Bên A</p>
<p>- Giao nhà đúng hiện trạng như đã thỏa thuận</p>
<p>- Đảm bảo Bên B sử dụng nhà ổn định trong thời hạn thuê</p>
<p>- Không tăng giá thuê đột xuất trong thời hạn hợp đồng</p>

<p style="font-weight: bold; margin-top: 20px;">Điều 5: Trách nhiệm của Bên B</p>
<p>- Thanh toán tiền thuê đầy đủ, đúng hạn</p>
<p>- Giữ gìn, bảo quản tài sản thuê</p>
<p>- Trả nhà đúng hiện trạng ban đầu khi hết hợp đồng (hao mòn tự nhiên chấp nhận được)</p>
<p>- Chịu trách nhiệm về tiền điện, nước, internet, vệ sinh trong thời gian thuê</p>

<p style="font-weight: bold; margin-top: 20px;">Điều 6: Điều khoản chấm dứt hợp đồng</p>
<p>- Hợp đồng chấm dứt khi hết thời hạn</p>
<p>- Một trong hai bên muốn chấm dứt trước hạn phải báo trước ít nhất 30 ngày</p>

<p style="font-weight: bold; margin-top: 20px;">Điều 7: Cam kết</p>
<p>Hai bên cam kết thực hiện đúng các điều khoản đã thỏa thuận. Mọi tranh chấp sẽ được giải quyết theo pháp luật Việt Nam.</p>

<p style="margin-top: 32px;">Hợp đồng được lập thành 02 (hai) bản có giá trị pháp lý như nhau, mỗi bên giữ 01 bản.</p>`,
    signers: [
      { role: 'Bên cho thuê', defaultName: 'Bên A' },
      { role: 'Bên thuê', defaultName: 'Bên B' },
    ],
  },
  {
    id: 'loan-agreement',
    name: 'Giấy vay tiền/Hợp đồng vay',
    category: 'Tài chính',
    description: 'Hợp đồng vay mượn tiền có/không lãi suất',
    icon: 'Wallet',
    color: 'yellow',
    content: `<p style="margin-bottom: 16px;">Chúng tôi gồm:</p>

<p style="font-weight: bold; margin-top: 24px;">BÊN A: BÊN CHO VAY</p>
<p>Họ và tên: ...................................................................</p>
<p>CMND/CCCD số: .......................... Ngày cấp: ......./......./....... Nơi cấp: ..........................</p>
<p>Địa chỉ: ...................................................................</p>
<p>Điện thoại: ..........................</p>

<p style="font-weight: bold; margin-top: 24px;">BÊN B: BÊN VAY</p>
<p>Họ và tên: ...................................................................</p>
<p>CMND/CCCD số: .......................... Ngày cấp: ......./......./....... Nơi cấp: ..........................</p>
<p>Địa chỉ: ...................................................................</p>
<p>Điện thoại: ..........................</p>

<p style="font-weight: bold; margin-top: 24px;">HAI BÊN THỎA THUẬN KÝ GIẤY VAY TIỀN VỚI CÁC ĐIỀU KHOẢN SAU:</p>

<p style="font-weight: bold; margin-top: 20px;">Điều 1: Số tiền vay</p>
<p>Bên A đồng ý cho Bên B vay số tiền: .......................... đồng</p>
<p>Bằng chữ: ...................................................................</p>

<p style="font-weight: bold; margin-top: 20px;">Điều 2: Mục đích vay</p>
<p>Bên B vay tiền để: ...................................................................</p>

<p style="font-weight: bold; margin-top: 20px;">Điều 3: Thời hạn vay</p>
<p>Thời hạn vay: ........ tháng, đến ngày ... tháng ... năm 20... phải trả đủ</p>

<p style="font-weight: bold; margin-top: 20px;">Điều 4: Lãi suất (nếu có)</p>
<p>- Lãi suất: ......% / tháng (hoặc: Không tính lãi)</p>
<p>- Phương thức tính lãi: Lãi đơn/lãi kép</p>

<p style="font-weight: bold; margin-top: 20px;">Điều 5: Phương thức trả nợ</p>
<p>- Bên B trả nợ: Một lần/Nhiều lần</p>
<p>- Địa điểm trả tiền: ...................................................................</p>

<p style="font-weight: bold; margin-top: 20px;">Điều 6: Trách nhiệm của Bên A</p>
<p>- Giao đủ số tiền cho Bên B như đã cam kết</p>
<p>- Cung cấp biên lai, giấy tờ xác nhận cho vay</p>

<p style="font-weight: bold; margin-top: 20px;">Điều 7: Trách nhiệm của Bên B</p>
<p>- Sử dụng tiền đúng mục đích</p>
<p>- Trả nợ đầy đủ, đúng hạn</p>
<p>- Nếu trả chậm, chịu phạt: ......% / tháng (nếu có)</p>

<p style="font-weight: bold; margin-top: 20px;">Điều 8: Tài sản đảm bảo (nếu có)</p>
<p>Bên B dùng tài sản sau để đảm bảo: ...................................................................</p>

<p style="font-weight: bold; margin-top: 20px;">Điều 9: Giải quyết tranh chấp</p>
<p>Mọi tranh chấp phát sinh sẽ được hai bên thương lượng giải quyết. Nếu không thỏa thuận được, sẽ đưa ra Tòa án nhân dân có thẩm quyền.</p>

<p style="font-weight: bold; margin-top: 20px;">Điều 10: Cam kết</p>
<p>Hai bên cam kết thực hiện đúng các điều khoản đã thỏa thuận. Giấy vay tiền này có giá trị pháp lý.</p>

<p style="margin-top: 32px;">Giấy vay tiền được lập thành 02 (hai) bản có giá trị pháp lý như nhau, mỗi bên giữ 01 bản.</p>`,
    signers: [
      { role: 'Người cho vay', defaultName: 'Bên A' },
      { role: 'Người vay', defaultName: 'Bên B' },
    ],
  },
  {
    id: 'sales-contract',
    name: 'Hợp đồng mua bán',
    category: 'Thương mại',
    description: 'Hợp đồng mua bán hàng hóa, tài sản',
    icon: 'ShoppingCart',
    color: 'purple',
    content: `<p style="margin-bottom: 16px;">Chúng tôi gồm:</p>

<p style="font-weight: bold; margin-top: 24px;">BÊN A: BÊN BÁN</p>
<p>Họ và tên/Công ty: ...................................................................</p>
<p>CMND/CCCD/MST: .......................... Ngày cấp: ......./......./....... Nơi cấp: ..........................</p>
<p>Địa chỉ: ...................................................................</p>
<p>Điện thoại: .......................... Email: ..........................</p>

<p style="font-weight: bold; margin-top: 24px;">BÊN B: BÊN MUA</p>
<p>Họ và tên/Công ty: ...................................................................</p>
<p>CMND/CCCD/MST: .......................... Ngày cấp: ......./......./....... Nơi cấp: ..........................</p>
<p>Địa chỉ: ...................................................................</p>
<p>Điện thoại: .......................... Email: ..........................</p>

<p style="font-weight: bold; margin-top: 24px;">HAI BÊN THỎA THUẬN KÝ HỢP ĐỒNG MUA BÁN VỚI CÁC ĐIỀU KHOẢN SAU:</p>

<p style="font-weight: bold; margin-top: 20px;">Điều 1: Đối tượng mua bán</p>
<p>Bên A bán và Bên B mua hàng hóa/tài sản sau:</p>
<p>- Tên hàng hóa/tài sản: ...................................................................</p>
<p>- Số lượng: .......................... Đơn vị tính: ..........................</p>
<p>- Chất lượng: ...................................................................</p>
<p>- Xuất xứ: ...................................................................</p>

<p style="font-weight: bold; margin-top: 20px;">Điều 2: Giá cả và phương thức thanh toán</p>
<p>- Đơn giá: .......................... đồng/đơn vị</p>
<p>- Tổng giá trị: .......................... đồng</p>
<p>- Thuế VAT: ......% (nếu có)</p>
<p>- Phương thức thanh toán: Tiền mặt/Chuyển khoản/Trả góp</p>
<p>- Thời hạn thanh toán: ...................................................................</p>

<p style="font-weight: bold; margin-top: 20px;">Điều 3: Thời gian và địa điểm giao hàng</p>
<p>- Thời gian giao hàng: Trong vòng ........ ngày kể từ ngày ký hợp đồng</p>
<p>- Địa điểm giao hàng: ...................................................................</p>
<p>- Bên chịu phí vận chuyển: Bên A / Bên B</p>

<p style="font-weight: bold; margin-top: 20px;">Điều 4: Nghĩa vụ của Bên A</p>
<p>- Giao hàng đúng chất lượng, số lượng, thời gian</p>
<p>- Cung cấp đầy đủ chứng từ, giấy tờ liên quan</p>
<p>- Bảo hành (nếu có): ........ tháng</p>

<p style="font-weight: bold; margin-top: 20px;">Điều 5: Nghĩa vụ của Bên B</p>
<p>- Thanh toán đầy đủ, đúng hạn</p>
<p>- Kiểm tra hàng hóa khi nhận</p>
<p>- Thông báo ngay nếu phát hiện sai sót</p>

<p style="font-weight: bold; margin-top: 20px;">Điều 6: Bảo hành và khiếu nại</p>
<p>- Thời gian bảo hành: ........ tháng</p>
<p>- Khiếu nại phải được thực hiện trong vòng ........ ngày kể từ ngày nhận hàng</p>

<p style="font-weight: bold; margin-top: 20px;">Điều 7: Vi phạm hợp đồng</p>
<p>Bên nào vi phạm hợp đồng phải bồi thường thiệt hại cho bên kia theo quy định pháp luật.</p>

<p style="font-weight: bold; margin-top: 20px;">Điều 8: Giải quyết tranh chấp</p>
<p>Mọi tranh chấp phát sinh sẽ được hai bên thương lượng. Nếu không thỏa thuận được, sẽ đưa ra Tòa án có thẩm quyền giải quyết.</p>

<p style="margin-top: 32px;">Hợp đồng được lập thành 02 (hai) bản có giá trị pháp lý như nhau, mỗi bên giữ 01 bản.</p>`,
    signers: [
      { role: 'Bên bán', defaultName: 'Bên A' },
      { role: 'Bên mua', defaultName: 'Bên B' },
    ],
  },
  {
    id: 'service-contract',
    name: 'Hợp đồng dịch vụ',
    category: 'Thương mại',
    description: 'Hợp đồng cung cấp dịch vụ',
    icon: 'Wrench',
    color: 'orange',
    content: `<p style="margin-bottom: 16px;">Chúng tôi gồm:</p>

<p style="font-weight: bold; margin-top: 24px;">BÊN A: BÊN CUNG CẤP DỊCH VỤ</p>
<p>Tên công ty/cá nhân: ...................................................................</p>
<p>Địa chỉ: ...................................................................</p>
<p>MST/CMND: .......................... Điện thoại: ..........................</p>
<p>Người đại diện: .......................... Email: ..........................</p>

<p style="font-weight: bold; margin-top: 24px;">BÊN B: BÊN SỬ DỤNG DỊCH VỤ</p>
<p>Tên công ty/cá nhân: ...................................................................</p>
<p>Địa chỉ: ...................................................................</p>
<p>MST/CMND: .......................... Điện thoại: ..........................</p>
<p>Người đại diện: .......................... Email: ..........................</p>

<p style="font-weight: bold; margin-top: 24px;">HAI BÊN THỎA THUẬN KÝ HỢP ĐỒNG DỊCH VỤ VỚI CÁC ĐIỀU KHOẢN SAU:</p>

<p style="font-weight: bold; margin-top: 20px;">Điều 1: Nội dung dịch vụ</p>
<p>Bên A cung cấp cho Bên B các dịch vụ sau:</p>
<p>- Tên dịch vụ: ...................................................................</p>
<p>- Phạm vi: ...................................................................</p>
<p>- Mô tả chi tiết: ...................................................................</p>

<p style="font-weight: bold; margin-top: 20px;">Điều 2: Thời gian thực hiện</p>
<p>- Thời gian bắt đầu: Ngày ... tháng ... năm 20...</p>
<p>- Thời gian hoàn thành: Ngày ... tháng ... năm 20...</p>
<p>- Thời hạn hợp đồng: ........ tháng</p>

<p style="font-weight: bold; margin-top: 20px;">Điều 3: Giá trị hợp đồng và thanh toán</p>
<p>- Tổng giá trị: .......................... đồng</p>
<p>- Phương thức thanh toán: Chuyển khoản/Tiền mặt</p>
<p>- Tiến độ thanh toán:</p>
<p>  + Đợt 1: ......% khi ký hợp đồng</p>
<p>  + Đợt 2: ......% khi hoàn thành .......</p>
<p>  + Đợt 3: ......% khi nghiệm thu</p>

<p style="font-weight: bold; margin-top: 20px;">Điều 4: Trách nhiệm của Bên A</p>
<p>- Cung cấp dịch vụ đúng chất lượng, tiến độ</p>
<p>- Bố trí nhân sự có trình độ chuyên môn</p>
<p>- Báo cáo tiến độ định kỳ cho Bên B</p>

<p style="font-weight: bold; margin-top: 20px;">Điều 5: Trách nhiệm của Bên B</p>
<p>- Thanh toán đầy đủ, đúng tiến độ</p>
<p>- Cung cấp thông tin, tài liệu cần thiết</p>
<p>- Phối hợp với Bên A trong quá trình thực hiện</p>

<p style="font-weight: bold; margin-top: 20px;">Điều 6: Bảo mật thông tin</p>
<p>Hai bên cam kết bảo mật mọi thông tin liên quan đến hợp đồng này.</p>

<p style="font-weight: bold; margin-top: 20px;">Điều 7: Điều khoản chấm dứt hợp đồng</p>
<p>Một trong hai bên muốn chấm dứt hợp đồng trước hạn phải báo trước ít nhất 30 ngày và bồi thường thiệt hại (nếu có).</p>

<p style="margin-top: 32px;">Hợp đồng được lập thành 02 (hai) bản có giá trị pháp lý như nhau, mỗi bên giữ 01 bản.</p>`,
    signers: [
      { role: 'Bên cung cấp dịch vụ', defaultName: 'Bên A' },
      { role: 'Bên sử dụng dịch vụ', defaultName: 'Bên B' },
    ],
  },
];

export const TEMPLATE_CATEGORIES = [
  'Tất cả',
  'Lao động',
  'Bất động sản',
  'Tài chính',
  'Thương mại',
  'Khác',
];

export function getTemplateById(id: string): ContractTemplate | undefined {
  return CONTRACT_TEMPLATES.find((t) => t.id === id);
}

export function getTemplatesByCategory(category: string): ContractTemplate[] {
  if (category === 'Tất cả') return CONTRACT_TEMPLATES;
  return CONTRACT_TEMPLATES.filter((t) => t.category === category);
}

export function getAllTemplates(): ContractTemplate[] {
  return CONTRACT_TEMPLATES;
}

