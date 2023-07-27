const Vroom = artifacts.require("Vroom");
const UniswapV2Router02 = artifacts.require("UniswapV2Router02");
const UniswapV2Factory = artifacts.require("UniswapV2Factory");

let routerAddr = "";
let factoryAddr = "";

let ethLPAmountInt = 0;

module.exports = async function (deployer, network, [owner]) {
  if (network.startsWith("sepolia")) {
    routerAddr = "0xC532a74256D3Db42D0Bf7a0400fEFDbad7694008";
    factoryAddr = "0x7E0987E5b3a30e3f2828572Bb659A548460a3003";
    ethLPAmountInt = 1;
  }

  if (network.startsWith("ethereum") || network.startsWith("development")) {
    routerAddr = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";
    factoryAddr = "0x5c69bee701ef814a2b6a3edd4b1652cb9cc5aa6f";
    ethLPAmountInt = 25;
  }

  if (!routerAddr || !factoryAddr) {
    console.log("Missing router or factory address to create LP");
    return;
  }

  if (!ethLPAmountInt) {
    console.log("Missing ETH LP amount to create LP");
    return;
  }

  const vroom = await Vroom.deployed();
  const routerContract = await UniswapV2Router02.at(routerAddr);
  const factoryContract = await UniswapV2Factory.at(factoryAddr);
  const WETH = await routerContract.WETH.call();
  const tenMinutes = Math.floor((Date.now() + 10 * 60 * 1000) / 1000);

  const ethLPAmount = web3.utils.toWei(web3.utils.BN(ethLPAmountInt));
  const vroomLPAmount = web3.utils.toWei(web3.utils.BN(2090700000));

  // we exclude routerAddr from trading ban
  // this allows us to create the LP
  await vroom.addExcludedFromMaxTxAmount(routerAddr);
  console.log(`UniSwap Router address excluded from max tx amount √`);

  const {
    logs: [{ args }],
  } = await factoryContract.createPair(vroom.address, WETH, { from: owner });
  console.log(`AMM pair created √ (${args.pair})`);

  await vroom.addAMMPair(args.pair);
  console.log(`AMM pair added to VROOM contract √`);

  await vroom.approve(routerAddr, vroomLPAmount.toString(), { from: owner });
  const allowance = (await vroom.allowance.call(owner, routerAddr)).toString();
  console.log(`VROOM approved to spend by router √ (${allowance})`);

  await routerContract.addLiquidityETH(
    vroom.address,
    vroomLPAmount.toString(),
    vroomLPAmount.toString(),
    ethLPAmount.toString(),
    owner,
    tenMinutes,
    { from: owner, value: ethLPAmount.toString() }
  );

  console.log("LP created √");
};
