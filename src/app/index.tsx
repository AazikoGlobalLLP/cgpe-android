import { useT } from '@/i18n';
import { Redirect } from 'expo-router';
import { useAuth } from '@/store/auth';
import { Loader } from '@/ui/feedback';

/**
 * The entry gate. Nothing but a routing decision, so it stays a Loader rather than a
 * skeleton: there is no layout to hold the shape of yet, and the branch it is waiting on
 * decides which layout even applies.
 */
export default function Index() {
  const t = useT();
  const { user, ready } = useAuth();
  if (!ready) return <Loader label={t('auth.restoringSession')} />;
  return <Redirect href={user ? '/(tabs)/home' : '/(auth)/login'} />;
}
