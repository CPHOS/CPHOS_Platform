import type { RankingDto, RankingEntryDto } from '@cphos/shared';
import ExcelJS from 'exceljs';
import { prisma } from '../../db.js';
import { Errors } from '../../lib/errors.js';

export const DEFAULT_RANKING_SEGMENTS = [1, 10, 20, 30, 40, 50];

function parseSegments(raw?: string): number[] {
  if (!raw) return DEFAULT_RANKING_SEGMENTS;
  const parts = raw
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);
  const unique = [...new Set(parts)].sort((a, b) => a - b);
  return unique.length ? unique : DEFAULT_RANKING_SEGMENTS;
}

function ownerName(owner: {
  realName: string | null;
  user: { displayName: string | null; loginName: string | null; email: string | null };
}): string | null {
  return owner.realName ?? owner.user.displayName ?? owner.user.loginName ?? owner.user.email ?? null;
}

export async function getRanking(examId: bigint, rawSegments?: string): Promise<RankingDto> {
  const exam = await prisma.exam.findUnique({ where: { id: examId }, select: { id: true, name: true } });
  if (!exam) throw Errors.notFound('考试');
  const segmentPositions = parseSegments(rawSegments);

  const papers = await prisma.paper.findMany({
    where: { examId, score: { not: null } },
    orderBy: [{ score: 'desc' }, { finalizedAt: 'asc' }, { id: 'asc' }],
    include: {
      student: {
        include: {
          school: { select: { name: true } },
          owner: {
            select: {
              realName: true,
              user: { select: { displayName: true, loginName: true, email: true } },
            },
          },
        },
      },
    },
  });

  const entries: RankingEntryDto[] = papers.map((paper, index) => {
    const rank = index + 1;
    return {
      rank,
      paperId: String(paper.id),
      studentId: String(paper.studentId),
      studentName: paper.student.name,
      schoolName: paper.student.school?.name ?? null,
      ownerName: ownerName(paper.student.owner),
      score: paper.score === null ? 0 : Number(paper.score),
      finalizedAt: paper.finalizedAt?.toISOString() ?? null,
      segmentLabel: segmentPositions.includes(rank) ? '前' + rank : null,
    };
  });

  return {
    examId: String(exam.id),
    examName: exam.name,
    total: entries.length,
    segmentPositions,
    entries,
  };
}

function csvEscape(value: string | number | null): string {
  let text = value === null ? '' : String(value);
  // 防止 Excel/WPS 将用户可控单元格识别为公式
  if (/^[=+\-@\t\r]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}

export async function exportRanking(
  examId: bigint,
  operatorId: bigint,
  format: 'csv' | 'xlsx',
  rawSegments?: string,
): Promise<{ buffer: Buffer | ArrayBuffer; contentType: string; filename: string }> {
  const ranking = await getRanking(examId, rawSegments);
  const header = ['排名', '姓名', '学校', '教练', '总分', '定稿时间', '分段'];
  const rows = ranking.entries.map((e) => [
    e.rank,
    e.studentName,
    e.schoolName,
    e.ownerName,
    e.score,
    e.finalizedAt ? new Date(e.finalizedAt).toLocaleString() : '',
    e.segmentLabel ?? '',
  ]);


  let result: { buffer: Buffer | ArrayBuffer; contentType: string; filename: string };
  if (format === 'csv') {
    const lines = [header, ...rows].map((row) => row.map(csvEscape).join(','));
    const buffer = Buffer.from('\uFEFF' + lines.join('\n'), 'utf8');
    result = { buffer, contentType: 'text/csv; charset=utf-8', filename: ranking.examName + '-排名.csv' };
  } else {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('成绩排名');
    sheet.addRow(header);
    rows.forEach((row) => sheet.addRow(row));
    sheet.getRow(1).font = { bold: true };
    sheet.columns.forEach((column, index) => {
      column.width = index === 1 ? 16 : index === 2 || index === 3 ? 24 : 14;
    });
    const buffer = await workbook.xlsx.writeBuffer();
    result = {
      buffer,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      filename: ranking.examName + '-排名.xlsx',
    };
  }

  await prisma.auditLog.create({
    data: {
      operatorId,
      action: 'RANKING_EXPORT',
      examId,
      remark: '导出' + (format === 'csv' ? 'CSV' : 'Excel') + '排名，共 ' + ranking.total + ' 人',
    },
  });
  return result;
}
