import { versusTokenAddress, versusTokenABI, versusVotingAddress, versusVotingABI } from "./SmartContractData";

import Web3 from "web3";
import BigNumber from "bignumber.js";

export class BlockchainManager {
  //  web3
  //  userAccount
  //  currentEpoch
  //  versusToken
  //  versusVoting
  //  mininStake   //  in wei
  //  finishAt

  constructor() {
    console.log("BlockchainManager constructor");

    if (typeof window.ethereum === 'undefined') {
      alert("MetaMask is NOT installed!");
      return;
    }

    if (window.ethereum.chainId != "0x61") {
      alert("use BSC Test");
    }
    
    if (!window.ethereum.isMetaMask) {
      alert("use MetaMask");
    }

    this.web3 = new Web3(window.ethereum);
    // console.log(this.web3);

    this.versusToken = new this.web3.eth.Contract(versusTokenABI(), versusTokenAddress());
    // console.log("versusToken: ", this.versusToken);

    this.versusVoting = new this.web3.eth.Contract(versusVotingABI(), versusVotingAddress());
    // console.log("versusVoting: ", this.versusVoting);
  }

  async init() {
    console.log("BlockchainManager init");
    
    await this.updateUserAccount();
    await this.updateUserBalance();
    await this.updateCurrentEpoch();
    this.updateCountdown();
    await this.updatePoolBalances();
    await this.updateMinStake();

    await this.updatePendingReward("BNB");
    await this.updatePendingReward("VERSUS");

    await this.setupEventListener();
  }

  async updateUserAccount() {
    this.userAccount = (await ethereum.request({ method: 'eth_requestAccounts' }))[0];
    document.getElementById("userAccount").innerHTML = this.userAccount;
  }

  async getUserBalance() {
    return await this.web3.eth.getBalance(this.userAccount);  //  in wei
  }
  
  async updateUserBalance() {
    const balance = await this.getUserBalance();
    document.getElementById("userBalance").innerHTML = this.web3.utils.fromWei(balance);
  }

  async updateCurrentEpoch() {
    this.currentEpoch = await this.versusVoting.methods.currentEpoch().call();
    document.getElementById("currentEpoch").innerHTML = this.currentEpoch;
  }

  async updateCountdown() {
    this.finishAt = await this.epochFinishAt();
    const now = new Date().getTime();

    if (this.finishAt <= now) {
      alert(`Epoch finished ${this.finishAt - now} seconds ago`)
      return;
    }

    this.runCountdown();
  }

  runCountdown() {
    var thisLocal = this;
    var x = setInterval(function() {
      // Get today's date and time
      var now = new Date().getTime();

      // Find the distance between now and the count down date
      var distance = thisLocal.finishAt - now;

      // Time calculations for days, hours, minutes and seconds
      var days = Math.floor(distance / (1000 * 60 * 60 * 24));
      var hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      var minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      var seconds = Math.floor((distance % (1000 * 60)) / 1000);

      // Display the result in the element with id="demo"
      document.getElementById("epochCountdown").innerHTML = days + "d " + hours + "h "
      + minutes + "m " + seconds + "s ";

      // If the count down is finished, write some text 
      if (distance < 0) {
        clearInterval(x);
        document.getElementById("epochCountdown").innerHTML = "Epoch Finished";
      }
    }, 1000);
  }

  async epochFinishAt() {
    const epochStarted = parseInt(await this.getEpochStartedAt());
    const epochDuration = parseInt(await this.getEpochDuration());
    const currentTimestamp = parseInt(new Date().getTime() / 1000);
    return (epochStarted + epochDuration) * 1000;
  }

  async getEpochStartedAt() {
    return this.versusVoting.methods.currentEpochStartedAt().call();
  }

  async getEpochDuration() {
    return this.versusVoting.methods.epochDuration().call();
  }

  async updatePoolBalances() {
    const balancePool_1 = await this.versusVoting.methods.getPoolBalanceTotal(this.currentEpoch, 1).call();
    document.getElementById("balancePool_1").innerHTML = this.web3.utils.fromWei(balancePool_1);

    const balancePool_2 = await this.versusVoting.methods.getPoolBalanceTotal(this.currentEpoch, 2).call();
    document.getElementById("balancePool_2").innerHTML = this.web3.utils.fromWei(balancePool_2);
  }

  async updateMinStake() {
    this.minStake = await this.versusVoting.methods.minStake().call();
    document.getElementById("minStake").innerHTML = this.web3.utils.fromWei(this.minStake);
  }

