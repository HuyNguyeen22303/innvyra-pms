export const localMaterialDefaults = [
  { code: 'ITEM_1', name: 'Khăn tắm', materialType: 'REUSABLE', category: 'LINEN' },
  { code: 'ITEM_2', name: 'Dầu gội mini', materialType: 'CONSUMABLE', category: 'AMENITY' },
  { code: 'ITEM_3', name: 'Bàn chải', materialType: 'CONSUMABLE', category: 'AMENITY' },
  { code: 'ITEM_4', name: 'Nước lau sàn', materialType: 'CONSUMABLE', category: 'CLEANING' },
  {
    code: 'ITEM_5',
    name: 'Dung dịch chuyên dụng',
    materialType: 'CONSUMABLE',
    category: 'CLEANING',
  },
  { code: 'ITEM_6', name: 'Tinh dầu phòng', materialType: 'CONSUMABLE', category: 'CLEANING' },
] as const;

export interface HousekeepingCatalogItem {
  code: string;
  name: string;
  unit: string;
  category: 'AMENITY' | 'CLEANING' | 'LINEN' | 'EQUIPMENT';
  materialType: 'CONSUMABLE' | 'REUSABLE';
  initialQuantity: number;
  unitPrice: string;
  minStock: number;
  description: string;
}

// Local operating catalog. Prices and opening receipt quantities are sample
// business data, not supplier quotations. Liquid SKUs are ready-to-use products;
// no conversion or dilution of the old bottle SKUs is inferred.
export const housekeepingCatalog: HousekeepingCatalogItem[] = [
  {
    code: 'AMEN_TOOTHPASTE',
    name: 'Kem đánh răng mini',
    unit: 'tuýp',
    category: 'AMENITY',
    materialType: 'CONSUMABLE',
    initialQuantity: 240,
    unitPrice: '2500',
    minStock: 30,
    description:
      'Gợi ý 1 tuýp/khách khi chuẩn bị phòng; bổ sung theo thực dùng, chọn sản phẩm phù hợp độ tuổi.',
  },
  {
    code: 'AMEN_BODY_WASH',
    name: 'Sữa tắm mini',
    unit: 'chai',
    category: 'AMENITY',
    materialType: 'CONSUMABLE',
    initialQuantity: 240,
    unitPrice: '5000',
    minStock: 30,
    description: 'Gợi ý 1 chai/khách; chỉ xuất số chai thực sự cấp mới.',
  },
  {
    code: 'AMEN_HAND_SOAP',
    name: 'Xà phòng rửa tay',
    unit: 'bánh',
    category: 'AMENITY',
    materialType: 'CONSUMABLE',
    initialQuantity: 120,
    unitPrice: '2000',
    minStock: 20,
    description: 'Gợi ý 1 bánh/phòng; thay theo tình trạng sử dụng.',
  },
  {
    code: 'AMEN_SHOWER_CAP',
    name: 'Mũ tắm',
    unit: 'cái',
    category: 'AMENITY',
    materialType: 'CONSUMABLE',
    initialQuantity: 240,
    unitPrice: '700',
    minStock: 30,
    description: 'Gợi ý 1 chiếc/khách; có thể cấp theo yêu cầu của khách sạn.',
  },
  {
    code: 'AMEN_COMB',
    name: 'Lược dùng một lần',
    unit: 'cái',
    category: 'AMENITY',
    materialType: 'CONSUMABLE',
    initialQuantity: 240,
    unitPrice: '1000',
    minStock: 30,
    description: 'Gợi ý 1 chiếc/khách; không thay vật tư còn nguyên bao bì nếu không cần.',
  },
  {
    code: 'AMEN_VANITY_KIT',
    name: 'Bộ tăm bông và bông tẩy trang',
    unit: 'bộ',
    category: 'AMENITY',
    materialType: 'CONSUMABLE',
    initialQuantity: 120,
    unitPrice: '1500',
    minStock: 20,
    description: 'Gợi ý 1 bộ/phòng; cấp bổ sung theo yêu cầu.',
  },
  {
    code: 'AMEN_SLIPPERS',
    name: 'Dép phòng dùng một lần',
    unit: 'đôi',
    category: 'AMENITY',
    materialType: 'CONSUMABLE',
    initialQuantity: 240,
    unitPrice: '4000',
    minStock: 30,
    description: 'Gợi ý 1 đôi/khách; chọn cỡ phù hợp, chỉ xuất đôi mới thực cấp.',
  },
  {
    code: 'AMEN_CONDITIONER',
    name: 'Dầu xả mini',
    unit: 'chai',
    category: 'AMENITY',
    materialType: 'CONSUMABLE',
    initialQuantity: 120,
    unitPrice: '6000',
    minStock: 20,
    description: 'Bố trí mặc định cho Deluxe/Suite; hạng khác có thể cấp theo yêu cầu.',
  },
  {
    code: 'AMEN_BODY_LOTION',
    name: 'Sữa dưỡng thể mini',
    unit: 'chai',
    category: 'AMENITY',
    materialType: 'CONSUMABLE',
    initialQuantity: 120,
    unitPrice: '7000',
    minStock: 20,
    description: 'Bố trí mặc định cho Deluxe/Suite; điều chỉnh theo chính sách khách sạn.',
  },
  {
    code: 'AMEN_SHAVING_KIT',
    name: 'Bộ dao cạo râu',
    unit: 'bộ',
    category: 'AMENITY',
    materialType: 'CONSUMABLE',
    initialQuantity: 60,
    unitPrice: '6000',
    minStock: 10,
    description: 'Cấp khi khách yêu cầu; không mặc định xuất trong mọi lượt dọn.',
  },
  {
    code: 'AMEN_SEWING_KIT',
    name: 'Bộ kim chỉ cá nhân',
    unit: 'bộ',
    category: 'AMENITY',
    materialType: 'CONSUMABLE',
    initialQuantity: 40,
    unitPrice: '3000',
    minStock: 10,
    description: 'Cấp khi khách yêu cầu; không mặc định xuất trong mọi lượt dọn.',
  },
  {
    code: 'HK_TOILET_PAPER',
    name: 'Giấy vệ sinh',
    unit: 'cuộn',
    category: 'AMENITY',
    materialType: 'CONSUMABLE',
    initialQuantity: 240,
    unitPrice: '4500',
    minStock: 30,
    description: 'Mức chuẩn bị 2 cuộn/phòng; giữ cuộn còn dùng được và ghi số cuộn thực bổ sung.',
  },
  {
    code: 'HK_TISSUE',
    name: 'Khăn giấy hộp',
    unit: 'hộp',
    category: 'AMENITY',
    materialType: 'CONSUMABLE',
    initialQuantity: 120,
    unitPrice: '10000',
    minStock: 20,
    description: 'Mức chuẩn bị 1 hộp/phòng; chỉ xuất khi cần thay hoặc bổ sung.',
  },
  {
    code: 'HK_TRASH_BAG',
    name: 'Túi rác buồng phòng',
    unit: 'túi',
    category: 'CLEANING',
    materialType: 'CONSUMABLE',
    initialQuantity: 600,
    unitPrice: '700',
    minStock: 60,
    description: 'Gợi ý 2 túi/phòng, Suite 3; điều chỉnh theo số thùng thực tế.',
  },
  {
    code: 'HK_LAUNDRY_BAG',
    name: 'Túi đựng đồ giặt cho khách',
    unit: 'túi',
    category: 'AMENITY',
    materialType: 'CONSUMABLE',
    initialQuantity: 120,
    unitPrice: '1200',
    minStock: 20,
    description: 'Mức chuẩn bị 1 túi/phòng; không phải túi thu gom đồ vải của bộ phận giặt.',
  },
  {
    code: 'HK_SANITARY_BAG',
    name: 'Túi vệ sinh cá nhân',
    unit: 'túi',
    category: 'AMENITY',
    materialType: 'CONSUMABLE',
    initialQuantity: 120,
    unitPrice: '800',
    minStock: 20,
    description: 'Mức chuẩn bị 1 túi/phòng; bổ sung khi thiếu.',
  },
  {
    code: 'HK_FLOOR_RTU',
    name: 'Dung dịch lau sàn sẵn dùng',
    unit: 'ml',
    category: 'CLEANING',
    materialType: 'CONSUMABLE',
    initialQuantity: 20000,
    unitPrice: '45',
    minStock: 3000,
    description:
      'Sản phẩm sẵn dùng, ghi lượng thực lấy theo ml; lượng gợi ý là dự trù xuất kho, không phải hướng dẫn pha hóa chất.',
  },
  {
    code: 'HK_BATH_RTU',
    name: 'Dung dịch vệ sinh phòng tắm sẵn dùng',
    unit: 'ml',
    category: 'CLEANING',
    materialType: 'CONSUMABLE',
    initialQuantity: 20000,
    unitPrice: '55',
    minStock: 3000,
    description:
      'Dùng đúng bề mặt và nhãn sản phẩm; ghi lượng thực lấy theo ml, không tự pha hoặc trộn với sản phẩm khác.',
  },
  {
    code: 'HK_GLASS_RTU',
    name: 'Dung dịch lau kính sẵn dùng',
    unit: 'ml',
    category: 'CLEANING',
    materialType: 'CONSUMABLE',
    initialQuantity: 10000,
    unitPrice: '35',
    minStock: 1500,
    description: 'Sản phẩm sẵn dùng cho kính/gương phù hợp; ghi lượng thực lấy theo ml.',
  },
  {
    code: 'LINEN_FACE_TOWEL',
    name: 'Khăn mặt',
    unit: 'cái',
    category: 'LINEN',
    materialType: 'REUSABLE',
    initialQuantity: 60,
    unitPrice: '20000',
    minStock: 10,
    description:
      'Tham chiếu 1 chiếc/khách; thu hồi, thay và giặt theo quy trình đồ vải, không tiêu hao mỗi lượt dọn.',
  },
  {
    code: 'LINEN_HAND_TOWEL',
    name: 'Khăn lau tay',
    unit: 'cái',
    category: 'LINEN',
    materialType: 'REUSABLE',
    initialQuantity: 60,
    unitPrice: '25000',
    minStock: 10,
    description: 'Tham chiếu 1 chiếc/phòng tắm; tái sử dụng sau giặt.',
  },
  {
    code: 'LINEN_BATH_MAT',
    name: 'Thảm chân phòng tắm',
    unit: 'cái',
    category: 'LINEN',
    materialType: 'REUSABLE',
    initialQuantity: 40,
    unitPrice: '45000',
    minStock: 8,
    description: 'Tham chiếu 1 chiếc/phòng tắm; thay theo tình trạng và quy trình giặt.',
  },
  {
    code: 'LINEN_SHEET',
    name: 'Ga giường',
    unit: 'cái',
    category: 'LINEN',
    materialType: 'REUSABLE',
    initialQuantity: 30,
    unitPrice: '180000',
    minStock: 6,
    description: 'Bố trí theo số giường và kích thước thực tế; kiểm tra đúng cỡ khi cấp phát.',
  },
  {
    code: 'LINEN_DUVET_COVER',
    name: 'Vỏ chăn',
    unit: 'cái',
    category: 'LINEN',
    materialType: 'REUSABLE',
    initialQuantity: 30,
    unitPrice: '250000',
    minStock: 6,
    description:
      'Bố trí theo số chăn và kích thước thực tế; quản lý giặt, không trừ như vật tư dùng hết.',
  },
  {
    code: 'LINEN_PILLOW_CASE',
    name: 'Vỏ gối',
    unit: 'cái',
    category: 'LINEN',
    materialType: 'REUSABLE',
    initialQuantity: 60,
    unitPrice: '40000',
    minStock: 12,
    description: 'Bố trí theo số gối thực tế của giường; thay theo quy trình đồ vải.',
  },
  {
    code: 'LINEN_BATHROBE',
    name: 'Áo choàng tắm',
    unit: 'cái',
    category: 'LINEN',
    materialType: 'REUSABLE',
    initialQuantity: 12,
    unitPrice: '220000',
    minStock: 3,
    description:
      'Bố trí theo chính sách hạng phòng hoặc yêu cầu; chọn cỡ phù hợp, thu hồi và giặt.',
  },
  {
    code: 'HK_MICROFIBER',
    name: 'Khăn lau microfiber phân khu',
    unit: 'cái',
    category: 'EQUIPMENT',
    materialType: 'REUSABLE',
    initialQuantity: 24,
    unitPrice: '25000',
    minStock: 6,
    description:
      'Tách khăn cho phòng tắm, toilet và khu vực phòng khách; vệ sinh sau dùng, không dùng chéo khu vực.',
  },
  {
    code: 'HK_MOP',
    name: 'Cây lau sàn',
    unit: 'cái',
    category: 'EQUIPMENT',
    materialType: 'REUSABLE',
    initialQuantity: 4,
    unitPrice: '180000',
    minStock: 1,
    description:
      'Cấp cho nhân viên/xe đẩy, dùng lại qua nhiều phòng; chỉ xuất khi cấp mới hoặc thay hỏng.',
  },
  {
    code: 'HK_MOP_HEAD',
    name: 'Đầu lau sàn thay thế',
    unit: 'cái',
    category: 'EQUIPMENT',
    materialType: 'REUSABLE',
    initialQuantity: 8,
    unitPrice: '60000',
    minStock: 2,
    description: 'Thay đầu lau sạch theo khu vực và quy trình vệ sinh; tái sử dụng sau xử lý.',
  },
  {
    code: 'HK_TOILET_BRUSH',
    name: 'Bàn chải cọ toilet',
    unit: 'cái',
    category: 'EQUIPMENT',
    materialType: 'REUSABLE',
    initialQuantity: 4,
    unitPrice: '45000',
    minStock: 1,
    description: 'Dụng cụ riêng cho toilet; không dùng sang bề mặt khác.',
  },
  {
    code: 'HK_SPRAY_BOTTLE',
    name: 'Bình xịt có nhãn',
    unit: 'cái',
    category: 'EQUIPMENT',
    materialType: 'REUSABLE',
    initialQuantity: 12,
    unitPrice: '30000',
    minStock: 3,
    description:
      'Mỗi loại sản phẩm dùng bình có nhãn riêng, ghi đúng thông tin theo nhãn và quy trình khách sạn.',
  },
  {
    code: 'HK_REUSABLE_GLOVES',
    name: 'Găng tay vệ sinh tái sử dụng',
    unit: 'đôi',
    category: 'EQUIPMENT',
    materialType: 'REUSABLE',
    initialQuantity: 8,
    unitPrice: '40000',
    minStock: 2,
    description: 'Chọn loại bảo hộ phù hợp nhãn sản phẩm; vệ sinh và thay khi hỏng.',
  },
  {
    code: 'HK_TROLLEY',
    name: 'Xe đẩy buồng phòng',
    unit: 'cái',
    category: 'EQUIPMENT',
    materialType: 'REUSABLE',
    initialQuantity: 2,
    unitPrice: '2200000',
    minStock: 1,
    description: 'Dụng cụ dùng chung của bộ phận; tách đồ sạch/bẩn và sản phẩm vệ sinh.',
  },
  {
    code: 'HK_VACUUM',
    name: 'Máy hút bụi buồng phòng',
    unit: 'cái',
    category: 'EQUIPMENT',
    materialType: 'REUSABLE',
    initialQuantity: 2,
    unitPrice: '1800000',
    minStock: 1,
    description: 'Dùng chung theo ca; kiểm tra và vệ sinh bộ lọc theo hướng dẫn thiết bị.',
  },
];

