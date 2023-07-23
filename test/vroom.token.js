const truffleAssert = require("truffle-assertions");

const Vroom = artifacts.require("Vroom");

contract("Vroom::Token", (accounts) => {
  const totalSupply = web3.utils.toWei(web3.utils.BN(3_000_000_000));

  it("should deploy and have the right params", async () => {
    const vroom = await Vroom.deployed();
    expect(await vroom.owner.call()).to.equal(accounts[0]);
    expect(await vroom.name.call()).to.equal("VROOM");
    expect(await vroom.symbol.call()).to.equal("VROOM");
    expect((await vroom.decimals.call()).toString()).to.equal("18");
    expect((await vroom.totalSupply.call()).toString()).to.equal(
      totalSupply.toString()
    );
  });

  it("should mint the total supply to deployer", async () => {
    const vroom = await Vroom.deployed();
    expect(await vroom.owner.call()).to.equal(accounts[0]);
    expect((await vroom.balanceOf.call(accounts[0])).toString()).to.equal(
      totalSupply.toString()
    );
  });

  it("should transfer without fees", async () => {
    const vroom = await Vroom.deployed();

    const amount = web3.utils.toWei(web3.utils.BN(1_000_000_000));
    await vroom.transfer(accounts[1], amount.toString());

    expect((await vroom.balanceOf.call(accounts[0])).toString()).to.equal(
      totalSupply.sub(amount).toString()
    );
    expect((await vroom.balanceOf.call(accounts[1])).toString()).to.equal(
      amount.toString()
    );
  });

  it("should not be able to transfer more than balance", async () => {
    const vroom = await Vroom.deployed();

    const balance = await vroom.balanceOf.call(accounts[0]);
    const amount = balance.mul(web3.utils.toBN(2));

    await truffleAssert.reverts(
      vroom.transfer(accounts[2], amount.toString()),
      "Insufficient balance"
    );

    expect((await vroom.balanceOf.call(accounts[0])).toString()).to.equal(
      balance.toString()
    );
    expect((await vroom.balanceOf.call(accounts[2])).toString()).to.equal("0");
  });

  it("should not be able to transfer from not owner unless trading is enabled", async () => {
    const vroom = await Vroom.deployed();

    const balance = await vroom.balanceOf.call(accounts[1]);
    const amount = balance.div(web3.utils.toBN(2));

    await truffleAssert.reverts(
      vroom.transfer(accounts[2], amount.toString(), { from: accounts[1] }),
      "Trading not enabled"
    );

    await vroom.enableTrading();
    await vroom.transfer(accounts[2], amount.toString(), { from: accounts[1] });
  });

  it("should be able to update fees", async () => {
    const vroom = await Vroom.deployed();

    const currBuyFees = await vroom.buyFees.call();
    const currSellFees = await vroom.sellFees.call();

    expect(currBuyFees.toString()).to.equal("30");
    expect(currSellFees.toString()).to.equal("30");

    await truffleAssert.reverts(
      vroom.updateFees(10, 20, { from: accounts[1] }),
      "Only owner can update fees"
    );

    await vroom.updateFees(10, 20);

    const newBuyFees = await vroom.buyFees.call();
    const newSellFees = await vroom.sellFees.call();

    expect(newBuyFees.toString()).to.equal("10");
    expect(newSellFees.toString()).to.equal("20");
  });

  it("should renounce ownership", async () => {
    const vroom = await Vroom.deployed();
    expect(await vroom.owner.call()).to.equal(accounts[0]);

    await vroom.renounceOwnership();
    expect(await vroom.owner.call()).to.equal(
      "0x0000000000000000000000000000000000000000"
    );
  });
});
