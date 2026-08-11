import { Redirect } from 'expo-router';
import { useIsAuthenticated } from '@/stores/auth';

export default function Index() {
  const isAuthenticated = useIsAuthenticated();
  return <Redirect href={isAuthenticated ? '/(tabs)/feed' : '/login'} />;
}
