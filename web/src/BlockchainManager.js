import { versusTokenAddress, versusTokenABI, versusVotingAddress, versusVotingABI, versusStakingABI, versusStakingAddress } from "./SmartContractData";
import {credentials} from "../secret"

import Web3 from "web3";

export class BlockchainManager {
  //  web3
  //  userAccount
  //  currentEpoch
  //  versusToken
  //  versusVoting
  //  versusStaking
  //  minStake   //  in wei
  //  finishAt
  //  isEventListenersInited
  //  vote -> pool, stake

  //  balanceVersus
  //  stakingPoolBalanceBNB
  //  minStakeForStaking_1
  //  minStakeForStaking_2
  //  versusInPool_1
  //  versusInPool_2
  //  apy_1
  //  apy_2

  constructor() {
    console.log("BlockchainManager constructor");

    if (typeof window.ethereum === 'undefined') {
      alert("MetaMask is NOT installed!");
      return;
    }

    if (window.ethereum.chainId != "0x61") {
      alert(`use BSC Test: ${window.ethereum.chainId}`);
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

    this.versusStaking = new this.web3.eth.Contract(versusStakingABI(), versusStakingAddress());
    // console.log("versusStaking: ", this.versusStaking);
  }

  async init() {
    console.log("BlockchainManager init");
    await this.updateUI();

    if (!this.isEventListenersInited) {
      this.setupEventListeners();
    }
  }

  async updateUI() {
    await this.updateUserAccount();
    await this.updateUserBalance();
    await this.updateCurrentEpoch();
    this.updateCountdown();
    this.updatePoolBalances();
    this.updateMyVote();
    this.updateMinStake();

    this.updatePendingReward("VERSUS");
    this.updatePendingReward("BNB");

    //  Staking
    this.updateStakingUI();
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
      alert(`Epoch finished ${this.finishAt - now} seconds ago`);
      document.getElementById("epochCountdown").innerHTML = "Epoch Finished";
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

  async updateMyVote() {
    const vote = await this.versusVoting.methods.getVoteForVoter(this.currentEpoch, this.userAccount).call();
    this.vote = vote;

    if (parseInt(vote.pool) == 1) {
      document.getElementById("myStakePool_1").innerHTML = this.web3.utils.fromWei(vote.stake);
      document.getElementById("myStakePool_2").innerHTML = "0";
    } else if (parseInt(vote.pool) == 2) {
      document.getElementById("myStakePool_2").innerHTML = this.web3.utils.fromWei(vote.stake);
      document.getElementById("myStakePool_1").innerHTML = "0";
    } else {
      document.getElementById("myStakePool_1").innerHTML = "0";
      document.getElementById("myStakePool_2").innerHTML = "0";
    }
  }

  async updateMinStake() {
    this.minStake = await this.versusVoting.methods.minStake().call();
    const minStakeEth = this.web3.utils.fromWei(this.minStake);
    document.getElementById("minStake").innerHTML = minStakeEth;

    document.getElementById("amountPool_1").value = minStakeEth;
    document.getElementById("amountPool_2").value = minStakeEth;
  }

  async updatePendingReward(_cryptoName) {
    if (!_cryptoName.localeCompare("BNB")) {
      const pendingBNB = (await this.versusVoting.methods.calculatePendingReward("0").call({from: this.userAccount})).amount;
      document.getElementById("pendingRewardBNB").innerHTML = this.web3.utils.fromWei(pendingBNB);
    } else if (!_cryptoName.localeCompare("VERSUS")) {
      const pendingVersus = await this.versusVoting.methods.pendingVersusTokenBonus(this.userAccount).call({from: this.userAccount});
      document.getElementById("pendingRewardVERSUS").innerHTML = this.web3.utils.fromWei(pendingVersus);
    } else {
      throw Error(`Wrong crypto: ${_cryptoName}`);
    }
  }

  //  Staking
  async updateStakingUI() {
    this.checkAllowance();
    this.updateBalanceVersus();
    this.updateStakingPoolBalanceBNB();
    this.updateStakingPoolBalanceVersus();
    this.updateMinStakeForStaking();
    this.updateVersusInPool();
    this.updateAPY();
    this.updateMyStake();
    this.updateAvailableReward();
  }

  async checkAllowance() {
    const allowance = await this.versusToken.methods.allowance(this.userAccount, this.versusStaking._address).call();
    if (parseInt(allowance) == parseInt(0)) {
      document.getElementById("btn_approve_versus_versus").style.display = "block"
      document.getElementById("btn_approve_versus_bnb").style.display = "block"
      document.getElementById("btn_stake_versus_versus").style.display = "none"
      document.getElementById("btn_stake_versus_bnb").style.display = "none"
    } else {
      document.getElementById("btn_approve_versus_versus").style.display = "none"
      document.getElementById("btn_approve_versus_bnb").style.display = "none"
      document.getElementById("btn_stake_versus_versus").style.display = "block"
      document.getElementById("btn_stake_versus_bnb").style.display = "block"
    }
  }
  
  async updateBalanceVersus() {
    this.balanceVersus = await this.versusToken.methods.balanceOf(this.userAccount).call();  //  in wei
    document.getElementById("balanceVersus").innerHTML = this.web3.utils.fromWei(this.balanceVersus);
  }
  
  async updateStakingPoolBalanceBNB() {
    this.stakingPoolBalanceBNB = await await this.web3.eth.getBalance(this.versusStaking._address);  //  in wei
    document.getElementById("stakingPoolBalanceBNB").innerHTML = this.web3.utils.fromWei(this.stakingPoolBalanceBNB);
  }

  async updateStakingPoolBalanceVersus() {
    this.stakingPoolBalanceVersus = await this.versusToken.methods.balanceOf(this.versusStaking._address).call();  //  in wei
    document.getElementById("stakingPoolBalanceVersus").innerHTML = this.web3.utils.fromWei(this.stakingPoolBalanceVersus);
  }

  async updateMinStakeForStaking() {
    //  0
    this.minStakeForStaking_1 = await this.versusStaking.methods.minStake(1).call();
    document.getElementById("minStakeForStaking_1").innerHTML = this.web3.utils.fromWei(this.minStakeForStaking_1);

    //  1
    this.minStakeForStaking_2 = await this.versusStaking.methods.minStake(2).call();
    document.getElementById("minStakeForStaking_2").innerHTML = this.web3.utils.fromWei(this.minStakeForStaking_2);
  }
  
  async updateVersusInPool() {
    //  0
    this.versusInPool_1 = await this.versusStaking.methods.versusInPool(1).call();
    document.getElementById("versusInPool_1").innerHTML = this.web3.utils.fromWei(this.versusInPool_1);

    //  1
    this.versusInPool_2 = await this.versusStaking.methods.versusInPool(2).call();
    document.getElementById("versusInPool_2").innerHTML = this.web3.utils.fromWei(this.versusInPool_2);
  }

  async updateAPY() {
    //  0
    this.apy_1 = await this.versusStaking.methods.apy(1).call();
    document.getElementById("apy_1").innerHTML = this.apy_1;

    //  1
    this.apy_2 = await this.versusStaking.methods.apy(2).call();
    document.getElementById("apy_2").innerHTML = this.apy_2;
  }

  async updateMyStake() {
    //  0
    const stake_1 = await this.versusStaking.methods.getStakeOf(this.userAccount, 1).call();
    document.getElementById("myStakeInPool_1").innerHTML = this.web3.utils.fromWei(stake_1.amount);

    //  1
    const stake_2 = await this.versusStaking.methods.getStakeOf(this.userAccount, 2).call();
    document.getElementById("myStakeInPool_2").innerHTML = this.web3.utils.fromWei(stake_2.amount);
  }

  async updateAvailableReward() {
    //  0
    const rewardVersus = await this.versusStaking.methods.calculateAvailableVersusReward(1).call({from: this.userAccount});
    document.getElementById("availableRewardVersus").innerHTML = this.web3.utils.fromWei(rewardVersus);

    //  1
    const rewardBnb = await this.versusStaking.methods.calculateAvailableBNBReward().call({from: this.userAccount});
    document.getElementById("availableRewardBNB").innerHTML = this.web3.utils.fromWei(rewardBnb);
  }


  //  Transactions
  async makeVote(_pool) {
    if (parseInt(_pool) < 1 || parseInt(_pool) > 2) {
      throw Error(`Wrong Pool: ${_pool}`);
    }

    if (parseInt(this.vote.pool) != 0) {
      if (parseInt(this.vote.pool) != parseInt(_pool)) {
        alert("Already voted for other pool.");
        return;
      }
    }

    const amountWei = this.web3.utils.toWei(document.getElementById("amountPool_"+_pool).value, "ether");
    // console.log("amountWei: ", amountWei);

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
      thisLocal.updatePendingReward("VERSUS");
      thisLocal.updateMyVote();
    })
    .on('error', function(error, receipt) { // If the transaction was rejected by the network with a receipt, the second parameter will be the receipt.
      console.error(`tx FAILED, error: ${error}, receipt: ${receipt}`);

      if (error.code == 4001) {
        alert("User denied tx.");
      }
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
      
      if (error.code == 4001) {
        alert("User denied tx.");
      }
    });
  }

