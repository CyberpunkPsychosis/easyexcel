import { prisma } from '@stageforge/db';
import { reviewShortDramaContent, type ComplianceFinding } from '@stageforge/adapters';

export interface ComplianceReport {
  status: 'passed' | 'blocked';
  checks: {
    registration: { ok: boolean; note: string };
    watermark: { ok: boolean; note: string };
    content: { ok: boolean; findings: ComplianceFinding[]; mock: boolean };
  };
  checkedAt: string;
}

/**
 * 备案合规卡点（M4）—— 合成/发布前的强制检查。规则：
 * - 内容审核出现 block 级 finding → 拦截
 * - 既没填备案号、又关了 AI 水印 → 拦截（2026-04 未备案下架 + AI 标识义务，
 *   两道保险至少留一道；只缺备案号时放行但强提示）
 * - 其余 → 通过（警告项列入报告）
 */
export async function runComplianceCheck(episodeId: string): Promise<ComplianceReport> {
  const episode = await prisma.episode.findUniqueOrThrow({
    where: { id: episodeId },
    include: {
      project: true,
      scenes: { include: { shots: { select: { dialogue: true, visualPrompt: true } } } },
    },
  });

  const registrationNo = episode.project.registrationNo?.trim() ?? '';
  const registration = {
    ok: registrationNo.length > 0,
    note: registrationNo
      ? `备案号：${registrationNo}`
      : '未填写备案号（2026-04 起未备案 AI 短剧一律下架，发布前务必补齐）',
  };
  const watermark = {
    ok: episode.watermark,
    note: episode.watermark ? 'AI 生成标识水印已开启，合成时烧制角标' : 'AI 标识水印已关闭',
  };

  const lines = episode.scenes
    .flatMap((s) => s.shots)
    .map((sh) => sh.dialogue || sh.visualPrompt)
    .filter(Boolean)
    .join('\n');
  const review = await reviewShortDramaContent(lines);
  const hasBlock = review.findings.some((f) => f.severity === 'block');

  const blocked = hasBlock || (!registration.ok && !watermark.ok);
  const report: ComplianceReport = {
    status: blocked ? 'blocked' : 'passed',
    checks: {
      registration,
      watermark,
      content: { ok: !hasBlock, findings: review.findings, mock: review.mock },
    },
    checkedAt: new Date().toISOString(),
  };

  await prisma.episode.update({
    where: { id: episodeId },
    data: {
      complianceStatus: report.status,
      complianceReport: report as unknown as object,
    },
  });
  return report;
}
