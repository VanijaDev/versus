const VersusToken = artifacts.require("./VersusToken.sol");
const LaunchpoolStaking = artifacts.require("./LaunchpoolStaking.sol");

const {
  BN,
  ether,
  balance,
  constants,
  expectEvent,
  expectRevert,
  time,
} = require('@openzeppelin/test-helpers');

contract("LaunchpoolStaking", function (accounts) {
  const OWNER = accounts[0];
  const OTHER = accounts[1];
  const PLAYER_0 = accounts[2];
  const PLAYER_1 = accounts[3];
  const PLAYER_NO_TOKENS = accounts[4];

  const STAKE_REQUIRED = ether("500");
  const LOCK_PERIOD = 300;  //  5 min

  let versusToken;
  let launchpoolStaking;

  beforeEach("setup", async function () {
    await time.advanceBlock();

    versusToken = await VersusToken.new();
    launchpoolStaking = await LaunchpoolStaking.new(versusToken.address, LOCK_PERIOD, STAKE_REQUIRED);

    //  versusToken
    await versusToken.mint(OWNER, ether("10"));
    await versusToken.mint(PLAYER_0, ether("10000"));
    await versusToken.mint(PLAYER_1, ether("10000"));
    await versusToken.mint(OTHER, ether("9000"));

    await versusToken.approve(launchpoolStaking.address, ether("50000"));
    await versusToken.approve(launchpoolStaking.address, ether("50000"), {
      from: PLAYER_0
    });
    await versusToken.approve(launchpoolStaking.address, ether("50000"), {
      from: PLAYER_1
    });
    await versusToken.approve(launchpoolStaking.address, ether("50000"), {
      from: OTHER
    });
  });
  
  describe("Constructor", function () {
    it("should set correct versusToken", async function () {
      assert.equal(await launchpoolStaking.versusToken.call(), versusToken.address, "Wrong versusToken");
    });

    it("should set correct lockPeriod", async function () {
      assert.equal(await launchpoolStaking.lockPeriod.call(), LOCK_PERIOD, "Wrong lockPeriod");
    });

    it("should set correct stakeRequired", async function () {
      assert.equal(0, (await launchpoolStaking.stakeRequired.call()).cmp(STAKE_REQUIRED), "Wrong stakeRequired");
    });

    it("should set correct apy", async function () {
      assert.equal(0, (await launchpoolStaking.apy.call()).cmp(new BN("250")), "Wrong apy");
    });
  });

  describe("updateAPY", function () {
    it("should fail in not owner", async function () {
      await expectRevert(launchpoolStaking.updateAPY(100, {
        from: OTHER
      }), "caller is not the owner");
    });

    it("should set correct value", async function () {
      assert.isTrue((await launchpoolStaking.apy.call()).eq(new BN(250)), "wrong before");
      await launchpoolStaking.updateAPY(100);
      assert.isTrue((await launchpoolStaking.apy.call()).eq(new BN(100)), "wrong after");
    });
  });

  describe("updateStakeRequired", function () {
    it("should fail in not owner", async function () {
      await expectRevert(launchpoolStaking.updateStakeRequired(100, {
        from: OTHER
      }), "caller is not the owner");
    });

    it("should set correct value", async function () {
      assert.isTrue((await launchpoolStaking.stakeRequired.call()).eq(ether("500")), "wrong before");
      await launchpoolStaking.updateStakeRequired(ether("100"));
      assert.isTrue((await launchpoolStaking.stakeRequired.call()).eq(ether("100")), "wrong after");
    });
  });

  describe("updateLockPeriod", function () {
    it("should fail in not owner", async function () {
      await expectRevert(launchpoolStaking.updateLockPeriod(1, {
        from: OTHER
      }), "caller is not the owner");
    });

    it("should set correct lockPeriod", async function () {
      assert.isTrue((await launchpoolStaking.lockPeriod.call()).eq(new BN(LOCK_PERIOD.toString())), "wrong before");
      await launchpoolStaking.updateLockPeriod(1);
      assert.isTrue((await launchpoolStaking.lockPeriod.call()).eq(new BN("1")), "wrong after");
    });
  });

  describe("getVersusBalance", function () {
    it("should return correct balance", async function () {
      //  0
      assert.isTrue((await launchpoolStaking.getVersusBalance.call()).eq(ether("0")), "should 0");

      //  1
      await launchpoolStaking.stake({ from: PLAYER_0});
      assert.isTrue((await launchpoolStaking.getVersusBalance.call()).eq(STAKE_REQUIRED), "should be 500");
    
      //  2
      await launchpoolStaking.stake({ from: PLAYER_1});
      assert.isTrue((await launchpoolStaking.getVersusBalance.call()).eq(ether("1000")), "should be 1000");

      //  3 - withdraw
      await time.increase(time.duration.minutes(10));
      await launchpoolStaking.unstake({from: PLAYER_0});
      assert.isTrue((await launchpoolStaking.getVersusBalance.call()).eq(STAKE_REQUIRED), "should be 500 after unstake");
    });
  });

  describe("stake", function () {
    it("should fail if paused", async function () {
      await launchpoolStaking.pause(true);
      await expectRevert(launchpoolStaking.stake({ from: PLAYER_0 }), "paused");
    });

    it("should fail if Stake made", async function () {
      await launchpoolStaking.stake({ from: PLAYER_0 });
      await expectRevert(launchpoolStaking.stake({ from: PLAYER_0 }), "Stake made");
    });

    it("should set stakeOf with correct params", async function () {
      let stake = await launchpoolStaking.stakeOf.call(PLAYER_0);
      assert(stake.timeAt.eq(new BN("0")), "timeAt should be 0 before");
      assert(stake.lockPeriodUntil.eq(new BN("0")), "lockPeriodUntil should be 0 before");

      const stakeAt = await time.latest();
      await launchpoolStaking.stake({ from: PLAYER_0 });
      await time.increase(time.duration.minutes(1));

      stake = await launchpoolStaking.stakeOf.call(PLAYER_0);
      assert.isTrue(stake.timeAt.eq(new BN(stakeAt)), "wrong timeAt after");
      assert.isTrue(stake.lockPeriodUntil.eq(new BN(parseInt(stakeAt) + parseInt(LOCK_PERIOD))), "wrong lockPeriodUntil after");
    });

    it("should set stakeRequiredOf", async function () {
      //  0
      await launchpoolStaking.stake({ from: PLAYER_0 });
      assert.isTrue((await launchpoolStaking.stakeRequiredOf.call(PLAYER_0)).eq(STAKE_REQUIRED), "wrong stakeRequiredOf before");

      //  1
      await launchpoolStaking.updateStakeRequired(ether("100"));
      await launchpoolStaking.stake({ from: PLAYER_1 });
      assert.isTrue((await launchpoolStaking.stakeRequiredOf.call(PLAYER_1)).eq(ether("100")), "wrong stakeRequiredOf after");

    });

    it("should emit StakeMade with correct params", async function () {
      const receipt = await launchpoolStaking.stake({ from: PLAYER_0 });

      expectEvent(receipt, 'StakeMade', {
        _from: PLAYER_0
      });
    });
  });

  describe("calculateAvailableVersusReward", function () {
    it("should return 0 if no stake made", async function () {
      assert.isTrue((await launchpoolStaking.calculateAvailableVersusReward.call({ from: PLAYER_0 })).eq(new BN("0")), "should be 0");
    });

    it("should return 0 if timeAt >= lockPeriodUntil", async function () {
      await launchpoolStaking.stake({ from: PLAYER_0 });
      await time.increase(time.duration.minutes(10));
      await launchpoolStaking.withdrawAvailableReward({ from: PLAYER_0 });
      assert.equal(0, (await launchpoolStaking.calculateAvailableVersusReward.call({ from: PLAYER_0 })).cmp(ether("0")), "wrong amount, should be 0");
    });

    it("should return 0 if timeAt >= lockPeriodUntil if stakeRequired updated", async function () {
      await launchpoolStaking.stake({ from: PLAYER_0 });

      await time.increase(time.duration.minutes(10));
      await launchpoolStaking.withdrawAvailableReward({ from: PLAYER_0 });
      assert.equal(0, (await launchpoolStaking.calculateAvailableVersusReward.call({ from: PLAYER_0 })).cmp(ether("0")), "wrong amount, should be 0");
    });

    it("should return correct amount if before lockPeriodUntil", async function () {
      await launchpoolStaking.stake({ from: PLAYER_0 });
      await time.increase(time.duration.minutes(1));
      
      //  0 
      //  250*10^18 - 250% APY
      //  31536000 - seconds in year
      const percentagePerSec = new BN("7927447995941"); //  250*10^18 / 31536000
      let reward = ether("500").mul(percentagePerSec).mul(time.duration.minutes(1)).div(ether("100"));
      assert.equal(0, (await launchpoolStaking.calculateAvailableVersusReward.call({ from: PLAYER_0 })).cmp(reward), "wrong amount 0");

      //  1
      await time.increase(time.duration.minutes(2));
      reward = ether("500").mul(percentagePerSec).mul(time.duration.minutes(3)).div(ether("100"));
      assert.equal(0, (await launchpoolStaking.calculateAvailableVersusReward.call({ from: PLAYER_0 })).cmp(reward), "wrong amount 1");
    });

    it("should return correct amount if before lockPeriodUntil if stakeRequired updated", async function () {
      await launchpoolStaking.stake({ from: PLAYER_0 });
      await time.increase(time.duration.minutes(1));

      await launchpoolStaking.updateStakeRequired(ether("100"));
      
      //  0 
      //  250*10^18 - 250% APY
      //  31536000 - seconds in year
      const percentagePerSec = new BN("7927447995941"); //  250*10^18 / 31536000
      let reward = ether("500").mul(percentagePerSec).mul(time.duration.minutes(1)).div(ether("100"));
      assert.equal(0, (await launchpoolStaking.calculateAvailableVersusReward.call({ from: PLAYER_0 })).cmp(reward), "wrong amount 0");

      //  1
      await time.increase(time.duration.minutes(2));
      await launchpoolStaking.updateStakeRequired(ether("200"));

      reward = ether("500").mul(percentagePerSec).mul(time.duration.minutes(3)).div(ether("100"));
      assert.equal(0, (await launchpoolStaking.calculateAvailableVersusReward.call({ from: PLAYER_0 })).cmp(reward), "wrong amount 1");
    });

    it("should return correct amount if before lockPeriodUntil & already withdrawAvailableReward", async function () {
      await launchpoolStaking.stake({ from: PLAYER_0 });
      await time.increase(time.duration.minutes(1));
      
      //  0 
      //  250*10^18 - 250% APY
      //  31536000 - seconds in year
      const percentagePerSec = new BN("7927447995941"); //  250*10^18 / 31536000
      await launchpoolStaking.withdrawAvailableReward({ from: PLAYER_0 });

      //  1
      await time.increase(time.duration.minutes(2));
      let reward = ether("500").mul(percentagePerSec).mul(time.duration.minutes(2)).div(ether("100"));
      assert.equal(0, (await launchpoolStaking.calculateAvailableVersusReward.call({ from: PLAYER_0 })).cmp(reward), "wrong amount 1");

      //  2
      await time.increase(time.duration.minutes(12));
      reward = ether("500").mul(percentagePerSec).mul(time.duration.minutes(4)).div(ether("100"));
      assert.equal(0, (await launchpoolStaking.calculateAvailableVersusReward.call({ from: PLAYER_0 })).cmp(reward), "wrong amount if >= lockPeriodUntil");
    });

    it("should return correct amount if before lockPeriodUntil & already withdrawAvailableReward if stakeRequired updated", async function () {
      await launchpoolStaking.stake({ from: PLAYER_0 });
      await time.increase(time.duration.minutes(1));
      
      //  0 
      //  250*10^18 - 250% APY
      //  31536000 - seconds in year
      const percentagePerSec = new BN("7927447995941"); //  250*10^18 / 31536000
      await launchpoolStaking.withdrawAvailableReward({ from: PLAYER_0 });

      await launchpoolStaking.updateStakeRequired(ether("100"));

      //  1
      await time.increase(time.duration.minutes(2));
      let reward = ether("500").mul(percentagePerSec).mul(time.duration.minutes(2)).div(ether("100"));
      assert.equal(0, (await launchpoolStaking.calculateAvailableVersusReward.call({ from: PLAYER_0 })).cmp(reward), "wrong amount 1");

      //  2
      await time.increase(time.duration.minutes(12));
      await launchpoolStaking.updateStakeRequired(ether("200"));

      reward = ether("500").mul(percentagePerSec).mul(time.duration.minutes(4)).div(ether("100"));
      assert.equal(0, (await launchpoolStaking.calculateAvailableVersusReward.call({ from: PLAYER_0 })).cmp(reward), "wrong amount if >= lockPeriodUntil");
    });

    it("should return correct amount if after lockPeriodUntil", async function () {
      await launchpoolStaking.stake({ from: PLAYER_0 });
      await time.increase(time.duration.minutes(10));
      
      //  0 
      //  250*10^18 - 250% APY
      //  31536000 - seconds in year
      const percentagePerSec = new BN("7927447995941"); //  250*10^18 / 31536000
      let reward = ether("500").mul(percentagePerSec).mul(time.duration.minutes(5)).div(ether("100"));
      assert.equal(0, (await launchpoolStaking.calculateAvailableVersusReward.call({ from: PLAYER_0 })).cmp(reward), "wrong amount 0");
      
      //  1
      await time.increase(time.duration.minutes(10));
      assert.equal(0, (await launchpoolStaking.calculateAvailableVersusReward.call({ from: PLAYER_0 })).cmp(reward), "wrong amount 1");
    });

    it("should return correct amount if after lockPeriodUntil if stakeRequired updated", async function () {
      await launchpoolStaking.stake({ from: PLAYER_0 });
      await time.increase(time.duration.minutes(10));
      await launchpoolStaking.updateStakeRequired(ether("100"));
      
      //  0 
      //  250*10^18 - 250% APY
      //  31536000 - seconds in year
      const percentagePerSec = new BN("7927447995941"); //  250*10^18 / 31536000
      let reward = ether("500").mul(percentagePerSec).mul(time.duration.minutes(5)).div(ether("100"));
      assert.equal(0, (await launchpoolStaking.calculateAvailableVersusReward.call({ from: PLAYER_0 })).cmp(reward), "wrong amount 0");
      
      //  1
      await launchpoolStaking.updateStakeRequired(ether("200"));
      await time.increase(time.duration.minutes(10));
      assert.equal(0, (await launchpoolStaking.calculateAvailableVersusReward.call({ from: PLAYER_0 })).cmp(reward), "wrong amount 1");
    });

    it("should return 0 unstaken", async function () {
      await launchpoolStaking.stake({ from: PLAYER_0 });
      await time.increase(time.duration.minutes(6));
      await launchpoolStaking.unstake({ from: PLAYER_0 });
      assert.equal(0, (await launchpoolStaking.calculateAvailableVersusReward.call({ from: PLAYER_0 })).cmp(ether("0")), "wrong amount, should be 0");
    });
  });

  describe("withdrawAvailableReward", function () {
    it("should fail is paused", async function () {
      await launchpoolStaking.stake({ from: PLAYER_0 });
      await time.increase(time.duration.minutes(2));
      
      await launchpoolStaking.pause(true);
      await expectRevert(launchpoolStaking.withdrawAvailableReward({ from: PLAYER_0 }), "paused");
    });

    it("should fail if No reward", async function () {
      await launchpoolStaking.stake({ from: PLAYER_0 });
      await expectRevert(launchpoolStaking.withdrawAvailableReward({ from: PLAYER_0 }), "No reward");

      await time.increase(time.duration.minutes(1));
      await launchpoolStaking.withdrawAvailableReward({ from: PLAYER_0 });
      await expectRevert(launchpoolStaking.withdrawAvailableReward({ from: PLAYER_0 }), "No reward");
    });

    it("should transfer correct amount to player", async function () {
      await launchpoolStaking.stake({ from: PLAYER_0 });
      await time.increase(time.duration.minutes(2));
    
      const tokensBefore = await versusToken.balanceOf.call(PLAYER_0);
      const percentagePerSec = new BN("7927447995941"); //  250*10^18 / 31536000
      let reward = ether("500").mul(percentagePerSec).mul(time.duration.minutes(2)).div(ether("100"));
      await launchpoolStaking.withdrawAvailableReward({ from: PLAYER_0 });
      const tokensAfter = await versusToken.balanceOf.call(PLAYER_0);
      
      assert.isTrue(reward.eq(tokensAfter.sub(tokensBefore)), "wrong balance");
    });

    it("should set timeAt to now", async function () {
      const stakeAt = await time.latest();
      await launchpoolStaking.stake({ from: PLAYER_0 });
      await time.increase(time.duration.minutes(2));
    
      let stake = await launchpoolStaking.stakeOf.call(PLAYER_0);
      assert.isTrue(stake.timeAt.eq(new BN(stakeAt)), "wrong timeAt before");
      await launchpoolStaking.withdrawAvailableReward({ from: PLAYER_0 });

      stake = await launchpoolStaking.stakeOf.call(PLAYER_0);
      assert.isTrue(stake.timeAt.eq(await time.latest()), "wrong timeAt after");
    });

    it("should emit RewardWithdrawn", async function () {
      await launchpoolStaking.stake({ from: PLAYER_0 });
      await time.increase(time.duration.minutes(2));

      const percentagePerSec = new BN("7927447995941"); //  250*10^18 / 31536000
      let reward = ether("500").mul(percentagePerSec).mul(time.duration.minutes(2)).div(ether("100"));

      const receipt = await launchpoolStaking.withdrawAvailableReward({ from: PLAYER_0 });
      expectEvent(receipt, 'RewardWithdrawn', {
        _to: PLAYER_0,
        _amount: reward
      });
    });
  });
  
  describe("unstake", function () {
    it("should fail if paused", async function () {
      await launchpoolStaking.stake({ from: PLAYER_0 });
      await time.increase(time.duration.minutes(10));

      await launchpoolStaking.pause(true);
      await expectRevert(launchpoolStaking.unstake({ from: PLAYER_0 }), "paused");
    });

    it("should fail if no stake", async function () {
      await expectRevert(launchpoolStaking.unstake({ from: PLAYER_0 }), "no stake");
    });

    it("should fail if too early", async function () {
      await launchpoolStaking.stake({ from: PLAYER_0 });
      await time.increase(time.duration.minutes(1));

      await expectRevert(launchpoolStaking.unstake({ from: PLAYER_0 }), "too early");
    });

    it("should withdraw correct amount (reward + staken) in reward present", async function () {
      await launchpoolStaking.stake({ from: PLAYER_0 });
      await time.increase(time.duration.minutes(6));

      const tokensBefore = await versusToken.balanceOf.call(PLAYER_0);
      const percentagePerSec = new BN("7927447995941"); //  250*10^18 / 31536000
      let reward = ether("500").mul(percentagePerSec).mul(time.duration.minutes(5)).div(ether("100"));
      await launchpoolStaking.unstake({ from: PLAYER_0 });
      const tokensAfter = await versusToken.balanceOf.call(PLAYER_0);
      
      assert.isTrue((reward.add(STAKE_REQUIRED)).eq(tokensAfter.sub(tokensBefore)), "wrong balance");
    });

    it("should withdraw correct amount (reward + staken) in reward present if stakeRequired updated", async function () {
      await launchpoolStaking.updateStakeRequired(ether("100"));

      await launchpoolStaking.stake({ from: PLAYER_0 });
      await time.increase(time.duration.minutes(6));

      await launchpoolStaking.updateStakeRequired(ether("200"));

      const tokensBefore = await versusToken.balanceOf.call(PLAYER_0);
      const percentagePerSec = new BN("7927447995941"); //  250*10^18 / 31536000
      let reward = ether("100").mul(percentagePerSec).mul(time.duration.minutes(5)).div(ether("100"));
      await launchpoolStaking.unstake({ from: PLAYER_0 });
      const tokensAfter = await versusToken.balanceOf.call(PLAYER_0);
      
      assert.isTrue((reward.add(ether("100"))).eq(tokensAfter.sub(tokensBefore)), "wrong balance");
    });

    it("should delete stakeOf", async function () {
      await launchpoolStaking.stake({ from: PLAYER_0 });
      await time.increase(time.duration.minutes(6));
      await launchpoolStaking.unstake({ from: PLAYER_0 });
      
      let stake = await launchpoolStaking.stakeOf.call(PLAYER_0);
      assert.isTrue(stake.timeAt.eq(new BN("0")), "wrong timeAt, should be 0");
      assert.isTrue(stake.lockPeriodUntil.eq(new BN("0")), "wrong lockPeriodUntil, should be 0");
    });

    it("should emit UnstakeMade", async function () {
      await launchpoolStaking.stake({ from: PLAYER_0 });
      await time.increase(time.duration.minutes(6));
      
      const receipt = await launchpoolStaking.unstake({ from: PLAYER_0 });
      expectEvent(receipt, 'UnstakeMade', {
        _from: PLAYER_0
      });
    });
  });

  describe("pause", function () {
    it("should fail if not owner", async function () {
      await expectRevert(launchpoolStaking.pause(true, { from: OTHER }), "caller is not the owner");
    });

    it("should change paused", async function () {
      //  paused
      await launchpoolStaking.pause(true);
      assert.isTrue(await launchpoolStaking.paused.call(), "should set paused");

      //  unpaused
      await launchpoolStaking.pause(false);
      assert.isFalse(await launchpoolStaking.paused.call(), "should set unpaused");
    });
  });
});