import { Card, Col, Row, Typography } from 'antd';

const FEATURES = [
  { title: '用户审核', desc: '审核注册用户提交的资料；老用户认领匹配旧账号' },
  { title: '教练与仲裁管理', desc: '角色调整、默认批阅槽位、上传限额（含切换前置检查）' },
  { title: '字典维护', desc: '赛区 / 学校 / 年级 / 奖项 / 题号字典（旧库种子导入）' },
  { title: '考试与阅卷管理', desc: '批次配置、分配、仲裁、成绩与排名（M2）' },
];

/** 管理后台首页占位 */
export function AdminHome() {
  return (
    <div>
      <Typography.Title level={4}>管理后台</Typography.Title>
      <Typography.Paragraph type="secondary">
        审核工作台为下一功能块（块 2：审核与认领），其余随里程碑开放。
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
