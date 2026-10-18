import { z } from 'zod';
import { scriptPrisma } from '../scripts/database-tools.js';
import { adminInputSchema } from '../src/modules/auth/auth.schema.js';
import { AppError } from '../src/shared/errors/app-error.js';
import { hashPassword } from '../src/shared/utils/password.js';
import { GuestCrypto } from '../src/modules/guests/guest.crypto.js';
import { Prisma } from '../src/generated/prisma/client.js';

const roles = [
  ['ADMIN', 'Quản trị hệ thống'],
  ['MANAGER', 'Quản lý khách sạn'],
  ['RECEPTIONIST', 'Nhân viên lễ tân'],
  ['HOUSEKEEPING', 'Nhân viên buồng phòng'],
  ['ACCOUNTANT', 'Nhân viên kế toán'],
  ['TECHNICIAN', 'Nhân viên kỹ thuật'],
] as const;

const staffAccounts = [
  ['MANAGER', 'manager', 'Nguyễn Minh Anh'],
  ['RECEPTIONIST', 'receptionist', 'Trần Ngọc Linh'],
  ['ACCOUNTANT', 'accountant', 'Lê Thu Hà'],
  ['HOUSEKEEPING', 'housekeeping', 'Phạm Thị Lan'],
  ['TECHNICIAN', 'technician', 'Hoàng Văn Nam'],
] as const;

// Prices are VND decimal strings, matching the room type API.
const roomTypes = [
  ['STD-SGL', 'Standard Single', 1, 0, '500000.00'],
  ['STD-DBL', 'Standard Double', 2, 1, '650000.00'],
  ['STD-TWN', 'Standard Twin', 2, 1, '700000.00'],
  ['STD-TRP', 'Standard Triple', 3, 1, '850000.00'],
  ['SUP-DBL', 'Superior Double', 2, 1, '900000.00'],
  ['SUP-TWN', 'Superior Twin', 2, 1, '950000.00'],
  ['SUP-GARDEN', 'Superior Garden View', 2, 1, '1000000.00'],
  ['SUP-CITY', 'Superior City View', 2, 1, '1050000.00'],
  ['DLX-DBL', 'Deluxe Double', 2, 1, '1200000.00'],
  ['DLX-TWN', 'Deluxe Twin', 2, 1, '1250000.00'],
  ['DLX-BALCONY', 'Deluxe Balcony', 2, 1, '1400000.00'],
  ['DLX-SEA', 'Deluxe Sea View', 2, 1, '1600000.00'],
  ['FAMILY', 'Family Room', 4, 2, '1800000.00'],
  ['FAMILY-CONNECT', 'Family Connecting', 4, 2, '2000000.00'],
  ['FAMILY-GARDEN', 'Family Garden View', 4, 2, '2100000.00'],
  ['FAMILY-SEA', 'Family Sea View', 4, 2, '2300000.00'],
  ['SUITE-JUNIOR', 'Junior Suite', 2, 1, '2500000.00'],
  ['SUITE-EXEC', 'Executive Suite', 2, 2, '3000000.00'],
  ['SUITE-PREMIUM', 'Premium Suite', 4, 2, '4000000.00'],
  ['SUITE-PRESIDENT', 'Presidential Suite', 4, 2, '6000000.00'],
] as const;

