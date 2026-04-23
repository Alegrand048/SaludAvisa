import { createBrowserRouter, createHashRouter } from "react-router";
import Welcome from "./pages/Welcome";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Home from "./pages/Home";
import Medications from "./pages/Medications";
import Appointments from "./pages/Appointments";
import Profile from "./pages/Profile";
import { GuestOnly, RequireAuth } from "./components/RouteGuards";

const routeConfig = [
  {
    Component: GuestOnly,
    children: [
      {
        path: "/",
        Component: Welcome,
      },
      {
        path: "/login",
        Component: Login,
      },
      {
        path: "/register",
        Component: Register,
      },
    ],
  },
  {
    Component: RequireAuth,
    children: [
      {
        path: "/home",
        Component: Home,
      },
      {
        path: "/medications",
        Component: Medications,
      },
      {
        path: "/appointments",
        Component: Appointments,
      },
      {
        path: "/profile",
        Component: Profile,
      },
    ],
  },
];

const isCapacitorRuntime =
  typeof window !== "undefined" && Boolean((window as Window & { Capacitor?: unknown }).Capacitor);

export const router = isCapacitorRuntime
  ? createHashRouter(routeConfig)
  : createBrowserRouter(routeConfig);
