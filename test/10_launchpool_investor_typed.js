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

contract("InvestorTyped", function (accounts) {
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

    await versusLaunchpool.addInvestorsBase([PLAYER_BASE_0, PLAYER_BASE_1]);
    await versusLaunchpool.addInvestorsPro([PLAYER_PRO_0, PLAYER_PRO_1, PLAYER_PRO_2]);
  });
  
  describe("Constructor", function () {
    it("should set correct allocationInvestorBase", async function () {
      assert.isTrue((await versusLaunchpool.allocationInvestorBase.call()).eq(ALLOCATION_BASE), "wrong allocationInvestorBase");
    });

    it("should set correct allocationInvestorPro", async function () {
      assert.isTrue((await versusLaunchpool.allocationInvestorPro.call()).eq(ALLOCATION_PRO), "wrong allocationInvestorPro");
    });
  });

  describe("addInvestorsBase", function () {
    it("should fail if not owner", async function () {
      await expectRevert(versusLaunchpool.addInvestorsBase([OWNER, OTHER], { from: OTHER }), "caller is not the owner");
    });

    it("should fail if already added to Base", async function () {
      await expectRevert(versusLaunchpool.addInvestorsBase([PLAYER_BASE_0]), "already added");
    });

    it("should fail if already added to Pro", async function () {
      await expectRevert(versusLaunchpool.addInvestorsBase([PLAYER_BASE_0, PLAYER_PRO_0]), "already added");
    });

    it("should fail if already added to Priority", async function () {
      await versusLaunchpool.addInvestorPriority(PLAYER_PRIORITY_0, ether("1"));
      await expectRevert(versusLaunchpool.addInvestorsBase([PLAYER_PRIORITY_0, PLAYER_PRO_0]), "already added");
    });
    
    it("should set correct investorBaseIndexOf", async function () {
      await versusLaunchpool.addInvestorsBase([OWNER, OTHER]);
      assert.isTrue((await versusLaunchpool.investorBaseIndexOf.call(OWNER)).eq(new BN(2)), "wrong for OWNER");
      assert.isTrue((await versusLaunchpool.investorBaseIndexOf.call(OTHER)).eq(new BN(3)), "wrong for OTHER");
    });

    it("should push to investorsBase", async function () {
      await versusLaunchpool.addInvestorsBase([OWNER, OTHER]);
      const investorsBase = await versusLaunchpool.getInvestorsBase(0, 0);
      assert.isTrue(investorsBase.length == 4, "wrong length");
      assert.isTrue(investorsBase[2] == OWNER), "should be OWNER";
      assert.isTrue(investorsBase[3] == OTHER), "should be OTHER";
    });
  });

  describe("addInvestorsPro", function () {
    it("should fail if not owner", async function () {
      await expectRevert(versusLaunchpool.addInvestorsPro([OWNER, OTHER], { from: OTHER }), "caller is not the owner");
    });

    it("should fail if already added to Base", async function () {
      await expectRevert(versusLaunchpool.addInvestorsPro([PLAYER_BASE_0]), "already added");
    });

    it("should fail if already added to Pro", async function () {
      await expectRevert(versusLaunchpool.addInvestorsPro([PLAYER_BASE_0, PLAYER_PRO_0]), "already added");
    });

    it("should fail if already added to Priority", async function () {
      await versusLaunchpool.addInvestorPriority(PLAYER_PRIORITY_0, ether("1"));
      await expectRevert(versusLaunchpool.addInvestorsPro([PLAYER_PRIORITY_0, PLAYER_PRO_0]), "already added");
    });
    
    it("should set correct investorProIndexOf", async function () {
      await versusLaunchpool.addInvestorsPro([OWNER, OTHER]);
      assert.isTrue((await versusLaunchpool.investorProIndexOf.call(OWNER)).eq(new BN(3)), "wrong for OWNER");
      assert.isTrue((await versusLaunchpool.investorProIndexOf.call(OTHER)).eq(new BN(4)), "wrong for OTHER");
    });

    it("should push to investorsPro", async function () {
      await versusLaunchpool.addInvestorsPro([OWNER, OTHER]);
      const investorsPro = await versusLaunchpool.getInvestorsPro(0, 0);
      assert.isTrue(investorsPro.length == 5, "wrong length");
      assert.isTrue(investorsPro[3] == OWNER), "should be OWNER";
      assert.isTrue(investorsPro[4] == OTHER), "should be OTHER";
    });
  });

  describe("addInvestorPriority", function () {
    it("should fail if not owner", async function () {
      await expectRevert(versusLaunchpool.addInvestorPriority(OTHER, ether("1"), { from: OTHER }), "caller is not the owner");
    });

    it("should fail if already added to Base", async function () {
      await expectRevert(versusLaunchpool.addInvestorPriority(PLAYER_BASE_0, ether("1")), "already added");
    });

    it("should fail if already added to Pro", async function () {
      await expectRevert(versusLaunchpool.addInvestorPriority(PLAYER_PRO_0, ether("1")), "already added");
    });

    it("should fail if already added to Priority", async function () {
      await versusLaunchpool.addInvestorPriority(PLAYER_PRIORITY_0, ether("1"));
      await expectRevert(versusLaunchpool.addInvestorPriority(PLAYER_PRIORITY_0, ether("1")), "already added");
    });
    
    it("should set correct investorProIndexOf", async function () {
      await versusLaunchpool.addInvestorPriority(PLAYER_PRIORITY_0, ether("1"));
      assert.isTrue((await versusLaunchpool.investorPriorityIndexOf.call(PLAYER_PRIORITY_0)).eq(new BN(0)), "wrong for PLAYER_PRIORITY_0");
      
      await versusLaunchpool.addInvestorPriority(PLAYER_PRIORITY_1, ether("1.1"));
      assert.isTrue((await versusLaunchpool.investorPriorityIndexOf.call(PLAYER_PRIORITY_1)).eq(new BN(1)), "wrong for PLAYER_PRIORITY_1");
    });

    it("should push to investorsPro", async function () {
      await versusLaunchpool.addInvestorPriority(OWNER, ether("1"));
      await versusLaunchpool.addInvestorPriority(OTHER, ether("1.1"));
      const investorsPriority = await versusLaunchpool.getInvestorsPriority(0, 0);
      assert.isTrue(investorsPriority.length == 2, "wrong length");
      assert.isTrue(investorsPriority[0] == OWNER), "should be OWNER";
      assert.isTrue(investorsPriority[1] == OTHER), "should be OTHER";
    });

    it("should allocationInvestorPriorityOf", async function () {
      await versusLaunchpool.addInvestorPriority(PLAYER_PRIORITY_0, ether("1"));
      await versusLaunchpool.addInvestorPriority(PLAYER_PRIORITY_1, ether("1.1"));
      assert.isTrue((await versusLaunchpool.allocationInvestorPriorityOf.call(PLAYER_PRIORITY_0)).eq(ether("1")), "wrong for PLAYER_PRIORITY_0");
      assert.isTrue((await versusLaunchpool.allocationInvestorPriorityOf.call(PLAYER_PRIORITY_1)).eq(ether("1.1")), "wrong for PLAYER_PRIORITY_1");
    });
  });

  describe("removeInvestorBase", function () {
    it("should fail if not owner", async function () {
      await expectRevert(versusLaunchpool.removeInvestorBase(PLAYER_BASE_0, { from: OTHER }), "caller is not the owner");
    });

    it("should fail if not Base", async function () {
      await expectRevert(versusLaunchpool.removeInvestorBase(OTHER), "not Base");
    });

    it("should move last to removeIdx", async function () {
      await versusLaunchpool.removeInvestorBase(PLAYER_BASE_1);

      const investorsBase = await versusLaunchpool.getInvestorsBase(0, 0);
      assert.isTrue(investorsBase.length == 1, "wrong length");
      assert.isTrue(investorsBase[0] == PLAYER_BASE_0), "should be PLAYER_BASE_0";
    });

    it("should remove last if last", async function () {
      await versusLaunchpool.addInvestorsBase([OTHER, OWNER]);
      await versusLaunchpool.removeInvestorBase(PLAYER_BASE_1);

      const investorsBase = await versusLaunchpool.getInvestorsBase(0, 0);
      assert.isTrue(investorsBase.length == 3, "wrong length");
      assert.isTrue(investorsBase[1] == OWNER, "should be OWNER");
    });

    it("should remove all desc", async function () {
      await versusLaunchpool.removeInvestorBase(PLAYER_BASE_0);
      await versusLaunchpool.removeInvestorBase(PLAYER_BASE_1);
    });

    it("should remove all asc", async function () {
      await versusLaunchpool.removeInvestorBase(PLAYER_BASE_1);
      await versusLaunchpool.removeInvestorBase(PLAYER_BASE_0);
    });
  });

  describe("removeInvestorPro", function () {
    it("should fail if not owner", async function () {
      await expectRevert(versusLaunchpool.removeInvestorPro(PLAYER_BASE_0, { from: OTHER }), "caller is not the owner");
    });

    it("should fail if not Pro", async function () {
      await expectRevert(versusLaunchpool.removeInvestorPro(OTHER), "not Pro");
    });

    it("should move last to removeIdx", async function () {
      await versusLaunchpool.removeInvestorPro(PLAYER_PRO_2);

      const investorsPro = await versusLaunchpool.getInvestorsPro(0, 0);
      assert.isTrue(investorsPro.length == 2, "wrong length");
      assert.isTrue(investorsPro[1] == PLAYER_PRO_1), "should be PLAYER_PRO_1";
    });

    it("should remove last if last", async function () {
      await versusLaunchpool.addInvestorsPro([OTHER, OWNER]);
      await versusLaunchpool.removeInvestorPro(PLAYER_PRO_2);

      const investorsPro = await versusLaunchpool.getInvestorsPro(0, 0);
      assert.isTrue(investorsPro.length == 4, "wrong length");
      assert.isTrue(investorsPro[2] == OWNER, "should be OWNER");
    });

    it("should remove all desc", async function () {
      await versusLaunchpool.removeInvestorPro(PLAYER_PRO_0);
      await versusLaunchpool.removeInvestorPro(PLAYER_PRO_1);
      await versusLaunchpool.removeInvestorPro(PLAYER_PRO_2);
    });

    it("should remove all asc", async function () {
      await versusLaunchpool.removeInvestorPro(PLAYER_PRO_2);
      await versusLaunchpool.removeInvestorPro(PLAYER_PRO_1);
      await versusLaunchpool.removeInvestorPro(PLAYER_PRO_0);
    });
  });

  describe("removeInvestorPriority", function () {
    it("should fail if not owner", async function () {
      await expectRevert(versusLaunchpool.removeInvestorPriority(PLAYER_PRIORITY_1, { from: OTHER }), "caller is not the owner");
    });

    it("should fail if not Priority", async function () {
      await expectRevert(versusLaunchpool.removeInvestorPriority(OTHER), "not Priority");
    });

    it("should move last to removeIdx", async function () {
      await versusLaunchpool.addInvestorPriority(PLAYER_PRIORITY_0, ether("1"));
      await versusLaunchpool.addInvestorPriority(PLAYER_PRIORITY_1, ether("1"));
      await versusLaunchpool.addInvestorPriority(OTHER, ether("1"));
      await versusLaunchpool.addInvestorPriority(OWNER, ether("1"));

      await versusLaunchpool.removeInvestorPriority(PLAYER_PRIORITY_1);

      const investorsPriority = await versusLaunchpool.getInvestorsPriority(0, 0);
      assert.isTrue(investorsPriority.length == 3, "wrong length");
      assert.isTrue(investorsPriority[1] == OWNER), "should be OWNER";
    });

    it("should remove last if last", async function () {
      await versusLaunchpool.addInvestorPriority(PLAYER_PRIORITY_0, ether("1"));
      await versusLaunchpool.addInvestorPriority(PLAYER_PRIORITY_1, ether("1"));
      await versusLaunchpool.addInvestorPriority(OTHER, ether("1"));
      await versusLaunchpool.addInvestorPriority(OWNER, ether("1"));

      await versusLaunchpool.removeInvestorPriority(OWNER);

      const investorsPriority = await versusLaunchpool.getInvestorsPriority(0, 0);
      assert.isTrue(investorsPriority.length == 3, "wrong length");
      assert.isTrue(investorsPriority[0] == PLAYER_PRIORITY_0), "should be PLAYER_PRIORITY_0";
      assert.isTrue(investorsPriority[1] == PLAYER_PRIORITY_1), "should be PLAYER_PRIORITY_0";
      assert.isTrue(investorsPriority[2] == OTHER), "should be OTHER";
    });

    it("should remove all desc", async function () {
      await versusLaunchpool.addInvestorPriority(PLAYER_PRIORITY_0, ether("1"));
      await versusLaunchpool.addInvestorPriority(PLAYER_PRIORITY_1, ether("1"));

      await versusLaunchpool.removeInvestorPriority(PLAYER_PRIORITY_0);
      await versusLaunchpool.removeInvestorPriority(PLAYER_PRIORITY_1);
    });

    it("should remove all asc", async function () {
      await versusLaunchpool.addInvestorPriority(PLAYER_PRIORITY_0, ether("1"));
      await versusLaunchpool.addInvestorPriority(PLAYER_PRIORITY_1, ether("1"));

      await versusLaunchpool.removeInvestorPriority(PLAYER_PRIORITY_1);
      await versusLaunchpool.removeInvestorPriority(PLAYER_PRIORITY_0);
    });
  });

  describe("allocationFor", function () {
    it("should return allocationInvestorBase", async function () {
      assert.isTrue((await versusLaunchpool.allocationFor.call(PLAYER_BASE_0)).eq(ALLOCATION_BASE), "wrong allocationInvestorBase");
    });

    it("should return allocationInvestorPro", async function () {
      assert.isTrue((await versusLaunchpool.allocationFor.call(PLAYER_PRO_0)).eq(ALLOCATION_PRO), "wrong allocationInvestorPro");
    });

    it("should return allocationInvestorPriorityOf", async function () {
      await versusLaunchpool.addInvestorPriority(PLAYER_PRIORITY_0, ether("1"));
      assert.isTrue((await versusLaunchpool.allocationFor.call(PLAYER_PRIORITY_0)).eq(ether("1")), "wrong allocationInvestorPriorityOf");
    });

    it("should return 0 if not added investor", async function () {
      assert.isTrue((await versusLaunchpool.allocationFor.call(OTHER)).eq(ether("0")), "wrong allocation, must be 0");
    });
  });

  describe("updateAllocationForBase", function () {
    it("should fail if not owner", async function () {
      await expectRevert(versusLaunchpool.updateAllocationForBase(ether("0.2"), { from: OTHER }), "caller is not the owner");
    });

    it("should updateAllocationForBase correctly ", async function () {
      await versusLaunchpool.updateAllocationForBase(ether("2"));
      assert.isTrue((await versusLaunchpool.allocationInvestorBase.call()).eq(ether("2")), "wrong after");
    });
  });

  describe("updateAllocationForPro", function () {
    it("should fail if not owner", async function () {
      await expectRevert(versusLaunchpool.updateAllocationForPro(ether("0.2"), { from: OTHER }), "caller is not the owner");
    });

    it("should updateAllocationForPro correctly ", async function () {
      await versusLaunchpool.updateAllocationForPro(ether("2"));
      assert.isTrue((await versusLaunchpool.allocationInvestorPro.call()).eq(ether("2")), "wrong after");
    });
  });

  describe("getInvestorsBase", function () {
    it("should return all investors", async function () {
      const investorsBase = await versusLaunchpool.getInvestorsBase(0, 0);
      assert.isTrue(investorsBase.length == 2, "wrong length");
      assert.isTrue(investorsBase[0] == PLAYER_BASE_0, "should be PLAYER_BASE_0");
      assert.isTrue(investorsBase[1] == PLAYER_BASE_1, "should be PLAYER_BASE_1");
    });

    it("should return investors in range", async function () {
      //  0
      assert.isTrue((await versusLaunchpool.getInvestorsBase(1, 1))[0] == PLAYER_BASE_1, "should be PLAYER_BASE_1");
      
      let investorsBase = await versusLaunchpool.getInvestorsBase(0, 1);
      assert.isTrue(investorsBase[0] == PLAYER_BASE_0, "should be PLAYER_BASE_0");
      assert.isTrue(investorsBase[1] == PLAYER_BASE_1, "should be PLAYER_BASE_1");

      await versusLaunchpool.addInvestorsBase([OWNER, OTHER]);

      //  1
      investorsBase = await versusLaunchpool.getInvestorsBase(0, 2);
      assert.isTrue(investorsBase[0] == PLAYER_BASE_0, "should be PLAYER_BASE_0");
      assert.isTrue(investorsBase[1] == PLAYER_BASE_1, "should be PLAYER_BASE_1");
      assert.isTrue(investorsBase[2] == OWNER, "should be OWNER");

      //  2
      investorsBase = await versusLaunchpool.getInvestorsBase(1, 3);
      assert.isTrue(investorsBase[0] == PLAYER_BASE_1, "should be PLAYER_BASE_0");
      assert.isTrue(investorsBase[1] == OWNER, "should be OWNER");
      assert.isTrue(investorsBase[2] == OTHER, "should be OTHER");
    });
  });

  describe("getInvestorsPro", function () {
    it("should return all investors", async function () {
      const investorsPro = await versusLaunchpool.getInvestorsPro(0, 0);
      assert.isTrue(investorsPro.length == 3, "wrong length");
      assert.isTrue(investorsPro[0] == PLAYER_PRO_0, "should be PLAYER_PRO_0");
      assert.isTrue(investorsPro[1] == PLAYER_PRO_1, "should be PLAYER_PRO_1");
      assert.isTrue(investorsPro[2] == PLAYER_PRO_2, "should be PLAYER_PRO_2");
    });

    it("should return investors in range", async function () {
      //  0
      assert.isTrue((await versusLaunchpool.getInvestorsPro(1, 1))[0] == PLAYER_PRO_1, "should be PLAYER_PRO_1");
      
      let investorsPro = await versusLaunchpool.getInvestorsPro(0, 1);
      assert.isTrue(investorsPro[0] == PLAYER_PRO_0, "should be PLAYER_PRO_0");
      assert.isTrue(investorsPro[1] == PLAYER_PRO_1, "should be PLAYER_PRO_1");

      await versusLaunchpool.addInvestorsPro([OWNER, OTHER]);

      //  1
      investorsPro = await versusLaunchpool.getInvestorsPro(0, 3);
      assert.isTrue(investorsPro[0] == PLAYER_PRO_0, "should be PLAYER_PRO_0");
      assert.isTrue(investorsPro[1] == PLAYER_PRO_1, "should be PLAYER_PRO_1");
      assert.isTrue(investorsPro[2] == PLAYER_PRO_2, "should be PLAYER_PRO_2");
      assert.isTrue(investorsPro[3] == OWNER, "should be OWNER");

      //  2
      investorsPro = await versusLaunchpool.getInvestorsPro(1, 3);
      assert.isTrue(investorsPro[0] == PLAYER_PRO_1, "should be PLAYER_PRO_1");
      assert.isTrue(investorsPro[1] == PLAYER_PRO_2, "should be PLAYER_PRO_2");
      assert.isTrue(investorsPro[2] == OWNER, "should be OWNER");
    });
  });

  describe("getInvestorsPriority", function () {
    it("should return all investors", async function () {
      await versusLaunchpool.addInvestorPriority(PLAYER_PRIORITY_0, ether("1"));
      await versusLaunchpool.addInvestorPriority(PLAYER_PRIORITY_1, ether("1"));
      await versusLaunchpool.addInvestorPriority(OTHER, ether("1"));
      await versusLaunchpool.addInvestorPriority(OWNER, ether("1"));

      const investorsPriority = await versusLaunchpool.getInvestorsPriority(0, 0);
      assert.isTrue(investorsPriority.length == 4, "wrong length");
      assert.isTrue(investorsPriority[0] == PLAYER_PRIORITY_0, "should be PLAYER_PRIORITY_0");
      assert.isTrue(investorsPriority[1] == PLAYER_PRIORITY_1, "should be PLAYERPLAYER_PRIORITY_1_PRO_1");
      assert.isTrue(investorsPriority[2] == OTHER, "should be OTHER");
      assert.isTrue(investorsPriority[3] == OWNER, "should be OWNER");
    });

    it("should return investors in range", async function () {
      await versusLaunchpool.addInvestorPriority(PLAYER_PRIORITY_0, ether("1"));
      await versusLaunchpool.addInvestorPriority(PLAYER_PRIORITY_1, ether("1"));
      await versusLaunchpool.addInvestorPriority(OTHER, ether("1"));
      await versusLaunchpool.addInvestorPriority(OWNER, ether("1"));

      //  0
      assert.isTrue((await versusLaunchpool.getInvestorsPriority(2, 2))[0] == OTHER, "should be OTHER");
      
      let investorsPriority = await versusLaunchpool.getInvestorsPriority(0, 1);
      assert.isTrue(investorsPriority[0] == PLAYER_PRIORITY_0, "should be PLAYER_PRIORITY_0");
      assert.isTrue(investorsPriority[1] == PLAYER_PRIORITY_1, "should be PLAYER_PRIORITY_1");

      //  1
      investorsPriority = await versusLaunchpool.getInvestorsPriority(0, 3);
      assert.isTrue(investorsPriority[0] == PLAYER_PRIORITY_0, "should be PLAYER_PRIORITY_0");
      assert.isTrue(investorsPriority[1] == PLAYER_PRIORITY_1, "should be PLAYER_PRIORITY_1");
      assert.isTrue(investorsPriority[2] == OTHER, "should be OTHER");
      assert.isTrue(investorsPriority[3] == OWNER, "should be OWNER");

      //  2
      investorsPriority = await versusLaunchpool.getInvestorsPriority(1, 2);
      assert.isTrue(investorsPriority[0] == PLAYER_PRIORITY_1, "should be PLAYER_PRIORITY_1");
      assert.isTrue(investorsPriority[1] == OTHER, "should be OTHER");
    });
  });

  describe("getInvestors", function () {
    it("should fail if _startIdx out", async function () {
      await expectRevert(versusLaunchpool.getInvestorsBase(2, 11), "_startIdx out");
    });

    it("should fail if _stopIdx out", async function () {
      await expectRevert(versusLaunchpool.getInvestorsBase(0, 11), "_stopIdx out");
    });

    it("should fail if wrong indexes", async function () {
      await expectRevert(versusLaunchpool.getInvestorsBase(1, 0), "wrong indexes");
    });
  });

  describe("isInvestorBase", function () {
    it("should return false if investorsBase is empty", async function () {
      await versusLaunchpool.removeInvestorBase(PLAYER_BASE_0);
      await versusLaunchpool.removeInvestorBase(PLAYER_BASE_1);

      assert.isFalse(await versusLaunchpool.isInvestorBase.call(PLAYER_BASE_0), "should be false");
      assert.isFalse(await versusLaunchpool.isInvestorBase.call(OTHER), "should be false");
    });

    it("should false if not investorsBase", async function () {
      assert.isFalse(await versusLaunchpool.isInvestorBase.call(OTHER), "should be false");
    });

    it("should true if investorsBase", async function () {
      assert.isTrue(await versusLaunchpool.isInvestorBase.call(PLAYER_BASE_0), "should be true");
    });
  });
  
  describe("isInvestorPro", function () {
    it("should return false if isInvestorPro is empty", async function () {
      await versusLaunchpool.removeInvestorPro(PLAYER_PRO_0);
      await versusLaunchpool.removeInvestorPro(PLAYER_PRO_1);
      await versusLaunchpool.removeInvestorPro(PLAYER_PRO_2);

      assert.isFalse(await versusLaunchpool.isInvestorPro.call(PLAYER_PRO_0), "should be false, PLAYER_PRO_0");
      assert.isFalse(await versusLaunchpool.isInvestorPro.call(PLAYER_PRO_1), "should be false, PLAYER_PRO_1");
      assert.isFalse(await versusLaunchpool.isInvestorPro.call(PLAYER_PRO_2), "should be false, PLAYER_PRO_2");
      assert.isFalse(await versusLaunchpool.isInvestorPro.call(OTHER), "should be false, OTHER");
    });

    it("should false if not isInvestorPro", async function () {
      assert.isFalse(await versusLaunchpool.isInvestorPro.call(OTHER), "should be false");
    });

    it("should true if isInvestorPro", async function () {
      assert.isTrue(await versusLaunchpool.isInvestorPro.call(PLAYER_PRO_0), "should be true");
    });
  });

  describe("isInvestorPriority", function () {
    it("should return false if isInvestorPriority is empty", async function () {
      assert.isFalse(await versusLaunchpool.isInvestorPro.call(PLAYER_PRIORITY_0), "should be false, PLAYER_PRIORITY_0");
      assert.isFalse(await versusLaunchpool.isInvestorPro.call(PLAYER_PRIORITY_0), "should be false, PLAYER_PRIORITY_1");
      assert.isFalse(await versusLaunchpool.isInvestorPro.call(OTHER), "should be false, OTHER");
    });

    it("should false if not isInvestorPriority", async function () {
      await versusLaunchpool.addInvestorPriority(OTHER, ether("1"));
      assert.isFalse(await versusLaunchpool.isInvestorPro.call(PLAYER_PRIORITY_0), "should be false");
    });

    it("should true if isInvestorPriority", async function () {
      await versusLaunchpool.addInvestorPriority(PLAYER_PRIORITY_0, ether("1"));
      assert.isTrue(await versusLaunchpool.isInvestorPriority.call(PLAYER_PRIORITY_0), "should be true");
    });
  });

  describe("isInvestorOfAnyType", function () {
    it("should return false if not isInvestorOfAnyType", async function () {
      assert.isFalse(await versusLaunchpool.isInvestorOfAnyType.call(OTHER), "should be false");
    });

    it("should return true if isInvestorBase", async function () {
      assert.isTrue(await versusLaunchpool.isInvestorBase.call(PLAYER_BASE_0), "should be true, PLAYER_BASE_0");
      assert.isTrue(await versusLaunchpool.isInvestorBase.call(PLAYER_BASE_1), "should be true, PLAYER_BASE_1");
    });

    it("should return true if isInvestorPro", async function () {
      assert.isTrue(await versusLaunchpool.isInvestorPro.call(PLAYER_PRO_0), "should be true, PLAYER_PRO_0");
      assert.isTrue(await versusLaunchpool.isInvestorPro.call(PLAYER_PRO_1), "should be true, PLAYER_PRO_1");
    });

    it("should return true if isInvestorPriority", async function () {
      await versusLaunchpool.addInvestorPriority(PLAYER_PRIORITY_0, ether("1"));
      assert.isTrue(await versusLaunchpool.isInvestorPriority.call(PLAYER_PRIORITY_0), "should be true");
    });
  });

  describe("typeNameOfInvestorFor", function () {
    it("should return Base", async function () {
      assert.isTrue((await versusLaunchpool.typeNameOfInvestorFor.call(PLAYER_BASE_0)) == "Base", "wrong for Base");
    });

    it("should return Pro", async function () {
      assert.isTrue((await versusLaunchpool.typeNameOfInvestorFor.call(PLAYER_PRO_0)) == "Pro", "wrong for Pro");
    });

    it("should return Priority", async function () {
      await versusLaunchpool.addInvestorPriority(PLAYER_PRIORITY_0, ether("1"));
      assert.isTrue((await versusLaunchpool.typeNameOfInvestorFor.call(PLAYER_PRIORITY_0)) == "Priority", "wrong for Priority");
    });

    it("should return empty string", async function () {
      assert.isTrue((await versusLaunchpool.typeNameOfInvestorFor.call(OTHER)) == "", "wrong for empty string");
    });
  });
});