import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { StudentDto } from '@cphos/shared';
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
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useState } from 'react';
import { dictApi } from '../../api/dict';
import { apiErrorMessage } from '../../api/http';
import { studentApi } from '../../api/students';
import { QueryError } from '../../components/QueryError';
import { useAuthStore } from '../../stores/auth';

interface StudentForm {
  name: string;
  schoolId?: string;
  gradeId?: string;
  prizeId?: string;
}

/** 平台端：教练/个人参赛者的学生名册（全局复用，不绑定单场考试） */
export function StudentsPage() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [q, setQ] = useState('');
  const [schoolId, setSchoolId] = useState<string | undefined>();
  const [gradeId, setGradeId] = useState<string | undefined>();
  const [prizeId, setPrizeId] = useState<string | undefined>();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [editing, setEditing] = useState<StudentDto | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<StudentForm>();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['students', 'mine', q, schoolId, gradeId, prizeId, page, pageSize],
    queryFn: () =>
      studentApi.listMine({
        q: q || undefined,
        schoolId,
        gradeId,
        prizeId,
        page,
        pageSize,
      }),
  });

  const { data: dict } = useQuery({ queryKey: ['dict', 'all'], queryFn: dictApi.all });

  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['students', 'mine'] });

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    // 默认继承教练个人资料上的学校，仍可手动改选
    form.setFieldsValue({ schoolId: user?.profile?.schoolId ?? undefined });
    setFormOpen(true);
  };

  const openEdit = (student: StudentDto) => {
    setEditing(student);
    form.setFieldsValue({
      name: student.name,
      schoolId: student.schoolId ?? undefined,
      gradeId: student.gradeId ?? undefined,
      prizeId: student.prizeId ?? undefined,
    });
    setFormOpen(true);
  };

  const save = async () => {
    const values = await form.validateFields().catch(() => null);
    if (!values) return;
    setSaving(true);
    try {
      if (editing) {
        await studentApi.update(editing.id, {
          name: values.name,
          schoolId: values.schoolId ?? null,
          gradeId: values.gradeId ?? null,
          prizeId: values.prizeId ?? null,
        });
        message.success('学生信息已更新');
      } else {
        await studentApi.create(values);
        message.success('学生已新增');
      }
      setFormOpen(false);
      refresh();
    } catch (err) {
      message.error(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (student: StudentDto) => {
    try {
      await studentApi.remove(student.id);
      message.success('已移入归档');
      refresh();
    } catch (err) {
      message.error(apiErrorMessage(err));
    }
  };

  const columns: ColumnsType<StudentDto> = [
    { title: '姓名', dataIndex: 'name', ellipsis: true },
    { title: '学校', dataIndex: 'schoolName', render: (v: string | null) => v ?? '-', responsive: ['md'], ellipsis: true },
    { title: '年级', dataIndex: 'gradeName', render: (v: string | null) => v ?? '-', responsive: ['md'] },
    { title: '奖项', dataIndex: 'prizeName', render: (v: string | null) => v ?? '-', responsive: ['lg'] },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      render: (v: string) => new Date(v).toLocaleString(),
      responsive: ['lg'],
    },
    {
      title: '操作',
      width: 130,
      render: (_, r) => (
        <Space size="small">
          <a onClick={() => openEdit(r)}>编辑</a>
          <Popconfirm title="确认归档该学生？" onConfirm={() => void remove(r)}>
            <a style={{ color: '#cf222e' }}>归档</a>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <Space wrap>
          <Input.Search
            allowClear
            placeholder="学生姓名"
            style={{ width: 200, maxWidth: '100%' }}
            onSearch={(v) => {
              setQ(v);
              setPage(1);
            }}
          />
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="学校"
            style={{ width: 180 }}
            value={schoolId}
            onChange={(v) => {
              setSchoolId(v);
              setPage(1);
            }}
            options={(dict?.schools ?? []).map((s) => ({ value: s.id, label: s.name }))}
          />
          <Select
            allowClear
            placeholder="年级"
            style={{ width: 120 }}
            value={gradeId}
            onChange={(v) => {
              setGradeId(v);
              setPage(1);
            }}
            options={(dict?.grades ?? []).map((g) => ({ value: g.id, label: g.name }))}
          />
          <Select
            allowClear
            placeholder="奖项"
            style={{ width: 120 }}
            value={prizeId}
            onChange={(v) => {
              setPrizeId(v);
              setPage(1);
            }}
            options={(dict?.prizes ?? []).map((p) => ({ value: p.id, label: p.name }))}
          />
        </Space>
        <Button type="primary" onClick={openCreate} data-testid="student-create-button">
          新增学生
        </Button>
      </div>

      {isError && <QueryError error={error} onRetry={() => void refetch()} />}
      <Table<StudentDto>
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
          onChange: (p, ps) => {
            setPage(p);
            setPageSize(ps);
          },
        }}
      />

      <Modal
        title={editing ? '编辑学生' : '新增学生'}
        open={formOpen}
        onCancel={() => setFormOpen(false)}
        onOk={() => void save()}
        confirmLoading={saving}
        destroyOnClose
        afterClose={() => form.resetFields()}
      >
        <Form<StudentForm> form={form} layout="vertical">
          <Form.Item name="name" label="学生姓名" rules={[{ required: true, message: '请输入学生姓名' }]}>
            <Input maxLength={50} data-testid="student-name" />
          </Form.Item>
          <Form.Item name="schoolId" label="学校">
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="选择学校（可留空）"
              options={(dict?.schools ?? []).map((s) => ({
                value: s.id,
                label: s.name + (s.areaName ? '（' + s.areaName + '）' : ''),
              }))}
            />
          </Form.Item>
          <Form.Item name="gradeId" label="年级">
            <Select allowClear placeholder="选择年级（可留空）" options={(dict?.grades ?? []).map((g) => ({ value: g.id, label: g.name }))} />
          </Form.Item>
          <Form.Item name="prizeId" label="奖项">
            <Select allowClear placeholder="选择奖项（可留空）" options={(dict?.prizes ?? []).map((p) => ({ value: p.id, label: p.name }))} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
