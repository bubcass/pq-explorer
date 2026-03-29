import { execSync } from "node:child_process";
import { buildDeputyDetailUrls } from "./build-deputy-detail-urls.js";

for (const year of [2025, 2026]) {
  execSync(`node scripts/pq/build-year.js ${year}`, { stdio: "inherit" });
}

await buildDeputyDetailUrls([2025, 2026]);
