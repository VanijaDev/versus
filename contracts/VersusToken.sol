// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract VersusToken is ERC20("VERSUS", "VERSUS"), Ownable {

  uint256 public constant MAX_SUPPLY = 0x1A784379D99DB42000000; //  2,000,000 * 10^18

  /***
    * @dev Mints amount to receiver.
    * @param _receiver Receiver address.
    * @param _amount Amount to be minted.
   */
  function mint(address _receiver, uint256 _amount) external onlyOwner {
    _mint(_receiver, _amount);
    require(totalSupply() <= MAX_SUPPLY, "Above max supply");
  }
}

