// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract VersusVoting is Ownable {

  enum Pool {
    none,
    one,
    two
  }

  struct Vote {
    Pool pool;
    uint256 stake;
  }

  /**
    * @notice Get sum if want to get final balance at epoch end time.
   */
  struct PoolBalance {
    uint256 startedWith;  //  balance at epoch begin
    uint256 staked;       //  stakes amount
  }

  struct EpochResult {
    uint8 poolWinner;
    uint256 poolWinnerVoterRefundPercentage;  //  95%
  }

  address public versusToken;
  address payable public devFeeReceiver;

  uint256 public poolLoserBalanceToNextEpochPercentage; //  30%, balance percentage to be distributed among both pools for next epoch (startedWith). Remainder gets distributed among voters in winner pool (70%).
  uint256 public poolWinnerVoterRefundPercentage;       //  95%, balance percentage to be refunded to voters. Remainder is dev fee.

  uint256 public currentEpoch;
  uint256 public currentEpochStartedAt;
  uint256 public epochDuration;
  uint256 public minStake;
  uint256 public versusBonus;

  mapping(address => uint256) public pendingVersusTokenBonus;                   //  (voter => amount)
  mapping(uint256 => EpochResult) public epochResult;                           //  (epoch => EpochResult)
  mapping(address => uint256) public pendingEpochToStartCalculationsForVoter;   //  (voter => epoch), epoch index to start with for pending reward calculations
  mapping(uint256 => mapping(address => Vote)) private voteForVoter;            //  (epoch => (voter => Vote))
  mapping(uint256 => mapping(Pool => PoolBalance)) private balanceForPool;      //  (epoch => (pool => PoolBalance))
  mapping(uint256 => mapping(Pool => address[])) private votersForPool;         //  (epoch => (pool => voters[]))

  event Voted(uint8 pool, address voter, uint256 amount);
  event EpochFinished(uint256 epoch);
  event DevFeeTransferred(address to, uint256 amount);

  modifier onlyValidEpoch(uint256 _epoch) {
    require(_epoch <= currentEpoch, "Wrong epoch");
    _;
  }

  modifier onlyValidPool(Pool _pool) {
    require(_pool == Pool.one || _pool == Pool.two, "Wrong pool");
    _;
  }

  /***
    * @dev Constructor function.
    * @param _devFeeReceiver Receiver of devFee.
    * @param _versusToken VersusToken address.
   */
  constructor(address _devFeeReceiver, address _versusToken) {
    versusBonus = 10**18; //  1 VERSUS
    minStake = 10**17;    //  0.1 BNB
    epochDuration = 3 hours;
    poolLoserBalanceToNextEpochPercentage = 30;
    poolWinnerVoterRefundPercentage = 95;

    versusToken = _versusToken;
    devFeeReceiver = payable(_devFeeReceiver);
    currentEpochStartedAt = block.timestamp;
  }

  /***
    * @dev Destroys this Smart Contract.
   */
  function kill() external onlyOwner {
    selfdestruct(payable(msg.sender));
  }

  /**
    * @dev Updates percentage to be distributed among both pools for next epoch (startedWith).
    * @param _percentage Percentage to be used.
   */
  function updatePoolLoserBalanceToNextEpochPercentage(uint256 _percentage) external onlyOwner {
    require(_percentage > 0 && _percentage <= 100, "Wrong _percentage");
    poolLoserBalanceToNextEpochPercentage = _percentage;
  }

  /***
    * @dev Updates refund percentage for voters of winner pool.
    * @param _percentage Percentage to be used.
   */
  function updatePoolWinnerVoterRefundPercentage(uint256 _percentage) external onlyOwner {
    require(_percentage > 0 && _percentage <= 100, "Wrong _percentage");
    poolWinnerVoterRefundPercentage = _percentage;
  }

  /***
    * @dev Updates address as dev fee receiver.
    * @param _address Receiver address.
   */
  function updateDevFeeReceiver(address _address) external onlyOwner {
    require(_address != address(0), "Wrong _address");
    devFeeReceiver = payable(_address);
  }

  /***
   * @dev Updates epoch duration.
   * @param _duration Duration.
   */
  function updateEpochDuration(uint256 _duration) external onlyOwner {
    require(_duration > 0, "Wrong _duration");
    epochDuration = _duration;
  }

  /***
   * @dev Updates Versus token bonus amount.
   * @param _amount Versus amount.
   */
  function updateVersusBonus(uint256 _amount) external onlyOwner {
    versusBonus = _amount;
  }

  /***
   * @dev Updates min stake amount.
   * @param _minStake Min stake amount.
   */
  function updateMinStake(uint256 _minStake) external onlyOwner {
    require(_minStake > 0, "Wrong _minStake");
    minStake = _minStake;
  }

  /**
   * @dev Gets PoolBalance struct for the pool.
   * @param _epoch Epoch id.
   * @param _pool Pool.
   * @return PoolBalance struct.
   */
  function getBalancePoolBalance(uint256 _epoch, Pool _pool) external view onlyValidEpoch(_epoch) onlyValidPool(_pool) returns (PoolBalance memory) {
    return balanceForPool[_epoch][_pool];
  }

  /**
   * @dev Gets balance total amount for the pool.
   * @param _epoch Epoch id.
   * @param _pool Pool.
   * @return Balance total amount.
   */
  function getBalanceTotalForPool(uint256 _epoch, Pool _pool) public view onlyValidEpoch(_epoch) onlyValidPool(_pool) returns (uint256) {
    return balanceForPool[_epoch][_pool].startedWith + balanceForPool[_epoch][_pool].staked;
  }

  /**
   * @dev Gets Vote for the voter.
   * @param _epoch Epoch id.
   * @param _address Voter address.
   * @return Vote struct.
   */
  function getVoteForVoter(uint256 _epoch, address _address) external view onlyValidEpoch(_epoch) returns (Vote memory) {
    return voteForVoter[_epoch][_address];
  }

  /**
   * @dev Gets voters for the pool.
   * @param _epoch Epoch id.
   * @param _pool Pool.
   * @return Voters for pool.
   */
  function getVotersForPool(uint256 _epoch, Pool _pool) public view onlyValidEpoch(_epoch) onlyValidPool(_pool) returns (address[] memory) {
    return votersForPool[_epoch][_pool];
  }

  /**
   * @dev Gets voters count for the pool.
   * @param _epoch Epoch id.
   * @param _pool Pool.
   * @return Voters for pool.
   */
  function getVotersCountForPool(uint256 _epoch, Pool _pool) public view returns (uint256) {
    return getVotersForPool(_epoch, _pool).length;
  }

  /**
   * @dev Makes vote for the pool.
   * @param _pool Pool.
   */
  function makeVote(Pool _pool) external payable onlyValidPool(_pool) {
    require(msg.value >= minStake, "Wrong amount");
    require(block.timestamp < currentEpochStartedAt + epochDuration, "Epoch finished");

    Vote storage vote = voteForVoter[currentEpoch][msg.sender];
    if (vote.pool == Pool.none) {
      vote.pool = _pool;
      votersForPool[currentEpoch][_pool].push(msg.sender);
    } else {
      require(vote.pool == _pool, "Other pool before");
    }

    //  stake
    vote.stake += msg.value;
    balanceForPool[currentEpoch][_pool].staked += msg.value;

    //  token bonus
    if (versusBonus > 0) {
      pendingVersusTokenBonus[msg.sender] += versusBonus;
    }

    emit Voted(uint8(_pool), msg.sender, msg.value);
  }

  /**
    * @dev Finishes ongoing epoch & performs calculations.
   */
  function finishEpoch() external onlyOwner {
    require(block.timestamp >= currentEpochStartedAt + epochDuration, "Epoch running");

    if (balanceForPool[currentEpoch][Pool.one].staked > balanceForPool[currentEpoch][Pool.two].staked) {
      performCalculationsForPoolWinner(Pool.one);
      performCalculationsForPoolLoser(Pool.two);
    } else if (balanceForPool[currentEpoch][Pool.one].staked < balanceForPool[currentEpoch][Pool.two].staked) {
      performCalculationsForPoolWinner(Pool.two);
      performCalculationsForPoolLoser(Pool.one);
    } else {
      //  draw
      balanceForPool[currentEpoch + 1][Pool.one].startedWith = balanceForPool[currentEpoch][Pool.one].startedWith;
      balanceForPool[currentEpoch + 1][Pool.two].startedWith = balanceForPool[currentEpoch][Pool.two].startedWith;

      //  TODO:
      //  +++ pool balance
      //  +++ players can refund 100% of stake
      //
      //  srarted with 10 BNB
      //  users voted totally 20 BNB, total: 30 BNB
      //  20 BNB to refund, 10 BNB to next epoch
    }

    emit EpochFinished(currentEpoch);

    currentEpoch += 1;
    currentEpochStartedAt = block.timestamp;
  }

  /**
    * @dev Performs calculations for pool winner.
    * @param _winnerId Pool that won.
   */
  function performCalculationsForPoolWinner(Pool _winnerId) private {
    epochResult[currentEpoch] = EpochResult(uint8(_winnerId), poolWinnerVoterRefundPercentage);

    uint256 balanceWinner = getBalanceTotalForPool(currentEpoch, _winnerId);
    
    //  5% 
    uint256 devFee = (balanceWinner * (100 - poolWinnerVoterRefundPercentage)) / 100;
    devFeeReceiver.transfer(devFee);
    emit DevFeeTransferred(devFeeReceiver, devFee);
  }

  /**
    * @dev Performs calculations for pool loser.
    * @param _loserId Pool that lost.
   */
  function performCalculationsForPoolLoser(Pool _loserId) private {
    uint256 balanceLoser = getBalanceTotalForPool(currentEpoch, _loserId);

    //  30%
    uint256 singlePoolAmount = (((balanceLoser * poolLoserBalanceToNextEpochPercentage) / 100)) / 2;
    balanceForPool[currentEpoch + 1][Pool.one].startedWith = singlePoolAmount;
    balanceForPool[currentEpoch + 1][Pool.two].startedWith = singlePoolAmount;


    // //  TODO: user should get according to their % in pool
    // //  70%
    // uint256 winnersDistribution = ((balanceLoser * poolLoserWinnersDistributionPercentage) / 100);
    // uint256 winners = votersForPool[currentEpoch][_winnerId].length;
    // uint256 winnerChunk = winnersDistribution / winners;

    // epochResult[currentEpoch] = EpochResult(uint8(_winnerId), winnerChunk, poolWinnerVoterRefundPercentage);
  }

  /**
    * @dev Calculates pending reward for player.
    * @param _loopLimit Limit for epoch looping. Use 0 for all epochs until now.
    * @return amount Reward amount.
    * @return updatedStartEpoch Updated epoch to start following calculations.
   */
  function calculatePendingReward(uint256 _loopLimit) public view returns (uint256 amount, uint256 updatedStartEpoch) {
    uint256 startId = pendingEpochToStartCalculationsForVoter[msg.sender];
    uint256 stopId = (_loopLimit == 0) ? currentEpoch - 1 : startId + _loopLimit;
    require(stopId < currentEpoch, "Wrong loopLimit");
    
    updatedStartEpoch = stopId + 1;

    for (uint256 epoch = startId; epoch <= stopId; epoch ++) {
      Vote storage vote = voteForVoter[epoch][msg.sender];
      EpochResult storage result = epochResult[epoch];

      if (vote.pool == Pool(result.poolWinner)) {
        amount += (vote.stake * result.poolWinnerVoterRefundPercentage) / 100;
        amount += calculateLoserChunkForEpoch(epoch);
      } else if (Pool(result.poolWinner) == Pool.none) {
        if (vote.stake > 0) {
          amount += vote.stake;
        }
      }
    }
  }

  /**
    * @dev Calculates loser pool chunk to be received by player in winner pool.
    * @param _epoch Epoch.
    * @return Chunk amount.
   */
  function calculateLoserChunkForEpoch(uint256 _epoch) private view returns(uint256) {
    Vote storage vote = voteForVoter[_epoch][msg.sender];

    Pool loserPool = (vote.pool == Pool.one) ? Pool.two : Pool.one;
    uint256 balanceLoser = getBalanceTotalForPool(_epoch, loserPool);

    uint256 balanceLoserForDistribution = (balanceLoser * (100 - poolLoserBalanceToNextEpochPercentage)) / 100;
    uint256 stakePercentage = balanceForPool[_epoch][Pool.two].staked / voteForVoter[_epoch][msg.sender].stake * 100; //  *100 used to get more precise value percentage with 2 decimals like.
    return (balanceLoserForDistribution * stakePercentage) / 10000;
  }

  /**
    * @dev Withdraws pending reward.
    * @param _loopLimit Limit for epoch looping.
    * TODO: approve this Snart Contract to transferFrom VERSUS tokens.
   */
  function withdrawPendingReward(uint256 _loopLimit) external {
    uint256 versusBonusTmp = pendingVersusTokenBonus[msg.sender];
    if (versusBonusTmp > 0) {
      delete pendingVersusTokenBonus[msg.sender];
      IERC20(versusToken).transferFrom(owner(), msg.sender, versusBonusTmp);
    }

    (uint256 amount, uint256 updatedStartEpoch) = calculatePendingReward(_loopLimit);
    if (amount > 0) {
      pendingEpochToStartCalculationsForVoter[msg.sender] = updatedStartEpoch;
      (payable(msg.sender)).transfer(amount);
    }

    if (versusBonusTmp == 0 && amount == 0) {
      revert("No reward");
    }
  }
}
