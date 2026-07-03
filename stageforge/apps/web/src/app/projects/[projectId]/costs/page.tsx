import { redirect, notFound } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { prisma } from '@stageforge/db';
import { authOptions } from '@/lib/auth';
import { CostsView } from '@/components/costs-view';

export const dynamic = 'force-dynamic';

export default async function CostsPage({ params }: { params: { projectId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/login');
  const project = await prisma.project.findUnique({ where: { id: params.projectId } });
  if (!project || project.ownerId !== session.user.id) notFound();
  return <CostsView projectId={params.projectId} />;
}
