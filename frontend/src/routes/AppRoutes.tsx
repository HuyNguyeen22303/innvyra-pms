import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from '../layouts/MainLayout.tsx';
import { ProtectedRoute } from '../components/ProtectedRoute.tsx';
import { LoginPage } from '../pages/auth/LoginPage.tsx';
import { DashboardPage } from '../pages/dashboard/DashboardPage.tsx';
import { RoomsPage } from '../pages/rooms/RoomsPage.tsx';
import { RoomTypesPage } from '../pages/room-types/RoomTypesPage.tsx';
import { GuestsPage } from '../pages/guests/GuestsPage.tsx';
import { ForbiddenPage } from '../pages/common/ForbiddenPage.tsx';

import { NotFoundPage } from '../pages/common/NotFoundPage.tsx';
import { PhasePlaceholderPage } from '../pages/common/PhasePlaceholderPage.tsx';

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Public Route */}
      <Route path="/login" element={<LoginPage />} />

      {/* Protected Routes wrapped in MainLayout */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />

        {/* Calendar */}
        <Route
          path="calendar"
          element={
            <PhasePlaceholderPage
              title="Lịch phòng & Timeline trạng thái"
              phase="Phase 7: feature/fe-dashboard-and-mock"
              description="Bảng ma trận trực quan trạng thái từng phòng theo ngày."
            />
          }
        />

        {/* Reservations */}
        <Route
          path="reservations"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'MANAGER', 'RECEPTIONIST']}>
              <PhasePlaceholderPage
                title="Quản lý Đặt phòng & Tra cứu tồn phòng"
                phase="Phase 5: feature/fe-reservations"
                description="Tạo đơn, tra cứu phòng trống theo khoảng ngày, hủy đặt phòng."
              />
            </ProtectedRoute>
          }
        />

        {/* Stays & Check-in */}
        <Route
          path="stays"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'MANAGER', 'RECEPTIONIST']}>
              <PhasePlaceholderPage
                title="Quản lý Lưu trú & Check-in / Check-out"
                phase="Phase 6: feature/fe-stays"
                description="Gán phòng READY, check-in khách lưu trú, check-out và đổi phòng."
              />
            </ProtectedRoute>
          }
        />

        {/* Guests */}
        <Route
          path="guests"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'MANAGER', 'RECEPTIONIST', 'ACCOUNTANT']}>
              <GuestsPage />
            </ProtectedRoute>
          }
        />


        {/* Rooms */}
        <Route path="rooms" element={<RoomsPage />} />

        {/* Room Types */}
        <Route path="room-types" element={<RoomTypesPage />} />

        {/* Housekeeping */}
        <Route
          path="housekeeping"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'MANAGER', 'HOUSEKEEPING']}>
              <PhasePlaceholderPage
                title="Quản lý Buồng phòng (Housekeeping)"
                phase="Phase 7: feature/fe-dashboard-and-mock"
                description="Nhiệm vụ dọn dẹp DIRTY -> CLEANING -> INSPECTION -> READY."
              />
            </ProtectedRoute>
          }
        />

        {/* Maintenance */}
        <Route
          path="maintenance"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'MANAGER', 'TECHNICIAN']}>
              <PhasePlaceholderPage
                title="Bảo trì & Khóa phòng kỹ thuật"
                phase="Phase 7: feature/fe-dashboard-and-mock"
                description="Khóa phòng hỏng, xử lý sự cố thiết bị phòng khách sạn."
              />
            </ProtectedRoute>
          }
        />

        {/* Folios */}
        <Route
          path="folios"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'MANAGER', 'ACCOUNTANT']}>
              <PhasePlaceholderPage
                title="Sổ công nợ Folio & Thu/Hoàn tiền"
                phase="Phase 7: feature/fe-dashboard-and-mock"
                description="Tổng hợp tiền phòng, phí dịch vụ, cọc và quyết toán hoá đơn."
              />
            </ProtectedRoute>
          }
        />

        {/* Reports */}
        <Route
          path="reports"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'MANAGER', 'ACCOUNTANT']}>
              <PhasePlaceholderPage
                title="Báo cáo Hoạt động kinh doanh"
                phase="Phase 7: feature/fe-dashboard-and-mock"
                description="Thống kê doanh thu, công suất phòng, phòng-đêm bán được."
              />
            </ProtectedRoute>
          }
        />

        {/* 403 Forbidden */}
        <Route path="403" element={<ForbiddenPage />} />

        {/* 404 Catch All inside layout */}
        <Route path="*" element={<NotFoundPage />} />
      </Route>

      {/* 404 Outside */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
};
