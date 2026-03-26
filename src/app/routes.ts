import { createBrowserRouter } from "react-router";
import Welcome from "./pages/Welcome";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Home from "./pages/Home";
import Medications from "./pages/Medications";
import Appointments from "./pages/Appointments";
import Profile from "./pages/Profile";

export const router = createBrowserRouter([
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
]);
