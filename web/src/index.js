import { BlockchainManager } from "./BlockchainManager";

export default class Index {
  constructor() {
    setTimeout(() => {
      this.bm = new BlockchainManager();
      this.initBlockchainManager();
    }, 300);  //  wait 0.3 sec for window to init ethereum
  }

  initBlockchainManager() {
    this.bm.init();
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