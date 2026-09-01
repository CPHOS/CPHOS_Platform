import { AuditOutlined, FileExcelOutlined, TeamOutlined, TrophyOutlined } from '@ant-design/icons';
import { Card, Col, Row, Typography } from 'antd';
import type { ReactNode } from 'react';

interface Feature {
  icon: ReactNode;
  title: string;
  desc: string;
}

const FEATURES: Feature[] = [
  { icon: <AuditOutlined />, title: '用户审核', desc: '审核注册用户资料；认领为可选兼容能力，不依赖历史数据' },
  { icon: <TeamOutlined />, title: '成员与团队', desc: '角色 / 槽位 / 个人限额；团队共享上传限额与成员管理' },
  { icon: <FileExcelOutlined />, title: '字典维护', desc: '赛区 / 学校 / 年级 / 奖项 / 题号，管理员独立维护' },
  { icon: <TrophyOutlined />, title: '考试与阅卷', desc: '批次配置、分配、仲裁、成绩与排名（M2 下一步）' },
];

/** 管理后台首页占位：统一图标+标题+描述的等高卡片 */
export function AdminHome() {
  return (
    <div>
      <Typography.Paragraph type="secondary" style={{ marginBottom: 24 }}>
        审核工作台、成员团队、字典与审计能力已开放；考试与阅卷将在 M2 上线。
      </Typography.Paragraph>
      <Row gutter={[16, 16]}>
        {FEATURES.map((f) => (
          <Col key={f.title} xs={24} sm={12} lg={6}>
            <Card size="small" style={{ height: '100%' }}>
              <div style={{ display: 'flex', gap: 12 }}>
                <span style={{ color: '#cf222e', fontSize: 20, marginTop: 1, flexShrink: 0 }}>
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
