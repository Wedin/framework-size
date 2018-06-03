// Group by , and separate groups with space
const reactPackages = ["react", "react-dom", "react-router", "redux"];
const vuePackages = ["vue", "vue-router", "vuex"];
const frameworksList = `${reactPackages.join(",")} ${vuePackages.join(",")}`;

const tmpOutputPath = "./src/tmp-package-sizes.json";
const genOutputPath = () => {
  return `./src/tmp-package-sizes-${+new Date()}.json`;
};
const outputFilePath = "./src/framework-sizes.json";

const util = require("util");
const _ = require("lodash");
const exec = util.promisify(require("child_process").exec);

const { getJSONFile, writeJSONFile } = require("./fileUtils");

async function generateNewSizeFile(packages, output = tmpOutputPath) {
  const { stdout, stderr } = await exec(`package-size ${packages} --output ${output}`);
  if (stderr) throw stderr;

  return stdout;
}

async function getSizes(packages) {
  const tmpFile = genOutputPath();
  await generateNewSizeFile(packages, tmpFile);
  const generatedSizes = await getJSONFile(tmpFile);
  return generatedSizes;
}

const includePreReleases = false;
async function getAllVersionsForPackage(packageName) {
  const { stdout } = await exec(`npm show ${packageName} versions --json`);
  const versions = JSON.parse(stdout);

  const filteredVersions = versions.filter(version => {
    const preReleaseParts = ["rc", "alpha", "beta"];
    if (!includePreReleases) {
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

  const view = JSON.parse(stdout);

  return version ? view[version] : view;
}

function getVersions(packageName) {
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

async function sizeVersions(packageReleases) {
  packageReleases = [
    packageReleases[packageReleases.length - 1],
    packageReleases[packageReleases.length - 2],
    packageReleases[packageReleases.length - 3],
  ];

  const chunked = _.chunk(packageReleases, 10);

  console.log(chunked);
  const all = chunked.map(chunk => {
    const psInput = chunk.map(v => `${v.name}@${v.version}`);
    const sizes = getSizes(psInput.join(" ")).then(sizes => {
      return {
        gzipped: sizes.gzipped,
        minified: sizes.minified,
        name: chunk.name,
        release: chunk.release,
        size: sizes.size,
        version: chunk.version,
        versionedName: sizes.versionedName,
      };
    });
  });

  console.log("all", all);
  return all;
}

function packageSizeUpdater(packageSizes) {
  function addPackageSize(packageSize) {
    if (!packageSizes[packageSize.name]) {
      packageSizes[packageSize.name] = [packageSize];
      return true;
    }

    const found = packageSizes[packageSize.name].find(elem => elem.versionedName === packageSize.versionedName);
    if (!found) {
      packageSizes[packageSize.name].push(packageSize);
      return true;
    }
    return false;
  }
  return {
    addPackageSize,
    packageSizes,
  };
}

// Let's not 🌶
async function updateAllSizesFromFile() {
  try {
    const generatedSizes = await getJSONFile(tmpOutputPath);
    const oldSizes = await getJSONFile(outputFilePath);
    const packageSizer = packageSizeUpdater(oldSizes);

    generatedSizes.map(packageSize => {
      packageSizer.addPackageSize(packageSize);
    });

    await writeJSONFile(outputFilePath, packageSizer.packageSizes);
  } catch (error) {
    throw error;
  }
}

async function generate() {
  await generateNewSizeFile(frameworksList);
  await updateAllSizesFromFile();
}

getVersions("react").then(x => {
  sizeVersions(x).then(y => console.log(y));
});
