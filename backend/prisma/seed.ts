import { scriptPrisma } from '../scripts/database-tools.js';
import { AppError } from '../src/shared/errors/app-error.js';
import { hashPassword } from '../src/shared/utils/password.js';
import { GuestCrypto } from '../src/modules/guests/guest.crypto.js';
import { hotelToday } from '../src/modules/reservations/reservation.dates.js';
import { Prisma } from '../src/generated/prisma/client.js';
import type {
  StaffUserModel,
  RoomTypeModel,
  RoomModel,
  ServiceModel,
  GuestModel,
} from '../src/generated/prisma/models.js';

// ----------------------------------------------------
// 1. ROLES & STAFF DEFINITIONS (18 staff across shifts)
// ----------------------------------------------------
const roles = [
  ['ADMIN', 'Quản trị hệ thống'],
  ['MANAGER', 'Quản lý khách sạn'],
  ['RECEPTIONIST', 'Nhân viên lễ tân'],
  ['HOUSEKEEPING', 'Nhân viên buồng phòng'],
  ['ACCOUNTANT', 'Nhân viên kế toán'],
  ['TECHNICIAN', 'Nhân viên kỹ thuật'],
] as const;

const staffAccounts = [
  // Cấp Quản trị & Điều hành
  ['ADMIN', 'admin', 'Quản trị viên Hệ thống'],
  ['MANAGER', 'manager', 'Nguyễn Minh Anh (QL Ca Ngày)'],
  ['MANAGER', 'manager_dung', 'Hoàng Tiến Dũng (Phó QL Ca Tối)'],

  // Lễ tân 3 ca (Sáng - Chiều - Đêm - Luân chuyển)
  ['RECEPTIONIST', 'receptionist', 'Trần Ngọc Linh (Lễ tân Ca Sáng)'],
  ['RECEPTIONIST', 'rec_nam', 'Lê Hải Nam (Lễ tân Ca Chiều)'],
  ['RECEPTIONIST', 'rec_hoa', 'Đỗ Quỳnh Hoa (Lễ tân Ca Đêm)'],
  ['RECEPTIONIST', 'rec_thao', 'Vũ Phương Thảo (Lễ tân Luân chuyển)'],

  // Kế toán & Thu ngân
  ['ACCOUNTANT', 'accountant', 'Lê Thu Hà (Kế toán Tổng hợp)'],
  ['ACCOUNTANT', 'acc_dung', 'Nguyễn Việt Dũng (Kế toán Thu ngân & Audit)'],

  // Buồng phòng (Trưởng nhóm + Nhân viên các ca + Giặt là)
  ['HOUSEKEEPING', 'housekeeping', 'Phạm Thị Lan (Trưởng nhóm Buồng)'],
  ['HOUSEKEEPING', 'hk_mai', 'Nguyễn Tuyết Mai (Buồng phòng Ca Sáng)'],
  ['HOUSEKEEPING', 'hk_tuan', 'Trần Anh Tuấn (Buồng phòng Ca Sáng)'],
  ['HOUSEKEEPING', 'hk_cuc', 'Lê Kim Cúc (Buồng phòng Ca Chiều)'],
  ['HOUSEKEEPING', 'hk_phuong', 'Bùi Thu Phương (Buồng phòng Ca Chiều)'],
  ['HOUSEKEEPING', 'hk_giatla', 'Đặng Thị Hạnh (Phụ trách Giặt là)'],

  // Kỹ thuật viên (Điện lạnh - Nước nội thất - Trực đêm)
  ['TECHNICIAN', 'technician', 'Hoàng Văn Nam (Kỹ thuật Điện lạnh)'],
  ['TECHNICIAN', 'tech_long', 'Ngô Đức Long (Kỹ thuật Cấp thoát nước)'],
  ['TECHNICIAN', 'tech_quang', 'Phạm Minh Quang (Kỹ thuật Trực đêm)'],
] as const;

// ----------------------------------------------------
// 2. ROOM TYPES (6 realistic types with scaled pricing)
// ----------------------------------------------------
const roomTypesConfig = [
  {
    code: 'STD-SGL',
    name: 'Standard Single',
    maxAdults: 1,
    maxChildren: 0,
    basePrice: '600000.00',
    description: 'Phòng đơn tiêu chuẩn tiện nghi cho khách công tác hoặc đi một mình.',
  },
  {
    code: 'STD-DBL',
    name: 'Standard Double',
    maxAdults: 2,
    maxChildren: 1,
    basePrice: '750000.00',
    description: 'Phòng đôi tiêu chuẩn 1 giường đôi lớn, ấm cúng và đầy đủ tiện ích.',
  },
  {
    code: 'SUP-TWN',
    name: 'Superior Twin',
    maxAdults: 2,
    maxChildren: 1,
    basePrice: '950000.00',
    description: 'Phòng 2 giường đơn cao cấp, ban công thoáng nhìn ra sân vườn nội khu.',
  },
  {
    code: 'SUP-DBL',
    name: 'Superior Double',
    maxAdults: 2,
    maxChildren: 1,
    basePrice: '1100000.00',
    description: 'Phòng giường đôi cao cấp tầng cao, view thành phố lộng lẫy về đêm.',
  },
  {
    code: 'DLX-BALCONY',
    name: 'Deluxe Balcony',
    maxAdults: 2,
    maxChildren: 1,
    basePrice: '1600000.00',
    description: 'Phòng Deluxe sang trọng với ban công riêng biệt, view toàn cảnh thoáng đãng.',
  },
  {
    code: 'SUITE-EXEC',
    name: 'Executive Suite',
    maxAdults: 4,
    maxChildren: 2,
    basePrice: '2800000.00',
    description: 'Căn hộ Suite thượng hạng gồm phòng khách và phòng ngủ riêng biệt, bồn tắm sục.',
  },
] as const;

// ----------------------------------------------------
// 3. PHYSICAL ROOMS (40 rooms across 4 floors)
// ----------------------------------------------------
type RoomSeedDef = [
  string,
  number,
  string,
  'ACTIVE' | 'MAINTENANCE' | 'OUT_OF_SERVICE',
  'READY' | 'DIRTY' | 'CLEANING' | 'INSPECTION',
];

const roomsConfig: RoomSeedDef[] = [
  // TẦNG 1: 10 phòng (101 - 110)
  ['101', 1, 'STD-SGL', 'ACTIVE', 'READY'],
  ['102', 1, 'STD-SGL', 'ACTIVE', 'READY'],
  ['103', 1, 'STD-SGL', 'ACTIVE', 'DIRTY'],
  ['104', 1, 'STD-SGL', 'MAINTENANCE', 'DIRTY'], // Khóa bảo trì (rò rỉ ống nước)
  ['105', 1, 'STD-DBL', 'ACTIVE', 'READY'],
  ['106', 1, 'STD-DBL', 'ACTIVE', 'READY'],
  ['107', 1, 'STD-DBL', 'ACTIVE', 'READY'],
  ['108', 1, 'STD-DBL', 'ACTIVE', 'CLEANING'],
  ['109', 1, 'STD-DBL', 'ACTIVE', 'READY'],
  ['110', 1, 'STD-DBL', 'ACTIVE', 'DIRTY'],

  // TẦNG 2: 10 phòng (201 - 210)
  ['201', 2, 'STD-DBL', 'ACTIVE', 'READY'],
  ['202', 2, 'STD-DBL', 'ACTIVE', 'READY'],
  ['203', 2, 'STD-DBL', 'ACTIVE', 'READY'],
  ['204', 2, 'STD-DBL', 'ACTIVE', 'READY'],
  ['205', 2, 'SUP-TWN', 'ACTIVE', 'READY'],
  ['206', 2, 'SUP-TWN', 'MAINTENANCE', 'DIRTY'], // Khóa bảo trì (bảo dưỡng máy lạnh)
  ['207', 2, 'SUP-TWN', 'ACTIVE', 'READY'],
  ['208', 2, 'SUP-TWN', 'ACTIVE', 'READY'],
  ['209', 2, 'SUP-TWN', 'ACTIVE', 'INSPECTION'],
  ['210', 2, 'SUP-TWN', 'ACTIVE', 'READY'],

  // TẦNG 3: 10 phòng (301 - 310)
  ['301', 3, 'SUP-DBL', 'ACTIVE', 'READY'],
  ['302', 3, 'SUP-DBL', 'ACTIVE', 'READY'],
  ['303', 3, 'SUP-DBL', 'ACTIVE', 'READY'],
  ['304', 3, 'SUP-DBL', 'ACTIVE', 'CLEANING'],
  ['305', 3, 'SUP-DBL', 'ACTIVE', 'READY'],
  ['306', 3, 'SUP-DBL', 'ACTIVE', 'READY'],
  ['307', 3, 'SUP-DBL', 'ACTIVE', 'DIRTY'],
  ['308', 3, 'SUP-DBL', 'ACTIVE', 'READY'],
  ['309', 3, 'DLX-BALCONY', 'ACTIVE', 'READY'],
  ['310', 3, 'DLX-BALCONY', 'ACTIVE', 'READY'],

  // TẦNG 4: 10 phòng (401 - 410)
  ['401', 4, 'DLX-BALCONY', 'ACTIVE', 'READY'],
  ['402', 4, 'DLX-BALCONY', 'ACTIVE', 'READY'],
  ['403', 4, 'DLX-BALCONY', 'ACTIVE', 'READY'],
  ['404', 4, 'DLX-BALCONY', 'ACTIVE', 'READY'],
  ['405', 4, 'DLX-BALCONY', 'ACTIVE', 'READY'],
  ['406', 4, 'DLX-BALCONY', 'ACTIVE', 'READY'],
  ['407', 4, 'SUITE-EXEC', 'ACTIVE', 'READY'],
  ['408', 4, 'SUITE-EXEC', 'ACTIVE', 'READY'],
  ['409', 4, 'SUITE-EXEC', 'ACTIVE', 'READY'],
  ['410', 4, 'SUITE-EXEC', 'ACTIVE', 'DIRTY'],
];

// ----------------------------------------------------
// 4. SERVICES
// ----------------------------------------------------
const servicesConfig = [
  { code: 'SRV-MASSAGE', name: 'Massage thư giãn toàn thân 60 phút', unit: 'Suất', price: '350000.00' },
  { code: 'SRV-MOTORBIKE', name: 'Dịch vụ cho thuê xe máy tay ga', unit: 'Ngày', price: '150000.00' },
  { code: 'SRV-LAUNDRY', name: 'Dịch vụ Giặt ủi cao cấp', unit: 'Kg', price: '50000.00' },
  { code: 'SRV-BREAKFAST', name: 'Buffet sáng quốc tế', unit: 'Suất', price: '180000.00' },
  { code: 'SRV-AIRPORT', name: 'Xe đưa đón sân bay 4 chỗ', unit: 'Chuyến', price: '350000.00' },
];

