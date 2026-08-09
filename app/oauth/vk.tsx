import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

/** Deep-link landing for VK OAuth (`waafstreamer://oauth/vk`). Session is handled by `loginWithVk` Linking listener. */
export default function VkOAuthReturnScreen() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/(streaming)');
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <View style={{ flex: 1, backgroundColor: '#121212', justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator color="#0077FF" size="large" />
    </View>
  );
}