interface Material {
  id: bigint | string;
  code: string;
  name: string;
  unit: string;
  isActive: boolean;
  materialType: string;
}

// Shared by fresh seed and the additive local-data backfill. Never guess the
// volume of an existing bottle or change the meaning of historical stock units.
export function defaultCleaningMaterials(
  roomType: { code: string; maxAdults: number },
  items: Material[],
) {
  const result: { itemId: string; quantity: string; usageBasis: 'PER_GUEST' | 'PER_ROOM' }[] = [];
  const premium = ['DELUXE', 'SUITE'].includes(roomType.code);
  const candidates: { code: string; quantity: string; usageBasis: 'PER_GUEST' | 'PER_ROOM' }[] = [
    ...[
      'ITEM_2',
      'ITEM_3',
      'AMEN_TOOTHPASTE',
      'AMEN_BODY_WASH',
      'AMEN_SHOWER_CAP',
      'AMEN_COMB',
      'AMEN_SLIPPERS',
      ...(premium ? ['AMEN_CONDITIONER', 'AMEN_BODY_LOTION'] : []),
    ].map((code) => ({ code, quantity: '1.00', usageBasis: 'PER_GUEST' as const })),
    ...['AMEN_HAND_SOAP', 'AMEN_VANITY_KIT', 'HK_TISSUE', 'HK_LAUNDRY_BAG', 'HK_SANITARY_BAG'].map(
      (code) => ({ code, quantity: '1.00', usageBasis: 'PER_ROOM' as const }),
    ),
    { code: 'HK_TOILET_PAPER', quantity: '2.00', usageBasis: 'PER_ROOM' },
    {
      code: 'HK_TRASH_BAG',
      quantity: roomType.code === 'SUITE' ? '3.00' : '2.00',
      usageBasis: 'PER_ROOM',
    },
    {
      code: 'HK_FLOOR_RTU',
      quantity:
        roomType.code === 'SUITE' ? '100.00' : roomType.code === 'DELUXE' ? '75.00' : '50.00',
      usageBasis: 'PER_ROOM',
    },
    {
      code: 'HK_BATH_RTU',
      quantity:
        roomType.code === 'SUITE' ? '80.00' : roomType.code === 'DELUXE' ? '60.00' : '40.00',
      usageBasis: 'PER_ROOM',
    },
    {
      code: 'HK_GLASS_RTU',
      quantity:
        roomType.code === 'SUITE' ? '40.00' : roomType.code === 'DELUXE' ? '30.00' : '20.00',
      usageBasis: 'PER_ROOM',
    },
  ];
  // Fresh legacy fixtures still have ITEM_4 measured in ml; prefer the explicit
  // ready-to-use SKU when it exists, and never prescribe a bottle conversion.
  if (!items.some((item) => item.code === 'HK_FLOOR_RTU'))
    candidates.push({
      code: 'ITEM_4',
      quantity: roomType.code === 'SUITE' ? '100.00' : '50.00',
      usageBasis: 'PER_ROOM',
    });
  for (const candidate of candidates) {
    const { code, quantity, usageBasis } = candidate;
    const definition = [...localMaterialDefaults, ...housekeepingCatalog].find(
      (item) => item.code === code,
    )!;
    const item = items.find(
      (item) =>
        item.code === code &&
        item.name === definition.name &&
        item.isActive &&
        item.materialType === 'CONSUMABLE',
    );
    if (!item) continue;
    if ('unit' in definition && item.unit !== definition.unit) continue;
    if (
      ['ITEM_4', 'HK_FLOOR_RTU', 'HK_BATH_RTU', 'HK_GLASS_RTU'].includes(code) &&
      item.unit.toLowerCase() !== 'ml'
    )
      continue;
    if (code === 'ITEM_2' && !['cái', 'chai'].includes(item.unit)) continue;
    if (code === 'ITEM_3' && item.unit !== 'cái') continue;
    result.push({ itemId: String(item.id), quantity, usageBasis });
  }
  return result;
}