// ----------------------------------------------------
// 5. 35 DEMO GUESTS (Vietnamese & International)
// ----------------------------------------------------
const demoGuests = [
  { fullName: 'Nguyễn Văn An', phone: '0901234567', email: 'an.nguyen@gmail.com', gender: 'MALE' as const, nationality: 'Việt Nam', docType: 'NATIONAL_ID' as const, docNum: '079090001234', address: '123 Lê Lợi, Quận 1, TP.HCM' },
  { fullName: 'Trần Thị Bích', phone: '0912345678', email: 'bich.tran@yahoo.com', gender: 'FEMALE' as const, nationality: 'Việt Nam', docType: 'NATIONAL_ID' as const, docNum: '001188002345', address: '45 Hai Bà Trưng, Hoàn Kiếm, Hà Nội' },
  { fullName: 'Lê Hoàng Long', phone: '0983456789', email: 'long.le@outlook.com', gender: 'MALE' as const, nationality: 'Việt Nam', docType: 'NATIONAL_ID' as const, docNum: '048095003456', address: '78 Bạch Đằng, Hải Châu, Đà Nẵng' },
  { fullName: 'Phạm Thu Hương', phone: '0974567890', email: 'huong.pham@gmail.com', gender: 'FEMALE' as const, nationality: 'Việt Nam', docType: 'NATIONAL_ID' as const, docNum: '031092004567', address: '12 Trần Phú, Ngô Quyền, Hải Phòng' },
  { fullName: 'Hoàng Minh Đức', phone: '0965678901', email: 'duc.hoang@gmail.com', gender: 'MALE' as const, nationality: 'Việt Nam', docType: 'NATIONAL_ID' as const, docNum: '001085005678', address: '88 Cầu Giấy, Cầu Giấy, Hà Nội' },
  { fullName: 'Vũ Thị Mai', phone: '0936789012', email: 'mai.vu@gmail.com', gender: 'FEMALE' as const, nationality: 'Việt Nam', docType: 'NATIONAL_ID' as const, docNum: '079193006789', address: '234 Nguyễn Trãi, Quận 5, TP.HCM' },
  { fullName: 'Đặng Quốc Huy', phone: '0947890123', email: 'huy.dang@fpt.com', gender: 'MALE' as const, nationality: 'Việt Nam', docType: 'NATIONAL_ID' as const, docNum: '048088007890', address: '56 Nguyễn Văn Linh, Thanh Khê, Đà Nẵng' },
  { fullName: 'Bùi Thị Lan Anh', phone: '0928901234', email: 'lananh.bui@gmail.com', gender: 'FEMALE' as const, nationality: 'Việt Nam', docType: 'NATIONAL_ID' as const, docNum: '075096008901', address: '67 Đồng Khởi, TP. Biên Hòa, Đồng Nai' },
  { fullName: 'Ngô Thanh Tùng', phone: '0919012345', email: 'tung.ngo@tech.vn', gender: 'MALE' as const, nationality: 'Việt Nam', docType: 'NATIONAL_ID' as const, docNum: '001091009012', address: '15 Kim Mã, Ba Đình, Hà Nội' },
  { fullName: 'Đỗ Mỹ Linh', phone: '0909123456', email: 'mylinh.do@vnu.edu.vn', gender: 'FEMALE' as const, nationality: 'Việt Nam', docType: 'NATIONAL_ID' as const, docNum: '079197010123', address: '89 Pasteur, Quận 3, TP.HCM' },
  { fullName: 'Michael Robert Smith', phone: '+12025550143', email: 'michael.smith@usa.com', gender: 'MALE' as const, nationality: 'United States', docType: 'PASSPORT' as const, docNum: 'US987654321', address: '742 Evergreen Terrace, Springfield, OR, USA' },
  { fullName: 'Emma Charlotte Watson', phone: '+442079460912', email: 'emma.watson@uk.co.uk', gender: 'FEMALE' as const, nationality: 'United Kingdom', docType: 'PASSPORT' as const, docNum: 'GB123456789', address: '221B Baker Street, London, UK' },
  { fullName: 'Kenji Sato', phone: '+81355550198', email: 'kenji.sato@sony.co.jp', gender: 'MALE' as const, nationality: 'Japan', docType: 'PASSPORT' as const, docNum: 'JP876543210', address: '2-11-3 Nagatacho, Chiyoda-ku, Tokyo, Japan' },
  { fullName: 'Park Min-Ji', phone: '+8223123456', email: 'minji.park@naver.com', gender: 'FEMALE' as const, nationality: 'South Korea', docType: 'PASSPORT' as const, docNum: 'KR12389045', address: 'Gangnam-daero 396, Gangnam-gu, Seoul, Korea' },
  { fullName: 'Jean-Pierre Dubois', phone: '+33142685555', email: 'jp.dubois@orange.fr', gender: 'MALE' as const, nationality: 'France', docType: 'PASSPORT' as const, docNum: 'FR54321098', address: '15 Rue de la Paix, 75002 Paris, France' },
  { fullName: 'Hans Mueller', phone: '+493012345678', email: 'hans.mueller@berlin.de', gender: 'MALE' as const, nationality: 'Germany', docType: 'PASSPORT' as const, docNum: 'DE01X00T47', address: 'Friedrichstraße 43, 10117 Berlin, Germany' },
  { fullName: 'Lý Gia Hào', phone: '0908765432', email: 'hao.ly@finance.com', gender: 'MALE' as const, nationality: 'Việt Nam', docType: 'NATIONAL_ID' as const, docNum: '079087011234', address: '205 An Dương Vương, Quận 5, TP.HCM' },
  { fullName: 'Võ Thị Thanh Thủy', phone: '0918765432', email: 'thuy.vo@gmail.com', gender: 'FEMALE' as const, nationality: 'Việt Nam', docType: 'NATIONAL_ID' as const, docNum: '072093012345', address: '18 Nguyễn Thị Minh Khai, Nha Trang, Khánh Hòa' },
  { fullName: 'Trương Quốc Huy', phone: '0988765432', email: 'huy.truong@startup.vn', gender: 'MALE' as const, nationality: 'Việt Nam', docType: 'NATIONAL_ID' as const, docNum: '083090013456', address: '42 Trần Hưng Đạo, Ninh Kiều, Cần Thơ' },
  { fullName: 'Sophia Chen', phone: '+6567890123', email: 'sophia.chen@singapore.sg', gender: 'FEMALE' as const, nationality: 'Singapore', docType: 'PASSPORT' as const, docNum: 'SG7654321B', address: '1 Raffles Place, Singapore 048616' },
  { fullName: 'Nguyễn Thành Nam', phone: '0903344556', email: 'nam.nguyen@vin.vn', gender: 'MALE' as const, nationality: 'Việt Nam', docType: 'NATIONAL_ID' as const, docNum: '079085014567', address: 'Tòa nhà Landmark 81, Bình Thạnh, TP.HCM' },
  { fullName: 'Lê Cẩm Tú', phone: '0914455667', email: 'tu.le@gmail.com', gender: 'FEMALE' as const, nationality: 'Việt Nam', docType: 'NATIONAL_ID' as const, docNum: '001192015678', address: '36 Lý Thường Kiệt, Hoàn Kiếm, Hà Nội' },
  { fullName: 'David Lee', phone: '+61298765432', email: 'david.lee@sydney.au', gender: 'MALE' as const, nationality: 'Australia', docType: 'PASSPORT' as const, docNum: 'AU98765432', address: 'George St, Sydney NSW 2000, Australia' },
  { fullName: 'Phan Bảo Ngọc', phone: '0985566778', email: 'ngoc.phan@fashion.vn', gender: 'FEMALE' as const, nationality: 'Việt Nam', docType: 'NATIONAL_ID' as const, docNum: '079198016789', address: '102 Nam Kỳ Khởi Nghĩa, Quận 1, TP.HCM' },
  { fullName: 'Trần Đình Trọng', phone: '0976677889', email: 'trong.tran@sports.vn', gender: 'MALE' as const, nationality: 'Việt Nam', docType: 'NATIONAL_ID' as const, docNum: '036094017890', address: '25 Lê Duẩn, Hải Châu, Đà Nẵng' },
  { fullName: 'Mai Phương Thúy', phone: '0967788990', email: 'thuy.mai@entertainment.vn', gender: 'FEMALE' as const, nationality: 'Việt Nam', docType: 'NATIONAL_ID' as const, docNum: '001188018901', address: '12 Quán Sứ, Hoàn Kiếm, Hà Nội' },
  { fullName: 'Alexander Ivanov', phone: '+74951234567', email: 'alex.ivanov@mail.ru', gender: 'MALE' as const, nationality: 'Russia', docType: 'PASSPORT' as const, docNum: 'RU65432109', address: 'Tverskaya St 12, Moscow, Russia' },
  { fullName: 'Hồ Quang Hiếu', phone: '0938899001', email: 'hieu.ho@music.vn', gender: 'MALE' as const, nationality: 'Việt Nam', docType: 'NATIONAL_ID' as const, docNum: '079086019012', address: '150 Cách Mạng Tháng 8, Quận 3, TP.HCM' },
  { fullName: 'Dương Thùy Linh', phone: '0949900112', email: 'linh.duong@law.vn', gender: 'FEMALE' as const, nationality: 'Việt Nam', docType: 'NATIONAL_ID' as const, docNum: '001190020123', address: '78 Thợ Nhuộm, Hoàn Kiếm, Hà Nội' },
  { fullName: 'Carlos Rodriguez', phone: '+34911234567', email: 'carlos.rodriguez@madrid.es', gender: 'MALE' as const, nationality: 'Spain', docType: 'PASSPORT' as const, docNum: 'ES87654321', address: 'Gran Vía 28, 28013 Madrid, Spain' },
  { fullName: 'Vương Đình Huệ', phone: '0911223344', email: 'hue.vuong@edu.vn', gender: 'MALE' as const, nationality: 'Việt Nam', docType: 'NATIONAL_ID' as const, docNum: '040075021234', address: '45 Lê Hồng Phong, TP. Vinh, Nghệ An' },
  { fullName: 'Ngô Kiến Huy', phone: '0922334455', email: 'huy.ngo@media.vn', gender: 'MALE' as const, nationality: 'Việt Nam', docType: 'NATIONAL_ID' as const, docNum: '079088022345', address: '68 Hoàng Văn Thụ, Phú Nhuận, TP.HCM' },
  { fullName: 'Chi Pu', phone: '0933445566', email: 'chipu@gopho.vn', gender: 'FEMALE' as const, nationality: 'Việt Nam', docType: 'NATIONAL_ID' as const, docNum: '001193023456', address: '18 Hàng Bài, Hoàn Kiếm, Hà Nội' },
  { fullName: 'Kim Tae-Hee', phone: '+8225550187', email: 'taehee.kim@seoul.kr', gender: 'FEMALE' as const, nationality: 'South Korea', docType: 'PASSPORT' as const, docNum: 'KR99887766', address: 'Teheran-ro 152, Gangnam-gu, Seoul, Korea' },
  { fullName: 'Lucas Rossi', phone: '+39061234567', email: 'lucas.rossi@roma.it', gender: 'MALE' as const, nationality: 'Italy', docType: 'PASSPORT' as const, docNum: 'IT12349876', address: 'Via del Corso 184, 00186 Roma, Italy' },
];

// ----------------------------------------------------
// 6. INVENTORY MASTER DATA
// ----------------------------------------------------
const demoInventoryCategories = [
  {
    code: 'AMENITY',
    name: 'Đồ dùng tiêu hao phòng khách',
    description: 'Bàn chải, xà phòng, dầu gội, dép phòng và các tiện ích dùng một lần',
  },
  {
    code: 'LINEN',
    name: 'Đồ vải và giặt là',
    description: 'Khăn tắm, khăn mặt, ga giường, vỏ chăn gối luân chuyển phòng khách',
  },
  {
    code: 'CLEANING',
    name: 'Hóa chất & Dụng cụ vệ sinh',
    description: 'Nước lau sàn, nước cọ rửa, túi rác và dụng cụ làm sạch buồng phòng',
  },
  {
    code: 'MINIBAR',
    name: 'Đồ ăn & Thức uống Minibar',
    description: 'Nước ngọt, bia, snack, bánh kẹo phục vụ tủ lạnh mini tại phòng',
  },
  {
    code: 'MAINTENANCE',
    name: 'Vật tư Kỹ thuật & Bảo dưỡng',
    description: 'Bóng đèn, pin remote, vòi sen, linh kiện sửa chữa điện nước phòng',
  },
] as const;

const demoSuppliers = [
  {
    code: 'SUP-ASIA',
    name: 'Công ty TNHH Cung Ứng Khách Sạn Á Châu',
    contactPerson: 'Nguyễn Văn Hùng',
    phone: '02838221199',
    email: 'sales@achau-supplies.vn',
    address: '142 Nguyễn Thị Minh Khai, Quận 3, TP. Hồ Chí Minh',
    notes: 'Nhà cung cấp amenities và đồ tiêu hao phòng khách độc quyền',
  },
  {
    code: 'SUP-NAMVIET',
    name: 'Công ty CP Dệt May & Đồ Vải Nam Việt',
    contactPerson: 'Trần Minh Đức',
    phone: '02437668899',
    email: 'contact@namvietlinen.vn',
    address: '88 Láng Hạ, Quận Đống Đa, Hà Nội',
    notes: 'Chuyên sản xuất khăn bông cotton 100% và ga gối khách sạn 4-5 sao',
  },
  {
    code: 'SUP-ECOCLEAN',
    name: 'Công ty Hóa Chất Vệ Sinh Công Nghiệp EcoClean',
    contactPerson: 'Lê Thu Trang',
    phone: '02839445566',
    email: 'info@ecoclean.vn',
    address: '56 Đường số 7, KCN Tân Bình, TP. Hồ Chí Minh',
    notes: 'Hóa chất tẩy rửa sinh học an toàn tiêu chuẩn quốc tế',
  },
  {
    code: 'SUP-TANPHAT',
    name: 'Công ty TNHH Thiết Bị & Kỹ Thuật Tân Phát',
    contactPerson: 'Phạm Quốc Bảo',
    phone: '02837112233',
    email: 'sales@tanphat-tech.com',
    address: '210 Điện Biên Phủ, Quận Bình Thạnh, TP. Hồ Chí Minh',
    notes: 'Thiết bị điện, phụ tùng thay thế và linh kiện kỹ thuật tòa nhà',
  },
] as const;

