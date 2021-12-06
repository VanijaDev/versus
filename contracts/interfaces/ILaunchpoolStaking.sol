// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

interface ILaunchpoolStaking {
  /**
   * @dev Gets stake for address.
   * @param _address Address to check.
   * @return Stake amount.
   */
  function getStakeOf(address _address) external view  returns (uint256);
}
