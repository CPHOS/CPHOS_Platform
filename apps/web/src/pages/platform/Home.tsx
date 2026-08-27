import { Card, Col, Row, Typography } from 'antd';
import { useAuthStore } from '../../stores/auth';
import { ROLE_LABELS } from '@cphos/shared';

const FEATURES = [
  { title: '学生管理', desc: '创建与管理名下学生（毕业年份、学校、奖项）' },
  { title: '报名与上传', desc: '选择考试批次，上传学生答题卡（逐题图片）' },
  { title: '阅卷任务', desc: '按默认批阅槽位领取任务，双阅打分' },
  { title: '成绩与排名', desc: '查看学生成绩与分段排名' },
];

/** 平台用户（教练/个人参赛者）首页占位 */
export function PlatformHome() {
  const user = useAuthStore((s) => s.user);
  return (
    <div>
      <Typography.Title level={4}>
        欢迎，{user?.profile?.realName ?? user?.email}
        {user?.profile ? `（${ROLE_LABELS[user.profile.role]}）` : ''}
      </Typography.Title>
      <Typography.Paragraph type="secondary">
        以下功能将按里程碑逐步开放，当前为平台骨架（功能块 1：认证）。
      </Typography.Paragraph>
      <Row gutter={[16, 16]}>
        {FEATURES.map((f) => (
          <Col key={f.title} xs={24} sm={12} lg={6}>
            <Card title={f.title} size="small">
              {f.desc}
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
}
