import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { MemberOptionDto, TeamDto } from '@cphos/shared';
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
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useMemo, useState } from 'react';
import { apiErrorMessage } from '../../../api/http';
import { adminMembersApi } from '../../../api/members';
import { adminTeamsApi } from '../../../api/teams';

interface TeamForm {
  name: string;
  uploadLimit: number;
  leaderUserId: string;
  memberUserIds?: string[];
}

function memberLabel(m: MemberOptionDto): string {
  const name = m.realName ?? m.account.loginName ?? m.account.email ?? m.userId;
  const school = m.schoolName ? '（' + m.schoolName + '）' : '';
  return name + school;
}

/** 管理员：团队管理（创建/编辑负责人/成员增删/删除） */
export function TeamsList() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TeamDto | null>(null);
  const [saving, setSaving] = useState(false);
  const [managing, setManaging] = useState<TeamDto | null>(null);
  const [addUserIds, setAddUserIds] = useState<string[]>([]);
  const [form] = Form.useForm<TeamForm>();

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'teams', q, page, pageSize],
    queryFn: () => adminTeamsApi.list({ q: q || undefined, page, pageSize }),
  });

  const { data: options = [] } = useQuery({
    queryKey: ['admin', 'members', 'options'],
    queryFn: adminMembersApi.options,
  });

  const optionMap = useMemo(() => new Map(options.map((o) => [o.userId, o])), [options]);

  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['admin', 'teams'] });

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ uploadLimit: 100, memberUserIds: [] });
    setFormOpen(true);
  };

  const openEdit = (team: TeamDto) => {
    setEditing(team);
    form.setFieldsValue({
      name: team.name,
      uploadLimit: team.uploadLimit,
      leaderUserId: team.leaderUserId,
      memberUserIds: [],
    });
    setFormOpen(true);
  };

  const save = async () => {
    const values = await form.validateFields().catch(() => null);
    if (!values) return;
    setSaving(true);
    try {
      if (editing) {
        await adminTeamsApi.update(editing.id, {
          name: values.name,
          uploadLimit: values.uploadLimit,
          leaderUserId: values.leaderUserId,
        });
        if (values.memberUserIds && values.memberUserIds.length > 0) {
          await adminTeamsApi.addMembers(editing.id, values.memberUserIds);
        }
      } else {
        await adminTeamsApi.create({
          name: values.name,
          uploadLimit: values.uploadLimit,
          leaderUserId: values.leaderUserId,
          memberUserIds: values.memberUserIds ?? [],
        });
      }
      message.success(editing ? '团队已更新' : '团队已创建');
      setFormOpen(false);
      refresh();
      if (managing && editing && managing.id === editing.id) {
        setManaging(await adminTeamsApi.get(editing.id));
      }
    } catch (err) {
      message.error(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const removeMember = async (team: TeamDto, userId: string) => {
    try {
      const updated = await adminTeamsApi.removeMembers(team.id, [userId]);
      setManaging(updated);
      message.success('成员已移除');
      refresh();
    } catch (err) {
      message.error(apiErrorMessage(err));
    }
  };

  const addMembers = async () => {
    if (!managing) return;
    if (addUserIds.length === 0) {
      message.warning('请选择要加入的成员');
      return;
    }
    try {
      const updated = await adminTeamsApi.addMembers(managing.id, addUserIds);
      setManaging(updated);
      setAddUserIds([]);
      message.success('成员已加入');
      refresh();
    } catch (err) {
      message.error(apiErrorMessage(err));
    }
  };

  const removeTeam = async (team: TeamDto) => {
    try {
      await adminTeamsApi.remove(team.id);
      message.success('团队已删除');
      refresh();
    } catch (err) {
      message.error(apiErrorMessage(err));
    }
  };

  const existingMemberIds = new Set((managing?.members ?? []).map((m) => m.userId));
  const addableOptions = options.filter(
    (o) =>
      !existingMemberIds.has(o.userId) &&
      (o.teamId === null || o.teamId === managing?.id),
  );

  const columns: ColumnsType<TeamDto> = [
    { title: '团队名称', dataIndex: 'name', ellipsis: true },
    {
      title: '负责人',
      dataIndex: 'leaderName',
      render: (v: string | null, r) => v ?? optionMap.get(r.leaderUserId)?.account.loginName ?? '-',
      responsive: ['md'],
      ellipsis: true,
    },
    {
      title: '成员',
      dataIndex: 'memberCount',
      render: (v: number) => <Tag color="blue">{v} 人</Tag>,
    },
    { title: '共享上传限额', dataIndex: 'uploadLimit', responsive: ['lg'] },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      render: (v: string) => new Date(v).toLocaleString(),
      responsive: ['lg'],
    },
    {
      title: '操作',
      render: (_, r) => (
        <Space size="small" wrap>
          <a data-testid={'team-manage-' + r.id} onClick={() => { setManaging(r); setAddUserIds([]); }}>成员</a>
          <a onClick={() => openEdit(r)}>编辑</a>
          <Popconfirm title="确认删除该团队？" onConfirm={() => void removeTeam(r)}>
            <a style={{ color: '#cf222e' }}>删除</a>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <Input.Search
          allowClear
          placeholder="团队名称 / 负责人"
          style={{ width: 260, maxWidth: '100%' }}
          onSearch={(v) => { setQ(v); setPage(1); }}
        />
        <Button type="primary" onClick={openCreate} data-testid="team-create-button">新建团队</Button>
      </div>
      <Table<TeamDto>
        rowKey="id"
        loading={isLoading}
        columns={columns}
        dataSource={data?.items ?? []}
        pagination={{
          current: page,
          pageSize,
          total: data?.total ?? 0,
          showSizeChanger: true,
          showTotal: (t) => '共 ' + t + ' 条',
          onChange: (p, ps) => { setPage(p); setPageSize(ps); },
        }}
      />

      <Modal
        title={editing ? '编辑团队' : '新建团队'}
        open={formOpen}
        onCancel={() => setFormOpen(false)}
        onOk={() => void save()}
        confirmLoading={saving}
        destroyOnClose
      >
        <Form<TeamForm> form={form} layout="vertical">
          <Form.Item name="name" label="团队名称" rules={[{ required: true, message: '请输入团队名称' }]}>
            <Input maxLength={50} data-testid="team-name" />
          </Form.Item>
          <Form.Item name="uploadLimit" label="共享上传限额" rules={[{ required: true, message: '请输入限额' }]}>
            <InputNumber min={0} max={60000} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="leaderUserId" label="负责人" rules={[{ required: true, message: '请选择负责人' }]}>
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="选择负责人（须有成员资料）"
              options={options.map((o) => ({
                value: o.userId,
                label: memberLabel(o),
                disabled: o.teamId !== null && o.teamId !== editing?.id,
              }))}
            />
          </Form.Item>
          {!editing && (
            <Form.Item name="memberUserIds" label="初始成员（可多选）">
              <Select
                mode="multiple"
                optionFilterProp="label"
                placeholder="选择成员（可稍后添加）"
                options={options.filter((o) => o.teamId === null).map((o) => ({ value: o.userId, label: memberLabel(o) }))}
              />
            </Form.Item>
          )}
        </Form>
      </Modal>

      <Drawer
        title={'团队成员：' + (managing?.name ?? '')}
        open={!!managing}
        onClose={() => setManaging(null)}
        width={520}
      >
        {managing && (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Card size="small">
              <Space wrap>
                <Select
                  mode="multiple"
                  showSearch
                  optionFilterProp="label"
                  placeholder="选择新增成员"
                  style={{ minWidth: 280 }}
                  value={addUserIds}
                  onChange={setAddUserIds}
                  options={addableOptions.map((o) => ({ value: o.userId, label: memberLabel(o) }))}
                />
                <Button type="primary" onClick={() => void addMembers()} data-testid="team-add-members">
                  加入团队
                </Button>
              </Space>
            </Card>
            <List
              header={<Typography.Text strong>成员列表</Typography.Text>}
              dataSource={managing.members}
              locale={{ emptyText: '暂无成员' }}
              renderItem={(m) => (
                <List.Item
                  actions={
                    m.userId === managing.leaderUserId
                      ? [<Tag key="leader" color="gold">负责人</Tag>]
                      : [
                          <Popconfirm
                            key="remove"
                            title="确认移出团队？"
                            onConfirm={() => void removeMember(managing, m.userId)}
                          >
                            <a style={{ color: '#cf222e' }}>移出</a>
                          </Popconfirm>,
                        ]
                  }
                >
                  <List.Item.Meta
                    title={m.realName ?? m.account.loginName ?? m.account.email ?? m.userId}
                    description={'学校：' + (m.schoolName ?? '-') + ' · 角色：' + m.role}
                  />
                </List.Item>
              )}
            />
          </Space>
        )}
      </Drawer>
    </Card>
  );
}
