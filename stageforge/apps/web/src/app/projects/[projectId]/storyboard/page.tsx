import { redirect, notFound } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { canAccessProject } from '@/lib/server';
import { StoryboardView } from '@/components/storyboard-view';

export const dynamic = 'force-dynamic';

export default async function StoryboardPage({ params }: { params: { projectId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/login');
  if (!(await canAccessProject(params.projectId, session.user.id))) notFound();
  return <StoryboardView projectId={params.projectId} />;
}