  async finishEpoch() {
    //  TODO: use https://infura.io/ or https://moralis.io/ or smt other
    //  var web3 = new Web3("infura_url");


    const privKey = credentials("priv"); //  TODO: use .env or .secret for secret storage
    const pubAddress = credentials("pub"); //  TODO: use .env or .secret for secret storage

    //  1/2 - get gasPrice from web3
    const gasPrice = parseInt(await this.web3.eth.getGasPrice()) * 1.5; //  1.5 as a safeguard

    //  2/2 - use API of https://ethgasstation.info/ or https://etherscan.io/ or any other
    // const gasPrice = this.web3.utils.toWei('13', 'Gwei');

    //  create tx object
    const txObject = {
      from: pubAddress,
      to: this.versusVoting._address,
      gasLimit: 500000,
      gasPrice: gasPrice,
      data: this.versusVoting.methods.finishEpoch().encodeABI()
    }


    //  validate transaction
    console.log("validating Transaction...");
    let txValidated = false;

    //  TODO: use try catch to retry
    try {
      let estimatedGas = await this.web3.eth.estimateGas(txObject);
      txObject.gasLimit = parseInt(estimatedGas) * 1.5; //  1.5 as a safeguard
      console.log("txObject: ", txObject);
      txValidated = true;
    } catch (error) {
      console.log("estimatedGas error: ", error);
      //  TODO: handle & retry few times
    }

    if (!txValidated) {
      return;
    }

    console.log("sendSignedTransaction...");
    const signedTxObject = await this.web3.eth.accounts.signTransaction(txObject, privKey);

    //  TODO: use try catch to retry
    try {
      const tx = await this.web3.eth.sendSignedTransaction(signedTxObject.raw || signedTxObject.rawTransaction);
      console.log("SUCCESS tx: ", tx);
    } catch (error) {
      console.log("ERROR tx: ", error);
    }

    let checkEpoch = parseInt(await this.versusVoting.methods.currentEpoch().call());
    checkEpoch--;
    console.log(`checkEpoch: ${checkEpoch}`);
    const poolWinner = (await this.versusVoting.methods.epochResult(checkEpoch).call()).poolWinner;
    console.log(`poolWinner : ${poolWinner}`);
  }

