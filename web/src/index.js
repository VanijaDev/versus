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

  async approve() {
    this.bm.approve();
  }

  async makeStake(_pool) {
    this.bm.makeStake(_pool);
  }

  async makeUnstake(_pool) {
    this.bm.makeUnstake(_pool);
  }

  async withdrawStakingReward(_pool) {
    this.bm.withdrawStakingReward(_pool);
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