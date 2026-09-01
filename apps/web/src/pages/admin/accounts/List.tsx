import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ACCOUNT_ROLE_LABELS,
  USER_STATUS_LABELS,
  type AccountDto,
  type AccountRole,
  type UserStatus,
} from '@cphos/shared';
import {
  Alert,
  App,
  Button,
  Card,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useState } from 'react';
import { apiErrorMessage } from '../../../api/http';
import { botApi } from '../../../api/marking';
import { adminAccountsApi } from '../../../api/members';
import { useAuthStore } from '../../../stores/auth';

interface CreateForm {
  loginName: string;
  displayName: string;
  password: string;
}

interface BotForm {
  loginName: string;
  displayName: string;
}

const ROLE_COLORS: Record<AccountRole, string> = {
  SUPER_ADMIN: 'red',
  ADMIN: 'orange',
  CPHOS_MEMBER: 'purple',
  PLATFORM_USER: 'blue',
  BOT: 'geekblue',
};

const STATUS_COLORS: Record<UserStatus, string> = {
  ACTIVE: 'green',
  DISABLED: 'red',
  PENDING: 'default',
};

/** 管理员：账号管理（列表 + 创建内部账号 + 角色/状态操作） */
export function AccountsList() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const me = useAuthStore((s) => s.user);
  const isSuper = me?.role === 'SUPER_ADMIN';

  const [role, setRole] = useState<AccountRole | undefined>();
  const [status, setStatus] = useState<UserStatus | undefined>();
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm] = Form.useForm<CreateForm>();
  const [botOpen, setBotOpen] = useState(false);
  const [botSaving, setBotSaving] = useState(false);
  const [botToken, setBotToken] = useState<{ loginName: string; token: string } | null>(null);
  const [botForm] = Form.useForm<BotForm>();

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'accounts', role, status, q, page, pageSize],
    queryFn: () => adminAccountsApi.list({ role, status, q: q || undefined, page, pageSize }),
  });

  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['admin', 'accounts'] });

  const doCreate = async () => {
    const values = await createForm.validateFields().catch(() => null);
    if (!values) return;
    setCreating(true);
    try {
      await adminAccountsApi.create(values);
      message.success('已创建');
      setCreateOpen(false);
      refresh();
    } catch (err) {
      message.error(apiErrorMessage(err));
    } finally {
      setCreating(false);
    }
  };

  const setRoleAction = async (a: AccountDto, target: 'ADMIN' | 'CPHOS_MEMBER') => {
    try {
      await adminAccountsApi.setRole(a.id, target);
      message.success('已更新');
      refresh();
    } catch (err) {
      message.error(apiErrorMessage(err));
    }
  };

  const setStatusAction = async (a: AccountDto, s: 'ACTIVE' | 'DISABLED') => {
    try {
      await adminAccountsApi.setStatus(a.id, s);
      message.success('已更新');
      refresh();
    } catch (err) {
      message.error(apiErrorMessage(err));
    }
  };

  const doCreateBot = async () => {
    const values = await botForm.validateFields().catch(() => null);
    if (!values) return;
    setBotSaving(true);
    try {
      const result = await botApi.create(values);
      setBotToken({ loginName: values.loginName, token: result.token });
      setBotOpen(false);
      refresh();
      message.success('机器人账号已创建');
    } catch (err) {
      message.error(apiErrorMessage(err));
    } finally {
      setBotSaving(false);
    }
  };

  const rotateBot = async (a: AccountDto) => {
    try {
      const result = await botApi.rotate(a.id);
      setBotToken({ loginName: a.loginName ?? '', token: result.token });
      message.success('机器人令牌已轮换');
    } catch (err) {
      message.error(apiErrorMessage(err));
    }
  };


  const columns: ColumnsType<AccountDto> = [
    { title: '账号', render: (_, r) => r.email ?? r.loginName ?? '-', ellipsis: true },
    { title: '显示名', dataIndex: 'displayName', render: (v) => v ?? '-', responsive: ['md'], ellipsis: true },
    {
      title: '角色',
      dataIndex: 'role',
      render: (v: AccountRole) => <Tag color={ROLE_COLORS[v]}>{ACCOUNT_ROLE_LABELS[v]}</Tag>,
      responsive: ['sm'],
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (v: UserStatus) => <Tag color={STATUS_COLORS[v]}>{USER_STATUS_LABELS[v]}</Tag>,
    },
    { title: '成员', render: (_, r) => (r.profile ? r.profile.realName ?? '-' : '-'), responsive: ['md'] },
    {
      title: '操作',
      render: (_, r) => (
        <Space size="small" wrap>
          {isSuper && !r.protected && r.role === 'CPHOS_MEMBER' && (
            <a onClick={() => setRoleAction(r, 'ADMIN')}>提升为管理员</a>
          )}
          {isSuper && !r.protected && r.role === 'ADMIN' && (
            <a onClick={() => setRoleAction(r, 'CPHOS_MEMBER')}>降级</a>
          )}
          {!r.protected && r.status === 'ACTIVE' && (
            <a onClick={() => setStatusAction(r, 'DISABLED')}>禁用</a>
          )}
          {!r.protected && r.status === 'DISABLED' && (
            <a onClick={() => setStatusAction(r, 'ACTIVE')}>启用</a>
          )}
          {r.role === 'BOT' && <a onClick={() => void rotateBot(r)}>轮换令牌</a>}
        </Space>
      ),
    },
  ];

  return (
    <Card>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 16,
        }}
      >
        <Space wrap>
          <Select
            allowClear
            placeholder="角色"
            style={{ width: 140 }}
            value={role}
            onChange={(v) => {
              setRole(v);
              setPage(1);
            }}
            options={(Object.keys(ACCOUNT_ROLE_LABELS) as AccountRole[]).map((r) => ({
              value: r,
              label: ACCOUNT_ROLE_LABELS[r],
            }))}
          />
          <Select
            allowClear
            placeholder="状态"
            style={{ width: 120 }}
            value={status}
            onChange={(v) => {
              setStatus(v);
              setPage(1);
            }}
            options={(['ACTIVE', 'PENDING', 'DISABLED'] as const).map((s) => ({
              value: s,
              label: USER_STATUS_LABELS[s],
            }))}
          />
          <Input.Search
            allowClear
            placeholder="邮箱 / 用户名 / 显示名"
            style={{ width: 240, maxWidth: '100%' }}
            onSearch={(v) => {
              setQ(v);
              setPage(1);
            }}
          />
        </Space>
        <Space>
          <Button onClick={() => { botForm.resetFields(); setBotOpen(true); }} data-testid="bot-create-button">
            创建机器人
          </Button>
          <Button type="primary" onClick={() => setCreateOpen(true)}>
            创建内部账号
          </Button>
        </Space>
      </div>
      <Table<AccountDto>
        rowKey="id"
        loading={isLoading}
        columns={columns}
        dataSource={data?.items ?? []}
        tableLayout="fixed"
        pagination={{
          current: page,
          pageSize,
          total: data?.total ?? 0,
          showSizeChanger: true,
          showTotal: (t) => `共 ${t} 条`,
          onChange: (p, ps) => {
            setPage(p);
            setPageSize(ps);
          },
        }}
      />

      <Modal
        title="创建内部账号"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={doCreate}
        confirmLoading={creating}
        destroyOnClose
        afterClose={() => createForm.resetFields()}
      >
        <Form form={createForm} layout="vertical">
          <Form.Item
            name="loginName"
            label="用户名（登录用）"
            rules={[
              { required: true, message: '请输入用户名' },
              { pattern: /^[a-z0-9._-]+$/, message: '只能包含小写字母、数字和 . _ -' },
            ]}
          >
            <Input placeholder="例如 zhangsan" autoComplete="off" />
          </Form.Item>
          <Form.Item name="displayName" label="显示名称" rules={[{ required: true, message: '请输入显示名称' }]}>
            <Input placeholder="例如 张三" />
          </Form.Item>
          <Form.Item
            name="password"
            label="密码（至少 8 位）"
            rules={[
              { required: true, message: '请输入密码' },
              { min: 8, message: '密码至少 8 位' },
            ]}
          >
            <Input.Password placeholder="至少 8 位" autoComplete="new-password" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="创建机器人账号"
        open={botOpen}
        onCancel={() => setBotOpen(false)}
        onOk={() => void doCreateBot()}
        confirmLoading={botSaving}
        destroyOnClose
        afterClose={() => botForm.resetFields()}
      >
        <Form form={botForm} layout="vertical">
          <Form.Item
            name="loginName"
            label="机器人用户名"
            rules={[
              { required: true, message: '请输入机器人用户名' },
              { pattern: /^[a-z0-9._-]+$/, message: '只能包含小写字母、数字和 . _ -' },
            ]}
          >
            <Input placeholder="例如 bot_grader" autoComplete="off" />
          </Form.Item>
          <Form.Item name="displayName" label="显示名称" rules={[{ required: true, message: '请输入显示名称' }]}>
            <Input placeholder="例如 自动阅卷机器人" />
          </Form.Item>
          <Typography.Text type="secondary">
            机器人不使用密码登录，创建成功后展示一次性 API Token；请求时携带 x-bot-login 与 x-bot-token。
          </Typography.Text>
        </Form>
      </Modal>

      <Modal
        title="机器人令牌"
        open={!!botToken}
        onCancel={() => setBotToken(null)}
        footer={<Button type="primary" onClick={() => setBotToken(null)}>我已保存</Button>}
        destroyOnClose
      >
        <Alert
          type="warning"
          showIcon
          message="令牌仅展示这一次，请立即保存"
          style={{ marginBottom: 12 }}
        />
        <Typography.Paragraph copyable={{ text: botToken?.token }}>
          <Typography.Text code>{botToken?.token}</Typography.Text>
        </Typography.Paragraph>
        <Typography.Text type="secondary">机器人：{botToken?.loginName}</Typography.Text>
      </Modal>

    </Card>
  );
}
