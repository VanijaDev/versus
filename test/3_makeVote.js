const VersusVoting = artifacts.require("VersusVoting");
const VersusToken = artifacts.require("VersusToken");

const {
  BN,
  ether,
  balance,
  constants,
  expectEvent,
  expectRevert,
  time,
} = require('@openzeppelin/test-helpers');
const {
  expect, assert
} = require('chai');

contract("Voting Smart Contract", function (accounts) {
  const OWNER = accounts[0];
  const OTHER = accounts[1];
  const DEV_FEE_RECEIVER = accounts[2];
  const VOTER_0 = accounts[3];
  const VOTER_1 = accounts[4];
  const VOTER_2 = accounts[5];

  let versusToken;
  let votingContract;

  beforeEach(async () => {
    await time.advanceBlock();

    versusToken = await VersusToken.new();
    votingContract = await VersusVoting.new(DEV_FEE_RECEIVER, versusToken.address);
  });
  
  describe("makeVote", function () {
    it("should fail if Wrong pool", async function () {
      await expectRevert(votingContract.makeVote(0, {
        from: VOTER_0,
        value: ether("1")
      }), "Wrong pool");
    });
    
    it("should fail if Wrong amount", async function () {
      await expectRevert(votingContract.makeVote(1, {
        from: VOTER_0
      }), "Wrong amount");

      await expectRevert(votingContract.makeVote(1, {
        from: VOTER_0,
        value: ether("0.01")
      }), "Wrong amount");

      await votingContract.updateMinStake(ether("0.2"));

      await expectRevert(votingContract.makeVote(1, {
        from: VOTER_0,
        value: ether("0.19")
      }), "Wrong amount");
    });
    
    it("should fail if Epoch finished", async function () {
      await votingContract.makeVote(1, {
        from: VOTER_0,
        value: ether("0.2")
      });
      
      await time.increase(time.duration.hours(4));
      
      await expectRevert(votingContract.makeVote(1, {
        from: VOTER_0,
        value: ether("0.2")
      }), "Epoch finished");
    });
    
    it("should set vote.pool if first vote in epoch", async function () {
      let poolBefore = (await votingContract.getVoteForVoter.call(0, VOTER_0)).pool;
      assert.equal(0, poolBefore, "should be 0 before");
      
      await votingContract.makeVote(1, {
        from: VOTER_0,
        value: ether("0.2")
      });

      let poolAfter = (await votingContract.getVoteForVoter.call(0, VOTER_0)).pool;
      assert.equal(1, poolAfter, "should be 1 after");
    });
    
    it("should add player to votersForPool if first vote in epoch", async function () {
      let votersPool_1 = await votingContract.getVotersForPool.call(0, 1);
      assert.equal(0, votersPool_1.length, "should be 0 before");

      let votersPool_2 = await votingContract.getVotersForPool.call(0, 2);
      assert.equal(0, votersPool_2.length, "should be 0 before");

      //  0
      await votingContract.makeVote(1, {
        from: VOTER_0,
        value: ether("0.2")
      });
      votersPool_1 = await votingContract.getVotersForPool.call(0, 1);
      assert.equal(1, votersPool_1.length, "should be 1 after");
      assert.equal(VOTER_0, votersPool_1[0], "should be VOTER_0");

      //  1
      await votingContract.makeVote(1, {
        from: VOTER_1,
        value: ether("0.21")
      });
      votersPool_1 = await votingContract.getVotersForPool.call(0, 1);
      assert.equal(2, votersPool_1.length, "should be 2 after");
      assert.equal(VOTER_0, votersPool_1[0], "should be VOTER_0");
      assert.equal(VOTER_1, votersPool_1[1], "should be VOTER_1");

      //  2
      await votingContract.makeVote(2, {
        from: VOTER_2,
        value: ether("0.211")
      });
      votersPool_1 = await votingContract.getVotersForPool.call(0, 1);
      assert.equal(2, votersPool_1.length, "should be 2 after");
      assert.equal(VOTER_0, votersPool_1[0], "should be VOTER_0");
      assert.equal(VOTER_1, votersPool_1[1], "should be VOTER_1");

      votersPool_2 = await votingContract.getVotersForPool.call(0, 2);
      assert.equal(1, votersPool_2.length, "should be 1 after");
      assert.equal(VOTER_2, votersPool_2[0], "should be VOTER_2");
    });
    
    it("should fail if already voted for Other pool before in current epoch", async function () {
      await votingContract.makeVote(1, {
        from: VOTER_0,
        value: ether("0.12")
      });

      await expectRevert(votingContract.makeVote(2, {
        from: VOTER_0,
        value: ether("0.2")
      }), "Other pool before");
    });
    
    it("should increase stake", async function () {
      let stake = (await votingContract.getVoteForVoter(0, VOTER_0)).stake;
      assert.equal(0, stake, "should be 0 before");

      await votingContract.makeVote(1, {
        from: VOTER_0,
        value: ether("0.12")
      });
      stake = new BN((await votingContract.getVoteForVoter(0, VOTER_0)).stake);
      assert.equal(0, stake.cmp(ether("0.12")), "should be ether(0.12) after");

      await votingContract.makeVote(1, {
        from: VOTER_0,
        value: ether("0.12")
      });
      stake = new BN((await votingContract.getVoteForVoter(0, VOTER_0)).stake);
      assert.equal(0, stake.cmp(ether("0.24")), "should be ether(0.24) after");
    });
    
    it("should increase balanceForPool", async function () {
      let balance = new BN((await votingContract.getBalanceForPool(0, 1)));
      assert.equal(0, balance, "should be 0 before");

      await votingContract.makeVote(1, {
        from: VOTER_0,
        value: ether("0.12")
      });
      balance = new BN((await votingContract.getBalanceForPool(0, 1)));
      assert.equal(0, balance.cmp(ether("0.12")), "should be ether(0.12) after");

      await votingContract.makeVote(1, {
        from: VOTER_0,
        value: ether("0.12")
      });
      balance = new BN((await votingContract.getBalanceForPool(0, 1)));
      assert.equal(0, balance.cmp(ether("0.24")), "should be ether(0.24) after");

      assert.equal(0, new BN((await votingContract.getBalanceForPool(0, 2))), "should be 0 after for 2");
    });
    
    it("should increase pendingVersusTokenBonus", async function () {
      let pennding = new BN((await votingContract.pendingVersusTokenBonus(VOTER_0)));
      assert.equal(0, pennding, "should be 0 before");

      await votingContract.makeVote(1, {
        from: VOTER_0,
        value: ether("0.12")
      });
      pennding = new BN((await votingContract.pendingVersusTokenBonus(VOTER_0)));
      assert.equal(0, pennding.cmp(ether("1")), "should be 1 after");

      await votingContract.makeVote(1, {
        from: VOTER_0,
        value: ether("0.12")
      });
      pennding = new BN((await votingContract.pendingVersusTokenBonus(VOTER_0)));
      assert.equal(0, pennding.cmp(ether("2")), "should be 2 after");
    });
    
    it("should emit Voted", async function () {
      const receipt = await votingContract.makeVote(1, {
        from: VOTER_0,
        value: ether("0.12")
      });

      expectEvent(receipt, 'Voted', {
        pool: new BN("1"),
        voter: VOTER_0,
        amount: ether("0.12")
      });
    });
  });

  describe("finishEpoch", function () {
    it("should fail if not owner", async function () {
      await votingContract.makeVote(1, {
        from: VOTER_0,
        value: ether("0.2")
      });

      await time.increase(time.duration.hours(3));

      await expectRevert(votingContract.finishEpoch({
        from: OTHER
      }), "Ownable: caller is not the owner");
    });
    
    it("should fail if Epoch running", async function () {
      await votingContract.makeVote(1, {
        from: VOTER_0,
        value: ether("0.2")
      });

      await time.increase(time.duration.hours(1));

      await expectRevert(votingContract.finishEpoch(), "Epoch running");
    });
    
    it("should set EpochResult with loserPoolChunk = 0 if winner Pool.one & Pool.two balance == 0", async function () {
      await votingContract.makeVote(1, {
        from: VOTER_0,
        value: ether("0.2")
      });

      await time.increase(time.duration.hours(3));
      await votingContract.finishEpoch();

      let result = await votingContract.epochResult.call(0);
      assert.equal(0, result.poolWinner.cmp(new BN("1")), "wrong poolWinner");
      assert.equal(0, result.loserPoolChunk.cmp(ether("0")), "wrong loserPoolChunk");
      assert.equal(0, result.poolWinnerVoterRefundPercentage.cmp(new BN("95")), "wrong poolWinnerVoterRefundPercentage");
    });
    
    it("should set correct EpochResult if winner Pool.one", async function () {
      //  0
      await votingContract.makeVote(1, {
        from: VOTER_0,
        value: ether("0.22")
      });
      await votingContract.makeVote(1, {
        from: VOTER_1,
        value: ether("0.3")
      });

      await votingContract.makeVote(2, {
        from: VOTER_2,
        value: ether("0.42")
      });

      await time.increase(time.duration.hours(3));
      await votingContract.finishEpoch();

      let result = await votingContract.epochResult.call(0);
      assert.equal(0, result.poolWinner.cmp(new BN("1")), "wrong poolWinner");
      assert.equal(0, result.loserPoolChunk.cmp(ether("0.147")), "wrong loserPoolChunk");
      assert.equal(0, result.poolWinnerVoterRefundPercentage.cmp(new BN("95")), "wrong poolWinnerVoterRefundPercentage");

      //  1
      await votingContract.makeVote(2, {
        from: VOTER_0,
        value: ether("0.22")
      });
      await votingContract.makeVote(2, {
        from: VOTER_1,
        value: ether("0.3")
      });

      await votingContract.makeVote(1, {
        from: VOTER_2,
        value: ether("0.22")
      });

      await time.increase(time.duration.hours(3));
      await votingContract.finishEpoch();

      let result_0 = await votingContract.epochResult.call(0);
      assert.equal(0, result_0.poolWinner.cmp(new BN("1")), "wrong poolWinner, result_0");
      assert.equal(0, result_0.loserPoolChunk.cmp(ether("0.147")), "wrong loserPoolChunk, result_0");
      assert.equal(0, result_0.poolWinnerVoterRefundPercentage.cmp(new BN("95")), "wrong poolWinnerVoterRefundPercentage, result_0");

      let result_1 = await votingContract.epochResult.call(1);
      assert.equal(0, result_1.poolWinner.cmp(new BN("2")), "wrong poolWinner, result_1");
      assert.equal(0, result_1.loserPoolChunk.cmp(ether("0.09905")), "wrong loserPoolChunk, result_1"); //  (0.42 * 30% / 2 + 0.22) * 70% / 2
      assert.equal(0, result_1.poolWinnerVoterRefundPercentage.cmp(new BN("95")), "wrong poolWinnerVoterRefundPercentage, result_1");
    });
    
    it("should set correct balanceForPool for next epoch (50% / 50%) if winner Pool.one", async function () {
      //  0
      await votingContract.makeVote(1, {
        from: VOTER_0,
        value: ether("0.22")
      });
      await votingContract.makeVote(1, {
        from: VOTER_1,
        value: ether("0.3")
      });

      await votingContract.makeVote(2, {
        from: VOTER_2,
        value: ether("0.42")
      });

      await time.increase(time.duration.hours(3));
      await votingContract.finishEpoch();

      assert.equal(0, ether("0.063").cmp((new BN(await votingContract.getBalanceForPool.call(1, 1)))), "wrong balance after 0 for 1");  //  0.42 * 30% / 2
      assert.equal(0, ether("0.063").cmp((new BN(await votingContract.getBalanceForPool.call(1, 2)))), "wrong balance after 0 for 2");  //  0.42 * 30% / 2


      //  1
      await votingContract.makeVote(2, {
        from: VOTER_0,
        value: ether("0.22")
      });
      await votingContract.makeVote(2, {
        from: VOTER_1,
        value: ether("0.3")
      });

      await votingContract.makeVote(1, {
        from: VOTER_2,
        value: ether("0.22")
      });

      await time.increase(time.duration.hours(3));
      await votingContract.finishEpoch();

      assert.equal(0, ether("0.04245").cmp((new BN(await votingContract.getBalanceForPool.call(2, 1)))), "wrong balance after 0 for 1");   //  (0.42 * 30% / 2 + 0.22) * 30% / 2
      assert.equal(0, ether("0.04245").cmp((new BN(await votingContract.getBalanceForPool.call(2, 2)))), "wrong balance after 0 for 2");
    });
    
    it("should transfer correct devFee to devFeeReceiver", async function () {
      await votingContract.makeVote(1, {
        from: VOTER_0,
        value: ether("0.22")
      });
      await votingContract.makeVote(1, {
        from: VOTER_1,
        value: ether("0.3")
      });

      await votingContract.makeVote(2, {
        from: VOTER_2,
        value: ether("0.42")
      });

      let balanceBefore = await web3.eth.getBalance(DEV_FEE_RECEIVER);

      await time.increase(time.duration.hours(3));
      await votingContract.finishEpoch();

      let balanceAfter = await web3.eth.getBalance(DEV_FEE_RECEIVER);
      assert.isTrue((new BN((balanceAfter - balanceBefore).toString())).eq(ether("0.026")), "wrong balance after");
    });
    
    it("should emit DevFeeTransferred", async function () {
      await votingContract.makeVote(1, {
        from: VOTER_0,
        value: ether("0.22")
      });
      await votingContract.makeVote(1, {
        from: VOTER_1,
        value: ether("0.3")
      });

      await votingContract.makeVote(2, {
        from: VOTER_2,
        value: ether("0.42")
      });
      
      await time.increase(time.duration.hours(3));
      const receipt = await votingContract.finishEpoch();

      expectEvent(receipt, 'DevFeeTransferred', {
        to: DEV_FEE_RECEIVER,
        amount: ether("0.026")
      });
    });
    
    it("should emit EpochFinished", async function () {
      //  0
      await votingContract.makeVote(1, {
        from: VOTER_0,
        value: ether("0.22")
      });
      
      await time.increase(time.duration.hours(3));
      let receipt = await votingContract.finishEpoch();

      expectEvent(receipt, 'EpochFinished', {
        epoch: new BN("0")
      });

      //  1
      await votingContract.makeVote(1, {
        from: VOTER_0,
        value: ether("0.22")
      });
      
      await time.increase(time.duration.hours(3));
      receipt = await votingContract.finishEpoch();

      expectEvent(receipt, 'EpochFinished', {
        epoch: new BN("1")
      });
    });
    
    it("should increase currentEpoch += 1", async function () {
      //  0
      assert.isTrue((await votingContract.currentEpoch.call()).eq(new BN(0)), "should be 0");

      await votingContract.makeVote(1, {
        from: VOTER_0,
        value: ether("0.22")
      });
      
      await time.increase(time.duration.hours(3));
      await votingContract.finishEpoch();

      //  1
      assert.isTrue((await votingContract.currentEpoch.call()).eq(new BN(1)), "should be 1");
      await votingContract.makeVote(1, {
        from: VOTER_0,
        value: ether("0.22")
      });
      
      await time.increase(time.duration.hours(3));
      await votingContract.finishEpoch();
      assert.isTrue((await votingContract.currentEpoch.call()).eq(new BN(2)), "should be 2");
    });
    
    it("should set currentEpochStartedAt to now", async function () {
      //  0
      await votingContract.makeVote(1, {
        from: VOTER_0,
        value: ether("0.22")
      });
      
      await time.increase(time.duration.hours(3));
      await votingContract.finishEpoch();
      const started_0 = await time.latest();
      assert.isTrue((await votingContract.currentEpochStartedAt.call()).eq(started_0), "wrong for 1");

      //  1
      await votingContract.makeVote(1, {
        from: VOTER_0,
        value: ether("0.22")
      });
      
      await time.increase(time.duration.hours(3));
      await votingContract.finishEpoch();
      const started_1 = await time.latest();
      assert.isTrue((await votingContract.currentEpochStartedAt.call()).eq(started_1), "wrong for 2");
    });
  });

  describe.only("calculatePendingReward", function () {
    it("should fail on Wrong loopLimit if >= currentEpoch", async function () {
      //  0
      await votingContract.makeVote(1, {
        from: VOTER_0,
        value: ether("0.22")
      });
      
      await time.increase(time.duration.hours(3));
      await votingContract.finishEpoch();

      await expectRevert(votingContract.calculatePendingReward.call(2, {
        from: VOTER_0
      }), "Wrong loopLimit");

      //  1
      await votingContract.makeVote(1, {
        from: VOTER_0,
        value: ether("0.22")
      });
      
      await time.increase(time.duration.hours(3));
      await votingContract.finishEpoch();

      await expectRevert(votingContract.calculatePendingReward.call(21, {
        from: VOTER_0
      }), "Wrong loopLimit");
    });
    
    it("should updatedStartEpoch to correct value", async function () {
      //  0
      await votingContract.makeVote(1, {
        from: VOTER_0,
        value: ether("0.22")
      });
      
      await time.increase(time.duration.hours(3));
      await votingContract.finishEpoch();

      assert.isTrue(((await votingContract.calculatePendingReward.call(0, { from: VOTER_0 })).updatedStartEpoch).eq(new BN("1")), "wrong updatedStartEpoch 0");

      //  1
      await votingContract.makeVote(1, {
        from: VOTER_0,
        value: ether("0.22")
      });
      
      await time.increase(time.duration.hours(3));
      await votingContract.finishEpoch();

      assert.isTrue(((await votingContract.calculatePendingReward.call(0, { from: VOTER_0 })).updatedStartEpoch).eq(new BN("2")), "wrong updatedStartEpoch 1");
    });
    
    it.only("should return correct amount with _loopLimit == 0", async function () {
      //  0
      //  winner
      await votingContract.makeVote(1, {
        from: VOTER_0,
        value: ether("0.22")
      });

      //  loser
      await votingContract.makeVote(2, {
        from: VOTER_1,
        value: ether("0.1")
      });

      //  winner
      await votingContract.makeVote(1, {
        from: VOTER_2,
        value: ether("0.1")
      });
      
      await time.increase(time.duration.hours(3));
      await votingContract.finishEpoch();
      await time.increase(time.duration.hours(1));

      // console.log("epochResult poolWinner:", (await votingContract.epochResult.call(0)).poolWinner.toString());
      // console.log("epochResult loserPoolChunk:", (await votingContract.epochResult.call(0)).loserPoolChunk.toString());
      // console.log("epochResult poolWinnerVoterRefundPercentage:", (await votingContract.epochResult.call(0)).poolWinnerVoterRefundPercentage.toString());

      // console.log("     ", (await votingContract.calculatePendingReward.call(0, { from: VOTER_0 })).amount.toString());
      // console.log("     ", (await votingContract.calculatePendingReward.call(0, { from: VOTER_1 })).amount.toString());
      // console.log("     ", (await votingContract.calculatePendingReward.call(0, { from: VOTER_2 })).amount.toString());

      //  moved to pools: 0.015
      assert.isTrue(((await votingContract.calculatePendingReward.call(0, { from: VOTER_0 })).amount).eq(ether("0.244")), "wrong amount for VOTER_0, 0");   //  (0.22 * 95%) + (0.1 * 70% / 2) = 0.244
      assert.isTrue(((await votingContract.calculatePendingReward.call(0, { from: VOTER_1 })).amount).eq(ether("0")), "wrong amount for VOTER_1, 0");       //  0
      assert.isTrue(((await votingContract.calculatePendingReward.call(0, { from: VOTER_2 })).amount).eq(ether("0.13")), "wrong amount for VOTER_2, 0");    //  (0.1 * 95%) + (0.1 * 70% / 2) = 0.13

      // console.log("balance: 0", (await votingContract.getBalanceForPool.call(1, 2)).toString());
      assert.isTrue(((await votingContract.getBalanceForPool.call(1, 1))).eq(ether("0.015")), "wrong balance for 1, epoch 1");
      assert.isTrue(((await votingContract.getBalanceForPool.call(1, 2))).eq(ether("0.015")), "wrong balance for 2, epoch 1");
      
      
      //  1
      //  winner
      await votingContract.makeVote(1, {
        from: VOTER_0,
        value: ether("0.32")
      });

      //  loser
      await votingContract.makeVote(2, {
        from: VOTER_1,
        value: ether("0.12")
      });

      //  winner
      await votingContract.makeVote(1, {
        from: VOTER_2,
        value: ether("0.15")
      });
      // console.log("balance:", (await votingContract.getBalanceForPool.call(1, 2)).toString());
      
      await time.increase(time.duration.hours(3));
      await votingContract.finishEpoch();
      await time.increase(time.duration.hours(1));


      // console.log("epochResult poolWinner:", (await votingContract.epochResult.call(0)).poolWinner.toString());
      // console.log("epochResult loserPoolChunk:", (await votingContract.epochResult.call(0)).loserPoolChunk.toString());
      // console.log("epochResult poolWinnerVoterRefundPercentage:", (await votingContract.epochResult.call(0)).poolWinnerVoterRefundPercentage.toString());
      // console.log("--------------");
      // console.log("epochResult poolWinner:", (await votingContract.epochResult.call(1)).poolWinner.toString());
      // console.log("epochResult loserPoolChunk:", (await votingContract.epochResult.call(1)).loserPoolChunk.toString());
      // console.log("epochResult poolWinnerVoterRefundPercentage:", (await votingContract.epochResult.call(1)).poolWinnerVoterRefundPercentage.toString());

      // console.log("     ", (await votingContract.calculatePendingReward.call(0, { from: VOTER_0 })).amount.toString());
      // console.log("     ", (await votingContract.calculatePendingReward.call(0, { from: VOTER_1 })).amount.toString());
      // console.log("     ", (await votingContract.calculatePendingReward.call(0, { from: VOTER_2 })).amount.toString());

      assert.isTrue(((await votingContract.calculatePendingReward.call(0, { from: VOTER_0 })).amount).eq(ether("0.59525")), "wrong amount for VOTER_0, 1");   //  0.244 + ((0.32 * 95%) + ((0.12 + 0.015) * 70% / 2) = 0.59525
      assert.isTrue(((await votingContract.calculatePendingReward.call(0, { from: VOTER_1 })).amount).eq(ether("0")), "wrong amount for VOTER_1, 1");         //  0
      assert.isTrue(((await votingContract.calculatePendingReward.call(0, { from: VOTER_2 })).amount).eq(ether("0.31975")), "wrong amount for VOTER_2, 1");   //  0.13 + ((0.15 * 95%) + ((0.12 + 0.015) * 70% / 2) = 0.31975


      // console.log("balance: 2", (await votingContract.getBalanceForPool.call(2, 2)).toString());
      assert.isTrue(((await votingContract.getBalanceForPool.call(2, 1))).eq(ether("0.02025")), "wrong balance for 1, epoch 2");
      assert.isTrue(((await votingContract.getBalanceForPool.call(2, 2))).eq(ether("0.02025")), "wrong balance for 2, epoch 2");
      
      
      //  2
      //  loser
      await votingContract.makeVote(1, {
        from: VOTER_0,
        value: ether("0.22")
      });

      //  winner
      await votingContract.makeVote(2, {
        from: VOTER_1,
        value: ether("0.51")
      });

      //  loser
      await votingContract.makeVote(1, {
        from: VOTER_2,
        value: ether("0.11")
      });
      
      await time.increase(time.duration.hours(3));
      await votingContract.finishEpoch();
      await time.increase(time.duration.hours(1));


      // console.log("epochResult poolWinner:", (await votingContract.epochResult.call(2)).poolWinner.toString());
      // console.log("epochResult loserPoolChunk:", (await votingContract.epochResult.call(2)).loserPoolChunk.toString());
      // console.log("epochResult poolWinnerVoterRefundPercentage:", (await votingContract.epochResult.call(2)).poolWinnerVoterRefundPercentage.toString());

      assert.isTrue(((await votingContract.calculatePendingReward.call(0, { from: VOTER_0 })).amount).eq(ether("0.59525")), "wrong amount for VOTER_0, 2");   //  0.59525
      assert.isTrue(((await votingContract.calculatePendingReward.call(0, { from: VOTER_1 })).amount).eq(ether("0.729675")), "wrong amount for VOTER_1, 2");  //  (0.51 * 95%) + ((0.33 + 0.02025) * 70%) = 0.729675
      assert.isTrue(((await votingContract.calculatePendingReward.call(0, { from: VOTER_2 })).amount).eq(ether("0.31975")), "wrong amount for VOTER_2, 2");   //  0.31975

      // console.log("balance:", (await votingContract.getBalanceForPool.call(3, 2)).toString());
      assert.isTrue(((await votingContract.getBalanceForPool.call(3, 1))).eq(ether("0.0525375")), "wrong balance for 1, epoch 3");
      assert.isTrue(((await votingContract.getBalanceForPool.call(3, 2))).eq(ether("0.0525375")), "wrong balance for 2, epoch 3");


      //  3
      //  winner
      await votingContract.makeVote(1, {
        from: VOTER_0,
        value: ether("0.62")
      });

      //  loser
      await votingContract.makeVote(2, {
        from: VOTER_1,
        value: ether("0.51")
      });

      //  winner
      await votingContract.makeVote(1, {
        from: VOTER_2,
        value: ether("0.61")
      });
      
      await time.increase(time.duration.hours(3));
      await votingContract.finishEpoch();
      await time.increase(time.duration.hours(1));


      // console.log("--------", (await votingContract.calculatePendingReward.call(0, { from: VOTER_0 })).amount.toString());
      assert.isTrue(((await votingContract.calculatePendingReward.call(0, { from: VOTER_0 })).amount).eq(ether("1.381138125")), "wrong amount for VOTER_0, 3");   //  0.59525 + (0.62 * 95%) + ((0.51 + 0.0525375) * 70% / 2) = 1.381138125
      assert.isTrue(((await votingContract.calculatePendingReward.call(0, { from: VOTER_1 })).amount).eq(ether("0.729675")), "wrong amount for VOTER_1, 3");      // 0.729675
      assert.isTrue(((await votingContract.calculatePendingReward.call(0, { from: VOTER_2 })).amount).eq(ether("1.096138125")), "wrong amount for VOTER_2, 3");   //  0.31975 + (0.61 * 95%) + ((0.51 + 0.0525375) * 70% / 2) = 1.096138125

      // console.log("balance:", (await votingContract.getBalanceForPool.call(4, 2)).toString());  //  0.084380625
      assert.isTrue(((await votingContract.getBalanceForPool.call(4, 1))).eq(ether("0.084380625")), "wrong balance for 1, epoch 4");
      assert.isTrue(((await votingContract.getBalanceForPool.call(4, 2))).eq(ether("0.084380625")), "wrong balance for 2, epoch 4");


      //  4
      //  draw with both balances == 0
      await time.increase(time.duration.hours(3));
      await votingContract.finishEpoch();
      await time.increase(time.duration.hours(1));


      assert.isTrue(((await votingContract.calculatePendingReward.call(0, { from: VOTER_0 })).amount).eq(ether("1.381138125")), "wrong amount for VOTER_0, 4");   // 1.381138125
      assert.isTrue(((await votingContract.calculatePendingReward.call(0, { from: VOTER_1 })).amount).eq(ether("0.729675")), "wrong amount for VOTER_1, 4");      // 0.729675
      assert.isTrue(((await votingContract.calculatePendingReward.call(0, { from: VOTER_2 })).amount).eq(ether("1.096138125")), "wrong amount for VOTER_2, 4");   // 1.096138125

      // console.log("balance:", (await votingContract.getBalanceForPool.call(5, 1)).toString());
      assert.isTrue(((await votingContract.getBalanceForPool.call(5, 1))).eq(ether("0.084380625")), "wrong balance for 1, epoch 5");
      assert.isTrue(((await votingContract.getBalanceForPool.call(5, 2))).eq(ether("0.084380625")), "wrong balance for 2, epoch 5");


      //  5
      //  loser
      await votingContract.makeVote(1, {
        from: VOTER_0,
        value: ether("0.18")
      });

      //  winner
      await votingContract.makeVote(2, {
        from: VOTER_1,
        value: ether("0.51")
      });

      //  loser
      await votingContract.makeVote(1, {
        from: VOTER_2,
        value: ether("0.11")
      });
      
      await time.increase(time.duration.hours(3));
      await votingContract.finishEpoch();
      await time.increase(time.duration.hours(1));


      // console.log("epochResult poolWinner:", (await votingContract.epochResult.call(2)).poolWinner.toString());
      // console.log("epochResult loserPoolChunk:", (await votingContract.epochResult.call(2)).loserPoolChunk.toString());
      // console.log("epochResult poolWinnerVoterRefundPercentage:", (await votingContract.epochResult.call(2)).poolWinnerVoterRefundPercentage.toString());

      assert.isTrue(((await votingContract.calculatePendingReward.call(0, { from: VOTER_0 })).amount).eq(ether("1.381138125")), "wrong amount for VOTER_0, 5");   //  1.381138125
      assert.isTrue(((await votingContract.calculatePendingReward.call(0, { from: VOTER_1 })).amount).eq(ether("1.4762414375")), "wrong amount for VOTER_1, 5");  //  0.729675 + (0.51 * 95%) + ((0.29 + 0.084380625) * 70%) = 1.4762414375
      assert.isTrue(((await votingContract.calculatePendingReward.call(0, { from: VOTER_2 })).amount).eq(ether("1.096138125")), "wrong amount for VOTER_2, 5");   //  1.096138125

      // console.log("balance:", (await votingContract.getBalanceForPool.call(6, 1)).toString());
      assert.isTrue(((await votingContract.getBalanceForPool.call(6, 1))).eq(ether("0.05615709375")), "wrong balance for 1, epoch 6");
      assert.isTrue(((await votingContract.getBalanceForPool.call(6, 2))).eq(ether("0.05615709375")), "wrong balance for 2, epoch 6");

      //  6 - draw with both balances > 0
      //  draw
      await votingContract.makeVote(1, {
        from: VOTER_0,
        value: ether("0.1")
      });

      //  draw
      await votingContract.makeVote(2, {
        from: VOTER_1,
        value: ether("0.2")
      });

      //  draw
      await votingContract.makeVote(1, {
        from: VOTER_2,
        value: ether("0.1")
      });
      
      await time.increase(time.duration.hours(3));
      await votingContract.finishEpoch();
      await time.increase(time.duration.hours(1));


      // console.log("epochResult poolWinner:", (await votingContract.epochResult.call(2)).poolWinner.toString());
      // console.log("epochResult loserPoolChunk:", (await votingContract.epochResult.call(2)).loserPoolChunk.toString());
      // console.log("epochResult poolWinnerVoterRefundPercentage:", (await votingContract.epochResult.call(2)).poolWinnerVoterRefundPercentage.toString());

      assert.isTrue(((await votingContract.calculatePendingReward.call(0, { from: VOTER_0 })).amount).eq(ether("1.481138125")), "wrong amount for VOTER_0, 6");   //  1.381138125 + 0.1 = 1.481138125
      assert.isTrue(((await votingContract.calculatePendingReward.call(0, { from: VOTER_1 })).amount).eq(ether("1.6762414375")), "wrong amount for VOTER_1, 6");  //  1.4762414375 + 0.2 = 1.6762414375
      assert.isTrue(((await votingContract.calculatePendingReward.call(0, { from: VOTER_2 })).amount).eq(ether("1.196138125")), "wrong amount for VOTER_2, 6");   //  1.096138125 + 0.1 = 1.196138125

      // console.log("balance:", (await votingContract.getBalanceForPool.call(7, 1)).toString());
      assert.isTrue(((await votingContract.getBalanceForPool.call(7, 1))).eq(ether("0.25615709375")), "wrong balance for 1, epoch 7");
      assert.isTrue(((await votingContract.getBalanceForPool.call(7, 2))).eq(ether("0.25615709375")), "wrong balance for 2, epoch 7");

      //  7
      //  winner
      await votingContract.makeVote(1, {
        from: VOTER_2,
        value: ether("0.22")
      });

      //  winner
      await votingContract.makeVote(2, {
        from: VOTER_1,
        value: ether("0.31")
      });

      //  make updates
      await votingContract.updatePoolLoserWinnersDistributionPercentage(11);
      await votingContract.updatePoolWinnerVoterRefundPercentage(12);

      //  loser
      await votingContract.makeVote(1, {
        from: VOTER_0,
        value: ether("0.114")
      });
      
      await time.increase(time.duration.hours(3));
      await votingContract.finishEpoch();
      await time.increase(time.duration.hours(1));


      console.log("--------", (await votingContract.calculatePendingReward.call(0, { from: VOTER_2 })).amount.toString());  //  1.25367676515625
      // assert.isTrue(((await votingContract.calculatePendingReward.call(0, { from: VOTER_0 })).amount).eq(ether("1.381138125")), "wrong amount for VOTER_0, 7");   //  0.481138125 + (0.22 * 12%) + ((0.114 + 0.25615709375) * 11% / 2) = 1.381138125
      // assert.isTrue(((await votingContract.calculatePendingReward.call(0, { from: VOTER_1 })).amount).eq(ether("0.729675")), "wrong amount for VOTER_1, 7");      // 0.729675
      // assert.isTrue(((await votingContract.calculatePendingReward.call(0, { from: VOTER_2 })).amount).eq(ether("1.2428967652")), "wrong amount for VOTER_2, 7");   //  1.196138125 + (0.22 * 12%) + ((0.114 + 0.25615709375) * 11% / 2) = 1.2428967652

      // // console.log("balance:", (await votingContract.getBalanceForPool.call(4, 2)).toString());  //  0.084380625
      // assert.isTrue(((await votingContract.getBalanceForPool.call(4, 1))).eq(ether("0.084380625")), "wrong balance for 1, epoch 8");
      // assert.isTrue(((await votingContract.getBalanceForPool.call(4, 2))).eq(ether("0.084380625")), "wrong balance for 2, epoch 8");
    });

    it("should return correct amount with custom _loopLimit", async function () {

    });
    
    it("should return correct updatedStartEpoch with _loopLimit == 0", async function () {
      
    });

    it("should return correct updatedStartEpoch with custom _loopLimit", async function () {
      
    });
  });

});
