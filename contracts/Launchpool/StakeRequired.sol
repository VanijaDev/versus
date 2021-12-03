// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import "@openzeppelin/contracts/access/Ownable.sol";

contract StakeRequired is Ownable {
  address public stakingPool;
  uint256 public stakeRequired;

  /**
   * @dev Constructor.
   * @param _stakingPool Staking pool address to check stakes.
   * @param _stakeRequired Stake in staking pool required to make deposit.
   */
  constructor(address _stakingPool, uint256 _stakeRequired) {
    stakingPool = _stakingPool;
    stakeRequired = _stakeRequired;
  }

  /**
   * @dev Updates staking pool address.
   * @param _stakingPool Staking pool address to check stakes.
   */
  function updateStakingPool(address _stakingPool) external onlyOwner {
    stakingPool = _stakingPool;
  }

  /**
   * @dev Updates stake in staking required to make deposit.
   * @param _stakeRequired Stake in staking pool required to make deposit.
   */
  function updateStakeRequired(uint256 _stakeRequired) external onlyOwner {
    stakeRequired = _stakeRequired;
  }

  /**
   * @dev Checks whether required stake is made.
   * @param _address Address to check stake for.
   * @return Whether required stake is made or not.
   */
  function isStakeRequiredMadeFor(address _address) public view returns (bool) {
    // TODO: check if stake is made
    return true;
  }
}
