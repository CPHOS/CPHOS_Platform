import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { Button, Card, Form, Input, Typography, message } from 'antd';
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { apiErrorMessage } from '../../api/http';
import { homeFor, useAuthStore } from '../../stores/auth';

interface FormValues {
  account: string;
  password: string;
}

export function LoginPage() {
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();
  const location = useLocation();
  const [submitting, setSubmitting] = useState(false);
  const from = (location.state as { from?: string } | null)?.from;

  const onFinish = async (values: FormValues) => {
    setSubmitting(true);
    try {
      const user = await login(values.account, values.password);
      message.success('登录成功');
      navigate(from && from.startsWith('/') ? from : homeFor(user), { replace: true });
    } catch (err) {
      message.error(apiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5' }}>
      <Card style={{ width: 400 }}>
        <Typography.Title level={4} style={{ textAlign: 'center', marginBottom: 4 }}>
          CPHOS 联考平台
        </Typography.Title>
        <Typography.Paragraph type="secondary" style={{ textAlign: 'center' }}>
          教练 / 个人参赛者 / CPHOS 成员 / 管理员统一入口
        </Typography.Paragraph>
        <Form<FormValues> onFinish={onFinish} size="large">
          <Form.Item
            name="account"
            rules={[{ required: true, message: '请输入账号（邮箱或用户名）' }]}
          >
            <Input prefix={<UserOutlined />} placeholder="邮箱或用户名" autoComplete="username" />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="密码" autoComplete="current-password" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block loading={submitting}>
              登录
            </Button>
          </Form.Item>
        </Form>
        <div style={{ textAlign: 'center' }}>
          还没有账号？<Link to="/register">注册</Link>
        </div>
      </Card>
    </div>
  );
}