const demoInventoryItems = [
  // 1. Amenities (9 items - SUP-ASIA)
  {
    code: 'AMEN-TB-01',
    name: 'Bàn chải & Kem đánh răng',
    categoryCode: 'AMENITY',
    unit: 'bộ',
    description: 'Bàn chải thân thiện môi trường kèm tuýp kem đánh răng 5g đóng hộp',
    minStockLevel: '100.00',
    initialStock: '350.00',
    unitPrice: '3500.00',
    supplierCode: 'SUP-ASIA',
  },
  {
    code: 'AMEN-SH-40ML',
    name: 'Dầu gội đầu thảo mộc 40ml',
    categoryCode: 'AMENITY',
    unit: 'chai',
    description: 'Dầu gội chai mini 40ml hương sả chanh dịu nhẹ',
    minStockLevel: '80.00',
    initialStock: '45.00', // Low stock demo (< min 80)
    unitPrice: '5200.00',
    supplierCode: 'SUP-ASIA',
  },
  {
    code: 'AMEN-SG-40ML',
    name: 'Sữa tắm dưỡng ẩm 40ml',
    categoryCode: 'AMENITY',
    unit: 'chai',
    description: 'Sữa tắm dưỡng ẩm chiết xuất hoa sen chai nắp nhôm 40ml',
    minStockLevel: '80.00',
    initialStock: '280.00',
    unitPrice: '5200.00',
    supplierCode: 'SUP-ASIA',
  },
  {
    code: 'AMEN-SLIP-W',
    name: 'Dép bông đi trong phòng (Trắng)',
    categoryCode: 'AMENITY',
    unit: 'đôi',
    description: 'Dép vải bông xốp đế chống trượt màu trắng in logo',
    minStockLevel: '60.00',
    initialStock: '150.00',
    unitPrice: '9000.00',
    supplierCode: 'SUP-ASIA',
  },
  {
    code: 'AMEN-COMB-01',
    name: 'Lược chải tóc đóng gói',
    categoryCode: 'AMENITY',
    unit: 'cái',
    description: 'Lược nhựa cao cấp bọc màng giấy bảo vệ',
    minStockLevel: '50.00',
    initialStock: '200.00',
    unitPrice: '2200.00',
    supplierCode: 'SUP-ASIA',
  },
  {
    code: 'AMEN-RAZOR',
    name: 'Bộ dao cạo râu & kem cạo',
    categoryCode: 'AMENITY',
    unit: 'bộ',
    description: 'Dao cạo 2 lưỡi kèm tuýp kem cạo râu mini 10ml',
    minStockLevel: '40.00',
    initialStock: '120.00',
    unitPrice: '6500.00',
    supplierCode: 'SUP-ASIA',
  },
  {
    code: 'AMEN-TEA-LIP',
    name: 'Trà túi lọc Lipton Yellow Label',
    categoryCode: 'AMENITY',
    unit: 'gói',
    description: 'Trà đen túi lọc miễn phí phục vụ đặt phòng',
    minStockLevel: '100.00',
    initialStock: '400.00',
    unitPrice: '1800.00',
    supplierCode: 'SUP-ASIA',
  },
  {
    code: 'AMEN-COF-G7',
    name: 'Cà phê hòa tan Trung Nguyên G7',
    categoryCode: 'AMENITY',
    unit: 'gói',
    description: 'Cà phê hòa tan 3in1 gói nhỏ đặt khay phòng khách',
    minStockLevel: '100.00',
    initialStock: '500.00',
    unitPrice: '2500.00',
    supplierCode: 'SUP-ASIA',
  },
  {
    code: 'AMEN-WATER',
    name: 'Nước suối chai Aquafina 350ml',
    categoryCode: 'AMENITY',
    unit: 'chai',
    description: 'Nước uống tinh khiết miễn phí đặt phòng mỗi ngày 2 chai/phòng',
    minStockLevel: '120.00',
    initialStock: '600.00',
    unitPrice: '4000.00',
    supplierCode: 'SUP-ASIA',
  },

  // 2. Linen (4 items - SUP-NAMVIET)
  {
    code: 'LIN-TOW-BATH',
    name: 'Khăn tắm Cotton 70x140cm',
    categoryCode: 'LINEN',
    unit: 'cái',
    description: 'Khăn tắm dệt sợi bông tự nhiên 500gsm màu trắng tinh dệt logo chìm',
    minStockLevel: '40.00',
    initialStock: '180.00',
    unitPrice: '85000.00',
    supplierCode: 'SUP-NAMVIET',
  },
  {
    code: 'LIN-TOW-FACE',
    name: 'Khăn mặt Cotton 34x70cm',
    categoryCode: 'LINEN',
    unit: 'cái',
    description: 'Khăn lau mặt chất liệu cotton mềm hút nước tốt',
    minStockLevel: '50.00',
    initialStock: '220.00',
    unitPrice: '32000.00',
    supplierCode: 'SUP-NAMVIET',
  },
  {
    code: 'LIN-SHEET-K',
    name: 'Ga trải giường King Size T300',
    categoryCode: 'LINEN',
    unit: 'cái',
    description: 'Ga phẳng cotton T300 chống nhăn sọc trắng 3cm kích thước 280x280cm',
    minStockLevel: '30.00',
    initialStock: '95.00',
    unitPrice: '165000.00',
    supplierCode: 'SUP-NAMVIET',
  },
  {
    code: 'LIN-PILLOW',
    name: 'Vỏ gối nằm Cotton 50x70cm',
    categoryCode: 'LINEN',
    unit: 'cái',
    description: 'Vỏ gối sọc trắng viền mí 5cm tiêu chuẩn khách sạn cao cấp',
    minStockLevel: '60.00',
    initialStock: '240.00',
    unitPrice: '45000.00',
    supplierCode: 'SUP-NAMVIET',
  },

  // 3. Cleaning & Chemicals (3 items - SUP-ECOCLEAN)
  {
    code: 'CHEM-FLR-5L',
    name: 'Nước lau sàn Sunlight Can 5L',
    categoryCode: 'CLEANING',
    unit: 'can',
    description: 'Dung dịch lau sàn hương hoa hạ khử khuẩn can lớn 5 lít',
    minStockLevel: '10.00',
    initialStock: '25.00',
    unitPrice: '115000.00',
    supplierCode: 'SUP-ECOCLEAN',
  },
  {
    code: 'CHEM-GLS-5L',
    name: 'Nước lau kính sáng bóng Can 5L',
    categoryCode: 'CLEANING',
    unit: 'can',
    description: 'Nước lau kính chống bám bụi chuyên dụng cho gương và vách kính buồng tắm',
    minStockLevel: '8.00',
    initialStock: '18.00',
    unitPrice: '98000.00',
    supplierCode: 'SUP-ECOCLEAN',
  },
  {
    code: 'CHEM-TISSUE',
    name: 'Giấy vệ sinh cuộn lớn cao cấp 700g',
    categoryCode: 'CLEANING',
    unit: 'cuộn',
    description: 'Giấy vệ sinh cuộn jumbo 2 lớp dùng trong hộp đựng nhà tắm khách sạn',
    minStockLevel: '30.00',
    initialStock: '110.00',
    unitPrice: '28000.00',
    supplierCode: 'SUP-ECOCLEAN',
  },

  // 4. Minibar & Snack (4 items - SUP-ASIA)
  {
    code: 'MB-COKE-330',
    name: 'Nước ngọt Coca Cola lon 320ml',
    categoryCode: 'MINIBAR',
    unit: 'lon',
    description: 'Nước ngọt có gas đóng lon phục vụ minibar có thu phí',
    minStockLevel: '48.00',
    initialStock: '144.00',
    unitPrice: '9200.00',
    supplierCode: 'SUP-ASIA',
  },
  {
    code: 'MB-BEER-HK',
    name: 'Bia Heineken lon 330ml',
    categoryCode: 'MINIBAR',
    unit: 'lon',
    description: 'Bia Heineken lon 330ml ướp lạnh phục vụ minibar có thu phí',
    minStockLevel: '48.00',
    initialStock: '120.00',
    unitPrice: '19000.00',
    supplierCode: 'SUP-ASIA',
  },
  {
    code: 'MB-WATER-LAV',
    name: 'Nước khoáng Lavie 500ml',
    categoryCode: 'MINIBAR',
    unit: 'chai',
    description: 'Nước khoáng thiên nhiên đóng chai Lavie 500ml minibar',
    minStockLevel: '50.00',
    initialStock: '180.00',
    unitPrice: '6500.00',
    supplierCode: 'SUP-ASIA',
  },
  {
    code: 'MB-SNACK-LAY',
    name: 'Khoai tây chiên Lay\'s lon 110g',
    categoryCode: 'MINIBAR',
    unit: 'lon',
    description: 'Snack khoai tây chiên vị tự nhiên lon thiếc đặt tại bàn minibar',
    minStockLevel: '24.00',
    initialStock: '60.00',
    unitPrice: '24000.00',
    supplierCode: 'SUP-ASIA',
  },

  // 5. Engineering & Maintenance (2 items - SUP-TANPHAT)
  {
    code: 'ENG-BULB-9W',
    name: 'Bóng đèn LED Búp tròn 9W Đui E27',
    categoryCode: 'MAINTENANCE',
    unit: 'cái',
    description: 'Bóng đèn LED ánh sáng ấm 3000K thay thế đèn ngủ và đèn hành lang',
    minStockLevel: '20.00',
    initialStock: '8.00', // Low stock demo (< min 20)
    unitPrice: '38000.00',
    supplierCode: 'SUP-TANPHAT',
  },
  {
    code: 'ENG-BAT-AAA',
    name: 'Pin đũa AAA Panasonic Alkaline',
    categoryCode: 'MAINTENANCE',
    unit: 'vỉ',
    description: 'Vỉ 2 viên pin AAA thay thế cho remote tivi và điều hòa phòng khách',
    minStockLevel: '20.00',
    initialStock: '75.00',
    unitPrice: '22000.00',
    supplierCode: 'SUP-TANPHAT',
  },
] as const;

