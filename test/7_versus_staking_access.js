const VersusToken = artifacts.require("./VersusToken.sol");
const VersusAccessToken = artifacts.require("./VersusAccessToken.sol");
const VersusStakingAccess = artifacts.require("./VersusStakingAccess.sol");

const {
  BN,
  ether,
  balance,
  constants,
  expectEvent,
  expectRevert,
  time,
} = require('@openzeppelin/test-helpers');

contract("VersusStakingAccess", function (accounts) {
  const OWNER = accounts[0];
  const OTHER = accounts[1];
  const PLAYER_0 = accounts[2];
  const PLAYER_1 = accounts[3];

  const MIN_TOTAL_STAKE = ether("1000");
  const MAX_TOTAL_STAKE = ether("3000");

  let versusToken;
  let versusAccessToken;
  let versusStakingAccess;

  beforeEach("setup", async function () {
    await time.advanceBlock();

    versusToken = await VersusToken.new();
    versusAccessToken = await VersusAccessToken.new();
    versusStakingAccess = await VersusStakingAccess.new(versusToken.address, versusAccessToken.address);
    await versusAccessToken.updateStakingAddress(versusStakingAccess.address);

    //  versusToken
    await versusToken.mint(OWNER, ether("10"));
    await versusToken.mint(PLAYER_0, ether("10000"));
    await versusToken.mint(PLAYER_1, ether("10000"));
    await versusToken.mint(OTHER, ether("9000"));

    await versusToken.approve(versusStakingAccess.address, ether("10000"));
    await versusToken.approve(versusStakingAccess.address, ether("50000"), {
      from: PLAYER_0
    });
    await versusToken.approve(versusStakingAccess.address, ether("50000"), {
      from: PLAYER_1
    });
    await versusToken.approve(versusStakingAccess.address, ether("50000"), {
      from: OTHER
    });

    //  versusAccessToken
    await versusAccessToken.mint(new BN("1"), PLAYER_0);
  });
  
  describe("Constructor", function () {
    it("should set correct versusToken", async function () {
      assert.equal(await versusStakingAccess.versusToken.call(), versusToken.address, "Wrong versusToken");
    });

    it("should set correct versusAccessToken", async function () {
      assert.equal(await versusStakingAccess.versusAccessToken.call(), versusAccessToken.address, "Wrong versusAccessToken");
    });

    it("should set correct minStake", async function () {
      assert.equal(0, (await versusStakingAccess.minStake.call()).cmp(ether("0.1")), "Wrong minStake");
    });

    it("should set correct minTotalStake", async function () {
      assert.equal(0, (await versusStakingAccess.minTotalStake.call()).cmp(ether("1000")), "Wrong minTotalStake");
    });

    it("should set correct maxTotalStake", async function () {
      assert.equal(0, (await versusStakingAccess.maxTotalStake.call()).cmp(ether("3000")), "Wrong maxTotalStake");
    });

    it("should set correct apy", async function () {
      assert.equal(0, (await versusStakingAccess.apy.call()).cmp(new BN("500")), "Wrong apy");
    });
  });

  describe("updateMinStake", function () {
    it("should fail if not owner", async function () {
      await expectRevert(versusStakingAccess.updateMinStake(ether("1"), {
        from: OTHER
      }), "Ownable: caller is not the owner");
    });

    it("should set correct minStake", async function () {
      assert.equal(0, (await versusStakingAccess.minStake.call()).cmp(ether("0.1")), "Wrong minStake before");
      await versusStakingAccess.updateMinStake(ether("0.2"));
      assert.equal(0, (await versusStakingAccess.minStake.call()).cmp(ether("0.2")), "Wrong minStake after");
    });
  });

  describe("updateMinTotalStake", function () {
    it("should fail if not owner", async function () {
      await expectRevert(versusStakingAccess.updateMinTotalStake(ether("1"), {
        from: OTHER
      }), "Ownable: caller is not the owner");
    });

    it("should set correct updateMinTotalStake", async function () {
      assert.equal(0, (await versusStakingAccess.minTotalStake.call()).cmp(ether("1000")), "Wrong minTotalStake before");
      await versusStakingAccess.updateMinTotalStake(ether("0.12"));
      assert.equal(0, (await versusStakingAccess.minTotalStake.call()).cmp(ether("0.12")), "Wrong minTotalStake after");
    });
  });

  describe("updateMaxTotalStake", function () {
    it("should fail if not owner", async function () {
      await expectRevert(versusStakingAccess.updateMaxTotalStake(ether("1"), {
        from: OTHER
      }), "Ownable: caller is not the owner");
    });

    it("should set correct updateMaxTotalStake", async function () {
      assert.equal(0, (await versusStakingAccess.maxTotalStake.call()).cmp(ether("3000")), "Wrong maxTotalStake before");
      await versusStakingAccess.updateMaxTotalStake(ether("2000"));
      assert.equal(0, (await versusStakingAccess.maxTotalStake.call()).cmp(ether("2000")), "Wrong maxTotalStake after");
    });
  });

  describe("updateAPY", function () {
    it("should fail if not owner", async function () {
      await expectRevert(versusStakingAccess.updateAPY(ether("1"), {
        from: OTHER
      }), "Ownable: caller is not the owner");
    });

    it("should set correct updateMaxTotalStake", async function () {
      assert.equal(0, (await versusStakingAccess.apy.call()).cmp(new BN("500")), "Wrong apy before");
      await versusStakingAccess.updateAPY(new BN("600"));
      assert.equal(0, (await versusStakingAccess.apy.call()).cmp(new BN("600")), "Wrong apy after");
    });
  });

  describe("stake", function () {
    it("should fail if paused", async function () {
      await versusStakingAccess.pause(true);
      await expectRevert(versusStakingAccess.stake(MIN_TOTAL_STAKE, {
        from: PLAYER_0
      }), "Pausable: paused");
    });

    it("should fail if No access", async function () {
      await expectRevert(versusStakingAccess.stake(MIN_TOTAL_STAKE, {
        from: PLAYER_1
      }), "No access");
    });

    it("should fail if initial stake & < minTotalStake", async function () {
      await expectRevert(versusStakingAccess.stake(ether("1"), {
        from: PLAYER_0
      }), "< minTotalStake");
    });

    it("should fail if Wrong amount", async function () {
      await versusStakingAccess.stake(MIN_TOTAL_STAKE, {
        from: PLAYER_0
      });
      await expectRevert(versusStakingAccess.stake(ether("0.01"), {
        from: PLAYER_0
      }), "Wrong amount");
    });

    it("should fail if > maxTotalStake", async function () {
      //  0
      await expectRevert(versusStakingAccess.stake(MAX_TOTAL_STAKE.add(ether("1")), {
        from: PLAYER_0
      }), "> maxTotalStake");

      //  1
      await versusStakingAccess.stake(MIN_TOTAL_STAKE, {
        from: PLAYER_0
      });
      await expectRevert(versusStakingAccess.stake(MAX_TOTAL_STAKE, {
        from: PLAYER_0
      }), "> maxTotalStake");
    });

    it("should update savedVersusRewardOf", async function () {
      //  500*10^18 - 500% APY
      //  31536000 - seconds in year
      const percentagePerSec = new BN("15854895991882"); //  500*10^18 / 31536000

      await versusStakingAccess.stake(ether("1000"), {
        from: PLAYER_0
      });
      const SEC_0 = 2400; //  40 min
      await time.increase(time.duration.seconds(SEC_0));

      //  0
      await versusStakingAccess.stake(ether("0.22"), {
        from: PLAYER_0
      });
      
      const reward_0 = ether("1000").mul(percentagePerSec).mul(new BN(SEC_0)).div(ether("100"));
      // console.log("reward_0:                 ", reward_0.toString()); //  1000000000000000000000 * 15854895991882 * 2400 / 100000000000000000000 = 380517503805168000
      // console.log("getSavedVersusRewardOf 0: ", (await versusStakingAccess.getSavedVersusRewardOf(PLAYER_0)).toString());
      assert.equal(0, (await versusStakingAccess.getSavedVersusRewardOf(PLAYER_0)).cmp(reward_0), "wrong saved reward after 0");

      const SEC_1 = 4500; //  75 min
      await time.increase(time.duration.seconds(SEC_1));

      //  1
      await versusStakingAccess.stake(ether("0.3"), {
        from: PLAYER_0
      });

      const reward_1 = ether("1000.22").mul(percentagePerSec).mul(new BN(SEC_1)).div(ether("100"));
      // console.log("reward_1:                   ", reward_1.toString()); //  1000220000000000000000 * 15854895991882 * 4500 / 100000000000000000000 = 713627283105009632
      // console.log("getSavedVersusRewardOf 1:   ", (await versusStakingAccess.getSavedVersusRewardOf(PLAYER_0)).toString());
      // console.log("reward_0.add(reward_1):     ", (reward_0.add(reward_1)).toString());
      assert.equal(0, (await versusStakingAccess.getSavedVersusRewardOf(PLAYER_0)).cmp(reward_0.add(reward_1)), "wrong saved reward after 1");
      

      await versusStakingAccess.updateAPY(new BN("111"));
      const SEC_2 = new BN("3000"); //  50 min
      await time.increase(time.duration.seconds(SEC_2));

      //  2
      await versusStakingAccess.stake(ether("0.13"), {
        from: PLAYER_0
      });

      const percentagePerSec_upd = new BN("3519786910197"); //  111*10^18 / 31536000
      const reward_2 = ether("1000.52").mul(percentagePerSec_upd).mul(SEC_2).div(ether("100"));
      assert.equal(0, (await versusStakingAccess.getSavedVersusRewardOf(PLAYER_0)).cmp(reward_0.add(reward_1).add(reward_2)), "wrong saved reward after 2");
    });

    it("should not update saved reward if few transactions at the same time", async function () {
      await versusStakingAccess.stake(MIN_TOTAL_STAKE, {
        from: PLAYER_0
      });
      await versusStakingAccess.stake(ether("0.12"), {
        from: PLAYER_0
      });
      
      assert.equal(0, (await versusStakingAccess.getSavedVersusRewardOf(PLAYER_0)).cmp(new BN("0")), "wrong saved reward after 0");
    });

    it("should update Stake.timeAt", async function () {
      //  0
      await versusStakingAccess.stake(MIN_TOTAL_STAKE, {
        from: PLAYER_0
      });
      const time_0 = await time.latest();
      await time.increase(time.duration.seconds(3));

      let stakeBefore = await versusStakingAccess.getStakeOf.call(PLAYER_0);

      assert.isTrue((new BN(stakeBefore.timeAt)).eq(time_0), "timeAt should be now, 0");

      //  1
      await versusStakingAccess.stake(ether("0.2"), {
        from: PLAYER_0
      });

      let stakeAfter = await versusStakingAccess.getStakeOf.call(PLAYER_0);

      assert.isTrue((new BN(stakeAfter.timeAt)).gt(new BN(stakeBefore.timeAt)), "timeAt should be later, 1");
      assert.isTrue((new BN(stakeBefore.timeAt)).eq(time_0), "timeAt should be time_0");
      assert.isTrue((new BN(stakeAfter.timeAt)).eq(await time.latest()), "timeAt should be now, 1");
    });

    it("should update Stake.amount", async function () {
      //  0
      await versusStakingAccess.stake(MIN_TOTAL_STAKE, {
        from: PLAYER_0
      });
      await time.increase(time.duration.seconds(3));

      let stakeBefore = await versusStakingAccess.getStakeOf.call(PLAYER_0);
      assert.isTrue(ether(web3.utils.fromWei(stakeBefore.amount, 'ether')).eq(MIN_TOTAL_STAKE), "amount should be MIN_TOTAL_STAKE, 0");

      //  1
      await versusStakingAccess.stake(ether("0.2"), {
        from: PLAYER_0
      });

      let stakeAfter = await versusStakingAccess.getStakeOf.call(PLAYER_0);
      assert.isTrue(ether(web3.utils.fromWei(stakeAfter.amount, 'ether')).eq(ether("1000.2")), "amount should be 1000.2, 1");
    });

    it("should transfer correct VERSUS amount from sender to staking contract", async function () {
      //  0
      await versusStakingAccess.stake(MIN_TOTAL_STAKE, {
        from: PLAYER_0
      });
      
      assert.equal(0, (await versusToken.balanceOf.call(PLAYER_0)).cmp(ether("9000")), "should be 9000 for PLAYER_0");
      assert.equal(0, (await versusToken.balanceOf.call(versusStakingAccess.address)).cmp(MIN_TOTAL_STAKE), "should be MIN_TOTAL_STAKE for versusStakingAccess");

      await time.increase(time.duration.seconds(3));

      //  1
      await versusAccessToken.mint(new BN("1"), PLAYER_1);
      await versusStakingAccess.stake(MIN_TOTAL_STAKE, {
        from: PLAYER_1
      });
      
      assert.equal(0, (await versusToken.balanceOf.call(PLAYER_1)).cmp(ether("9000")), "should be 9000 for PLAYER_1");
      assert.equal(0, (await versusToken.balanceOf.call(versusStakingAccess.address)).cmp(ether("2000")), "should be 2000 for versusStakingAccess");

      await time.increase(time.duration.seconds(3));

      //  2
      await versusStakingAccess.stake(ether("0.5"), {
        from: PLAYER_0
      });
      
      assert.equal(0, (await versusToken.balanceOf.call(PLAYER_0)).cmp(ether("8999.5")), "should be 8999.5 for PLAYER_0");
      assert.equal(0, (await versusToken.balanceOf.call(versusStakingAccess.address)).cmp(ether("2000.5")), "should be 0.2 for versusStakingAccess");

      await time.increase(time.duration.seconds(3));
    });

    it("should emit StakeMade", async function () {
      await expectEvent(await await versusStakingAccess.stake(MIN_TOTAL_STAKE, { from: PLAYER_0 }), "StakeMade", {
        _from: PLAYER_0,
        _amount: MIN_TOTAL_STAKE
      });
    });

    it("should update VERSUS balance", async function () {
      //  0
      await versusStakingAccess.stake(MIN_TOTAL_STAKE, {
        from: PLAYER_0
      });

      assert.equal(0, (await versusStakingAccess.getVersusBalance.call()).cmp(ether("1000")), "should be 1000");
      await time.increase(time.duration.seconds(3));

      //  1
      await versusAccessToken.mint(new BN("1"), PLAYER_1);
      await versusStakingAccess.stake(MIN_TOTAL_STAKE, {
        from: PLAYER_1
      });

      assert.equal(0, (await versusStakingAccess.getVersusBalance.call()).cmp(ether("2000")), "should be 2000");
      await time.increase(time.duration.seconds(3));

      //  2
      await versusStakingAccess.stake(ether("0.5"), {
        from: PLAYER_0
      });
      
      assert.equal(0, (await versusStakingAccess.getVersusBalance.call()).cmp(ether("2000.5")), "should be 2000.5");
      await time.increase(time.duration.seconds(3));
    });
  });

  describe("calculateAvailableVersusReward", function () {
    //  500*10^18 - 500% APY
    //  31536000 - seconds in year
    const percentagePerSec = new BN("15854895991882"); //  500*10^18 / 31536000
    
    it("should return saved only", async function () {
      await versusStakingAccess.stake(MIN_TOTAL_STAKE, {
        from: PLAYER_0
      });
      const SEC_0 = 2400; //  40 min
      await time.increase(time.duration.seconds(SEC_0));

      await versusStakingAccess.stake(ether("0.22"), {
        from: PLAYER_0
      });

      const reward_0 = MIN_TOTAL_STAKE.mul(percentagePerSec).mul(new BN(SEC_0)).div(ether("100"));
      assert.equal(0, (await versusStakingAccess.calculateAvailableVersusReward.call({
        from: PLAYER_0
      })).cmp(reward_0), "wrong amount");
    });

    it("should return pending only", async function () {
      await versusStakingAccess.stake(MIN_TOTAL_STAKE, {
        from: PLAYER_0
      });
      const SEC_0 = 2400; //  40 min
      await time.increase(time.duration.seconds(SEC_0));

      const reward_0 = MIN_TOTAL_STAKE.mul(percentagePerSec).mul(new BN(SEC_0)).div(ether("100"));
      assert.equal(0, (await versusStakingAccess.calculateAvailableVersusReward.call({
        from: PLAYER_0
      })).cmp(reward_0), "wrong amount");
    });

    it("should return saved + pending", async function () {
      await versusStakingAccess.stake(MIN_TOTAL_STAKE, {
        from: PLAYER_0
      });
      const SEC_0 = 2400; //  40 min
      await time.increase(time.duration.seconds(SEC_0));

      await versusStakingAccess.stake(ether("0.22"), {
        from: PLAYER_0
      });

      const saved_0 = MIN_TOTAL_STAKE.mul(percentagePerSec).mul(new BN(SEC_0)).div(ether("100"));

      const SEC_1 = 4500; //  75 min
      await time.increase(time.duration.seconds(SEC_1));

      const pending_0 = ether("1000.22").mul(percentagePerSec).mul(new BN(SEC_1)).div(ether("100"));
      const availableReward = await versusStakingAccess.calculateAvailableVersusReward.call({
        from: PLAYER_0
      });

      //  available
      assert.equal(0, availableReward.cmp(saved_0.add(pending_0)), "wrong available amount");

      //  saved
      assert.equal(0, (await versusStakingAccess.getSavedVersusRewardOf(PLAYER_0)).cmp(saved_0), "wrong saved amount");

      //  pending
      assert.equal(0, availableReward.sub(saved_0).cmp(pending_0), "wrong pending amount");
    });
  });

  describe("withdrawAvailableReward", function () {
    it("should fail if paused", async function () {
      await versusStakingAccess.stake(MIN_TOTAL_STAKE, {
        from: PLAYER_0
      });
      const SEC_0 = 2400; //  40 min
      await time.increase(time.duration.seconds(SEC_0));
      
      await versusStakingAccess.pause(true);
      await expectRevert(versusStakingAccess.withdrawAvailableReward({
        from: PLAYER_0
      }), "Pausable: paused");
    });

    it("should fail if No reward", async function () {
      //  0
      await expectRevert(versusStakingAccess.withdrawAvailableReward({
        from: PLAYER_0
      }), "No reward");

      //  1
      await versusStakingAccess.stake(MIN_TOTAL_STAKE, {
        from: PLAYER_0
      });
      await expectRevert(versusStakingAccess.withdrawAvailableReward({
        from: PLAYER_0
      }), "No reward");
      
    });

    it("should delete savedVersusRewardOf & clear pending reward", async function () {
      //  0
      await versusStakingAccess.stake(MIN_TOTAL_STAKE, {
        from: PLAYER_0
      });
      const SEC_0 = 2400; //  40 min
      await time.increase(time.duration.seconds(SEC_0));

      //  1
      await versusStakingAccess.stake(ether("0.2"), {
        from: PLAYER_0
      });
      await time.increase(time.duration.seconds(SEC_0));

      assert.isTrue((await versusStakingAccess.getSavedVersusRewardOf(PLAYER_0)).gt(new BN("0")), "saved should be > 0");
      assert.isTrue((await versusStakingAccess.calculateAvailableVersusReward({
        from: PLAYER_0
      })).gt(new BN("0")), "pending should be > 0");

      //  withdraw
      await versusStakingAccess.withdrawAvailableReward({
        from: PLAYER_0
      });

      assert.isTrue((await versusStakingAccess.getSavedVersusRewardOf(PLAYER_0)).eq(new BN("0")), "saved should be == 0");
      assert.isTrue((await versusStakingAccess.calculateAvailableVersusReward({
        from: PLAYER_0
      })).eq(new BN("0")), "pending should be == 0");
    });

    it("should transfer correct VERSUS amount", async function () {
      await versusStakingAccess.stake(MIN_TOTAL_STAKE, {
        from: PLAYER_0
      });
      const SEC_0 = 2400; //  40 min
      await time.increase(time.duration.seconds(SEC_0));

      await versusStakingAccess.stake(ether("0.22"), {
        from: PLAYER_0
      });

      const SEC_1 = 4500; //  75 min
      await time.increase(time.duration.seconds(SEC_1));

      const availableReward = await versusStakingAccess.calculateAvailableVersusReward({
        from: PLAYER_0
      });

      const PLAYER_0_beforeAmount = await versusToken.balanceOf.call(PLAYER_0);

      await versusStakingAccess.withdrawAvailableReward({
        from: PLAYER_0
      });

      assert.equal(0, (await versusToken.balanceOf.call(PLAYER_0)).cmp(PLAYER_0_beforeAmount.add(availableReward)), "wrong balance after");
    });

    it("should set Stake.timeAt to now", async function () {
      await versusStakingAccess.stake(MIN_TOTAL_STAKE, {
        from: PLAYER_0
      });
      const time_0 = await time.latest();
      
      const SEC_0 = 2400; //  40 min
      await time.increase(time.duration.seconds(SEC_0));

      let stakeBefore = await versusStakingAccess.getStakeOf.call(PLAYER_0);
      assert.isTrue((new BN(stakeBefore.timeAt)).eq(time_0), "wrong timeAt before");

      await versusStakingAccess.withdrawAvailableReward({
        from: PLAYER_0
      });

      let stakeAfter = await versusStakingAccess.getStakeOf.call(PLAYER_0);
      assert.isTrue((new BN(stakeAfter.timeAt)).eq(await time.latest()), "wrong timeAt after");
    });

    it("should emit RewardWithdrawn", async function () {
      await versusStakingAccess.stake(MIN_TOTAL_STAKE, {
        from: PLAYER_0
      });
      
      const SEC_0 = 2400; //  40 min
      await time.increase(time.duration.seconds(SEC_0));

      const availableReward = await versusStakingAccess.calculateAvailableVersusReward({
        from: PLAYER_0
      });

      await expectEvent(await versusStakingAccess.withdrawAvailableReward({ from: PLAYER_0 }), "RewardWithdrawn", {
        _to: PLAYER_0,
        _amount: availableReward
      });
    });
  });

  describe("unstake", function () {
    beforeEach("stake", async function () {
       await versusStakingAccess.stake(MIN_TOTAL_STAKE, {
        from: PLAYER_0
      });
      await time.increase(time.duration.seconds("2400")); //  40 min
    });

    it("should fail if paused", async function () {
      await versusStakingAccess.pause(true);
      await expectRevert(versusStakingAccess.unstake({
        from: PLAYER_0
      }), "Pausable: paused");
    });
    
    it("should _calculateAvailableVersusReward == 0", async function () {
      assert.isTrue((await versusStakingAccess.calculateAvailableVersusReward.call({
        from: PLAYER_0
      })).gt(ether("0")), "should be > 0");

      await versusStakingAccess.unstake({ from: PLAYER_0 });

      assert.isTrue((await versusStakingAccess.calculateAvailableVersusReward.call({
        from: PLAYER_0
      })).eq(ether("0")), "should be == 0");
    });
    
    it("should delete stakeOf", async function () {
      let stake = await versusStakingAccess.getStakeOf.call(PLAYER_0);
      assert.isTrue(stake.timeAt > 0, "timeAt should be > 0");
      assert.isTrue(stake.amount > 0, "amount should be > 0");

      await versusStakingAccess.unstake({ from: PLAYER_0 });

      stake = await versusStakingAccess.getStakeOf.call(PLAYER_0);
      assert.isTrue(stake.timeAt == 0, "timeAt should be == 0"); 
      assert.isTrue(stake.amount == 0, "amount should be == 0"); 
    });
    
    it("should substract correct VERSUS amount from versusStakingAccess balance", async function () {
      await versusAccessToken.mint(new BN("1"), PLAYER_1);
       await versusAccessToken.mint(new BN("1"), OTHER);
      
      //  stake more
      await versusStakingAccess.stake(MIN_TOTAL_STAKE, {
        from: PLAYER_1
      });
      await time.increase(time.duration.seconds("2400")); //  40 min

      await versusStakingAccess.stake(ether("1002"), {
        from: OTHER
      });
      await time.increase(time.duration.seconds("2400")); //  40 min

      await versusStakingAccess.stake(ether("1.2"), {
        from: PLAYER_0
      });
      await time.increase(time.duration.seconds("2400")); //  40 min

      assert.isTrue((await versusToken.balanceOf(versusStakingAccess.address)).eq(ether("3003.2")), "wrong balance before");

      //  0
      await versusStakingAccess.unstake({ from: PLAYER_0 });
      assert.isTrue((await versusToken.balanceOf(versusStakingAccess.address)).eq(ether("2002")), "wrong balance 0");
      await time.increase(time.duration.seconds("2"));
      
      //  1
      await versusStakingAccess.unstake({ from: PLAYER_1 });
      assert.isTrue((await versusToken.balanceOf(versusStakingAccess.address)).eq(ether("1002")), "wrong balance 1");
      await time.increase(time.duration.seconds("2"));
      
      //  2
      await versusStakingAccess.unstake({ from: OTHER });
      assert.isTrue((await versusToken.balanceOf(versusStakingAccess.address)).eq(ether("0")), "wrong balance 2");
    });
    
    it("should transfer correct VERSUS amount from versusStakingAccess to sender", async function () {
      await versusAccessToken.mint(new BN("1"), PLAYER_1);
      await versusAccessToken.mint(new BN("1"), OTHER);
      
      //  stake more
      await versusStakingAccess.stake(MIN_TOTAL_STAKE, {
        from: PLAYER_1
      });
      await time.increase(time.duration.seconds("2400")); //  40 min

      await versusStakingAccess.stake(ether("1002"), {
        from: OTHER
      });
      await time.increase(time.duration.seconds("2400")); //  40 min

      await versusStakingAccess.stake(ether("1.2"), {
        from: PLAYER_0
      });
      await time.increase(time.duration.seconds("2400")); //  40 min

      //  unstake
      //  0
      assert.isTrue((await versusToken.balanceOf(PLAYER_0)).eq(ether("8998.8")), "wrong balance before for PLAYER_0");
      
      const reward_PLAYER_0 = await versusStakingAccess.calculateAvailableVersusReward.call({ from: PLAYER_0 });
      await versusStakingAccess.unstake({ from: PLAYER_0 });
      
      assert.isTrue((await versusToken.balanceOf(PLAYER_0)).eq(ether("10000").add(reward_PLAYER_0)), "wrong balance after for PLAYER_0");
      await time.increase(time.duration.seconds("2400"));

      //  1
      assert.isTrue((await versusToken.balanceOf(PLAYER_1)).eq(ether("9000")), "wrong balance before for PLAYER_1");
      
      const reward_PLAYER_1 = await versusStakingAccess.calculateAvailableVersusReward.call({ from: PLAYER_1 });
      await versusStakingAccess.unstake({ from: PLAYER_1 });
      
      assert.isTrue((await versusToken.balanceOf(PLAYER_1)).eq(ether("10000").add(reward_PLAYER_1)), "wrong balance after for PLAYER_1");
      await time.increase(time.duration.seconds("2400"));

      //  2
      assert.isTrue((await versusToken.balanceOf(OTHER)).eq(ether("7998")), "wrong balance before for OTHER");
      
      const reward_OTHER = await versusStakingAccess.calculateAvailableVersusReward.call({ from: OTHER });
      await versusStakingAccess.unstake({ from: OTHER });
      
      assert.isTrue((await versusToken.balanceOf(OTHER)).eq(ether("9000").add(reward_OTHER)), "wrong balance after for OTHER");
    });
    
    it("should emit RewardWithdrawn & emit UnstakeMade", async function () {
      const reward_PLAYER_0 = await versusStakingAccess.calculateAvailableVersusReward.call({ from: PLAYER_0 });
      const tx = await versusStakingAccess.unstake({ from: PLAYER_0 });

      await expectEvent(tx, "RewardWithdrawn", {
        _to: PLAYER_0,
        _amount: reward_PLAYER_0
      });

      await expectEvent(tx, "UnstakeMade", {
        _from: PLAYER_0,
        _amount: MIN_TOTAL_STAKE
      });
    });
  });

  describe("onLastTokenTransfer", function () {
    beforeEach("stake", async function () {
      await versusAccessToken.mint(new BN("1"), PLAYER_1);
      
      await versusStakingAccess.stake(MIN_TOTAL_STAKE, {
        from: PLAYER_0
      });
      await time.increase(time.duration.seconds("2400")); //  40 min
    });

    it("should fail if Wrong sender", async function () {
      await expectRevert(versusStakingAccess.onLastTokenTransfer(OTHER, {from: OTHER}), "Wrong sender");
    });

    it("should not unstake if no stake", async function () {
      const tx = await versusAccessToken.transfer(OTHER, 1, { from: PLAYER_1 });

      assert.isTrue(tx.logs.length == 1, "should be 1 event");
      await expectEvent(tx, "Transfer", {
        from: PLAYER_1,
        to: OTHER,
        value: new BN("1")
      });
    });

    it("should unstake - transfer correct VERSUS to user", async function () {
      assert.isTrue((await versusToken.balanceOf(PLAYER_0)).eq(ether("9000")), "wrong balance before");

      const reward_PLAYER_0 = await versusStakingAccess.calculateAvailableVersusReward.call({ from: PLAYER_0 });
      await versusAccessToken.transfer(OTHER, 1, { from: PLAYER_0 });

      assert.isTrue((await versusToken.balanceOf(PLAYER_0)).eq(ether("10000").add(reward_PLAYER_0)), "wrong balance after");
    });

    it("should unstake - update VERSUS balance for staking", async function () {
      assert.isTrue((await versusToken.balanceOf(versusStakingAccess.address)).eq(ether("1000")), "wrong balance before");

      await versusAccessToken.transfer(OTHER, 1, { from: PLAYER_0 });

      assert.isTrue((await versusToken.balanceOf(versusStakingAccess.address)).eq(ether("0")), "wrong balance after");
    });

    it("should unstake - emit RewardWithdrawn & emit UnstakeMade", async function () {
      const tx = await versusAccessToken.transfer(OTHER, 1, { from: PLAYER_0 });

      assert.isTrue(tx.receipt.rawLogs.length == 6, "should be 6 rawLogs");
      
      const RewardWithdrawn_hash = web3.utils.keccak256("RewardWithdrawn(address,uint256)");
      assert.equal(tx.receipt.rawLogs[3].topics[0], RewardWithdrawn_hash, "Wrong hash, RewardWithdrawn");

      const UnstakeMade_hash = web3.utils.keccak256("UnstakeMade(address,uint256)");
      assert.equal(tx.receipt.rawLogs[5].topics[0], UnstakeMade_hash, "Wrong hash, UnstakeMade");
    });

    it("should unstake - delete stakeOf", async function () {
      let stake = await versusStakingAccess.getStakeOf.call(PLAYER_0);
      assert.isTrue(stake.timeAt > 0, "timeAt should be > 0");
      assert.isTrue(stake.amount > 0, "amount should be > 0");

      await versusAccessToken.transfer(OTHER, 1, { from: PLAYER_0 });

      stake = await versusStakingAccess.getStakeOf.call(PLAYER_0);
      assert.isTrue(stake.timeAt == 0, "timeAt should be == 0");
      assert.isTrue(stake.amount == 0, "amount should be == 0");
    });

    it("should unstake - calculateAvailableVersusReward == 0", async function () {
      assert.isTrue((await versusStakingAccess.calculateAvailableVersusReward.call({ from: PLAYER_0 })).gt(ether("0")), "should be > 0");
      await versusAccessToken.transfer(OTHER, 1, { from: PLAYER_0 });
      assert.isTrue((await versusStakingAccess.calculateAvailableVersusReward.call({ from: PLAYER_0 })).eq(ether("0")), "should be == 0");
    });
  });
});