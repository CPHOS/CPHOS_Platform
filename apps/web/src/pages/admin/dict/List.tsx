import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { AreaDto, NameDictDto, SchoolDto } from '@cphos/shared';
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
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useState } from 'react';
import { adminDictApi } from '../../../api/dict';
import { apiErrorMessage } from '../../../api/http';

type SimpleKind = 'grade' | 'prize';

interface DictForm {
  name: string;
  areaId?: string;
}

interface ModalState {
  kind: 'area' | 'school' | SimpleKind;
  id?: string;
}

const SIMPLE_META: Record<SimpleKind, { label: string; create: (name: string) => Promise<unknown>; update: (id: string, name: string) => Promise<unknown>; remove: (id: string) => Promise<unknown> }> = {
  grade: { label: '年级', create: adminDictApi.createGrade, update: adminDictApi.updateGrade, remove: adminDictApi.deleteGrade },
  prize: { label: '奖项', create: adminDictApi.createPrize, update: adminDictApi.updatePrize, remove: adminDictApi.deletePrize },
};

/** 管理员：字典维护（赛区/学校/年级/奖项） */
export function DictAdminPage() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [modal, setModal] = useState<ModalState | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<DictForm>();

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'dict'],
    queryFn: adminDictApi.get,
  });

  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['admin', 'dict'] });

  const openCreate = (kind: ModalState['kind']) => {
    form.resetFields();
    setModal({ kind });
  };

  const openEditArea = (item: AreaDto) => {
    form.setFieldsValue({ name: item.name });
    setModal({ kind: 'area', id: item.id });
  };

  const openEditSchool = (item: SchoolDto) => {
    form.setFieldsValue({ name: item.name, areaId: item.areaId });
    setModal({ kind: 'school', id: item.id });
  };

  const openEditSimple = (kind: SimpleKind, item: NameDictDto) => {
    form.setFieldsValue({ name: item.name });
    setModal({ kind, id: item.id });
  };

  const save = async () => {
    if (!modal) return;
    const values = await form.validateFields().catch(() => null);
    if (!values) return;
    setSaving(true);
    try {
      if (modal.kind === 'area') {
        if (modal.id) await adminDictApi.updateArea(modal.id, values.name);
        else await adminDictApi.createArea(values.name);
      } else if (modal.kind === 'school') {
        if (modal.id) {
          await adminDictApi.updateSchool(modal.id, { name: values.name, areaId: values.areaId });
        } else {
          if (!values.areaId) {
            message.warning('请选择所属赛区');
            setSaving(false);
            return;
          }
          await adminDictApi.createSchool({ name: values.name, areaId: values.areaId });
        }
      } else {
        const meta = SIMPLE_META[modal.kind];
        if (modal.id) await meta.update(modal.id, values.name);
        else await meta.create(values.name);
      }
      message.success('已保存');
      setModal(null);
      refresh();
    } catch (err) {
      message.error(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const removeArea = async (id: string) => {
    try { await adminDictApi.deleteArea(id); message.success('已删除'); refresh(); }
    catch (err) { message.error(apiErrorMessage(err)); }
  };
  const removeSchool = async (id: string) => {
    try { await adminDictApi.deleteSchool(id); message.success('已删除'); refresh(); }
    catch (err) { message.error(apiErrorMessage(err)); }
  };
  const removeSimple = async (kind: SimpleKind, id: string) => {
    try { await SIMPLE_META[kind].remove(id); message.success('已删除'); refresh(); }
    catch (err) { message.error(apiErrorMessage(err)); }
  };

  const areaColumns: ColumnsType<AreaDto> = [
    { title: '赛区名称', dataIndex: 'name' },
    { title: '学校数', dataIndex: 'schoolCount', width: 100 },
    {
      title: '操作',
      width: 140,
      render: (_, r) => (
        <Space size="small">
          <a onClick={() => openEditArea(r)}>编辑</a>
          <Popconfirm title="确认删除赛区？" onConfirm={() => void removeArea(r.id)}>
            <a style={{ color: '#cf222e' }}>删除</a>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const schoolColumns: ColumnsType<SchoolDto> = [
    { title: '学校名称', dataIndex: 'name', ellipsis: true },
    { title: '所属赛区', dataIndex: 'areaName', render: (v: string | null) => v ?? '-', width: 160 },
    {
      title: '操作',
      width: 140,
      render: (_, r) => (
        <Space size="small">
          <a onClick={() => openEditSchool(r)}>编辑</a>
          <Popconfirm title="确认删除学校？" onConfirm={() => void removeSchool(r.id)}>
            <a style={{ color: '#cf222e' }}>删除</a>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const simpleColumns = (kind: SimpleKind): ColumnsType<NameDictDto> => [
    { title: '名称', dataIndex: 'name' },
    {
      title: '操作',
      width: 140,
      render: (_, r) => (
        <Space size="small">
          <a onClick={() => openEditSimple(kind, r)}>编辑</a>
          <Popconfirm title="确认删除？" onConfirm={() => void removeSimple(kind, r.id)}>
            <a style={{ color: '#cf222e' }}>删除</a>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const areaItems = [
    {
      key: 'areas',
      label: '赛区',
      children: (
        <div>
          <Button type="primary" style={{ marginBottom: 12 }} onClick={() => openCreate('area')} data-testid="dict-add-area">
            新增赛区
          </Button>
          <Table<AreaDto> rowKey="id" size="small" loading={isLoading} columns={areaColumns} dataSource={data?.areas ?? []} pagination={false} />
        </div>
      ),
    },
    {
      key: 'schools',
      label: '学校',
      children: (
        <div>
          <Button type="primary" style={{ marginBottom: 12 }} onClick={() => openCreate('school')} data-testid="dict-add-school">
            新增学校
          </Button>
          <Table<SchoolDto> rowKey="id" size="small" loading={isLoading} columns={schoolColumns} dataSource={data?.schools ?? []} pagination={false} />
        </div>
      ),
    },
    ...(['grade', 'prize'] as SimpleKind[]).map((kind) => ({
      key: kind + 's',
      label: SIMPLE_META[kind].label,
      children: (
        <div>
          <Button type="primary" style={{ marginBottom: 12 }} onClick={() => openCreate(kind)} data-testid={'dict-add-' + kind}>
            {'新增' + SIMPLE_META[kind].label}
          </Button>
          <Table<NameDictDto>
            rowKey="id"
            size="small"
            loading={isLoading}
            columns={simpleColumns(kind)}
            dataSource={data ? data[(kind + 's') as 'grades' | 'prizes'] : []}
            pagination={false}
          />
        </div>
      ),
    })),
  ];

  return (
    <Card>
      <Typography.Paragraph type="secondary">
        新系统字典由管理员独立维护，不依赖历史数据导入；删除前会检查引用关系。
      </Typography.Paragraph>
      <Tabs items={areaItems} />

      <Modal
        title={modal?.id ? '编辑字典项' : '新增字典项'}
        open={!!modal}
        onCancel={() => setModal(null)}
        onOk={() => void save()}
        confirmLoading={saving}
        destroyOnClose
        afterClose={() => form.resetFields()}
      >
        <Form<DictForm> form={form} layout="vertical">
          {modal?.kind === 'school' && (
            <Form.Item name="areaId" label="所属赛区" rules={[{ required: true, message: '请选择赛区' }]}>
              <Select
                showSearch
                optionFilterProp="label"
                placeholder="选择赛区"
                options={(data?.areas ?? []).map((a) => ({ value: a.id, label: a.name }))}
              />
            </Form.Item>
          )}
          <Form.Item
            name="name"
            label={modal?.kind === 'school' ? '学校名称' : '名称'}
            rules={[{ required: true, message: '请输入名称' }]}
          >
            <Input maxLength={100} data-testid="dict-name" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
