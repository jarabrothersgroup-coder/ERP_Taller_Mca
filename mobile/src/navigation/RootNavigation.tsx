/**
 * AutomotiveOS Mobile — Root Navigation
 *
 * Bottom tabs: Dashboard, Work Orders, Clients, Vehicles, Appointments
 */

import * as React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme";

import DashboardScreen from "../screens/DashboardScreen";
import WorkOrdersScreen from "../screens/WorkOrdersScreen";
import ClientsScreen from "../screens/ClientsScreen";
import VehiclesScreen from "../screens/VehiclesScreen";
import AppointmentsScreen from "../screens/AppointmentsScreen";

const Tab = createBottomTabNavigator();

const tabs = [
  { name: "Dashboard", component: DashboardScreen, icon: "grid" as const },
  { name: "WorkOrders", component: WorkOrdersScreen, icon: "build" as const },
  { name: "Clients", component: ClientsScreen, icon: "people" as const },
  { name: "Vehicles", component: VehiclesScreen, icon: "car" as const },
  { name: "Appointments", component: AppointmentsScreen, icon: "calendar" as const },
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
    default: return name;
  }
}
