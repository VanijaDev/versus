// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import "./Cappable.sol";
import "./SaleRounds.sol";
import "./StakeRequired.sol";
import "./InvestorTyped.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract VersusLaunchpool is Pausable, Cappable, SaleRounds, StakeRequired, InvestorTyped {
  address public depositToken;
  uint256 public depositsTotal;
  
  mapping(address => uint256) public depositOf;


  /***
   * @dev Constructor.
   * @param _depositToken Token used for deposit.
   * @param _stakingPool Staking pool address to check stakes.
   * @param _maxCap Max cap amount.
   * @param _allocationInvestorBase Allocation amount for Base investors.
   * @param _allocationInvestorPro Allocation amount for Pro investors.
   */
  constructor(address _depositToken, uint256 _maxCap, address _stakingPool, uint256 _allocationInvestorBase, uint256 _allocationInvestorPro)
    Cappable(_maxCap)
    StakeRequired(_stakingPool)
    InvestorTyped(_allocationInvestorBase, _allocationInvestorPro) {
      depositToken = _depositToken;
  }


  /***
   * Cappable
   */
  function updateMaxCap(uint256 _maxCap) public override onlyOwner {
    require(depositsTotal <= _maxCap, "Wrong maxCap");
    super.updateMaxCap(_maxCap);
  }


  /***
   * @dev Makes deposit.
   */
  function deposit() external whenNotPaused {
    uint256 allocation = allocationInvestorBase;
    if (!isPublicSale) {
      allocation = allocationFor(msg.sender);
      require(allocation > 0, "not allowed investor");

      if (isInvestorBase(msg.sender)) {
        require(isStakeRequiredMadeFor(msg.sender), "pool stake required");
      }
    } else {
      if (!isInvestorPro(msg.sender) && !isInvestorPriority(msg.sender)) {
        require(isStakeRequiredMadeFor(msg.sender), "pool stake required");
      }
    }

    require(depositOf[msg.sender] == 0, "deposit made");
    require(IERC20(depositToken).balanceOf(msg.sender) >= allocation, "not enough balance");
    require((depositsTotal + allocation) <= maxCap, "Max cap reached");

    IERC20(depositToken).transferFrom(msg.sender, address(this), allocation);

    depositsTotal += allocation;
    depositOf[msg.sender] = allocation;
  }

   /***
    * @dev Withdraws all deposits.
    * @param _receiver Receiver address.
    */
  function withdrawAllDeposits(address _receiver) external onlyOwner {
    IERC20(depositToken).transfer(_receiver, depositsTotal);
  }

  /**
   * Pausable
   */

  /***
   * @dev Pauses or unpauses.
   * @param _isPause Whether should pause or unpause.
   */
  function pause(bool _isPause) external onlyOwner {
    _isPause ? _pause() : _unpause();
  }
}