  async approve() {
    const MAX_INT = "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"

    this.versusToken.methods.approve(this.versusStaking._address, MAX_INT).send({
      from: this.userAccount
    })
    .on('transactionHash', function(hash){
      console.log(`tx sent, hash: ${hash}`);
    })
    .on('confirmation', function(confirmationNumber, receipt){
        //  needed?
    })
    .on('receipt', function(receipt){
      console.log(`tx SUCCESS, hash: ${receipt.transactionHash}`);

      thisLocal.updateStakingUI();
    })
    .on('error', function(error, receipt) { // If the transaction was rejected by the network with a receipt, the second parameter will be the receipt.
      console.error(`tx FAILED, error: ${error}, receipt: ${receipt}`);

      if (error.code == 4001) {
        alert("User denied tx.");
      }
    });
  }

  async makeStake(_pool) {
    let amountWei;
    if (parseInt(_pool) == 1) {
      amountWei = this.web3.utils.toWei(document.getElementById("stake_versus_versus").value, "ether");
      if (parseInt(amountWei) < parseInt(this.minStakeForStaking_1)) {
        alert("less then min stake");
        return;
      }
    } else if (parseInt(_pool) == 2) {
      amountWei = this.web3.utils.toWei(document.getElementById("stake_versus_bnb").value, "ether");
      if (parseInt(amountWei) < parseInt(this.minStakeForStaking_2)) {
        alert("less then min stake");
        return;
      }
    } else {
      throw Error(`Wrong Pool: ${_pool}`);
    }
      
    console.log("amountWei: ", amountWei);

    if (parseInt(this.balanceVersus) < parseInt(amountWei)) {
      alert("Not enough balance");
      return;
    }

    const thisLocal = this;
    this.versusStaking.methods.stake(_pool, amountWei).send({
      from: this.userAccount
    })
    .on('transactionHash', function(hash){
      console.log(`tx sent, hash: ${hash}`);
    })
    .on('confirmation', function(confirmationNumber, receipt){
        //  needed?
    })
    .on('receipt', function(receipt){
      console.log(`tx SUCCESS, hash: ${receipt.transactionHash}`);

      thisLocal.updateStakingUI();
    })
    .on('error', function(error, receipt) { // If the transaction was rejected by the network with a receipt, the second parameter will be the receipt.
      console.error(`tx FAILED, error: ${error}, receipt: ${receipt}`);

      if (error.code == 4001) {
        alert("User denied tx.");
      }
    });
  }

