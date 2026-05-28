import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // En Docker sobre Windows los eventos de archivo no llegan al contenedor;
    // el polling hace que Vite detecte los cambios y haga hot-reload.
    watch: {
      usePolling: true,
      interval: 300,
    },
  },
});
