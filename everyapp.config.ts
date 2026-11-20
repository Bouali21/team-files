import { defineEveryApp } from "@every-app/sdk";

export default defineEveryApp({
  id: "team-files",
  name: "Team Files",
  description:
    "Store, preview and share files and folders with your team, or with anyone through a view link.",
  icon: "/icon.svg",
  resources: {
    d1: ["DB"],
    r2: ["files"],
  },
  // View links: the shared page and the bytes of what it links to.
  public: [{ path: "/s/:token" }, { path: "/s/:token/raw/:fileId" }],
  publicAssets: ["/assets/**", "/icon.svg"],
});
