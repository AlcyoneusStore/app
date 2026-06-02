import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { CurrencyProvider } from "@/src/contexts/CurrencyContext";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useIconFonts();

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#050816' }}>
      <SafeAreaProvider>
        <CurrencyProvider>
          <StatusBar style="light" />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#050816' } }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="add-transaction" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
            <Stack.Screen name="add-investment" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          </Stack>
        </CurrencyProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
