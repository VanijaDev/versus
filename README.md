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