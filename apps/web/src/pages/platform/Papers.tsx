import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  PAPER_STATUS_LABELS,
  type PaperDto,
  type PaperPageDto,
  type PaperQuestionDto,
} from '@cphos/shared';
import {
  App,
  Button,
  Card,
  Descriptions,
  Drawer,
  Form,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tag,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useEffect, useRef, useState } from 'react';
import { apiErrorMessage } from '../../api/http';
import { paperApi } from '../../api/papers';
import { studentApi } from '../../api/students';

function GuidedImage({ paperId, page }: { paperId: string; page: PaperPageDto }) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState(false);
  const [rows, setRows] = useState(2);
  const [cols, setCols] = useState(1);
  useEffect(() => {
    let alive = true;
    let objectUrl = '';
    setUrl('');
    setError(false);
    void paperApi
      .pageImage(paperId, page.id)
      .then((blob) => {
        if (!alive) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => {
        if (alive) setError(true);
      });
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [paperId, page.id]);
  return (
    <div>
      <div style={{ position: 'relative', border: '1px solid #eee', background: '#fafafa' }}>
        {url ? (
          <img src={url} alt={'第' + page.pageNo + '页'} style={{ width: '100%', display: 'block' }} />
        ) : (
          <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', color: error ? '#c00' : undefined }}>
            {error ? '图片加载失败' : '加载中'}
          </div>
        )}
        {Array.from({ length: rows - 1 }).map((_, index) => (
          <div
            key={'r' + index}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: ((index + 1) / rows) * 100 + '%',
              borderTop: '1px dashed rgba(255,0,0,0.65)',
            }}
          />
        ))}
        {Array.from({ length: cols - 1 }).map((_, index) => (
          <div
            key={'c' + index}
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: ((index + 1) / cols) * 100 + '%',
              borderLeft: '1px dashed rgba(255,0,0,0.65)',
            }}
          />
        ))}
      </div>
      <Space style={{ marginTop: 8 }}>
        <span>分割行</span>
        <InputNumber data-testid="guide-rows" size="small" min={1} max={10} value={rows} onChange={(v) => setRows(v ?? 1)} />
        <span>分割列</span>
        <InputNumber data-testid="guide-cols" size="small" min={1} max={6} value={cols} onChange={(v) => setCols(v ?? 1)} />
        <Tag>辅助对齐，不写入裁剪</Tag>
      </Space>
    </div>
  );
}

