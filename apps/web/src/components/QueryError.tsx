import { Alert, Button } from 'antd';
import { apiErrorMessage } from '../api/http';

interface Props {
  error: unknown;
  onRetry: () => void;
  title?: string;
}

export function QueryError({ error, onRetry, title = '数据加载失败' }: Props) {
  return (
    <Alert
      type="error"
      showIcon
      message={title}
      description={apiErrorMessage(error)}
      action={
        <Button size="small" danger onClick={onRetry}>
          重试
        </Button>
      }
      style={{ marginBottom: 16 }}
    />
  );
}
