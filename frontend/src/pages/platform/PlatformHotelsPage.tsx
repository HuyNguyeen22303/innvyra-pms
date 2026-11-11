import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Alert, Button, Card, Input, Select, Space, Table, Tag } from "antd";
import { Link } from "react-router-dom";
import { hotelsApi } from "../../api/hotels.api.ts";
import type { HotelRecord } from "../../types/hotel.types.ts";
import { hotelError } from "../../utils/hotelErrors.ts";
import { usePlatformAuthStore } from "../../store/platformAuthStore.ts";

export function PlatformHotelsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>();
  const userId = usePlatformAuthStore((state) => state.user?.id);
  const [revision, setRevision] = useState(0);
  const query = useQuery({
    queryKey: ["platform-hotels", userId, page, search, status, revision],
    queryFn: ({ signal }) =>
      hotelsApi.list(
        {
          page,
          limit: 20,
          ...(search ? { search } : {}),
          ...(status ? { status } : {}),
        },
        signal,
      ),
  });
  return (
    <div className="platform-page">
      <div className="platform-page-heading">
        <div className="platform-eyebrow">KHÁCH SẠN</div>
        <h1>Khách sạn sử dụng Innvyra</h1>
        <p className="platform-muted">
          Tiếp nhận khách sạn và quản lý tài khoản quản trị.
        </p>
      </div>
      <Card>
        <Space wrap style={{ marginBottom: 20 }}>
          <Input.Search
            placeholder="Tìm mã, tên hoặc email liên hệ"
            aria-label="Tìm khách sạn"
            allowClear
            onSearch={(value) => {
              setPage(1);
              setSearch(value.trim());
            }}
            style={{ width: 290, maxWidth: "100%" }}
          />
          <Select
            placeholder="Trạng thái"
            aria-label="Trạng thái khách sạn"
            allowClear
            style={{ width: 170 }}
            options={[
              { value: "ACTIVE", label: "Hoạt động" },
              { value: "SUSPENDED", label: "Tạm ngừng" },
            ]}
            onChange={(value) => {
              setPage(1);
              setStatus(value);
            }}
          />
          <Button onClick={() => setRevision((value) => value + 1)}>
            Tải lại
          </Button>
          <Link to="/platform/hotels/new">
            <Button type="primary">Thêm khách sạn</Button>
          </Link>
        </Space>
        {query.error && (
          <Alert
            type="error"
            title={hotelError(query.error)}
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}
        <Table<HotelRecord>
          rowKey="id"
          loading={query.isFetching}
          dataSource={query.data?.items ?? []}
          scroll={{ x: 700 }}
          pagination={{
            current: page,
            pageSize: 20,
            total: query.data?.pagination.total ?? 0,
            showSizeChanger: false,
            onChange: setPage,
          }}
          columns={[
            {
              title: "Mã",
              dataIndex: "code",
              render: (value: string, hotel) => (
                <Link to={`/platform/hotels/${hotel.id}`}>{value}</Link>
              ),
            },
            { title: "Khách sạn", dataIndex: "name" },
            {
              title: "Liên hệ",
              dataIndex: "contactEmail",
              render: (value: string | null) => value || "—",
            },
            { title: "Múi giờ", dataIndex: "timezone" },
            {
              title: "Trạng thái",
              dataIndex: "status",
              render: (value: string) => (
                <Tag color={value === "ACTIVE" ? "green" : "orange"}>
                  {value === "ACTIVE" ? "Hoạt động" : "Tạm ngừng"}
                </Tag>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
