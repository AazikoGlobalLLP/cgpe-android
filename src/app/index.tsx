import { Redirect } from 'expo-router';
import { useAuth } from '@/store/auth';
import { Loader } from '@/ui/kit';

export default function Index() {
  const { user, ready } = useAuth();
  if (!ready) return <Loader />;
  return <Redirect href={user ? '/(tabs)/home' : '/(auth)/login'} />;
}
