const hre = require("hardhat");

async function main() {

  const FileNFT = await hre.ethers.getContractFactory("FileNFT");

  const nft = await FileNFT.deploy();

  await nft.waitForDeployment();

  console.log("NFT Contract deployed to:", await nft.getAddress());

}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});