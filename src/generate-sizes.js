const util = require("util");
const _ = require("lodash");
const exec = util.promisify(require("child_process").exec);
const { getJSONFile } = require("./fileUtils");

const tmpOutputPath = "./src/temp/tmp-package-sizes.json";
const genTempOutputPath = () => {
  return `./src/temp/tmp-package-sizes-${+new Date()}.json`;
};

//OPTS
const chunk_size = 15;
const tryExcludePreReleases = true;

async function genNewPackageSizeFile(packages, output = tmpOutputPath) {
  const { stdout, stderr } = await exec(`package-size ${packages} --output ${output}`);
  if (stderr) throw stderr;

  return stdout;
}

async function getSizes(packages) {
  const tmpFile = genTempOutputPath();
  await genNewPackageSizeFile(packages, tmpFile);
  const generatedSizes = await getJSONFile(tmpFile);
  return generatedSizes;
}

async function getAllVersionsForPackage(packageName) {
  const { stdout } = await exec(`npm show ${packageName} versions --json`);
  const versions = JSON.parse(stdout);

  const filteredVersions = versions.filter(version => {
    const preReleaseParts = ["rc", "alpha", "beta"];
    if (tryExcludePreReleases) {
      return !preReleaseParts.some(pt => version.includes(pt));
    }
    return true;
  });

  return filteredVersions;
}

async function getReleaseTime(package, version) {
  const arg = version ? `${package}@${version}` : package;
  const { stdout, stderr } = await exec(`npm view ${arg} time --json`);
  if (stderr) throw stderr;

  const npmViewTime = JSON.parse(stdout);

  return version ? npmViewTime[version] : npmViewTime;
}

function getAllPackageVersions(packageName) {
  return Promise.all([getAllVersionsForPackage(packageName), getReleaseTime(packageName)]).then(
    ([allVersions, releases]) => {
      const versions = allVersions.map(version => {
        return {
          version,
          release: releases[version],
          name: packageName,
        };
      });
      return versions;
    }
  );
}

async function getSizesOfVersions(packageReleases) {
  packageReleases =
    packageReleases.length > chunk_size
      ? packageReleases.slice(packageReleases.length - chunk_size, packageReleases.length)
      : packageReleases;

  const chunked = _.chunk(packageReleases, chunk_size);

  const allSizes = await Promise.all(
    chunked.map(async chunk => {
      const psInput = chunk.map(v => `${v.name}@${v.version}`).join(" ");
      const sizeOutput = await getSizes(psInput);

      return sizeOutput.map((size, i) => {
        const versionInfo = chunk[i];

        return {
          gzipped: size.gzipped,
          minified: size.minified,
          name: versionInfo.name,
          release: versionInfo.release,
          size: size.size,
          version: versionInfo.version,
          versionedName: size.versionedName,
        };
      });
    })
  );

  return _.flatten(allSizes);
}

async function getPackageSizes(packageName) {
  const reactVersions = await getAllPackageVersions(packageName);
  const packageSizes = await getSizesOfVersions(reactVersions);
  return packageSizes;
}

async function test(packageName) {
  const sizes = await getPackageSizes(packageName);
  console.log(sizes);
}

test("react");

module.exports = getPackageSizes;
