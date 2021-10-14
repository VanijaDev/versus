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

  let versusToken;
  let votingContract;

  beforeEach(async () => {
    await time.advanceBlock();

    versusToken = await VersusToken.new();
    votingContract = await VersusVoting.new(DEV_FEE_RECEIVER, versusToken.address);
  });
  
  describe("constructor", function() {
    it("should set correct versusBonus", async function () {
      let bonus = (new BN("10")).pow(new BN("18"));
      assert.equal(0, (await votingContract.versusBonus.call()).cmp(bonus), "wrong versusBonus");
    });
    
    it("should set correct minStake", async function () {
      let stake = (new BN("10")).pow(new BN("17"));
      assert.equal(0, (await votingContract.minStake.call()).cmp(stake), "wrong minStake");
    });
    
    it("should set correct epochDuration", async function () {
      assert.equal(0, (await votingContract.epochDuration.call()).cmp(time.duration.hours(3)), "wrong epochDuration");
    });
    
    it("should set correct poolLoserBalanceToNextEpochPercentage", async function () {
      assert.equal(0, (await votingContract.poolLoserBalanceToNextEpochPercentage.call()).cmp(new BN("30")), "wrong amount");
    });
    
    it("should set correct devFeePercentage", async function () {
      assert.equal(0, (await votingContract.devFeePercentage.call()).cmp(new BN("5")), "wrong amount");
    });
    
    it("should set correct versusToken", async function () {
      assert.equal(await votingContract.versusToken.call(), versusToken.address, "wrong versusToken");
    });
    
    it("should set correct devFeeReceiver", async function () {
      assert.equal(await votingContract.devFeeReceiver.call(), DEV_FEE_RECEIVER, "wrong devFeeReceiver");
    });
    
    it("should set correct currentEpochStartedAt", async function () {
      assert.equal(0, (await votingContract.currentEpochStartedAt.call()).cmp(await time.latest()), "wrong currentEpochStartedAt");
    });
  });

  describe("kill", function () {
    it("should fail if not owner", async () => {
      await expectRevert(votingContract.kill({
        from: OTHER
      }), "Ownable: caller is not the owner");
    });

    it("should remove code from Blockchain", async function () {
      assert.isTrue((await web3.eth.getCode(votingContract.address)).length > 0, "code should be present");

      await votingContract.kill();
      await time.increase(1);

      assert.isTrue((await web3.eth.getCode(votingContract.address)).length == 2, "code should be deleted");
    });
    
    it("should send balance to sender", async function () {
      //  vote
      await votingContract.makeVote(1, {
        from: VOTER_0,
        value: ether("1")
      });

      //  kill
      let ownerBalance_before = new BN(await web3.eth.getBalance(OWNER));
      let votingBalance = new BN(await web3.eth.getBalance(votingContract.address));

      let tx = await votingContract.kill();
      let gasUsed = new BN(tx.receipt.gasUsed);
      let txInfo = await web3.eth.getTransaction(tx.tx);
      let gasPrice = new BN(txInfo.gasPrice);
      let gasSpent = gasUsed.mul(gasPrice);

      await time.increase(1);

      let ownerBalance_after = new BN(await web3.eth.getBalance(OWNER));
      assert.equal(0, ownerBalance_before.add(votingBalance).sub(gasSpent).cmp(ownerBalance_after), "wrong owner balance after kill");
    });
  });

  describe("updatePoolLoserBalanceToNextEpochPercentage", function () {
    it("should fail if not owner", async function () {
      await expectRevert(votingContract.updatePoolLoserBalanceToNextEpochPercentage(11, {
        from: OTHER
      }), "Ownable: caller is not the owner");
    });

    it("should fail if _percentage == 0", async function () {
      await expectRevert(votingContract.updatePoolLoserBalanceToNextEpochPercentage(0), "Wrong _percentage");
    });

    it("should fail if _percentage > 100", async function () {
      await expectRevert(votingContract.updatePoolLoserBalanceToNextEpochPercentage(111), "Wrong _percentage");
    });
    
    it("should set correct value", async function () {
      assert.equal(0, (await votingContract.poolLoserBalanceToNextEpochPercentage.call()).cmp(new BN("30")), "wrong before");
      await votingContract.updatePoolLoserBalanceToNextEpochPercentage(11);
      assert.equal(0, (await votingContract.poolLoserBalanceToNextEpochPercentage.call()).cmp(new BN("11")), "wrong after");
    });
  });

  describe("updateDevFeePercentage", function () {
    it("should fail if not owner", async function () {
      await expectRevert(votingContract.updateDevFeePercentage(12, {
        from: OTHER
      }), "Ownable: caller is not the owner");
    });
    
    it("should fail if _percentage == 0", async function () {
      await expectRevert(votingContract.updateDevFeePercentage(0), "Wrong _percentage");
    });
    
    it("should fail if _percentage > 100", async function () {
      await expectRevert(votingContract.updateDevFeePercentage(120), "Wrong _percentage");
    });
    
    it("should set correct devFeePercentage", async function () {
      assert.equal(0, (await votingContract.devFeePercentage.call()).cmp(new BN("5")), "wrong before");
      await votingContract.updateDevFeePercentage(14);
      assert.equal(0, (await votingContract.devFeePercentage.call()).cmp(new BN("14")), "wrong after");
    });
  });

  describe("updateDevFeeReceiver", function () {
    it("should fail if not owner", async function () {
      await expectRevert(votingContract.updateDevFeeReceiver(OTHER, {
        from: OTHER
      }), "Ownable: caller is not the owner");
    });
    
    it("should fail if Wrong _address", async function () {
      await expectRevert(votingContract.updateDevFeeReceiver(constants.ZERO_ADDRESS), "Wrong _address");
    });
    
    it("should set correct devFeeReceiver", async function () {
      assert.equal(await votingContract.devFeeReceiver.call(), DEV_FEE_RECEIVER, "wrong before");
      await votingContract.updateDevFeeReceiver(OTHER);
      assert.equal(await votingContract.devFeeReceiver.call(), OTHER, "wrong after");
    });
  });

  describe("updateEpochDuration", function () {
    it("should fail if not owner", async function () {
      await expectRevert(votingContract.updateEpochDuration(11, {
        from: OTHER
      }), "Ownable: caller is not the owner");
    });

    it("should fail if _duration == 0", async function () {
      await expectRevert(votingContract.updateEpochDuration(0), "Wrong _duration");
    });
    
    it("should set correct value", async function () {
      assert.equal(0, (await votingContract.epochDuration.call()).cmp(time.duration.hours(3)), "wrong before");
      await votingContract.updateEpochDuration(time.duration.hours(13));
      assert.equal(0, (await votingContract.epochDuration.call()).cmp(time.duration.hours(13)), "wrong after");
    });
  });

  describe("updateVersusBonus", function () {
    it("should fail if not owner", async function () {
      await expectRevert(votingContract.updateVersusBonus(11, {
        from: OTHER
      }), "Ownable: caller is not the owner");
    });
    
    it("should set correct value", async function () {
      let bonusBefore = (new BN("10")).pow(new BN("18"));
      assert.equal(0, (await votingContract.versusBonus.call()).cmp(bonusBefore), "wrong before");

      let bonusAfter = (new BN("10")).pow(new BN("17"));
      await votingContract.updateVersusBonus(bonusAfter);
      assert.equal(0, (await votingContract.versusBonus.call()).cmp(bonusAfter), "wrong after");
    });
  });

  describe("updateMinStake", function () {
    it("should fail if not owner", async function () {
      await expectRevert(votingContract.updateMinStake(ether("0.2"), {
        from: OTHER
      }), "Ownable: caller is not the owner");
    });

    it("should fail if _minStake == 0", async function () {
      await expectRevert(votingContract.updateMinStake(0), "Wrong _minStake");
    });
    
    it("should set correct value", async function () {
      let minStakeBefore = ether("0.1");
      assert.equal(0, (await votingContract.minStake.call()).cmp(minStakeBefore), "wrong before");

      let minStakeAfter = ether("0.2");
      await votingContract.updateMinStake(minStakeAfter);
      assert.equal(0, (await votingContract.minStake.call()).cmp(minStakeAfter), "wrong after");
    });
  });

});
