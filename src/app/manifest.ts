import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "成語填填看",
    short_name: "成語填填看",
    description: "共享棋盤，一起挑戰成語造詣。",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#fdf6e3",
    theme_color: "#268bd2",
    lang: "zh-TW",
    categories: ["education", "games"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
