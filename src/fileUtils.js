const fs = require("fs");
const util = require("util");

const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);

async function getJSONFile(path) {
  try {
    const file = await readFile(path);
    return JSON.parse(file);
  } catch (error) {
    throw error;
  }
}

async function writeJSONFile(path, content) {
  return writeFile(path, JSON.stringify(content, null, 2));
}

module.exports = {
  getJSONFile,
  writeJSONFile,
};
