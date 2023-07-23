var Vroom = artifacts.require("Vroom");

module.exports = async function (deployer, network, accounts) {
  if (network !== "test") {
    const vroom = await Vroom.deployed();

    // Transfer team tokens to DEV WALLET
    await vroom.transfer(
      "0x2e38856eB6F2a0aAF13cE7ce98e34901884c517C",
      web3.utils.toWei(web3.utils.BN(300000000))
    );
  }
};
