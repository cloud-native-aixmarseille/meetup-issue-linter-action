import { spawnSync } from "node:child_process";

const captureGeneratedDiff = () =>
	spawnSync("git", ["diff", "--binary", "--", "actions"], {
		encoding: "utf8",
	});

const exitWithCommandFailure = (label, result) => {
	console.error(`check-dist: ${label} failed.`);
	if (result.stderr) {
		process.stderr.write(result.stderr);
	}
	process.exit(result.status ?? 1);
};

console.info("check-dist: capturing current generated diff for actions/.");

const diffBeforeBuild = captureGeneratedDiff();
if (diffBeforeBuild.status !== 0) {
	exitWithCommandFailure("capturing pre-build diff", diffBeforeBuild);
}

console.info("check-dist: rebuilding action bundles for comparison.");
const build = spawnSync(process.execPath, ["scripts/build-actions.mjs"], {
	stdio: "inherit",
});
if (build.status !== 0) {
	console.error("check-dist: bundle rebuild failed.");
	process.exit(build.status ?? 1);
}

console.info("check-dist: capturing generated diff after rebuild.");
const diffAfterBuild = captureGeneratedDiff();
if (diffAfterBuild.status !== 0) {
	exitWithCommandFailure("capturing post-build diff", diffAfterBuild);
}

if (diffBeforeBuild.stdout === diffAfterBuild.stdout) {
	console.info("check-dist: action bundles are up to date.");
	process.exit(0);
}

console.error(
	"check-dist: generated action bundles are stale. Review the diff below.",
);
const diff = spawnSync("git", ["diff", "--exit-code", "--", "actions"], {
	stdio: "inherit",
});
process.exit(diff.status ?? 1);
