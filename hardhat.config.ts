import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat"
import { task, HardhatUserConfig } from "hardhat/config";
import { resolve } from "path";

import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: resolve(__dirname, "./.env") });

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

module.exports = {
  solidity: '0.8.3',
  typechain: {
    outDir: 'typechain',
    target: 'ethers-v5',
    alwaysGenerateOverloads: false // should overloads with full signatures like deposit(uint256) be generated always, even if there are no overloads?
  }
}

