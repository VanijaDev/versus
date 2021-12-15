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

contract("StakeRequired", function (accounts) {
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


    await versusToken.approve(launchpoolStaking.address, ether("50000"), { from: PLAYER_BASE_0 });

    await versusLaunchpool.addInvestorsBase([PLAYER_BASE_0, PLAYER_BASE_1]);
    await versusLaunchpool.addInvestorsPro([PLAYER_PRO_0, PLAYER_PRO_1, PLAYER_PRO_2]);
  });
  
  describe("Constructor", function () {
    it("should set correct stakingPool", async function () {
      assert.isTrue((await versusLaunchpool.stakingPool.call()) == launchpoolStaking.address, "wrong stakingPool address");
    });
  });

  describe("updateStakingPool", function () {
    it("should fail if not owner", async function () {
      await expectRevert(versusLaunchpool.updateStakingPool(OTHER, { from: OTHER }), "caller is not the owner");
    });

    it("should set correct stakingPool", async function () {
      await versusLaunchpool.updateStakingPool(OTHER);
      assert.isTrue((await versusLaunchpool.stakingPool.call()) == OTHER, "wrong stakingPool address, should be OTHER");
    });
  });

  describe("isStakeRequiredMadeFor", function () {
    it("should return true if stake made and before LOCK_PERIOD", async function () {
      assert.isFalse((await versusLaunchpool.isStakeRequiredMadeFor.call(PLAYER_BASE_0)), "should be false");
      await launchpoolStaking.stake({ from: PLAYER_BASE_0 });
      await time.increase(time.duration.seconds(1));
      assert.isTrue((await versusLaunchpool.isStakeRequiredMadeFor.call(PLAYER_BASE_0)), "should be true");
    });

    it("should return false if stake made and after LOCK_PERIOD", async function () {
      assert.isFalse((await versusLaunchpool.isStakeRequiredMadeFor.call(PLAYER_BASE_0)), "should be false");
      await launchpoolStaking.stake({ from: PLAYER_BASE_0 });
      
      //  0
      await time.increase(time.duration.seconds(LOCK_PERIOD));
      assert.isFalse((await versusLaunchpool.isStakeRequiredMadeFor.call(PLAYER_BASE_0)), "should be false, 0");

      //  1
      await time.increase(time.duration.seconds(LOCK_PERIOD));
      assert.isFalse((await versusLaunchpool.isStakeRequiredMadeFor.call(PLAYER_BASE_0)), "should be false, 1");
    });

    it("should return false if stake not made", async function () {
      assert.isFalse((await versusLaunchpool.isStakeRequiredMadeFor.call(PLAYER_BASE_0)), "should be false");
    });
  });
});