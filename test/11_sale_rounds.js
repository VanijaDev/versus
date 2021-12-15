const VersusToken = artifacts.require("./VersusToken.sol");
const LaunchpoolStaking = artifacts.require("./LaunchpoolStaking.sol");
const VersusLaunchpool = artifacts.require("./VersusLaunchpool.sol");

const {
  BN,
  ether,
  balance,
  constants,
  expectEvent,
  expectRevert,
  time,
} = require('@openzeppelin/test-helpers');

contract("SaleRounds", function (accounts) {
  const OWNER = accounts[0];
  const OTHER = accounts[1];

  const STAKE_REQUIRED = ether("500");
  const LOCK_PERIOD = 300;  //  5 min
  const MAX_CAP = ether("700");
  const ALLOCATION_BASE = ether("100");
  const ALLOCATION_PRO = ether("200");

  let versusToken;
  let launchpoolStaking;
  let versusLaunchpool;

  beforeEach("setup", async function () {
    await time.advanceBlock();

    versusToken = await VersusToken.new();
    launchpoolStaking = await LaunchpoolStaking.new(versusToken.address, LOCK_PERIOD, STAKE_REQUIRED);
    versusLaunchpool = await VersusLaunchpool.new(versusToken.address, MAX_CAP, launchpoolStaking.address, ALLOCATION_BASE, ALLOCATION_PRO);
  });
  
  describe("isPublicSale", function () {
    it("should be false by default", async function () {
      assert.isFalse(await versusLaunchpool.isPublicSale.call(), "should be false");
    });
  });

  describe("enablePublicSale", function () {
    it("should fail if not owner", async function () {
      await expectRevert(versusLaunchpool.enablePublicSale(true, { from: OTHER }), "caller is not the owner");
    });

    it("should fail if already Is private", async function () {
      await expectRevert(versusLaunchpool.enablePublicSale(false), "Is private");
    });

    it("should fail if already Is public", async function () {
      await versusLaunchpool.enablePublicSale(true);
      await expectRevert(versusLaunchpool.enablePublicSale(true), "Is public");
    });

    it("should set to private", async function () {
      await versusLaunchpool.enablePublicSale(true);
      await versusLaunchpool.enablePublicSale(false);
      assert.isFalse(await versusLaunchpool.isPublicSale.call(), "should be false");
    });

    it("should set to public", async function () {
      await versusLaunchpool.enablePublicSale(true);
      assert.isTrue(await versusLaunchpool.isPublicSale.call(), "should be true");
    });
  });
});