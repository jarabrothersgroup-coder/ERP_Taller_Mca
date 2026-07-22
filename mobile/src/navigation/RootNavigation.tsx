/**
 * AutomotiveOS Mobile — Root Navigation
 *
 * Bottom tabs with stack navigators for detail screens.
 */

import * as React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createStackNavigator } from "@react-navigation/stack";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme";

import DashboardScreen from "../screens/DashboardScreen";
import WorkOrdersScreen from "../screens/WorkOrdersScreen";
import WorkOrderDetailScreen from "../screens/WorkOrderDetailScreen";
import ClientsScreen from "../screens/ClientsScreen";
import ClientDetailScreen from "../screens/ClientDetailScreen";
import VehiclesScreen from "../screens/VehiclesScreen";
import VehicleDetailScreen from "../screens/VehicleDetailScreen";
import AppointmentsScreen from "../screens/AppointmentsScreen";
import AccountingScreen from "../screens/AccountingScreen";
import RG90ExportScreen from "../screens/RG90ExportScreen";

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

const headerStyle = {
  backgroundColor: colors.primary,
};
const headerTintColor = colors.textInverse;
const headerTitleStyle = { fontWeight: "600" as const };

function WorkOrdersStack() {
  return (
    <Stack.Navigator screenOptions={{ headerStyle, headerTintColor, headerTitleStyle }}>
      <Stack.Screen name="WorkOrdersList" component={WorkOrdersScreen} options={{ title: "Órdenes de Trabajo" }} />
      <Stack.Screen name="WorkOrderDetail" component={WorkOrderDetailScreen} options={{ title: "Detalle" }} />
    </Stack.Navigator>
  );
}

function ClientsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerStyle, headerTintColor, headerTitleStyle }}>
      <Stack.Screen name="ClientsList" component={ClientsScreen} options={{ title: "Clientes" }} />
      <Stack.Screen name="ClientDetail" component={ClientDetailScreen} options={{ title: "Detalle" }} />
    </Stack.Navigator>
  );
}

function VehiclesStack() {
  return (
    <Stack.Navigator screenOptions={{ headerStyle, headerTintColor, headerTitleStyle }}>
      <Stack.Screen name="VehiclesList" component={VehiclesScreen} options={{ title: "Vehículos" }} />
      <Stack.Screen name="VehicleDetail" component={VehicleDetailScreen} options={{ title: "Detalle" }} />
    </Stack.Navigator>
  );
}

const tabs = [
  { name: "Dashboard", component: DashboardScreen, icon: "grid" as const },
  { name: "WorkOrders", component: WorkOrdersStack, icon: "build" as const },
  { name: "Clients", component: ClientsStack, icon: "people" as const },
  { name: "Vehicles", component: VehiclesStack, icon: "car" as const },
  { name: "Appointments", component: AppointmentsScreen, icon: "calendar" as const },
  { name: "Accounting", component: AccountingScreen, icon: "calculator" as const },
  { name: "RG90", component: RG90ExportScreen, icon: "document-text" as const },
];

export default function RootNavigation() {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: colors.primary },
          headerTintColor: colors.textInverse,
          headerTitleStyle: { fontWeight: "600" },
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarStyle: {
            borderTopColor: colors.border,
            paddingBottom: 4,
            height: 56,
          },
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: "500",
          },
        }}
      >
        {tabs.map((tab) => (
          <Tab.Screen
            key={tab.name}
            name={tab.name}
            component={tab.component}
            options={{
              title: getTabTitle(tab.name),
              headerShown: tab.name !== "Dashboard",
              tabBarIcon: ({ color, size }) => (
                <Ionicons name={tab.icon} size={size} color={color} />
              ),
            }}
          />
        ))}
      </Tab.Navigator>
    </NavigationContainer>
  );
}

function getTabTitle(name: string): string {
  switch (name) {
    case "Dashboard": return "Panel";
    case "WorkOrders": return "Órdenes";
    case "Clients": return "Clientes";
    case "Vehicles": return "Vehículos";
    case "Appointments": return "Agenda";
    case "Accounting": return "Contabilidad";
    case "RG90": return "RG 90";
    default: return name;
  }
}
