import { createConfig, mergeAbis, rateLimit, loadBalance } from "ponder";
import { http } from "viem";

import { AlchemistV2ImplAbi } from "./abis/AlchemistV2ImplAbi";
import { AlchemistV2ProxyAbi } from "./abis/AlchemistV2ProxyAbi";

export default createConfig({
  // Adjust rate limiting parameters if experiencing throttling
  // Consider using private or paid RPC endpoints for improved historical block synchronization
  networks: {
    mainnet: {
      chainId: 1,
      transport: loadBalance([
        rateLimit(http("https://rpc.ankr.com/eth"), {
          requestsPerSecond: 30,
        }),
        rateLimit(http("https://eth.drpc.org"), {
          requestsPerSecond: 30,
        }),
      ]),
    },
    arbitrum: {
      chainId: 42161,
      transport: loadBalance([
        rateLimit(http("https://rpc.ankr.com/arbitrum"), {
          requestsPerSecond: 30,
        }),
        rateLimit(http("https://arbitrum.drpc.org"), {
          requestsPerSecond: 30,
        }),
      ]),
    },
    optimism: {
      chainId: 10,
      transport: loadBalance([
        rateLimit(http("https://rpc.ankr.com/optimism"), {
          requestsPerSecond: 30,
        }),
        rateLimit(http("https://mainnet.optimism.io"), {
          requestsPerSecond: 10,
        }),
      ]),
    },
  },

  contracts: {
    AlchemistV2: {
      abi: mergeAbis([AlchemistV2ProxyAbi, AlchemistV2ImplAbi]),
      network: {
        mainnet: {
          address: [
            "0x5C6374a2ac4EBC38DeA0Fc1F8716e5Ea1AdD94dd",
            "0x062Bf725dC4cDF947aa79Ca2aaCCD4F385b13b5c",
          ],
          startBlock: 14265993,
        },
        arbitrum: {
          address: [
            "0xb46eE2E4165F629b4aBCE04B7Eb4237f951AC66F",
            "0x654e16a0b161b150F5d1C8a5ba6E7A7B7760703A",
          ],
          startBlock: 107216358,
        },
        optimism: {
          address: [
            "0x10294d57A419C8eb78C648372c5bAA27fD1484af",
            "0xe04Bb5B4de60FA2fBa69a93adE13A8B3B569d5B4",
          ],
          startBlock: 23165435,
        },
      },
    },
  },
});
