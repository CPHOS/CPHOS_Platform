import { useQuery } from '@tanstack/react-query';
import { AUDIT_STATUS_LABELS, type AuditStatus } from '@cphos/shared';
import { Card, Input, Select, Space, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminAuditApi } from '../../../api/admin';
import type { AuditApplicationDto } from '@cphos/shared';

const STATUS_COLORS: Record<AuditStatus, string> = {
  PENDING: 'processing',
  APPROVED: 'success',
  REJECTED: 'error',
};

/** 管理员审核工作台：申请列表 + 状态/关键字筛选 */
export function AuditList() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<AuditStatus | undefined>();
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'audit', 'applications', status, q, page, pageSize],
    queryFn: () => adminAuditApi.list({ status, q: q || undefined, page, pageSize }),
  });

  const columns: ColumnsType<AuditApplicationDto> = [
    { title: '姓名', dataIndex: 'realName', ellipsis: true },
    { title: '微信昵称', dataIndex: 'wechatNickname', responsive: ['md'], ellipsis: true },
    { title: '学校', dataIndex: 'schoolName', render: (v: string | null) => v ?? '-', responsive: ['md'], ellipsis: true },
    { title: '联系方式', dataIndex: 'contact', render: (v: string | null) => v ?? '-', responsive: ['lg'] },
    { title: '邮箱', render: (_, r) => r.user.email ?? '-', responsive: ['lg'], ellipsis: true },
    {
      title: '认领',
      dataIndex: 'claimLegacy',
      render: (v: boolean) => (v ? <Tag color="purple">老用户</Tag> : '-'),
      responsive: ['md'],
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (v: AuditStatus) => <Tag color={STATUS_COLORS[v]}>{AUDIT_STATUS_LABELS[v]}</Tag>,
    },
    {
      title: '提交时间',
      dataIndex: 'createdAt',
      render: (v: string) => new Date(v).toLocaleString(),
      responsive: ['sm'],
    },
    {
      title: '操作',
      render: (_, r) => (
        <a onClick={() => navigate(`/admin/audit/${r.id}`)}>查看</a>
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
          options={(['PENDING', 'APPROVED', 'REJECTED'] as const).map((s) => ({
            value: s,
            label: AUDIT_STATUS_LABELS[s],
          }))}
        />
        <Input.Search
          allowClear
          placeholder="姓名 / 昵称 / 联系方式 / 邮箱"
          style={{ width: 280, maxWidth: '100%' }}
          onSearch={(v) => {
            setQ(v);
            setPage(1);
          }}
        />
      </Space>
      <Table<AuditApplicationDto>
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
    </Card>
  );
}
