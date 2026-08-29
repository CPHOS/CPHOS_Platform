import { ClockCircleOutlined } from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Card, Descriptions, Result, Spin, Typography } from 'antd';
import { useEffect, useState } from 'react';
import { auditApi } from '../../api/audit';
import { ApplyForm } from '../../components/ApplyForm';
import { useAuthStore } from '../../stores/auth';

/** 平台用户审核状态面板：提交资料 / 等待审核 / 补材料 / 重提，嵌入 /app 工作台展示 */
export function ApplyStatus() {
  const user = useAuthStore((s) => s.user);
  const loadMe = useAuthStore((s) => s.loadMe);
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const { data: app, isLoading } = useQuery({
    queryKey: ['audit', 'me'],
    queryFn: auditApi.getMine,
    retry: false,
    enabled: !!user && user.role === 'PLATFORM_USER',
  });

  const approved = app?.status === 'APPROVED';
  useEffect(() => {
    if (approved) void loadMe();
  }, [approved, loadMe]);

  if (isLoading) {
    return <Card loading style={{ maxWidth: 640, margin: '0 auto' }} />;
  }

  // 已通过但会话状态未刷新：刷新 /me，交由守卫进入正常工作台
  if (approved) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 48 }}>
        <Spin tip="审核已通过，正在进入平台…" />
      </div>
    );
  }

  const summary = app && (
    <Descriptions column={2} size="small" bordered style={{ maxWidth: 640, margin: '0 auto 16px' }}>
      <Descriptions.Item label="真实姓名">{app.realName}</Descriptions.Item>
      <Descriptions.Item label="学校">{app.schoolName ?? '-'}</Descriptions.Item>
      <Descriptions.Item label="原微信昵称">{app.wechatNickname ?? '-'}</Descriptions.Item>
      <Descriptions.Item label="联系方式">{app.contact ?? '-'}</Descriptions.Item>
    </Descriptions>
  );

  // 已提交，等待审核
  if (app?.status === 'PENDING' && !app.materialRequestedAt) {
    return (
      <div style={{ maxWidth: 720, margin: '0 auto', paddingTop: 24 }}>
        <Result
          icon={<ClockCircleOutlined style={{ color: '#1677ff' }} />}
          title="资料已提交，等待审核"
          subTitle="管理员审核通过后即可使用平台功能，请耐心等待。"
        />
        {summary}
      </div>
    );
  }

  // 管理员要求补材料
  if (app?.status === 'PENDING' && app.materialRequestedAt && !showForm) {
    return (
      <div style={{ maxWidth: 720, margin: '0 auto', paddingTop: 24 }}>
        <Result
          status="warning"
          title="管理员要求补充资料"
          subTitle="请按下方「管理员备注」补充资料后重新提交。"
          extra={
            <Button type="primary" onClick={() => setShowForm(true)}>
              补充资料并重新提交
            </Button>
          }
        />
        {app.reviewRemark && (
          <Alert
            type="warning"
            showIcon
            style={{ maxWidth: 640, margin: '0 auto 16px' }}
            message="管理员备注"
            description={<span style={{ whiteSpace: 'pre-line' }}>{app.reviewRemark}</span>}
          />
        )}
        {summary}
      </div>
    );
  }

  // 审核未通过
  if (app?.status === 'REJECTED' && !showForm) {
    return (
      <div style={{ maxWidth: 720, margin: '0 auto', paddingTop: 24 }}>
        <Result
          status="warning"
          title="审核未通过"
          subTitle="请按下方「管理员备注」修改资料后重新提交。"
          extra={
            <Button type="primary" onClick={() => setShowForm(true)}>
              修改并重新提交
            </Button>
          }
        />
        {app.reviewRemark && (
          <Alert
            type="error"
            showIcon
            style={{ maxWidth: 640, margin: '0 auto 16px' }}
            message="管理员备注"
            description={<span style={{ whiteSpace: 'pre-line' }}>{app.reviewRemark}</span>}
          />
        )}
        {summary}
      </div>
    );
  }

  // 提交 / 重提表单
  return (
    <Card title="提交审核资料" style={{ maxWidth: 640, margin: '0 auto' }}>
      <Typography.Paragraph type="secondary">
        填写真实资料，管理员审核通过后开通平台身份（教练 / 个人参赛者）。
      </Typography.Paragraph>
      <ApplyForm
        mode={app ? 'resubmit' : 'create'}
        initialValues={
          app
            ? {
                realName: app.realName,
                schoolId: app.schoolId ?? undefined,
                wechatNickname: app.wechatNickname ?? undefined,
                contact: app.contact ?? undefined,
                applyNote: app.applyNote ?? undefined,
                claimLegacy: app.claimLegacy,
              }
            : undefined
        }
        onDone={() => {
          setShowForm(false);
          void queryClient.invalidateQueries({ queryKey: ['audit', 'me'] });
        }}
      />
    </Card>
  );
}
