import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages repo: https://github.com/swimgirlnv/trivia
// Pages base path is /trivia/ (repo name).
export default defineConfig({
  base: "/trivia/",
  plugins: [react()],
});
