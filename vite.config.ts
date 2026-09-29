import { defineConfig } from "vite";
import { cpSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const staticDirs = ["css", "js", "data", "assets", "skills"];

export default defineConfig({
  base: "/putevod/",
  build: {
    rollupOptions: {
      input: {
        index: resolve(__dirname, "index.html"),
        kosmos: resolve(__dirname, "kosmos.html"),
        istoriya: resolve(__dirname, "istoriya.html"),
        sovremennost: resolve(__dirname, "sovremennost.html"),
        oblast: resolve(__dirname, "oblast.html"),
        marshrut: resolve(__dirname, "marshrut.html"),
        place: resolve(__dirname, "place.html"),
        about: resolve(__dirname, "about.html"),
        "404": resolve(__dirname, "404.html"),
      },
    },
  },
  plugins: [
    {
      name: "copy-static",
      closeBundle() {
        for (const dir of staticDirs) {
          if (!existsSync(resolve(__dirname, dir))) continue;
          cpSync(resolve(__dirname, dir), resolve(__dirname, "dist", dir), {
            recursive: true,
          });
        }
      },
    },
  ],
});
