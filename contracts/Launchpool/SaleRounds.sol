// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @notice There can be two rounds: Private & Public. Private is set by default (isPublicSale == false).
 */
contract SaleRounds is Ownable {
  bool public isPublicSale;


  /**
   * @dev Toggles between private / public sale round.
   * @param _enable Whether enable or disable public sale.
   */
  function enablePublicSale(bool _enable) external onlyOwner {
    isPublicSale = _enable;
  }
}
