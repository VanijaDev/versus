# Versus
## Deployment flow
1. deploy VersusToken Smart Contract
2. deploy VersusVoting(address _devFeeReceiver, address _versusToken) Smart Contract
- ```_devFeeReceiver```- address, that will receive dev fee
- ```_versusToken``` - VersusToken address
3. voters will get VERSUS as voting bonus, so mint substantial amount of Versus tokens to owner
- call ```approve(address spender, uint256 amount)``` on VERSUS token.
* ```spender``` - VersusVoting address
* ```amount``` - max int or very big number