  async makeUnstake(_pool) {
    if (parseInt(_pool) < 1 || parseInt(_pool) > 2) {
      alert("Wrong pool");
      return;
    }

    const thisLocal = this;
    this.versusStaking.methods.unstake(_pool).send({
      from: this.userAccount
    })
    .on('transactionHash', function(hash){
      console.log(`tx sent, hash: ${hash}`);
    })
    .on('confirmation', function(confirmationNumber, receipt){
        //  needed?
    })
    .on('receipt', function(receipt){
      console.log(`tx SUCCESS, hash: ${receipt.transactionHash}`);

      thisLocal.updateStakingUI();
    })
    .on('error', function(error, receipt) { // If the transaction was rejected by the network with a receipt, the second parameter will be the receipt.
      console.error(`tx FAILED, error: ${error}, receipt: ${receipt}`);

      if (error.code == 4001) {
        alert("User denied tx.");
      }
    });
  }

  async withdrawStakingReward(_pool) {
    if (parseInt(_pool) < 1 || parseInt(_pool) > 2) {
      alert("Wrong pool");
      return;
    }

    const thisLocal = this;
    this.versusStaking.methods.withdrawAvailableReward(_pool).send({
      from: this.userAccount
    })
    .on('transactionHash', function(hash){
      console.log(`tx sent, hash: ${hash}`);
    })
    .on('confirmation', function(confirmationNumber, receipt){
        //  needed?
    })
    .on('receipt', function(receipt){
      console.log(`tx SUCCESS, hash: ${receipt.transactionHash}`);

      thisLocal.updateStakingUI();
    })
    .on('error', function(error, receipt) { // If the transaction was rejected by the network with a receipt, the second parameter will be the receipt.
      console.error(`tx FAILED, error: ${error}, receipt: ${receipt}`);

      if (error.code == 4001) {
        alert("User denied tx.");
      }
    });
  }

  


  //  Events
  setupEventListeners() {
    this.setupEventListenerVoted();
    this.setupEventListenerEpochFinished();

    //  Staking
    this.setupEventListenerStakeMade();
    this.setupEventListenerUnstakeMade();

    this.isEventListenersInited = true;
  }

  setupEventListenerVoted() {
    // event Voted(uint8 pool, address voter, uint256 amount);
    
    const thisLocal = this;
    this.versusVoting.events.Voted(function (error, event) {
      // console.log("event: ", event);
      if (error) {
        throw new Error(`Voted event error: ${error}`);
      }

      if (event.returnValues.voter.toLowerCase().localeCompare(thisLocal.userAccount.toLowerCase())) {
        thisLocal.updatePoolBalances();
        thisLocal.updateMyVote();
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

  setupEventListenerEpochFinished() {
    // event EpochFinished(uint256 epoch);
    
    const thisLocal = this;
    this.versusVoting.events.EpochFinished(function (error, event) {
      // console.log("event: ", event);
      if (error) {
        throw new Error(`EpochFinished event error: ${error}`);
      }
      thisLocal.updateUI();
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


  setupEventListenerStakeMade() {
    // event StakeMade(bool _isVersus, address _from, uint256 _amount);
    
    const thisLocal = this;
    this.versusStaking.events.StakeMade(function (error, event) {
      // console.log("event: ", event);
      if (error) {
        throw new Error(`StakeMade event error: ${error}`);
      }

      if (event.returnValues._from.toLowerCase().localeCompare(thisLocal.userAccount.toLowerCase())) {
        thisLocal.updateStakingUI();
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

  setupEventListenerUnstakeMade() {
    // event UnstakeMade(bool _isVersus, address _from, uint256 _amount);
    
    const thisLocal = this;
    this.versusStaking.events.UnstakeMade(function (error, event) {
      // console.log("event: ", event);
      if (error) {
        throw new Error(`UnstakeMade event error: ${error}`);
      }

      if (event.returnValues._from.toLowerCase().localeCompare(thisLocal.userAccount.toLowerCase())) {
        thisLocal.updateStakingUI();
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


//  Etehreum events
ethereum.on('chainChanged', (chainId) => {
  console.log(`chainChanged: ${chainId}`);
  location.reload();
});

ethereum.on('accountsChanged', function (accounts) {
  console.log(`accountsChanged: ${accounts}`);
  window.Index.initBlockchainManager();
});