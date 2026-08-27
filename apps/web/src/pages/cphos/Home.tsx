import { Card, Col, Row, Typography } from 'antd';

const FEATURES = [
  { title: '仲裁任务', desc: '处理双阅分差超阈值的仲裁任务（第 9/10 题实验题）' },
  { title: '内部阅卷', desc: 'CPHOS 成员不参与普通分配，承担内部题目阅卷' },
  { title: '命题/组织', desc: '组织相关功能（规划中）' },
];

/** CPHOS 成员工作台首页占位 */
export function CphosHome() {
  return (
    <div>
      <Typography.Title level={4}>CPHO-S 工作台</Typography.Title>
      <Typography.Paragraph type="secondary">
        仲裁与内部阅卷功能将在考试域里程碑（M2）上线。
      </Typography.Paragraph>
      <Row gutter={[16, 16]}>
        {FEATURES.map((f) => (
          <Col key={f.title} xs={24} sm={12} lg={8}>
            <Card title={f.title} size="small">
              {f.desc}
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
}
