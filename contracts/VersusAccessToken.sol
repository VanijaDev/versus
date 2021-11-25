// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IVersusStakingAccess.sol";

contract VersusAccessToken is ERC20("Versus Access", "aVERSUS"), Ownable {

  uint256 public constant MAX_SUPPLY = 0xC8;  // 200

  address public stakingAddress;

  /***
    * @dev Updates stakingAddress.
    * @param _stakingAddress Staking Smart Contract address to be used.
   */
  function updateStakingAddress(address _stakingAddress) external onlyOwner {
    stakingAddress = _stakingAddress;
  }

  /***
    * @dev Mints tokens to receiver.
    * @param _receiver Receiver address.
    * @param _amount Amount to mint.
   */
  function mint(uint256 _amount,  address _receiver) external onlyOwner {
    require(totalSupply() + _amount <= MAX_SUPPLY, "Above max supply");
    _mint(_receiver, _amount);
  }

  /**
   * ERC20
   */

   /***
    * @dev Transfers token & unstakes if token balance == 0.
    */
  function transfer(address recipient, uint256 amount) public virtual override returns (bool) {
    require(stakingAddress != address(0), "No stakingAddress");

    bool res = super.transfer(recipient, amount);

    if (res && amount > 0 && balanceOf(msg.sender) == 0) {
      IVersusStakingAccess(stakingAddress).onLastTokenTransfer(msg.sender);
    }

    return res;
  }

  /***
    * @dev Transfers token & unstakes if token balance == 0.
    */
  function transferFrom(address sender, address recipient, uint256 amount) public virtual override returns (bool) {
    require(stakingAddress != address(0), "No stakingAddress");

    bool res = super.transferFrom(sender, recipient, amount);
    
    if (res && amount > 0 && balanceOf(sender) == 0) {
      IVersusStakingAccess(stakingAddress).onLastTokenTransfer(sender);
    }

    return res;
  }

  /***
   * ERC20Metadata
   */
  function decimals() public view virtual override returns (uint8) {
    return 0;
  }
}