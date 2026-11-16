import { Card, Col, Row, Statistic, Typography } from "antd";
import { formatVnd } from "../reports.utils.ts";
export function SupplyCashSummary({
  paid,
  net,
  label = "trong kỳ",
}: {
  paid?: string;
  net?: string;
  label?: string;
}) {
  return (
    <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
      <Col xs={24} sm={12}>
        <Card size="small" style={{ borderLeft: "4px solid #d97706" }}>
          <Statistic
            title={`Chi mua vật tư thuần ${label}`}
            value={paid == null ? "—" : formatVnd(paid)}
          />
          <Typography.Text type="secondary">
            Tiền đã trả nhà cung cấp, trừ khoản đã đảo.
          </Typography.Text>
        </Card>
      </Col>
      <Col xs={24} sm={12}>
        <Card size="small" style={{ borderLeft: "4px solid #1b4d3e" }}>
          <Statistic
            title={`Dòng tiền sau chi vật tư ${label}`}
            value={net == null ? "—" : formatVnd(net)}
          />
          <Typography.Text type="secondary">
            Thu khách sau hoàn trả, trừ chi mua vật tư. Chưa bao gồm các khoản
            chi vận hành khác.
          </Typography.Text>
        </Card>
      </Col>
    </Row>
  );
}
