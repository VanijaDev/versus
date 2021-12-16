# Versus

## Deployment flow (VersusToken, VersusStaking)
1. deploy VersusToken() Smart Contract
2. deploy VersusVoting(address _devFeeReceiver, address _versusToken) Smart Contract
```_devFeeReceiver```- address, that will receive dev fee
```_versusToken``` - VersusToken address
3. voters will get VERSUS as voting bonus, so mint substantial amount of Versus tokens to owner
4. call ```approve(address spender, uint256 amount)``` on VERSUS token.
```spender``` - VersusVoting address
```amount``` - max int or very big number


## Deployment flow (VersusAccessToken, VersusStakingAccess)
1. deploy VersusAccessToken() Smart Contract
2. deploy VersusStakingAccess(address _versusToken, address _versusAccessToken) Smart Contract
```_versusToken``` - VersusToken address
```_versusAccessToken```- VersusAccessToken address
3. call ```updateStakingAddress(address _versusStakingAccess)``` on VersusAccessToken token.
```_versusStakingAccess```- VersusStakingAccess address
4. distribute VersusAccessToken amoung users using ```mint(uint256 _amount,  address _receiver)```
```_amount``` - VersusAccessToken amount
```_receiver```- receiver address
5. approve VersusStakingAccess for VersusToken


## Deployment flow (LaunchpoolStaking)
1. deploy LaunchpoolStaking(address _versusToken, uint256 _lockPeriod, uint256 _stakeRequired) Smart Contract
```_versusToken``` - VersusToken address
```_lockPeriod``` - lock period
```_stakeRequired``` - stake amount
2. OWNER must approve LaunchpoolStaking for VersusToken
3. users must approve LaunchpoolStaking for VersusToken


## Deployment flow (VersusLaunchpool)
1. deploy VersusLaunchpool(address _depositToken, uint256 _maxCap, address _stakingPool, uint256 _allocationInvestorBase, uint256 _allocationInvestorPro) Smart Contract
```_depositToken``` - Token used for deposit
```_maxCap``` - Max cap amount
```_stakingPool``` - Staking pool address to check stakes
```_allocationInvestorBase``` - Allocation amount for Base investors
```_allocationInvestorPro``` - Allocation amount for Pro investors
2. users must approve VersusLaunchpool for VersusToken