const demoGuests = [
  {
    fullName: 'Nguyễn Văn An',
    phone: '0901234567',
    email: 'an.nguyen@gmail.com',
    dateOfBirth: '1990-05-15',
    gender: 'MALE' as const,
    nationality: 'Việt Nam',
    documentType: 'NATIONAL_ID' as const,
    documentNumber: '079090001234',
    address: '123 Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
    notes: 'Khách VIP thân thiết, thích phòng tầng cao yên tĩnh',
  },
  {
    fullName: 'Trần Thị Bích',
    phone: '0912345678',
    email: 'bich.tran@yahoo.com',
    dateOfBirth: '1988-10-20',
    gender: 'FEMALE' as const,
    nationality: 'Việt Nam',
    documentType: 'NATIONAL_ID' as const,
    documentNumber: '001188002345',
    address: '45 Hai Bà Trưng, Phường Tràng Tiền, Quận Hoàn Kiếm, Hà Nội',
    notes: 'Yêu cầu phòng không hút thuốc và có bồn tắm',
  },
  {
    fullName: 'Lê Hoàng Long',
    phone: '0983456789',
    email: 'long.le@outlook.com',
    dateOfBirth: '1995-03-12',
    gender: 'MALE' as const,
    nationality: 'Việt Nam',
    documentType: 'NATIONAL_ID' as const,
    documentNumber: '048095003456',
    address: '78 Bạch Đằng, Phường Hải Châu 1, Quận Hải Châu, TP. Đà Nẵng',
    notes: 'Khách lưu trú công tác dài ngày',
  },
  {
    fullName: 'Phạm Thu Hương',
    phone: '0974567890',
    email: 'huong.pham@gmail.com',
    dateOfBirth: '1992-07-25',
    gender: 'FEMALE' as const,
    nationality: 'Việt Nam',
    documentType: 'NATIONAL_ID' as const,
    documentNumber: '031092004567',
    address: '12 Trần Phú, Phường Lương Khánh Thiện, Quận Ngô Quyền, Hải Phòng',
    notes: 'Thích phòng view vườn thoáng mát',
  },
  {
    fullName: 'Hoàng Minh Đức',
    phone: '0965678901',
    email: 'duc.hoang@company.vn',
    dateOfBirth: '1985-12-08',
    gender: 'MALE' as const,
    nationality: 'Việt Nam',
    documentType: 'NATIONAL_ID' as const,
    documentNumber: '001085005678',
    address: '56 Kim Mã, Phường Kim Mã, Quận Ba Đình, Hà Nội',
    notes: 'Yêu cầu xuất hóa đơn công ty khi thanh toán',
  },
  {
    fullName: 'Đặng Ngọc Mai',
    phone: '0936789012',
    email: 'mai.dang@gmail.com',
    dateOfBirth: '1998-09-18',
    gender: 'FEMALE' as const,
    nationality: 'Việt Nam',
    documentType: 'NATIONAL_ID' as const,
    documentNumber: '079198006789',
    address: '89 Nguyễn Trãi, Phường 2, Quận 5, TP. Hồ Chí Minh',
    notes: 'Du lịch nghỉ dưỡng cùng gia đình có trẻ nhỏ',
  },
  {
    fullName: 'Vũ Quốc Bảo',
    phone: '0947890123',
    email: 'bao.vu@tech.io',
    dateOfBirth: '1993-01-30',
    gender: 'MALE' as const,
    nationality: 'Việt Nam',
    documentType: 'NATIONAL_ID' as const,
    documentNumber: '075093007890',
    address: '34 Đồng Khởi, Phường Tân Hiệp, TP. Biên Hòa, Đồng Nai',
    notes: 'Thường check-in muộn sau 21:00 do chuyến bay tối',
  },
  {
    fullName: 'Bùi Phương Thảo',
    phone: '0928901234',
    email: 'thao.bui@gmail.com',
    dateOfBirth: '1996-06-14',
    gender: 'FEMALE' as const,
    nationality: 'Việt Nam',
    documentType: 'NATIONAL_ID' as const,
    documentNumber: '068096008901',
    address: '15 Quang Trung, Phường 9, TP. Đà Lạt, Lâm Đồng',
    notes: 'Dị ứng phấn hoa và hải sản tươi sống',
  },
  {
    fullName: 'Đỗ Tuấn Kiệt',
    phone: '0919012345',
    email: 'kiet.do@gmail.com',
    dateOfBirth: '1989-11-05',
    gender: 'MALE' as const,
    nationality: 'Việt Nam',
    documentType: 'NATIONAL_ID' as const,
    documentNumber: '079089009012',
    address: '102 Cách Mạng Tháng 8, Phường 7, Quận 3, TP. Hồ Chí Minh',
    notes: 'Thành viên Platinum chuỗi khách sạn boutique',
  },
  {
    fullName: 'Ngô Mỹ Linh',
    phone: '0909123456',
    email: 'linh.ngo@fashion.vn',
    dateOfBirth: '1997-04-22',
    gender: 'FEMALE' as const,
    nationality: 'Việt Nam',
    documentType: 'NATIONAL_ID' as const,
    documentNumber: '001197010123',
    address: '67 Thợ Nhuộm, Phường Cửa Nam, Quận Hoàn Kiếm, Hà Nội',
    notes: 'Cần thêm gối phụ và bàn ủi trong phòng',
  },
  {
    fullName: 'John David Smith',
    phone: '+12025550143',
    email: 'john.smith@gmail.com',
    dateOfBirth: '1982-08-19',
    gender: 'MALE' as const,
    nationality: 'United States',
    documentType: 'PASSPORT' as const,
    documentNumber: 'A12345678',
    address: '742 Evergreen Terrace, Springfield, OR, USA',
    notes: 'English speaking, requests airport transfer service',
  },
  {
    fullName: 'Emma Charlotte Brown',
    phone: '+442079460912',
    email: 'emma.brown@yahoo.co.uk',
    dateOfBirth: '1991-02-11',
    gender: 'FEMALE' as const,
    nationality: 'United Kingdom',
    documentType: 'PASSPORT' as const,
    documentNumber: 'GB98765432',
    address: '10 Downing Mews, London, UK',
    notes: 'Prefers high floor with ocean balcony view',
  },
  {
    fullName: 'Michael Kenji Tanaka',
    phone: '+81355550198',
    email: 'm.tanaka@tokyo.jp',
    dateOfBirth: '1986-11-28',
    gender: 'MALE' as const,
    nationality: 'Japan',
    documentType: 'PASSPORT' as const,
    documentNumber: 'JP87654321',
    address: '2-11-3 Nagatacho, Chiyoda-ku, Tokyo, Japan',
    notes: 'Quiet room required for online business conferences',
  },
  {
    fullName: 'Park Min-Ji',
    phone: '+8223123456',
    email: 'minji.park@naver.com',
    dateOfBirth: '1994-05-03',
    gender: 'FEMALE' as const,
    nationality: 'South Korea',
    documentType: 'PASSPORT' as const,
    documentNumber: 'M12389045',
    address: 'Gangnam-daero 396, Gangnam-gu, Seoul, Korea',
    notes: 'Honeymoon couple, requests floral room decoration',
  },
  {
    fullName: 'Jean-Pierre Dubois',
    phone: '+33142685555',
    email: 'jp.dubois@orange.fr',
    dateOfBirth: '1979-12-15',
    gender: 'MALE' as const,
    nationality: 'France',
    documentType: 'PASSPORT' as const,
    documentNumber: 'FR54321098',
    address: '15 Rue de la Paix, 75002 Paris, France',
    notes: 'Vegetarian breakfast preference',
  },
  {
    fullName: 'Hans Mueller',
    phone: '+493012345678',
    email: 'hans.mueller@berlin.de',
    dateOfBirth: '1984-03-27',
    gender: 'MALE' as const,
    nationality: 'Germany',
    documentType: 'PASSPORT' as const,
    documentNumber: 'C01X00T47',
    address: 'Friedrichstraße 43, 10117 Berlin, Germany',
    notes: 'Requests early check-in around 10:00 AM if available',
  },
  {
    fullName: 'Lý Gia Hào',
    phone: '0908765432',
    email: 'hao.ly@finance.com',
    dateOfBirth: '1987-08-08',
    gender: 'MALE' as const,
    nationality: 'Việt Nam',
    documentType: 'NATIONAL_ID' as const,
    documentNumber: '079087011234',
    address: '205 An Dương Vương, Phường 8, Quận 5, TP. Hồ Chí Minh',
    notes: 'Hội viên Diamond, ưu tiên nhận phòng sớm',
  },
  {
    fullName: 'Võ Thị Thanh Thủy',
    phone: '0918765432',
    email: 'thuy.vo@gmail.com',
    dateOfBirth: '1993-10-10',
    gender: 'FEMALE' as const,
    nationality: 'Việt Nam',
    documentType: 'NATIONAL_ID' as const,
    documentNumber: '072093012345',
    address: '18 Nguyễn Thị Minh Khai, Phường Lộc Thọ, TP. Nha Trang, Khánh Hòa',
    notes: 'Khách đặt phòng gia đình có người lớn tuổi',
  },
  {
    fullName: 'Trương Quốc Huy',
    phone: '0988765432',
    email: 'huy.truong@startup.vn',
    dateOfBirth: '1990-01-25',
    gender: 'MALE' as const,
    nationality: 'Việt Nam',
    documentType: 'NATIONAL_ID' as const,
    documentNumber: '083090013456',
    address: '42 Trần Hưng Đạo, Phường An Cư, Quận Ninh Kiều, TP. Cần Thơ',
    notes: 'Tham gia hội thảo doanh nghiệp tại khách sạn',
  },
  {
    fullName: 'Sophia Chen',
    phone: '+6567890123',
    email: 'sophia.chen@singapore.sg',
    dateOfBirth: '1995-07-07',
    gender: 'FEMALE' as const,
    nationality: 'Singapore',
    documentType: 'PASSPORT' as const,
    documentNumber: 'K7654321B',
    address: '1 Raffles Place, Singapore 048616',
    notes: 'Requires extra bed and infant baby cot',
  },
] as const;

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
  // 1. Amenities (9 items)
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

  // 2. Linen (4 items)
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

  // 3. Cleaning & Chemicals (3 items)
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

  // 4. Minibar & Snack (2 items)
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

  // 5. Engineering & Maintenance (2 items)
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

