import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { createConnection } from 'mariadb';
import { databaseOptions } from '../src/database/prisma.js';
import { scriptPrisma, requiredDatabaseUrl } from '../scripts/database-tools.js';
import { adminInputSchema } from '../src/modules/auth/auth.schema.js';
import { AppError } from '../src/shared/errors/app-error.js';
import { hashPassword } from '../src/shared/utils/password.js';
import { GuestCrypto } from '../src/modules/guests/guest.crypto.js';
import { hotelToday } from '../src/modules/reservations/reservation.dates.js';

// ----------------------------------------------------
// 1. ROLES & STAFF DEFINITIONS (17 staff across shifts)
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
// Format: [roomNumber, floorNumber, roomTypeCode, physicalStatus, housekeepingStatus]
type RoomSeedDef = [string, number, string, 'ACTIVE' | 'MAINTENANCE' | 'OUT_OF_SERVICE', 'READY' | 'DIRTY' | 'CLEANING' | 'INSPECTION'];

const roomsConfig: RoomSeedDef[] = [
  // TẦNG 1: 10 phòng (101 - 110)
  ['101', 1, 'STD-SGL', 'ACTIVE', 'READY'],
  ['102', 1, 'STD-SGL', 'ACTIVE', 'READY'],
  ['103', 1, 'STD-SGL', 'ACTIVE', 'DIRTY'],
  ['104', 1, 'STD-SGL', 'MAINTENANCE', 'DIRTY'], // Khóa bảo trì
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
  ['206', 2, 'SUP-TWN', 'MAINTENANCE', 'DIRTY'], // Khóa bảo trì
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
  { code: 'SRV-WATER', name: 'Nước khoáng Lavie 500ml', unit: 'Chai', price: '25000.00' },
  { code: 'SRV-BEER', name: 'Bia Heineken lon 330ml', unit: 'Lon', price: '45000.00' },
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

// Helper: Add days to YYYY-MM-DD
function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// ----------------------------------------------------
// MAIN SEED PROCESS (IDEMPOTENT & REPRODUCIBLE)
// ----------------------------------------------------
async function main() {
  const prisma = scriptPrisma();

  try {
    console.info('🚀 Bắt đầu quá trình đồng bộ và khởi tạo cơ sở dữ liệu Innvyra Hotel 40 Phòng...');

    // 1. CLEAN RESET TRANSACTIONAL TABLES TO GUARANTEE SYNCHRONIZATION
    console.info('🧹 Làm sạch dữ liệu cũ để đồng bộ trạng thái giữa các thành viên...');
    const tablesToReset = [
      'billing_audit_logs',
      'billing_idempotency',
      'operations_audit_logs',
      'guest_audit_logs',
      'folio_items',
      'payments',
      'folios',
      'service_order_items',
      'service_orders',
      'room_occupancies',
      'room_transfers',
      'stays',
      'reservation_room_nights',
      'reservation_rooms',
      'reservations',
      'housekeeping_tasks',
      'maintenance_blocks',
      'maintenance_tickets',
      'rooms',
      'room_types',
      'guests',
      'services',
      'refresh_tokens',
      'auth_sessions',
      'staff_users',
    ];

    const resetConn = await createConnection(
      databaseOptions(
        requiredDatabaseUrl(),
        process.env.DATABASE_SSL === 'true',
        process.env.DATABASE_SSL_CA_FILE,
      ),
    );
    try {
      await resetConn.query('SET FOREIGN_KEY_CHECKS = 0');
      for (const table of tablesToReset) {
        await resetConn.query(`DELETE FROM \`${table}\``);
      }
      await resetConn.query('SET FOREIGN_KEY_CHECKS = 1');
    } finally {
      await resetConn.end();
    }
    console.info('✅ Dọn dẹp hoàn tất. Bắt đầu nạp dữ liệu chuẩn mới...');

    // 2. SEED ROLES
    for (const [code, name] of roles) {
      await prisma.role.upsert({ where: { code }, create: { code, name }, update: {} });
    }
    console.info('✅ Đã khởi tạo 6 Roles phân quyền.');

    // 3. SEED HOTEL
    const hotel = await prisma.hotel.upsert({
      where: { code: 'MAIN' },
      create: { code: 'MAIN', name: 'Innvyra Hotel', timezone: 'Asia/Ho_Chi_Minh' },
      update: { name: 'Innvyra Hotel', timezone: 'Asia/Ho_Chi_Minh' },
    });
    console.info(`✅ Khách sạn: ${hotel.name} (Code: ${hotel.code}, ID: ${hotel.id})`);

    // 4. SEED STAFF (17 accounts with password 'Innvyra@Demo2026!')
    const demoPassword = process.env.SEED_STAFF_PASSWORD || 'Innvyra@Demo2026!';
    const passwordHash = await hashPassword(demoPassword);

    const staffMap = new Map<string, any>();
    for (const [roleCode, username, fullName] of staffAccounts) {
      const role = await prisma.role.findUniqueOrThrow({ where: { code: roleCode } });
      const staff = await prisma.staffUser.create({
        data: {
          hotelId: hotel.id,
          roleId: role.id,
          username,
          fullName,
          passwordHash,
          email: `${username}@innvyra.com`,
          isActive: true,
        },
      });
      staffMap.set(username, staff);
    }
    console.info(`✅ Đã tạo ${staffMap.size} nhân sự trải đều các ca trực 24/7.`);

    // 5. SEED ROOM TYPES (6 realistic types)
    const roomTypeMap = new Map<string, any>();
    for (const rt of roomTypesConfig) {
      const createdRt = await prisma.roomType.create({
        data: {
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
      });
      roomTypeMap.set(rt.code, createdRt);
    }
    console.info(`✅ Đã tạo 6 Hạng phòng phân cấp kim tự tháp chuẩn.`);

    // 6. SEED PHYSICAL ROOMS (40 rooms across 4 floors)
    const roomMap = new Map<string, any>();
    for (const [roomNumber, floorNumber, roomTypeCode, physicalStatus, housekeepingStatus] of roomsConfig) {
      const rt = roomTypeMap.get(roomTypeCode);
      const room = await prisma.room.create({
        data: {
          hotelId: hotel.id,
          roomTypeId: rt.id,
          roomNumber,
          floorNumber,
          physicalStatus,
          housekeepingStatus,
          notes: `Phòng ${roomNumber} - Tầng ${floorNumber} (${rt.name})`,
          createdAt: new Date('2026-08-01T00:00:00.000Z'),
        },
      });
      roomMap.set(roomNumber, room);
    }
    console.info(`✅ Đã tạo 40 Phòng vật lý (Tầng 1–4, mỗi tầng 10 phòng: 101–410).`);

    // 7. SEED SERVICES
    const serviceMap = new Map<string, any>();
    for (const srv of servicesConfig) {
      const s = await prisma.service.create({
        data: {
          hotelId: hotel.id,
          code: srv.code,
          name: srv.name,
          unit: srv.unit,
          price: srv.price,
          isActive: true,
        },
      });
      serviceMap.set(srv.code, s);
    }
    console.info(`✅ Đã tạo 5 Dịch vụ khách sạn (Nước suối, bia, giặt ủi, buffet, xe đưa đón).`);

    // 8. SEED GUESTS (35 guests with encrypted document numbers)
    const crypto =
      process.env.GUEST_ENCRYPTION_KEY && process.env.GUEST_HASH_KEY
        ? new GuestCrypto({
            GUEST_ENCRYPTION_KEY: process.env.GUEST_ENCRYPTION_KEY,
            GUEST_HASH_KEY: process.env.GUEST_HASH_KEY,
          })
        : null;

    const guestList: any[] = [];
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

    // 9. SEED OPERATIONAL DATA (Relative to Hotel Today)
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

    // A. 20 IN-HOUSE STAYS (Occupied Rooms)
    const validBookingSources = ['DIRECT', 'PHONE', 'EMAIL', 'WALK_IN', 'AGENT', 'OTHER'] as const;
    // List of 20 occupied rooms from our config
    const occupiedRoomNumbers = [
      '101', '105', '106', '109',
      '201', '202', '204', '205', '207', '210',
      '301', '302', '305', '306', '308', '309',
      '401', '402', '404', '405', '407', '409',
    ].slice(0, 20); // 20 occupied rooms

    let guestIdx = 0;
    for (let i = 0; i < occupiedRoomNumbers.length; i++) {
      const roomNum = occupiedRoomNumbers[i];
      const room = roomMap.get(roomNum)!;
      const rt = await prisma.roomType.findUniqueOrThrow({ where: { id: room.roomTypeId } });
      const guest = guestList[guestIdx++ % guestList.length];

      // Check-in dates: 1-3 days ago, check-out: 1-3 days in future
      const stayDaysAgo = (i % 3) + 1;
      const stayDaysAhead = (i % 2) + 2;
      const checkInDate = addDays(today, -stayDaysAgo);
      const checkOutDate = addDays(today, stayDaysAhead);
      const totalNights = stayDaysAgo + stayDaysAhead;
      const totalRate = parseFloat(rt.basePrice.toString()) * totalNights;
      const bookingCreatedAt = new Date(`${addDays(checkInDate, -3)}T10:00:00.000Z`);

      // 1. Reservation
      const res = await prisma.reservation.create({
        data: {
          hotelId: hotel.id,
          confirmationCode: `RES-IN${roomNum}-${randomUUID().slice(0, 4).toUpperCase()}`,
          bookerGuestId: guest.id,
          checkInDate: new Date(`${checkInDate}T00:00:00.000Z`),
          checkOutDate: new Date(`${checkOutDate}T00:00:00.000Z`),
          status: 'CHECKED_IN',
          bookingSource: validBookingSources[i % validBookingSources.length],
          totalAmount: totalRate.toFixed(2),
          createdBy: receptionist.id,
          createdAt: bookingCreatedAt,
        },
      });

      // 2. ReservationRoom
      const resRoom = await prisma.reservationRoom.create({
        data: {
          hotelId: hotel.id,
          reservationId: res.id,
          roomTypeId: rt.id,
          roomId: room.id,
          adults: 2,
          children: 0,
          createdAt: bookingCreatedAt,
        },
      });

      // 3. ReservationRoomNights
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

      // 4. Stay
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

      // 6. Folio
      const folio = await prisma.folio.create({
        data: {
          hotelId: hotel.id,
          reservationId: res.id,
          currency: 'VND',
          status: 'OPEN',
          openedAt: new Date(`${checkInDate}T14:30:00.000Z`),
        },
      });

      // 7. Folio Item: Room Nights (Debit)
      const nightsBilled = stayDaysAgo; // nights up to today billed
      let roomChargesAmount = 0;
      for (let n = 0; n < nightsBilled; n++) {
        const night = nightRecords[n];
        roomChargesAmount += parseFloat(rt.basePrice.toString());
        await prisma.folioItem.create({
          data: {
            hotelId: hotel.id,
            folioId: folio.id,
            entryType: 'DEBIT',
            sourceType: 'ROOM_NIGHT',
            roomNightId: night.id,
            sourceId: night.id,
            amount: rt.basePrice,
            description: `Tiền phòng ${roomNum} (Đêm ${n + 1})`,
            createdBy: accountant.id,
            createdAt: new Date(`${addDays(checkInDate, n)}T23:59:00.000Z`),
          },
        });
      }

      // 8. Service charges for some rooms (Manual adjustment)
      let extraServiceAmount = 0;
      if (i % 2 === 0) {
        extraServiceAmount = 90000; // 2 beers
        await prisma.folioItem.create({
          data: {
            hotelId: hotel.id,
            folioId: folio.id,
            entryType: 'DEBIT',
            sourceType: 'MANUAL_ADJUSTMENT',
            amount: '90000.00',
            description: 'Phụ thu minibar: 2 lon Bia Heineken',
            createdBy: receptionist.id,
            createdAt: new Date(`${today}T10:00:00.000Z`),
          },
        });
      }

      // 9. Payments
      // Scenario A (Balanced): 12 folios fully paid
      // Scenario B (Debit / Nợ): 5 folios owe money
      // Scenario C (Credit / Trả thừa): 3 folios have excess deposit
      if (i < 12) {
        // Balanced
        const paidAmount = roomChargesAmount + extraServiceAmount;
        if (paidAmount > 0) {
          await prisma.payment.create({
            data: {
              hotelId: hotel.id,
              folioId: folio.id,
              paymentType: 'PAYMENT',
              paymentMethod: i % 2 === 0 ? 'BANK_TRANSFER' : 'CASH',
              amount: paidAmount.toFixed(2),
              status: 'CONFIRMED',
              referenceNumber: `PAY-REC-${roomNum}-${i}`,
              processedBy: receptionist.id,
              processedAt: new Date(`${checkInDate}T14:45:00.000Z`),
            },
          });
        }
      } else if (i < 17) {
        // Debit: Customer still owes money
        const partialPaid = 500000;
        await prisma.payment.create({
          data: {
            hotelId: hotel.id,
            folioId: folio.id,
            paymentType: 'PAYMENT',
            paymentMethod: 'CASH',
            amount: partialPaid.toFixed(2),
            status: 'CONFIRMED',
            referenceNumber: `PAY-PARTIAL-${roomNum}`,
            processedBy: receptionist.id,
            processedAt: new Date(`${checkInDate}T15:00:00.000Z`),
          },
        });
      } else {
        // Credit: Customer paid excess deposit
        const depositAmount = roomChargesAmount + extraServiceAmount + 1000000;
        await prisma.payment.create({
          data: {
            hotelId: hotel.id,
            folioId: folio.id,
            paymentType: 'DEPOSIT',
            paymentMethod: 'BANK_TRANSFER',
            amount: depositAmount.toFixed(2),
            status: 'CONFIRMED',
            referenceNumber: `DEP-EXCESS-${roomNum}`,
            processedBy: accountant.id,
            processedAt: new Date(`${checkInDate}T12:00:00.000Z`),
          },
        });
      }
    }
    console.info(`✅ Đã tạo 20 Ca lưu trú đang ở thực tế (In-House Stays) kèm hóa đơn Folio.`);

    // B. 6 EXPECTED ARRIVALS (TODAY CONFIRMED)
    const arrivalRooms = ['102', '107', '203', '208', '303', '403'];
    for (let i = 0; i < arrivalRooms.length; i++) {
      const roomNum = arrivalRooms[i];
      const room = roomMap.get(roomNum)!;
      const rt = await prisma.roomType.findUniqueOrThrow({ where: { id: room.roomTypeId } });
      const guest = guestList[guestIdx++ % guestList.length];

      const checkInDate = today;
      const checkOutDate = addDays(today, 2);
      const totalRate = parseFloat(rt.basePrice.toString()) * 2;
      const bookingCreatedAt = new Date(`${addDays(today, -2)}T09:30:00.000Z`);

      const res = await prisma.reservation.create({
        data: {
          hotelId: hotel.id,
          confirmationCode: `RES-ARR${roomNum}-${randomUUID().slice(0, 4).toUpperCase()}`,
          bookerGuestId: guest.id,
          checkInDate: new Date(`${checkInDate}T00:00:00.000Z`),
          checkOutDate: new Date(`${checkOutDate}T00:00:00.000Z`),
          status: 'CONFIRMED',
          bookingSource: validBookingSources[(i + 1) % validBookingSources.length],
          totalAmount: totalRate.toFixed(2),
          createdBy: receptionist.id,
          createdAt: bookingCreatedAt,
        },
      });

      await prisma.reservationRoom.create({
        data: {
          hotelId: hotel.id,
          reservationId: res.id,
          roomTypeId: rt.id,
          roomId: room.id,
          adults: 2,
          children: 0,
          createdAt: bookingCreatedAt,
        },
      });
    }
    console.info(`✅ Đã tạo 6 Đơn đặt phòng dự kiến đến hôm nay (Expected Arrivals).`);

    // C. 4 UNASSIGNED RESERVATIONS (RoomId is null)
    const unassignedTypes = ['STD-DBL', 'SUP-DBL', 'DLX-BALCONY', 'SUITE-EXEC'];
    for (let i = 0; i < unassignedTypes.length; i++) {
      const rtCode = unassignedTypes[i];
      const rt = roomTypeMap.get(rtCode)!;
      const guest = guestList[guestIdx++ % guestList.length];

      const checkInDate = addDays(today, 1);
      const checkOutDate = addDays(today, 3);
      const totalRate = parseFloat(rt.basePrice.toString()) * 2;
      const bookingCreatedAt = new Date(`${addDays(today, -1)}T11:00:00.000Z`);

      const res = await prisma.reservation.create({
        data: {
          hotelId: hotel.id,
          confirmationCode: `RES-UNASSIGN-${i + 1}-${randomUUID().slice(0, 4).toUpperCase()}`,
          bookerGuestId: guest.id,
          checkInDate: new Date(`${checkInDate}T00:00:00.000Z`),
          checkOutDate: new Date(`${checkOutDate}T00:00:00.000Z`),
          status: 'CONFIRMED',
          bookingSource: validBookingSources[(i + 3) % validBookingSources.length],
          totalAmount: totalRate.toFixed(2),
          createdBy: receptionist.id,
          createdAt: bookingCreatedAt,
        },
      });

      await prisma.reservationRoom.create({
        data: {
          hotelId: hotel.id,
          reservationId: res.id,
          roomTypeId: rt.id,
          roomId: null, // UNASSIGNED!
          adults: 2,
          children: 0,
          createdAt: bookingCreatedAt,
        },
      });
    }
    console.info(`✅ Đã tạo 4 Đặt phòng chưa gán phòng (Unassigned Bookings) để test Matrix.`);

    // D. 10 PAST CHECKED-OUT STAYS (Distributed across past 11 days for natural reporting)
    const pastStaysConfig = [
      { roomNum: '103', checkInDaysAgo: 5, stayNights: 4 }, // -5 to -1
      { roomNum: '110', checkInDaysAgo: 6, stayNights: 4 }, // -6 to -2
      { roomNum: '307', checkInDaysAgo: 7, stayNights: 4 }, // -7 to -3
      { roomNum: '410', checkInDaysAgo: 4, stayNights: 3 }, // -4 to -1
      { roomNum: '102', checkInDaysAgo: 9, stayNights: 3 }, // -9 to -6
      { roomNum: '107', checkInDaysAgo: 10, stayNights: 3 }, // -10 to -7
      { roomNum: '203', checkInDaysAgo: 8, stayNights: 4 }, // -8 to -4
      { roomNum: '208', checkInDaysAgo: 11, stayNights: 3 }, // -11 to -8
      { roomNum: '303', checkInDaysAgo: 7, stayNights: 3 }, // -7 to -4
      { roomNum: '403', checkInDaysAgo: 6, stayNights: 4 }, // -6 to -2
    ];

    for (let i = 0; i < pastStaysConfig.length; i++) {
      const item = pastStaysConfig[i];
      const guest = guestList[guestIdx++ % guestList.length];
      const targetRoom = roomMap.get(item.roomNum)!;
      const rt = await prisma.roomType.findUniqueOrThrow({ where: { id: targetRoom.roomTypeId } });
      const checkInDate = addDays(today, -item.checkInDaysAgo);
      const checkOutDate = addDays(checkInDate, item.stayNights);
      const pastTotalAmount = (parseFloat(rt.basePrice.toString()) * item.stayNights).toFixed(2);
      const bookingCreatedAt = new Date(`${addDays(checkInDate, -3)}T08:00:00.000Z`);

      const res = await prisma.reservation.create({
        data: {
          hotelId: hotel.id,
          confirmationCode: `RES-PAST-${i + 1}-${randomUUID().slice(0, 4).toUpperCase()}`,
          bookerGuestId: guest.id,
          checkInDate: new Date(`${checkInDate}T00:00:00.000Z`),
          checkOutDate: new Date(`${checkOutDate}T00:00:00.000Z`),
          status: 'CHECKED_OUT',
          bookingSource: validBookingSources[i % validBookingSources.length],
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
          adults: rt.maxAdults,
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
            description: `Tiền phòng ${item.roomNum} (Đêm ${n + 1})`,
            createdBy: accountant.id,
            createdAt: new Date(`${addDays(checkInDate, n)}T23:59:00.000Z`),
          },
        });
      }

      await prisma.payment.create({
        data: {
          hotelId: hotel.id,
          folioId: folio.id,
          paymentType: 'PAYMENT',
          paymentMethod: i % 2 === 0 ? 'BANK_TRANSFER' : 'CASH',
          amount: pastTotalAmount,
          status: 'CONFIRMED',
          referenceNumber: `PAST-SETTLED-${i + 1}`,
          processedBy: accountant.id,
          processedAt: new Date(`${checkOutDate}T11:25:00.000Z`),
        },
      });
    }
    console.info(`✅ Đã tạo 10 Lịch sử lưu trú quá khứ đã trả phòng và tất toán trải đều các ngày.`);

    // E. 3 CANCELLED RESERVATIONS
    const cancelledConfig = [
      { daysAgoCreated: 8, daysAgoCancelled: 6, source: 'PHONE' as const },
      { daysAgoCreated: 5, daysAgoCancelled: 3, source: 'EMAIL' as const },
      { daysAgoCreated: 3, daysAgoCancelled: 1, source: 'AGENT' as const },
    ];
    for (let i = 0; i < cancelledConfig.length; i++) {
      const cfg = cancelledConfig[i];
      const rt = roomTypesConfig[i % roomTypesConfig.length];
      const rtRecord = roomTypeMap.get(rt.code)!;
      const guest = guestList[guestIdx++ % guestList.length];
      const checkInDate = addDays(today, 2 + i);
      const checkOutDate = addDays(checkInDate, 2);
      const totalAmount = (parseFloat(rtRecord.basePrice.toString()) * 2).toFixed(2);
      const createdDate = new Date(`${addDays(today, -cfg.daysAgoCreated)}T09:00:00.000Z`);
      const cancelledDate = new Date(`${addDays(today, -cfg.daysAgoCancelled)}T14:00:00.000Z`);

      const res = await prisma.reservation.create({
        data: {
          hotelId: hotel.id,
          confirmationCode: `RES-CANC-${i + 1}-${randomUUID().slice(0, 4).toUpperCase()}`,
          bookerGuestId: guest.id,
          checkInDate: new Date(`${checkInDate}T00:00:00.000Z`),
          checkOutDate: new Date(`${checkOutDate}T00:00:00.000Z`),
          status: 'CANCELLED',
          bookingSource: cfg.source,
          totalAmount,
          createdBy: receptionist.id,
          createdAt: createdDate,
          cancelledAt: cancelledDate,
          cancelledBy: receptionist.id,
          cancellationReason: 'Khách thay đổi lịch công tác đột xuất',
        },
      });

      await prisma.reservationRoom.create({
        data: {
          hotelId: hotel.id,
          reservationId: res.id,
          roomTypeId: rtRecord.id,
          roomId: null,
          adults: 2,
          children: 0,
          createdAt: createdDate,
        },
      });
    }
    console.info(`✅ Đã tạo 3 Đơn đặt phòng đã hủy (Cancelled Reservations).`);

    // F. 2 NO-SHOW RESERVATIONS
    const noShowConfig = [
      { daysAgoCreated: 6, checkInDaysAgo: 3, source: 'DIRECT' as const },
      { daysAgoCreated: 5, checkInDaysAgo: 2, source: 'WALK_IN' as const },
    ];
    for (let i = 0; i < noShowConfig.length; i++) {
      const cfg = noShowConfig[i];
      const rt = roomTypesConfig[(i + 2) % roomTypesConfig.length];
      const rtRecord = roomTypeMap.get(rt.code)!;
      const guest = guestList[guestIdx++ % guestList.length];
      const checkInDate = addDays(today, -cfg.checkInDaysAgo);
      const checkOutDate = addDays(checkInDate, 2);
      const totalAmount = (parseFloat(rtRecord.basePrice.toString()) * 2).toFixed(2);
      const createdDate = new Date(`${addDays(today, -cfg.daysAgoCreated)}T11:00:00.000Z`);

      const res = await prisma.reservation.create({
        data: {
          hotelId: hotel.id,
          confirmationCode: `RES-NOSHOW-${i + 1}-${randomUUID().slice(0, 4).toUpperCase()}`,
          bookerGuestId: guest.id,
          checkInDate: new Date(`${checkInDate}T00:00:00.000Z`),
          checkOutDate: new Date(`${checkOutDate}T00:00:00.000Z`),
          status: 'NO_SHOW',
          bookingSource: cfg.source,
          totalAmount,
          createdBy: receptionist.id,
          createdAt: createdDate,
        },
      });

      await prisma.reservationRoom.create({
        data: {
          hotelId: hotel.id,
          reservationId: res.id,
          roomTypeId: rtRecord.id,
          roomId: null,
          adults: 2,
          children: 0,
          createdAt: createdDate,
        },
      });
    }
    console.info(`✅ Đã tạo 2 Đơn đặt phòng khách không đến (No-Show Reservations).`);

    // E. HOUSEKEEPING TASKS
    // 1. DIRTY rooms -> PENDING tasks
    const dirtyRooms = ['103', '110', '307', '410'];
    for (const rNum of dirtyRooms) {
      const room = roomMap.get(rNum)!;
      await prisma.housekeepingTask.create({
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
    }

    // 2. CLEANING rooms -> IN_PROGRESS tasks
    const cleaningRoom1 = roomMap.get('108')!;
    await prisma.housekeepingTask.create({
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

    const cleaningRoom2 = roomMap.get('304')!;
    await prisma.housekeepingTask.create({
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

    // 3. INSPECTION room -> AWAITING_INSPECTION task
    const inspectionRoom = roomMap.get('209')!;
    await prisma.housekeepingTask.create({
      data: {
        hotelId: hotel.id,
        roomId: inspectionRoom.id,
        activeRoomId: inspectionRoom.id,
        status: 'AWAITING_INSPECTION',
        priority: 'NORMAL',
        assignedTo: hkCuc.id,
        startedAt: new Date(`${today}T08:00:00.000Z`),
        notes: 'Đã dọn xong, chờ Trưởng nhóm nghiệm thu chất lượng',
        createdBy: hkLead.id,
      },
    });

    // 4. COMPLETED tasks (past performance)
    for (let c = 0; c < 6; c++) {
      await prisma.housekeepingTask.create({
        data: {
          hotelId: hotel.id,
          roomId: roomMap.get('102')!.id,
          activeRoomId: null, // COMPLETED tasks have activeRoomId = null
          status: 'COMPLETED',
          priority: 'NORMAL',
          assignedTo: hkMai.id,
          startedAt: new Date(`${addDays(today, -1)}T08:00:00.000Z`),
          completedAt: new Date(`${addDays(today, -1)}T09:00:00.000Z`),
          inspectedAt: new Date(`${addDays(today, -1)}T09:15:00.000Z`),
          inspectedBy: hkLead.id,
          notes: 'Hoàn thành đạt chuẩn 5 sao',
          createdBy: hkLead.id,
        },
      });
    }
    console.info(`✅ Đã tạo các nhiệm vụ Buồng phòng ở cả 4 cột Kanban.`);

    // F. MAINTENANCE TICKETS & BLOCKS
    // Block 1: Room 104 (Plumbing leak)
    const room104 = roomMap.get('104')!;
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
        startedAt: new Date(`${addDays(today, -1)}T16:00:00.000Z`),
      },
    });

    await prisma.maintenanceBlock.create({
      data: {
        hotelId: hotel.id,
        roomId: room104.id,
        maintenanceTicketId: ticket104.id,
        startDate: new Date(`${addDays(today, -1)}T00:00:00.000Z`),
        endDate: new Date(`${addDays(today, 2)}T00:00:00.000Z`),
        status: 'ACTIVE',
        reason: 'Sửa chữa và thay thế đường ống nước phòng tắm',
        createdBy: technician.id,
      },
    });

    // Block 2: Room 206 (Air conditioner repair)
    const room206 = roomMap.get('206')!;
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
        startedAt: new Date(`${today}T08:00:00.000Z`),
      },
    });

    await prisma.maintenanceBlock.create({
      data: {
        hotelId: hotel.id,
        roomId: room206.id,
        maintenanceTicketId: ticket206.id,
        startDate: new Date(`${today}T00:00:00.000Z`),
        endDate: new Date(`${addDays(today, 3)}T00:00:00.000Z`),
        status: 'ACTIVE',
        reason: 'Bảo dưỡng cục nóng và nạp gas máy lạnh',
        createdBy: techLong.id,
      },
    });

    // Open ticket: Room 307
    await prisma.maintenanceTicket.create({
      data: {
        hotelId: hotel.id,
        roomId: roomMap.get('307')!.id,
        title: 'Bóng đèn hành lang trước cửa chập chờn',
        description: 'Bóng đèn LED chiếu sáng trước cửa phòng 307 bị nhấp nháy liên tục.',
        priority: 'LOW',
        status: 'OPEN',
        reportedBy: hkCuc.id,
      },
    });
    console.info(`✅ Đã tạo các phiếu sự cố kỹ thuật và 2 Lệnh khóa phòng bảo trì (Room 104 & 206).`);

    console.info('\n🎉 ========================================================');
    console.info('🎉 ĐỒNG BỘ CƠ SỞ DỮ LIỆU INNVYRA PMS 40 PHÒNG THÀNH CÔNG!');
    console.info('🎉 ========================================================');
    console.info(`• Khách sạn: ${hotel.name}`);
    console.info(`• Tổng số phòng: 40 phòng (4 tầng, 101–410) | 6 Hạng phòng phân cấp`);
    console.info(`• Tổng nhân sự: ${staffMap.size} nhân viên (đủ ca trực) | Mật khẩu chung: ${demoPassword}`);
    console.info(`• Hồ sơ khách: 35 khách hàng`);
    console.info(`• Lưu trú thực tế: 20 phòng đang ở (In-House Stays) - Phòng Matrix hiển thị xanh`);
    console.info(`• Khóa bảo trì: 2 phòng (104, 206) - Phòng Matrix hiển thị đỏ`);
    console.info(`• Dự kiến đến hôm nay: 6 đơn | Chưa gán phòng: 4 đơn`);
    console.info(`• Buồng phòng: Đầy đủ 4 cột Kanban | Sổ công nợ: Đầy đủ Debit & Credit`);
    console.info('========================================================\n');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(
    error instanceof AppError
      ? error.message
      : error instanceof z.ZodError
        ? 'Invalid seed configuration.'
        : error,
  );
  process.exitCode = 1;
});
