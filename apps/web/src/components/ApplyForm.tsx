import { useQuery } from '@tanstack/react-query';
import type { SubmitApplicationInput } from '@cphos/shared';
import { Button, Form, Input, Select, Switch, message } from 'antd';
import { useState } from 'react';
import { auditApi } from '../api/audit';
import { dictApi } from '../api/dict';
import { apiErrorMessage } from '../api/http';

type FormValues = Omit<SubmitApplicationInput, 'schoolId'> & { schoolId: string };

interface ApplyFormProps {
  mode: 'create' | 'resubmit';
  initialValues?: Partial<FormValues>;
  onDone: () => void;
}

/** 提交/重提审核资料表单（学校下拉来自字典） */
export function ApplyForm({ mode, initialValues, onDone }: ApplyFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const { data: schools = [] } = useQuery({ queryKey: ['dict', 'schools'], queryFn: dictApi.schools });

  const onFinish = async (values: FormValues) => {
    setSubmitting(true);
    try {
      const payload: SubmitApplicationInput = {
        ...values,
        applyNote: values.applyNote?.trim() || undefined,
      };
      if (mode === 'create') await auditApi.submit(payload);
      else await auditApi.update(payload);
      message.success('资料已提交，等待管理员审核');
      onDone();
    } catch (err) {
      message.error(apiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Form<FormValues>
      layout="vertical"
      onFinish={onFinish}
      initialValues={{ claimLegacy: false, ...initialValues }}
    >
      <Form.Item name="realName" label="真实姓名" rules={[{ required: true, message: '请输入真实姓名' }]}>
        <Input placeholder="审核通过后作为平台姓名" maxLength={50} />
      </Form.Item>

      <Form.Item name="schoolId" label="学校" rules={[{ required: true, message: '请选择学校' }]}>
        <Select
          showSearch
          optionFilterProp="label"
          placeholder="选择学校"
          options={schools.map((s) => ({
            value: s.id,
            label: `${s.name}${s.areaName ? `（${s.areaName}）` : ''}`,
          }))}
        />
      </Form.Item>

      <Form.Item
        name="wechatNickname"
        label="原微信昵称"
        rules={[{ required: true, message: '请输入原微信昵称' }]}
        extra="老用户认领匹配依据，请填写旧平台使用过的微信昵称"
      >
        <Input placeholder="原微信昵称" maxLength={100} />
      </Form.Item>

      <Form.Item name="contact" label="联系方式" rules={[{ required: true, message: '请输入联系方式' }]}>
        <Input placeholder="手机号或其它联系方式" maxLength={50} />
      </Form.Item>

      <Form.Item name="applyNote" label="说明（选填）">
        <Input.TextArea rows={3} placeholder="补充说明" maxLength={500} />
      </Form.Item>

      <Form.Item name="claimLegacy" label="老用户认领" valuePropName="checked">
        <Switch /> <span style={{ marginLeft: 8, color: '#888' }}>我是旧平台老用户，申请认领原账号</span>
      </Form.Item>

      <Form.Item>
        <Button type="primary" htmlType="submit" block loading={submitting}>
          {mode === 'create' ? '提交审核资料' : '重新提交'}
        </Button>
      </Form.Item>
    </Form>
  );
}
