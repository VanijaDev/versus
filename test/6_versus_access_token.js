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

contract("VersusAccessToken", function (accounts) {
  const OWNER = accounts[0];
  const OTHER = accounts[1];
  const OTHER_1 = accounts[2];

  let versusToken;
  let versusAccessToken;
  let versusStakingAccess;

  beforeEach("setup", async function () {
    await time.advanceBlock();

    versusToken = await VersusToken.new();
    versusAccessToken = await VersusAccessToken.new();
    versusStakingAccess = await VersusStakingAccess.new(versusToken.address, versusAccessToken.address);
    await versusStakingAccess.updateMinTotalStake(ether("0.1"));

    await versusToken.approve(versusStakingAccess.address, ether("10"));
    await versusToken.mint(OWNER, ether("10"));
    await versusToken.mint(OTHER, ether("1"));
  });
  
  describe("Constructor", function () {
    it("should be correct name", async function () {
      assert.equal(await versusAccessToken.name(), "Versus Access", "wrong name");
    });

    it("should be correct symbol", async function () {
      assert.equal(await versusAccessToken.symbol(), "aVERSUS", "wrong symbol");
    });

    it("should set correct owner", async function () {
      assert.equal(await versusAccessToken.owner(), OWNER, "wrong owner");
    });

    it("should check staking address == 0x0", async function () {
      assert.equal(await versusAccessToken.stakingAddress(), constants.ZERO_ADDRESS, "wrong stakingAddress");
    });

    it("should return correct decimals", async function () {
      assert.equal(0, (await versusAccessToken.decimals()).cmp(new BN("0")), "wrong decimals");
    });
  });

  describe("updateStakingAddress", function () {
    it("should fail if not owner", async function () {
      await expectRevert(versusAccessToken.updateStakingAddress(OTHER, {
        from: OTHER
      }), "Ownable: caller is not the owner");
    });
    
    it("should set correct stakingAddress", async function () {
      //  0
      await versusAccessToken.updateStakingAddress(OTHER);
      assert.equal(await versusAccessToken.stakingAddress(), OTHER, "wrong stakingAddress, OTHER");

      //  1
      await versusAccessToken.updateStakingAddress(OTHER_1);
      assert.equal(await versusAccessToken.stakingAddress(), OTHER_1, "wrong stakingAddress, OTHER_1");
    });
  });

  describe("mintSingleToken", function () {
    it("should fail if not owner", async function () {
      await expectRevert(versusAccessToken.mint(1, OTHER, {
        from: OTHER
      }), "Ownable: caller is not the owner");
    });

    it("should fail if Above max supply", async function () {
      await versusAccessToken.mint(200, OTHER);

      await expectRevert(versusAccessToken.mint(1, OTHER_1), "Above max supply");
    });
    
    it("should mint correct amount for receiver", async function () {
      assert.equal(0, (await versusAccessToken.balanceOf(OTHER)).cmp(new BN("0")), "should be 0 before");

      await versusAccessToken.mint(1, OTHER);
      assert.equal(0, (await versusAccessToken.balanceOf(OTHER)).cmp(new BN("1")), "should be 1 after");

      await versusAccessToken.mint(2, OTHER);
      assert.equal(0, (await versusAccessToken.balanceOf(OTHER)).cmp(new BN("3")), "should be 3 after");

      await expectEvent(await versusAccessToken.mint(1, OTHER), "Transfer");
    });
  });

  describe("onLastTokenTransfer", function () {
    it("should fail on transfer if no stakingAddress", async function () {
      await expectRevert(versusAccessToken.transfer(OTHER_1, 1, {
        from: OTHER
      }), "No stakingAddress");
    });

    it("should fail on transferFrom if no stakingAddress", async function () {
      await versusAccessToken.approve(OTHER_1, 2, {
        from: OTHER
      });
      await expectRevert(versusAccessToken.transferFrom(OTHER, OTHER_1, 1, {
        from: OTHER_1
      }), "No stakingAddress");
    });

    it("should not emit UnstakeMade on Transfer with last token if no stake", async function () {
      await versusAccessToken.updateStakingAddress(versusStakingAccess.address);
      await versusAccessToken.mint(1, OTHER);

      const receipt = await versusAccessToken.transfer(OTHER_1, 1, {
        from: OTHER
      });

      assert.equal(receipt.logs.length, 1, "should be 1 event");
      assert.equal(receipt.logs[0].event, "Transfer", "Wrong event");
    });

    it("should not emit UnstakeMade on Transfer if stake present, but not last token", async function () {
      await versusAccessToken.updateStakingAddress(versusStakingAccess.address);
      await versusAccessToken.mint(2, OTHER);

      //  stake
      await versusToken.approve(versusStakingAccess.address, ether("1"), {
        from: OTHER
      });
      await versusStakingAccess.stake(ether("0.2"), {
        from: OTHER
      });

      const receipt = await versusAccessToken.transfer(OTHER_1, 1, {
        from: OTHER
      });

      assert.equal(receipt.logs.length, 1, "should be 1 event");
      assert.equal(receipt.logs[0].event, "Transfer", "Wrong event");
    });

    it("should emit UnstakeMade on Transfer with last token", async function () {
      await versusAccessToken.updateStakingAddress(versusStakingAccess.address);
      await versusAccessToken.mint(1, OTHER);

      //  stake
      await versusToken.approve(versusStakingAccess.address, ether("1"), {
        from: OTHER
      });
      await versusStakingAccess.stake(ether("0.2"), {
        from: OTHER
      });
      await time.increase(time.duration.seconds(2));

      const receipt = await versusAccessToken.transfer(OTHER_1, 1, {
        from: OTHER
      });

      const UnstakeMade_hash = web3.utils.keccak256("UnstakeMade(address,uint256)");
      assert.equal(receipt.receipt.rawLogs[5].topics[0], UnstakeMade_hash, "Wrong hash");
    });

    it("should emit UnstakeMade on TransferFrom with last token", async function () {
      await versusAccessToken.updateStakingAddress(versusStakingAccess.address);
      await versusAccessToken.mint(1, OTHER);

      //  stake
      await versusToken.approve(versusStakingAccess.address, ether("1"), {
        from: OTHER
      });
      await versusStakingAccess.stake(ether("0.2"), {
        from: OTHER
      });
      await time.increase(time.duration.seconds(2));

      await versusAccessToken.approve(OTHER_1, 2, {
        from: OTHER
      });
      const receipt = await versusAccessToken.transferFrom(OTHER, OTHER_1, 1, {
        from: OTHER_1
      });

      const UnstakeMade_hash = web3.utils.keccak256("UnstakeMade(address,uint256)");
      assert.equal(receipt.receipt.rawLogs[6].topics[0], UnstakeMade_hash, "Wrong hash");
    });
  });
});