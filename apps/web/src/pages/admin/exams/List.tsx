import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  EXAM_STATUSES,
  EXAM_STATUS_LABELS,
  type ExamDto,
  type ExamStatus,
  type UpsertExamConfigInput,
} from '@cphos/shared';
import {
  App,
  Button,
  Card,
  Descriptions,
  Drawer,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useState } from 'react';
import { adminAllocationApi } from '../../../api/allocation';
import { adminExamsApi } from '../../../api/exams';
import { rankingApi } from '../../../api/ranking';
import { apiErrorMessage } from '../../../api/http';

interface ExamForm {
  name: string;
  description?: string;
}

interface ConfigForm {
  slotCount: number;
  defaultPoint: number;
  gap: number;
  titleMapping?: { slot: number; title: string; questionLabel?: string; point?: number }[];
}

const STATUS_COLORS: Record<ExamStatus, string> = {
  DRAFT: 'default',
  PUBLISHED: 'processing',
  CLOSED: 'success',
  ARCHIVED: 'warning',
};

/** 管理后台：考试批次 + 考试级配置 + 状态流转 */
export function ExamsAdminPage() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<ExamStatus | undefined>();
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [examForm] = Form.useForm<ExamForm>();
  const [configForm] = Form.useForm<ConfigForm>();
  const [editing, setEditing] = useState<ExamDto | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [configuring, setConfiguring] = useState<ExamDto | null>(null);
  const [configSaving, setConfigSaving] = useState(false);
  const [allocating, setAllocating] = useState<ExamDto | null>(null);
  const [allocatingNow, setAllocatingNow] = useState(false);
  const [rankingExam, setRankingExam] = useState<ExamDto | null>(null);
  const [exporting, setExporting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'exams', status, q, page, pageSize],
    queryFn: () => adminExamsApi.list({ status, q: q || undefined, page, pageSize }),
  });
  const { data: allocPreview, refetch: refetchPreview } = useQuery({
    queryKey: ['admin', 'allocation', 'preview', allocating?.id],
    queryFn: () => adminAllocationApi.preview(allocating!.id),
    enabled: !!allocating,
  });
  const { data: allocBatches, refetch: refetchBatches } = useQuery({
    queryKey: ['admin', 'allocation', 'batches', allocating?.id],
    queryFn: () => adminAllocationApi.batches(allocating!.id),
    enabled: !!allocating,
  });
  const { data: ranking } = useQuery({
    queryKey: ['admin', 'ranking', rankingExam?.id],
    queryFn: () => rankingApi.get(rankingExam!.id),
    enabled: !!rankingExam,
  });

  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['admin', 'exams'] });

  const openCreate = () => {
    setEditing(null);
    examForm.resetFields();
    setFormOpen(true);
  };

  const openEdit = (exam: ExamDto) => {
    setEditing(exam);
    examForm.setFieldsValue({ name: exam.name, description: exam.description ?? undefined });
    setFormOpen(true);
  };

  const saveExam = async () => {
    const values = await examForm.validateFields().catch(() => null);
    if (!values) return;
    setSaving(true);
    try {
      if (editing) {
        await adminExamsApi.update(editing.id, {
          name: values.name,
          description: values.description?.trim() ? values.description : null,
        });
        message.success('考试已更新');
      } else {
        await adminExamsApi.create({ name: values.name, description: values.description });
        message.success('考试已创建');
      }
      setFormOpen(false);
      refresh();
    } catch (err) {
      message.error(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const openConfig = (exam: ExamDto) => {
    setConfiguring(exam);
    configForm.setFieldsValue({
      slotCount: exam.config?.slotCount ?? 8,
      defaultPoint: exam.config?.defaultPoint ?? 0,
      gap: exam.config?.gap ?? 10,
      titleMapping: exam.config?.titleMapping ?? [],
    });
  };

  const saveConfig = async () => {
    if (!configuring) return;
    const values = await configForm.validateFields().catch(() => null);
    if (!values) return;
    setConfigSaving(true);
    try {
      const input: UpsertExamConfigInput = {
        slotCount: values.slotCount,
        defaultPoint: values.defaultPoint,
        gap: values.gap,
        titleMapping: values.titleMapping?.filter((x) => x && x.title) ?? [],
      };
      await adminExamsApi.upsertConfig(configuring.id, input);
      message.success('考试配置已保存');
      setConfiguring(null);
      refresh();
    } catch (err) {
      message.error(apiErrorMessage(err));
    } finally {
      setConfigSaving(false);
    }
  };

  const runAllocation = async () => {
    if (!allocating) return;
    setAllocatingNow(true);
    try {
      await adminAllocationApi.allocate(allocating.id, {});
      message.success('分配批次已创建');
      refetchPreview();
      refetchBatches();
      refresh();
    } catch (err) {
      message.error(apiErrorMessage(err));
    } finally {
      setAllocatingNow(false);
    }
  };

  const revokeAllocation = async (batchId: string) => {
    try {
      await adminAllocationApi.revoke(batchId);
      message.success('分配批次已撤销');
      refetchPreview();
      refetchBatches();
    } catch (err) {
      message.error(apiErrorMessage(err));
    }
  };


  const openRanking = (exam: ExamDto) => {
    setRankingExam(exam);
  };

  const exportRanking = async (format: 'csv' | 'xlsx') => {
    if (!rankingExam) return;
    setExporting(true);
    try {
      const file = await rankingApi.export(rankingExam.id, format);
      const url = URL.createObjectURL(file.blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      message.error(apiErrorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  const doAction = async (exam: ExamDto, action: 'publish' | 'close' | 'archive' | 'remove') => {
    try {
      if (action === 'publish') await adminExamsApi.publish(exam.id);
      if (action === 'close') await adminExamsApi.close(exam.id);
      if (action === 'archive') await adminExamsApi.archive(exam.id);
      if (action === 'remove') await adminExamsApi.remove(exam.id);
      message.success('操作成功');
      refresh();
    } catch (err) {
      message.error(apiErrorMessage(err));
    }
  };

  const columns: ColumnsType<ExamDto> = [
    { title: '考试名称', dataIndex: 'name', ellipsis: true },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (v: ExamStatus) => <Tag color={STATUS_COLORS[v]}>{EXAM_STATUS_LABELS[v]}</Tag>,
    },
    {
      title: '配置',
      width: 220,
      responsive: ['md'],
      render: (_, r) =>
        r.config
          ? '槽位 ' + r.config.slotCount + ' · 分差 ' + r.config.gap
          : '未配置',
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      responsive: ['lg'],
      render: (v: string) => new Date(v).toLocaleString(),
    },
    {
      title: '操作',
      width: 260,
      render: (_, r) => (
        <Space size="small" wrap>
          {r.status === 'DRAFT' && <a onClick={() => openEdit(r)}>编辑</a>}
          {r.status === 'DRAFT' && <a onClick={() => openConfig(r)}>配置</a>}
          {r.status === 'PUBLISHED' && <a onClick={() => setAllocating(r)}>分配</a>}
          <a onClick={() => openRanking(r)}>排名</a>
          {r.status === 'DRAFT' && (
            <Popconfirm title="发布后教练即可报名，确认发布？" onConfirm={() => void doAction(r, 'publish')}>
              <a>发布</a>
            </Popconfirm>
          )}
          {r.status === 'PUBLISHED' && (
            <Popconfirm title="确认结束该考试？" onConfirm={() => void doAction(r, 'close')}>
              <a>结束</a>
            </Popconfirm>
          )}
          {r.status === 'CLOSED' && (
            <Popconfirm title="确认归档该考试？" onConfirm={() => void doAction(r, 'archive')}>
              <a>归档</a>
            </Popconfirm>
          )}
          {r.status === 'DRAFT' && (
            <Popconfirm title="确认删除草稿考试？" onConfirm={() => void doAction(r, 'remove')}>
              <a style={{ color: '#cf222e' }}>删除</a>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <Space wrap>
          <Select
            allowClear
            placeholder="状态"
            style={{ width: 140 }}
            value={status}
            onChange={(v) => {
              setStatus(v);
              setPage(1);
            }}
            options={EXAM_STATUSES.map((s) => ({ value: s, label: EXAM_STATUS_LABELS[s] }))}
          />
          <Input.Search
            allowClear
            placeholder="考试名称"
            style={{ width: 240, maxWidth: '100%' }}
            onSearch={(v) => {
              setQ(v);
              setPage(1);
            }}
          />
        </Space>
        <Button type="primary" onClick={openCreate} data-testid="exam-create-button">
          新建考试
        </Button>
      </div>

      <Table<ExamDto>
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
        title={editing ? '编辑考试' : '新建考试'}
        open={formOpen}
        onCancel={() => setFormOpen(false)}
        onOk={() => void saveExam()}
        confirmLoading={saving}
        destroyOnClose
        afterClose={() => examForm.resetFields()}
      >
        <Form<ExamForm> form={examForm} layout="vertical">
          <Form.Item name="name" label="考试名称" rules={[{ required: true, message: '请输入考试名称' }]}>
            <Input maxLength={100} data-testid="exam-name" />
          </Form.Item>
          <Form.Item name="description" label="说明（选填）">
            <Input.TextArea rows={3} maxLength={500} />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title={'考试配置：' + (configuring?.name ?? '')}
        open={!!configuring}
        onClose={() => setConfiguring(null)}
        width={520}
        extra={
          <Button type="primary" loading={configSaving} onClick={() => void saveConfig()}>
            保存配置
          </Button>
        }
      >
        <Form<ConfigForm> form={configForm} layout="vertical">
          <Space size="large" wrap>
            <Form.Item name="slotCount" label="槽位/题目总数" rules={[{ required: true }]}>
              <InputNumber min={1} max={30} />
            </Form.Item>
            <Form.Item name="defaultPoint" label="默认每题满分" rules={[{ required: true }]}>
              <InputNumber min={0} max={10000} step={0.5} />
            </Form.Item>
            <Form.Item name="gap" label="仲裁分差阈值" rules={[{ required: true }]}>
              <InputNumber min={0} max={10000} step={0.5} />
            </Form.Item>
          </Space>

          <Descriptions size="small" column={1} style={{ marginBottom: 12 }}>
            <Descriptions.Item label="通用槽位规则">
              本场考试统一按 1-{configForm.getFieldValue('slotCount') || 0}
              号槽位管理；如需区分理论/实验，请分别创建两场考试发布。
            </Descriptions.Item>
          </Descriptions>

          <Form.List name="titleMapping">
            {(fields, { add, remove }) => (
              <Space direction="vertical" style={{ width: '100%' }}>
                {fields.map((field) => (
                  <Space key={field.key} align="baseline" wrap>
                    <Form.Item name={[field.name, 'slot']} rules={[{ required: true, message: '槽位' }]}>
                      <InputNumber min={1} max={30} placeholder="槽位" />
                    </Form.Item>
                    <Form.Item name={[field.name, 'title']} rules={[{ required: true, message: '标题' }]}>
                      <Input placeholder="页面标题" style={{ width: 180 }} />
                    </Form.Item>
                    <Form.Item name={[field.name, 'questionLabel']}>
                      <Input placeholder="题号标签（选填）" style={{ width: 140 }} />
                    </Form.Item>
                    <Form.Item name={[field.name, 'point']}>
                      <InputNumber min={0} max={10000} step={0.5} placeholder="题分" style={{ width: 100 }} />
                    </Form.Item>
                    <a style={{ color: '#cf222e' }} onClick={() => remove(field.name)}>
                      删除
                    </a>
                  </Space>
                ))}
                <Button type="dashed" onClick={() => add({ slot: fields.length + 1, title: '' })} block>
                  + 添加槽位标题
                </Button>
              </Space>
            )}
          </Form.List>
        </Form>
      </Drawer>

      <Drawer
        title={'考试分配：' + (allocating?.name ?? '')}
        open={!!allocating}
        onClose={() => setAllocating(null)}
        width={680}
        extra={
          <Button
            type="primary"
            loading={allocatingNow}
            disabled={!allocPreview || allocPreview.questionCount === 0 || allocPreview.unassignedSlots.length > 0}
            onClick={() => void runAllocation()}
          >
            生成均衡分配
          </Button>
        }
      >
        {allocPreview && (
          <Card size="small" title="均衡预览" style={{ marginBottom: 16 }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <span>
                就绪整卷 {allocPreview.readyPaperCount} 套 · 题目 {allocPreview.questionCount} 道 · 双阅任务 {allocPreview.taskCount} 个
              </span>
              {allocPreview.unassignedSlots.length > 0 && (
                <span style={{ color: '#cf222e' }}>
                  以下槽位没有可用阅卷成员：{allocPreview.unassignedSlots.join('、')}
                </span>
              )}
              <Table
                rowKey="slot"
                size="small"
                pagination={false}
                dataSource={allocPreview.slots}
                columns={[
                  { title: '槽位', dataIndex: 'slot' },
                  { title: '题数', dataIndex: 'questionCount' },
                  { title: '双阅任务', dataIndex: 'taskCount' },
                  { title: '阅卷人数', dataIndex: 'examinerCount' },
                  { title: '最少/人', dataIndex: 'minTasks' },
                  { title: '最多/人', dataIndex: 'maxTasks' },
                ]}
              />
            </Space>
          </Card>
        )}

        <Card size="small" title="历史分配批次">
          <Table
            rowKey="id"
            size="small"
            pagination={false}
            dataSource={allocBatches?.items ?? []}
            columns={[
              {
                title: '状态',
                dataIndex: 'status',
                render: (v: string) => <Tag color={v === 'ACTIVE' ? 'green' : 'default'}>{v === 'ACTIVE' ? '生效中' : '已撤销'}</Tag>,
              },
              { title: '任务数', dataIndex: 'totalTasks' },
              { title: '创建时间', dataIndex: 'createdAt', render: (v: string) => new Date(v).toLocaleString() },
              {
                title: '操作',
                render: (_, r: { id: string; status: string }) =>
                  r.status === 'ACTIVE' ? (
                    <Popconfirm title="撤销后未完成任务将取消，确认？" onConfirm={() => void revokeAllocation(r.id)}>
                      <a style={{ color: '#cf222e' }}>撤销</a>
                    </Popconfirm>
                  ) : (
                    '-'
                  ),
              },
            ]}
          />
        </Card>
      </Drawer>

      <Drawer
        title={'成绩排名：' + (rankingExam?.name ?? '')}
        open={!!rankingExam}
        onClose={() => setRankingExam(null)}
        width={680}
        extra={
          <Space>
            <Button loading={exporting} onClick={() => void exportRanking('csv')}>
              导出 CSV
            </Button>
            <Button type="primary" loading={exporting} onClick={() => void exportRanking('xlsx')}>
              导出 Excel
            </Button>
          </Space>
        }
      >
        {ranking && (
          <Space direction="vertical" style={{ width: '100%' }}>
            <span>
              已定稿 {ranking.total} 人 · 分段位置：{ranking.segmentPositions.join(' / ')}
            </span>
            <Table
              rowKey="paperId"
              size="small"
              pagination={false}
              dataSource={ranking.entries}
              columns={[
                { title: '排名', dataIndex: 'rank', width: 70 },
                {
                  title: '分段',
                  dataIndex: 'segmentLabel',
                  width: 80,
                  render: (v: string | null) => (v ? <Tag color="gold">{v}</Tag> : '-'),
                },
                { title: '姓名', dataIndex: 'studentName', ellipsis: true },
                { title: '学校', dataIndex: 'schoolName', render: (v: string | null) => v ?? '-', ellipsis: true },
                { title: '教练', dataIndex: 'ownerName', render: (v: string | null) => v ?? '-', ellipsis: true },
                { title: '总分', dataIndex: 'score', width: 90 },
              ]}
            />
          </Space>
        )}
      </Drawer>

    </Card>
  );
}
