// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import "./LaunchpoolStaking.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract StakeRequired is Ownable {
  address public stakingPool;

  /***
   * @dev Constructor.
   * @param _stakingPool Staking pool address to check stakes.
   */
  constructor(address _stakingPool) {
    stakingPool = _stakingPool;
  }

  /***
   * @dev Updates staking pool address.
   * @param _stakingPool Staking pool address to check stakes.
   */
  function updateStakingPool(address _stakingPool) external onlyOwner {
    stakingPool = _stakingPool;
  }

  /***
   * @dev Checks whether required stake is made. It should be true only during lock period.
   * @param _address Address to check stake for.
   * @return Whether required stake is made or not.
   */
  function isStakeRequiredMadeFor(address _address) public view returns (bool) {
    (, uint256 lockPeriodUntil) = LaunchpoolStaking(stakingPool).stakeOf(_address);
    return (lockPeriodUntil > 0 && lockPeriodUntil > block.timestamp);
  }
}
