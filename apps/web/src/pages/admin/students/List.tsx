import { useQuery } from '@tanstack/react-query';
import type { StudentDto } from '@cphos/shared';
import { Card, Input, Select, Space, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useState } from 'react';
import { dictApi } from '../../../api/dict';
import { adminStudentsApi } from '../../../api/students';

/** 管理后台：全校学生名册只读查询 */
export function AdminStudentsPage() {
  const [q, setQ] = useState('');
  const [schoolId, setSchoolId] = useState<string | undefined>();
  const [gradeId, setGradeId] = useState<string | undefined>();
  const [prizeId, setPrizeId] = useState<string | undefined>();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'students', q, schoolId, gradeId, prizeId, page, pageSize],
    queryFn: () =>
      adminStudentsApi.list({
        q: q || undefined,
        schoolId,
        gradeId,
        prizeId,
        page,
        pageSize,
      }),
  });

  const { data: dict } = useQuery({ queryKey: ['dict', 'all'], queryFn: dictApi.all });

  const columns: ColumnsType<StudentDto> = [
    { title: '姓名', dataIndex: 'name', ellipsis: true },
    { title: '学校', dataIndex: 'schoolName', render: (v: string | null) => v ?? '-', responsive: ['md'], ellipsis: true },
    { title: '年级', dataIndex: 'gradeName', render: (v: string | null) => v ?? '-', responsive: ['md'] },
    { title: '奖项', dataIndex: 'prizeName', render: (v: string | null) => v ?? '-', responsive: ['lg'] },
    { title: '归属教练', dataIndex: 'ownerName', render: (v: string | null) => v ?? '-', responsive: ['sm'], ellipsis: true },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      render: (v: string) => new Date(v).toLocaleString(),
      responsive: ['lg'],
    },
  ];

  return (
    <Card>
      <Space style={{ marginBottom: 16 }} wrap>
        <Input.Search
          allowClear
          placeholder="学生 / 教练 / 学校"
          style={{ width: 220, maxWidth: '100%' }}
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
    </Card>
  );
}
