import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MARKING_TASK_STATUS_LABELS, type MarkingTaskDto, type MarkingTaskStatus } from '@cphos/shared';
import { App, Button, Card, Form, Input, InputNumber, Modal, Select, Space, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useState } from 'react';
import { tasksApi } from '../../api/allocation';
import { apiErrorMessage } from '../../api/http';
import { markingApi } from '../../api/marking';
import { AnswerImage } from '../../components/AnswerImage';

const STATUS_COLORS: Record<MarkingTaskStatus, string> = {
  PENDING: 'processing',
  COMPLETED: 'success',
  CANCELED: 'default',
};

interface GradeForm {
  score: number;
  remark?: string;
}

/** 平台用户：分配给我的双阅任务与打分 */
export function TasksPage() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<MarkingTaskStatus | undefined>();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [grading, setGrading] = useState<MarkingTaskDto | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<GradeForm>();

  const { data, isLoading } = useQuery({
    queryKey: ['tasks', 'mine', status, page, pageSize],
    queryFn: () => tasksApi.listMine({ status, page, pageSize }),
  });

  const openGrade = (task: MarkingTaskDto) => {
    setGrading(task);
    form.resetFields();
  };

  const submitGrade = async () => {
    if (!grading) return;
    const values = await form.validateFields().catch(() => null);
    if (!values) return;
    setSaving(true);
    try {
      await markingApi.gradeTask(grading.id, values);
      message.success('评分已提交');
      setGrading(null);
      void queryClient.invalidateQueries({ queryKey: ['tasks', 'mine'] });
    } catch (err) {
      message.error(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const columns: ColumnsType<MarkingTaskDto> = [
    { title: '考试', dataIndex: 'examName', ellipsis: true },
    { title: '学生', dataIndex: 'studentName', ellipsis: true },
    { title: '题目', render: (_, r) => '槽位 ' + r.slot + (r.questionLabel ? '（' + r.questionLabel + '）' : '') },
    { title: '轮次', dataIndex: 'roundNo', width: 80, render: (v: number) => '第' + v + '阅' },
    {
      title: '状态',
      dataIndex: 'status',
      render: (v: MarkingTaskStatus) => <Tag color={STATUS_COLORS[v]}>{MARKING_TASK_STATUS_LABELS[v]}</Tag>,
    },
    { title: '满分', dataIndex: 'maxScore', width: 70 },
    { title: '得分', dataIndex: 'score', width: 70, render: (v: number | null) => v ?? '-' },
    {
      title: '操作',
      width: 90,
      render: (_, r) =>
        r.status === 'PENDING' ? (
          <Button size="small" type="primary" onClick={() => openGrade(r)} data-testid={'task-grade-' + r.id}>
            打分
          </Button>
        ) : (
          '-'
        ),
    },
  ];

  return (
    <Card>
      <Space style={{ marginBottom: 16 }} wrap>
        <Select
          allowClear
          placeholder="状态"
          style={{ width: 140 }}
          value={status}
          onChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
          options={(['PENDING', 'COMPLETED', 'CANCELED'] as MarkingTaskStatus[]).map((s) => ({
            value: s,
            label: MARKING_TASK_STATUS_LABELS[s],
          }))}
        />
        <span style={{ color: '#888' }}>评阅分差超过考试配置 gap 时将自动生成仲裁任务。</span>
      </Space>
      <Table<MarkingTaskDto>
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
        title={'题目打分' + (grading ? '（满分 ' + grading.maxScore + '）' : '')}
        open={!!grading}
        onCancel={() => setGrading(null)}
        onOk={() => void submitGrade()}
        confirmLoading={saving}
        destroyOnClose
        width={760}
      >
        {grading && grading.images.length > 0 && (
          <Space wrap style={{ marginBottom: 16, maxHeight: 260, overflow: 'auto' }}>
            {grading.images.map((image) => (
              <AnswerImage
                key={image.id}
                imageKey={grading.id + ':' + image.id}
                load={() => markingApi.taskImage(grading.id, image.paperPageId)}
                pageNo={image.pageNo}
                partIndex={image.partIndex}
                crop={image.crop}
              />
            ))}
          </Space>
        )}
        <Form form={form} layout="vertical">
          <Form.Item name="score" label="得分" rules={[{ required: true, message: '请输入得分' }]}>
            <InputNumber min={0} max={grading?.maxScore ?? 10000} step={0.5} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="remark" label="备注（选填）">
            <Input.TextArea rows={3} maxLength={500} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
