// Group by , and separate groups with space
const frameworksList = "vue,vue-router,vuex react,react-dom,react-router,redux";

const psOutputFile = "package-sizes.json";
const frameworkSizesFile = "framework-sizes.json";

const util = require("util");
const fs = require("fs");
const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);
const exec = util.promisify(require("child_process").exec);

async function getJSONFile(path) {
  try {
    const file = await readFile(path);
    return JSON.parse(file);
  } catch (error) {
    throw error;
  }
}

async function writeJsonFile(path, content) {
  try {
    console.log("saving", JSON.stringify(content));
    return await writeFile(path, JSON.stringify(content));
  } catch (error) {
    throw error;
  }
}

async function generateNewSizeFile() {
  await exec(`package-size ${frameworksList} --output ${psOutputFile}`);
}

function packageSizeUpdater(packageSizes) {
  packageSizes = packageSizes;
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
    const generatedSizes = await getJSONFile(`./${psOutputFile}`);
    const oldSizes = await getJSONFile(`./${frameworkSizesFile}`);
    const packageSizer = packageSizeUpdater(oldSizes);

    generatedSizes.map(packageSize => {
      packageSizer.addPackageSize(packageSize);
    });

    await writeFile(`./${frameworkSizesFile}`, JSON.stringify(packageSizer.packageSizes, null, 2));
  } catch (error) {
    console.log("err");
    throw error;
  }
}

async function generate() {
  await generateNewSizeFile();
  await updateAllSizesFromFile();
}

generate();
