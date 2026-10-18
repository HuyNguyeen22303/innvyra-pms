import 'dotenv/config';
import { scriptPrisma } from './database-tools.js';
import { Prisma } from '../src/generated/prisma/client.js';

interface SeedItemDef {
  code: string;
  name: string;
  categoryCode: string;
  unit: string;
  description: string;
  minStockLevel: string;
  initialStock: string;
  unitPrice: string;
  supplierCode: string;
}

const categoriesData = [
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
];

const suppliersData = [
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
];

const inventoryItemsData: SeedItemDef[] = [
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
    initialStock: '45.00', // Intentional LOW STOCK (< min 80)
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
    initialStock: '8.00', // Intentional LOW STOCK (< min 20)
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
];

async function seedInventory() {
  const prisma = scriptPrisma();

  try {
    console.info('🚀 Bắt đầu tạo 20 Seed Data cho Module Inventory...');

    // 1. Tìm Hotel
    const hotel = await prisma.hotel.findFirst({
      orderBy: { id: 'asc' },
    });
    if (!hotel) {
      throw new Error('Chưa tìm thấy khách sạn nào trong cơ sở dữ liệu. Vui lòng chạy npm run db:seed trước.');
    }
    console.info(`🏨 Sử dụng khách sạn: ${hotel.name} (Code: ${hotel.code}, ID: ${hotel.id.toString()})`);

    // 2. Tìm nhân viên ADMIN / MANAGER để làm creator
    const staff = await prisma.staffUser.findFirst({
      where: {
        hotelId: hotel.id,
        role: { code: { in: ['ADMIN', 'MANAGER'] } },
        isActive: true,
      },
      include: { role: true },
      orderBy: { id: 'asc' },
    });
    if (!staff) {
      throw new Error('Chưa tìm thấy tài khoản nhân viên ADMIN/MANAGER nào để gắn vào giao dịch kho.');
    }
    console.info(`👤 Người thực hiện tạo giao dịch kho: ${staff.fullName} (@${staff.username}, Role: ${staff.role.code})`);

    // 3. Seed Danh Mục (Categories)
    console.info('📁 Đang tạo 5 Danh mục vật tư...');
    const categoryMap = new Map<string, bigint>();
    for (const cat of categoriesData) {
      const existing = await prisma.inventoryCategory.findFirst({
        where: { hotelId: hotel.id, code: cat.code },
      });
      if (existing) {
        categoryMap.set(cat.code, existing.id);
      } else {
        const created = await prisma.inventoryCategory.create({
          data: {
            hotelId: hotel.id,
            code: cat.code,
            name: cat.name,
            description: cat.description,
            isActive: true,
          },
        });
        categoryMap.set(cat.code, created.id);
      }
    }
    console.info(`✅ Hoàn thành 5 danh mục: ${Array.from(categoryMap.keys()).join(', ')}`);

    // 4. Seed Nhà Cung Cấp (Suppliers)
    console.info('🏢 Đang tạo 4 Nhà cung cấp...');
    const supplierMap = new Map<string, bigint>();
    for (const sup of suppliersData) {
      const existing = await prisma.supplier.findFirst({
        where: { hotelId: hotel.id, code: sup.code },
      });
      if (existing) {
        supplierMap.set(sup.code, existing.id);
      } else {
        const created = await prisma.supplier.create({
          data: {
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
        });
        supplierMap.set(sup.code, created.id);
      }
    }
    console.info(`✅ Hoàn thành 4 nhà cung cấp: ${Array.from(supplierMap.keys()).join(', ')}`);

    // 5. Seed 20 Vật Tư (Items)
    console.info('📦 Đang khởi tạo 20 Vật tư trong kho...');
    const itemMap = new Map<string, { id: bigint; code: string; name: string }>();

    for (const it of inventoryItemsData) {
      const categoryId = categoryMap.get(it.categoryCode);
      if (!categoryId) continue;

      let item = await prisma.inventoryItem.findFirst({
        where: { hotelId: hotel.id, code: it.code },
      });

      if (!item) {
        item = await prisma.inventoryItem.create({
          data: {
            hotelId: hotel.id,
            categoryId,
            code: it.code,
            name: it.name,
            unit: it.unit,
            description: it.description,
            minStockLevel: new Prisma.Decimal(it.minStockLevel),
            currentStock: new Prisma.Decimal('0.00'), // Stock sẽ được tăng qua Phiếu Nhập kho
            isActive: true,
          },
        });
      }

      itemMap.set(it.code, { id: item.id, code: item.code, name: item.name });
    }
    console.info(`✅ Đã sẵn sàng 20 vật tư với mã: ${Array.from(itemMap.keys()).join(', ')}`);

    // 6. Tạo Phiếu Nhập Kho Ban Đầu (Initial Stock Receipt) để có lịch sử giao dịch & số dư kho chuẩn
    const receiptNumber = 'REC-INIT-SEED01';
    const existingReceipt = await prisma.stockReceipt.findFirst({
      where: { hotelId: hotel.id, receiptNumber },
    });

    if (!existingReceipt) {
      console.info('📥 Đang tạo Phiếu Nhập Kho ban đầu (REC-INIT-SEED01) cho 20 vật tư...');
      const supplierId = supplierMap.get('SUP-ASIA')!;

      // Tính tổng tiền phiếu nhập
      let totalAmount = new Prisma.Decimal(0);
      for (const it of inventoryItemsData) {
        const lineTotal = new Prisma.Decimal(it.initialStock).mul(new Prisma.Decimal(it.unitPrice));
        totalAmount = totalAmount.add(lineTotal);
      }

      await prisma.$transaction(async (tx) => {
        const receipt = await tx.stockReceipt.create({
          data: {
            hotelId: hotel.id,
            supplierId,
            receiptNumber,
            receiptDate: new Date(),
            totalAmount,
            notes: 'Phiếu nhập kho ban đầu thiết lập số dư tồn đầu kỳ cho hệ thống',
            createdBy: staff.id,
          },
        });

        for (const it of inventoryItemsData) {
          const itemMeta = itemMap.get(it.code)!;
          const qty = new Prisma.Decimal(it.initialStock);
          const price = new Prisma.Decimal(it.unitPrice);
          const lineTotal = qty.mul(price);

          // Tạo dòng chi tiết nhập
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

          // Cập nhật tồn kho vật tư
          const currentItem = await tx.inventoryItem.findUniqueOrThrow({
            where: { id: itemMeta.id },
          });
          const prevStock = currentItem.currentStock;
          const newStock = prevStock.add(qty);

          await tx.inventoryItem.update({
            where: { id: itemMeta.id },
            data: { currentStock: newStock },
          });

          // Ghi sổ biến động kho (Movement)
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
              createdBy: staff.id,
            },
          });
        }
      });
      console.info(`✅ Phiếu nhập kho ${receiptNumber} hoàn tất với tổng giá trị: ${totalAmount.toFixed(2)} VNĐ`);
    } else {
      console.info(`ℹ️ Phiếu nhập kho ${receiptNumber} đã tồn tại, bỏ qua bước tạo phiếu nhập.`);
    }

    // 7. Tạo Một Phiếu Xuất Kho Thử Nghiệm (Stock Issue) cho bộ phận Housekeeping
    const issueNumber = 'ISS-DEMO-HK01';
    const existingIssue = await prisma.stockIssue.findFirst({
      where: { hotelId: hotel.id, issueNumber },
    });

    if (!existingIssue) {
      console.info('📤 Đang tạo Phiếu Xuất Kho thử nghiệm (ISS-DEMO-HK01) cho buồng phòng...');
      const soapItem = itemMap.get('AMEN-SG-40ML')!;
      const toothBrushItem = itemMap.get('AMEN-TB-01')!;

      await prisma.$transaction(async (tx) => {
        const issue = await tx.stockIssue.create({
          data: {
            hotelId: hotel.id,
            issueNumber,
            issueDate: new Date(),
            department: 'Housekeeping',
            purpose: 'Cấp phát vật tư phòng khách tầng 3 & tầng 4',
            notes: 'Xuất kho ca sáng',
            createdBy: staff.id,
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
              createdBy: staff.id,
            },
          });
        }
      });
      console.info(`✅ Phiếu xuất kho ${issueNumber} hoàn tất.`);
    }

    // 8. Tạo Một Phiếu Kiểm Kê Điều Chỉnh (Stock Adjustment) thử nghiệm
    const adjNumber = 'ADJ-DEMO-CHK01';
    const waterItem = itemMap.get('AMEN-WATER')!;
    const existingAdj = await prisma.stockAdjustment.findFirst({
      where: { hotelId: hotel.id, adjustmentNumber: adjNumber },
    });

    if (!existingAdj) {
      console.info('⚖️ Đang tạo Phiếu Điều Chỉnh kiểm kê thử nghiệm (ADJ-DEMO-CHK01)...');
      await prisma.$transaction(async (tx) => {
        const currentItem = await tx.inventoryItem.findUniqueOrThrow({
          where: { id: waterItem.id },
        });
        const systemQty = currentItem.currentStock;
        const actualQty = systemQty.add(new Prisma.Decimal('5.00')); // thừa 5 chai
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
            createdBy: staff.id,
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
            createdBy: staff.id,
          },
        });
      });
      console.info(`✅ Phiếu kiểm kê ${adjNumber} hoàn tất.`);
    }

    console.info('\n🎉 SEED DỮ LIỆU KHO THÀNH CÔNG RỰC RỠ!');
    console.info('------------------------------------------------------------');
    console.info(`• 5 Danh mục vật tư (Amenities, Linen, Cleaning, Minibar, Maintenance)`);
    console.info(`• 4 Nhà cung cấp uy tín`);
    console.info(`• 20 Vật tư với thông số tồn kho, đơn vị tính và định mức đầy đủ`);
    console.info(`• 2 Vật tư dưới định mức (LOW STOCK) để test cảnh báo:`);
    console.info(`    1. [AMEN-SH-40ML] Dầu gội 40ml: Tồn 45 / Tối thiểu 80`);
    console.info(`    2. [ENG-BULB-9W] Bóng đèn LED 9W: Tồn 8 / Tối thiểu 20`);
    console.info(`• Đầy đủ lịch sử: 1 Phiếu nhập, 1 Phiếu xuất, 1 Phiếu kiểm kê, 23 Bản ghi biến động kho.`);
    console.info('------------------------------------------------------------');
  } finally {
    await prisma.$disconnect();
  }
}

seedInventory().catch((err: unknown) => {
  console.error('❌ Lỗi khi seed kho:', err);
  process.exitCode = 1;
});
