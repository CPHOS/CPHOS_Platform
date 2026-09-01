import { useQuery } from '@tanstack/react-query';
import {
  ARBITRATION_STATUS_LABELS,
  type ArbitrationStatus,
  type MyRankingEntryDto,
  type PaperDto,
  type QuestionImageDto,
} from '@cphos/shared';
import { Button, Card, Descriptions, Drawer, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useEffect, useState } from 'react';
import { paperApi } from '../../api/papers';
import { resultApi } from '../../api/results';

function ResultImage({ paperId, image }: { paperId: string; image: QuestionImageDto }) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState(false);
  useEffect(() => {
    let alive = true;
    let objectUrl = '';
    setUrl('');
    setError(false);
    void paperApi
      .pageImage(paperId, image.paperPageId)
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
  }, [paperId, image.paperPageId]);
  return (
    <div style={{ width: 220 }}>
      {url ? (
        <img src={url} alt={'第' + image.pageNo + '页'} style={{ width: '100%' }} />
      ) : (
        <div style={{ height: 80, lineHeight: '80px', color: error ? '#c00' : undefined }}>
          {error ? '图片加载失败' : '加载图片中'}
        </div>
      )}
      <Typography.Text type="secondary">
        第{image.pageNo}页 / 片段{image.partIndex}
        {image.crop
          ? ' / 裁剪 x' + image.crop.x + ' y' + image.crop.y + ' w' + image.crop.width + ' h' + image.crop.height
          : ''}
      </Typography.Text>
    </div>
  );
}

/** 平台用户：本人学生定稿成绩与逐题结果 */
export function ResultsPage() {
  const [detailId, setDetailId] = useState<string | null>(null);

  const { data: ranking, isLoading } = useQuery({
    queryKey: ['results', 'my-ranking'],
    queryFn: resultApi.myRanking,
  });

  const { data: detail } = useQuery({
    queryKey: ['results', 'paper', detailId],
    queryFn: () => paperApi.get(detailId!),
    enabled: !!detailId,
  });

  const columns: ColumnsType<MyRankingEntryDto> = [
    { title: '排名', dataIndex: 'rank', width: 80, render: (v: number, r) => v + '/' + r.total },
    { title: '考试', dataIndex: 'examName', ellipsis: true },
    { title: '学生', dataIndex: 'studentName', ellipsis: true },
    { title: '总分', dataIndex: 'score', width: 90 },
    {
      title: '定稿时间',
      dataIndex: 'finalizedAt',
      render: (v: string | null) => (v ? new Date(v).toLocaleString() : '-'),
      responsive: ['lg'],
    },
    {
      title: '操作',
      width: 100,
      render: (_, r) => (
        <Button size="small" onClick={() => setDetailId(r.paperId)} data-testid={'result-detail-' + r.paperId}>
          查看详情
        </Button>
      ),
    },
  ];

  return (
    <Card>
      <Typography.Paragraph type="secondary">
        仅展示所有题目均已定稿并汇总总分的整卷；可回看双阅分、仲裁结果与题目组图。
      </Typography.Paragraph>
      <Table<MyRankingEntryDto>
        rowKey="paperId"
        loading={isLoading}
        columns={columns}
        dataSource={ranking?.items ?? []}
        pagination={false}
      />

      <Drawer
        title={'成绩详情：' + (detail?.studentName ?? '')}
        open={!!detailId}
        onClose={() => setDetailId(null)}
        width={760}
      >
        {detail && (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Descriptions size="small" column={2} bordered>
              <Descriptions.Item label="考试">{detail.examName}</Descriptions.Item>
              <Descriptions.Item label="学生">{detail.studentName}</Descriptions.Item>
              <Descriptions.Item label="总分">{detail.score ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="定稿时间">
                {detail.finalizedAt ? new Date(detail.finalizedAt).toLocaleString() : '-'}
              </Descriptions.Item>
            </Descriptions>

            {detail.questions.map((question) => (
              <Card
                key={question.id}
                size="small"
                title={
                  '槽位 ' +
                  question.slot +
                  (question.questionLabel ? '（' + question.questionLabel + '）' : '') +
                  ' · 最终分 ' +
                  (question.finalScore ?? '待仲裁')
                }
                extra={<span>满分 {question.maxScore}</span>}
              >
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Space wrap>
                    <span>双阅分：{question.roundScores.join(' / ') || '-'}</span>
                    {question.arbitrationStatus ? (
                      <Tag color="orange">
                        仲裁{ARBITRATION_STATUS_LABELS[question.arbitrationStatus as ArbitrationStatus] ??
                          question.arbitrationStatus}
                        {question.arbitrationScore !== null ? '：' + question.arbitrationScore : ''}
                      </Tag>
                    ) : (
                      <Tag color="green">无仲裁</Tag>
                    )}
                  </Space>
                  {question.images.length === 0 ? (
                    <Typography.Text type="secondary">无题目图片</Typography.Text>
                  ) : (
                    <Space wrap align="start">
                      {question.images.map((image) => (
                        <ResultImage key={image.id} paperId={detail.id} image={image} />
                      ))}
                    </Space>
                  )}
                </Space>
              </Card>
            ))}
          </Space>
        )}
      </Drawer>
    </Card>
  );
}