// Helper: Add days to YYYY-MM-DD
function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// ----------------------------------------------------
// MAIN SEED PROCESS (IDEMPOTENT & ENVIRONMENT-AWARE)
// ----------------------------------------------------
async function main() {
  const prisma = scriptPrisma();

  try {
    const nodeEnv = process.env.NODE_ENV || 'development';
    const seedDemoFlag = process.env.SEED_DEMO_DATA;
    const hotelCodeOverride = process.env.SEED_HOTEL_CODE;
    const hotelNameOverride = process.env.SEED_HOTEL_NAME;

    // Safety guard: Demo data must never be seeded into production!
    const shouldSeedDemo = (() => {
      if (nodeEnv === 'production') {
        if (seedDemoFlag === 'true') {
          throw new Error(
            'SEED_DEMO_DATA=true is forbidden in production. ' +
              'Set NODE_ENV=development if you need a local demo dataset.',
          );
        }
        return false;
      }
      if (seedDemoFlag === 'false') return false;
      return true;
    })();

    console.info(
      `🚀 Seed starting | NODE_ENV=${nodeEnv} | SEED_DEMO_DATA=${
        shouldSeedDemo ? 'true' : 'false'
      } | Hotel=${hotelCodeOverride ?? 'MAIN'}`,
    );

    // 1. SEED ROLES (Idempotent upsert)
    for (const [code, name] of roles) {
      await prisma.role.upsert({ where: { code }, create: { code, name }, update: {} });
    }
    console.info('✅ Đã đồng bộ 6 Roles phân quyền.');

    // 2. SEED HOTEL (Idempotent upsert)
    if (Boolean(hotelCodeOverride) !== Boolean(hotelNameOverride)) {
      throw new Error(
        'Supply both SEED_HOTEL_CODE and SEED_HOTEL_NAME to target a specific hotel, or neither.',
      );
    }
    const hotelCode = hotelCodeOverride ?? 'MAIN';
    const hotelName = hotelNameOverride ?? 'Innvyra Hotel';

    const hotel = await prisma.hotel.upsert({
      where: { code: hotelCode },
      create: { code: hotelCode, name: hotelName, timezone: 'Asia/Ho_Chi_Minh' },
      update: { name: hotelName, timezone: 'Asia/Ho_Chi_Minh' },
    });
    console.info(`✅ Khách sạn: ${hotel.name} (Code: ${hotel.code}, ID: ${hotel.id})`);

    if (!shouldSeedDemo) {
      console.info(
        'ℹ️ Skipping demo data (roles + hotel seeded). Set SEED_DEMO_DATA=true to include staff, rooms, guests, inventory.',
      );
      return;
    }

    // ----------------------------------------------------
    // CLEANUP EXISTING DEMO OPERATIONAL RECORDS FOR HOTEL
    // Ensures clean idempotency across re-runs without FK constraint errors.
    // ----------------------------------------------------
    await prisma.roomOccupancy.deleteMany({ where: { hotelId: hotel.id } });
    await prisma.roomTransfer.deleteMany({ where: { hotelId: hotel.id } });
    await prisma.billingAuditLog.deleteMany({ where: { hotelId: hotel.id } });
    await prisma.folioItem.deleteMany({ where: { hotelId: hotel.id } });
    await prisma.payment.deleteMany({ where: { hotelId: hotel.id } });
    await prisma.folio.deleteMany({ where: { hotelId: hotel.id } });
    await prisma.serviceOrderItem.deleteMany({ where: { hotelId: hotel.id } });
    await prisma.serviceOrder.deleteMany({ where: { hotelId: hotel.id } });
    await prisma.stay.deleteMany({ where: { hotelId: hotel.id } });
    await prisma.reservationRoomNight.deleteMany({ where: { reservationRoom: { hotelId: hotel.id } } });
    await prisma.reservationRoom.deleteMany({ where: { hotelId: hotel.id } });
    await prisma.reservation.deleteMany({ where: { hotelId: hotel.id } });
    await prisma.operationsAuditLog.deleteMany({ where: { hotelId: hotel.id } });
    await prisma.housekeepingTask.deleteMany({ where: { hotelId: hotel.id } });
    await prisma.maintenanceBlock.deleteMany({ where: { hotelId: hotel.id } });
    await prisma.maintenanceTicket.deleteMany({ where: { hotelId: hotel.id } });
    await prisma.inventoryMovement.deleteMany({ where: { hotelId: hotel.id } });
    await prisma.stockAdjustment.deleteMany({ where: { hotelId: hotel.id } });
    await prisma.stockIssueItem.deleteMany({ where: { hotelId: hotel.id } });
    await prisma.stockIssue.deleteMany({ where: { hotelId: hotel.id } });
    await prisma.stockReceiptItem.deleteMany({ where: { hotelId: hotel.id } });
    await prisma.stockReceipt.deleteMany({ where: { hotelId: hotel.id } });
    await prisma.guest.deleteMany({ where: { hotelId: hotel.id } });

    // 3. SEED STAFF (18 accounts across shifts, upsert by username — preserves existing password hashes)
    const demoPassword = process.env.SEED_STAFF_PASSWORD || 'Innvyra@Demo2026!';
    const passwordHash = await hashPassword(demoPassword);

    const staffMap = new Map<string, StaffUserModel>();
    for (const [roleCode, username, fullName] of staffAccounts) {
      const role = await prisma.role.findUniqueOrThrow({ where: { code: roleCode } });
      const staff = await prisma.staffUser.upsert({
        where: { username },
        create: {
          hotelId: hotel.id,
          roleId: role.id,
          username,
          fullName,
          passwordHash,
          email: `${username}@innvyra.com`,
          isActive: true,
        },
        update: {
          hotelId: hotel.id,
          roleId: role.id,
          fullName,
          email: `${username}@innvyra.com`,
          isActive: true,
        },
      });
      staffMap.set(username, staff);
    }
    console.info(`✅ Đã đồng bộ ${staffMap.size} nhân sự trải đều các ca trực 24/7.`);

    // 4. SEED ROOM TYPES (upsert by hotel+code)
    const roomTypeMap = new Map<string, RoomTypeModel>();
    for (const rt of roomTypesConfig) {
      const createdRt = await prisma.roomType.upsert({
        where: { hotelId_code: { hotelId: hotel.id, code: rt.code } },
        create: {
          hotelId: hotel.id,
          code: rt.code,
          name: rt.name,
          description: rt.description,
          maxAdults: rt.maxAdults,
          maxChildren: rt.maxChildren,
          basePrice: rt.basePrice,
          isActive: true,
          createdAt: new Date('2026-08-01T00:00:00.000Z'),
        },
        update: {
          name: rt.name,
          description: rt.description,
          maxAdults: rt.maxAdults,
          maxChildren: rt.maxChildren,
          basePrice: rt.basePrice,
          isActive: true,
        },
      });
      roomTypeMap.set(rt.code, createdRt);
    }
    console.info(`✅ Đã đồng bộ 6 Hạng phòng phân cấp kim tự tháp chuẩn.`);

    // 5. SEED PHYSICAL ROOMS (upsert by hotel+roomNumber, resetting physical & housekeeping status)
    const roomMap = new Map<string, RoomModel>();
    for (const [roomNumber, floorNumber, roomTypeCode, physicalStatus, housekeepingStatus] of roomsConfig) {
      const rt = roomTypeMap.get(roomTypeCode)!;
      const room = await prisma.room.upsert({
        where: { hotelId_roomNumber: { hotelId: hotel.id, roomNumber } },
        create: {
          hotelId: hotel.id,
          roomTypeId: rt.id,
          roomNumber,
          floorNumber,
          physicalStatus,
          housekeepingStatus,
          notes: `Phòng ${roomNumber} - Tầng ${floorNumber} (${rt.name})`,
          createdAt: new Date('2026-08-01T00:00:00.000Z'),
        },
        update: {
          roomTypeId: rt.id,
          floorNumber,
          physicalStatus,
          housekeepingStatus,
          notes: `Phòng ${roomNumber} - Tầng ${floorNumber} (${rt.name})`,
        },
      });
      roomMap.set(roomNumber, room);
    }
    console.info(`✅ Đã đồng bộ 40 Phòng vật lý (Tầng 1–4, mỗi tầng 10 phòng: 101–410).`);

    // 6. SEED SERVICES (upsert by hotel+code)
    const serviceMap = new Map<string, ServiceModel>();
    for (const srv of servicesConfig) {
      const s = await prisma.service.upsert({
        where: { hotelId_code: { hotelId: hotel.id, code: srv.code } },
        create: {
          hotelId: hotel.id,
          code: srv.code,
          name: srv.name,
          unit: srv.unit,
          price: srv.price,
          isActive: true,
        },
        update: {
          name: srv.name,
          unit: srv.unit,
          price: srv.price,
          isActive: true,
        },
      });
      serviceMap.set(srv.code, s);
    }
    console.info(`✅ Đã đồng bộ 5 Dịch vụ khách sạn (Massage thư giãn, thuê xe máy, giặt ủi, buffet, xe đưa đón).`);

    // 7. SEED GUESTS (35 demo guests with encrypted/hashed document numbers)
    const crypto =
      process.env.GUEST_ENCRYPTION_KEY && process.env.GUEST_HASH_KEY
        ? new GuestCrypto({
            GUEST_ENCRYPTION_KEY: process.env.GUEST_ENCRYPTION_KEY,
            GUEST_HASH_KEY: process.env.GUEST_HASH_KEY,
          })
        : null;

    const guestList: GuestModel[] = [];
    for (const g of demoGuests) {
      const createdGuest = await prisma.guest.create({
        data: {
          hotelId: hotel.id,
          fullName: g.fullName,
          phone: g.phone,
          email: g.email,
          gender: g.gender,
          nationality: g.nationality,
          documentType: g.docType,
          documentNumberCiphertext: crypto ? crypto.encrypt(hotel.id, g.docNum) : null,
          documentNumberHash: crypto ? crypto.fingerprint(hotel.id, g.docNum) : null,
          address: g.address,
          notes: `Hồ sơ khách hàng định danh: ${g.fullName}`,
        },
      });
      guestList.push(createdGuest);
    }
    console.info(`✅ Đã mã hóa và tạo 35 Hồ sơ khách hàng lưu trú.`);

    // 8. OPERATIONAL DATA (Relative to Hotel Reference Date)
    const today = hotelToday(hotel.timezone);
    console.info(`📅 Ngày tham chiếu khách sạn hôm nay: ${today}`);

    const receptionist = staffMap.get('receptionist')!;
    const accountant = staffMap.get('accountant')!;
    const technician = staffMap.get('technician')!;
    const techLong = staffMap.get('tech_long')!;
    const hkLead = staffMap.get('housekeeping')!;
    const hkMai = staffMap.get('hk_mai')!;
    const hkTuan = staffMap.get('hk_tuan')!;
    const hkCuc = staffMap.get('hk_cuc')!;

    const validBookingSources = ['DIRECT', 'PHONE', 'EMAIL', 'WALK_IN', 'AGENT', 'OTHER'] as const;

    // A. 20 IN-HOUSE STAYS (Active Occupied Rooms)
    // Distributed realistically across all 6 room types
    const occupiedRoomNumbers = [
      '101',               // STD-SGL (1)
      '105', '106', '109', '201', '202', // STD-DBL (5)
      '205', '207', '210', // SUP-TWN (3)
      '204',               // STD-DBL (transferred from 203)
      '301', '302', '305', '306', '308', // SUP-DBL (5)
      '309', '401', '402', '404', '405', // DLX-BALCONY (5)
      '407', '409',        // SUITE-EXEC (2)
    ].slice(0, 20); // Exactly 20 rooms

    let guestIdx = 0;
    for (let i = 0; i < occupiedRoomNumbers.length; i++) {
      const roomNum = occupiedRoomNumbers[i]!;
      const room = roomMap.get(roomNum)!;
      const rt = roomTypeMap.get(room.roomTypeId ? (Array.from(roomTypeMap.values()).find(t => t.id === room.roomTypeId)?.code ?? 'STD-DBL') : 'STD-DBL')!;
      const guest = guestList[guestIdx++ % guestList.length]!;

      // Realistic past check-in and future checkout relative to hotelToday
      const stayDaysAgo = (i % 3) + 1; // 1 to 3 days ago
      const stayDaysAhead = (i % 2) + 2; // 2 to 3 days in future
      const checkInDate = addDays(today, -stayDaysAgo);
      const checkOutDate = addDays(today, stayDaysAhead);
      const totalNights = stayDaysAgo + stayDaysAhead;
      const totalRate = parseFloat(rt.basePrice.toString()) * totalNights;
      const bookingCreatedAt = new Date(`${addDays(checkInDate, -3)}T10:00:00.000Z`);

      // 1. Reservation (CHECKED_IN)
      const res = await prisma.reservation.create({
        data: {
          hotelId: hotel.id,
          confirmationCode: `RES-IN-${roomNum}`,
          bookerGuestId: guest.id,
          checkInDate: new Date(`${checkInDate}T00:00:00.000Z`),
          checkOutDate: new Date(`${checkOutDate}T00:00:00.000Z`),
          status: 'CHECKED_IN',
          bookingSource: validBookingSources[i % validBookingSources.length] ?? 'DIRECT',
          totalAmount: totalRate.toFixed(2),
          createdBy: receptionist.id,
          createdAt: bookingCreatedAt,
        },
      });

      // 2. ReservationRoom (Capacity invariant: adults clamped to maxAdults)
      const adultsCount = Math.min(2, rt.maxAdults);
      const resRoom = await prisma.reservationRoom.create({
        data: {
          hotelId: hotel.id,
          reservationId: res.id,
          roomTypeId: rt.id,
          roomId: room.id,
          adults: adultsCount,
          children: 0,
          createdAt: bookingCreatedAt,
        },
      });

      // 3. ReservationRoomNights (Full nightly price snapshots for entire booking)
      const nightRecords = [];
      for (let n = 0; n < totalNights; n++) {
        const stayDate = addDays(checkInDate, n);
        const night = await prisma.reservationRoomNight.create({
          data: {
            reservationRoomId: resRoom.id,
            stayDate: new Date(`${stayDate}T00:00:00.000Z`),
            nightlyRate: rt.basePrice,
          },
        });
        nightRecords.push(night);
      }

      // 4. Stay (CHECKED_IN)
      const stay = await prisma.stay.create({
        data: {
          hotelId: hotel.id,
          roomTypeId: rt.id,
          reservationRoomId: resRoom.id,
          currentRoomId: room.id,
          status: 'CHECKED_IN',
          actualCheckinAt: new Date(`${checkInDate}T14:30:00.000Z`),
          checkinStaffId: receptionist.id,
          checkinNotes: `Khách đã làm thủ tục nhận phòng ${roomNum} tại quầy lễ tân.`,
        },
      });

      // 5. RoomOccupancy (Enforces matrix and dashboard occupied state)
      await prisma.roomOccupancy.create({
        data: {
          hotelId: hotel.id,
          roomTypeId: rt.id,
          roomId: room.id,
          stayId: stay.id,
          occupiedAt: new Date(`${checkInDate}T14:30:00.000Z`),
        },
      });

      // 5b. Room Transfer demonstration (Room 204 transferred from Room 203 yesterday)
      if (roomNum === '204') {
        const previousRoom = roomMap.get('203')!;
        const transferTime = new Date(`${addDays(today, -1)}T10:00:00.000Z`);
        await prisma.roomTransfer.create({
          data: {
            hotelId: hotel.id,
            roomTypeId: rt.id,
            stayId: stay.id,
            fromRoomId: previousRoom.id,
            toRoomId: room.id,
            transferredBy: receptionist.id,
            transferredAt: transferTime,
            reason: 'Khách muốn đổi sang phòng yên tĩnh hơn hướng vườn',
            createdAt: transferTime,
          },
        });
      }

      // 6. Folio (OPEN)
      const folio = await prisma.folio.create({
        data: {
          hotelId: hotel.id,
          reservationId: res.id,
          currency: 'VND',
          status: 'OPEN',
          openedAt: new Date(`${checkInDate}T14:30:00.000Z`),
        },
      });

      await prisma.billingAuditLog.create({
        data: {
          hotelId: hotel.id,
          actorId: receptionist.id,
          action: 'FOLIO_OPENED',
          entityId: folio.id,
          createdAt: new Date(`${checkInDate}T14:30:00.000Z`),
        },
      });

      // 7. Folio Items: Upfront room night debits matching BillingService.openFolio()
      let totalFolioDebit = 0;
      for (let n = 0; n < totalNights; n++) {
        const night = nightRecords[n]!;
        const nightCost = parseFloat(rt.basePrice.toString());
        totalFolioDebit += nightCost;
        await prisma.folioItem.create({
          data: {
            hotelId: hotel.id,
            folioId: folio.id,
            entryType: 'DEBIT',
            sourceType: 'ROOM_NIGHT',
            roomNightId: night.id,
            sourceId: night.id,
            amount: rt.basePrice,
            description: `Tiền phòng ${roomNum} (${night.stayDate.toISOString().slice(0, 10)})`,
            createdBy: accountant.id,
            createdAt: new Date(`${checkInDate}T14:30:00.000Z`),
          },
        });
      }

      // 8. Service charges and orders for active stays
      let extraServiceAmount = 0;
      if (i % 2 === 0) {
        const motorbikeService = serviceMap.get('SRV-MOTORBIKE')!;
        extraServiceAmount = 150000; // 1 ngày thuê xe máy

        const srvOrder = await prisma.serviceOrder.create({
          data: {
            hotelId: hotel.id,
            reservationId: res.id,
            stayId: stay.id,
            status: 'COMPLETED',
            notes: `Khách thuê xe máy tay ga di chuyển trong ngày (Phòng ${roomNum})`,
            createdBy: receptionist.id,
            completedBy: receptionist.id,
            createdAt: new Date(`${today}T09:30:00.000Z`),
            completedAt: new Date(`${today}T10:00:00.000Z`),
          },
        });

        const srvItem = await prisma.serviceOrderItem.create({
          data: {
            hotelId: hotel.id,
            serviceOrderId: srvOrder.id,
            serviceId: motorbikeService.id,
            nameSnapshot: motorbikeService.name,
            unitSnapshot: motorbikeService.unit,
            quantity: 1,
            unitPriceSnapshot: motorbikeService.price,
            lineTotal: '150000.00',
            createdAt: new Date(`${today}T09:30:00.000Z`),
          },
        });

        await prisma.folioItem.create({
          data: {
            hotelId: hotel.id,
            folioId: folio.id,
            entryType: 'DEBIT',
            sourceType: 'SERVICE_ORDER_ITEM',
            sourceId: srvItem.id,
            serviceOrderItemId: srvItem.id,
            amount: '150000.00',
            description: `${srvItem.nameSnapshot} (${srvItem.quantity} ${srvItem.unitSnapshot})`,
            createdBy: receptionist.id,
            createdAt: new Date(`${today}T10:00:00.000Z`),
          },
        });

        await prisma.billingAuditLog.create({
          data: {
            hotelId: hotel.id,
            actorId: receptionist.id,
            action: 'ORDER_COMPLETED',
            entityId: srvOrder.id,
            createdAt: new Date(`${today}T10:00:00.000Z`),
          },
        });
        totalFolioDebit += extraServiceAmount;
      } else if (i === 1) {
        // Pending request: 1 Massage thư giãn cho Phòng 105
        const massageService = serviceMap.get('SRV-MASSAGE')!;
        const pendingOrder = await prisma.serviceOrder.create({
          data: {
            hotelId: hotel.id,
            reservationId: res.id,
            stayId: stay.id,
            status: 'REQUESTED',
            notes: `Khách đăng ký 1 liệu trình massage thư giãn toàn thân tại phòng ${roomNum}`,
            createdBy: receptionist.id,
            createdAt: new Date(`${today}T11:15:00.000Z`),
          },
        });
        await prisma.serviceOrderItem.create({
          data: {
            hotelId: hotel.id,
            serviceOrderId: pendingOrder.id,
            serviceId: massageService.id,
            nameSnapshot: massageService.name,
            unitSnapshot: massageService.unit,
            quantity: 1,
            unitPriceSnapshot: massageService.price,
            lineTotal: '350000.00',
            createdAt: new Date(`${today}T11:15:00.000Z`),
          },
        });
      } else if (i === 3) {
        // Pending request: 2 Breakfast buffet for Room 109
        const bfService = serviceMap.get('SRV-BREAKFAST')!;
        const pendingOrder = await prisma.serviceOrder.create({
          data: {
            hotelId: hotel.id,
            reservationId: res.id,
            stayId: stay.id,
            status: 'REQUESTED',
            notes: `Khách đăng ký 2 suất ăn sáng buffet tại nhà hàng`,
            createdBy: receptionist.id,
            createdAt: new Date(`${today}T12:00:00.000Z`),
          },
        });
        await prisma.serviceOrderItem.create({
          data: {
            hotelId: hotel.id,
            serviceOrderId: pendingOrder.id,
            serviceId: bfService.id,
            nameSnapshot: bfService.name,
            unitSnapshot: bfService.unit,
            quantity: 2,
            unitPriceSnapshot: bfService.price,
            lineTotal: '360000.00',
            createdAt: new Date(`${today}T12:00:00.000Z`),
          },
        });
      } else if (i === 5) {
        // Pending request: 3 kg Laundry for Room 202
        const laundryService = serviceMap.get('SRV-LAUNDRY')!;
        const pendingOrder = await prisma.serviceOrder.create({
          data: {
            hotelId: hotel.id,
            reservationId: res.id,
            stayId: stay.id,
            status: 'REQUESTED',
            notes: `Giặt ủi quần áo lấy ngay trong ngày`,
            createdBy: receptionist.id,
            createdAt: new Date(`${today}T13:30:00.000Z`),
          },
        });
        await prisma.serviceOrderItem.create({
          data: {
            hotelId: hotel.id,
            serviceOrderId: pendingOrder.id,
            serviceId: laundryService.id,
            nameSnapshot: laundryService.name,
            unitSnapshot: laundryService.unit,
            quantity: 3,
            unitPriceSnapshot: laundryService.price,
            lineTotal: '150000.00',
            createdAt: new Date(`${today}T13:30:00.000Z`),
          },
        });
      } else if (i === 7) {
        // Cancelled request: Airport shuttle for Room 205
        const airportService = serviceMap.get('SRV-AIRPORT')!;
        const cancelledOrder = await prisma.serviceOrder.create({
          data: {
            hotelId: hotel.id,
            reservationId: res.id,
            stayId: stay.id,
            status: 'CANCELLED',
            notes: `Khách đặt xe tiễn sân bay nhưng sau đó báo hủy`,
            createdBy: receptionist.id,
            createdAt: new Date(`${today}T08:00:00.000Z`),
            cancelledBy: receptionist.id,
            cancelledAt: new Date(`${today}T09:00:00.000Z`),
            cancellationReason: 'Khách tự bắt taxi đi cùng bạn nên không dùng xe khách sạn',
          },
        });
        await prisma.serviceOrderItem.create({
          data: {
            hotelId: hotel.id,
            serviceOrderId: cancelledOrder.id,
            serviceId: airportService.id,
            nameSnapshot: airportService.name,
            unitSnapshot: airportService.unit,
            quantity: 1,
            unitPriceSnapshot: airportService.price,
            lineTotal: '350000.00',
            createdAt: new Date(`${today}T08:00:00.000Z`),
          },
        });
        await prisma.billingAuditLog.create({
          data: {
            hotelId: hotel.id,
            actorId: receptionist.id,
            action: 'ORDER_CANCELLED',
            entityId: cancelledOrder.id,
            reason: 'Khách tự bắt taxi đi cùng bạn nên không dùng xe khách sạn',
            createdAt: new Date(`${today}T09:00:00.000Z`),
          },
        });
      }

      // 9. Payments (Invariants: Payment/Deposit amount must NOT exceed outstanding balance)
      if (i < 10) {
        // Scenario A (Balanced - Full Payment): Guest fully paid at check-in
        const payment = await prisma.payment.create({
          data: {
            hotelId: hotel.id,
            folioId: folio.id,
            paymentType: 'PAYMENT',
            paymentMethod: i % 2 === 0 ? 'BANK_TRANSFER' : 'CASH',
            amount: totalFolioDebit.toFixed(2),
            status: 'CONFIRMED',
            referenceNumber: `PAY-REC-${roomNum}`,
            processedBy: receptionist.id,
            processedAt: new Date(`${checkInDate}T14:45:00.000Z`),
          },
        });
        await prisma.billingAuditLog.create({
          data: {
            hotelId: hotel.id,
            actorId: receptionist.id,
            action: 'PAYMENT_RECORDED',
            entityId: payment.id,
            createdAt: new Date(`${checkInDate}T14:45:00.000Z`),
          },
        });
      } else if (i < 16) {
        // Scenario B (Partial Payment / Deposit): Guest paid a partial deposit, outstanding debt remains
        const partialAmount = Math.min(500000, totalFolioDebit);
        const payment = await prisma.payment.create({
          data: {
            hotelId: hotel.id,
            folioId: folio.id,
            paymentType: 'DEPOSIT',
            paymentMethod: 'CASH',
            amount: partialAmount.toFixed(2),
            status: 'CONFIRMED',
            referenceNumber: `DEP-PARTIAL-${roomNum}`,
            processedBy: receptionist.id,
            processedAt: new Date(`${checkInDate}T15:00:00.000Z`),
          },
        });
        await prisma.billingAuditLog.create({
          data: {
            hotelId: hotel.id,
            actorId: receptionist.id,
            action: 'DEPOSIT_RECORDED',
            entityId: payment.id,
            createdAt: new Date(`${checkInDate}T15:00:00.000Z`),
          },
        });
      }
      // Scenario C (Unpaid): Folios 16-19 have 0 payments, customer owes full amount upon checkout
    }
    console.info(`✅ Đã tạo 20 Ca lưu trú đang ở thực tế (In-House Stays) kèm hóa đơn Folio hợp lệ.`);

    // B. 6 EXPECTED ARRIVALS (TODAY CONFIRMED BOOKINGS)
    // Physical room is NOT assigned before check-in (roomId: null). Room type is booked.
    const arrivalRooms = [
      { targetRoom: '102', rtCode: 'STD-SGL' },
      { targetRoom: '107', rtCode: 'STD-DBL' },
      { targetRoom: '203', rtCode: 'STD-DBL' },
      { targetRoom: '208', rtCode: 'SUP-TWN' },
      { targetRoom: '303', rtCode: 'SUP-DBL' },
      { targetRoom: '403', rtCode: 'DLX-BALCONY' },
    ];

    for (let i = 0; i < arrivalRooms.length; i++) {
      const arr = arrivalRooms[i]!;
      const rt = roomTypeMap.get(arr.rtCode)!;
      const guest = guestList[guestIdx++ % guestList.length]!;

      const checkInDate = today;
      const checkOutDate = addDays(today, 2);
      const totalNights = 2;
      const totalRate = parseFloat(rt.basePrice.toString()) * totalNights;
      const bookingCreatedAt = new Date(`${addDays(today, -2)}T09:30:00.000Z`);

      const res = await prisma.reservation.create({
        data: {
          hotelId: hotel.id,
          confirmationCode: `RES-ARR-${arr.targetRoom}`,
          bookerGuestId: guest.id,
          checkInDate: new Date(`${checkInDate}T00:00:00.000Z`),
          checkOutDate: new Date(`${checkOutDate}T00:00:00.000Z`),
          status: 'CONFIRMED',
          bookingSource: validBookingSources[(i + 1) % validBookingSources.length] ?? 'DIRECT',
          totalAmount: totalRate.toFixed(2),
          createdBy: receptionist.id,
          createdAt: bookingCreatedAt,
        },
      });

      const resRoom = await prisma.reservationRoom.create({
        data: {
          hotelId: hotel.id,
          reservationId: res.id,
          roomTypeId: rt.id,
          roomId: null, // roomId is null until actual check-in!
          adults: Math.min(2, rt.maxAdults),
          children: 0,
          createdAt: bookingCreatedAt,
        },
      });

      for (let n = 0; n < totalNights; n++) {
        const stayDate = addDays(checkInDate, n);
        await prisma.reservationRoomNight.create({
          data: {
            reservationRoomId: resRoom.id,
            stayDate: new Date(`${stayDate}T00:00:00.000Z`),
            nightlyRate: rt.basePrice,
          },
        });
      }
    }
    console.info(`✅ Đã tạo 6 Đơn đặt phòng dự kiến đến hôm nay (Expected Arrivals, roomId: null).`);

    // C. 4 UNASSIGNED FUTURE RESERVATIONS
    const unassignedTypes = ['STD-DBL', 'SUP-DBL', 'DLX-BALCONY', 'SUITE-EXEC'];
    for (let i = 0; i < unassignedTypes.length; i++) {
      const rtCode = unassignedTypes[i]!;
      const rt = roomTypeMap.get(rtCode)!;
      const guest = guestList[guestIdx++ % guestList.length]!;

      const checkInDate = addDays(today, 1);
      const checkOutDate = addDays(today, 3);
      const totalNights = 2;
      const totalRate = parseFloat(rt.basePrice.toString()) * totalNights;
      const bookingCreatedAt = new Date(`${addDays(today, -1)}T11:00:00.000Z`);

      const res = await prisma.reservation.create({
        data: {
          hotelId: hotel.id,
          confirmationCode: `RES-UNASSIGN-0${i + 1}`,
          bookerGuestId: guest.id,
          checkInDate: new Date(`${checkInDate}T00:00:00.000Z`),
          checkOutDate: new Date(`${checkOutDate}T00:00:00.000Z`),
          status: 'CONFIRMED',
          bookingSource: validBookingSources[(i + 3) % validBookingSources.length] ?? 'DIRECT',
          totalAmount: totalRate.toFixed(2),
          createdBy: receptionist.id,
          createdAt: bookingCreatedAt,
        },
      });

      const resRoom = await prisma.reservationRoom.create({
        data: {
          hotelId: hotel.id,
          reservationId: res.id,
          roomTypeId: rt.id,
          roomId: null, // UNASSIGNED!
          adults: Math.min(2, rt.maxAdults),
          children: 0,
          createdAt: bookingCreatedAt,
        },
      });

      for (let n = 0; n < totalNights; n++) {
        const stayDate = addDays(checkInDate, n);
        await prisma.reservationRoomNight.create({
          data: {
            reservationRoomId: resRoom.id,
            stayDate: new Date(`${stayDate}T00:00:00.000Z`),
            nightlyRate: rt.basePrice,
          },
        });
      }
    }
    console.info(`✅ Đã tạo 4 Đặt phòng chưa gán phòng (Unassigned Bookings) để test Matrix.`);

    // D. 10 PAST CHECKED-OUT STAYS (Distributed across past 11 days for natural reporting)
    const pastStaysConfig = [
      { roomNum: '103', checkInDaysAgo: 5, stayNights: 4 },
      { roomNum: '110', checkInDaysAgo: 6, stayNights: 4 },
      { roomNum: '307', checkInDaysAgo: 7, stayNights: 4 },
      { roomNum: '410', checkInDaysAgo: 4, stayNights: 3 },
      { roomNum: '102', checkInDaysAgo: 9, stayNights: 3 },
      { roomNum: '107', checkInDaysAgo: 10, stayNights: 3 },
      { roomNum: '203', checkInDaysAgo: 8, stayNights: 4 },
      { roomNum: '208', checkInDaysAgo: 11, stayNights: 3 },
      { roomNum: '303', checkInDaysAgo: 7, stayNights: 3 },
      { roomNum: '403', checkInDaysAgo: 6, stayNights: 4 },
    ];

    for (let i = 0; i < pastStaysConfig.length; i++) {
      const item = pastStaysConfig[i]!;
      const guest = guestList[guestIdx++ % guestList.length]!;
      const targetRoom = roomMap.get(item.roomNum)!;
      const rt = roomTypeMap.get(targetRoom.roomTypeId ? (Array.from(roomTypeMap.values()).find(t => t.id === targetRoom.roomTypeId)?.code ?? 'STD-DBL') : 'STD-DBL')!;
      const checkInDate = addDays(today, -item.checkInDaysAgo);
      const checkOutDate = addDays(checkInDate, item.stayNights);
      const pastTotalAmount = (parseFloat(rt.basePrice.toString()) * item.stayNights).toFixed(2);
      const bookingCreatedAt = new Date(`${addDays(checkInDate, -3)}T08:00:00.000Z`);

      const res = await prisma.reservation.create({
        data: {
          hotelId: hotel.id,
          confirmationCode: `RES-PAST-0${i + 1}`,
          bookerGuestId: guest.id,
          checkInDate: new Date(`${checkInDate}T00:00:00.000Z`),
          checkOutDate: new Date(`${checkOutDate}T00:00:00.000Z`),
          status: 'CHECKED_OUT',
          bookingSource: validBookingSources[i % validBookingSources.length] ?? 'DIRECT',
          totalAmount: pastTotalAmount,
          createdBy: receptionist.id,
          createdAt: bookingCreatedAt,
        },
      });

      const resRoom = await prisma.reservationRoom.create({
        data: {
          hotelId: hotel.id,
          reservationId: res.id,
          roomTypeId: rt.id,
          roomId: targetRoom.id,
          adults: Math.min(2, rt.maxAdults),
          children: 0,
          createdAt: bookingCreatedAt,
        },
      });

      await prisma.stay.create({
        data: {
          hotelId: hotel.id,
          roomTypeId: rt.id,
          reservationRoomId: resRoom.id,
          currentRoomId: targetRoom.id,
          status: 'CHECKED_OUT',
          actualCheckinAt: new Date(`${checkInDate}T14:15:00.000Z`),
          actualCheckoutAt: new Date(`${checkOutDate}T11:30:00.000Z`),
          checkinStaffId: receptionist.id,
          checkoutStaffId: receptionist.id,
          createdAt: new Date(`${checkInDate}T14:15:00.000Z`),
        },
      });

      const folio = await prisma.folio.create({
        data: {
          hotelId: hotel.id,
          reservationId: res.id,
          currency: 'VND',
          status: 'CLOSED',
          openedAt: new Date(`${checkInDate}T14:15:00.000Z`),
          closedAt: new Date(`${checkOutDate}T11:30:00.000Z`),
          createdAt: new Date(`${checkInDate}T14:15:00.000Z`),
        },
      });

      await prisma.billingAuditLog.create({
        data: {
          hotelId: hotel.id,
          actorId: receptionist.id,
          action: 'FOLIO_OPENED',
          entityId: folio.id,
          createdAt: new Date(`${checkInDate}T14:15:00.000Z`),
        },
      });

      for (let n = 0; n < item.stayNights; n++) {
        const pastNight = await prisma.reservationRoomNight.create({
          data: {
            reservationRoomId: resRoom.id,
            stayDate: new Date(`${addDays(checkInDate, n)}T00:00:00.000Z`),
            nightlyRate: rt.basePrice,
          },
        });
        await prisma.folioItem.create({
          data: {
            hotelId: hotel.id,
            folioId: folio.id,
            entryType: 'DEBIT',
            sourceType: 'ROOM_NIGHT',
            roomNightId: pastNight.id,
            sourceId: pastNight.id,
            amount: rt.basePrice,
            description: `Tiền phòng ${item.roomNum} (${pastNight.stayDate.toISOString().slice(0, 10)})`,
            createdBy: accountant.id,
            createdAt: new Date(`${addDays(checkInDate, n)}T23:59:00.000Z`),
          },
        });
      }

      const pastPayment = await prisma.payment.create({
        data: {
          hotelId: hotel.id,
          folioId: folio.id,
          paymentType: 'PAYMENT',
          paymentMethod: i % 2 === 0 ? 'BANK_TRANSFER' : 'CASH',
          amount: pastTotalAmount,
          status: 'CONFIRMED',
          referenceNumber: `PAST-SETTLED-0${i + 1}`,
          processedBy: accountant.id,
          processedAt: new Date(`${checkOutDate}T11:25:00.000Z`),
        },
      });

      await prisma.billingAuditLog.create({
        data: {
          hotelId: hotel.id,
          actorId: accountant.id,
          action: 'PAYMENT_RECORDED',
          entityId: pastPayment.id,
          createdAt: new Date(`${checkOutDate}T11:25:00.000Z`),
        },
      });

      await prisma.billingAuditLog.create({
        data: {
          hotelId: hotel.id,
          actorId: accountant.id,
          action: 'FOLIO_CLOSED',
          entityId: folio.id,
          createdAt: new Date(`${checkOutDate}T11:30:00.000Z`),
        },
      });
    }
    console.info(`✅ Đã tạo 10 Lịch sử lưu trú quá khứ đã trả phòng và tất toán hoàn tất.`);

    // E. 3 CANCELLED RESERVATIONS
    const cancelledConfig = [
      { daysAgoCreated: 8, daysAgoCancelled: 6, source: 'PHONE' as const },
      { daysAgoCreated: 5, daysAgoCancelled: 3, source: 'EMAIL' as const },
      { daysAgoCreated: 3, daysAgoCancelled: 1, source: 'AGENT' as const },
    ];
    for (let i = 0; i < cancelledConfig.length; i++) {
      const cfg = cancelledConfig[i]!;
      const rtDef = roomTypesConfig[i % roomTypesConfig.length]!;
      const rtRecord = roomTypeMap.get(rtDef.code)!;
      const guest = guestList[guestIdx++ % guestList.length]!;
      const checkInDate = addDays(today, 2 + i);
      const checkOutDate = addDays(checkInDate, 2);
      const totalRate = (parseFloat(rtRecord.basePrice.toString()) * 2).toFixed(2);
      const createdDate = new Date(`${addDays(today, -cfg.daysAgoCreated)}T09:00:00.000Z`);
      const cancelledDate = new Date(`${addDays(today, -cfg.daysAgoCancelled)}T14:00:00.000Z`);

      const res = await prisma.reservation.create({
        data: {
          hotelId: hotel.id,
          confirmationCode: `RES-CANC-0${i + 1}`,
          bookerGuestId: guest.id,
          checkInDate: new Date(`${checkInDate}T00:00:00.000Z`),
          checkOutDate: new Date(`${checkOutDate}T00:00:00.000Z`),
          status: 'CANCELLED',
          bookingSource: cfg.source,
          totalAmount: totalRate,
          createdBy: receptionist.id,
          createdAt: createdDate,
          cancelledAt: cancelledDate,
          cancelledBy: receptionist.id,
          cancellationReason: 'Khách thay đổi lịch công tác đột xuất',
        },
      });

      const resRoom = await prisma.reservationRoom.create({
        data: {
          hotelId: hotel.id,
          reservationId: res.id,
          roomTypeId: rtRecord.id,
          roomId: null,
          adults: Math.min(2, rtRecord.maxAdults),
          children: 0,
          createdAt: createdDate,
        },
      });

      for (let n = 0; n < 2; n++) {
        const stayDate = addDays(checkInDate, n);
        await prisma.reservationRoomNight.create({
          data: {
            reservationRoomId: resRoom.id,
            stayDate: new Date(`${stayDate}T00:00:00.000Z`),
            nightlyRate: rtRecord.basePrice,
          },
        });
      }
    }
    console.info(`✅ Đã tạo 3 Đơn đặt phòng đã hủy (Cancelled Reservations).`);

    // F. 2 NO-SHOW RESERVATIONS
    const noShowConfig = [
      { daysAgoCreated: 6, checkInDaysAgo: 3, source: 'DIRECT' as const },
      { daysAgoCreated: 5, checkInDaysAgo: 2, source: 'WALK_IN' as const },
    ];
    for (let i = 0; i < noShowConfig.length; i++) {
      const cfg = noShowConfig[i]!;
      const rtDef = roomTypesConfig[(i + 2) % roomTypesConfig.length]!;
      const rtRecord = roomTypeMap.get(rtDef.code)!;
      const guest = guestList[guestIdx++ % guestList.length]!;
      const checkInDate = addDays(today, -cfg.checkInDaysAgo);
      const checkOutDate = addDays(checkInDate, 2);
      const totalRate = (parseFloat(rtRecord.basePrice.toString()) * 2).toFixed(2);
      const createdDate = new Date(`${addDays(today, -cfg.daysAgoCreated)}T11:00:00.000Z`);

      const res = await prisma.reservation.create({
        data: {
          hotelId: hotel.id,
          confirmationCode: `RES-NOSHOW-0${i + 1}`,
          bookerGuestId: guest.id,
          checkInDate: new Date(`${checkInDate}T00:00:00.000Z`),
          checkOutDate: new Date(`${checkOutDate}T00:00:00.000Z`),
          status: 'NO_SHOW',
          bookingSource: cfg.source,
          totalAmount: totalRate,
          createdBy: receptionist.id,
          createdAt: createdDate,
        },
      });

      const resRoom = await prisma.reservationRoom.create({
        data: {
          hotelId: hotel.id,
          reservationId: res.id,
          roomTypeId: rtRecord.id,
          roomId: null,
          adults: Math.min(2, rtRecord.maxAdults),
          children: 0,
          createdAt: createdDate,
        },
      });

      for (let n = 0; n < 2; n++) {
        const stayDate = addDays(checkInDate, n);
        await prisma.reservationRoomNight.create({
          data: {
            reservationRoomId: resRoom.id,
            stayDate: new Date(`${stayDate}T00:00:00.000Z`),
            nightlyRate: rtRecord.basePrice,
          },
        });
      }
    }
    console.info(`✅ Đã tạo 2 Đơn đặt phòng khách không đến (No-Show Reservations).`);

    // G. HOUSEKEEPING TASKS & OPERATIONS AUDIT LOGS
    // 1. DIRTY rooms -> PENDING tasks
    const dirtyRooms = ['103', '110', '307', '410'];
    for (const rNum of dirtyRooms) {
      const room = roomMap.get(rNum)!;
      const task = await prisma.housekeepingTask.create({
        data: {
          hotelId: hotel.id,
          roomId: room.id,
          activeRoomId: room.id,
          status: 'PENDING',
          priority: 'NORMAL',
          notes: `Khách trả phòng lúc 11h30, cần dọn dẹp thay ga gối phòng ${rNum}`,
          createdBy: hkLead.id,
        },
      });

      await prisma.operationsAuditLog.create({
        data: {
          hotelId: hotel.id,
          actorId: hkLead.id,
          taskId: task.id,
          action: 'TASK_CREATED',
          toStatus: 'PENDING',
          notes: task.notes,
        },
      });
    }

    // 2. CLEANING rooms -> IN_PROGRESS tasks
    const cleaningRoom1 = roomMap.get('108')!;
    const taskCleaning1 = await prisma.housekeepingTask.create({
      data: {
        hotelId: hotel.id,
        roomId: cleaningRoom1.id,
        activeRoomId: cleaningRoom1.id,
        status: 'IN_PROGRESS',
        priority: 'NORMAL',
        assignedTo: hkMai.id,
        startedAt: new Date(`${today}T08:30:00.000Z`),
        notes: 'Đang hút bụi và khử khuẩn phòng tắm',
        createdBy: hkLead.id,
      },
    });

    await prisma.operationsAuditLog.create({
      data: {
        hotelId: hotel.id,
        actorId: hkLead.id,
        taskId: taskCleaning1.id,
        action: 'TASK_CREATED',
        toStatus: 'PENDING',
        notes: taskCleaning1.notes,
        createdAt: new Date(`${today}T08:00:00.000Z`),
      },
    });
    await prisma.operationsAuditLog.create({
      data: {
        hotelId: hotel.id,
        actorId: hkLead.id,
        taskId: taskCleaning1.id,
        action: 'TASK_ASSIGNED',
        toStatus: 'PENDING',
        notes: `Assigned to staff ${hkMai.id}`,
        createdAt: new Date(`${today}T08:15:00.000Z`),
      },
    });
    await prisma.operationsAuditLog.create({
      data: {
        hotelId: hotel.id,
        actorId: hkMai.id,
        taskId: taskCleaning1.id,
        action: 'TASK_START',
        fromStatus: 'PENDING',
        toStatus: 'IN_PROGRESS',
        createdAt: new Date(`${today}T08:30:00.000Z`),
      },
    });

    const cleaningRoom2 = roomMap.get('304')!;
    const taskCleaning2 = await prisma.housekeepingTask.create({
      data: {
        hotelId: hotel.id,
        roomId: cleaningRoom2.id,
        activeRoomId: cleaningRoom2.id,
        status: 'IN_PROGRESS',
        priority: 'HIGH',
        assignedTo: hkTuan.id,
        startedAt: new Date(`${today}T09:00:00.000Z`),
        notes: 'Phòng khách VIP đến sớm, ưu tiên dọn nhanh',
        createdBy: hkLead.id,
      },
    });

    await prisma.operationsAuditLog.create({
      data: {
        hotelId: hotel.id,
        actorId: hkLead.id,
        taskId: taskCleaning2.id,
        action: 'TASK_CREATED',
        toStatus: 'PENDING',
        notes: taskCleaning2.notes,
        createdAt: new Date(`${today}T08:45:00.000Z`),
      },
    });
    await prisma.operationsAuditLog.create({
      data: {
        hotelId: hotel.id,
        actorId: hkLead.id,
        taskId: taskCleaning2.id,
        action: 'TASK_ASSIGNED',
        toStatus: 'PENDING',
        notes: `Assigned to staff ${hkTuan.id}`,
        createdAt: new Date(`${today}T08:50:00.000Z`),
      },
    });
    await prisma.operationsAuditLog.create({
      data: {
        hotelId: hotel.id,
        actorId: hkTuan.id,
        taskId: taskCleaning2.id,
        action: 'TASK_START',
        fromStatus: 'PENDING',
        toStatus: 'IN_PROGRESS',
        createdAt: new Date(`${today}T09:00:00.000Z`),
      },
    });

    // 3. INSPECTION room -> AWAITING_INSPECTION task (must have completedAt set before inspection!)
    const inspectionRoom = roomMap.get('209')!;
    const taskInspection = await prisma.housekeepingTask.create({
      data: {
        hotelId: hotel.id,
        roomId: inspectionRoom.id,
        activeRoomId: inspectionRoom.id,
        status: 'AWAITING_INSPECTION',
        priority: 'NORMAL',
        assignedTo: hkCuc.id,
        startedAt: new Date(`${today}T08:00:00.000Z`),
        completedAt: new Date(`${today}T08:45:00.000Z`),
        notes: 'Đã dọn xong, chờ Trưởng nhóm nghiệm thu chất lượng',
        createdBy: hkLead.id,
      },
    });

    await prisma.operationsAuditLog.create({
      data: {
        hotelId: hotel.id,
        actorId: hkLead.id,
        taskId: taskInspection.id,
        action: 'TASK_CREATED',
        toStatus: 'PENDING',
        notes: taskInspection.notes,
        createdAt: new Date(`${today}T07:45:00.000Z`),
      },
    });
    await prisma.operationsAuditLog.create({
      data: {
        hotelId: hotel.id,
        actorId: hkLead.id,
        taskId: taskInspection.id,
        action: 'TASK_ASSIGNED',
        toStatus: 'PENDING',
        notes: `Assigned to staff ${hkCuc.id}`,
        createdAt: new Date(`${today}T07:50:00.000Z`),
      },
    });
    await prisma.operationsAuditLog.create({
      data: {
        hotelId: hotel.id,
        actorId: hkCuc.id,
        taskId: taskInspection.id,
        action: 'TASK_START',
        fromStatus: 'PENDING',
        toStatus: 'IN_PROGRESS',
        createdAt: new Date(`${today}T08:00:00.000Z`),
      },
    });
    await prisma.operationsAuditLog.create({
      data: {
        hotelId: hotel.id,
        actorId: hkCuc.id,
        taskId: taskInspection.id,
        action: 'TASK_COMPLETE',
        fromStatus: 'IN_PROGRESS',
        toStatus: 'AWAITING_INSPECTION',
        createdAt: new Date(`${today}T08:45:00.000Z`),
      },
    });

    // 4. COMPLETED tasks (Turnover history distributed across past checkouts)
    const completedTaskRooms = ['102', '107', '203', '208', '303', '403'];
    for (let c = 0; c < completedTaskRooms.length; c++) {
      const rNum = completedTaskRooms[c]!;
      const room = roomMap.get(rNum)!;
      const started = new Date(`${addDays(today, -1)}T08:00:00.000Z`);
      const completed = new Date(`${addDays(today, -1)}T09:00:00.000Z`);
      const inspected = new Date(`${addDays(today, -1)}T09:15:00.000Z`);

      const compTask = await prisma.housekeepingTask.create({
        data: {
          hotelId: hotel.id,
          roomId: room.id,
          activeRoomId: null, // COMPLETED tasks release activeRoomId
          status: 'COMPLETED',
          priority: 'NORMAL',
          assignedTo: hkMai.id,
          startedAt: started,
          completedAt: completed,
          inspectedAt: inspected,
          inspectedBy: hkLead.id,
          notes: `Hoàn thành dọn phòng ${rNum} đạt chuẩn 5 sao`,
          createdBy: hkLead.id,
        },
      });

      // Populate operations_audit_logs so reports compute accurate completed and inspected task metrics
      await prisma.operationsAuditLog.create({
        data: {
          hotelId: hotel.id,
          actorId: hkLead.id,
          taskId: compTask.id,
          action: 'TASK_CREATED',
          toStatus: 'PENDING',
          createdAt: new Date(`${addDays(today, -1)}T07:45:00.000Z`),
        },
      });
      await prisma.operationsAuditLog.create({
        data: {
          hotelId: hotel.id,
          actorId: hkLead.id,
          taskId: compTask.id,
          action: 'TASK_ASSIGNED',
          toStatus: 'PENDING',
          notes: `Assigned to staff ${hkMai.id}`,
          createdAt: new Date(`${addDays(today, -1)}T07:50:00.000Z`),
        },
      });
      await prisma.operationsAuditLog.create({
        data: {
          hotelId: hotel.id,
          actorId: hkMai.id,
          taskId: compTask.id,
          action: 'TASK_START',
          fromStatus: 'PENDING',
          toStatus: 'IN_PROGRESS',
          createdAt: started,
        },
      });
      await prisma.operationsAuditLog.create({
        data: {
          hotelId: hotel.id,
          actorId: hkMai.id,
          taskId: compTask.id,
          action: 'TASK_COMPLETE',
          fromStatus: 'IN_PROGRESS',
          toStatus: 'AWAITING_INSPECTION',
          createdAt: completed,
        },
      });
      await prisma.operationsAuditLog.create({
        data: {
          hotelId: hotel.id,
          actorId: hkLead.id,
          taskId: compTask.id,
          action: 'INSPECTION_PASSED',
          fromStatus: 'AWAITING_INSPECTION',
          toStatus: 'COMPLETED',
          notes: 'Nghiệm thu đạt chuẩn 5 sao',
          createdAt: inspected,
        },
      });
    }
    console.info(`✅ Đã tạo các nhiệm vụ Buồng phòng ở cả 4 cột Kanban và ghi nhận audit log.`);

    // H. MAINTENANCE TICKETS & BLOCKS
    // Block 1: Room 104 (Plumbing leak) - reportedAt precedes startedAt
    const room104 = roomMap.get('104')!;
    const ticket104ReportedAt = new Date(`${addDays(today, -2)}T14:00:00.000Z`);
    const ticket104StartedAt = new Date(`${addDays(today, -1)}T16:00:00.000Z`);

    const ticket104 = await prisma.maintenanceTicket.create({
      data: {
        hotelId: hotel.id,
        roomId: room104.id,
        title: 'Rò rỉ van cấp nước bồn rửa mặt',
        description: 'Nước bị rỉ nhẹ từ khớp nối dưới bồn lavabo, cần thay gioăng cao su và siết lại ren.',
        priority: 'HIGH',
        status: 'IN_PROGRESS',
        reportedBy: receptionist.id,
        assignedTo: technician.id,
        reportedAt: ticket104ReportedAt,
        startedAt: ticket104StartedAt,
        createdAt: ticket104ReportedAt,
      },
    });

    await prisma.operationsAuditLog.create({
      data: {
        hotelId: hotel.id,
        actorId: receptionist.id,
        ticketId: ticket104.id,
        action: 'TICKET_REPORTED',
        toStatus: 'OPEN',
        createdAt: ticket104ReportedAt,
      },
    });
    await prisma.operationsAuditLog.create({
      data: {
        hotelId: hotel.id,
        actorId: staffMap.get('manager')!.id,
        ticketId: ticket104.id,
        action: 'TICKET_ASSIGNED',
        fromStatus: 'OPEN',
        toStatus: 'ASSIGNED',
        notes: `Assigned to staff ${technician.id}`,
        createdAt: new Date(`${addDays(today, -1)}T15:00:00.000Z`),
      },
    });
    await prisma.operationsAuditLog.create({
      data: {
        hotelId: hotel.id,
        actorId: technician.id,
        ticketId: ticket104.id,
        action: 'TICKET_START',
        fromStatus: 'ASSIGNED',
        toStatus: 'IN_PROGRESS',
        createdAt: ticket104StartedAt,
      },
    });

    const block104 = await prisma.maintenanceBlock.create({
      data: {
        hotelId: hotel.id,
        roomId: room104.id,
        maintenanceTicketId: ticket104.id,
        startDate: new Date(`${addDays(today, -1)}T00:00:00.000Z`),
        endDate: new Date(`${addDays(today, 2)}T00:00:00.000Z`),
        status: 'ACTIVE',
        reason: 'Sửa chữa và thay thế đường ống nước phòng tắm',
        createdBy: technician.id,
        createdAt: ticket104StartedAt,
      },
    });

    await prisma.operationsAuditLog.create({
      data: {
        hotelId: hotel.id,
        actorId: technician.id,
        blockId: block104.id,
        action: 'BLOCK_CREATED',
        toStatus: 'ACTIVE',
        notes: block104.reason,
        createdAt: ticket104StartedAt,
      },
    });

    // Block 2: Room 206 (Air conditioner repair) - reportedAt precedes startedAt
    const room206 = roomMap.get('206')!;
    const ticket206ReportedAt = new Date(`${addDays(today, -1)}T17:00:00.000Z`);
    const ticket206StartedAt = new Date(`${today}T08:00:00.000Z`);

    const ticket206 = await prisma.maintenanceTicket.create({
      data: {
        hotelId: hotel.id,
        roomId: room206.id,
        title: 'Điều hòa không làm mát, phát tiếng ồn cục nóng',
        description: 'Điều hòa phòng 206 chạy quạt gió nhưng không lạnh, cục nóng ngoài ban công rung mạnh.',
        priority: 'NORMAL',
        status: 'IN_PROGRESS',
        reportedBy: hkMai.id,
        assignedTo: techLong.id,
        reportedAt: ticket206ReportedAt,
        startedAt: ticket206StartedAt,
        createdAt: ticket206ReportedAt,
      },
    });

    await prisma.operationsAuditLog.create({
      data: {
        hotelId: hotel.id,
        actorId: hkMai.id,
        ticketId: ticket206.id,
        action: 'TICKET_REPORTED',
        toStatus: 'OPEN',
        createdAt: ticket206ReportedAt,
      },
    });
    await prisma.operationsAuditLog.create({
      data: {
        hotelId: hotel.id,
        actorId: staffMap.get('manager')!.id,
        ticketId: ticket206.id,
        action: 'TICKET_ASSIGNED',
        fromStatus: 'OPEN',
        toStatus: 'ASSIGNED',
        notes: `Assigned to staff ${techLong.id}`,
        createdAt: new Date(`${today}T07:30:00.000Z`),
      },
    });
    await prisma.operationsAuditLog.create({
      data: {
        hotelId: hotel.id,
        actorId: techLong.id,
        ticketId: ticket206.id,
        action: 'TICKET_START',
        fromStatus: 'ASSIGNED',
        toStatus: 'IN_PROGRESS',
        createdAt: ticket206StartedAt,
      },
    });

    const block206 = await prisma.maintenanceBlock.create({
      data: {
        hotelId: hotel.id,
        roomId: room206.id,
        maintenanceTicketId: ticket206.id,
        startDate: new Date(`${today}T00:00:00.000Z`),
        endDate: new Date(`${addDays(today, 3)}T00:00:00.000Z`),
        status: 'ACTIVE',
        reason: 'Bảo dưỡng cục nóng và nạp gas máy lạnh',
        createdBy: techLong.id,
        createdAt: ticket206StartedAt,
      },
    });

    await prisma.operationsAuditLog.create({
      data: {
        hotelId: hotel.id,
        actorId: techLong.id,
        blockId: block206.id,
        action: 'BLOCK_CREATED',
        toStatus: 'ACTIVE',
        notes: block206.reason,
        createdAt: ticket206StartedAt,
      },
    });

    // Open ticket: Room 307
    const ticket307ReportedAt = new Date(`${today}T09:00:00.000Z`);
    const ticket307 = await prisma.maintenanceTicket.create({
      data: {
        hotelId: hotel.id,
        roomId: roomMap.get('307')!.id,
        title: 'Bóng đèn hành lang trước cửa chập chờn',
        description: 'Bóng đèn LED chiếu sáng trước cửa phòng 307 bị nhấp nháy liên tục.',
        priority: 'LOW',
        status: 'OPEN',
        reportedBy: hkCuc.id,
        reportedAt: ticket307ReportedAt,
        createdAt: ticket307ReportedAt,
      },
    });

    await prisma.operationsAuditLog.create({
      data: {
        hotelId: hotel.id,
        actorId: hkCuc.id,
        ticketId: ticket307.id,
        action: 'TICKET_REPORTED',
        toStatus: 'OPEN',
        createdAt: ticket307ReportedAt,
      },
    });
    console.info(`✅ Đã tạo các phiếu sự cố kỹ thuật và 2 Lệnh khóa phòng bảo trì (Room 104 & 206).`);

    // I. SEED INVENTORY MODULE
    console.info('📦 Bắt đầu khởi tạo dữ liệu mẫu Module Inventory...');
    const categoryMap = new Map<string, bigint>();
    for (const cat of demoInventoryCategories) {
      const category = await prisma.inventoryCategory.upsert({
        where: { hotelId_code: { hotelId: hotel.id, code: cat.code } },
        create: {
          hotelId: hotel.id,
          code: cat.code,
          name: cat.name,
          description: cat.description,
          isActive: true,
        },
        update: {
          name: cat.name,
          description: cat.description,
          isActive: true,
        },
      });
      categoryMap.set(cat.code, category.id);
    }

    const supplierMap = new Map<string, bigint>();
    for (const sup of demoSuppliers) {
      const supplier = await prisma.supplier.upsert({
        where: { hotelId_code: { hotelId: hotel.id, code: sup.code } },
        create: {
          hotelId: hotel.id,
          code: sup.code,
          name: sup.name,
          contactPerson: sup.contactPerson,
          phone: sup.phone,
          email: sup.email,
          address: sup.address,
          notes: sup.notes,
          isActive: true,
        },
        update: {
          name: sup.name,
          contactPerson: sup.contactPerson,
          phone: sup.phone,
          email: sup.email,
          address: sup.address,
          notes: sup.notes,
          isActive: true,
        },
      });
      supplierMap.set(sup.code, supplier.id);
    }

    const itemMap = new Map<string, { id: bigint; code: string; name: string; supplierCode: string; unitPrice: string; initialStock: string }>();
    for (const it of demoInventoryItems) {
      const categoryId = categoryMap.get(it.categoryCode);
      if (!categoryId) continue;

      const item = await prisma.inventoryItem.upsert({
        where: { hotelId_code: { hotelId: hotel.id, code: it.code } },
        create: {
          hotelId: hotel.id,
          categoryId,
          code: it.code,
          name: it.name,
          unit: it.unit,
          description: it.description,
          minStockLevel: new Prisma.Decimal(it.minStockLevel),
          currentStock: new Prisma.Decimal('0.00'),
          isActive: true,
        },
        update: {
          categoryId,
          name: it.name,
          unit: it.unit,
          description: it.description,
          minStockLevel: new Prisma.Decimal(it.minStockLevel),
          currentStock: new Prisma.Decimal('0.00'),
          isActive: true,
        },
      });
      itemMap.set(it.code, {
        id: item.id,
        code: item.code,
        name: item.name,
        supplierCode: it.supplierCode,
        unitPrice: it.unitPrice,
        initialStock: it.initialStock,
      });
    }

    const staffActor = staffMap.get('admin') ?? receptionist;

    // 1. Initial Stock Receipts (Split per supplier)
    const supplierList = [
      { code: 'SUP-ASIA', receiptNumber: 'REC-INIT-ASIA', notes: 'Nhập kho ban đầu amenities và minibar' },
      { code: 'SUP-NAMVIET', receiptNumber: 'REC-INIT-NAMVIET', notes: 'Nhập kho ban đầu đồ vải và giặt là' },
      { code: 'SUP-ECOCLEAN', receiptNumber: 'REC-INIT-ECOCLEAN', notes: 'Nhập kho ban đầu hóa chất vệ sinh' },
      { code: 'SUP-TANPHAT', receiptNumber: 'REC-INIT-TANPHAT', notes: 'Nhập kho ban đầu vật tư kỹ thuật tòa nhà' },
    ];

    for (const supCfg of supplierList) {
      const supplierId = supplierMap.get(supCfg.code) ?? null;
      const itemsForSupplier = Array.from(itemMap.values()).filter(it => it.supplierCode === supCfg.code);
      if (itemsForSupplier.length === 0) continue;

      let receiptTotal = new Prisma.Decimal(0);
      for (const it of itemsForSupplier) {
        const lineTotal = new Prisma.Decimal(it.initialStock).mul(new Prisma.Decimal(it.unitPrice));
        receiptTotal = receiptTotal.add(lineTotal);
      }

      const receipt = await prisma.stockReceipt.create({
        data: {
          hotelId: hotel.id,
          supplierId,
          receiptNumber: supCfg.receiptNumber,
          receiptDate: new Date(`${addDays(today, -7)}T08:00:00.000Z`),
          totalAmount: receiptTotal,
          notes: supCfg.notes,
          createdBy: staffActor.id,
        },
      });

      for (const it of itemsForSupplier) {
        const qty = new Prisma.Decimal(it.initialStock);
        const price = new Prisma.Decimal(it.unitPrice);
        const lineTotal = qty.mul(price);

        await prisma.stockReceiptItem.create({
          data: {
            hotelId: hotel.id,
            receiptId: receipt.id,
            itemId: it.id,
            quantity: qty,
            unitPrice: price,
            lineTotal,
            notes: `Nhập tồn ban đầu: ${it.name}`,
          },
        });

        const currentItem = await prisma.inventoryItem.findUniqueOrThrow({
          where: { id: it.id },
        });
        const prevStock = currentItem.currentStock;
        const newStock = prevStock.add(qty);

        await prisma.inventoryItem.update({
          where: { id: it.id },
          data: { currentStock: newStock },
        });

        await prisma.inventoryMovement.create({
          data: {
            hotelId: hotel.id,
            itemId: it.id,
            type: 'RECEIPT',
            quantity: qty,
            previousStock: prevStock,
            currentStock: newStock,
            referenceType: 'STOCK_RECEIPT',
            referenceId: receipt.id,
            referenceNumber: receipt.receiptNumber,
            notes: `Stock Receipt ${receipt.receiptNumber}`,
            createdBy: staffActor.id,
            createdAt: receipt.receiptDate,
          },
        });
      }
    }

    // 2. Stock Issue to Housekeeping
    const soapItem = itemMap.get('AMEN-SG-40ML');
    const toothBrushItem = itemMap.get('AMEN-TB-01');

    if (soapItem && toothBrushItem) {
      const issueDate = new Date(`${today}T07:30:00.000Z`);
      const issue = await prisma.stockIssue.create({
        data: {
          hotelId: hotel.id,
          issueNumber: 'ISS-DEMO-HK01',
          issueDate,
          department: 'Housekeeping',
          purpose: 'Cấp phát vật tư phòng khách tầng 3 & tầng 4',
          notes: 'Xuất kho ca sáng',
          createdBy: staffActor.id,
        },
      });

      const issueLines = [
        { meta: soapItem, qty: new Prisma.Decimal('30.00') },
        { meta: toothBrushItem, qty: new Prisma.Decimal('50.00') },
      ];

      for (const line of issueLines) {
        await prisma.stockIssueItem.create({
          data: {
            hotelId: hotel.id,
            issueId: issue.id,
            itemId: line.meta.id,
            quantity: line.qty,
            notes: 'Xuất cấp phát phòng',
          },
        });

        const currentItem = await prisma.inventoryItem.findUniqueOrThrow({
          where: { id: line.meta.id },
        });
        const prevStock = currentItem.currentStock;
        const newStock = prevStock.sub(line.qty);

        await prisma.inventoryItem.update({
          where: { id: line.meta.id },
          data: { currentStock: newStock },
        });

        // Quantity in InventoryMovement for ISSUE must be negative to match InventoryService.createIssue()
        await prisma.inventoryMovement.create({
          data: {
            hotelId: hotel.id,
            itemId: line.meta.id,
            type: 'ISSUE',
            quantity: line.qty.negated(),
            previousStock: prevStock,
            currentStock: newStock,
            referenceType: 'STOCK_ISSUE',
            referenceId: issue.id,
            referenceNumber: issue.issueNumber,
            notes: `Issued to Housekeeping (Cấp phát vật tư phòng khách tầng 3 & tầng 4)`,
            createdBy: staffActor.id,
            createdAt: issueDate,
          },
        });
      }
    }

    // 3. Stock Adjustment
    const waterItem = itemMap.get('AMEN-WATER');
    if (waterItem) {
      const currentItem = await prisma.inventoryItem.findUniqueOrThrow({
        where: { id: waterItem.id },
      });
      const systemQty = currentItem.currentStock;
      const actualQty = systemQty.add(new Prisma.Decimal('5.00'));
      const diff = actualQty.sub(systemQty);
      const adjDate = new Date(`${today}T08:15:00.000Z`);

      const adj = await prisma.stockAdjustment.create({
        data: {
          hotelId: hotel.id,
          adjustmentNumber: 'ADJ-DEMO-CHK01',
          itemId: waterItem.id,
          systemQuantity: systemQty,
          actualQuantity: actualQty,
          difference: diff,
          reason: 'Kiểm kê định kỳ phát hiện thừa 5 chai nước đóng thùng nguyên vẹn',
          createdBy: staffActor.id,
          createdAt: adjDate,
        },
      });

      await prisma.inventoryItem.update({
        where: { id: waterItem.id },
        data: { currentStock: actualQty },
      });

      await prisma.inventoryMovement.create({
        data: {
          hotelId: hotel.id,
          itemId: waterItem.id,
          type: 'ADJUSTMENT',
          quantity: diff,
          previousStock: systemQty,
          currentStock: actualQty,
          referenceType: 'STOCK_ADJUSTMENT',
          referenceId: adj.id,
          referenceNumber: adj.adjustmentNumber,
          notes: `Adjustment: ${adj.reason}`,
          createdBy: staffActor.id,
          createdAt: adjDate,
        },
      });
    }
    console.info(`✅ Đã tạo ${itemMap.size} vật tư kho, phiếu nhập theo nhà cung cấp, phiếu xuất và phiếu kiểm kê.`);

    // ----------------------------------------------------
    // J. PREFLIGHT ASSERTIONS (VALIDATE BUSINESS INVARIANTS)
    // ----------------------------------------------------
    const totalStaff = await prisma.staffUser.count({ where: { hotelId: hotel.id } });
    if (totalStaff !== 18) throw new Error(`Assertion failed: Expected 18 staff, got ${totalStaff}`);

    const totalRooms = await prisma.room.count({ where: { hotelId: hotel.id } });
    if (totalRooms !== 40) throw new Error(`Assertion failed: Expected 40 rooms, got ${totalRooms}`);

    const activeOccupancies = await prisma.roomOccupancy.count({ where: { hotelId: hotel.id } });
    if (activeOccupancies !== 20) throw new Error(`Assertion failed: Expected 20 active occupancies, got ${activeOccupancies}`);

    const preassignedArrivals = await prisma.reservationRoom.count({
      where: {
        hotelId: hotel.id,
        reservation: { status: 'CONFIRMED' },
        roomId: { not: null },
      },
    });
    if (preassignedArrivals > 0) throw new Error(`Assertion failed: Found ${preassignedArrivals} un-checked-in rooms with preassigned physical roomId`);

    const missingRoomNights = await prisma.reservationRoom.count({
      where: {
        hotelId: hotel.id,
        nights: { none: {} },
      },
    });
    if (missingRoomNights > 0) throw new Error(`Assertion failed: Found ${missingRoomNights} reservation rooms without price snapshots`);

    const awaitingWithoutCompleted = await prisma.housekeepingTask.count({
      where: {
        hotelId: hotel.id,
        status: 'AWAITING_INSPECTION',
        completedAt: null,
      },
    });
    if (awaitingWithoutCompleted > 0) throw new Error(`Assertion failed: Found awaiting inspection tasks without completedAt`);

    const positiveIssues = await prisma.inventoryMovement.count({
      where: {
        hotelId: hotel.id,
        type: 'ISSUE',
        quantity: { gt: 0 },
      },
    });
    if (positiveIssues > 0) throw new Error(`Assertion failed: Found ${positiveIssues} ISSUE inventory movements with positive quantity`);

    console.info('✅ Toàn bộ 7 Preflight Invariant Assertions đã vượt qua thành công!');

    // ----------------------------------------------------
    // K. DYNAMIC SUMMARY LOGGING (COMPUTED DIRECTLY FROM DB)
    // ----------------------------------------------------
    const [
      actualRoomCount,
      actualRoomTypeCount,
      actualStaffCount,
      actualGuestCount,
      actualOccupiedCount,
      actualArrivalsCount,
      actualUnassignedCount,
      actualPastCount,
      actualCancelledCount,
      actualNoShowCount,
      actualTasksCount,
      actualBlocksCount,
      actualTicketsCount,
      actualItemsCount,
      actualReceiptsCount,
      actualIssuesCount,
      actualAdjustmentsCount,
      actualMovementsCount,
    ] = await Promise.all([
      prisma.room.count({ where: { hotelId: hotel.id } }),
      prisma.roomType.count({ where: { hotelId: hotel.id } }),
      prisma.staffUser.count({ where: { hotelId: hotel.id } }),
      prisma.guest.count({ where: { hotelId: hotel.id } }),
      prisma.roomOccupancy.count({ where: { hotelId: hotel.id } }),
      prisma.reservation.count({ where: { hotelId: hotel.id, status: 'CONFIRMED', confirmationCode: { startsWith: 'RES-ARR' } } }),
      prisma.reservation.count({ where: { hotelId: hotel.id, status: 'CONFIRMED', confirmationCode: { startsWith: 'RES-UNASSIGN' } } }),
      prisma.reservation.count({ where: { hotelId: hotel.id, status: 'CHECKED_OUT' } }),
      prisma.reservation.count({ where: { hotelId: hotel.id, status: 'CANCELLED' } }),
      prisma.reservation.count({ where: { hotelId: hotel.id, status: 'NO_SHOW' } }),
      prisma.housekeepingTask.count({ where: { hotelId: hotel.id } }),
      prisma.maintenanceBlock.count({ where: { hotelId: hotel.id, status: 'ACTIVE' } }),
      prisma.maintenanceTicket.count({ where: { hotelId: hotel.id } }),
      prisma.inventoryItem.count({ where: { hotelId: hotel.id } }),
      prisma.stockReceipt.count({ where: { hotelId: hotel.id } }),
      prisma.stockIssue.count({ where: { hotelId: hotel.id } }),
      prisma.stockAdjustment.count({ where: { hotelId: hotel.id } }),
      prisma.inventoryMovement.count({ where: { hotelId: hotel.id } }),
    ]);

    console.info('\n🎉 ========================================================');
    console.info('🎉 ĐỒNG BỘ CƠ SỞ DỮ LIỆU INNVYRA PMS 40 PHÒNG THÀNH CÔNG!');
    console.info('🎉 ========================================================');
    console.info(`• Khách sạn: ${hotel.name} (Code: ${hotel.code}, ID: ${hotel.id})`);
    console.info(`• Tổng số phòng: ${actualRoomCount} phòng | ${actualRoomTypeCount} Hạng phòng phân cấp`);
    console.info(`• Tổng nhân sự: ${actualStaffCount} tài khoản (đủ ca trực) | Mật khẩu chung: ${demoPassword}`);
    console.info(`• Hồ sơ khách: ${actualGuestCount} khách hàng (đã mã hóa hồ sơ)`);
    console.info(`• Lưu trú thực tế: ${actualOccupiedCount} phòng đang ở (In-House Stays) - Phòng Matrix hiển thị xanh`);
    console.info(`• Khóa bảo trì: ${actualBlocksCount} phòng đang khóa (104, 206) - ${actualTicketsCount} phiếu kỹ thuật`);
    console.info(`• Đặt phòng dự kiến đến hôm nay: ${actualArrivalsCount} đơn (chưa gán phòng vật lý)`);
    console.info(`• Đặt phòng tương lai chưa gán: ${actualUnassignedCount} đơn`);
    console.info(`• Lịch sử trả phòng & tất toán: ${actualPastCount} đơn | Đã hủy: ${actualCancelledCount} đơn | No-show: ${actualNoShowCount} đơn`);
    console.info(`• Buồng phòng: ${actualTasksCount} nhiệm vụ (đủ 4 cột Kanban + audit log hoàn thành/nghiệm thu)`);
    console.info(`• Kho vật tư: ${actualItemsCount} mặt hàng | ${actualReceiptsCount} phiếu nhập | ${actualIssuesCount} phiếu xuất | ${actualAdjustmentsCount} phiếu kiểm kê | ${actualMovementsCount} biến động kho`);
    console.info('========================================================\n');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(
    error instanceof AppError
      ? error.message
      : error instanceof Error && error.name === 'ZodError'
        ? 'Invalid seed configuration.'
        : error,
  );
  process.exitCode = 1;
});
