import { DashboardContent } from '../../components/DashboardContent';
import { DashboardHeader } from '../../components/DashboardHeader';
import { DashboardLayout } from '../../components/DashboardLayout';

export default function DashboardPage() {
  return (
    <DashboardLayout>
      <DashboardHeader />
      <DashboardContent />
    </DashboardLayout>
  );
}
