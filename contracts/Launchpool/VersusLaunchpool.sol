// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import "@openzeppelin/contracts/security/Pausable.sol";
import "./Cappable.sol";
import "./SaleRounds.sol";
import "./StakeRequired.sol";

contract VersusLaunchpool is Pausable, Cappable, SaleRounds, StakeRequired {
  address public depositToken;
  uint256 public depositsTotal;
  
  mapping(address => uint256) public depositOf;


  /**
   * @dev Constructor.
   * @param _depositToken Token used for deposit.
   * @param _stakingPool Staking pool address to check stakes.
   * @param _stakeRequired Stake in staking pool required to make deposit.
   * @param _maxCap Max cap amount.
   */
  constructor(address _depositToken, uint256 _maxCap, address _stakingPool, uint256 _stakeRequired)
    Cappable(_maxCap)
    StakeRequired(_stakingPool, _stakeRequired) {
      depositToken = _depositToken;
  }


  /**
   * Cappable
   */
  function updateMaxCap(uint256 _maxCap) public override onlyOwner {
    require(depositsTotal <= _maxCap, "Wrong maxCap");
    super.updateMaxCap(_maxCap);
  }


  /**
   * @dev Makes deposit.
   */
  function deposit() external whenNotPaused {
    //  require(depositsTotal + 111 <= maxCap, "Cap reached");
    //  check _isPublicSale_


  }

}
