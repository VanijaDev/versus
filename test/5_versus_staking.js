const VersusToken = artifacts.require("VersusToken");
const VersusStaking = artifacts.require("VersusStaking");

const {
  BN,
  ether,
  balance,
  constants,
  expectEvent,
  expectRevert,
  time,
} = require('@openzeppelin/test-helpers');


contract("VersusStaking", function (accounts) {
  const OWNER = accounts[0];
  const OTHER = accounts[1];
  const PLAYER_0 = accounts[2];
  const PLAYER_1 = accounts[3];

  const POOL_ZERO = 0;
  const POOL_VERSUS_VERSUS = 1;
  const POOL_VERSUS_BNB = 2;
  const POOL_WRONG = 3;

  let versusToken;
  let versusStaking;

  beforeEach(async () => {
    await time.advanceBlock();

    versusToken = await VersusToken.new();
    versusStaking = await VersusStaking.new(versusToken.address);

    await versusToken.approve(versusStaking.address, ether("1000"));
    await versusToken.mint(OWNER, ether("1000"));

    await web3.eth.sendTransaction({to: versusStaking.address, from: OWNER, value: ether("3")});
  });

  describe("Pausable", function () {
    it("should fail if not owner", async function () {
      await expectRevert(versusStaking.pause(true, {
        from: OTHER
      }), "Ownable: caller is not the owner.");
    });

    it("should set paused", async function () {
      assert.isFalse(await versusStaking.paused.call(), "Should not be paused before");
      await versusStaking.pause(true);
      assert.isTrue(await versusStaking.paused.call(), "Should be paused after");
    });

    it("should set unpaused", async function () {
      await versusStaking.pause(true);
      assert.isTrue(await versusStaking.paused.call(), "Should be paused after");

      await versusStaking.pause(false);
      assert.isFalse(await versusStaking.paused.call(), "Should not be paused before");
    });

    it("should fail to pause if already paused", async function () {
      await versusStaking.pause(true);
      await expectRevert(versusStaking.pause(true), "Pausable: paused");
    });
  });

  describe("constructor", function () {
    it("should set correct versusToken", async function () {
      assert.equal(await versusStaking.versusToken.call(), versusToken.address, "Wrong versusToken");
    });
    
    it("should set 0.1 BNB as minStake for both pools", async function () {
      assert.isTrue((await versusStaking.minStake.call(1)).eq(ether("0.1")), "Wrong minStake for versus_versus");
      assert.isTrue((await versusStaking.minStake.call(2)).eq(ether("0.1")), "Wrong minStake for versus_bnb");
    });
    
    it("should set 300% apy to versus_versus pool", async function () {
      assert.isTrue((await versusStaking.apy.call(1)).eq(new BN("300")), "Wrong apy for versus_versus");
    });
    
    it("should set 100% apy to versus_bnb pool", async function () {
      assert.isTrue((await versusStaking.apy.call(2)).eq(new BN("100")), "Wrong apy for versus_bnb");
    });
  });

  describe("updateMinStake", function () {
    it("should fail if not owner", async function () {
      await expectRevert(versusStaking.updateMinStake(0, ether("0.22"), {
        from: OTHER
      }), "Ownable: caller is not the owner.");
    });

    it("should update minStake for both pools", async function () {
      await versusStaking.updateMinStake(0, ether("0.22"));
      assert.equal(0, (await versusStaking.minStake.call(1)).cmp(ether("0.22")), "Wrong minStake for versus_versus");
      assert.equal(0, (await versusStaking.minStake.call(2)).cmp(ether("0.22")), "Wrong minStake for versus_bnb");
    });

    it("should update minStake for versus_versus pool", async function () {
      await versusStaking.updateMinStake(1, ether("0.22"));
      assert.equal(0, (await versusStaking.minStake.call(1)).cmp(ether("0.22")), "Wrong minStake for versus_versus");
      assert.equal(0, (await versusStaking.minStake.call(2)).cmp(ether("0.1")), "Wrong minStake for versus_bnb");
    });

    it("should  update minStake for versus_bnb pool", async function () {
      await versusStaking.updateMinStake(2, ether("0.222"));
      assert.equal(0, (await versusStaking.minStake.call(1)).cmp(ether("0.1")), "Wrong minStake for versus_versus");
      assert.equal(0, (await versusStaking.minStake.call(2)).cmp(ether("0.222")), "Wrong minStake for versus_bnb");      
    });

    it("should revert if Wrong pool", async function () {
      await expectRevert.unspecified(versusStaking.updateMinStake(3, ether("0.22"), {
        from: OWNER
      }));
    });
  });

  describe("updateAPY", function () {
    it("should fail if not owner", async function () {
      await expectRevert(versusStaking.updateAPY(0, 111, {
        from: OTHER
      }), "Ownable: caller is not the owner.");
    });

    it("should revert if Wrong pool", async function () {
      await expectRevert.unspecified(versusStaking.updateAPY(0, 111, {
        from: OWNER
      }));

      await expectRevert.unspecified(versusStaking.updateAPY(3, 111, {
        from: OWNER
      }));
    });

    it("should update apy for versus_versus pool", async function () {
      await versusStaking.updateAPY(1, new BN("111"));
      assert.equal(0, (await versusStaking.apy.call(1)).cmp(new BN("111")), "Wrong apy for versus_versus");
      assert.equal(0, (await versusStaking.apy.call(2)).cmp(new BN("100")), "Wrong apy for versus_bnb");
    });

    it("should  update apy for versus_bnb pool", async function () {
      await versusStaking.updateAPY(2, new BN("111"));
      assert.equal(0, (await versusStaking.apy.call(1)).cmp(new BN("300")), "Wrong apy for versus_versus");
      assert.equal(0, (await versusStaking.apy.call(2)).cmp(new BN("111")), "Wrong apy for versus_bnb");      
    });
  });

  describe("stake", function () {
    it("should fail if paused", async function () {
      await versusStaking.pause(true);
      await expectRevert(versusStaking.stake(POOL_VERSUS_VERSUS, ether("0.2"), {
        from: PLAYER_0
      }), "Pausable: paused.");
    });
    
    it("should fail if wrong pool", async function () {
      await expectRevert(versusStaking.stake(POOL_ZERO, ether("0.2"), {
        from: PLAYER_0
      }), "Wrong pool");

      await expectRevert.unspecified(versusStaking.stake(POOL_WRONG, ether("0.2"), {
        from: PLAYER_0
      }));
    });
    
    it("should fail if < min stake amount", async function () {
      await expectRevert(versusStaking.stake(POOL_VERSUS_VERSUS, ether("0.02"), {
        from: PLAYER_0
      }), "Wrong amount");
    });
    
    it("should update saved reward", async function () {
      await versusStaking.stake(POOL_VERSUS_VERSUS, ether("0.2"), {
        from: PLAYER_0
      });
      const SEC_0 = 2400; //  40 min
      await time.increase(time.duration.seconds(SEC_0));

      //  0
      await versusStaking.stake(POOL_VERSUS_VERSUS, ether("0.22"), {
        from: PLAYER_0
      });

      //  300*10^18 - 300% APY
      //  31536000 - seconds in year
      const percentagePerSec = new BN("9512937595129"); //  300*10^18 / 31536000
      
      const reward_0 = ether("0.2").mul(percentagePerSec).mul(new BN(SEC_0)).div(ether("1"));
      assert.equal(0, (await versusStaking.getSavedVersusRewardOf(PLAYER_0, POOL_VERSUS_VERSUS)).cmp(reward_0), "wrong saved reward after 0");
      
      const SEC_1 = 4500; //  75 min
      await time.increase(time.duration.seconds(SEC_1));

      //  1
      await versusStaking.stake(POOL_VERSUS_VERSUS, ether("0.3"), {
        from: PLAYER_0
      });

      const reward_1 = ether("0.42").mul(percentagePerSec).mul(new BN(SEC_1)).div(ether("1"));
      assert.equal(0, (await versusStaking.getSavedVersusRewardOf(PLAYER_0, POOL_VERSUS_VERSUS)).cmp(reward_0.add(reward_1)), "wrong saved reward after 1");
      

      await versusStaking.updateAPY(POOL_VERSUS_VERSUS, new BN("111"));
      const SEC_2 = 3000; //  50 min
      await time.increase(time.duration.seconds(SEC_2));

      //  2
      await versusStaking.stake(POOL_VERSUS_VERSUS, ether("0.13"), {
        from: PLAYER_0
      });

      const percentagePerSec_upd = new BN("3519786910197"); //  111*10^18 / 31536000
      const reward_2 = ether("0.72").mul(percentagePerSec_upd).mul(new BN(SEC_2)).div(ether("1"));
      assert.equal(0, (await versusStaking.getSavedVersusRewardOf(PLAYER_0, POOL_VERSUS_VERSUS)).cmp(reward_0.add(reward_1).add(reward_2)), "wrong saved reward after 2");
    });

    it("should not update saved reward if few transactions in the same time", async function () {
      await versusStaking.stake(POOL_VERSUS_VERSUS, ether("0.2"), {
        from: PLAYER_0
      });
      await versusStaking.stake(POOL_VERSUS_VERSUS, ether("0.12"), {
        from: PLAYER_0
      });
      
      assert.equal(0, (await versusStaking.getSavedVersusRewardOf(PLAYER_0, POOL_VERSUS_VERSUS)).cmp(new BN("0")), "wrong saved reward after 0");
    });
    
    it("should update Stake.timeAt", async function () {
      //  0
      await versusStaking.stake(POOL_VERSUS_VERSUS, ether("0.2"), {
        from: PLAYER_0
      });
      const time_0 = await time.latest();
      await time.increase(time.duration.seconds(3));

      let stakeBefore = await versusStaking.getStakeOf.call(PLAYER_0, POOL_VERSUS_VERSUS);

      assert.isTrue((new BN(stakeBefore.timeAt)).eq(time_0), "timeAt should be now, 0");

      //  1
      await versusStaking.stake(POOL_VERSUS_VERSUS, ether("0.2"), {
        from: PLAYER_0
      });

      let stakeAfter = await versusStaking.getStakeOf.call(PLAYER_0, POOL_VERSUS_VERSUS);

      assert.isTrue((new BN(stakeAfter.timeAt)).gt(new BN(stakeBefore.timeAt)), "timeAt should be later, 1");
      assert.isTrue((new BN(stakeAfter.timeAt)).eq(await time.latest()), "timeAt should be now, 1");
    });
    
    it("should update Stake.amount", async function () {
      //  0
      await versusStaking.stake(POOL_VERSUS_VERSUS, ether("0.2"), {
        from: PLAYER_0
      });
      await time.increase(time.duration.seconds(3));

      let stakeBefore = await versusStaking.getStakeOf.call(PLAYER_0, POOL_VERSUS_VERSUS);
      assert.isTrue(ether(web3.utils.fromWei(stakeBefore.amount, 'ether')).eq(ether("0.2")), "amount should be 0.2, 0");

      //  1
      await versusStaking.stake(POOL_VERSUS_VERSUS, ether("0.2"), {
        from: PLAYER_0
      });

      let stakeAfter = await versusStaking.getStakeOf.call(PLAYER_0, POOL_VERSUS_VERSUS);
      assert.isTrue(ether(web3.utils.fromWei(stakeAfter.amount, 'ether')).eq(ether("0.4")), "amount should be 0.4, 1");
    });
  })

  describe("calculateAvailableVersusReward", function () {
    it("should fail if wrong pool", async function () {
      await expectRevert(versusStaking.calculateAvailableVersusReward.call(POOL_ZERO), "Wrong pool");
      await expectRevert.unspecified(versusStaking.calculateAvailableVersusReward.call(POOL_WRONG));
    });

    it("should return saved only", async function () {
      await versusStaking.stake(POOL_VERSUS_VERSUS, ether("0.2"), {
        from: PLAYER_0
      });
      const SEC_0 = 2400; //  40 min
      await time.increase(time.duration.seconds(SEC_0));

      await versusStaking.stake(POOL_VERSUS_VERSUS, ether("0.22"), {
        from: PLAYER_0
      });

      //  300*10^18 - 300% APY
      //  31536000 - seconds in year
      const percentagePerSec = new BN("9512937595129"); //  300*10^18 / 31536000
      const reward_0 = ether("0.2").mul(percentagePerSec).mul(new BN(SEC_0)).div(ether("1"));
      assert.equal(0, (await versusStaking.calculateAvailableVersusReward.call(POOL_VERSUS_VERSUS, {
        from: PLAYER_0
      })).cmp(reward_0), "wrong amount");
    });

    it("should return pending only", async function () {
      await versusStaking.stake(POOL_VERSUS_VERSUS, ether("0.2"), {
        from: PLAYER_0
      });
      const SEC_0 = 2400; //  40 min
      await time.increase(time.duration.seconds(SEC_0));

      //  300*10^18 - 300% APY
      //  31536000 - seconds in year
      const percentagePerSec = new BN("9512937595129"); //  300*10^18 / 31536000
      const reward_0 = ether("0.2").mul(percentagePerSec).mul(new BN(SEC_0)).div(ether("1"));
      assert.equal(0, (await versusStaking.calculateAvailableVersusReward.call(POOL_VERSUS_VERSUS, {
        from: PLAYER_0
      })).cmp(reward_0), "wrong amount");
    });

    it("should return saved + pending", async function () {
      await versusStaking.stake(POOL_VERSUS_VERSUS, ether("0.2"), {
        from: PLAYER_0
      });
      const SEC_0 = 2400; //  40 min
      await time.increase(time.duration.seconds(SEC_0));

      await versusStaking.stake(POOL_VERSUS_VERSUS, ether("0.22"), {
        from: PLAYER_0
      });

      //  300*10^18 - 300% APY
      //  31536000 - seconds in year
      const percentagePerSec = new BN("9512937595129"); //  300*10^18 / 31536000
      const saved_0 = ether("0.2").mul(percentagePerSec).mul(new BN(SEC_0)).div(ether("1"));


      const SEC_1 = 4500; //  75 min
      await time.increase(time.duration.seconds(SEC_1));

      const pending_0 = ether("0.42").mul(percentagePerSec).mul(new BN(SEC_1)).div(ether("1"));
      const availableReward = await versusStaking.calculateAvailableVersusReward.call(POOL_VERSUS_VERSUS, {
        from: PLAYER_0
      });

      //  available
      assert.equal(0, availableReward.cmp(saved_0.add(pending_0)), "wrong available amount");

      //  saved
      assert.equal(0, (await versusStaking.getSavedVersusRewardOf(PLAYER_0, POOL_VERSUS_VERSUS)).cmp(saved_0), "wrong saved amount");

      //  pending
      assert.equal(0, availableReward.sub(saved_0).cmp(pending_0), "wrong pending amount");

    });
  });

  describe("calculateAvailableBNBReward", function () {
    it("should return 0 if not rewards", async function () {
      assert.equal(0, (await versusStaking.calculateAvailableBNBReward.call({
        from: PLAYER_0
      })).cmp(ether("0")), "should be 0");
    });

    it("should return 0 if no stake for POOL_VERSUS_BNB", async function () {
       await versusStaking.stake(POOL_VERSUS_VERSUS, ether("0.2"), {
        from: PLAYER_0
      });
      const SEC_0 = 2400; //  40 min
      await time.increase(time.duration.seconds(SEC_0));

      assert.equal(0, (await versusStaking.calculateAvailableBNBReward.call({
        from: PLAYER_0
      })).cmp(ether("0")), "should be 0 BNB");
    });

    it("should return correct BNB amount,   IMPORTANT: use 0.0002 BNB for testing", async function () {
       await versusStaking.stake(POOL_VERSUS_BNB, ether("0.2"), {
        from: PLAYER_0
      });
      const SEC_0 = 2400; //  40 min
      await time.increase(time.duration.seconds(SEC_0));

      assert.equal(0, (await versusStaking.calculateAvailableBNBReward.call({
        from: PLAYER_0
      })).cmp(ether("0.0002")), "should be 0.0002 BNB");
    });
  });
  
  describe("withdrawAvailableReward", function () {
    it("should fail if paused", async function () {
      await versusStaking.pause(true);
      await expectRevert(versusStaking.withdrawAvailableReward(POOL_VERSUS_VERSUS, {
        from: PLAYER_0
      }), "Pausable: paused");
    });
    
    it("should fail if wrong pool", async function () {
      await expectRevert(versusStaking.withdrawAvailableReward(POOL_ZERO), "Wrong pool");
      await expectRevert.unspecified(versusStaking.withdrawAvailableReward(POOL_WRONG));
    });
    
    it("should fail if No reward VERSUS for POOL_VERSUS_VERSUS", async function () {
      await expectRevert(versusStaking.withdrawAvailableReward(POOL_VERSUS_VERSUS, {
        from: PLAYER_0
      }), "No reward VERSUS");
    });
    
    it("should delete savedVersusRewardOf & clear pending reward for POOL_VERSUS_VERSUS", async function () {
      //  0
      await versusStaking.stake(POOL_VERSUS_VERSUS, ether("0.2"), {
        from: PLAYER_0
      });
      const SEC_0 = 2400; //  40 min
      await time.increase(time.duration.seconds(SEC_0));

      //  1
      await versusStaking.stake(POOL_VERSUS_VERSUS, ether("0.2"), {
        from: PLAYER_0
      });
      await time.increase(time.duration.seconds(SEC_0));

      assert.isTrue((await versusStaking.getSavedVersusRewardOf(PLAYER_0, POOL_VERSUS_VERSUS)).gt(new BN("0")), "saved should be > 0");
      assert.isTrue((await versusStaking.calculateAvailableVersusReward(POOL_VERSUS_VERSUS, {
        from: PLAYER_0
      })).gt(new BN("0")), "pending should be > 0");

      await versusStaking.withdrawAvailableReward(POOL_VERSUS_VERSUS, {
        from: PLAYER_0
      });

      assert.isTrue((await versusStaking.getSavedVersusRewardOf(PLAYER_0, POOL_VERSUS_VERSUS)).eq(new BN("0")), "saved should be == 0");
      assert.isTrue((await versusStaking.calculateAvailableVersusReward(POOL_VERSUS_VERSUS, {
        from: PLAYER_0
      })).eq(new BN("0")), "pending should be == 0");
     
    });
    
    it("should transfer correct VERSUS amount", async function () {
      await versusStaking.stake(POOL_VERSUS_VERSUS, ether("0.2"), {
        from: PLAYER_0
      });
      const SEC_0 = 2400; //  40 min
      await time.increase(time.duration.seconds(SEC_0));

      await versusStaking.stake(POOL_VERSUS_VERSUS, ether("0.22"), {
        from: PLAYER_0
      });

      const SEC_1 = 4500; //  75 min
      await time.increase(time.duration.seconds(SEC_1));

      const availableReward = await versusStaking.calculateAvailableVersusReward.call(POOL_VERSUS_VERSUS, {
        from: PLAYER_0
      });

      assert.equal(0, (await versusToken.balanceOf.call(PLAYER_0)).cmp(ether("0")), "should be 0 before");

      await versusStaking.withdrawAvailableReward(POOL_VERSUS_VERSUS, {
        from: PLAYER_0
      });

      assert.equal(0, (await versusToken.balanceOf.call(PLAYER_0)).cmp(availableReward), "wrong balance after");
    });
    
    it("should fail if No reward BNB for POOL_VERSUS_BNB", async function () {
      await expectRevert(versusStaking.withdrawAvailableReward(POOL_VERSUS_BNB, {
        from: PLAYER_0
      }), "No reward BNB");
    });
    
    it("should delete savedVersusRewardOf & clear pending reward for POOL_VERSUS_BNB", async function () {
      //  0
      await versusStaking.stake(POOL_VERSUS_BNB, ether("0.2"), {
        from: PLAYER_0
      });
      const SEC_0 = 2400; //  40 min
      await time.increase(time.duration.seconds(SEC_0));

      //  1
      await versusStaking.stake(POOL_VERSUS_BNB, ether("0.2"), {
        from: PLAYER_0
      });
      await time.increase(time.duration.seconds(SEC_0));

      assert.isTrue((await versusStaking.getSavedVersusRewardOf(PLAYER_0, POOL_VERSUS_BNB)).gt(new BN("0")), "saved should be > 0");
      assert.isTrue((await versusStaking.calculateAvailableVersusReward(POOL_VERSUS_BNB, {
        from: PLAYER_0
      })).gt(new BN("0")), "pending should be > 0");

      await versusStaking.withdrawAvailableReward(POOL_VERSUS_BNB, {
        from: PLAYER_0
      });

      assert.isTrue((await versusStaking.getSavedVersusRewardOf(PLAYER_0, POOL_VERSUS_BNB)).eq(new BN("0")), "saved should be == 0");
      assert.isTrue((await versusStaking.calculateAvailableVersusReward(POOL_VERSUS_BNB, {
        from: PLAYER_0
      })).eq(new BN("0")), "pending should be == 0");
    });
    
    it("should transfer correct BNB amount", async function () {
      await versusStaking.stake(POOL_VERSUS_BNB, ether("0.2"), {
        from: PLAYER_0
      });
      const SEC_0 = 2400; //  40 min
      await time.increase(time.duration.seconds(SEC_0));

      await versusStaking.stake(POOL_VERSUS_BNB, ether("0.22"), {
        from: PLAYER_0
      });

      const SEC_1 = 4500; //  75 min
      await time.increase(time.duration.seconds(SEC_1));

      // const availableReward = await versusStaking.calculateAvailableVersusReward.call(POOL_VERSUS_BNB, {
      //   from: PLAYER_0
      // });
      const availableReward = ether("0.0002"); //  hardcoded in code for testing.

      const balanceBefore = await balance.current(PLAYER_0);

      const tx = await versusStaking.withdrawAvailableReward(POOL_VERSUS_BNB, {
        from: PLAYER_0
      });
      const gasUsed = new BN(tx.receipt.gasUsed);
      const txInfo = await web3.eth.getTransaction(tx.tx);
      const gasPrice = new BN(txInfo.gasPrice);
      const ethSpent = gasUsed.mul(gasPrice);

      const balanceAfter = await balance.current(PLAYER_0);
      assert.equal(0, balanceAfter.cmp(balanceBefore.add(availableReward).sub(ethSpent)), "wrong balanceAfter");
    });
    
    it("should set Stake.timeAt to now", async function () {
      await versusStaking.stake(POOL_VERSUS_VERSUS, ether("0.2"), {
        from: PLAYER_0
      });
      const time_0 = await time.latest();
      const SEC_0 = 2400; //  40 min
      await time.increase(time.duration.seconds(SEC_0));

      let stakeBefore = await versusStaking.getStakeOf.call(PLAYER_0, POOL_VERSUS_VERSUS);
      assert.isTrue((new BN(stakeBefore.timeAt)).eq(time_0), "wrong timeAt before");

      await versusStaking.withdrawAvailableReward(POOL_VERSUS_VERSUS, {
        from: PLAYER_0
      });

      let stakeAfter = await versusStaking.getStakeOf.call(PLAYER_0, POOL_VERSUS_VERSUS);
      assert.isTrue((new BN(stakeAfter.timeAt)).eq(await time.latest()), "wrong timeAt after");
    });
  });

  describe("unstake", function () {
    it("should fail if paused", async function () {
      await versusStaking.pause(true);
      await expectRevert(versusStaking.unstake(POOL_VERSUS_VERSUS, {
        from: PLAYER_0
      }), "Pausable: paused");
    });
    
    it("should fail if wrong pool", async function () {
      await expectRevert(versusStaking.unstake(POOL_ZERO, {
        from: PLAYER_0
      }), "Wrong pool");

      await expectRevert.unspecified(versusStaking.unstake(POOL_WRONG, {
        from: PLAYER_0
      }));
    });
    
    it("should fail if No reward", async function () {
      await versusStaking.stake(POOL_VERSUS_VERSUS, ether("0.2"), {
        from: PLAYER_0
      });

      await expectRevert(versusStaking.unstake(POOL_VERSUS_VERSUS, {
        from: PLAYER_0
      }), "No reward");
    });
    
    it("should delete Stake", async function () {
      await versusStaking.stake(POOL_VERSUS_VERSUS, ether("0.2"), {
        from: PLAYER_0
      });

      const SEC_0 = 2400; //  40 min
      await time.increase(time.duration.seconds(SEC_0));

      const stakeBefore = await versusStaking.getStakeOf(PLAYER_0, POOL_VERSUS_VERSUS);
      assert.isTrue((new BN(stakeBefore.timeAt)).gt(new BN("0")), "wrong timeAt before");
      assert.isTrue((new BN(stakeBefore.amount)).gt(new BN("0")), "wrong amount before");

      await versusStaking.unstake(POOL_VERSUS_VERSUS, {
        from: PLAYER_0
      });

      const stakeAfter = await versusStaking.getStakeOf(PLAYER_0, POOL_VERSUS_VERSUS);
      assert.isTrue((new BN(stakeAfter.timeAt)).eq(new BN("0")), "wrong timeAt after");
      assert.isTrue((new BN(stakeAfter.amount)).eq(new BN("0")), "wrong amount after");
    });
  });
});
