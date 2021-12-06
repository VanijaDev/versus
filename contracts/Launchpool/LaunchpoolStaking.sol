// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import "../interfaces/ILaunchpoolStaking.sol";

contract LaunchpoolStaking is ILaunchpoolStaking {
  mapping(address => uint256) private stakeOf;

  constructor()  {
  }

  /**
   * ILaunchpoolStaking
   */
  function getStakeOf(address _address) external view returns (uint256) {
    return stakeOf[_address];
  }
}
