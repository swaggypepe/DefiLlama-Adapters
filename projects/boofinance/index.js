const sdk = require("@defillama/sdk");
const abi = require("./abi.json");
const token0Abi = 'address:token0'
const token1Abi = 'address:token1'
const { unwrapUniswapLPs } = require("../helper/unwrapLPs");
const { staking } = require("../helper/staking");
const BigNumber = require("bignumber.js");

const boofi = "0xb00f1ad977a949a3ccc389ca1d1282a2946963b0";
const stakingAddress = "0x67712c62d1DEAEbDeF7401E59a9E34422e2Ea87c";
const hauntedHouse = "0xB178bD23876Dd9f8aA60E7FdB0A2209Fe2D7a9AB";

const transform = {
  "0x4f60a160d8c2dddaafe16fcc57566db84d674bd6": "harmony:0x72cb10c6bfa5624dd07ef608027e366bd690048f",
  "0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e": "avax:0xa7d7079b0fead91f3e65f86e8915cb59c1a4c664"
}

const joe = "0x6e84a6216ea6dacc71ee8e6b0a5b7322eebc0fdd";
const xjoe = "0x57319d41f71e81f3c65f2a47ca4e001ebafd4f33";

async function calcTvl(block, chain, pool2, api) {
  let balances = {};
  const tokenList = (await api.call({ target: hauntedHouse, abi: abi.tokenList, }));
  const tokenBalances = (await api.multiCall({ target: hauntedHouse, calls: tokenList, abi: abi.tokenParameters, }));
  const symbols = (await api.multiCall({ calls: tokenList, abi: "erc20:symbol", }));
  const token0Address = (await api.multiCall({ calls: tokenList, abi: token0Abi, permitFailure: true, }));
  const token1Address = (await api.multiCall({ calls: tokenList, abi: token1Abi, permitFailure: true, }));

  let lpPositions = [];
  for (let i = 0; i < tokenList.length; i++) {
    let token = tokenList[i].toLowerCase();
    let balance = tokenBalances[i].totalShares;
    let symbol = symbols[i];
    let token0 = token0Address[i] ?? '';
    let token1 = token1Address[i] ?? '';
    if (token === boofi) continue;
    if (pool2 && !symbol.endsWith("LP") && !symbol.endsWith("PGL")) continue;
    if (!symbol.endsWith("LP") && !symbol.endsWith("PGL")) {
      if (token === xjoe) {
        const joeBalance = (await api.call({ target: joe, params: xjoe, abi: 'erc20:balanceOf' }))
        const xJoeSupply = (await api.call({ target: xjoe, abi: 'erc20:totalSupply' }))
        sdk.util.sumSingleBalance(balances, `avax:${joe}`, balance * joeBalance / xJoeSupply);
        continue;
      }
      if (transform[token] !== undefined) {
        token = transform[token];
        sdk.util.sumSingleBalance(balances, token, balance);
        continue;
      }
      sdk.util.sumSingleBalance(balances, `${chain}:${token}`, balance);
      continue;
    }
    token0 = token0.toLowerCase();
    token1 = token1.toLowerCase();
    if (pool2) {
      if (token0 !== boofi && token1 !== boofi) continue;
    }
    else if (!pool2) {
      if (token0 === boofi || token1 === boofi) continue;
    }
    lpPositions.push({
      token,
      balance
    });
  }
  await unwrapUniswapLPs(balances, lpPositions, block, chain, addr => {
    addr = addr.toLowerCase();
    if (transform[addr] !== undefined) {
      return transform[addr];
    }
    return `avax:${addr}`;
  })
  return balances;
}

async function tvl(timestamp, block, chainBlocks, { api }) {
  return await calcTvl(chainBlocks.avax, "avax", false, api);
}

async function pool2(timestamp, block, chainBlocks, { api }) {
  return await calcTvl(chainBlocks.avax, "avax", true, api);
}

module.exports = {
  avax: {
    tvl,
    pool2,
    staking: staking(stakingAddress, boofi, "avax")
  }
}