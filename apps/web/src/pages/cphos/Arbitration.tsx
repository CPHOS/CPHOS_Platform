import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ARBITRATION_STATUS_LABELS,
  type ArbitrationDto,
  type ArbitrationStatus,
} from '@cphos/shared';
import { App, Button, Card, Form, Input, InputNumber, Modal, Select, Space, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useState } from 'react';
import { arbitrationApi } from '../../api/marking';
import { apiErrorMessage } from '../../api/http';
import { AnswerImage } from '../../components/AnswerImage';
import { useAuthStore } from '../../stores/auth';
import { QueryError } from '../../components/QueryError';

const STATUS_COLORS: Record<ArbitrationStatus, string> = {
  PENDING: 'processing',
  CLAIMED: 'warning',
  COMPLETED: 'success',
  CANCELED: 'default',
};

interface GradeForm {
  score: number;
  remark?: string;
}

export function ArbitrationPage() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const me = useAuthStore((s) => s.user);
  const [status, setStatus] = useState<ArbitrationStatus | undefined>('PENDING');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [grading, setGrading] = useState<ArbitrationDto | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<GradeForm>();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['arbitration', status, page, pageSize],
    queryFn: () => arbitrationApi.list({ status, page, pageSize }),
  });

  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['arbitration'] });

  const claim = async (task: ArbitrationDto) => {
    try {
      await arbitrationApi.claim(task.id);
      message.success('已认领');
      refresh();
    } catch (err) {
      message.error(apiErrorMessage(err));
    }
  };

  const submitGrade = async () => {
    if (!grading) return;
    const values = await form.validateFields().catch(() => null);
    if (!values) return;
    setSaving(true);
    try {
      await arbitrationApi.grade(grading.id, values);
      message.success('仲裁分已提交');
      setGrading(null);
      refresh();
    } catch (err) {
      message.error(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const columns: ColumnsType<ArbitrationDto> = [
    { title: '考试', dataIndex: 'examName', ellipsis: true },
    { title: '学生', dataIndex: 'studentName', ellipsis: true },
    { title: '题目', render: (_, r) => '槽位 ' + r.slot + (r.questionLabel ? '（' + r.questionLabel + '）' : '') },
    {
      title: '各阅分',
      render: (_, r) => r.roundScores.map((score) => score ?? '-').join(' / '),
      responsive: ['md'],
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (v: ArbitrationStatus) => <Tag color={STATUS_COLORS[v]}>{ARBITRATION_STATUS_LABELS[v]}</Tag>,
    },
    { title: '仲裁人', dataIndex: 'claimedByName', render: (v: string | null) => v ?? '-', responsive: ['md'] },
    { title: '仲裁分', dataIndex: 'score', width: 80, render: (v: number | null) => v ?? '-' },
    {
      title: '操作',
      width: 140,
      render: (_, r) =>
        r.status === 'COMPLETED' || r.status === 'CANCELED' ? (
          '-'
        ) : (
          <Space size="small">
            {r.status === 'PENDING' && (
              <Button size="small" onClick={() => void claim(r)}>
                认领
              </Button>
            )}
            {!r.claimedById || r.claimedById === me?.id ? (
              <Button size="small" type="primary" onClick={() => { form.resetFields(); setGrading(r); }}>
                打分
              </Button>
            ) : null}
          </Space>
        ),
    },
  ];

  return (
    <Card>
      <Space style={{ marginBottom: 16 }} wrap>
        <Select
          allowClear
          showSearch
          optionFilterProp="label"
          placeholder="状态"
          style={{ width: 140 }}
          value={status}
          onChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
          options={(['PENDING', 'CLAIMED', 'COMPLETED', 'CANCELED'] as ArbitrationStatus[]).map((s) => ({
            value: s,
            label: ARBITRATION_STATUS_LABELS[s],
          }))}
        />
        <span style={{ color: '#888' }}>CPHOS 成员/管理员/BOT 可认领；完成仲裁后写入最终题分并汇总总分。</span>
      </Space>
      {isError && <QueryError error={error} onRetry={() => void refetch()} />}
      <Table<ArbitrationDto>
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
        title={'仲裁打分' + (grading ? '（满分 ' + grading.maxScore + '）' : '')}
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
                load={() => arbitrationApi.image(grading.id, image.id)}
                pageNo={image.pageNo}
                partIndex={image.partIndex}
                crop={image.crop}
              />
            ))}
          </Space>
        )}
        <Form form={form} layout="vertical">
          <Form.Item name="score" label="仲裁分" rules={[{ required: true, message: '请输入仲裁分' }]}>
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
