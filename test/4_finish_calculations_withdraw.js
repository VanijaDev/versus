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
const { MAX_UINT256 } = require('@openzeppelin/test-helpers/src/constants');

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

    await versusToken.mint(OWNER, ether("10"));
    await versusToken.approve(votingContract.address, MAX_UINT256);
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

    it("should set correct EpochResult", async function () {
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
      assert.equal(0, result.devFee.cmp(ether("0.026")), "wrong devFee"); //  (0.22 + 0.3) * 5% = 0.026

      //  1
      await votingContract.makeVote(2, {
        from: VOTER_0,
        value: ether("0.32")
      });
      await votingContract.makeVote(2, {
        from: VOTER_1,
        value: ether("0.13")
      });

      await votingContract.makeVote(1, {
        from: VOTER_2,
        value: ether("0.22")
      });

      await time.increase(time.duration.hours(3));
      await votingContract.finishEpoch();

      let result_0 = await votingContract.epochResult.call(0);
      assert.equal(0, result_0.poolWinner.cmp(new BN("1")), "wrong poolWinner, result_0");
      assert.equal(0, result_0.devFee.cmp(ether("0.026")), "wrong devFee, result_0");

      let result_1 = await votingContract.epochResult.call(1);
      assert.equal(0, result_1.poolWinner.cmp(new BN("2")), "wrong poolWinner, result_1");
      assert.equal(0, result_1.devFee.cmp(ether("0.02565")), "wrong devFee, result_1"); // ((0.42 * 30% / 2) +  (0.32 + 0.13)) * 5% = 0.02565
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

      let balanceBefore = await balance.current(DEV_FEE_RECEIVER);

      await time.increase(time.duration.hours(3));
      await votingContract.finishEpoch();

      let balanceAfter = await balance.current(DEV_FEE_RECEIVER);
      assert.isTrue((new BN((balanceAfter - balanceBefore).toString())).eq(ether("0.026")), "wrong balance after"); //  (0.22 + 0.3) * 5% = 0.026
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

    it("should not transfer balance to pools for next epoch if loser pool has no votes", async function () {
      await votingContract.makeVote(1, {
        from: VOTER_0,
        value: ether("0.22")
      });
      await votingContract.makeVote(1, {
        from: VOTER_1,
        value: ether("0.3")
      });

      await time.increase(time.duration.hours(3));
      await votingContract.finishEpoch();

      assert.equal(0, (await votingContract.getPoolBalanceTotal.call(1, 1)).cmp(new BN("0")), "should be 0 for 1");
      assert.equal(0, (await votingContract.getPoolBalanceTotal.call(1, 2)).cmp(new BN("0")), "should be 0 for 2");
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

      assert.equal(0, ether("0.063").cmp((new BN(await votingContract.getPoolBalanceTotal.call(1, 1)))), "wrong balance after 0 for 1");  //  0.42 * 30% / 2
      assert.equal(0, ether("0.063").cmp((new BN(await votingContract.getPoolBalanceTotal.call(1, 2)))), "wrong balance after 0 for 2");  //  0.42 * 30% / 2


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

      assert.equal(0, ether("0.04245").cmp((new BN(await votingContract.getPoolBalanceTotal.call(2, 1)))), "wrong balance after 0 for 1");   //  (0.42 * 30% / 2 + 0.22) * 30% / 2
      assert.equal(0, ether("0.04245").cmp((new BN(await votingContract.getPoolBalanceTotal.call(2, 2)))), "wrong balance after 0 for 2");
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

  describe("calculatePendingReward", function () {
    it("should return 0,0 if No epoch played", async function () {
      const res = await votingContract.calculatePendingReward.call(0);
      assert.equal(0, res.amount.cmp(new BN("0")), "amount must be 0");
      assert.equal(0, res.updatedStartIdx.cmp(new BN("0")), "updatedStartIdx must be 0");
    });

    it("should return 0,0 if startIdx is current epoch", async function () {
      await votingContract.makeVote(1, {
        from: VOTER_0,
        value: ether("0.22")
      });
      
      await time.increase(time.duration.hours(3));
      await votingContract.finishEpoch();
      await votingContract.withdrawPendingReward(0, {from: VOTER_0});

      const res = await votingContract.calculatePendingReward.call(0);
      assert.equal(0, res.amount.cmp(new BN("0")), "amount must be 0");
      assert.equal(0, res.updatedStartIdx.cmp(new BN("0")), "updatedStartIdx must be 0");
    });
    
    it("should fail if Wrong stopIdx", async function () {
      await votingContract.makeVote(1, {
        from: VOTER_0,
        value: ether("0.22")
      });
      
      await time.increase(time.duration.hours(3));
      await votingContract.finishEpoch();

      await expectRevert(votingContract.calculatePendingReward(10, {from: VOTER_0}), "Wrong stopIdx");
    });

    it("should return 0,0 if stopIdx is current epoch", async function () {
      await votingContract.makeVote(1, {
        from: VOTER_0,
        value: ether("0.22")
      });

      const res = await votingContract.calculatePendingReward.call(0);
      assert.equal(0, res.amount.cmp(new BN("0")), "amount must be 0");
      assert.equal(0, res.updatedStartIdx.cmp(new BN("0")), "updatedStartIdx must be 0");
    });

    it("should add 0 for pool loser if has no votes", async function () {
      await votingContract.makeVote(1, {
        from: VOTER_0,
        value: ether("0.22")
      });
      
      await time.increase(time.duration.hours(3));
      await votingContract.finishEpoch();

      let res = await votingContract.calculatePendingReward(0, { from: VOTER_0 });
      assert.equal(0, res.amount.cmp(ether("0.209")), "wrong amount"); //  0.22 * 95%
    });
    
    it("should not calculate for epoch if it is currentEpoch", async function () {
      //  0
      await votingContract.makeVote(1, {
        from: VOTER_0,
        value: ether("0.22")
      });
      
      await time.increase(time.duration.hours(3));
      await votingContract.finishEpoch();

      //  1
      await votingContract.makeVote(1, {
        from: VOTER_0,
        value: ether("0.22")
      });
      
      await time.increase(time.duration.hours(3));
      await votingContract.finishEpoch();

      //  2
      await votingContract.makeVote(1, {
        from: VOTER_0,
        value: ether("0.22")
      });
      
      let res = await votingContract.calculatePendingReward(0, { from: VOTER_0 });
      assert.equal(0, res.updatedStartIdx.cmp(new BN("2")), "should be 2");
    });
    
    it("should return correct updatedStartIdx if last epoch is currentEpoch", async function () {
      //  0
      await votingContract.makeVote(1, {
        from: VOTER_0,
        value: ether("0.22")
      });
      
      await time.increase(time.duration.hours(3));
      await votingContract.finishEpoch();
      
      res = await votingContract.calculatePendingReward(0, { from: VOTER_0 });
      assert.equal(0, res.updatedStartIdx.cmp(new BN("1")), "should be 1");

      //  1
      await votingContract.makeVote(1, {
        from: VOTER_0,
        value: ether("0.22")
      });
      
      await time.increase(time.duration.hours(3));
      await votingContract.finishEpoch();
      
      res = await votingContract.calculatePendingReward(0, { from: VOTER_0 });
      assert.equal(0, res.updatedStartIdx.cmp(new BN("2")), "should be 2");

      //  2
      await votingContract.makeVote(1, {
        from: VOTER_0,
        value: ether("0.22")
      });
      
      res = await votingContract.calculatePendingReward(0, { from: VOTER_0 });
      assert.equal(0, res.updatedStartIdx.cmp(new BN("2")), "should be 2");
    });
    
    it("should return correct updatedStartIdx if last epoch > currentEpoch", async function () {
      //  0
      await votingContract.makeVote(1, {
        from: VOTER_0,
        value: ether("0.22")
      });
      
      await time.increase(time.duration.hours(3));
      await votingContract.finishEpoch();
      
      res = await votingContract.calculatePendingReward(0, { from: VOTER_0 });
      assert.equal(0, res.updatedStartIdx.cmp(new BN("1")), "should be 1");

      //  1
      await votingContract.makeVote(1, {
        from: VOTER_0,
        value: ether("0.22")
      });
      
      await time.increase(time.duration.hours(3));
      await votingContract.finishEpoch();
      
      res = await votingContract.calculatePendingReward(0, { from: VOTER_0 });
      assert.equal(0, res.updatedStartIdx.cmp(new BN("2")), "should be 2");

      //  2
      await votingContract.makeVote(1, {
        from: VOTER_0,
        value: ether("0.22")
      });
      
      await time.increase(time.duration.hours(3));
      await votingContract.finishEpoch();
      
      res = await votingContract.calculatePendingReward(0, { from: VOTER_0 });
      assert.equal(0, res.updatedStartIdx.cmp(new BN("3")), "should be 3");

      //  custom
      res = await votingContract.calculatePendingReward(1, { from: VOTER_0 });
      assert.equal(0, res.updatedStartIdx.cmp(new BN("1")), "should be 1");

      res = await votingContract.calculatePendingReward(2, { from: VOTER_0 });
      assert.equal(0, res.updatedStartIdx.cmp(new BN("2")), "should be 2");

      res = await votingContract.calculatePendingReward(3, { from: VOTER_0 });
      assert.equal(0, res.updatedStartIdx.cmp(new BN("3")), "should be 3");
    });

    it("should return correct amount & updatedStartIdx with _loopLimit == 0 after multiple epochs, single player", async function () {
      //  0
      await votingContract.makeVote(1, {
        from: VOTER_0,
        value: ether("0.22")
      });
      
      await time.increase(time.duration.hours(3));
      await votingContract.finishEpoch();
      
      let res0 = await votingContract.calculatePendingReward(0, { from: VOTER_0 });
      assert.equal(0, res0.amount.cmp(ether("0.209")), "should be 0.209"); //  0.22 * 95% = 0.209

      //  1
      await votingContract.makeVote(1, {
        from: VOTER_1,
        value: ether("0.123456789")
      });
      
      await time.increase(time.duration.hours(3));
      await votingContract.finishEpoch();
      
      let res1 = await votingContract.calculatePendingReward(0, { from: VOTER_1 });
      // console.log("res1: ", res.amount.toString());
      assert.equal(0, res1.amount.cmp(ether("0.11728394955")), "should be 0.11728394955"); //  0.123456789 * 95% = 0.11728394955

      //  2
      await votingContract.makeVote(1, {
        from: VOTER_2,
        value: ether("0.987654321234567898")
      });
      
      await time.increase(time.duration.hours(3));
      await votingContract.finishEpoch();
      
      let res2 = await votingContract.calculatePendingReward(0, { from: VOTER_2 });
      // console.log("res2: ", res2.amount.toString());
      assert.equal(0, res2.amount.cmp(ether("0.938271605172839504")), "should be 0.938271605172839504"); //  0.987654321234567898 * 95% = 0.9382716051728395031 -> 0.938271605172839504

      //  3
      await votingContract.makeVote(1, {
        from: OTHER,
        value: ether("0.5432")
      });
      
      await time.increase(time.duration.hours(3));
      await votingContract.finishEpoch();
      
      let res3 = await votingContract.calculatePendingReward(0, { from: OTHER });
      // console.log("res3: ", res3.amount.toString());
      assert.equal(0, res3.amount.cmp(ether("0.51604")), "should be 0.51604"); //  0.54 * 95% = 0.51604
    });

    it("should return correct amount & updatedStartIdx with _loopLimit == 0 after multiple epochs, multiple players", async function () {
      //  0
      await votingContract.makeVote(1, {
        from: VOTER_0,
        value: ether("0.2255")
      });

      await votingContract.makeVote(1, {
        from: VOTER_1,
        value: ether("0.331")
      });
    
      await votingContract.makeVote(2, {
        from: VOTER_2,
        value: ether("0.44")
      });
      
      await time.increase(time.duration.hours(3));
      await votingContract.finishEpoch();
      
      //  1) prizes:              (0.2255 + 0.331) * 95% = 0.528675
      //  2) 70% of loser pool:   0.44 * 70% = 0.308
      //  3) part: 0.2255 / (0.2255 + 0.331) = 0.405211141060197664
      //  4) amount = (0.528675 + 0.308) * 0.405211141060197664 = 0.339030031446540881 -> 0.339030031446540880
      let res0_v0 = await votingContract.calculatePendingReward(0, { from: VOTER_0 });
      // console.log("res0_v0: ", res0_v0.amount.toString());
      assert.equal(0, res0_v0.amount.cmp(ether("0.339030031446540880")), "should be 0.339030031446540880, res0_v0");
      assert.equal(0, res0_v0.updatedStartIdx.cmp(new BN("1")), "should be 1, res0_v0");

      //  1) prizes:              (0.2255 + 0.331) * 95% = 0.528675
      //  2) 70% of loser pool:   0.44 * 70% = 0.308
      //  3) part: 0.331 / (0.2255 + 0.331) = 0.594788858939802336
      //  4) amount = (0.528675 + 0.308) * 0.594788858939802336 = 0.497644968553459119
      let res0_v1 = await votingContract.calculatePendingReward(0, { from: VOTER_1 });
      // console.log("res0_v1: ", res0_v1.amount.toString());
      assert.equal(0, res0_v1.amount.cmp(ether("0.497644968553459119")), "should be 0.497644968553459119, res0_v1");
      assert.equal(0, res0_v1.updatedStartIdx.cmp(new BN("1")), "should be 1, res0_v1");


      let res0_v2 = await votingContract.calculatePendingReward(0, { from: VOTER_2 });
      assert.equal(0, res0_v2.amount.cmp(ether("0")), "should be 0, res0_v2");
      assert.equal(0, res0_v2.updatedStartIdx.cmp(new BN("1")), "should be 1, res0_v2");


      //  1
      await votingContract.makeVote(1, {
        from: VOTER_0,
        value: ether("0.543")
      });

      await votingContract.makeVote(2, {
        from: VOTER_1,
        value: ether("0.12")
      });
    
      await votingContract.makeVote(1, {
        from: VOTER_2,
        value: ether("0.723")
      });
      
      await time.increase(time.duration.hours(3));
      await votingContract.finishEpoch();
      
      //  0) startedWith:         0.44 * 30% / 2 = 0.066
      //  00) prev:               0.339030031446540880
      //  1) prizes:              (0.543 + 0.723 + 0.066) * 95% = 1.2654
      //  2) 70% of loser pool:   (0.12 + 0.066) * 70% = 0.1302
      //  3) part:                0.543 / (0.543 + 0.723) = 0.428909952606635071
      //  4) amount:              (1.2654 + 0.1302) * 0.428909952606635071 = 0.598586729857819905 + 0.339030031446540880 = 0.937616761304360785
      let res1_v0 = await votingContract.calculatePendingReward(0, { from: VOTER_0 });
      // console.log("res1_v0: ", res1_v0.amount.toString());
      assert.equal(0, res1_v0.amount.cmp(ether("0.937616761304360785")), "should be 0.937616761304360785, res1_v0");
      assert.equal(0, res1_v0.updatedStartIdx.cmp(new BN("2")), "should be 2, res1_v0");

      //  0) startedWith:         0.44 * 30% / 2 = 0.066
      //  00) prev:               0.339030031446540880
      //  1) prizes:              (0.543 + 0.723 + 0.066) * 95% = 1.2654
      //  2) 70% of loser pool:   (0.12 + 0.066) * 70% = 0.1302
      //  3) part:                0
      //  4) amount:              0
      let res1_v1 = await votingContract.calculatePendingReward(0, { from: VOTER_1 });
      // console.log("res1_v1: ", res1_v1.amount.toString());
      assert.equal(0, res1_v1.amount.cmp(ether("0.497644968553459119")), "should be 0.497644968553459119, res1_v1");
      assert.equal(0, res1_v1.updatedStartIdx.cmp(new BN("2")), "should be 2, res1_v1");

      //  0) startedWith:         0.44 * 30% / 2 = 0.066
      //  00) prev:               0
      //  1) prizes:              (0.543 + 0.723 + 0.066) * 95% = 1.2654
      //  2) 70% of loser pool:   (0.12 + 0.066) * 70% = 0.1302
      //  3) part:                0.723 / (0.543 + 0.723) = 0.571090047393364929
      //  4) amount:              (1.2654 + 0.1302) * 0.571090047393364929 = 0.797013270142180095 + 0 = 0.797013270142180095 -> 0.797013270142180094
      let res1_v2 = await votingContract.calculatePendingReward(0, { from: VOTER_2 });
      // console.log("res1_v2: ", res1_v2.amount.toString());
      assert.equal(0, res1_v2.amount.cmp(ether("0.797013270142180094")), "should be 0.797013270142180094, res1_v2");
      assert.equal(0, res1_v2.updatedStartIdx.cmp(new BN("2")), "should be 2, res1_v2");


      //  2
      await votingContract.makeVote(1, {
        from: VOTER_0,
        value: ether("0.444")
      });

      await votingContract.makeVote(2, {
        from: VOTER_1,
        value: ether("0.333")
      });
    
      await votingContract.makeVote(2, {
        from: VOTER_2,
        value: ether("0.555")
      });
      
      await time.increase(time.duration.hours(3));
      await votingContract.finishEpoch();
      
      //  0) startedWith:         
      //  00) prev:               0.937616761304360785
      //  1) prizes:              
      //  2) 70% of loser pool:   
      //  3) part:                
      //  4) amount:              
      let res2_v0 = await votingContract.calculatePendingReward(0, { from: VOTER_0 });
      // console.log("res2_v0: ", res2_v0.amount.toString());
      assert.equal(0, res2_v0.amount.cmp(ether("0.937616761304360785")), "should be 0.937616761304360785, res2_v0");
      assert.equal(0, res2_v0.updatedStartIdx.cmp(new BN("3")), "should be 3, res2_v0");


      //  0) startedWith:         (0.12 + 0.066) * 30% / 2 = 0.0279
      //  00) prev:               0.497644968553459119
      //  1) prizes:              (0.333 + 0.555 + 0.0279) * 95% = 0.870105
      //  2) 70% of loser pool:   (0.444 + 0.0279) * 70% = 0.33033
      //  3) part:                0.333 / (0.333 + 0.555) = 0.375
      //  4) amount:              (0.870105 + 0.33033) * 0.375 = 0.450163125 + 0.497644968553459119 = 0.947808093553459119
      let res2_v1 = await votingContract.calculatePendingReward(0, { from: VOTER_1 });
      // console.log("res2_v1: ", res2_v1.amount.toString());
      assert.equal(0, res2_v1.amount.cmp(ether("0.947808093553459119")), "should be 0.947808093553459119, res2_v1");
      assert.equal(0, res2_v1.updatedStartIdx.cmp(new BN("3")), "should be 3, res2_v1");

      //  0) startedWith:         (0.12 + 0.066) * 30% / 2 = 0.0279
      //  00) prev:               0.797013270142180094
      //  1) prizes:              (0.333 + 0.555 + 0.0279) * 95% = 0.870105
      //  2) 70% of loser pool:   (0.444 + 0.0279) * 70% = 0.33033
      //  3) part:                0.555 / (0.333 + 0.555) = 0.625
      //  4) amount:              (0.870105 + 0.33033) * 0.625 = 0.750271875 + 0.797013270142180094 = 1.547285145142180094
      let res2_v2 = await votingContract.calculatePendingReward(0, { from: VOTER_2 });
      // console.log("res2_v2: ", res2_v2.amount.toString());
      assert.equal(0, res2_v2.amount.cmp(ether("1.547285145142180094")), "should be 1.547285145142180094, res2_v2");
      assert.equal(0, res2_v2.updatedStartIdx.cmp(new BN("3")), "should be 3, res2_v2");


      //  3
      await votingContract.makeVote(1, {
        from: VOTER_0,
        value: ether("0.6786")
      });

      await votingContract.makeVote(2, {
        from: VOTER_1,
        value: ether("0.98123")
      });
    
      await votingContract.makeVote(2, {
        from: VOTER_2,
        value: ether("0.32")
      });
    
      await votingContract.makeVote(2, {
        from: OTHER,
        value: ether("0.1")
      });
      
      await time.increase(time.duration.hours(3));
      await votingContract.finishEpoch();
      
      //  0) startedWith:         
      //  00) prev:               0.937616761304360785
      //  1) prizes:              
      //  2) 70% of loser pool:   
      //  3) part:                
      //  4) amount:              
      let res3_v0 = await votingContract.calculatePendingReward(0, { from: VOTER_0 });
      // console.log("res3_v0: ", res3_v0.amount.toString());
      assert.equal(0, res3_v0.amount.cmp(ether("0.937616761304360785")), "should be 0.937616761304360785, res3_v0");
      assert.equal(0, res3_v0.updatedStartIdx.cmp(new BN("4")), "should be 4, res3_v0");


      //  0) startedWith:         (0.444 + 0.0279) * 30% / 2 = 0.070785
      //  00) prev:               0.947808093553459119
      //  1) prizes:              (0.98123 + 0.32 + 0.1 + 0.070785) * 95% = 1.39841425
      //  2) 70% of loser pool:   (0.6786 + 0.070785) * 70% = 0.5245695
      //  3) part:                0.98123 / (0.98123 + 0.32 + 0.1) = 0.70026334006551386996
      //  4) amount:              (1.39841425 + 0.5245695) * 0.70026334006551386996 = 1.3465950236667071073 + 0.947808093553459119 = 2.2944031172201662263
      let res3_v1 = await votingContract.calculatePendingReward(0, { from: VOTER_1 });
      // console.log("res3_v1: ", res3_v1.amount.toString());
      assert.equal(0, res3_v1.amount.cmp(ether("2.294403117220166226")), "should be 2.294403117220166226, res3_v1");
      assert.equal(0, res3_v1.updatedStartIdx.cmp(new BN("4")), "should be 4, res3_v1");

      //  0) startedWith:         (0.444 + 0.0279) * 30% / 2 = 0.070785
      //  00) prev:               1.547285145142180094
      //  1) prizes:              (0.98123 + 0.32 + 0.1 + 0.070785) * 95% = 1.39841425
      //  2) 70% of loser pool:   (0.6786 + 0.070785) * 70% = 0.5245695
      //  3) part:                0.32 / (0.98123 + 0.32 + 0.1) = 0.2283707885215132419
      //  4) amount:              (1.39841425 + 0.5245695) * 0.2283707885215132419 = 0.4391533153015564896 + 1.547285145142180094 = 1.986438460443736584 -> 1.986438460443736583
      let res3_v2 = await votingContract.calculatePendingReward(0, { from: VOTER_2 });
      // console.log("res3_v2: ", res3_v2.amount.toString());
      assert.equal(0, res3_v2.amount.cmp(ether("1.986438460443736583")), "should be 1.986438460443736583, res3_v2");
      assert.equal(0, res3_v2.updatedStartIdx.cmp(new BN("4")), "should be 4, res3_v2");

      //  0) startedWith:         (0.444 + 0.0279) * 30% / 2 = 0.070785
      //  00) prev:               0
      //  1) prizes:              (0.98123 + 0.32 + 0.1 + 0.070785) * 95% = 1.39841425
      //  2) 70% of loser pool:   (0.6786 + 0.070785) * 70% = 0.5245695
      //  3) part:                0.1 / (0.98123 + 0.32 + 0.1) = 0.07136587141297288811
      //  4) amount:              (1.39841425 + 0.5245695) * 0.07136587141297288811 = 0.137235411031736403
      let res3_v4 = await votingContract.calculatePendingReward(0, { from: OTHER });
      // console.log("res3_v4: ", res3_v4.amount.toString());
      assert.equal(0, res3_v4.amount.cmp(ether("0.137235411031736403")), "should be 0.137235411031736403, res3_v4");
      assert.equal(0, res3_v4.updatedStartIdx.cmp(new BN("1")), "should be 1, res3_v4");

      //  test custom loopLimit
      
      //  VOTER_0
      assert.equal(0, ((await votingContract.calculatePendingReward(1, { from: VOTER_0 })).amount).cmp(ether("0.339030031446540880")), "wrong amount for VOTER_0, 1");
      assert.equal(0, ((await votingContract.calculatePendingReward(2, { from: VOTER_0 })).amount).cmp(ether("0.937616761304360785")), "wrong amount for VOTER_0, 2");
      assert.equal(0, ((await votingContract.calculatePendingReward(3, { from: VOTER_0 })).amount).cmp(ether("0.937616761304360785")), "wrong amount for VOTER_0, 3");
      assert.equal(0, ((await votingContract.calculatePendingReward(4, { from: VOTER_0 })).amount).cmp(ether("0.937616761304360785")), "wrong amount for VOTER_0, 4");

      //  VOTER_1
      assert.equal(0, ((await votingContract.calculatePendingReward(1, { from: VOTER_1 })).amount).cmp(ether("0.497644968553459119")), "wrong amount for VOTER_1, 1");
      assert.equal(0, ((await votingContract.calculatePendingReward(2, { from: VOTER_1 })).amount).cmp(ether("0.497644968553459119")), "wrong amount for VOTER_1, 2");
      assert.equal(0, ((await votingContract.calculatePendingReward(3, { from: VOTER_1 })).amount).cmp(ether("0.947808093553459119")), "wrong amount for VOTER_1, 3");
      assert.equal(0, ((await votingContract.calculatePendingReward(4, { from: VOTER_1 })).amount).cmp(ether("2.294403117220166226")), "wrong amount for VOTER_1, 4");

      //  VOTER_2
      assert.equal(0, ((await votingContract.calculatePendingReward(1, { from: VOTER_2 })).amount).cmp(ether("0")), "wrong amount for VOTER_2, 1");
      assert.equal(0, ((await votingContract.calculatePendingReward(2, { from: VOTER_2 })).amount).cmp(ether("0.797013270142180094")), "wrong amount for VOTER_2, 2");
      assert.equal(0, ((await votingContract.calculatePendingReward(3, { from: VOTER_2 })).amount).cmp(ether("1.547285145142180094")), "wrong amount for VOTER_2, 3");
      assert.equal(0, ((await votingContract.calculatePendingReward(4, { from: VOTER_2 })).amount).cmp(ether("1.986438460443736583")), "wrong amount for VOTER_2, 4");

      //  OTHER
      assert.equal(0, ((await votingContract.calculatePendingReward(1, { from: OTHER })).amount).cmp(ether("0.137235411031736403")), "wrong amount for OTHER, 1");
    });
  });

  describe("withdrawPendingReward", function () {    
    it("should transfer correct 1) amount & 2) VERSUS & 3) update indexToStartCalculationsForVoter in between voting", async function () {
      //  0
      await votingContract.makeVote(1, {
        from: VOTER_0,
        value: ether("0.22")
      });

      await votingContract.makeVote(2, {
        from: VOTER_1,
        value: ether("0.32")
      });
      
      await time.increase(time.duration.hours(3));
      await votingContract.finishEpoch();

      //  VOTER_0
      let versusBalanceBefore_voter0 = await versusToken.balanceOf(VOTER_0);
      let ethBalanceBefore_voter0 = await balance.current(VOTER_0);

      let tx = await votingContract.withdrawPendingReward(0, { from: VOTER_0 });
      let gasUsed = new BN(tx.receipt.gasUsed);
      let txInfo = await web3.eth.getTransaction(tx.tx);
      let gasPrice = new BN(txInfo.gasPrice);
      let gasSpent = gasUsed.mul(gasPrice);

      let versusBalanceAfter_voter0 = await versusToken.balanceOf(VOTER_0);
      let ethBalanceAfter_voter0 = await balance.current(VOTER_0);

      assert.equal(versusBalanceAfter_voter0 - versusBalanceBefore_voter0, 10 ** 18, "Wrong verus balance for VOTER_0 after 0");
      assert.equal(0, ethBalanceBefore_voter0.sub(gasSpent).cmp(ethBalanceAfter_voter0), "Wrong eth balance for VOTER_0 after 0");

      //  VOTER_1
      let versusBalanceBefore_voter1 = await versusToken.balanceOf(VOTER_1);
      let ethBalanceBefore_voter1 = await balance.current(VOTER_1);

      tx = await votingContract.withdrawPendingReward(0, { from: VOTER_1 });
      gasUsed = new BN(tx.receipt.gasUsed);
      txInfo = await web3.eth.getTransaction(tx.tx);
      gasPrice = new BN(txInfo.gasPrice);
      gasSpent = gasUsed.mul(gasPrice);

      let versusBalanceAfter_voter1 = await versusToken.balanceOf(VOTER_1);
      let ethBalanceAfter_voter1 = await balance.current(VOTER_1);

      assert.equal(versusBalanceAfter_voter1 - versusBalanceBefore_voter1, 10 ** 18, "Wrong verus balance for VOTER_1 after 0");
      assert.equal(0, ethBalanceBefore_voter1.sub(gasSpent).add(ether("0.458")).cmp(ethBalanceAfter_voter1), "Wrong eth balance for VOTER_1 after 0");  //  0.32*95% + 0.22*70% = 0.458



      //  play 2 epochs vvv
       //  epoch 1
      await votingContract.makeVote(1, {
        from: VOTER_0,
        value: ether("0.12")
      });

      await votingContract.makeVote(2, {
        from: VOTER_1,
        value: ether("0.456")
      });
      
      //  pool_0 balance = (0.22 * 30% / 2 + 0.12) = 0.153 BNB
      // console.log((await votingContract.getPoolBalanceTotal(1, 1)).toString());

      //  pool_1 balance = (0.22 * 30% / 2 + 0.456) = 0.489 BNB
      // console.log((await votingContract.getPoolBalanceTotal(1, 2)).toString());

      await time.increase(time.duration.hours(3));
      await votingContract.finishEpoch();

      //  pool balance = (0.22 * 30% / 2 + 0.12) * 30% / 2 = 0.02295 BNB
      // console.log((await votingContract.getPoolBalanceTotal(2, 1)).toString());
      // console.log((await votingContract.getPoolBalanceTotal(2, 2)).toString());

      let voter_0_pendingReward = await votingContract.calculatePendingReward(0, { from: VOTER_0 });
      // console.log(`voter_0_pendingReward: ${voter_0_pendingReward.amount.toString()}`);
      assert.equal(0, (new BN(voter_0_pendingReward.amount.toString())).cmp(ether("0")), "should be 0 voter_0_pendingReward after 1");

      let voter_1_pendingReward = await votingContract.calculatePendingReward(0, { from: VOTER_1 });
      // console.log(`voter_1_pendingReward: ${voter_1_pendingReward.amount.toString()}`); //  0.489 * 95% + 0.153 * 70% = 0.57165 BNB
      assert.equal(0, (new BN(voter_1_pendingReward.amount.toString())).cmp(ether("0.57165")), "should be 0.57165 voter_1_pendingReward after 1");


       //  epoch 2
      await votingContract.makeVote(1, {
        from: VOTER_0,
        value: ether("0.2")
      });
      await votingContract.makeVote(1, {
        from: VOTER_0,
        value: ether("0.244")
      });

      await votingContract.makeVote(2, {
        from: VOTER_1,
        value: ether("0.333")
      });

      //  pool_0 balance = 0.02295 + 0.2 + 0.244 = 0.46695 BNB
      // console.log((await votingContract.getPoolBalanceTotal(2, 1)).toString());

      //  pool_1 balance = 0.02295 + 0.333 = 0.35595 BNB
      // console.log((await votingContract.getPoolBalanceTotal(2, 2)).toString());
      
      await time.increase(time.duration.hours(3));
      await votingContract.finishEpoch();

      //  pool balance = (0.02295 + 0.333) * 30% / 2  = 0.0533925 BNB
      // console.log((await votingContract.getPoolBalanceTotal(3, 1)).toString());
      // console.log((await votingContract.getPoolBalanceTotal(3, 2)).toString());


      voter_0_pendingReward = await votingContract.calculatePendingReward(0, { from: VOTER_0 });
      // console.log(`voter_0_pendingReward: ${voter_0_pendingReward.amount.toString()}`); //  0.46695 * 95% + 0.35595 * 70% = 0.6927675 BNB
      assert.equal(0, (new BN(voter_0_pendingReward.amount.toString())).cmp(ether("0.6927675")), "should be 0.6927675 voter_0_pendingReward after 2");

      voter_1_pendingReward = await votingContract.calculatePendingReward(0, { from: VOTER_1 });
      // console.log(`voter_1_pendingReward: ${voter_1_pendingReward.amount.toString()}`); //  0.57165 BNB
      assert.equal(0, (new BN(voter_1_pendingReward.amount.toString())).cmp(ether("0.57165")), "should be 0.57165 voter_1_pendingReward after 2");

      //  play 2 epochs ^^^


      //  VOTER_0
      versusBalanceBefore_voter0 = await versusToken.balanceOf(VOTER_0);
      ethBalanceBefore_voter0 = await balance.current(VOTER_0);

      tx = await votingContract.withdrawPendingReward(0, { from: VOTER_0 });
      gasUsed = new BN(tx.receipt.gasUsed);
      txInfo = await web3.eth.getTransaction(tx.tx);
      gasPrice = new BN(txInfo.gasPrice);
      gasSpent = gasUsed.mul(gasPrice);

      versusBalanceAfter_voter0 = await versusToken.balanceOf(VOTER_0);
      ethBalanceAfter_voter0 = await balance.current(VOTER_0);

      assert.equal(versusBalanceAfter_voter0 - versusBalanceBefore_voter0, 3*10 ** 18, "Wrong verus balance for VOTER_0 after all");
      assert.equal(0, ethBalanceBefore_voter0.sub(gasSpent).add(ether("0.6927675")).cmp(ethBalanceAfter_voter0), "Wrong eth balance for VOTER_0 after all");
    });
    
    it("should fail if No reward", async function () {
      await votingContract.makeVote(1, {
        from: VOTER_0,
        value: ether("0.22")
      });

      await votingContract.makeVote(2, {
        from: VOTER_1,
        value: ether("0.32")
      });
      
      await time.increase(time.duration.hours(3));
      await votingContract.finishEpoch();

      await votingContract.withdrawPendingReward(0, {from: VOTER_0});
      await expectRevert(votingContract.withdrawPendingReward(0, {from: VOTER_0}), "No reward");
    });

    it("should increase bnbRewardsWithdrawn", async function () {
      await votingContract.makeVote(1, {
        from: VOTER_0,
        value: ether("0.22")
      });

      await votingContract.makeVote(2, {
        from: VOTER_1,
        value: ether("0.32")
      });
      
      await time.increase(time.duration.hours(3));
      await votingContract.finishEpoch();

      const bnbRewardsWithdrawn_before = await votingContract.bnbRewardsWithdrawn.call();

      await votingContract.withdrawPendingReward(0, { from: VOTER_1 });

      const bnbRewardsWithdrawn_after = await votingContract.bnbRewardsWithdrawn.call();
      assert.isTrue((new BN(bnbRewardsWithdrawn_after)).gt(new BN(bnbRewardsWithdrawn_before)), "bnbRewardsWithdrawn should be increased");
    });
  });
});