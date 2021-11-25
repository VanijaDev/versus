// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

interface IVersusStakingAccess {

  /**
   * @dev Gets called when last token is transferred by transfer & transferFrom.
   * @param _from Address, that transfers from.
   */
  function onLastTokenTransfer(address _from) external;
}