  async updatePendingReward(_cryptoName) {
    if (!_cryptoName.localeCompare("BNB")) {
      // const pendingBNB = (await this.versusVoting.methods.calculatePendingReward(0).call()).amount;
      // document.getElementById("pendingRewardBNB").innerHTML = this.web3.utils.fromWei(pendingBNB);
    } else if (!_cryptoName.localeCompare("VERSUS")) {
      const pendingVersus = await this.versusVoting.methods.pendingVersusTokenBonus(this.userAccount).call();
      document.getElementById("pendingRewardVERSUS").innerHTML = this.web3.utils.fromWei(pendingVersus);
    } else {
      throw Error(`Wrong crypto: ${_cryptoName}`);
    }
  }


  //  Transactions
  async makeVote(_pool) {
    if (parseInt(_pool) < 1 || parseInt(_pool) > 2) {
      throw Error(`Wrong Pool: ${_pool}`);
    }

    const amountWei = this.web3.utils.toWei(document.getElementById("amountPool_"+_pool).value, "ether");
    console.log("amountWei: ", amountWei);

    if (parseInt(amountWei) < parseInt(this.minStake)) {
      alert("less then min stake");
      return;
    }

    const userBalance = await this.getUserBalance();
    if (parseInt(userBalance) < parseInt(amountWei)) {
      alert("Not enough balance");
      return;
    }

    const thisLocal = this;
    this.versusVoting.methods.makeVote(_pool).send({
      from: this.userAccount,
      value: amountWei
    })
    .on('transactionHash', function(hash){
      console.log(`tx sent, hash: ${hash}`);
    })
    .on('confirmation', function(confirmationNumber, receipt){
        //  needed?
    })
    .on('receipt', function(receipt){
      console.log(`tx SUCCESS, hash: ${receipt.transactionHash}`);
      thisLocal.updatePoolBalances();
      thisLocal.updateUserBalance();
    })
    .on('error', function(error, receipt) { // If the transaction was rejected by the network with a receipt, the second parameter will be the receipt.
      console.error(`tx FAILED, error: ${error}, receipt: ${receipt}`);
    });
  }

  async finishEpoch() {
    const thisLocal = this;
    this.versusVoting.methods.finishEpoch().send({
      from: this.userAccount
    })
    .on('transactionHash', function(hash){
      console.log(`tx sent, hash: ${hash}`);
    })
    .on('confirmation', function(confirmationNumber, receipt){
        //  needed?
    })
    .on('receipt', async function(receipt){
      console.log(`tx SUCCESS, hash: ${receipt.transactionHash}`);
      await thisLocal.updateCurrentEpoch();
      thisLocal.updatePoolBalances();
      thisLocal.updateUserBalance();
      thisLocal.updateCountdown();
    })
    .on('error', function(error, receipt) { // If the transaction was rejected by the network with a receipt, the second parameter will be the receipt.
      console.error(`tx FAILED, error: ${error}, receipt: ${receipt}`);
    });
  }

  async withdrawPendingReward() {
    const thisLocal = this;
    this.versusVoting.methods.withdrawPendingReward(0).send({
      from: this.userAccount
    })
    .on('transactionHash', function(hash){
      console.log(`tx sent, hash: ${hash}`);
    })
    .on('confirmation', function(confirmationNumber, receipt){
        //  needed?
    })
    .on('receipt', async function(receipt){
      console.log(`tx SUCCESS, hash: ${receipt.transactionHash}`);
      await thisLocal.updatePendingReward("BNB");
      await thisLocal.updatePendingReward("VERSUS");
    })
    .on('error', function(error, receipt) { // If the transaction was rejected by the network with a receipt, the second parameter will be the receipt.
      console.error(`tx FAILED, error: ${error}, receipt: ${receipt}`);
    });
  }


  //  Events
  async setupEventListener() {
    // event Voted(uint8 pool, address voter, uint256 amount);
    
    const thisLocal = this;
    this.versusVoting.events.Voted(function (error, event) {
      // console.log("event: ", event);
      if (event.returnValues.voter.toLowerCase().localeCompare(thisLocal.userAccount.toLowerCase())) {
        thisLocal.updatePoolBalances();
      }
    })
    .on("connected", function(subscriptionId){
        //  TODO: needed?
    })
    .on('data', function (event) {
        // console.log(event); // same results as the optional callback above
    })
    .on('changed', function(event){
        // remove event from local database
    })
    .on('error', function(error, receipt) { // If the transaction was rejected by the network with a receipt, the second parameter will be the receipt.
      //  TODO: needed?
    });
  }
};


ethereum.on('chainChanged', (chainId) => {
  console.log(`chainChanged: ${chainId}`);
  location.reload();
});

ethereum.on('accountsChanged', function (accounts) {
  console.log(`accountsChanged: ${accounts}`);
  window.Index.updateUserAccount();
});
