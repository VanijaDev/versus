// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @notice Keep VERSUS allowance of owner for this Smart Contract enough to pay rewards.
 * @dev Staking Smart Contract for VersusLaunchpool.
 */
contract LaunchpoolStaking is Ownable, Pausable {
  struct Stake {
    uint256 timeAt; //  stake made at
    uint256 lockPeriodUntil;  //  timeAt + lockPeriod. Rewars will be calculated until this time.
  }

  uint256 constant SECONDS_IN_YEAR = 31536000;

  address public versusToken;
  uint256 public lockPeriod;

  uint256 public immutable stakeRequired;
  uint256 public apy;

  mapping(address => Stake) public stakeOf;

  event StakeMade(address indexed _from);
  event UnstakeMade(address indexed _from);
  event RewardWithdrawn(address indexed _to, uint256 indexed _amount);


  /***
   * @dev Constructor.
   * @param _versusToken VersusToken address.
   * @param _lockPeriod Lock period in seconds, during which stake cannt be unstaken.
   * @param _stakeRequired Stake amount to be made.
   */
  constructor(address _versusToken, uint256 _lockPeriod, uint256 _stakeRequired) {
    versusToken = _versusToken;
    lockPeriod = _lockPeriod;
    stakeRequired = _stakeRequired;
    
    apy = 0xFA;  //  250
  }

  /***
   * @dev Updates APY.
   * @param _apy APY value.
   */
  function updateAPY(uint256 _apy) external onlyOwner {
    apy = _apy;
  }

  /***
   * @dev Updates lockPeriod in seconds.
   * @param _lockPeriod Lock period in seconds.
   */
  function updateLockPeriod(uint256 _lockPeriod) external onlyOwner {
    lockPeriod = _lockPeriod;
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
   */
  function stake() external whenNotPaused {
    require(stakeOf[msg.sender].timeAt == 0, "Stake made");
    require(IERC20(versusToken).transferFrom(msg.sender, address(this), stakeRequired), "Transfer failed");

    stakeOf[msg.sender] = Stake(block.timestamp, block.timestamp + lockPeriod);

    emit StakeMade(msg.sender);
  }

  /***
   * @dev Calculates available VERSUS reward since stake made to date.
   * @return Available reward.
   */
  function calculateAvailableVersusReward() public view returns (uint256) {
    if (stakeOf[msg.sender].timeAt == 0) {
      return 0;
    }

    if (stakeOf[msg.sender].timeAt >= stakeOf[msg.sender].lockPeriodUntil) {
      return 0;
    }

    uint256 rewardPeriod;
    if (block.timestamp < stakeOf[msg.sender].lockPeriodUntil) {
      rewardPeriod = block.timestamp - stakeOf[msg.sender].timeAt;
    } else {
      rewardPeriod = stakeOf[msg.sender].lockPeriodUntil - stakeOf[msg.sender].timeAt;
    }
    
    uint256 percentagePerSec = (apy * 1 ether) / SECONDS_IN_YEAR;
    uint256 amount = ((stakeRequired * percentagePerSec) * rewardPeriod) / 100 ether;   //  ((2*10^18 * 9512937595129) * 12345) / (100 * 10^18) = 2348744292237350 wei == 0.2348744292237350 VERSUS. 100 ether = 1 ether & 100%
    return amount;
  }

  /***
   * @dev Withdraws available reward.
   */
  function withdrawAvailableReward() public whenNotPaused {
    uint256 versusReward = calculateAvailableVersusReward();
    require(versusReward > 0, "No reward");

    IERC20(versusToken).transferFrom(owner(), msg.sender, versusReward);
    
    stakeOf[msg.sender].timeAt = block.timestamp;

    emit RewardWithdrawn(msg.sender, versusReward);
  }

  /***
   * @dev Makes unstake.
   */
  function unstake() external whenNotPaused {
    require(stakeOf[msg.sender].timeAt > 0, "no stake");
    require(stakeOf[msg.sender].lockPeriodUntil < block.timestamp, "too early");

    if (calculateAvailableVersusReward() > 0) {
      withdrawAvailableReward();
    }
    delete stakeOf[msg.sender];

    IERC20(versusToken).transfer(msg.sender, stakeRequired);
    
    emit UnstakeMade(msg.sender);
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

