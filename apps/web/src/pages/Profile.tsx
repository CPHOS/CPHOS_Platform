import { Card, Descriptions, Tag } from 'antd';
import { ACCOUNT_ROLE_LABELS, ROLE_LABELS, USER_STATUS_LABELS } from '@cphos/shared';
import { SecuritySettings } from '../components/SecuritySettings';
import { useAuthStore } from '../stores/auth';

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: 'red',
  ADMIN: 'orange',
  CPHOS_MEMBER: 'purple',
  PLATFORM_USER: 'blue',
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'green',
  DISABLED: 'red',
  PENDING: 'default',
};

/** 个人信息页：展示当前登录账号与其业务资料 */
export function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  if (!user) return null;

  return (
    <div>
      <Card title="账号信息" size="small">
        <Descriptions column={{ xs: 1, sm: 2 }} size="small">
          <Descriptions.Item label="账号">{user.email ?? user.loginName ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="显示名称">{user.displayName ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="账号层级">
            <Tag color={ROLE_COLORS[user.role]}>{ACCOUNT_ROLE_LABELS[user.role]}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="状态">
            <Tag color={STATUS_COLORS[user.status]}>{USER_STATUS_LABELS[user.status]}</Tag>
          </Descriptions.Item>
          {user.email && (
            <Descriptions.Item label="邮箱验证">{user.emailVerified ? '已验证' : '未验证'}</Descriptions.Item>
          )}
          {user.legacyMemberId && (
            <Descriptions.Item label="已认领旧账号">#{user.legacyMemberId}</Descriptions.Item>
          )}
          <Descriptions.Item label="注册时间">
            {new Date(user.createdAt).toLocaleString()}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {user.profile && (
        <Card title="业务资料" size="small" style={{ marginTop: 16 }}>
          <Descriptions column={{ xs: 1, sm: 2 }} size="small">
            <Descriptions.Item label="真实姓名">{user.profile.realName ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="学校">{user.profile.schoolName ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="业务角色">
              <Tag>{ROLE_LABELS[user.profile.role]}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="默认批阅槽位">{user.profile.defaultSlot ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="个人上传限额">{user.profile.uploadLimit}</Descriptions.Item>
            <Descriptions.Item label="所属团队">{user.profile.teamName ?? '未加入团队'}</Descriptions.Item>
            <Descriptions.Item label="团队共享限额">
              {user.profile.teamUploadLimit ?? '-'}
            </Descriptions.Item>
          </Descriptions>
        </Card>
      )}

      <SecuritySettings />
    </div>
  );
}
