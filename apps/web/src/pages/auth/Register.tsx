import { LockOutlined, MailOutlined, SafetyOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Form, Input, Steps, Typography, message } from 'antd';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../../api/auth';
import { apiErrorMessage } from '../../api/http';

interface AccountForm {
  email: string;
  password: string;
}

interface CodeForm {
  code: string;
}

/**
 * 注册流程（两步）：
 * 1) 邮箱 + 密码 → 自动发送验证码
 * 2) 输入验证码 → 验证通过后进入"待审核"页
 */
export function RegisterPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onAccountFinish = async (values: AccountForm) => {
    setSubmitting(true);
    try {
      await authApi.register({ email: values.email, password: values.password });
      setEmail(values.email);
      setStep(1);
      message.success('注册成功，验证码已发送至邮箱');
    } catch (err) {
      message.error(apiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const onCodeFinish = async (values: CodeForm) => {
    setSubmitting(true);
    try {
      await authApi.verifyEmail({ email, code: values.code });
      message.success('邮箱验证成功，请登录后提交审核资料');
      navigate('/login', { replace: true });
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
        <Typography.Title level={4} style={{ textAlign: 'center' }}>注册账号</Typography.Title>
        <Steps
          size="small"
          current={step}
          style={{ marginBottom: 24 }}
          items={[{ title: '账号信息' }, { title: '邮箱验证' }]}
        />
        {step === 0 && (
          <Form<AccountForm> onFinish={onAccountFinish} size="large">
            <Form.Item name="email" rules={[{ required: true, type: 'email', message: '请输入正确邮箱' }]}>
              <Input prefix={<MailOutlined />} placeholder="邮箱（登录账号）" autoComplete="email" />
            </Form.Item>
            <Form.Item
              name="password"
              rules={[
                { required: true, message: '请输入密码' },
                { min: 8, message: '密码至少 8 位' },
              ]}
            >
              <Input.Password prefix={<LockOutlined />} placeholder="密码（至少 8 位）" autoComplete="new-password" />
            </Form.Item>
            <Form.Item
              name="confirm"
              dependencies={['password']}
              rules={[
                { required: true, message: '请再次输入密码' },
                ({ getFieldValue }) => ({
                  validator: (_, v) =>
                    !v || getFieldValue('password') === v
                      ? Promise.resolve()
                      : Promise.reject(new Error('两次输入的密码不一致')),
                }),
              ]}
            >
              <Input.Password prefix={<LockOutlined />} placeholder="确认密码" autoComplete="new-password" />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" block loading={submitting}>
                注册并发送验证码
              </Button>
            </Form.Item>
          </Form>
        )}
        {step === 1 && (
          <>
            <Alert type="info" showIcon style={{ marginBottom: 16 }} message={`验证码已发送至 ${email}，10 分钟内有效`} />
            <Form<CodeForm> onFinish={onCodeFinish} size="large">
              <Form.Item name="code" rules={[{ required: true, pattern: /^\d{6}$/, message: '请输入 6 位数字验证码' }]}>
                <Input prefix={<SafetyOutlined />} placeholder="6 位验证码" maxLength={6} />
              </Form.Item>
              <Form.Item>
                <Button type="primary" htmlType="submit" block loading={submitting}>
                  完成验证
                </Button>
              </Form.Item>
            </Form>
            <div style={{ textAlign: 'center' }}>
              <Button type="link" onClick={() => void resend()}>
                重新发送验证码
              </Button>
            </div>
          </>
        )}
        <div style={{ textAlign: 'center', marginTop: 8 }}>
          已有账号？<Link to="/login">去登录</Link>
        </div>
      </Card>
    </div>
  );
}
