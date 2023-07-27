const truffleAssert = require("truffle-assertions");

const Vroom = artifacts.require("Vroom");
const UniswapV2Router02 = artifacts.require("UniswapV2Router02");
const UniswapV2Factory = artifacts.require("UniswapV2Factory");

contract("Vroom::Trading", async ([owner, trader]) => {
  const routerAddr = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";
  const factoryAddr = "0x5c69bee701ef814a2b6a3edd4b1652cb9cc5aa6f";
  const burnWallet = "0x000000000000000000000000000000000000dead";

  const tenMinutes = () => Math.floor((Date.now() + 10 * 60 * 1000) / 1000);

  const raisedAmount = web3.utils.toWei(web3.utils.BN(16));
  const lpAmount = web3.utils.toWei(web3.utils.BN(1_530_000_000));

  // uniswap pair address
  let pair = "";

  before(async () => {
    const vroom = await Vroom.deployed();
    await vroom.addExcludedFromMaxTxAmount(routerAddr);
  });

  it("should create Uniswap Pair and `addAMMPair` on contract", async () => {
    const vroom = await Vroom.deployed();
    const routerContract = await UniswapV2Router02.at(routerAddr);
    const factoryContract = await UniswapV2Factory.at(factoryAddr);

    const WETH = await routerContract.WETH.call();

    const {
      logs: [{ args }],
    } = await factoryContract.createPair(vroom.address, WETH, {
      from: owner,
    });

    // we save pair in test scope
    // we need it for next tests
    pair = args.pair;

    await truffleAssert.reverts(
      vroom.addAMMPair(pair, { from: trader }),
      "Only owner can add AMM pair"
    );

    await vroom.addAMMPair(pair);
    expect(await vroom.ammPairs(pair)).to.equal(true);

    await truffleAssert.reverts(
      vroom.addAMMPair(pair),
      "AMM pair already added"
    );
  });

  it("should add liquidity to UniSwap LP", async () => {
    const vroom = await Vroom.deployed();
    const routerContract = await UniswapV2Router02.at(routerAddr);

    await vroom.approve(routerAddr, lpAmount.toString(), { from: owner });
    expect((await vroom.allowance.call(owner, routerAddr)).toString()).to.equal(
      lpAmount.toString()
    );

    await routerContract.addLiquidityETH(
      vroom.address,
      lpAmount.toString(),
      lpAmount.toString(),
      raisedAmount.toString(),
      owner,
      tenMinutes(),
      { from: owner, value: raisedAmount.toString() }
    );

    expect((await vroom.balanceOf.call(pair)).toString()).to.equal(
      lpAmount.toString()
    );
  });

  it("should not allow trading before it's enabled", async () => {
    const vroom = await Vroom.deployed();
    const routerContract = await UniswapV2Router02.at(routerAddr);
    const WETH = await routerContract.WETH.call();

    await truffleAssert.reverts(
      routerContract.swapExactETHForTokensSupportingFeeOnTransferTokens(
        "1",
        [WETH, vroom.address],
        trader,
        tenMinutes(),
        { from: trader, value: "300000000000000000" }
      )
    );

    expect((await vroom.balanceOf.call(trader)).toString()).to.equal("0");
    expect((await vroom.balanceOf.call(burnWallet)).toString()).to.equal("0");
  });

  it("should allow buying after trading is enabled", async () => {
    const vroom = await Vroom.deployed();
    const routerContract = await UniswapV2Router02.at(routerAddr);
    const WETH = await routerContract.WETH.call();

    await vroom.enableTrading();
    await routerContract.swapExactETHForTokensSupportingFeeOnTransferTokens(
      "1",
      [WETH, vroom.address],
      trader,
      tenMinutes(),
      { from: trader, value: "300000000000000000" }
    );

    const traderBalance = await vroom.balanceOf.call(trader);
    expect(traderBalance.toString()).to.not.equal("0");

    const taxWalletBalance = await vroom.balanceOf.call(burnWallet);
    expect(taxWalletBalance.toString()).to.not.equal("0");
  });

  it("should allow selling after trading is enabled", async () => {
    const vroom = await Vroom.deployed();
    const routerContract = await UniswapV2Router02.at(routerAddr);
    const WETH = await routerContract.WETH.call();

    const beforeEthTraderBalance = await web3.eth.getBalance(trader);
    const beforeTraderBalance = await vroom.balanceOf.call(trader);
    const beforeTaxBalance = await vroom.balanceOf.call(burnWallet);

    await vroom.approve(routerAddr, beforeTraderBalance.toString(), {
      from: trader,
    });

    await routerContract.swapExactTokensForETHSupportingFeeOnTransferTokens(
      beforeTraderBalance.toString(),
      "1",
      [vroom.address, WETH],
      trader,
      tenMinutes(),
      { from: trader }
    );

    const afterEthTraderBalance = await web3.eth.getBalance(trader);
    const afterTraderBalance = await vroom.balanceOf.call(trader);
    const afterTaxBalance = await vroom.balanceOf.call(burnWallet);

    expect(afterTraderBalance.toString()).to.equal("0");
    expect(afterEthTraderBalance.toString()).to.not.equal(
      beforeEthTraderBalance.toString()
    );
    expect(afterTaxBalance.toString()).to.not.equal(
      beforeTaxBalance.toString()
    );
  });

  it("should set tax to 0 and continue trading correctly", async () => {
    const vroom = await Vroom.deployed();
    const routerContract = await UniswapV2Router02.at(routerAddr);
    const WETH = await routerContract.WETH.call();

    const beforeTraderBalance = await vroom.balanceOf.call(trader);

    await vroom.updateFees(0, 0);
    await routerContract.swapExactETHForTokensSupportingFeeOnTransferTokens(
      "1",
      [WETH, vroom.address],
      trader,
      tenMinutes(),
      { from: trader, value: "300000000000000000" }
    );


    const afterTraderBalance = await vroom.balanceOf.call(trader);
    expect(afterTraderBalance.gt(beforeTraderBalance)).to.equal(true);

    console.log(beforeTraderBalance.toString(), afterTraderBalance.toString());
  })
});
