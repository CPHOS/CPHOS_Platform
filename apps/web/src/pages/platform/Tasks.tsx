import { useQuery } from '@tanstack/react-query';
import { MARKING_TASK_STATUS_LABELS, type MarkingTaskDto, type MarkingTaskStatus } from '@cphos/shared';
import { Card, Select, Space, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useState } from 'react';
import { tasksApi } from '../../api/allocation';

const STATUS_COLORS: Record<MarkingTaskStatus, string> = {
  PENDING: 'processing',
  COMPLETED: 'success',
  CANCELED: 'default',
};

/** 平台用户：分配给我的双阅任务（M2-C 只展示，打分在下一块） */
export function TasksPage() {
  const [status, setStatus] = useState<MarkingTaskStatus | undefined>();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const { data, isLoading } = useQuery({
    queryKey: ['tasks', 'mine', status, page, pageSize],
    queryFn: () => tasksApi.listMine({ status, page, pageSize }),
  });

  const columns: ColumnsType<MarkingTaskDto> = [
    { title: '考试', dataIndex: 'examName', ellipsis: true },
    { title: '学生', dataIndex: 'studentName', ellipsis: true },
    {
      title: '题目',
      render: (_, r) => '槽位 ' + r.slot + (r.questionLabel ? '（' + r.questionLabel + '）' : ''),
    },
    { title: '轮次', dataIndex: 'roundNo', width: 80, render: (v: number) => '第' + v + '阅' },
    {
      title: '状态',
      dataIndex: 'status',
      render: (v: MarkingTaskStatus) => <Tag color={STATUS_COLORS[v]}>{MARKING_TASK_STATUS_LABELS[v]}</Tag>,
    },
    { title: '得分', dataIndex: 'score', width: 80, render: (v: number | null) => v ?? '-' },
    {
      title: '分配时间',
      dataIndex: 'createdAt',
      responsive: ['lg'],
      render: (v: string) => new Date(v).toLocaleString(),
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
        <span style={{ color: '#888' }}>打分与仲裁将在下一模块开放。</span>
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
    </Card>
  );
}
