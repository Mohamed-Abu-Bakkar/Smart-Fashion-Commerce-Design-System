
  import { createRoot } from "react-dom/client";
  import { ThemeProvider } from "next-themes";
  import App from "./app/App.tsx";
  import { ShopDataProvider } from "./app/data.tsx";
  import "./styles/index.css";

  createRoot(document.getElementById("root")!).render(
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange storageKey="sf-theme">
      <ShopDataProvider>
        <App />
      </ShopDataProvider>
    </ThemeProvider>
  );
