import { redirect, notFound } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { canAccessProject } from '@/lib/server';
import { Workbench } from '@/components/workbench';

export const dynamic = 'force-dynamic';

export default async function ProjectPage({ params }: { params: { projectId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/login');
  if (!(await canAccessProject(params.projectId, session.user.id))) notFound();
  return <Workbench projectId={params.projectId} />;
}
