import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { DictKind } from '@cphos/shared';
import {
  App,
  Button,
  Card,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tabs,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useState } from 'react';
import type { AreaDto, DictEntryDto, ManagedSchoolDto } from '@cphos/shared';
import { apiErrorMessage } from '../../../api/http';
import { adminDictApi } from '../../../api/dicts';
import { useAuthStore } from '../../../stores/auth';

/** 管理员：字典维护（学校/赛区/年级/奖项/题号） */
export function DictsPage() {
  const me = useAuthStore((s) => s.user);
  const isSuper = me?.role === 'SUPER_ADMIN';

  return (
    <Card>
      <Tabs
        items={[
          { key: 'schools', label: '学校', children: <SchoolsTab isSuper={isSuper} /> },
          { key: 'areas', label: '赛区', children: <AreasTab isSuper={isSuper} /> },
          { key: 'grades', label: '年级', children: <SimpleDictTab kind="grades" isSuper={isSuper} /> },
          { key: 'prizes', label: '奖项', children: <SimpleDictTab kind="prizes" isSuper={isSuper} /> },
          { key: 'topics', label: '题号', children: <SimpleDictTab kind="topics" isSuper={isSuper} /> },
        ]}
      />
    </Card>
  );
}

/** 通用名称编辑弹窗（新增/改名） */
function NameModal({
  title,
  open,
  initial,
  submitting,
  onSubmit,
  onCancel,
}: {
  title: string;
  open: boolean;
  initial?: string;
  submitting: boolean;
  onSubmit: (name: string) => void;
  onCancel: () => void;
}) {
  const [form] = Form.useForm<{ name: string }>();
  const ok = async () => {
    const values = await form.validateFields().catch(() => null);
    if (!values) return;
    onSubmit(values.name);
  };
  return (
    <Modal title={title} open={open} onCancel={onCancel} onOk={ok} confirmLoading={submitting} destroyOnClose>
      <Form form={form} layout="vertical" initialValues={{ name: initial }}>
        <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
          <Input maxLength={50} autoComplete="off" />
        </Form.Item>
      </Form>
    </Modal>
  );
}

