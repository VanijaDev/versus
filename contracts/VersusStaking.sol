// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract VersusStaking is Ownable, Pausable {

  enum Pool {
    none,
    versus_versus,
    versus_bnb
  }

  struct Stake {
    uint256 timeAt;
    uint256 amount;
  }

  uint256 constant SECONDS_IN_YEAR = 31536000;

  address public versusToken;

  mapping(Pool => uint256) public versusInPool;
  mapping(Pool => uint256) public minStake;
  mapping(Pool => uint256) public apy;
  mapping(address => mapping(Pool => Stake)) private stakeOf;
  mapping(address => mapping(Pool => uint256)) private savedVersusRewardOf;

  event StakeMade(bool _isVersus, address _from, uint256 _amount);
  event UnstakeMade(bool _isVersus, address _from, uint256 _amount);
  event RewardWithdrawn(bool _isVersus, address _to, uint256 _amount);

  modifier onlyUsablePool(Pool _pool) {
    require(_pool == Pool.versus_versus || _pool == Pool.versus_bnb, "Wrong pool");
    _;
  }

  receive() external payable { }

  /***
   * @dev Constructor.
   * @param _versusToken VersusToken address.
   */
  constructor(address _versusToken) {
    versusToken = _versusToken;

    minStake[Pool.versus_versus] = 0x16345785D8A0000; //  0.1 VERSUS
    minStake[Pool.versus_bnb] = 0x16345785D8A0000; //  0.1 VERSUS

    apy[Pool.versus_versus] = 300;
    apy[Pool.versus_bnb] = 100;
  }

  /***
   * @dev Gets stake for user for pool.
   * @param _address User address.
   * @param _pool Pool id.
   */
  function getStakeOf(address _address, Pool _pool) external view returns (Stake memory) {
    return stakeOf[_address][_pool];
  }

  /***
   * @dev Gets saved versus reward for user for pool.
   * @param _address User address.
   * @param _pool Pool id.
   */
  function getSavedVersusRewardOf(address _address, Pool _pool) external view returns (uint256) {
    return savedVersusRewardOf[_address][_pool];
  }

  /***
   * @dev Updates minimum stake amount for pool.
   * @param _pool Pool id. Use "0" to set for both pools.
   * @param _minStake Minimum stake amount. Use "0" if staking should be inactive.
   */
  function updateMinStake(Pool _pool, uint256 _minStake) external onlyOwner {
    if (_pool == Pool.none) {
      minStake[Pool.versus_versus] = _minStake;
      minStake[Pool.versus_bnb] = _minStake;
    } else if (_pool == Pool.versus_versus) {
      minStake[Pool.versus_versus] = _minStake;
    } else if (_pool == Pool.versus_bnb) {
      minStake[Pool.versus_bnb] = _minStake;
    } else {
      revert("Wrong pool");
    }
  }

  /***
   * @dev Updates APY for pool.
   * @param _pool Pool id.
   * @param _apy APY value.
   */
  function updateAPY(Pool _pool, uint256 _apy) external onlyOwner onlyUsablePool(_pool) {
    apy[_pool] = _apy;
  }

  /***
   * @dev Makes stake.
   * @notice Pending reward will be saved & Stake updated.
   * @param _pool Pool id.
   * @param _amount Stake amount.
   */
  function stake(Pool _pool, uint256 _amount) external whenNotPaused onlyUsablePool(_pool) {
    require(_amount >= minStake[_pool], "Wrong amount");

    _updateSavedVersusReward(_pool);
    stakeOf[msg.sender][_pool].timeAt = block.timestamp;
    stakeOf[msg.sender][_pool].amount += _amount;
    versusInPool[_pool] += _amount;

    IERC20(versusToken).transferFrom(msg.sender, address(this), _amount);
  }

  /***
   * @dev Calculates pending VERSUS reward to date and saves it.
   * @param _pool Pool id.
   */
  function _updateSavedVersusReward(Pool _pool) private {
    uint256 pendingReward = _calculatePendingVersusReward(_pool);
    if (pendingReward > 0) {
      savedVersusRewardOf[msg.sender][_pool] += pendingReward;
    }
  }

  /***
   * @dev Calculates pending VERSUS reward since stake "timeAt" to date.
   * @param _pool Pool id.
   * @return Pending reward.
   */
  function _calculatePendingVersusReward(Pool _pool) private view returns (uint256) {
    if (stakeOf[msg.sender][_pool].timeAt == 0) {
      return 0;
    }

    uint256 timeSinceStake = block.timestamp - stakeOf[msg.sender][_pool].timeAt;
    uint256 percentagePerSec = (apy[_pool] * 1 ether) / SECONDS_IN_YEAR;
    uint256 amount = ((stakeOf[msg.sender][_pool].amount * percentagePerSec) * timeSinceStake) / 1 ether;   //  ((2*10^18 * 9512937595129) * 12345) / 10^18 = 23487442922373501 wei == 0.23487442922373501 VERSUS
    return amount;
  }

  /***
   * @dev Calculates sum of _calculatePendingVersusReward & savedVersusRewardOf.
   * @param _pool Pool id.
   * @return Pending reward.
   */
  function calculateAvailableVersusReward(Pool _pool) public view onlyUsablePool(_pool) returns (uint256) {
    return savedVersusRewardOf[msg.sender][_pool] + _calculatePendingVersusReward(_pool);
  }

  /***
   * @dev Calculates available BNB reward.
   * @return BNB reward.
   */
  function calculateAvailableBNBReward() public view returns (uint256) {
    uint256 rewardVersus = calculateAvailableVersusReward(Pool.versus_bnb);
    if (rewardVersus == 0) {
      return 0;
    }

    return _convertVersusToBnb(rewardVersus);
  }

  /***
   * @dev Converts VERSUS to BNB.
   * @param _amount VERSUS amount to be converted.
   * @return BNB amount.
   */
  function _convertVersusToBnb(uint256 _amount) private view returns(uint256) {
    //  TODO: get BNB from PriceFeed. WIll not be direct pair.
    return 200000 gwei;
  }

  /***
   * @dev Withdraws available reward.
   * @param _pool Pool id.
   */
  function withdrawAvailableReward(Pool _pool) public whenNotPaused onlyUsablePool(_pool) {
    if (_pool == Pool.versus_versus) {
      uint256 rewardVersus = calculateAvailableVersusReward(_pool);
      require(rewardVersus > 0, "No reward VERSUS");
      
      delete savedVersusRewardOf[msg.sender][_pool];
      IERC20(versusToken).transferFrom(owner(), msg.sender, rewardVersus);
    } else {
      uint256 rewardBnb = calculateAvailableBNBReward();
      require(rewardBnb > 0, "No reward BNB");
      
      delete savedVersusRewardOf[msg.sender][_pool];
      payable(msg.sender).transfer(rewardBnb);
    }
    
    stakeOf[msg.sender][_pool].timeAt = block.timestamp;
  }

  /***
   * @dev Makes unstake.
   * @param _pool Pool id.
   */
  function unstake(Pool _pool) external whenNotPaused onlyUsablePool(_pool) {
    uint256 reward = calculateAvailableVersusReward(_pool);
    require(reward > 0, "No reward");

    withdrawAvailableReward(_pool);

    uint256 versusStake = stakeOf[msg.sender][_pool].amount;
    delete stakeOf[msg.sender][_pool];

    versusInPool[_pool] -= versusStake;

    IERC20(versusToken).transfer(msg.sender, versusStake);
  }

  /**
   * Pausable
   */

  /***
   * @dev Pauses or unpauses.
   * @param _isPause Whether should pause or unpause.
   */
  function pause(bool _isPause) external onlyOwner {
    _isPause ? _pause() : _unpause();
  }
}
