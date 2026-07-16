/**
 * AutomotiveOS Mobile — Login Screen
 *
 * Tenant slug + email + password. On success stores the JWT in the
 * secure session and navigates into the app.
 */

import * as React from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useAuth } from "../auth/AuthContext";
import { api } from "../api/client";
import { colors } from "../theme";
import { registerPushToken } from "../notifications/push";

export default function LoginScreen() {
  const { login } = useAuth();
  const [slug, setSlug] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const onSubmit = async () => {
    if (!slug.trim() || !email.trim() || !password) {
      setError("Completa todos los campos (taller, email, contraseña)");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await api.login(slug.trim(), email.trim(), password);
      await login(result.tenant.slug, result.profile.email, result.token);
      // Best-effort push registration (non-blocking for the user).
      void registerPushToken(result.profile.email);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de autenticación");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24 }}>
        <View style={{ marginBottom: 32 }}>
          <Text style={{ fontSize: 26, fontWeight: "800", color: colors.text, textAlign: "center" }}>
            AutomotiveOS
          </Text>
          <Text style={{ fontSize: 14, color: colors.textMuted, textAlign: "center", marginTop: 6 }}>
            ERP para talleres mecánicos
          </Text>
        </View>

        <Field label="Taller (slug)" value={slug} onChange={setSlug} autoCapitalize="none" placeholder="taller-el-chero" />
        <Field label="Email" value={email} onChange={setEmail} keyboardType="email-address" autoCapitalize="none" placeholder="mecanico@taller.com" />
        <Field label="Contraseña" value={password} onChange={setPassword} secureTextEntry placeholder="••••••••" />

        {error && (
          <Text style={{ color: colors.error, marginTop: 12, textAlign: "center" }}>{error}</Text>
        )}

        <TouchableOpacity
          onPress={onSubmit}
          disabled={loading}
          style={{
            backgroundColor: colors.primary,
            borderRadius: 12,
            paddingVertical: 14,
            marginTop: 20,
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: "#fff", textAlign: "center", fontWeight: "700", fontSize: 16 }}>
              Ingresar
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: "email-address" | "default";
  autoCapitalize?: "none" | "sentences";
  placeholder?: string;
}) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: 6 }}>{props.label}</Text>
      <TextInput
        value={props.value}
        onChangeText={props.onChange}
        secureTextEntry={props.secureTextEntry}
        keyboardType={props.keyboardType ?? "default"}
        autoCapitalize={props.autoCapitalize ?? "sentences"}
        placeholder={props.placeholder}
        placeholderTextColor={colors.textMuted}
        style={{
          backgroundColor: colors.card,
          borderRadius: 10,
          paddingHorizontal: 14,
          paddingVertical: 12,
          color: colors.text,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      />
    </View>
  );
}
