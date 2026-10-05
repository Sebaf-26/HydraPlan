import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "./",
  // In dev, run `DATA_DIR=./data PORT=3000 ADMIN_USERNAME=a ADMIN_PASSWORD=b npm start` alongside `npm run dev`.
  server: { proxy: { "/api": "http://localhost:3000" } }
});