export function PapersPage() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selected, setSelected] = useState<PaperDto | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [createForm] = Form.useForm<{ examId: string; studentId: string }>();
  const [bindQuestion, setBindQuestion] = useState<PaperQuestionDto | null>(null);
  const [bindForm] = Form.useForm<{
    paperPageId: string;
    partIndex: number;
    useCrop?: boolean;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
  }>();
  const fileRef = useRef<HTMLInputElement | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['papers', 'mine', page, pageSize],
    queryFn: () => paperApi.listMine({ page, pageSize }),
  });
  const { data: published } = useQuery({
    queryKey: ['exams', 'published-list'],
    queryFn: paperApi.publishedExams,
  });
  const { data: students } = useQuery({
    queryKey: ['students', 'options-paper'],
    queryFn: () => studentApi.listMine({ page: 1, pageSize: 100 }),
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['papers', 'mine'] });
  };

  const openCreate = () => {
    createForm.resetFields();
    setCreateOpen(true);
  };

  const createPaper = async () => {
    const values = await createForm.validateFields().catch(() => null);
    if (!values) return;
    setSaving(true);
    try {
      const created = await paperApi.create(values);
      message.success('整卷已创建');
      setCreateOpen(false);
      setSelected(created);
      refresh();
    } catch (err) {
      message.error(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const uploadPage = async (file?: File) => {
    if (!file || !selected) return;
    const nextPage = (selected.pages[selected.pages.length - 1]?.pageNo ?? 0) + 1;
    try {
      const updated = await paperApi.uploadPage(selected.id, nextPage, file);
      setSelected(updated);
      refresh();
      message.success('已上传第 ' + nextPage + ' 页');
    } catch (err) {
      message.error(apiErrorMessage(err));
    }
  };

  const openBind = (question: PaperQuestionDto) => {
    setBindQuestion(question);
    bindForm.resetFields();
    bindForm.setFieldsValue({ partIndex: 0, useCrop: false });
  };

  const bindImage = async () => {
    if (!selected || !bindQuestion) return;
    const values = await bindForm.validateFields().catch(() => null);
    if (!values) return;
    try {
      const updated = await paperApi.bindImage(selected.id, {
        paperQuestionId: bindQuestion.id,
        paperPageId: values.paperPageId,
        partIndex: values.partIndex,
        crop: values.useCrop ? { x: values.x ?? 0, y: values.y ?? 0, width: values.width ?? 0, height: values.height ?? 0 } : undefined,
      });
      setSelected(updated);
      setBindQuestion(null);
      refresh();
      message.success('已绑定题目图片');
    } catch (err) {
      message.error(apiErrorMessage(err));
    }
  };

  const removeImage = async (question: PaperQuestionDto, imageId: string) => {
    if (!selected) return;
    const image = question.images.find((i) => i.id === imageId);
    if (!image) return;
    try {
      const updated = await paperApi.removeImage(selected.id, {
        paperQuestionId: question.id,
        paperPageId: image.paperPageId,
        partIndex: image.partIndex,
      });
      setSelected(updated);
      refresh();
    } catch (err) {
      message.error(apiErrorMessage(err));
    }
  };

  const markReady = async () => {
    if (!selected) return;
    try {
      const updated = await paperApi.setStatus(selected.id, { status: 'READY' });
      setSelected(updated);
      refresh();
      message.success('整卷已标记就绪');
    } catch (err) {
      message.error(apiErrorMessage(err));
    }
  };

  const columns: ColumnsType<PaperDto> = [
    { title: '考试', dataIndex: 'examName', ellipsis: true },
    { title: '学生', dataIndex: 'studentName', ellipsis: true },
    {
      title: '状态',
      dataIndex: 'status',
      render: (v: keyof typeof PAPER_STATUS_LABELS) => <Tag color={v === 'READY' ? 'green' : v === 'ARCHIVED' ? 'default' : 'processing'}>{PAPER_STATUS_LABELS[v]}</Tag>,
    },
    { title: '页数', render: (_, r) => r.pages.length },
    {
      title: '已绑定题目',
      render: (_, r) => r.questions.filter((q) => q.images.length > 0).length + '/' + r.questions.length,
    },
    {
      title: '操作',
      render: (_, r) => <a onClick={() => setSelected(r)}>上传/绑定</a>,
    },
  ];

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <span style={{ color: '#888' }}>整卷创建后按考试配置生成题目槽位；一题可绑定多页，多题可共用一页。</span>
        <Button type="primary" onClick={openCreate} data-testid="paper-create-button">
          新建整卷
        </Button>
      </div>
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
        title="新建整卷"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={() => void createPaper()}
        confirmLoading={saving}
        destroyOnClose
      >
        <Form form={createForm} layout="vertical">
          <Form.Item name="examId" label="考试" rules={[{ required: true, message: '请选择考试' }]}>
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="已发布考试"
              options={(published?.items ?? []).map((e) => ({ value: e.id, label: e.name }))}
            />
          </Form.Item>
          <Form.Item name="studentId" label="学生" rules={[{ required: true, message: '请选择学生' }]}>
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="本人学生"
              options={(students?.items ?? []).map((s) => ({ value: s.id, label: s.name }))}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title={'整卷：' + (selected?.studentName ?? '')}
        open={!!selected}
        onClose={() => setSelected(null)}
        width={720}
      >
        {selected && (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Descriptions size="small" column={2} bordered>
              <Descriptions.Item label="考试">{selected.examName}</Descriptions.Item>
              <Descriptions.Item label="学生">{selected.studentName}</Descriptions.Item>
              <Descriptions.Item label="状态">{PAPER_STATUS_LABELS[selected.status]}</Descriptions.Item>
              <Descriptions.Item label="页数">{selected.pages.length}</Descriptions.Item>
            </Descriptions>

            <Space wrap>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                style={{ display: 'none' }}
                data-testid="paper-page-file"
                onChange={(e) => void uploadPage(e.target.files?.[0])}
              />
              <Button type="primary" onClick={() => fileRef.current?.click()} disabled={selected.status === 'ARCHIVED'} data-testid="paper-upload-page">
                上传答题卡页
              </Button>
              <Popconfirm title="确认所有题目都已绑定并标记就绪？" onConfirm={() => void markReady()}>
                <Button disabled={selected.status !== 'UPLOADING'} data-testid="paper-mark-ready">
                  标记整卷就绪
                </Button>
              </Popconfirm>
            </Space>

            <Card size="small" title="答题卡页与对齐分割线">
              {selected.pages.length === 0 ? (
                <div style={{ color: '#999' }}>尚未上传页面</div>
              ) : (
                <Space direction="vertical" style={{ width: '100%' }}>
                  {selected.pages.map((p) => (
                    <div key={p.id}>
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>第 {p.pageNo} 页</div>
                      <GuidedImage paperId={selected.id} page={p} />
                    </div>
                  ))}
                </Space>
              )}
            </Card>

            <Card size="small" title="题目槽位与图片绑定">
              <Space direction="vertical" style={{ width: '100%' }}>
                {selected.questions.map((q) => (
                  <Card key={q.id} size="small">
                    <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                      <span>
                        槽位 {q.slot}
                        {q.questionLabel ? '（' + q.questionLabel + '）' : ''} · 满分 {q.maxScore}
                      </span>
                      <Button size="small" onClick={() => openBind(q)} disabled={selected.status === 'ARCHIVED'} data-testid={'paper-bind-' + q.slot}>
                        绑定图片
                      </Button>
                    </Space>
                    <Space direction="vertical" style={{ marginTop: 8 }}>
                      {q.images.length === 0 ? (
                        <span style={{ color: '#999' }}>未绑定</span>
                      ) : (
                        q.images.map((image) => (
                          <Space key={image.id}>
                            <Tag>
                              第{image.pageNo}页 / 片段{image.partIndex}
                              {image.crop ? ' / 已裁剪' : ''}
                            </Tag>
                            <a style={{ color: '#cf222e' }} onClick={() => void removeImage(q, image.id)}>
                              移除
                            </a>
                          </Space>
                        ))
                      )}
                    </Space>
                  </Card>
                ))}
              </Space>
            </Card>
          </Space>
        )}
      </Drawer>

      <Modal
        title="绑定题目图片"
        open={!!bindQuestion}
        onCancel={() => setBindQuestion(null)}
        onOk={() => void bindImage()}
        destroyOnClose
      >
        <Form form={bindForm} layout="vertical">
          <Form.Item name="paperPageId" label="答题卡页" rules={[{ required: true, message: '请选择页面' }]}>
            <Select
              showSearch
              optionFilterProp="label"
              options={(selected?.pages ?? []).map((p) => ({ value: p.id, label: '第 ' + p.pageNo + ' 页' }))}
            />
          </Form.Item>
          <Form.Item name="partIndex" label="片段序号" rules={[{ required: true, message: '请输入片段序号' }]}>
            <InputNumber min={0} max={100} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="useCrop" label="使用坐标裁剪" valuePropName="checked">
            <Switch checkedChildren="是" unCheckedChildren="否" />
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.useCrop !== cur.useCrop}>
            {() =>
              bindForm.getFieldValue('useCrop') ? (
                <Space wrap>
                  <Form.Item name="x" label="x"><InputNumber min={0} /></Form.Item>
                  <Form.Item name="y" label="y"><InputNumber min={0} /></Form.Item>
                  <Form.Item name="width" label="宽"><InputNumber min={1} /></Form.Item>
                  <Form.Item name="height" label="高"><InputNumber min={1} /></Form.Item>
                </Space>
              ) : null
            }
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
