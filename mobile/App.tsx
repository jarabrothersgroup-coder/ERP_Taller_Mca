/**
 * AutomotiveOS Mobile — App Entry Point
 */

import * as React from "react";
import { StatusBar } from "expo-status-bar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AuthProvider, useAuth } from "./src/auth/AuthContext";
import RootNavigation from "./src/navigation/RootNavigation";
import LoginScreen from "./src/screens/LoginScreen";
import { ActivityIndicator, View } from "react-native";
import { colors } from "./src/theme";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
      // Offline-first: serve cached data immediately, retry in background.
      gcTime: 1000 * 60 * 60 * 24, // 24h cache retention
    },
  },
});

const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
});

function Gate() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // No session → login. Authenticated → main app.
  return session ? <RootNavigation /> : <LoginScreen />;
}

export default function App() {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister: asyncStoragePersister, maxAge: 1000 * 60 * 60 * 24 }}
    >
      <AuthProvider>
        <StatusBar style="light" />
        <Gate />
      </AuthProvider>
    </PersistQueryClientProvider>
  );
}
