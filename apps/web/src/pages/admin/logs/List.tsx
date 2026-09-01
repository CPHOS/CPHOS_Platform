import { useQuery } from '@tanstack/react-query';
import {
  AUDIT_ACTIONS,
  AUDIT_ACTION_LABELS,
  type AuditActionValue,
  type AuditLogDto,
} from '@cphos/shared';
import { Card, Input, Select, Space, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useState } from 'react';
import { adminAuditApi } from '../../../api/admin';

const ACTION_COLORS: Record<string, string> = {
  APPROVE: 'success',
  REJECT: 'error',
  BIND_LEGACY: 'purple',
  REQUEST_MATERIAL: 'warning',
  CREATE_ACCOUNT: 'blue',
  ROLE_CHANGE: 'geekblue',
  STATUS_CHANGE: 'volcano',
  MEMBER_UPDATE: 'cyan',
  TEAM_CREATE: 'green',
  TEAM_UPDATE: 'lime',
  TEAM_DELETE: 'magenta',
};

function actionLabel(action: string): string {
  return AUDIT_ACTION_LABELS[action as AuditActionValue] ?? action;
}

/** 管理员：审计日志（全操作留痕，支持动作/关键字筛选） */
export function AuditLogsList() {
  const [action, setAction] = useState<AuditActionValue | undefined>();
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'audit', 'logs', action, q, page, pageSize],
    queryFn: () => adminAuditApi.logs({ action, q: q || undefined, page, pageSize }),
  });

  const columns: ColumnsType<AuditLogDto> = [
    {
      title: '时间',
      dataIndex: 'createdAt',
      render: (v: string) => new Date(v).toLocaleString(),
      width: 170,
    },
    {
      title: '动作',
      dataIndex: 'action',
      render: (v: string) => <Tag color={ACTION_COLORS[v] ?? 'default'}>{actionLabel(v)}</Tag>,
      width: 140,
    },
    { title: '操作人', dataIndex: 'operatorName', render: (v: string | null) => v ?? '-', width: 120, ellipsis: true },
    {
      title: '关联',
      render: (_, r) => (
        <Space direction="vertical" size={0}>
          {r.targetUserId && <span>账号 #{r.targetUserId}</span>}
          {r.applicationId && <span>申请 #{r.applicationId}</span>}
          {r.legacyMemberId && <span>旧账号 #{r.legacyMemberId}</span>}
          {!r.targetUserId && !r.applicationId && !r.legacyMemberId && '-'}
        </Space>
      ),
      width: 140,
      responsive: ['md'],
    },
    { title: '备注', dataIndex: 'remark', render: (v: string | null) => v ?? '-', ellipsis: true },
  ];

  return (
    <Card>
      <Space style={{ marginBottom: 16 }} wrap>
        <Select
          allowClear
          showSearch
          placeholder="动作类型"
          style={{ width: 180 }}
          value={action}
          onChange={(v) => {
            setAction(v);
            setPage(1);
          }}
          options={AUDIT_ACTIONS.map((a) => ({ value: a, label: AUDIT_ACTION_LABELS[a] }))}
        />
        <Input.Search
          allowClear
          placeholder="备注 / 关联账号编号"
          style={{ width: 260, maxWidth: '100%' }}
          onSearch={(v) => {
            setQ(v);
            setPage(1);
          }}
        />
      </Space>
      <Table<AuditLogDto>
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
