// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract VersusToken is ERC20("VERSUS", "VERSUS") {
  constructor() {
    _mint(msg.sender, 2000000*(10**decimals()));
  }
}
