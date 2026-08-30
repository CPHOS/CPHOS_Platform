import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AUDIT_STATUS_LABELS,
  type AuditStatus,
  type LegacyMemberCandidateDto,
  type ReviewDecisionInput,
} from '@cphos/shared';
import {
  App,
  Button,
  Card,
  Descriptions,
  Empty,
  Form,
  Input,
  InputNumber,
  List,
  Modal,
  Space,
  Tag,
  Typography,
} from 'antd';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { adminAuditApi } from '../../../api/admin';
import { apiErrorMessage } from '../../../api/http';

const STATUS_COLORS: Record<AuditStatus, string> = {
  PENDING: 'processing',
  APPROVED: 'success',
  REJECTED: 'error',
};

const ROLE_TYPE_LABELS: Record<number, string> = { 1: '负责人', 2: '仲裁成员（旧）', 3: '附属教练' };

interface ApproveForm {
  defaultSlot?: number;
  uploadLimit?: number;
}

/** 管理员审核详情：资料 + 认领候选 + 审核决策 */
export function AuditDetail() {
  const { message } = App.useApp();
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [rejectOpen, setRejectOpen] = useState(false);
  const [materialOpen, setMaterialOpen] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [approveForm] = Form.useForm<ApproveForm>();

  const { data: app, isLoading } = useQuery({
    queryKey: ['admin', 'audit', 'application', id],
    queryFn: () => adminAuditApi.get(id),
    enabled: !!id,
  });

  const { data: candidates = [] } = useQuery({
    queryKey: ['admin', 'audit', 'candidates', id],
    queryFn: () => adminAuditApi.candidates(id),
    enabled: !!id && !!app?.claimLegacy,
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['admin', 'audit'] });
  };

  const doReview = async (input: ReviewDecisionInput) => {
    setSubmitting(true);
    try {
      await adminAuditApi.review(id, input);
      message.success('操作成功');
      refresh();
      setApproveOpen(false);
      setRejectOpen(false);
      setMaterialOpen(false);
    } catch (err) {
      message.error(apiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading || !app) {
    return <Card loading />;
  }

  const pending = app.status === 'PENDING';

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card
        title={`审核详情 ${app.realName}`}
        extra={
          <Button onClick={() => navigate('/admin/audit')}>返回列表</Button>
        }
      >
        <Descriptions column={2} bordered size="small">
          <Descriptions.Item label="状态">
            <Tag color={STATUS_COLORS[app.status]}>{AUDIT_STATUS_LABELS[app.status]}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="账号">{app.user.email ?? app.user.loginName ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="真实姓名">{app.realName}</Descriptions.Item>
          <Descriptions.Item label="学校">{app.schoolName ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="原微信昵称">{app.wechatNickname ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="联系方式">{app.contact ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="认领老账号">
            {app.claimLegacy ? <Tag color="purple">是</Tag> : '否'}
          </Descriptions.Item>
          <Descriptions.Item label="已绑定旧账号">{app.matchedLegacyMemberId ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="提交时间">
            {new Date(app.createdAt).toLocaleString()}
          </Descriptions.Item>
          <Descriptions.Item label="审核备注">
            {app.reviewRemark ? <span style={{ whiteSpace: 'pre-line' }}>{app.reviewRemark}</span> : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="说明" span={2}>
            {app.applyNote ? <span style={{ whiteSpace: 'pre-line' }}>{app.applyNote}</span> : '-'}
          </Descriptions.Item>
        </Descriptions>

        {pending && (
          <Space style={{ marginTop: 16 }}>
            <Button type="primary" onClick={() => setApproveOpen(true)}>
              通过
            </Button>
            <Button danger onClick={() => setRejectOpen(true)}>
              驳回
            </Button>
            <Button onClick={() => setMaterialOpen(true)}>要求补材料</Button>
          </Space>
        )}
      </Card>

      {app.claimLegacy && (
        <Card title="老用户认领候选">
          {candidates.length === 0 ? (
            <Empty description="未匹配到旧平台用户候选" />
          ) : (
            <List<LegacyMemberCandidateDto>
              dataSource={candidates}
              renderItem={(c) => (
                <List.Item
                  actions={
                    pending
                      ? [
                          <Button
                            key="claim"
                            type="primary"
                            size="small"
                            onClick={() =>
                              doReview({ action: 'APPROVE', legacyMemberId: c.id })
                            }
                          >
                            认领并通过
                          </Button>,
                        ]
                      : undefined
                  }
                >
                  <List.Item.Meta
                    title={
                      <Space>
                        {c.realName}
                        {c.auditStatus === 1 ? <Tag color="green">快速通道</Tag> : <Tag>待审核</Tag>}
                        {c.roleType != null ? <Tag>{ROLE_TYPE_LABELS[c.roleType] ?? `角色${c.roleType}`}</Tag> : null}
                      </Space>
                    }
                    description={
                      <Space direction="vertical" size={0}>
                        <Typography.Text type="secondary">
                          昵称：{c.wechatNickname ?? '-'} · 学校：{c.schoolName ?? '-'} · 默认槽位：
                          {c.defaultTopicId ?? '-'} · 上传上限：{c.uploadLimit ?? '-'}
                        </Typography.Text>
                        <Typography.Text type="secondary">旧账号 id：{c.id}</Typography.Text>
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />
          )}
        </Card>
      )}

      <Modal
        title="通过审核"
        open={approveOpen}
        onCancel={() => setApproveOpen(false)}
        onOk={() => approveForm.submit()}
        confirmLoading={submitting}
        destroyOnClose
        afterClose={() => approveForm.resetFields()}
      >
        <Form<ApproveForm>
          form={approveForm}
          layout="vertical"
          onFinish={(v) => doReview({ action: 'APPROVE', defaultSlot: v.defaultSlot, uploadLimit: v.uploadLimit })}
        >
          <Form.Item name="defaultSlot" label="默认批阅槽位（选填，1-10）">
            <InputNumber min={1} max={10} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="uploadLimit" label="上传上限（选填，个人默认 1、其他默认 100）">
            <InputNumber min={0} max={60000} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <RejectModal
        title="驳回申请"
        open={rejectOpen}
        submitting={submitting}
        onSubmit={(remark) => doReview({ action: 'REJECT', remark })}
        onCancel={() => setRejectOpen(false)}
      />
      <RejectModal
        title="要求补材料"
        open={materialOpen}
        submitting={submitting}
        onSubmit={(remark) => doReview({ action: 'REQUEST_MATERIAL', remark })}
        onCancel={() => setMaterialOpen(false)}
      />
    </Space>
  );
}

function RejectModal({
  title,
  open,
  submitting,
  onSubmit,
  onCancel,
}: {
  title: string;
  open: boolean;
  submitting: boolean;
  onSubmit: (remark: string) => void;
  onCancel: () => void;
}) {
  const { message } = App.useApp();
  const [remark, setRemark] = useState('');
  return (
    <Modal
      title={title}
      open={open}
      onCancel={onCancel}
      onOk={() => {
        if (!remark.trim()) {
          message.warning('请填写备注原因');
          return;
        }
        onSubmit(remark.trim());
      }}
      confirmLoading={submitting}
      destroyOnClose
      afterClose={() => setRemark('')}
    >
      <Input.TextArea
        rows={3}
        value={remark}
        onChange={(e) => setRemark(e.target.value)}
        placeholder="请填写备注原因"
      />
    </Modal>
  );
}
