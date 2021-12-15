// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

contract Cappable {
  uint256 public maxCap;

  /***
   * @dev Constructor.
   * @param _maxCap Max cap amount.
   */
  constructor(uint256 _maxCap) {
    maxCap = _maxCap;
  }

  /***
   * @dev Updates maxCap.
   * @param _maxCap Max cap amount to be used.
   */
  function updateMaxCap(uint256 _maxCap) public virtual {
    maxCap = _maxCap;
  }
}
