import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ROLE_LABELS,
  type MemberDto,
  type MemberRole,
  type UpdateMemberInput,
} from '@cphos/shared';
import {
  App,
  Button,
  Card,
  Drawer,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Table,
  Tag,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useState } from 'react';
import { dictApi } from '../../../api/dict';
import { apiErrorMessage } from '../../../api/http';
import { adminMembersApi } from '../../../api/members';
import { QueryError } from '../../../components/QueryError';

interface EditForm {
  realName: string;
  schoolId?: string;
  role: MemberRole;
  defaultSlot?: number | null;
  uploadLimit: number;
}

/** 管理员：成员档案管理（列表 + 编辑） */
export function MembersList() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [role, setRole] = useState<MemberRole | undefined>();
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [editing, setEditing] = useState<MemberDto | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<EditForm>();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin', 'members', role, q, page, pageSize],
    queryFn: () => adminMembersApi.list({ role, q: q || undefined, page, pageSize }),
  });

  const { data: schools = [] } = useQuery({ queryKey: ['dict', 'schools'], queryFn: dictApi.schools });

  const openEdit = (m: MemberDto) => {
    setEditing(m);
    form.setFieldsValue({
      realName: m.realName ?? '',
      schoolId: m.schoolId ?? undefined,
      role: m.role,
      defaultSlot: m.defaultSlot ?? null,
      uploadLimit: m.uploadLimit,
    });
  };

  const save = async () => {
    const values = await form.validateFields().catch(() => null);
    if (!values || !editing) return;
    setSaving(true);
    try {
      const input: UpdateMemberInput = {
        realName: values.realName,
        schoolId: values.schoolId ?? null,
        role: values.role,
        defaultSlot: values.defaultSlot ?? null,
        uploadLimit: values.uploadLimit,
      };
      await adminMembersApi.update(editing.userId, input);
      message.success('已保存');
      setEditing(null);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'members'] });
    } catch (err) {
      message.error(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const columns: ColumnsType<MemberDto> = [
    { title: '姓名', dataIndex: 'realName', render: (v: string | null) => v ?? '-', ellipsis: true },
    { title: '学校', dataIndex: 'schoolName', render: (v: string | null) => v ?? '-', responsive: ['md'], ellipsis: true },
    {
      title: '角色',
      dataIndex: 'role',
      render: (v: MemberRole) => <Tag color={v === 'LEADER' ? 'blue' : 'green'}>{ROLE_LABELS[v]}</Tag>,
    },
    { title: '默认槽位', dataIndex: 'defaultSlot', render: (v: number | null) => v ?? '-', responsive: ['md'] },
    { title: '上传限额', dataIndex: 'uploadLimit', responsive: ['lg'] },
    { title: '团队', dataIndex: 'teamName', render: (v: string | null) => v ?? '未加入', responsive: ['lg'], ellipsis: true },
    { title: '账号', render: (_, r) => r.account.email ?? r.account.loginName ?? '-', responsive: ['md'], ellipsis: true },
    { title: '操作', render: (_, r) => <a onClick={() => openEdit(r)}>编辑</a> },
  ];

  return (
    <Card>
      <Space style={{ marginBottom: 16 }} wrap>
        <Select
          allowClear
          placeholder="角色"
          style={{ width: 140 }}
          value={role}
          onChange={(v) => {
            setRole(v);
            setPage(1);
          }}
          options={(['LEADER', 'COACH'] as const).map((r) => ({ value: r, label: ROLE_LABELS[r] }))}
        />
        <Input.Search
          allowClear
          placeholder="姓名 / 学校 / 邮箱 / 用户名"
          style={{ width: 260, maxWidth: '100%' }}
          onSearch={(v) => {
            setQ(v);
            setPage(1);
          }}
        />
      </Space>
      {isError && <QueryError error={error} onRetry={() => void refetch()} />}
      <Table<MemberDto>
        rowKey="userId"
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
        title={`编辑成员：${editing?.realName ?? ''}`}
        open={!!editing}
        onClose={() => setEditing(null)}
        width={420}
        extra={
          <Button type="primary" loading={saving} onClick={save}>
            保存
          </Button>
        }
      >
        <Form form={form} layout="vertical">
          <Form.Item name="realName" label="真实姓名" rules={[{ required: true, message: '请输入真实姓名' }]}>
            <Input maxLength={50} />
          </Form.Item>
          <Form.Item name="schoolId" label="学校">
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="选择学校"
              options={schools.map((s) => ({
                value: s.id,
                label: `${s.name}${s.areaName ? `（${s.areaName}）` : ''}`,
              }))}
            />
          </Form.Item>
          <Form.Item
            name="role"
            label="业务角色"
            rules={[{ required: true, message: '请选择角色' }]}
            extra="附属教练需先加入团队"
          >
            <Select
              options={(['LEADER', 'COACH'] as MemberRole[]).map((roleValue) => ({
                value: roleValue,
                label: ROLE_LABELS[roleValue],
              }))}
            />
          </Form.Item>
          <Form.Item name="defaultSlot" label="默认批阅槽位（1-10，可留空）">
            <InputNumber min={1} max={10} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="uploadLimit" label="上传限额" rules={[{ required: true, message: '请输入上传限额' }]}>
            <InputNumber min={0} max={60000} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Drawer>
    </Card>
  );
}
