import { ROLE_CODES, type RoleCode } from '../../src/shared/types/roles.js';
import type { LocalHotelConfig } from './catalog.js';

const roleNames: Record<RoleCode, string> = {
  ADMIN: 'admin',
  MANAGER: 'quanly',
  RECEPTIONIST: 'letan',
  HOUSEKEEPING: 'buongphong',
  ACCOUNTANT: 'ketoan',
  TECHNICIAN: 'kythuat',
};
const extraRoles: RoleCode[] = [
  'RECEPTIONIST',
  'HOUSEKEEPING',
  'HOUSEKEEPING',
  'MANAGER',
  'ACCOUNTANT',
  'TECHNICIAN',
];
const rosters = {
  LOTUS_HCM: {
    primary: [
      'Nguyễn Minh An',
      'Trần Ngọc Linh',
      'Lê Hoàng Nam',
      'Phạm Thanh Hà',
      'Võ Gia Huy',
      'Đỗ Quốc Bảo',
    ],
    additional: [
      'Bùi Quỳnh Anh',
      'Hoàng Thảo Vy',
      'Ngô Ngọc Ánh',
      'Dương Tuấn Kiệt',
      'Phan Khánh Chi',
      'Huỳnh Đức Long',
    ],
    departed: 'Đinh Hữu Phúc',
    newHire: 'Mai Hải Yến',
  },
  OCEAN_DN: {
    primary: [
      'Nguyễn Hải Đăng',
      'Trần Bảo Ngọc',
      'Lê Minh Khoa',
      'Võ Thu Hương',
      'Phạm Ngọc Trâm',
      'Đặng Quốc Hưng',
    ],
    additional: ['Nguyễn Thùy Dung', 'Trần Thanh Tâm', 'Lê Hoài An', 'Huỳnh Anh Tuấn'],
    departed: 'Đỗ Thành Đạt',
    newHire: 'Bùi Phương Anh',
  },
  PINE_DL: {
    primary: [
      'Vũ Minh Khánh',
      'Nguyễn Hoàng Phúc',
      'Trần Thảo Nhi',
      'Lê Ngọc Mai',
      'Phạm Quỳnh Như',
      'Đỗ Tuấn Anh',
    ],
    additional: ['Võ Gia Bảo', 'Hoàng Tú Uyên'],
    departed: 'Trần Minh Quân',
    newHire: 'Nguyễn Thanh Vân',
  },
} as const;

export interface LocalStaffProfile {
  fullName: string;
  username: string;
  email: string;
  role: RoleCode;
  primary: boolean;
  isActive: boolean;
  mustChangePassword: boolean;
}

export function localStaff(config: LocalHotelConfig): LocalStaffProfile[] {
  const roster = rosters[config.code];
  const person = (
    fullName: string,
    role: RoleCode,
    primary = false,
    isActive = true,
    mustChangePassword = false,
  ): LocalStaffProfile => {
    const shortName = fullName
      .trim()
      .split(/\s+/u)
      .slice(-2)
      .join('')
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .replace(/[đĐ]/gu, 'd')
      .toLowerCase();
    const username = `${config.accountPrefix}_${roleNames[role]}_${shortName}`;
    return {
      fullName,
      username,
      email: `${username}@example.test`,
      role,
      primary,
      isActive,
      mustChangePassword,
    };
  };
  return [
    ...ROLE_CODES.map((role, index) => person(roster.primary[index]!, role, true)),
    ...roster.additional.map((fullName, index) => person(fullName, extraRoles[index]!)),
    person(roster.departed, 'RECEPTIONIST', false, false, true),
    person(roster.newHire, 'RECEPTIONIST', false, true, true),
  ];
}
