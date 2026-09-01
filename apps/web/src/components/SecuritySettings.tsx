import { LockOutlined, MailOutlined, SafetyOutlined } from '@ant-design/icons';
import { App, Button, Card, Divider, Form, Input, Modal, Space, Typography } from 'antd';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../api/auth';
import { apiErrorMessage } from '../api/http';
import { useAuthStore } from '../stores/auth';

interface ChangePasswordForm {
  currentPassword: string;
  newPassword: string;
  confirm: string;
}

interface EmailChangeForm {
  newEmail: string;
  currentPassword: string;
}

interface EmailCodeForm {
  code: string;
}

/** 个人安全设置：修改密码（需当前密码）与换绑邮箱（双重验证） */
export function SecuritySettings() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const setUser = useAuthStore((s) => s.setUser);

  const [pwdForm] = Form.useForm<ChangePasswordForm>();
  const [emailForm] = Form.useForm<EmailChangeForm>();
  const [codeForm] = Form.useForm<EmailCodeForm>();
  const [pwdSaving, setPwdSaving] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [pendingEmail, setPendingEmail] = useState('');
  const [pendingPassword, setPendingPassword] = useState('');
  const [emailSaving, setEmailSaving] = useState(false);

  const changePassword = async (values: ChangePasswordForm) => {
    setPwdSaving(true);
    try {
      await authApi.changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      message.success('密码已修改，请重新登录');
      pwdForm.resetFields();
      await logout();
      navigate('/login', { replace: true });
    } catch (err) {
      message.error(apiErrorMessage(err));
    } finally {
      setPwdSaving(false);
    }
  };

  const sendEmailCode = async () => {
    const values = await emailForm.validateFields(['newEmail', 'currentPassword']).catch(() => null);
    if (!values) return;
    setEmailSaving(true);
    try {
      await authApi.requestEmailChange(values);
      setPendingEmail(values.newEmail);
      setPendingPassword(values.currentPassword);
      setCodeSent(true);
      message.success('验证码已发送至新邮箱');
      void codeForm.validateFields().catch(() => undefined);
    } catch (err) {
      message.error(apiErrorMessage(err));
    } finally {
      setEmailSaving(false);
    }
  };

  const confirmEmail = async () => {
    const values = await codeForm.validateFields().catch(() => null);
    if (!values) return;
    setEmailSaving(true);
    try {
      const updated = await authApi.confirmEmailChange({ newEmail: pendingEmail, code: values.code });
      setUser(updated);
      message.success('邮箱已更新');
      setEmailOpen(false);
      setCodeSent(false);
      setPendingEmail('');
      setPendingPassword('');
      emailForm.resetFields();
      codeForm.resetFields();
    } catch (err) {
      message.error(apiErrorMessage(err));
    } finally {
      setEmailSaving(false);
    }
  };

  const closeEmailModal = () => {
    setEmailOpen(false);
    setCodeSent(false);
    setPendingEmail('');
    setPendingPassword('');
    emailForm.resetFields();
    codeForm.resetFields();
  };

  return (
    <Card title="安全设置" size="small" style={{ marginTop: 16 }}>
      <Typography.Title level={5} style={{ marginTop: 0 }}>修改密码</Typography.Title>
      <Form<ChangePasswordForm>
        form={pwdForm}
        name="change-password"
        layout="vertical"
        onFinish={changePassword}
        style={{ maxWidth: 420 }}
      >
        <Form.Item
          name="currentPassword"
          label="当前密码"
          rules={[{ required: true, message: '请输入当前密码' }]}
        >
          <Input.Password prefix={<LockOutlined />} autoComplete="current-password" />
        </Form.Item>
        <Form.Item
          name="newPassword"
          label="新密码"
          rules={[{ required: true, min: 8, message: '新密码至少 8 位' }]}
        >
          <Input.Password prefix={<LockOutlined />} autoComplete="new-password" />
        </Form.Item>
        <Form.Item
          name="confirm"
          label="确认新密码"
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
          <Input.Password prefix={<LockOutlined />} autoComplete="new-password" />
        </Form.Item>
        <Button type="primary" htmlType="submit" loading={pwdSaving} data-testid="security-save-password">
          保存新密码
        </Button>
      </Form>

      <Divider />

      <Typography.Title level={5}>换绑邮箱</Typography.Title>
      <Space direction="vertical" size={4} style={{ marginBottom: 12 }}>
        <Typography.Text type="secondary">当前邮箱：{user?.email ?? '未绑定'}</Typography.Text>
        <Typography.Text type="secondary">需验证登录密码，并向新邮箱发送验证码。</Typography.Text>
      </Space>
      <div>
        <Button icon={<MailOutlined />} onClick={() => setEmailOpen(true)} data-testid="security-change-email">
          换绑邮箱
        </Button>
      </div>

      <Modal
        title="换绑邮箱"
        open={emailOpen}
        onCancel={closeEmailModal}
        footer={null}
        destroyOnClose
      >
        <Form<EmailChangeForm> form={emailForm} name="email-change" layout="vertical" disabled={codeSent}>
          <Form.Item
            name="newEmail"
            label="新邮箱"
            rules={[{ required: true, type: 'email', message: '请输入正确的新邮箱' }]}
          >
            <Input prefix={<MailOutlined />} placeholder="new@example.com" />
          </Form.Item>
          <Form.Item
            name="currentPassword"
            label="当前登录密码"
            rules={[{ required: true, message: '请输入当前密码' }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              autoComplete="current-password"
              data-testid="email-change-current-password"
            />
          </Form.Item>
        </Form>
        {!codeSent ? (
          <Button type="primary" block loading={emailSaving} onClick={() => void sendEmailCode()} data-testid="security-send-email-code">
            发送验证码
          </Button>
        ) : (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Typography.Text type="secondary">验证码已发送至 {pendingEmail}</Typography.Text>
            <Form<EmailCodeForm> form={codeForm} name="email-code" layout="vertical">
              <Form.Item
                name="code"
                label="邮箱验证码"
                rules={[{ required: true, pattern: /^\d{6}$/, message: '请输入 6 位数字验证码' }]}
              >
                <Input prefix={<SafetyOutlined />} maxLength={6} placeholder="6 位验证码" />
              </Form.Item>
            </Form>
            <Button type="primary" block loading={emailSaving} onClick={() => void confirmEmail()} data-testid="security-confirm-email">
              确认换绑
            </Button>
          </Space>
        )}
      </Modal>
    </Card>
  );
}
