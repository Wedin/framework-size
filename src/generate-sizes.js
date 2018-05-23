// Group by , and separate groups with space
const reactPackages = ["react", "react-dom", "react-router", "redux"];
const vuePackages = ["vue", "vue-router", "vuex"];
const frameworksList = `${reactPackages.join(",")} ${vuePackages.join(",")}`;

const tmpOutputFile = "package-sizes.json";
const outputFilePath = "./src/framework-sizes.json";

const util = require("util");
const exec = util.promisify(require("child_process").exec);

const { getJSONFile, writeJSONFile } = require("./fileUtils");

async function generateNewSizeFile() {
  // Group by , and separate groups with space
  await exec(`package-size ${frameworksList} --output ${tmpOutputFile}`);
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
  const { stdout } = await exec(`npm view ${arg} time --json`);
  const view = JSON.parse(stdout);

  return version ? view[version] : view;
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

async function updateAllSizesFromFile() {
  try {
    const generatedSizes = await getJSONFile(`./${tmpOutputFile}`);
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
  await generateNewSizeFile();
  await updateAllSizesFromFile();
}

generate();
// getReleaseTime("react", "16.3.0")
// getPackageVersion("react");
