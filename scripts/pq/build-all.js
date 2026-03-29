import { execSync } from "child_process";

const years = [2025, 2026];

for (const year of years) {
  console.log(`
=== Building ${year} ===`);
  execSync(`node scripts/pq/build-year.js ${year}`, { stdio: "inherit" });
}
