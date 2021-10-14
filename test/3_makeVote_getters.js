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
      assert.equal(0, (await votingContract.getVotersCountForPool.call(0, 1)).cmp(new BN(0)), "getVotersCountForPool for 1 should be 0 before");

      let votersPool_2 = await votingContract.getVotersForPool.call(0, 2);
      assert.equal(0, votersPool_2.length, "should be 0 before");
      assert.equal(0, (await votingContract.getVotersCountForPool.call(0, 2)).cmp(new BN(0)), "getVotersCountForPool for 2 should be 0 before");

      //  0
      await votingContract.makeVote(1, {
        from: VOTER_0,
        value: ether("0.2")
      });
      votersPool_1 = await votingContract.getVotersForPool.call(0, 1);
      assert.equal(1, votersPool_1.length, "should be 1 after");
      assert.equal(VOTER_0, votersPool_1[0], "should be VOTER_0");

      assert.equal(0, (await votingContract.getVotersCountForPool.call(0, 1)).cmp(new BN(1)), "getVotersCountForPool for 1 should be 1 after");
      assert.equal(0, (await votingContract.getVotersCountForPool.call(0, 2)).cmp(new BN(0)), "getVotersCountForPool for 2 should be 0 after");


      //  1
      await votingContract.makeVote(1, {
        from: VOTER_1,
        value: ether("0.21")
      });
      votersPool_1 = await votingContract.getVotersForPool.call(0, 1);
      assert.equal(2, votersPool_1.length, "should be 2 after");
      assert.equal(VOTER_0, votersPool_1[0], "should be VOTER_0");
      assert.equal(VOTER_1, votersPool_1[1], "should be VOTER_1");

      assert.equal(0, (await votingContract.getVotersCountForPool.call(0, 1)).cmp(new BN(2)), "getVotersCountForPool for 1 should be 2 after");
      assert.equal(0, (await votingContract.getVotersCountForPool.call(0, 2)).cmp(new BN(0)), "getVotersCountForPool for 2 should be 0 after");


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

      assert.equal(0, (await votingContract.getVotersCountForPool.call(0, 1)).cmp(new BN(2)), "getVotersCountForPool for 1 should be 2 after");
      assert.equal(0, (await votingContract.getVotersCountForPool.call(0, 2)).cmp(new BN(1)), "getVotersCountForPool for 2 should be 1 after");
      return
    });

    it("should add epoch in epochListForVoter", async function () {
      //  0
      await assert.equal((await votingContract.getEpochListForVoter.call(VOTER_0)).length, 0, "should be 0 before");
      
      await votingContract.makeVote(1, {
        from: VOTER_0,
        value: ether("0.21")
      });

      await assert.equal((await votingContract.getEpochListForVoter.call(VOTER_0)).length, 1, "should be 1 after");
      await assert.equal(0, ((await votingContract.getEpochListForVoter.call(VOTER_0))[0]).cmp(new BN("0")), "should be 0 after");

      await time.increase(time.duration.hours(3));
      await votingContract.finishEpoch();

      //  1
      await time.increase(time.duration.hours(3));
      await votingContract.finishEpoch();

      //  2
      await assert.equal((await votingContract.getEpochListForVoter.call(VOTER_0)).length, 1, "should be 1 before 2");
      
      await votingContract.makeVote(1, {
        from: VOTER_0,
        value: ether("0.21")
      });

      await assert.equal((await votingContract.getEpochListForVoter.call(VOTER_0)).length, 2, "should be 2 after");
      await assert.equal(0, ((await votingContract.getEpochListForVoter.call(VOTER_0))[0]).cmp(new BN("0")), "should be 0 after 2");
      await assert.equal(0, ((await votingContract.getEpochListForVoter.call(VOTER_0))[1]).cmp(new BN("2")), "should be 2 after 2");
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
        value: ether("0.13")
      });
      stake = new BN((await votingContract.getVoteForVoter(0, VOTER_0)).stake);
      assert.equal(0, stake.cmp(ether("0.25")), "should be ether(0.25) after");
    });
    
    it("should increase balanceForPool.staked", async function () {
      await assert.equal((await votingContract.getPoolBalance(0, 1)).staked, 0, "should be 0 before");
      
      await votingContract.makeVote(1, {
        from: VOTER_0,
        value: ether("0.12")
      });
      assert.equal(0, (new BN((await votingContract.getPoolBalance(0, 1)).staked)).cmp(ether("0.12")), "should be 0.12 after");

      await votingContract.makeVote(1, {
        from: VOTER_0,
        value: ether("0.22")
      });
      assert.equal(0, (new BN((await votingContract.getPoolBalance(0, 1)).staked)).cmp(ether("0.34")), "should be 0.34 after");
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

  describe("getPoolBalanceTotal", function () {
    it("should fail if Wrong epoch", async function () {
      await expectRevert(votingContract.getPoolBalanceTotal.call(1, 1), "Wrong epoch");
    });
    
    it("should fail if Wrong pool", async function () {
      await expectRevert(votingContract.getPoolBalanceTotal.call(0, 0), "Wrong pool");
    });
    
    it("should return sum(startedWith + staked)", async function () {
      //  0
      await votingContract.makeVote(1, {
        from: VOTER_0,
        value: ether("0.2")
      });
      await votingContract.makeVote(2, {
        from: VOTER_1,
        value: ether("0.4")
      });

      assert.equal(0, (await votingContract.getPoolBalanceTotal.call(0, 1)).cmp(ether("0.2")), "wrong for 1 after 0")
      assert.equal(0, (await votingContract.getPoolBalanceTotal.call(0, 2)).cmp(ether("0.4")), "wrong for 2 after 0")
      
      await time.increase(time.duration.hours(3));
      await votingContract.finishEpoch();


      //  1
      await votingContract.makeVote(1, {
        from: VOTER_0,
        value: ether("0.3")
      });
      await votingContract.makeVote(2, {
        from: VOTER_1,
        value: ether("0.5")
      });

      assert.equal(0, (await votingContract.getPoolBalanceTotal.call(1, 1)).cmp(ether("0.33")), "wrong for 1 after 1")  //  0.2 * 0.3 / 2 + 0.3 = 0.33
      assert.equal(0, (await votingContract.getPoolBalanceTotal.call(1, 2)).cmp(ether("0.53")), "wrong for 2 after 0")  //  0.2 * 0.3 / 2 + 0.5 = 0.53
      
      await time.increase(time.duration.hours(3));
      await votingContract.finishEpoch();
    });
  });
    
  describe("getVoteForVoter", function () {
    it("should fail if Wrong epoch", async function () {
      await expectRevert(votingContract.getVoteForVoter.call(1, VOTER_0), "Wrong epoch");
    });
    
    it("should return correct Vote struct", async function () {
      //  0
      await votingContract.makeVote(1, {
        from: VOTER_0,
        value: ether("0.21")
      });

      let vote = await votingContract.getVoteForVoter.call(0, VOTER_0);
      await assert.equal(vote.pool, 1, "should be 1 after 1");
      await assert.equal(0, (new BN(vote.stake)).cmp(ether("0.21")), "wrong stake after 0");

      await time.increase(time.duration.hours(3));
      await votingContract.finishEpoch();

      //  1
      await votingContract.makeVote(2, {
        from: VOTER_1,
        value: ether("0.23")
      });

      //  VOTER_0
      vote = await votingContract.getVoteForVoter.call(0, VOTER_0);
      await assert.equal(vote.pool, 1, "should be 1 after 1");
      await assert.equal(0, (new BN(vote.stake)).cmp(ether("0.21")), "wrong stake after 1");

      //  VOTER_1
      vote = await votingContract.getVoteForVoter.call(1, VOTER_1);
      await assert.equal(vote.pool, 2, "should be 2 after 1");
      await assert.equal(0, (new BN(vote.stake)).cmp(ether("0.23")), "wrong stake after 1");

      await time.increase(time.duration.hours(3));
      await votingContract.finishEpoch();

      //  2      
      await votingContract.makeVote(1, {
        from: VOTER_0,
        value: ether("0.222")
      });

      //  VOTER_0
      vote = await votingContract.getVoteForVoter.call(0, VOTER_0);
      await assert.equal(vote.pool, 1, "should be 1 after 1");
      await assert.equal(0, (new BN(vote.stake)).cmp(ether("0.21")), "wrong stake after 2 for VOTER_0");

      vote = await votingContract.getVoteForVoter.call(2, VOTER_0);
      await assert.equal(vote.pool, 1, "should be 1 after 2");
      await assert.equal(0, (new BN(vote.stake)).cmp(ether("0.222")), "wrong stake after 2 for VOTER_0");

      //  VOTER_1
      vote = await votingContract.getVoteForVoter.call(1, VOTER_1);
      await assert.equal(vote.pool, 2, "should be 2 after 1");
      await assert.equal(0, (new BN(vote.stake)).cmp(ether("0.23")), "wrong stake after 2 for VOTER_1");
    });
  });
});
