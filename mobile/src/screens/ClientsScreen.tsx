/**
 * Clients screen — searchable list
 */

import * as React from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, borderRadius, fontSize } from "../theme";
import { useClients } from "../hooks/use-data";
import type { Client } from "../api/client";
import { FadeInView, AnimatedEmptyState, LoadingSpinner } from "../components/AnimatedComponents";

function ClientCard({ client, onPress }: { client: Client; onPress: () => void }) {
  const initials = client.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initials}</Text>
      </View>
      <View style={styles.cardContent}>
        <Text style={styles.cardName}>{client.name}</Text>
        {client.email && (
          <Text style={styles.cardEmail} numberOfLines={1}>{client.email}</Text>
        )}
        {client.phone && (
          <Text style={styles.cardPhone}>{client.phone}</Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
    </TouchableOpacity>
  );
}

export default function ClientsScreen({ navigation }: any) {
  const [search, setSearch] = React.useState("");
  const [refreshing, setRefreshing] = React.useState(false);
  const { data: clients = [], isLoading, refetch } = useClients();

  const filtered = React.useMemo(() => {
    if (!search) return clients;
    const q = search.toLowerCase();
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.phone?.includes(q) ||
        c.ruc?.includes(q)
    );
  }, [clients, search]);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  return (
    <View style={styles.container}>
      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={16} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar cliente..."
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch("")}>
            <Ionicons name="close-circle" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Count */}
      <Text style={styles.count}>
        {filtered.length} cliente{filtered.length !== 1 ? "s" : ""}
      </Text>

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        renderItem={({ item, index }) => (
          <FadeInView delay={index * 50}>
            <ClientCard
              client={item}
              onPress={() => navigation.navigate("ClientDetail", { id: item.id })}
            />
          </FadeInView>
        )}
        ListEmptyComponent={
          isLoading ? (
            <LoadingSpinner message="Cargando clientes..." />
          ) : (
            <AnimatedEmptyState
              icon="people-outline"
              title="No hay clientes"
              subtitle="Agregue clientes desde el menú de clientes"
            />
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundMuted },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    margin: spacing.md,
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.md,
    marginLeft: spacing.sm,
    fontSize: fontSize.md,
    color: colors.text,
  },
  count: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  list: { padding: spacing.md, paddingTop: 0 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  avatarText: { color: colors.textInverse, fontWeight: "700", fontSize: fontSize.sm },
  cardContent: { flex: 1 },
  cardName: { fontSize: fontSize.md, fontWeight: "600", color: colors.text },
  cardEmail: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
  cardPhone: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 1 },
  empty: { alignItems: "center", paddingVertical: spacing.xxl * 2 },
  emptyText: { fontSize: fontSize.sm, color: colors.textMuted, marginTop: spacing.md },
});
