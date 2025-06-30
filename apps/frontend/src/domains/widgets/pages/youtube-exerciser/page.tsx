import { ErrorMessage } from '@/shared/components/ui/error-message';
import { Loading } from '@/shared/components/ui/loading';

import { useAuth } from '@/domains/user/hooks/useAuth';

import { YouTubeExerciser } from '../../components/YouTubeExerciser';

export default function YouTubeExerciserPage() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <Loading />;
  }

  // TODO: Review non-null assertion - consider null safety
  if (!user) {
    return (
      <ErrorMessage
        title="Access Denied"
        message="Please log in to access this page."
      />
    );
  }

  return <YouTubeExerciser userId={user.id} />;
}
