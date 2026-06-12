import { spawn } from "node:child_process";

const [, , surface, ...args] = process.argv;

const surfaceMap = {
  web: { pkg: "@lift-prog/web", defaultCommand: "dev" },
  ios: { pkg: "@lift-prog/mobile", defaultCommand: "ios" },
};

const target = surfaceMap[surface];

if (!target) {
  console.error(
    `Unknown surface "${surface}". Expected one of: ${Object.keys(surfaceMap).join(", ")}`,
  );
  process.exit(1);
}

const [command, ...commandArgs] =
  args.length > 0 ? args : [target.defaultCommand];

const child = spawn(
  "npm",
  ["run", command, "-w", target.pkg, "--", ...commandArgs],
  {
    stdio: "inherit",
    shell: process.platform === "win32",
  },
);

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
