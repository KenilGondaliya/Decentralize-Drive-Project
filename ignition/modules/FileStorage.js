const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("FileStorageModule", (m) => {

  // Deploy Upload contract
  const upload = m.contract("Upload");

  // Deploy FileNFT contract
  const fileNFT = m.contract("FileNFT");

  return { upload, fileNFT };
});