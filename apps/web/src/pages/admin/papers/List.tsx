import { useQuery, useQueryClient } from '@tanstack/react-query';
import { App, Button, Card, Input, InputNumber, Modal, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { PaperDto } from '@cphos/shared';
import { useState } from 'react';
import { adminPapersApi } from '../../../api/adminPapers';
import { apiErrorMessage } from '../../../api/http';
import { useAuthStore } from '../../../stores/auth';
import { QueryError } from '../../../components/QueryError';

/** 管理员：整卷查询与逐卷评阅次数调整 */
export function AdminPapersPage() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const me = useAuthStore((s) => s.user);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [editing, setEditing] = useState<PaperDto | null>(null);
  const [reviewCount, setReviewCount] = useState<number | null>(2);
  const [saving, setSaving] = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin', 'papers', q, page, pageSize],
    queryFn: () => adminPapersApi.list({ q: q || undefined, page, pageSize }),
  });

  const openEdit = (paper: PaperDto) => {
    setEditing(paper);
    setReviewCount(paper.requiredReviewCount ?? null);
  };

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await adminPapersApi.setReviewCount(editing.id, { reviewCount });
      message.success('评阅次数已更新');
      setEditing(null);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'papers'] });
    } catch (err) {
      message.error(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const columns: ColumnsType<PaperDto> = [
    { title: '考试', dataIndex: 'examName', ellipsis: true },
    { title: '学生', dataIndex: 'studentName', ellipsis: true },
    { title: '上传者', dataIndex: 'uploadedByName', render: (v: string | null) => v ?? '-', responsive: ['md'] },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (v: string) => <Tag>{v === 'READY' ? '已就绪' : v === 'ARCHIVED' ? '已归档' : '上传中'}</Tag>,
    },
    {
      title: '评阅次数',
      dataIndex: 'requiredReviewCount',
      width: 110,
      render: (v: number | null, paper) => (v === null ? '考试默认(' + paper.examReviewCount + ' 次)' : v + ' 次'),
    },
    { title: '总分', dataIndex: 'score', width: 80, render: (v: number | null) => v ?? '-' },
    {
      title: '操作',
      width: 130,
      render: (_, paper) => (
        <Button size="small" onClick={() => openEdit(paper)} disabled={!!paper.finalizedAt || paper.status === 'ARCHIVED'}>
          调整评阅
        </Button>
      ),
    },
  ];

  return (
    <Card>
      <Space style={{ marginBottom: 16 }} wrap>
        <Input.Search
          allowClear
          placeholder="考试 / 学生"
          style={{ width: 240 }}
          onSearch={(v) => {
            setQ(v);
            setPage(1);
          }}
        />
        <Typography.Text type="secondary">
          普通管理员最低 2 次；{me?.role === 'SUPER_ADMIN' ? '超级管理员可设为 1 次单评。' : '超级管理员可设置低于最低限的数值。'}
        </Typography.Text>
      </Space>
      {isError && <QueryError error={error} onRetry={() => void refetch()} />}
      <Table<PaperDto>
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
        title={'调整评阅次数：' + (editing?.studentName ?? '')}
        open={!!editing}
        onCancel={() => setEditing(null)}
        onOk={() => void save()}
        confirmLoading={saving}
        destroyOnClose
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Typography.Text type="secondary">
            留空表示继承考试配置；普通管理员必须 ≥ 2，超级管理员可设为 1。
          </Typography.Text>
          <InputNumber
            min={1}
            max={20}
            value={reviewCount ?? undefined}
            onChange={(v) => setReviewCount(v === undefined || v === null ? null : Number(v))}
            placeholder="考试默认"
            style={{ width: '100%' }}
          />
          <Button size="small" onClick={() => setReviewCount(null)}>
            恢复考试默认
          </Button>
        </Space>
      </Modal>
    </Card>
  );
}
