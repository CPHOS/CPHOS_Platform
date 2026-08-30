import { AppstoreOutlined, FileExcelOutlined, TeamOutlined, TrophyOutlined } from '@ant-design/icons';
import { Card, Col, Result, Row, Typography } from 'antd';
import type { ReactNode } from 'react';
import { useAuthStore } from '../../stores/auth';
import { ROLE_LABELS } from '@cphos/shared';
import { ApplyStatus } from './ApplyStatus';

interface Feature {
  icon: ReactNode;
  title: string;
  desc: string;
}

const FEATURES: Feature[] = [
  { icon: <TeamOutlined />, title: '学生管理', desc: '创建与管理名下学生（毕业年份、学校、奖项）' },
  { icon: <FileExcelOutlined />, title: '报名与上传', desc: '选择考试批次，上传学生答题卡（逐题图片）' },
  { icon: <TrophyOutlined />, title: '阅卷任务', desc: '按默认批阅槽位领取任务，双阅打分' },
  { icon: <AppstoreOutlined />, title: '成绩与排名', desc: '查看学生成绩与分段排名' },
];

/** 平台用户（教练/个人参赛者）工作台；待审核用户在此展示审核状态面板 */
export function PlatformHome() {
  const user = useAuthStore((s) => s.user);

  if (user?.status === 'DISABLED') {
    return <Result status="error" title="账号已禁用" subTitle="如有疑问请联系管理员。" />;
  }

  if (user?.status === 'PENDING') {
    return <ApplyStatus />;
  }

  return (
    <div>
      <Typography.Title level={4}>
        欢迎，{user?.profile?.realName ?? user?.email}
        {user?.profile ? `（${ROLE_LABELS[user.profile.role]}）` : ''}
      </Typography.Title>
      <Typography.Paragraph type="secondary">
        以下功能将按里程碑逐步开放。
      </Typography.Paragraph>
      <Row gutter={[16, 16]}>
        {FEATURES.map((f) => (
          <Col key={f.title} xs={24} sm={12} lg={6}>
            <Card size="small" style={{ height: '100%' }}>
              <div style={{ display: 'flex', gap: 12 }}>
                <span style={{ color: '#0969da', fontSize: 20, marginTop: 1, flexShrink: 0 }}>
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
