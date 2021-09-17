// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import "@openzeppelin/contracts/access/Ownable.sol";

//  TODO: VERSUS as bonus for voting?

contract VersusVoting is Ownable {

  enum PoolId {
    none,
    one,
    two
  }

  struct Stake {
    PoolId poolId;
    uint256 amount;
  }

  struct EpochResult {
    uint8 poolIdWinner;
    uint256 loserPoolChunk;
    uint256 poolWinnerVoterRefundPercentage;
  }

  uint256 public poolLoserWinnersDistributionPercentage;  //  balance percentage to be distributed among voters in winner pool. Remainder gets to next epoch.
  uint256 public poolWinnerVoterRefundPercentage;         //  balance percentage to be refunded to voters. Remainder is dev fee.

  uint256 public currentEpoch;
  uint256 public currentEpochStartedAt;
  uint256 public epochDuration;
  uint256 public minStake;
  
  address payable public devFeeReceiver;

  mapping(uint256 => EpochResult) public epochResult;                           //  (epoch => EpochResult)
  mapping(uint256 => mapping(PoolId => uint256)) public balanceForPool;         //  (epoch => (poolId => balance)), poolId = "1" or "2"
  mapping(uint256 => mapping(address => Stake)) private stakeForVoter;          //  (epoch => (voter => Stake))
  mapping(uint256 => mapping(PoolId => address[])) private votersForPool;       //  (epoch => (poolId => voters[]))
  mapping(address => uint256) public pendingEpochToStartCalculationsForVoter;   //  (voter => epoch), epoch index to start with for pending reward calculations

  event Vote(uint8 poolId, address voter, uint256 amount);
  event EpochFinished(uint256 epoch);
  event DevFeeTransferred(address to, uint256 amount);

  modifier onlyValidEpoch(uint256 _epoch) {
    require(_epoch <= currentEpoch, "Wrong epoch");
    _;
  }

  modifier onlyValidPool(PoolId _poolId) {
    require(_poolId == PoolId.one || _poolId == PoolId.two, "Wrong poolId");
    _;
  }

  /**
    * @dev Constructor function.
    * @param _devFeeReceiver Receiver of devFee.
   */
  constructor(address _devFeeReceiver) {
    devFeeReceiver = payable(_devFeeReceiver);
    epochDuration = 3 hours;
    poolLoserWinnersDistributionPercentage = 70;
    poolWinnerVoterRefundPercentage = 95;
  }

  /**
    * @dev Destroys this Smart Contract.
   */
  function kill() external onlyOwner {
    selfdestruct(payable(msg.sender));
  }

  /**
    * @dev Updates percentage used for distribution of loser pool balance amount voters in winner pool.
    * @param _percentage Percentage to be used.
   */
  function updatePoolLoserWinnersDistributionPercentage(uint256 _percentage) external onlyOwner {
    require(_percentage > 0, "Wrong _percentage");
    poolLoserWinnersDistributionPercentage = _percentage;
  }

  /**
    * @dev Updates refund percentage for voters of winner pool.
    * @param _percentage Percentage to be used.
   */
  function updatePoolWinnerVoterRefundPercentage(uint256 _percentage) external onlyOwner {
    require(_percentage > 0, "Wrong _percentage");
    poolWinnerVoterRefundPercentage = _percentage;
  }

  /**
    * @dev Updates address as dev fee receiver.
    * @param _address Receiver address.
   */
  function updateDevFeeReceiver(address _address) external onlyOwner {
    require(_address != address(0), "Wrong _address");
    devFeeReceiver = payable(_address);
  }

  /**
   * @dev Updates epoch duration.
   * @param _duration Duration.
   */
  function updateEpochDuration(uint256 _duration) external onlyOwner {
    require(_duration > 0, "Wrong duration");
    epochDuration = _duration;
  }

  /**
   * @dev Updates min stake amount.
   * @param _minStake Min stake amount.
   */
  function updateMinStake(uint256 _minStake) external onlyOwner {
    require(_minStake > 0, "Wrong minStake");
    minStake = _minStake;
  }

  /**
   * @dev Gets balance for pool.
   * @param _epoch Epoch id.
   * @param _poolId PoolId.
   * @return Balance for pool.
   */
  function getBalanceForPool(uint256 _epoch, PoolId _poolId) external view onlyValidEpoch(_epoch) onlyValidPool(_poolId) returns (uint256) {
    return balanceForPool[_epoch][_poolId];
  }

  /**
   * @dev Gets stake for voter.
   * @param _epoch Epoch id.
   * @param _address Voter address.
   * @return Stake struct.
   */
  function getStakeForVoter(uint256 _epoch, address _address) external view onlyValidEpoch(_epoch) returns (Stake memory) {
    return stakeForVoter[_epoch][_address];
  }

  /**
   * @dev Gets voters for pool.
   * @param _epoch Epoch id.
   * @param _poolId PoolId.
   * @return Voters for pool.
   */
  function getVotersForPool(uint256 _epoch, PoolId _poolId) public view onlyValidEpoch(_epoch) onlyValidPool(_poolId) returns (address[] memory) {
    return votersForPool[_epoch][_poolId];
  }

  /**
   * @dev Gets voter count for pool.
   * @param _epoch Epoch id.
   * @param _poolId PoolId.
   * @return Voters for pool.
   */
  function getVoterCountForPool(uint256 _epoch, PoolId _poolId) public view returns (uint256) {
    return getVotersForPool(_epoch, _poolId).length;
  }

  /**
   * @dev Makes Stake to the pool.
   * @param _poolId PoolId.
   */
  function vote(PoolId _poolId) external payable onlyValidPool(_poolId) {
    require(msg.value >= minStake, "Wrong amount");
    require(block.timestamp < currentEpochStartedAt + epochDuration, "Epoch finished");

    Stake storage stake = stakeForVoter[currentEpoch][msg.sender];
    if (stake.poolId == PoolId.none) {
      stake.poolId = _poolId;
      votersForPool[currentEpoch][_poolId].push(msg.sender);
    } else {
      require(stake.poolId == _poolId, "Wrong _poolId");
    }

    stake.amount += msg.value;
    balanceForPool[currentEpoch][_poolId] += msg.value;

    emit Vote(uint8(_poolId), msg.sender, msg.value);
  }

  /**
    * @dev Finishes ongoing epoch & performs calculations.
   */
  function finishEpoch() external onlyOwner {
    require(block.timestamp >= currentEpochStartedAt + epochDuration, "Still running");

    if (balanceForPool[currentEpoch][PoolId.one] > balanceForPool[currentEpoch][PoolId.two]) {
      performCalculationsForPoolLoser(PoolId.two, PoolId.one);
      performCalculationsForPoolWinner(PoolId.one);
    } else if (balanceForPool[currentEpoch][PoolId.one] < balanceForPool[currentEpoch][PoolId.two]) {
      performCalculationsForPoolLoser(PoolId.one, PoolId.two);
      performCalculationsForPoolWinner(PoolId.two);
    }

    emit EpochFinished(currentEpoch);

    currentEpoch += 1;
    currentEpochStartedAt = block.timestamp;
  }

  /**
    * @dev Performs calculations for pool loser.
    * @param _loserId PoolId that lost.
    * @param _winnerId PoolId that won.
   */
  function performCalculationsForPoolLoser(PoolId _loserId, PoolId _winnerId) private {
    uint256 balance = balanceForPool[currentEpoch][_loserId];

    uint256 winnersDistribution = ((balance * poolLoserWinnersDistributionPercentage) / 100);
    uint256 winners = votersForPool[currentEpoch][_winnerId].length;
    uint256 winnerChunk = winnersDistribution / winners;

    epochResult[currentEpoch] = EpochResult(uint8(_winnerId), winnerChunk, poolWinnerVoterRefundPercentage);

    uint256 singlePoolAmount = (balance - (winnerChunk * winners)) / 2;
    balanceForPool[currentEpoch + 1][PoolId.one] = singlePoolAmount;
    balanceForPool[currentEpoch + 1][PoolId.two] = singlePoolAmount;
  }

  /**
    * @dev Performs calculations for pool winner.
    * @param _winnerId PoolId that won.
   */
  function performCalculationsForPoolWinner(PoolId _winnerId) private {
    uint256 balance = balanceForPool[currentEpoch][_winnerId];
    
    uint256 devFee = (balance * (100 - poolWinnerVoterRefundPercentage)) / 100;
    devFeeReceiver.transfer(devFee);
    emit DevFeeTransferred(devFeeReceiver, devFee);
  }

  /**
    * @dev Calculates pending reward for player.
    * @param _loopLimit Limit for epoch looping.
    * @return amount Reward amount.
    * @return updatedStartEpoch Updated epoch to start following calculations.
   */
  function calculatePendingWithdrawalReward(uint256 _loopLimit) public view returns (uint256 amount, uint256 updatedStartEpoch) {
    uint256 startId = pendingEpochToStartCalculationsForVoter[msg.sender];
    uint256 stopId = (_loopLimit == 0) ? currentEpoch - 1 : startId + _loopLimit;
    require(stopId < currentEpoch, "Wrong loopLimit");
    
    updatedStartEpoch = stopId + 1;

    for (uint256 epoch = startId; epoch <= stopId; epoch ++) {
      Stake storage stake = stakeForVoter[epoch][msg.sender];
      EpochResult storage result = epochResult[epoch];

      if (stake.poolId == PoolId(result.poolIdWinner)) {
        amount += (stake.amount * result.poolWinnerVoterRefundPercentage) / 100;
        amount += result.loserPoolChunk;
      } else if (PoolId(result.poolIdWinner) == PoolId.none) {
        if (stake.amount > 0) {
          amount += stake.amount;
        }
      }
    }
  }

  /**
    * @dev Withdraws pending reward.
    * @param _loopLimit Limit for epoch looping.
   */
  function withdrawPendingReward(uint256 _loopLimit) external {
    (uint256 amount, uint256 updatedStartEpoch) = calculatePendingWithdrawalReward(_loopLimit);
    require(amount > 0, "No reward");

    pendingEpochToStartCalculationsForVoter[msg.sender] = updatedStartEpoch;

    (payable(msg.sender)).transfer(amount);
  }
}