function SchoolsTab({ isSuper }: { isSuper: boolean }) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [q, setQ] = useState('');
  const [areaId, setAreaId] = useState<string | undefined>();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [modal, setModal] = useState<{ mode: 'create' } | { mode: 'edit'; school: ManagedSchoolDto } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm<{ name: string; areaId: string }>();

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'dicts', 'schools', areaId, q, page, pageSize],
    queryFn: () => adminDictApi.schools({ areaId, q: q || undefined, page, pageSize }),
  });
  const { data: areas = [] } = useQuery({ queryKey: ['admin', 'dicts', 'areas'], queryFn: adminDictApi.areas });

  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['admin', 'dicts', 'schools'] });

  const openModal = (m: { mode: 'create' } | { mode: 'edit'; school: ManagedSchoolDto }) => {
    setModal(m);
    if (m.mode === 'create') form.setFieldsValue({ name: '', areaId: undefined });
    else form.setFieldsValue({ name: m.school.name, areaId: m.school.areaId });
  };

  const submit = async () => {
    const values = await form.validateFields().catch(() => null);
    if (!values || !modal) return;
    setSubmitting(true);
    try {
      if (modal.mode === 'create') {
        await adminDictApi.createSchool({ name: values.name, areaId: values.areaId });
        message.success('已新增学校');
      } else {
        await adminDictApi.updateSchool(modal.school.id, { name: values.name, areaId: values.areaId });
        message.success('已保存');
      }
      setModal(null);
      refresh();
    } catch (err) {
      message.error(apiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (s: ManagedSchoolDto) => {
    try {
      await adminDictApi.deleteSchool(s.id);
      message.success(`已删除 ${s.name}`);
      refresh();
    } catch (err) {
      message.error(apiErrorMessage(err));
    }
  };

  const columns: ColumnsType<ManagedSchoolDto> = [
    { title: '学校', dataIndex: 'name', ellipsis: true },
    { title: '赛区', dataIndex: 'areaName', render: (v: string | null) => v ?? '-' },
    { title: '成员数', dataIndex: 'memberCount', width: 90 },
    {
      title: '操作',
      width: 130,
      render: (_, r) => (
        <Space size="small">
          <a onClick={() => openModal({ mode: 'edit', school: r })}>改名</a>
          {isSuper && (
            <Popconfirm title={`删除学校 ${r.name}？`} onConfirm={() => remove(r)}>
              <a>删除</a>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16 }} wrap>
        <Select
          allowClear
          placeholder="赛区"
          style={{ width: 160 }}
          value={areaId}
          onChange={(v) => {
            setAreaId(v);
            setPage(1);
          }}
          options={areas.map((a) => ({ value: a.id, label: a.name }))}
        />
        <Input.Search
          allowClear
          placeholder="学校名称"
          style={{ width: 220, maxWidth: '100%' }}
          onSearch={(v) => {
            setQ(v);
            setPage(1);
          }}
        />
        <Button type="primary" onClick={() => openModal({ mode: 'create' })}>
          新增学校
        </Button>
      </Space>
      <Table<ManagedSchoolDto>
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
        title={modal?.mode === 'create' ? '新增学校' : '编辑学校'}
        open={!!modal}
        onCancel={() => setModal(null)}
        onOk={submit}
        confirmLoading={submitting}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="学校名称" rules={[{ required: true, message: '请输入学校名称' }]}>
            <Input maxLength={50} autoComplete="off" />
          </Form.Item>
          <Form.Item name="areaId" label="所属赛区" rules={[{ required: true, message: '请选择赛区' }]}>
            <Select showSearch optionFilterProp="label" placeholder="选择赛区" options={areas.map((a) => ({ value: a.id, label: a.name }))} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

function AreasTab({ isSuper }: { isSuper: boolean }) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [modal, setModal] = useState<{ mode: 'create' } | { mode: 'edit'; area: AreaDto } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { data: areas = [], isLoading } = useQuery({
    queryKey: ['admin', 'dicts', 'areas'],
    queryFn: adminDictApi.areas,
  });

  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['admin', 'dicts', 'areas'] });

  const submit = async (name: string) => {
    if (!modal) return;
    setSubmitting(true);
    try {
      if (modal.mode === 'create') await adminDictApi.createArea(name);
      else await adminDictApi.renameArea(modal.area.id, name);
      message.success('已保存');
      setModal(null);
      refresh();
    } catch (err) {
      message.error(apiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (a: AreaDto) => {
    try {
      await adminDictApi.deleteArea(a.id);
      message.success(`已删除 ${a.name}`);
      refresh();
    } catch (err) {
      message.error(apiErrorMessage(err));
    }
  };

  const columns: ColumnsType<AreaDto> = [
    { title: '赛区', dataIndex: 'name' },
    { title: '学校数', dataIndex: 'schoolCount', width: 90 },
    {
      title: '操作',
      width: 130,
      render: (_, r) => (
        <Space size="small">
          <a onClick={() => setModal({ mode: 'edit', area: r })}>改名</a>
          {isSuper && (
            <Popconfirm title={`删除赛区 ${r.name}？`} onConfirm={() => remove(r)}>
              <a>删除</a>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Button type="primary" onClick={() => setModal({ mode: 'create' })}>
          新增赛区
        </Button>
      </div>
      <Table<AreaDto>
        rowKey="id"
        loading={isLoading}
        columns={columns}
        dataSource={areas}
        tableLayout="fixed"
        pagination={false}
      />
      <NameModal
        title={modal?.mode === 'create' ? '新增赛区' : '修改赛区'}
        open={!!modal}
        initial={modal?.mode === 'edit' ? modal.area.name : undefined}
        submitting={submitting}
        onSubmit={submit}
        onCancel={() => setModal(null)}
      />
    </div>
  );
}

function SimpleDictTab({ kind, isSuper }: { kind: DictKind; isSuper: boolean }) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [modal, setModal] = useState<{ mode: 'create' } | { mode: 'edit'; entry: DictEntryDto } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['admin', 'dicts', kind],
    queryFn: () => adminDictApi.dicts(kind),
  });

  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['admin', 'dicts', kind] });

  const submit = async (name: string) => {
    if (!modal) return;
    setSubmitting(true);
    try {
      if (modal.mode === 'create') await adminDictApi.createDict(kind, name);
      else await adminDictApi.renameDict(kind, modal.entry.id, name);
      message.success('已保存');
      setModal(null);
      refresh();
    } catch (err) {
      message.error(apiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (e: DictEntryDto) => {
    try {
      await adminDictApi.deleteDict(kind, e.id);
      message.success(`已删除 ${e.name}`);
      refresh();
    } catch (err) {
      message.error(apiErrorMessage(err));
    }
  };

  const columns: ColumnsType<DictEntryDto> = [
    { title: '名称', dataIndex: 'name' },
    {
      title: '操作',
      width: 130,
      render: (_, r) => (
        <Space size="small">
          <a onClick={() => setModal({ mode: 'edit', entry: r })}>改名</a>
          {isSuper && (
            <Popconfirm title={`删除 ${r.name}？`} onConfirm={() => remove(r)}>
              <a>删除</a>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Button type="primary" onClick={() => setModal({ mode: 'create' })}>
          新增
        </Button>
      </div>
      <Table<DictEntryDto>
        rowKey="id"
        loading={isLoading}
        columns={columns}
        dataSource={entries}
        tableLayout="fixed"
        pagination={false}
      />
      <NameModal
        title={modal?.mode === 'create' ? '新增' : '改名'}
        open={!!modal}
        initial={modal?.mode === 'edit' ? modal.entry.name : undefined}
        submitting={submitting}
        onSubmit={submit}
        onCancel={() => setModal(null)}
      />
    </div>
  );
}
