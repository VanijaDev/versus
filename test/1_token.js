const VersusToken = artifacts.require("./VersusToken.sol");

const {
  BN,
  ether,
  balance,
  constants,
  expectEvent,
  expectRevert,
  time,
} = require('@openzeppelin/test-helpers');

contract("Versus token", function(accounts) {
  const OWNER = accounts[0];
  const OTHER = accounts[1];
  const TOTAL_SUPPLY = new BN(2000000).mul(new BN(10).pow(new BN(18)));

  let versusToken;

  beforeEach("setup", async function() {
    await time.advanceBlock();
    versusToken = await VersusToken.new();
  });
  
  describe("Constructor", function() {
    it("should be correct name", async function () {
      assert.equal(await versusToken.name(), "VERSUS", "wrong name");
    });


    it("should be correct symbol", async function () {
      assert.equal(await versusToken.symbol(), "VERSUS", "wrong symbol");
    });

    it("should set correct owner", async function () {
      assert.equal(await versusToken.owner(), accounts[0], "wrong owner");
    });
  });

  describe("mint", function() {
    it("should fail if not owner", async function () {
      await expectRevert(versusToken.mint(OTHER, ether("1"), {
        from: OTHER
      }), "Ownable: caller is not the owner");
    });
    
    it("should mint correct amount to receiver", async function () {
      assert.equal(0, (await versusToken.balanceOf(OTHER)).cmp(ether("0")), "should be 0 before");
      await versusToken.mint(OTHER, ether("1"), {
        from: OWNER
      });
      assert.equal(0, (await versusToken.balanceOf(OTHER)).cmp(ether("1")), "should be 1 after");
    });
    
    it("should fail if > Above max supply", async function () {
      await expectRevert(versusToken.mint(OTHER, ether("20000000"), {
        from: OWNER
      }), "Above max supply");
    });
  });
});
