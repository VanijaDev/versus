// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import "@openzeppelin/contracts/access/Ownable.sol";

contract InvestorTyped is Ownable {
  enum InvestorType {
    Base,
    Pro,
    Priority
  }

  address[] private investorsBase;
  address[] private investorsPro;
  address[] private investorsPriority;

  mapping(address => uint256) private investorBaseIndexOf;
  mapping(address => uint256) private investorProIndexOf;
  mapping(address => uint256) private investorPriorityIndexOf;

  uint256 public allocationInvestorBase;  //  single amount for all investors.
  uint256 public allocationInvestorPro;  //  single amount for all investors.
  mapping(address => uint256) public allocationInvestorPriorityOf;  //  custom amount for each investor.


  /**
   * ADD INVESTORS
   */

  /**
   * @dev Adds investors to investorsBase.
   * @param _addresses Investor addresses.
   */
  function addInvestorsBase(address[] memory _addresses) external onlyOwner {
    for (uint256 i = 0; i < _addresses.length; i++) {
      require(!isInvestorOfAnyType(_addresses[i]), "already added");

      investorBaseIndexOf[_addresses[i]] = investorsBase.length;
      investorsBase.push(_addresses[i]);
    }
  }

  /**
   * @dev Adds investors to investorsPro.
   * @param _addresses Investor addresses.
   */
  function addInvestorsPro(address[] memory _addresses) external onlyOwner {
    for (uint256 i = 0; i < _addresses.length; i++) {
      require(!isInvestorOfAnyType(_addresses[i]), "already added");

      investorProIndexOf[_addresses[i]] = investorsPro.length;
      investorsPro.push(_addresses[i]);
    }
  }

  /**
   * @notice Each investor is being added separately.
   * @dev Adds investor to investorsPriority.
   * @param _address Investor address.
   * @param _allocation Allocation for the investor.
   */
  function addInvestorPriority(address _address, uint256 _allocation) external onlyOwner {
    require(!isInvestorOfAnyType(_address), "already added");

    investorPriorityIndexOf[_address] = investorsPriority.length;
    investorsPriority.push(_address);
    allocationInvestorPriorityOf[_address] = _allocation;
  }


  /**
   * REMOVE INVESTORS
   */

  /**
   * @dev Removes investor from investorsBase.
   * @param _address Investor address.
   */
  function removeInvestorBase(address _address) external onlyOwner {
    removeInvestor(InvestorType.Base, _address);
  }
  
  /**
   * @dev Removes investor from investorsPro.
   * @param _address Investor address.
   */
  function removeInvestorPro(address _address) external onlyOwner {
    removeInvestor(InvestorType.Pro, _address);
  }

  /**
   * @dev Removes investor from investorsPriority.
   * @param _address Investor address.
   */
  function removeInvestorPriority(address _address) external onlyOwner {
    removeInvestor(InvestorType.Priority, _address);
  }

  /**
   * @dev Removes investor.
   * @param _type Investor type.
   * @param _address Investor address.
   */
  function removeInvestor(InvestorType _type, address _address) private {
    if (_type == InvestorType.Base) {
      require(isInvestorBase(_address), "not Base");

      uint256 removeIdx = investorBaseIndexOf[_address];
      if (removeIdx < (investorsBase.length - 1)) {
        investorsBase[removeIdx] = investorsBase[investorsBase.length - 1];
      }
      investorsBase.pop();
      
      delete investorBaseIndexOf[_address];
    }
    else if (_type == InvestorType.Pro) {
      require(isInvestorPro(_address), "not Pro");

      uint256 removeIdx = investorProIndexOf[_address];
      if (removeIdx < (investorsPro.length - 1)) {
        investorsPro[removeIdx] = investorsPro[investorsBase.length - 1];
      }
      investorsPro.pop();

      delete investorProIndexOf[_address];
    }
    else if (_type == InvestorType.Priority) {
      require(isInvestorPriority(_address), "not Priority");

      uint256 removeIdx = investorPriorityIndexOf[_address];
      if (removeIdx < (investorsPriority.length - 1)) {
        investorsPriority[removeIdx] = investorsPriority[investorsBase.length - 1];
      }
      investorsPriority.pop();
      
      delete investorPriorityIndexOf[_address];
      delete allocationInvestorPriorityOf[_address];
    }
  }


  /**
   * @notice Use both _startIdx & _stopIdx equal to 0 if all investors are required.
   * @dev Gets investors array for type Base.
   * @param _startIdx Index to start in investorsBase.
   * @param _stopIdx Index to stop in investorsBase.
   * @return Array of investors.
   */
  function getInvestorsBase(uint256 _startIdx, uint256 _stopIdx) external view returns (address[] memory) {
    if (_startIdx == 0 && _stopIdx == 0) {
      return investorsBase;
    }

    require(_startIdx < investorsBase.length, "_startIdx out");
    require(_stopIdx < investorsBase.length, "_stopIdx out");
    require(_startIdx < _stopIdx, "indexes equal");

    uint256 length = _stopIdx - _startIdx + 1;
    address[] memory arr = new address[](length);

    for (uint256 i = _startIdx; i <= _stopIdx; i++) {
      arr[i] = investorsBase[i];
    }

    return arr;
  }

  /**
   * @notice Use both _startIdx & _stopIdx equal to 0 if all investors are required.
   * @dev Gets investors array for type Pro.
   * @param _startIdx Index to start in investorsBase.
   * @param _stopIdx Index to stop in investorsPro.
   * @return Array of investors.
   */
  function getInvestorsPro(uint256 _startIdx, uint256 _stopIdx) external view returns (address[] memory) {
    if (_startIdx == 0 && _stopIdx == 0) {
      return investorsPro;
    }

    require(_startIdx < investorsPro.length, "_startIdx out");
    require(_stopIdx < investorsPro.length, "_stopIdx out");
    require(_startIdx < _stopIdx, "indexes equal");

    uint256 length = _stopIdx - _startIdx + 1;
    address[] memory arr = new address[](length);

    for (uint256 i = _startIdx; i <= _stopIdx; i++) {
      arr[i] = investorsPro[i];
    }

    return arr;
  }

  /**
   * @notice Use both _startIdx & _stopIdx equal to 0 if all investors are required.
   * @dev Gets investors array for type Priority.
   * @param _startIdx Index to start in investorsPriority.
   * @param _stopIdx Index to stop in investorsPriority.
   * @return Array of investors.
   */
  function getInvestorsPriority(uint256 _startIdx, uint256 _stopIdx) external view returns (address[] memory) {
    if (_startIdx == 0 && _stopIdx == 0) {
      return investorsPriority;
    }

    require(_startIdx < investorsPriority.length, "_startIdx out");
    require(_stopIdx < investorsPriority.length, "_stopIdx out");
    require(_startIdx < _stopIdx, "indexes equal");

    uint256 length = _stopIdx - _startIdx + 1;
    address[] memory arr = new address[](length);

    for (uint256 i = _startIdx; i <= _stopIdx; i++) {
      arr[i] = investorsPriority[i];
    }

    return arr;
  }

  /**
   * @dev Checks wheter address is investor Base.
   * @param _address Address to check.
   * @return Wheter address is investor Base or not.
   */
  function isInvestorBase(address _address) public view returns (bool) {
    return investorsBase[investorBaseIndexOf[_address]] == _address;
  }

  /**
   * @dev Checks wheter address is investor Pro.
   * @param _address Address to check.
   * @return Wheter address is investor Pro or not.
   */
  function isInvestorPro(address _address) public view returns (bool) {
    return investorsPro[investorProIndexOf[_address]] == _address;
  }

  /**
   * @dev Checks wheter address is investor Priority.
   * @param _address Address to check.
   * @return Wheter address is investor Priority or not.
   */
  function isInvestorPriority(address _address) public view returns (bool) {
    return investorsPriority[investorPriorityIndexOf[_address]] == _address;
  }

  /**
   * @dev Checks wheter address is investor of any type.
   * @param _address Address to check.
   * @return Wheter address is investor of any type or not.
   */
   function isInvestorOfAnyType(address _address) public view returns (bool) {
     if (isInvestorBase(_address) || isInvestorPro(_address) || isInvestorPriority(_address)) {
       return true;
     }

     return false;
   }

  /**
   * @dev Gets type name of investor. Empty string is returned is not investor.
   * @param _address Address to check.
   * @return Investor type name.
   */
  function typeNameOfInvestorFor(address _address) external view returns (string memory) {
    if (isInvestorBase(_address)) {
      return "Base";
    }

    if (isInvestorPro(_address)) {
      return "Pro";
    }

    if (isInvestorPriority(_address)) {
      return "Priority";
    }

    return "";
  }
}
