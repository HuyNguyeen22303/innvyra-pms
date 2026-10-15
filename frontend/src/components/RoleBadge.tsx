import React from 'react';
import { Tag } from 'antd';
import type { Role } from '../types/auth.types.ts';

const roleMeta: Record<Role, { label: string; color: string }> = {
  ADMIN: { label: 'Quản trị viên', color: 'magenta' },
  MANAGER: { label: 'Quản lý KS', color: 'blue' },
  RECEPTIONIST: { label: 'Lễ tân', color: 'cyan' },
  ACCOUNTANT: { label: 'Kế toán', color: 'gold' },
  HOUSEKEEPING: { label: 'Buồng phòng', color: 'green' },
  TECHNICIAN: { label: 'Kỹ thuật', color: 'purple' },
};

interface RoleBadgeProps {
  role?: Role;
}

export const RoleBadge: React.FC<RoleBadgeProps> = ({ role }) => {
  if (!role) return null;
  const meta = roleMeta[role] || { label: role, color: 'default' };
  return <Tag color={meta.color}>{meta.label}</Tag>;
};
