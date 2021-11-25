// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/IVersusStakingAccess.sol";

/**
 * @dev Staking Smart Contract.
 * @notice VERSUS - VERSUS. Accounts with VersusAccessToken can access.
 */
contract VersusStakingAccess is Ownable, Pausable, IVersusStakingAccess {
  struct Stake {
    uint256 timeAt;
    uint256 amount;
  }

  uint256 constant SECONDS_IN_YEAR = 31536000;

  address public versusToken;
  address public versusAccessToken;

  uint256 public minStake;      //  min single stake
  uint256 public minTotalStake; //  total stake for address can not be less than this amount
  uint256 public maxTotalStake; //  total stake for address can not be exceed than this amount
  uint256 public apy;

  mapping(address => Stake) private stakeOf;
  mapping(address => uint256) private savedVersusRewardOf;

  event StakeMade(address _from, uint256 _amount);
  event UnstakeMade(address _from, uint256 _amount);
  event RewardWithdrawn(address _to, uint256 _amount);


  /***
   * @dev Constructor.
   * @param _versusToken VersusToken address.
   * @param _versusAccessToken VersusAccessToken address.
   */
  constructor(address _versusToken, address _versusAccessToken) {
    versusToken = _versusToken;
    versusAccessToken = _versusAccessToken;
    
    minStake = 0x16345785D8A0000;         //  0.1 * 10^18 VERSUS
    minTotalStake = 0x3635C9ADC5DEA00000; // 1000 * 10^18 VERSUS
    maxTotalStake = 0xA2A15D09519BE00000; // 3000 * 10^18 VERSUS
    
    apy = 0x1F4;  //  500
  }

  /***
   * @dev Updates minimum stake amount.
   * @notice This amount applies after minTotalStake is reached.
   * @param _minStake Minimum stake amount.
   */
  function updateMinStake(uint256 _minStake) external onlyOwner {
    minStake = _minStake;
  }

  /***
   * @dev Updates minimum total stake amount.
   * @param _minTotalStake Minimum total stake amount.
   */
  function updateMinTotalStake(uint256 _minTotalStake) external onlyOwner {
    minTotalStake = _minTotalStake;
  }

  /***
   * @dev Updates maximum total stake amount.
   * @param _maxTotalStake Maximum total stake amount.
   */
  function updateMaxTotalStake(uint256 _maxTotalStake) external onlyOwner {
    maxTotalStake = _maxTotalStake;
  }

  /***
   * @dev Updates APY.
   * @param _apy APY value.
   */
  function updateAPY(uint256 _apy) external onlyOwner {
    apy = _apy;
  }

  /***
   * @dev Gets stake for user.
   * @param _address User address.
   */
  function getStakeOf(address _address) external view returns (Stake memory) {
    return stakeOf[_address];
  }

  /***
   * @dev Gets saved VERSUS reward for user.
   * @param _address User address.
   */
  function getSavedVersusRewardOf(address _address) external view returns (uint256) {
    return savedVersusRewardOf[_address];
  }

  /***
   * @dev Gets VERSUS balance for this Smart Contract.
   * @return VERSUS balance.
   */
  function getVersusBalance() external view returns (uint256) {
    return IERC20(versusToken).balanceOf(address(this));
  }

  /***
   * @dev Makes stake.
   * @notice Pending reward will be saved & Stake updated.
   * @param _amount Stake amount.
   */
  function stake(uint256 _amount) external whenNotPaused {
    require(IERC20(versusAccessToken).balanceOf(msg.sender) > 0, "No access");

    if (stakeOf[msg.sender].amount == 0) {
      require(_amount >= minTotalStake, "< minTotalStake");
    } else {
      require(_amount >= minStake, "Wrong amount");
    }
    require(stakeOf[msg.sender].amount + _amount <= maxTotalStake, "> maxTotalStake");

    _updateSavedVersusReward();

    stakeOf[msg.sender].timeAt = block.timestamp;
    stakeOf[msg.sender].amount += _amount;

    IERC20(versusToken).transferFrom(msg.sender, address(this), _amount);

    emit StakeMade(msg.sender, _amount);
  }

  /***
   * @dev Calculates pending VERSUS reward to date and saves it.
   */
  function _updateSavedVersusReward() private {
    uint256 pendingReward = _calculatePendingVersusReward(msg.sender);
    if (pendingReward > 0) {
      savedVersusRewardOf[msg.sender] += pendingReward;
    }
  }

  /***
   * @dev Calculates pending VERSUS reward since stake "timeAt" to date.
   * @param _from Address to calculate.
   * @return Pending reward.
   */
  function _calculatePendingVersusReward(address _from) private view returns (uint256) {
    if (stakeOf[_from].timeAt == 0) {
      return 0;
    }

    uint256 timeSinceStake = block.timestamp - stakeOf[_from].timeAt;
    uint256 percentagePerSec = (apy * 1 ether) / SECONDS_IN_YEAR;
    uint256 amount = ((stakeOf[_from].amount * percentagePerSec) * timeSinceStake) / 100 ether;   //  ((2*10^18 * 9512937595129) * 12345) / (100 * 10^18) = 2348744292237350 wei == 0.2348744292237350 VERSUS. 100 ether = 1 ether & 100%
    return amount;
  }

  /***
   * @dev Calculates sum of savedVersusRewardOf & _calculatePendingVersusReward.
   * @return Pending reward.
   */
  function calculateAvailableVersusReward() external view returns (uint256) {
    return _calculateAvailableVersusReward(msg.sender);
  }

  /***
   * @dev Calculates sum of savedVersusRewardOf & _calculatePendingVersusReward implementation.
   * @param _from Address to calculate.
   * @return Pending reward.
   */
  function _calculateAvailableVersusReward(address _from) private view returns (uint256) {
    return savedVersusRewardOf[_from] + _calculatePendingVersusReward(_from);
  }

  /***
   * @dev Withdraws available reward.
   */
  function withdrawAvailableReward() external {
    _withdrawAvailableReward(msg.sender);
  }

  /***
   * @dev Withdraws available reward implementation.
   * @param _from Address to unstake.
   */
  function _withdrawAvailableReward(address _from) private whenNotPaused {
    uint256 versusReward = _calculateAvailableVersusReward(_from);
    require(versusReward > 0, "No reward");
    
    delete savedVersusRewardOf[_from];
    IERC20(versusToken).transferFrom(owner(), _from, versusReward);
    
    stakeOf[_from].timeAt = block.timestamp;

    emit RewardWithdrawn(_from, versusReward);
  }

  /***
   * @dev Makes unstake.
   */
  function unstake() external {
    _unstake(msg.sender);
  }

  /***
   * @dev Makes unstake implementation.
   * @param _from Address to unstake.
   */
  function _unstake(address _from) private whenNotPaused {
    _withdrawAvailableReward(_from);

    uint256 versusStake = stakeOf[_from].amount;
    delete stakeOf[_from];

    IERC20(versusToken).transfer(_from, (versusStake));
    
    emit UnstakeMade(_from, versusStake);
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

  /***
   * IVersusStakingAccess
   */
  function onLastTokenTransfer(address _from) external {
    require(msg.sender == versusAccessToken, "Wrong sender");

    if (stakeOf[_from].timeAt != 0) {
      _unstake(_from);
    }
  }
}
