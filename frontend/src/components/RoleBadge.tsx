import React from 'react';
import { Tag } from 'antd';
import type { Role } from '../types/auth.types.ts';

const roleMeta: Record<
  Role,
  { label: string; bg: string; color: string; border: string }
> = {
  ADMIN: { label: 'Quản trị viên', bg: '#fdf2f8', color: '#9d174d', border: '#fbcfe8' },
  MANAGER: { label: 'Quản lý KS', bg: '#f0fdf4', color: '#166534', border: '#bbf7d0' },
  RECEPTIONIST: { label: 'Lễ tân', bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
  ACCOUNTANT: { label: 'Kế toán', bg: '#fffbeb', color: '#b45309', border: '#fde68a' },
  HOUSEKEEPING: { label: 'Buồng phòng', bg: '#ecfdf5', color: '#047857', border: '#a7f3d0' },
  TECHNICIAN: { label: 'Kỹ thuật', bg: '#faf5ff', color: '#6b21a8', border: '#e9d5ff' },
};

interface RoleBadgeProps {
  role?: Role;
}

export const RoleBadge: React.FC<RoleBadgeProps> = ({ role }) => {
  if (!role) return null;
  const meta = roleMeta[role] || {
    label: role,
    bg: '#f1f5f9',
    color: '#334155',
    border: '#cbd5e1',
  };

  return (
    <Tag
      className="pms-role-badge"
      style={{
        backgroundColor: meta.bg,
        color: meta.color,
        borderColor: meta.border,
        fontWeight: 600,
        fontSize: 12,
        padding: '2px 8px',
        borderRadius: 6,
      }}
    >
      {meta.label}
    </Tag>
  );
};
