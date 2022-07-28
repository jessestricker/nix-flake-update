import * as lockfile from "../src/lockfile.js";
import * as changes from "../src/changes.js";
import * as report from "../src/report.js";
import fs from "fs/promises";

async function main() {
  const oldLockfile = lockfile.parse(
    await fs.readFile("test/old.lock.json", { encoding: "utf-8" })
  );
  const newLockfile = lockfile.parse(
    await fs.readFile("test/new.lock.json", { encoding: "utf-8" })
  );

  const lockfileChanges = changes.compareLockfiles(oldLockfile, newLockfile);
  const changeReport = report.generateReport(lockfileChanges);

  console.log("=".repeat(80));
  console.log(changeReport.title);
  console.log("=".repeat(80));
  console.log(changeReport.body);
  console.log("=".repeat(80));
}

await main();
