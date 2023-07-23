const preSales = require('../data/pre-sales.json')

var Vroom = artifacts.require("Vroom");

module.exports = async function (deployer, network, accounts) {
  if (network !== "test") {
    const vroom = await Vroom.deployed();

    const addresses = preSales.map((preSale) => preSale[0]);
    const amounts = preSales.map((preSale) =>
      web3.utils.toWei(web3.utils.BN(preSale[1]))
    );

    const fillUp = 100 - addresses.length;
    for (let i = 0; i < fillUp; i++) {
      addresses.push("0x0000000000000000000000000000000000000000");
      amounts.push(web3.utils.toWei(web3.utils.BN(0)));
    }

    await vroom.multiTransfer(addresses, amounts);
  }
};
