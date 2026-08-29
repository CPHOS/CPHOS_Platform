import { SafetyOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Form, Input, Typography, message } from 'antd';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../../api/auth';
import { apiErrorMessage } from '../../api/http';
import { useAuthStore } from '../../stores/auth';

interface CodeForm {
  code: string;
}

/** 邮箱验证页：登录后未验证、或注册流程跳转至此 */
export function VerifyEmailPage() {
  const user = useAuthStore((s) => s.user);
  const loadMe = useAuthStore((s) => s.loadMe);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  const email = user?.email ?? '';  const onFinish = async (values: CodeForm) => {
    setSubmitting(true);
    try {
      await authApi.verifyEmail({ email, code: values.code });
      message.success('邮箱验证成功');
      const me = await loadMe();
      navigate(me ? '/app' : '/login', { replace: true });
    } catch (err) {
      message.error(apiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const resend = async () => {
    try {
      await authApi.sendCode({ email, purpose: 'REGISTER' });
      message.success('验证码已重新发送');
    } catch (err) {
      message.error(apiErrorMessage(err));
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5' }}>
      <Card style={{ width: 440 }}>
        <Typography.Title level={4} style={{ textAlign: 'center' }}>邮箱验证</Typography.Title>
        <Alert type="warning" showIcon style={{ marginBottom: 16 }} message={`请完成 ${email} 的邮箱验证后继续`} />
        <Form<CodeForm> onFinish={onFinish} size="large">
          <Form.Item name="code" rules={[{ required: true, pattern: /^\d{6}$/, message: '请输入 6 位数字验证码' }]}>
            <Input prefix={<SafetyOutlined />} placeholder="6 位验证码" maxLength={6} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block loading={submitting}>
              验证
            </Button>
          </Form.Item>
        </Form>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Button type="link" onClick={() => void resend()}>
            重新发送验证码
          </Button>
          <Button
            type="link"
            onClick={() => void logout().then(() => navigate('/login', { replace: true }))}
          >
            退出并使用其他账号
          </Button>
        </div>
      </Card>
    </div>
  );
}
