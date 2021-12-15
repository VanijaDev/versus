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

contract("VersusLaunchpool", function (accounts) {
  const OWNER = accounts[0];
  const OTHER = accounts[1];
  const PLAYER_BASE_0 = accounts[2];
  const PLAYER_BASE_1 = accounts[3];
  const PLAYER_PRO_0 = accounts[4];
  const PLAYER_PRO_1 = accounts[5];
  const PLAYER_PRO_2 = accounts[6];
  const PLAYER_PRIORITY_0 = accounts[7];
  const PLAYER_PRIORITY_1 = accounts[8];
  const PLAYER_PRO_NO_BALANCE = accounts[9];

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
    await versusToken.approve(versusLaunchpool.address, ether("50000"), { from: PLAYER_PRO_NO_BALANCE });


    await versusToken.approve(launchpoolStaking.address, ether("50000"), { from: PLAYER_BASE_0 });
    await versusToken.approve(launchpoolStaking.address, ether("50000"), { from: PLAYER_BASE_1 });

    await versusLaunchpool.addInvestorsBase([PLAYER_BASE_0, PLAYER_BASE_1]);
    await versusLaunchpool.addInvestorsPro([PLAYER_PRO_0, PLAYER_PRO_1, PLAYER_PRO_2, PLAYER_PRO_NO_BALANCE]);
  });
  
  describe("Constructor", function () {
    it("should set correct params", async function () {
      assert.isTrue((await versusLaunchpool.depositToken.call()) == versusToken.address, "wrong depositToken address");
      assert.isTrue((await versusLaunchpool.maxCap.call()).eq(MAX_CAP), "wrong maxCap");
      assert.isTrue((await versusLaunchpool.stakingPool.call()) == launchpoolStaking.address, "wrong stakingPool address");
      assert.isTrue((await versusLaunchpool.allocationInvestorBase.call()).eq(ALLOCATION_BASE), "wrong ALLOCATION_BASE");
      assert.isTrue((await versusLaunchpool.allocationInvestorPro.call()).eq(ALLOCATION_PRO), "wrong ALLOCATION_PRO");
    });
  });

  describe("deposit", function () {
    it("should fail if paused", async function () {
      await versusLaunchpool.pause(true);
      await expectRevert(versusLaunchpool.deposit({ from: PLAYER_BASE_0 }), "paused");
    });
    
    it("should fail if not allowed investor, PRIVATE round", async function () {
      await expectRevert(versusLaunchpool.deposit({ from: OTHER }), "not allowed investor");
    });
    
    it("should fail is pool stake required, PRIVATE round, InvestorType.Base", async function () {
      await expectRevert(versusLaunchpool.deposit({ from: PLAYER_BASE_0 }), "pool stake required");
    });

    it("should fail is pool stake required, PUBLIC round, InvestorType.Base", async function () {
      await versusLaunchpool.enablePublicSale(true);
      await expectRevert(versusLaunchpool.deposit({ from: PLAYER_BASE_0 }), "pool stake required");
    });

    it("should fail is pool stake required, PUBLIC round, not investor", async function () {
      await versusLaunchpool.enablePublicSale(true);
      await expectRevert(versusLaunchpool.deposit({ from: OTHER }), "pool stake required");
    });
    
    it("should fail if deposit made", async function () {
      await versusLaunchpool.deposit({ from: PLAYER_PRO_0 });
      await expectRevert(versusLaunchpool.deposit({ from: PLAYER_PRO_0 }), "deposit made");
    });
    
    it("should fail if not enough balance VERSUS", async function () {
      await expectRevert(versusLaunchpool.deposit({ from: PLAYER_PRO_NO_BALANCE }), "not enough balance");
    });
    
    it("should fail if Max cap reached", async function () {
      await versusLaunchpool.deposit({ from: PLAYER_PRO_0 });
      await versusLaunchpool.deposit({ from: PLAYER_PRO_1 });
      await versusLaunchpool.deposit({ from: PLAYER_PRO_2 });
      
      await launchpoolStaking.stake({ from: PLAYER_BASE_0 });
      await launchpoolStaking.stake({ from: PLAYER_BASE_1 });
      await time.increase(time.duration.seconds(1));
      await versusLaunchpool.deposit({ from: PLAYER_BASE_0 });

      await expectRevert(versusLaunchpool.deposit({ from: PLAYER_BASE_1 }), "Max cap reached");
    });
    
    it("should transfer correct VERSUS from sender to Smart Contract", async function () {
      assert.isTrue((await versusToken.balanceOf(versusLaunchpool.address)).eq(ether("0")), "should be 0 before");
      
      //  0
      await versusLaunchpool.deposit({ from: PLAYER_PRO_0 });
      assert.isTrue((await versusToken.balanceOf(versusLaunchpool.address)).eq(ether("200")), "should be 200 after");

      //  1
      await versusLaunchpool.deposit({ from: PLAYER_PRO_1 });
      assert.isTrue((await versusToken.balanceOf(versusLaunchpool.address)).eq(ether("400")), "should be 400 after");
    });
    
    it("should increase depositsTotal", async function () {
      assert.isTrue((await versusLaunchpool.depositsTotal.call()).eq(ether("0")), "should be 0 before");
      
      //  0
      await versusLaunchpool.deposit({ from: PLAYER_PRO_0 });
      assert.isTrue((await versusLaunchpool.depositsTotal.call()).eq(ether("200")), "should be 200 before");

      //  1
      await versusLaunchpool.deposit({ from: PLAYER_PRO_1 });
      assert.isTrue((await versusLaunchpool.depositsTotal.call()).eq(ether("400")), "should be 400 before");
    });
    
    it("should set depositOf", async function () {
      //  Pro
      assert.isTrue((await versusLaunchpool.depositOf.call(PLAYER_PRO_0)).eq(ether("0")), "wrong before");
      await versusLaunchpool.deposit({ from: PLAYER_PRO_0 });
      assert.isTrue((await versusLaunchpool.depositOf.call(PLAYER_PRO_0)).eq(ALLOCATION_PRO), "wrong after");

      //  Priority
      await versusLaunchpool.addInvestorPriority(PLAYER_PRIORITY_0, ether("1"));
      assert.isTrue((await versusLaunchpool.depositOf.call(PLAYER_PRIORITY_0)).eq(ether("0")), "wrong before, PLAYER_PRIORITY_0");
      await versusLaunchpool.deposit({ from: PLAYER_PRIORITY_0 });
      assert.isTrue((await versusLaunchpool.depositOf.call(PLAYER_PRIORITY_0)).eq(ether("1")), "wrong after, PLAYER_PRIORITY_0");
    });
  });

  describe("withdrawAllDeposits", function () {
    it("should fail if not owner", async function () {
      await expectRevert(versusLaunchpool.withdrawAllDeposits(OTHER, { from: OTHER }), "caller is not the owner");
    });
    
    it("should withdraw all tokens", async function () {
      assert.isTrue((await versusToken.balanceOf.call(OWNER)).eq(ether("0")), "wrong before");
      await versusLaunchpool.deposit({ from: PLAYER_PRO_0 });

      await versusLaunchpool.withdrawAllDeposits(OWNER);
      assert.isTrue((await versusToken.balanceOf.call(OWNER)).eq(ALLOCATION_PRO), "wrong after");
    });
  });
});