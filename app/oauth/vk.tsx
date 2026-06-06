import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

/** Deep-link target for VK OAuth return; WebBrowser intercepts the URL before navigation. */
export default function VkOAuthReturnScreen() {
  const router = useRouter();

  useEffect(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  }, [router]);

  return (
    <View style={{ flex: 1, backgroundColor: '#121212', justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator color="#0077FF" size="large" />
    </View>
  );
}
