import React, { lazy, Suspense, useEffect } from 'react';
import { Button, Result, Spin } from 'antd';
import { HotelSessionBoundary } from '../components/HotelSessionBoundary.tsx';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { MainLayout } from '../layouts/MainLayout.tsx';
import { ProtectedRoute } from '../components/ProtectedRoute.tsx';
import { LoginPage } from '../pages/auth/LoginPage.tsx';
import { ForbiddenPage } from '../pages/common/ForbiddenPage.tsx';
import { NotFoundPage } from '../pages/common/NotFoundPage.tsx';
import { useAuthStore } from '../store/authStore.ts';
import { HotelPasswordChangePage } from '../pages/auth/HotelPasswordChangePage.tsx';
import { isSubscriptionPath } from '../auth/hotelWorkspaceAccess.ts';

const PlatformRoutes = lazy(() => import('./PlatformRoutes.tsx'));
const HotelSubscriptionPage = lazy(() => import('../pages/hotel/HotelSubscriptionPage.tsx').then((module) => ({ default: module.HotelSubscriptionPage })));
const DashboardPage = lazy(() => import('../pages/dashboard/DashboardPage.tsx').then((module) => ({ default: module.DashboardPage })));
const RoomsPage = lazy(() => import('../pages/rooms/RoomsPage.tsx').then((module) => ({ default: module.RoomsPage })));
const RoomTypesPage = lazy(() => import('../pages/room-types/RoomTypesPage.tsx').then((module) => ({ default: module.RoomTypesPage })));
const GuestsPage = lazy(() => import('../pages/guests/GuestsPage.tsx').then((module) => ({ default: module.GuestsPage })));
const ReservationsPage = lazy(() => import('../pages/reservations/ReservationsPage.tsx').then((module) => ({ default: module.ReservationsPage })));
const StaysPage = lazy(() => import('../pages/stays/StaysPage.tsx').then((module) => ({ default: module.StaysPage })));
const HousekeepingPage = lazy(() => import('../pages/housekeeping/HousekeepingPage.tsx').then((module) => ({ default: module.HousekeepingPage })));
const MaintenancePage = lazy(() => import('../pages/maintenance/MaintenancePage.tsx').then((module) => ({ default: module.MaintenancePage })));
const BillingPage = lazy(() => import('../pages/billing/BillingPage.tsx').then((module) => ({ default: module.BillingPage })));
const ServicesPage = lazy(() => import('../pages/services/ServicesPage.tsx').then((module) => ({ default: module.ServicesPage })));
const EmployeesPage = lazy(() => import('../pages/employees/EmployeesPage.tsx').then((module) => ({ default: module.EmployeesPage })));
const RoomMatrixPage = lazy(() => import('../pages/calendar/RoomMatrixPage.tsx').then((module) => ({ default: module.RoomMatrixPage })));
const ReportsPage = lazy(() => import('../pages/reports/ReportsPage.tsx').then((module) => ({ default: module.ReportsPage })));
const InventoryPage = lazy(() => import('../pages/inventory/InventoryPage.tsx').then((module) => ({ default: module.InventoryPage })));
const HotelSettingsPage = lazy(() => import('../pages/hotel/HotelSettingsPage.tsx').then((module) => ({ default: module.HotelSettingsPage })));

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      <Route
        path="/platform/*"
        element={
          <Suspense
            fallback={
              <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
                <Spin description="Đang tải Innvyra..." />
              </div>
            }
          >
            <PlatformRoutes />
          </Suspense>
        }
      />
      <Route path="/*" element={<HotelRoutes />} />
    </Routes>
  );
};

const HotelRoutes: React.FC = () => {
  const location = useLocation();
  const { checkAuth, restoreError } = useAuthStore();
  useEffect(() => {
    if (window.location.pathname !== '/login') void checkAuth();
    else useAuthStore.setState({ isLoading: false, restoreError: null });
  }, [checkAuth]);
  if (restoreError) return <Result status="warning" title="Chưa thể khôi phục phiên khách sạn" subTitle={restoreError} extra={<Button type="primary" onClick={() => void checkAuth()}>Thử lại</Button>} />;
  return (
    <HotelSessionBoundary>
    <Routes>
      {/* Public Route */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/change-password" element={<HotelPasswordChangePage />} />

      {/* Protected Routes wrapped in MainLayout */}
      <Route
        path="/"
        element={
          <ProtectedRoute allowSuspended={isSubscriptionPath(location.pathname)}>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="subscription" element={<HotelSubscriptionPage />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="hotel" element={<ProtectedRoute allowedRoles={['ADMIN']}><HotelSettingsPage /></ProtectedRoute>} />

        {/* Calendar / Room Matrix */}
        <Route path="calendar" element={<RoomMatrixPage />} />

        {/* Reservations */}
        <Route
          path="reservations"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'MANAGER', 'RECEPTIONIST', 'ACCOUNTANT']}>
              <ReservationsPage />
            </ProtectedRoute>
          }
        />

        {/* Stays & Check-in */}
        <Route
          path="stays"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'MANAGER', 'RECEPTIONIST', 'ACCOUNTANT']}>
              <StaysPage />
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
            <ProtectedRoute allowedRoles={['ADMIN', 'MANAGER', 'RECEPTIONIST', 'HOUSEKEEPING']}>
              <HousekeepingPage />
            </ProtectedRoute>
          }
        />

        {/* Maintenance */}
        <Route
          path="maintenance"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'MANAGER', 'RECEPTIONIST', 'HOUSEKEEPING', 'TECHNICIAN']}>
              <MaintenancePage />
            </ProtectedRoute>
          }
        />

        {/* Services */}
        <Route
          path="services"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'MANAGER', 'RECEPTIONIST', 'ACCOUNTANT']}>
              <ServicesPage />
            </ProtectedRoute>
          }
        />

        {/* Inventory & Supplies */}
        <Route
          path="inventory"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'MANAGER', 'ACCOUNTANT', 'HOUSEKEEPING', 'TECHNICIAN']}>
              <InventoryPage />
            </ProtectedRoute>
          }
        />

        {/* Folios */}
        <Route
          path="folios"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'MANAGER', 'RECEPTIONIST', 'ACCOUNTANT']}>
              <BillingPage />
            </ProtectedRoute>
          }
        />

        {/* Employees */}
        <Route
          path="employees"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'MANAGER']}>
              <EmployeesPage />
            </ProtectedRoute>
          }
        />

        {/* Reports & Analytics */}
        <Route
          path="reports"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'MANAGER', 'RECEPTIONIST', 'ACCOUNTANT', 'HOUSEKEEPING', 'TECHNICIAN']}>
              <ReportsPage />
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
    </HotelSessionBoundary>
  );
};
