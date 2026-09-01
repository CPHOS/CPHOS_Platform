import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ROLE_LABELS, type TeamDetailDto, type TeamDto, type UpdateTeamInput } from '@cphos/shared';
import {
  App,
  Button,
  Card,
  Drawer,
  Form,
  Input,
  InputNumber,
  List,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useState } from 'react';
import { apiErrorMessage } from '../../../api/http';
import { adminTeamsApi } from '../../../api/teams';

interface TeamEditForm {
  name?: string;
  uploadLimit?: number;
  leaderId?: string;
}

interface SubAccountForm {
  email: string;
  password: string;
  realName: string;
  schoolId?: string;
}

/** 管理员：团队管理（负责人 + 子账号；共享上传限额） */
export function TeamsList() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [detail, setDetail] = useState<TeamDetailDto | null>(null);
  const [saving, setSaving] = useState(false);
  const [subOpen, setSubOpen] = useState(false);
  const [subSaving, setSubSaving] = useState(false);
  const [editForm] = Form.useForm<TeamEditForm>();
  const [subForm] = Form.useForm<SubAccountForm>();

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'teams', q, page, pageSize],
    queryFn: () => adminTeamsApi.list({ q: q || undefined, page, pageSize }),
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['admin', 'teams'] });
  };

  const openDetail = async (t: TeamDto) => {
    try {
      const d = await adminTeamsApi.get(t.id);
      setDetail(d);
      editForm.setFieldsValue({
        name: d.name ?? undefined,
        uploadLimit: d.uploadLimit,
        leaderId: d.leader.userId,
      });
    } catch (err) {
      message.error(apiErrorMessage(err));
    }
  };

  const saveEdit = async () => {
    const values = await editForm.validateFields().catch(() => null);
    if (!values || !detail) return;
    setSaving(true);
    try {
      const input: UpdateTeamInput = {
        ...(values.name !== undefined && values.name !== detail.name ? { name: values.name } : {}),
        ...(values.uploadLimit !== undefined && values.uploadLimit !== detail.uploadLimit
          ? { uploadLimit: values.uploadLimit }
          : {}),
        ...(values.leaderId !== undefined && values.leaderId !== detail.leader.userId
          ? { leaderId: values.leaderId }
          : {}),
      };
      if (Object.keys(input).length === 0) {
        setDetail(null);
        return;
      }
      const updated = await adminTeamsApi.update(detail.id, input);
      message.success('已保存');
      setDetail(updated);
      refresh();
    } catch (err) {
      message.error(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const createSub = async () => {
    const values = await subForm.validateFields().catch(() => null);
    if (!values || !detail) return;
    setSubSaving(true);
    try {
      const updated = await adminTeamsApi.addMember(detail.id, values);
      message.success('子账号已创建');
      setSubOpen(false);
      subForm.resetFields();
      setDetail(updated);
      refresh();
    } catch (err) {
      message.error(apiErrorMessage(err));
    } finally {
      setSubSaving(false);
    }
  };

  const removeMember = async (userId: string, name: string) => {
    if (!detail) return;
    try {
      const updated = await adminTeamsApi.removeMember(detail.id, userId);
      message.success(`已将 ${name} 移出团队（转为独立负责人）`);
      setDetail(updated);
      refresh();
    } catch (err) {
      message.error(apiErrorMessage(err));
    }
  };

  const columns: ColumnsType<TeamDto> = [
    { title: '团队', render: (_, r) => r.name ?? `团队 #${r.id}`, ellipsis: true },
    { title: '负责人', render: (_, r) => r.leader.realName ?? `用户 #${r.leader.userId}` },
    { title: '子账号数', dataIndex: 'memberCount', render: (v: number) => v - 1 },
    { title: '共享限额', dataIndex: 'uploadLimit', responsive: ['md'] },
    { title: '操作', render: (_, r) => <a onClick={() => openDetail(r)}>查看</a> },
  ];

  const members = detail?.members ?? [];
  const coachMembers = members.filter((m) => m.userId !== detail?.leader.userId);

  return (
    <Card>
      <Space style={{ marginBottom: 16 }} wrap>
        <Input.Search
          allowClear
          placeholder="团队名称 / 负责人姓名"
          style={{ width: 260, maxWidth: '100%' }}
          onSearch={(v) => {
            setQ(v);
            setPage(1);
          }}
        />
      </Space>
      <Table<TeamDto>
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

      <Drawer
        title={`团队：${detail?.name ?? (detail ? `#${detail.id}` : '')}`}
        open={!!detail}
        onClose={() => setDetail(null)}
        width={560}
      >
        <Form form={editForm} layout="vertical">
          <Form.Item name="name" label="团队名称">
            <Input maxLength={50} />
          </Form.Item>
          <Form.Item name="uploadLimit" label="共享上传限额" rules={[{ required: true, message: '请输入限额' }]}>
            <InputNumber min={0} max={60000} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="leaderId" label="负责人" rules={[{ required: true, message: '请选择负责人' }]}>
            <Select
              options={members.map((m) => ({
                value: m.userId,
                label: `${m.realName ?? m.userId}${m.userId === detail?.leader.userId ? '（当前负责人）' : ''}`,
              }))}
            />
          </Form.Item>
          <Form.Item>
            <Button type="primary" loading={saving} onClick={saveEdit}>
              保存团队信息
            </Button>
          </Form.Item>
        </Form>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontWeight: 600 }}>子账号（附属教练）</span>
          <Button size="small" type="primary" onClick={() => setSubOpen(true)}>
            新增子账号
          </Button>
        </div>
        <List
          size="small"
          dataSource={coachMembers}
          locale={{ emptyText: '暂无子账号' }}
          renderItem={(m) => (
            <List.Item
              actions={[
                <Popconfirm
                  key="rm"
                  title={`将 ${m.realName ?? m.userId} 移出团队？`}
                  description="移除后该成员将转为独立负责人并拥有自己的单人团队。"
                  onConfirm={() => removeMember(m.userId, m.realName ?? String(m.userId))}
                >
                  <a>移除</a>
                </Popconfirm>,
              ]}
            >
              <List.Item.Meta
                title={
                  <Space size={8}>
                    {m.realName ?? m.userId}
                    <Tag>{ROLE_LABELS[m.role]}</Tag>
                  </Space>
                }
                description={`${m.schoolName ?? '未填学校'} · ${m.email ?? m.loginName ?? ''}`}
              />
            </List.Item>
          )}
        />
      </Drawer>

      <Modal
        title="新增子账号"
        open={subOpen}
        onCancel={() => setSubOpen(false)}
        onOk={createSub}
        confirmLoading={subSaving}
        destroyOnClose
        afterClose={() => subForm.resetFields()}
      >
        <Form form={subForm} layout="vertical">
          <Form.Item
            name="realName"
            label="真实姓名"
            rules={[{ required: true, message: '请输入真实姓名' }]}
          >
            <Input maxLength={50} />
          </Form.Item>
          <Form.Item
            name="email"
            label="登录邮箱"
            rules={[{ required: true, type: 'email', message: '请输入正确邮箱' }]}
          >
            <Input autoComplete="off" />
          </Form.Item>
          <Form.Item
            name="password"
            label="密码（至少 8 位）"
            rules={[
              { required: true, message: '请输入密码' },
              { min: 8, message: '密码至少 8 位' },
            ]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Form.Item name="schoolId" label="学校（选填）">
            <Input placeholder="学校 id（可留空）" autoComplete="off" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