async function main() {
  const prisma = scriptPrisma();
  try {
    const hotelInput =
      process.env.SEED_HOTEL_CODE || process.env.SEED_HOTEL_NAME
        ? z
            .object({
              code: z.string().trim().min(1).max(50),
              name: z.string().trim().min(1).max(191),
            })
            .parse({ code: process.env.SEED_HOTEL_CODE, name: process.env.SEED_HOTEL_NAME })
        : undefined;
    const seedDemo =
      z
        .enum(['true', 'false'])
        .default(process.env.NODE_ENV === 'production' ? 'false' : 'true')
        .parse(process.env.SEED_DEMO_DATA) === 'true';
    if (seedDemo && process.env.NODE_ENV === 'production') {
      throw new AppError(400, 'DEMO_PRODUCTION', 'Demo seed is only available outside production.');
    }
    const password = seedDemo
      ? adminInputSchema.shape.password.parse(
          process.env.SEED_STAFF_PASSWORD ?? 'Innvyra@Demo2026!',
        )
      : undefined;
    // Hash outside the transaction; each account receives its own Argon2id salt.
    const accounts = await Promise.all(
      (password ? staffAccounts : []).map(async ([roleCode, username, fullName]) => ({
        roleCode,
        username,
        fullName,
        passwordHash: await hashPassword(password!),
      })),
    );
    const result = await prisma.$transaction(
      async (tx) => {
        for (const [code, name] of roles) {
          await tx.role.upsert({ where: { code }, create: { code, name }, update: {} });
        }
        let hotel = hotelInput
          ? await tx.hotel.upsert({
              where: { code: hotelInput.code },
              create: hotelInput,
              update: {},
            })
          : undefined;
        if (!seedDemo)
          return {
            hotel,
            staff: 0,
            roomTypes: 0,
            rooms: 0,
            guests: 0,
            categories: 0,
            suppliers: 0,
            items: 0,
          };
        if (!hotel) {
          const hotels = await tx.hotel.findMany({ take: 2, orderBy: { id: 'asc' } });
          if (hotels.length > 1) {
            throw new AppError(
              400,
              'SEED_HOTEL_REQUIRED',
              'Multiple hotels found. Set SEED_HOTEL_CODE and SEED_HOTEL_NAME.',
            );
          }
          hotel =
            hotels[0] ?? (await tx.hotel.create({ data: { code: 'MAIN', name: 'Innvyra Hotel' } }));
        }
        const crypto =
          process.env.GUEST_ENCRYPTION_KEY && process.env.GUEST_HASH_KEY
            ? new GuestCrypto({
                GUEST_ENCRYPTION_KEY: process.env.GUEST_ENCRYPTION_KEY,
                GUEST_HASH_KEY: process.env.GUEST_HASH_KEY,
              })
            : null;

        const created = {
          hotel,
          staff: 0,
          roomTypes: 0,
          rooms: 0,
          guests: 0,
          categories: 0,
          suppliers: 0,
          items: 0,
        };
        for (const { roleCode, ...account } of accounts) {
          const role = await tx.role.findUniqueOrThrow({ where: { code: roleCode } });
          const existing = await tx.staffUser.findUnique({ where: { username: account.username } });
          if (existing) {
            if (existing.hotelId !== hotel.id || existing.roleId !== role.id) {
              throw new AppError(
                409,
                'SEED_ACCOUNT_CONFLICT',
                `Seed username ${account.username} belongs to another hotel or role.`,
              );
            }
            continue;
          }
          await tx.staffUser.create({ data: { ...account, hotelId: hotel.id, roleId: role.id } });
          created.staff++;
        }
        for (const [
          index,
          [code, name, maxAdults, maxChildren, basePrice],
        ] of roomTypes.entries()) {
          let roomType = await tx.roomType.findUnique({
            where: { hotelId_code: { hotelId: hotel.id, code } },
          });
          if (!roomType) {
            roomType = await tx.roomType.create({
              data: {
                hotelId: hotel.id,
                code,
                name,
                description: `Phòng ${name} dành cho tối đa ${maxAdults} người lớn và ${maxChildren} trẻ em.`,
                maxAdults,
                maxChildren,
                basePrice,
              },
            });
            created.roomTypes++;
          }
          const floorNumber = Math.floor(index / 10) + 1;
          const roomNumber = String(floorNumber * 100 + (index % 10) + 1);
          if (
            await tx.room.findUnique({
              where: { hotelId_roomNumber: { hotelId: hotel.id, roomNumber } },
            })
          ) {
            continue;
          }
          if (!roomType.isActive) {
            throw new AppError(
              409,
              'SEED_ROOM_TYPE_INACTIVE',
              `Seed room type ${code} is inactive.`,
            );
          }
          await tx.room.create({
            data: {
              hotelId: hotel.id,
              roomTypeId: roomType.id,
              roomNumber,
              floorNumber,
              physicalStatus: 'ACTIVE',
              housekeepingStatus: 'READY',
            },
          });
          created.rooms++;
        }

        // Seed 20 Demo Guests
        for (const guest of demoGuests) {
          const existing = await tx.guest.findFirst({
            where: { hotelId: hotel.id, fullName: guest.fullName, phone: guest.phone },
          });
          if (existing) continue;

          await tx.guest.create({
            data: {
              hotelId: hotel.id,
              fullName: guest.fullName,
              phone: guest.phone,
              email: guest.email,
              dateOfBirth: guest.dateOfBirth
                ? new Date(`${guest.dateOfBirth}T00:00:00.000Z`)
                : null,
              gender: guest.gender,
              nationality: guest.nationality,
              documentType: guest.documentType,
              documentNumberCiphertext:
                guest.documentNumber && crypto
                  ? crypto.encrypt(hotel.id, guest.documentNumber)
                  : null,
              documentNumberHash:
                guest.documentNumber && crypto
                  ? crypto.fingerprint(hotel.id, guest.documentNumber)
                  : null,
              address: guest.address,
              notes: guest.notes,
            },
          });
          created.guests++;
        }

        // Seed Inventory Categories
        const categoryMap = new Map<string, bigint>();
        for (const cat of demoInventoryCategories) {
          const category = await tx.inventoryCategory.upsert({
            where: { hotelId_code: { hotelId: hotel.id, code: cat.code } },
            create: {
              hotelId: hotel.id,
              code: cat.code,
              name: cat.name,
              description: cat.description,
              isActive: true,
            },
            update: {},
          });
          categoryMap.set(cat.code, category.id);
          created.categories++;
        }

        // Seed Suppliers
        const supplierMap = new Map<string, bigint>();
        for (const sup of demoSuppliers) {
          const supplier = await tx.supplier.upsert({
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
            update: {},
          });
          supplierMap.set(sup.code, supplier.id);
          created.suppliers++;
        }

        // Seed 20 Inventory Items
        const itemMap = new Map<string, { id: bigint; code: string; name: string }>();
        for (const it of demoInventoryItems) {
          const categoryId = categoryMap.get(it.categoryCode);
          if (!categoryId) continue;

          const item = await tx.inventoryItem.upsert({
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
            update: {},
          });
          itemMap.set(it.code, { id: item.id, code: item.code, name: item.name });
          created.items++;
        }

        // Seed sample inventory transactions if a staff user is available
        const staffActor = await tx.staffUser.findFirst({
          where: { hotelId: hotel.id, isActive: true },
          orderBy: { id: 'asc' },
        });

        if (staffActor) {
          const receiptNumber = 'REC-INIT-SEED01';
          const existingReceipt = await tx.stockReceipt.findFirst({
            where: { hotelId: hotel.id, receiptNumber },
          });

          if (!existingReceipt) {
            const supplierId = supplierMap.get('SUP-ASIA') ?? null;
            let totalAmount = new Prisma.Decimal(0);
            for (const it of demoInventoryItems) {
              const lineTotal = new Prisma.Decimal(it.initialStock).mul(new Prisma.Decimal(it.unitPrice));
              totalAmount = totalAmount.add(lineTotal);
            }

            const receipt = await tx.stockReceipt.create({
              data: {
                hotelId: hotel.id,
                supplierId,
                receiptNumber,
                receiptDate: new Date(),
                totalAmount,
                notes: 'Phiếu nhập kho ban đầu thiết lập số dư tồn đầu kỳ cho hệ thống',
                createdBy: staffActor.id,
              },
            });

            for (const it of demoInventoryItems) {
              const itemMeta = itemMap.get(it.code);
              if (!itemMeta) continue;
              const qty = new Prisma.Decimal(it.initialStock);
              const price = new Prisma.Decimal(it.unitPrice);
              const lineTotal = qty.mul(price);

              await tx.stockReceiptItem.create({
                data: {
                  hotelId: hotel.id,
                  receiptId: receipt.id,
                  itemId: itemMeta.id,
                  quantity: qty,
                  unitPrice: price,
                  lineTotal,
                  notes: `Nhập tồn ban đầu: ${it.name}`,
                },
              });

              const currentItem = await tx.inventoryItem.findUniqueOrThrow({
                where: { id: itemMeta.id },
              });
              const prevStock = currentItem.currentStock;
              const newStock = prevStock.add(qty);

              await tx.inventoryItem.update({
                where: { id: itemMeta.id },
                data: { currentStock: newStock },
              });

              await tx.inventoryMovement.create({
                data: {
                  hotelId: hotel.id,
                  itemId: itemMeta.id,
                  type: 'RECEIPT',
                  quantity: qty,
                  previousStock: prevStock,
                  currentStock: newStock,
                  referenceType: 'STOCK_RECEIPT',
                  referenceId: receipt.id,
                  referenceNumber: receipt.receiptNumber,
                  notes: 'Nhập kho ban đầu',
                  createdBy: staffActor.id,
                },
              });
            }
          }

          const issueNumber = 'ISS-DEMO-HK01';
          const existingIssue = await tx.stockIssue.findFirst({
            where: { hotelId: hotel.id, issueNumber },
          });

          if (!existingIssue) {
            const soapItem = itemMap.get('AMEN-SG-40ML');
            const toothBrushItem = itemMap.get('AMEN-TB-01');

            if (soapItem && toothBrushItem) {
              const issue = await tx.stockIssue.create({
                data: {
                  hotelId: hotel.id,
                  issueNumber,
                  issueDate: new Date(),
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
                await tx.stockIssueItem.create({
                  data: {
                    hotelId: hotel.id,
                    issueId: issue.id,
                    itemId: line.meta.id,
                    quantity: line.qty,
                    notes: 'Xuất cấp phát phòng',
                  },
                });

                const currentItem = await tx.inventoryItem.findUniqueOrThrow({
                  where: { id: line.meta.id },
                });
                const prevStock = currentItem.currentStock;
                const newStock = prevStock.sub(line.qty);

                await tx.inventoryItem.update({
                  where: { id: line.meta.id },
                  data: { currentStock: newStock },
                });

                await tx.inventoryMovement.create({
                  data: {
                    hotelId: hotel.id,
                    itemId: line.meta.id,
                    type: 'ISSUE',
                    quantity: line.qty,
                    previousStock: prevStock,
                    currentStock: newStock,
                    referenceType: 'STOCK_ISSUE',
                    referenceId: issue.id,
                    referenceNumber: issue.issueNumber,
                    notes: 'Xuất kho cho Housekeeping',
                    createdBy: staffActor.id,
                  },
                });
              }
            }
          }

          const adjNumber = 'ADJ-DEMO-CHK01';
          const waterItem = itemMap.get('AMEN-WATER');
          const existingAdj = await tx.stockAdjustment.findFirst({
            where: { hotelId: hotel.id, adjustmentNumber: adjNumber },
          });

          if (!existingAdj && waterItem) {
            const currentItem = await tx.inventoryItem.findUniqueOrThrow({
              where: { id: waterItem.id },
            });
            const systemQty = currentItem.currentStock;
            const actualQty = systemQty.add(new Prisma.Decimal('5.00'));
            const diff = actualQty.sub(systemQty);

            const adj = await tx.stockAdjustment.create({
              data: {
                hotelId: hotel.id,
                adjustmentNumber: adjNumber,
                itemId: waterItem.id,
                systemQuantity: systemQty,
                actualQuantity: actualQty,
                difference: diff,
                reason: 'Kiểm kê định kỳ phát hiện thừa 5 chai nước đóng thùng nguyên vẹn',
                createdBy: staffActor.id,
              },
            });

            await tx.inventoryItem.update({
              where: { id: waterItem.id },
              data: { currentStock: actualQty },
            });

            await tx.inventoryMovement.create({
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
                notes: 'Điều chỉnh sau kiểm kê',
                createdBy: staffActor.id,
              },
            });
          }
        }

        return created;
      },
      { timeout: 60000 },
    );
    console.info('Roles seeded idempotently. Existing data and passwords were preserved.');
    if (result.hotel)
      console.info(`Hotel: ${result.hotel.code} (ID: ${result.hotel.id.toString()})`);
    if (seedDemo) {
      console.info(
        `Created ${result.staff} staff accounts, ${result.roomTypes} room types, ${result.rooms} rooms, ${result.guests} demo guests, and ${result.items} inventory items.`,
      );
      console.info(`Demo usernames: ${staffAccounts.map(([, username]) => username).join(', ')}`);
    }

  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(
    error instanceof AppError
      ? error.message
      : error instanceof z.ZodError
        ? 'Invalid seed configuration. Verify SEED_HOTEL_CODE / SEED_HOTEL_NAME, SEED_DEMO_DATA and SEED_STAFF_PASSWORD (15–128 varied characters).'
        : 'Seed failed. Verify database connectivity and migrations. No seed data was committed.',
  );
  process.exitCode = 1;
});
