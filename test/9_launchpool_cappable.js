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

contract("Cappable", function (accounts) {
  const OWNER = accounts[0];
  const OTHER = accounts[1];
  const PLAYER_BASE_0 = accounts[2];
  const PLAYER_BASE_1 = accounts[3];
  const PLAYER_PRO_0 = accounts[4];
  const PLAYER_PRO_1 = accounts[5];
  const PLAYER_PRO_2 = accounts[6];
  const PLAYER_PRIORITY_0 = accounts[7];
  const PLAYER_PRIORITY_1 = accounts[8];

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

    //  versusToken
    await versusToken.mint(OTHER, ether("10000"));
    await versusToken.mint(PLAYER_BASE_0, ether("10000"));
    await versusToken.mint(PLAYER_BASE_1, ether("10000"));
    await versusToken.mint(PLAYER_PRO_0, ether("10000"));
    await versusToken.mint(PLAYER_PRO_1, ether("10000"));
    await versusToken.mint(PLAYER_PRO_2, ether("10000"));
    await versusToken.mint(PLAYER_PRIORITY_0, ether("10000"));
    await versusToken.mint(PLAYER_PRIORITY_1, ether("10000"));

    
    await versusToken.approve(versusLaunchpool.address, ether("50000"), { from: OTHER });
    await versusToken.approve(versusLaunchpool.address, ether("50000"), { from: PLAYER_BASE_0 });
    await versusToken.approve(versusLaunchpool.address, ether("50000"), { from: PLAYER_BASE_1 });
    await versusToken.approve(versusLaunchpool.address, ether("50000"), { from: PLAYER_PRO_0 });
    await versusToken.approve(versusLaunchpool.address, ether("50000"), { from: PLAYER_PRO_1 });
    await versusToken.approve(versusLaunchpool.address, ether("50000"), { from: PLAYER_PRO_2 });
    await versusToken.approve(versusLaunchpool.address, ether("50000"), { from: PLAYER_PRIORITY_0 });
    await versusToken.approve(versusLaunchpool.address, ether("50000"), { from: PLAYER_PRIORITY_1 });

    await versusLaunchpool.addInvestorsBase([PLAYER_BASE_0, PLAYER_BASE_1]);
    await versusLaunchpool.addInvestorsPro([PLAYER_PRO_0, PLAYER_PRO_1, PLAYER_PRO_2]);
  });
  
  describe("Constructor", function () {
    it("should set correct maxCap", async function () {
      assert.isTrue((await versusLaunchpool.maxCap.call()).eq(MAX_CAP), "wrong maxCap");
    });
  });

  describe("updateMaxCap", function () {
    it("should fail to updateMaxCap if not owner", async function () {
      await expectRevert(versusLaunchpool.updateMaxCap(ether("777"), { from: OTHER }), "caller is not the owner");
    });

    it("should set correct maxCap", async function () {
      await versusLaunchpool.updateMaxCap(ether("777"));
      assert.isTrue((await versusLaunchpool.maxCap.call()).eq(ether("777")), "wrong maxCap after");
    });

    it("should fail if Wrong maxCap (already made deposits more that value)", async function () {
      await versusLaunchpool.deposit({ from: PLAYER_PRO_0 });
      await expectRevert(versusLaunchpool.updateMaxCap(ether("77")), "Wrong maxCap");
    });

    it("should update maxCap", async function () {
      await versusLaunchpool.updateMaxCap(ether("77"));
      assert.isTrue((await versusLaunchpool.maxCap.call()).eq(ether("77")), "wrong maxCap");
    });
  });

});