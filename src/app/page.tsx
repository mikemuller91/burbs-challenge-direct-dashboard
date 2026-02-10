import Dashboard from '@/components/Dashboard';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

export default function Home() {
  return <Dashboard />;
}
