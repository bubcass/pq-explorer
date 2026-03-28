import { execSync } from "child_process";

const years = [2025, 2026];

for (const y of years) {
  console.log(`\n=== Building ${y} ===`);
  execSync(`node scripts/pq/build-year.js ${y}`, { stdio: "inherit" });
}
