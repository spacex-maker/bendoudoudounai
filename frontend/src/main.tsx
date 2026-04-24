import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./i18n/config";
import App from "./App";
import { AuthProvider } from "./auth/AuthContext";
import { PageAppearanceProvider } from "./pageAppearance/PageAppearanceContext";
import { PageWallpaper } from "./components/PageWallpaper";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <PageAppearanceProvider>
      <PageWallpaper />
      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </PageAppearanceProvider>
  </React.StrictMode>
);
