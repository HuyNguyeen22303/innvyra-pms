import { useEffect } from "react";
import { Button, Result, Spin } from "antd";
import { Route, Routes } from "react-router-dom";
import { usePlatformAuthStore } from "../store/platformAuthStore.ts";
import { PlatformProtectedRoute } from "../components/PlatformProtectedRoute.tsx";
import { PlatformLayout } from "../layouts/PlatformLayout.tsx";
import { PlatformLoginPage } from "../pages/platform/PlatformLoginPage.tsx";
import { PlatformOverviewPage } from "../pages/platform/PlatformOverviewPage.tsx";
import { PlatformAccountPage } from "../pages/platform/PlatformAccountPage.tsx";
import "../pages/platform/platform.css";

export default function PlatformRoutes() {
  const { checkAuth, isLoading, restoreError } = usePlatformAuthStore();
  useEffect(() => {
    void checkAuth();
  }, [checkAuth]);
  if (isLoading)
    return (
      <div className="platform-loading">
        <Spin description="Đang kiểm tra phiên Innvyra..." />
      </div>
    );
  if (restoreError)
    return (
      <div className="platform-loading">
        <Result
          status="warning"
          title="Chưa thể kết nối Innvyra"
          subTitle={restoreError}
          extra={
            <Button type="primary" onClick={() => void checkAuth()}>
              Thử lại
            </Button>
          }
        />
      </div>
    );
  return (
    <Routes>
      <Route path="login" element={<PlatformLoginPage />} />
      <Route
        element={
          <PlatformProtectedRoute>
            <PlatformLayout />
          </PlatformProtectedRoute>
        }
      >
        <Route index element={<PlatformOverviewPage />} />
        <Route path="account" element={<PlatformAccountPage />} />
        <Route
          path="*"
          element={
            <Result
              status="404"
              title="Không tìm thấy trang"
              extra={<Button href="/platform">Về tổng quan</Button>}
            />
          }
        />
      </Route>
    </Routes>
  );
}
