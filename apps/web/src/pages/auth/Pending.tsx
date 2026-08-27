import { ClockCircleOutlined } from '@ant-design/icons';
import { Button, Card, Result, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth';

/** 待审核/禁用提示页：邮箱已验证但尚未通过管理员审核（或账号被禁用） */
export function PendingPage() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  const disabled = user?.status === 'DISABLED';

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5' }}>
      <Card style={{ width: 480 }}>
        <Result
          icon={<ClockCircleOutlined style={{ color: '#faad14' }} />}
          title={disabled ? '账号已禁用' : '等待管理员审核'}
          subTitle={
            disabled ? (
              '如有疑问请联系管理员。'
            ) : (
              <Typography.Paragraph style={{ textAlign: 'center' }}>
                邮箱已验证，但平台身份（教练 / 个人参赛者 / CPHOS 成员）需管理员人工审核后开通。
                <br />
                「提交审核资料」功能将在下一功能块上线。
              </Typography.Paragraph>
            )
          }
          extra={[
            <Button
              key="logout"
              onClick={() => void logout().then(() => navigate('/login', { replace: true }))}
            >
              退出登录
            </Button>,
          ]}
        />
      </Card>
    </div>
  );
}
