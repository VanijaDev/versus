const VersusToken = artifacts.require("./VersusToken.sol");

const {
  BN,
  time
} = require('@openzeppelin/test-helpers');

contract("Versus token", function(accounts) {
  const OWNER = accounts[0];
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


    it("should be correct total totalSupply", async function () {
      assert.equal(0, (await versusToken.totalSupply()).cmp(TOTAL_SUPPLY), "wrong total totalSupply");
    });


    it("should mint correct totalSupply to owner", async function () {
      assert.equal(0, (await versusToken.balanceOf.call(OWNER)).cmp(TOTAL_SUPPLY), "wrong balance of owner");
    });
  });
});
