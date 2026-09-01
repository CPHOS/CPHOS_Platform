import { LockOutlined, MailOutlined, SafetyOutlined } from '@ant-design/icons';
import { Alert, App, Button, Card, Form, Input, Steps, Typography } from 'antd';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../../api/auth';
import { apiErrorMessage } from '../../api/http';

interface EmailForm {
  email: string;
}

interface ResetForm {
  code: string;
  newPassword: string;
  confirm: string;
}

/** 忘记/重置密码：邮箱请求验证码 → 验证码 + 新密码重置 */
export function ForgotPasswordPage() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const request = async (values: EmailForm) => {
    setSubmitting(true);
    try {
      await authApi.forgotPassword({ email: values.email });
      setEmail(values.email);
      setStep(1);
      message.success('如果邮箱已注册，重置验证码已发送');
    } catch (err) {
      message.error(apiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const reset = async (values: ResetForm) => {
    setSubmitting(true);
    try {
      await authApi.resetPassword({ email, code: values.code, newPassword: values.newPassword });
      message.success('密码已重置，请使用新密码登录');
      navigate('/login', { replace: true });
    } catch (err) {
      message.error(apiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const resend = async () => {
    try {
      await authApi.forgotPassword({ email });
      message.success('重置验证码已重新发送');
    } catch (err) {
      message.error(apiErrorMessage(err));
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f6f8fa', padding: 16 }}>
      <Card style={{ width: '100%', maxWidth: 440 }}>
        <Typography.Title level={4} style={{ textAlign: 'center' }}>找回密码</Typography.Title>
        <Steps
          size="small"
          current={step}
          style={{ marginBottom: 24 }}
          items={[{ title: '验证邮箱' }, { title: '重置密码' }]}
        />
        {step === 0 && (
          <Form<EmailForm> onFinish={request} size="large">
            <Form.Item name="email" rules={[{ required: true, type: 'email', message: '请输入注册邮箱' }]}>
              <Input prefix={<MailOutlined />} placeholder="注册邮箱" autoComplete="email" />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" block loading={submitting}>
                发送重置验证码
              </Button>
            </Form.Item>
          </Form>
        )}
        {step === 1 && (
          <>
            <Alert type="info" showIcon style={{ marginBottom: 16 }} message={'验证码已发送至 ' + email} />
            <Form<ResetForm> onFinish={reset} size="large">
              <Form.Item name="code" rules={[{ required: true, pattern: /^\d{6}$/, message: '请输入 6 位数字验证码' }]}>
                <Input prefix={<SafetyOutlined />} placeholder="6 位验证码" maxLength={6} />
              </Form.Item>
              <Form.Item name="newPassword" rules={[{ required: true, min: 8, message: '新密码至少 8 位' }]}>
                <Input.Password prefix={<LockOutlined />} placeholder="新密码（至少 8 位）" autoComplete="new-password" />
              </Form.Item>
              <Form.Item
                name="confirm"
                dependencies={['newPassword']}
                rules={[
                  { required: true, message: '请再次输入新密码' },
                  ({ getFieldValue }) => ({
                    validator: (_, v) =>
                      !v || getFieldValue('newPassword') === v
                        ? Promise.resolve()
                        : Promise.reject(new Error('两次输入的密码不一致')),
                  }),
                ]}
              >
                <Input.Password prefix={<LockOutlined />} placeholder="确认新密码" autoComplete="new-password" />
              </Form.Item>
              <Form.Item>
                <Button type="primary" htmlType="submit" block loading={submitting}>
                  重置密码
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
          想起密码了？<Link to="/login">返回登录</Link>
        </div>
      </Card>
    </div>
  );
}
