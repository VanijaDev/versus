// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import "./uniswap/UniswapV2Pair.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

contract VersusConvertor {
  address public pair_Versus_BUSD;
  address public pair_BUSD_BNB;

  /**
   * @dev Constructor.
   * @param _pair_Versus_BUSD Address of pair VERSUS - BUSD.
   */
  constructor(address _pair_Versus_BUSD) {
    pair_Versus_BUSD = _pair_Versus_BUSD;
    pair_BUSD_BNB = address(0x58F876857a02D6762E0101bb5C46A8c1ED44Dc16);
  }

  /**
   * @dev Converts VERSUS to BNB.
   * @param _amount VERSUS amount to be converted.
   * @return BNB amount.
   */
  function convertVersusToBnb(uint256 _amount) external view returns(uint256) {
    if (_amount == 0) {
      return 0;
    }

    uint256 amount_BUSD = getTokenPrice_Versus_BUSD(pair_Versus_BUSD, _amount);
    uint256 amount_bnb = getTokenPrice_BUSD_BNB(pair_BUSD_BNB, amount_BUSD);
    return amount_bnb;
  }

  /**
   * @dev Gets token price Versus -> BUSD.
   * @param _pairAddress Pair address.
   * @param _amount Amount to be converted from.
   */
  function getTokenPrice_Versus_BUSD(address _pairAddress, uint _amount) public view returns(uint) {
    IUniswapV2Pair pair = IUniswapV2Pair(_pairAddress);
    (uint Res0, uint Res1,) = pair.getReserves();

    uint res1 = Res1;
    return (((_amount * res1) / Res0)); // return amount of token0 needed to buy token1
   }

   /**
   * @dev Gets token price BUSD -> BNB.
   * @param _pairAddress Pair address.
   * @param _amount Amount to be converted from.
   */
  function getTokenPrice_BUSD_BNB(address _pairAddress, uint _amount) public view returns(uint) {
    IUniswapV2Pair pair = IUniswapV2Pair(_pairAddress);
    (uint Res0, uint Res1,) = pair.getReserves();

    uint res0 = Res0;
    return((_amount * res0) / Res1); // return amount of token0 needed to buy token1
   }
}
