import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from '../layouts/MainLayout.tsx';
import { ProtectedRoute } from '../components/ProtectedRoute.tsx';
import { LoginPage } from '../pages/auth/LoginPage.tsx';
import { DashboardPage } from '../pages/dashboard/DashboardPage.tsx';
import { RoomsPage } from '../pages/rooms/RoomsPage.tsx';
import { RoomTypesPage } from '../pages/room-types/RoomTypesPage.tsx';
import { GuestsPage } from '../pages/guests/GuestsPage.tsx';
import { ReservationsPage } from '../pages/reservations/ReservationsPage.tsx';
import { StaysPage } from '../pages/stays/StaysPage.tsx';
import { HousekeepingPage } from '../pages/housekeeping/HousekeepingPage.tsx';
import { MaintenancePage } from '../pages/maintenance/MaintenancePage.tsx';
import { BillingPage } from '../pages/billing/BillingPage.tsx';
import { ServicesPage } from '../pages/services/ServicesPage.tsx';
import { EmployeesPage } from '../pages/employees/EmployeesPage.tsx';
import { RoomMatrixPage } from '../pages/calendar/RoomMatrixPage.tsx';
import { ReportsPage } from '../pages/reports/ReportsPage.tsx';
import { InventoryPage } from '../pages/inventory/InventoryPage.tsx';
import { ForbiddenPage } from '../pages/common/ForbiddenPage.tsx';
import { NotFoundPage } from '../pages/common/NotFoundPage.tsx';

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
  );
};
