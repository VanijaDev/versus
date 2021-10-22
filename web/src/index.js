import { BlockchainManager } from "./BlockchainManager";

export default class Index {
  constructor() {
    console.log("hello world in constructor");
    this.bm = new BlockchainManager();

    this.bm.init();
  }

  updateUserAccount() {
    this.bm.updateUserAccount();
  }

  async makeVote(_pool) {
    this.bm.makeVote(_pool);
  }
  
  async finishEpoch() {
    this.bm.finishEpoch();
  }
  
  async withdrawPendingReward() {
    this.bm.withdrawPendingReward();
  }
};

window.onload = function () {
  window.Index = new Index();
};