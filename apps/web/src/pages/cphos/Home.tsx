import { AuditOutlined, EditOutlined, ExperimentOutlined } from '@ant-design/icons';
import { Card, Col, Row, Typography } from 'antd';
import type { ReactNode } from 'react';

interface Feature {
  icon: ReactNode;
  title: string;
  desc: string;
}

const FEATURES: Feature[] = [
  { icon: <AuditOutlined />, title: '仲裁任务', desc: '处理双阅分差超阈值的仲裁任务（第 9/10 题实验题）' },
  { icon: <EditOutlined />, title: '内部阅卷', desc: 'CPHOS 成员不参与普通分配，承担内部题目阅卷' },
  { icon: <ExperimentOutlined />, title: '命题/组织', desc: '组织相关功能（规划中）' },
];

/** CPHOS 成员工作台首页占位：统一图标+标题+描述的等高卡片 */
export function CphosHome() {
  return (
    <div>
      <Typography.Paragraph type="secondary" style={{ marginBottom: 24 }}>
        仲裁与内部阅卷功能将在考试域里程碑（M2）上线。
      </Typography.Paragraph>
      <Row gutter={[16, 16]}>
        {FEATURES.map((f) => (
          <Col key={f.title} xs={24} sm={12} lg={8}>
            <Card size="small" style={{ height: '100%' }}>
              <div style={{ display: 'flex', gap: 12 }}>
                <span style={{ color: '#8250df', fontSize: 20, marginTop: 1, flexShrink: 0 }}>
                  {f.icon}
                </span>
                <div style={{ minWidth: 0 }}>
                  <Typography.Text strong style={{ fontSize: 15 }}>
                    {f.title}
                  </Typography.Text>
                  <Typography.Paragraph type="secondary" style={{ marginTop: 4, marginBottom: 0 }}>
                    {f.desc}
                  </Typography.Paragraph>
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
}
