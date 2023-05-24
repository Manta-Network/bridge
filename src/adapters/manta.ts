import { Storage } from "@acala-network/sdk/utils/storage";
import { AnyApi, FixedPointNumber as FN } from "@acala-network/sdk-core";
import { combineLatest, map, Observable } from "rxjs";

import { SubmittableExtrinsic } from "@polkadot/api/types";
import { DeriveBalancesAll } from "@polkadot/api-derive/balances/types";
import { ISubmittableResult } from "@polkadot/types/types";

import { BalanceAdapter, BalanceAdapterConfigs } from "../balance-adapter";
import { BaseCrossChainAdapter } from "../base-chain-adapter";
import { ChainId, chains } from "../configs";
import { ApiNotFound, TokenNotFound } from "../errors";
import {
  BalanceData,
  BasicToken,
  RouteConfigs,
  TransferParams,
} from "../types";
import { isChainEqual } from "../utils/is-chain-equal";

const DEST_WEIGHT = "5000000000";

export const calamariRoutersConfig: Omit<RouteConfigs, "from">[] = [
  {
    to: "karura",
    token: "KMA",
    xcm: {
      fee: { token: "KMA", amount: "6400000000" },
      weightLimit: DEST_WEIGHT,
    },
  },
  {
    to: "karura",
    token: "KUSD",
    xcm: {
      fee: { token: "KUSD", amount: "6381112603" },
      weightLimit: DEST_WEIGHT,
    },
  },
  {
    to: "karura",
    token: "KAR",
    xcm: {
      fee: { token: "KAR", amount: "6400000000" },
      weightLimit: DEST_WEIGHT,
    },
  },
  {
    to: "karura",
    token: "USDT",
    xcm: {
      fee: { token: "USDT", amount: "808" },
      weightLimit: DEST_WEIGHT,
    },
  },
  {
    to: "karura",
    token: "LKSM",
    xcm: {
      fee: { token: "LKSM", amount: "452334406" },
      weightLimit: DEST_WEIGHT,
    },
  },
  {
    to: "karura",
    token: "KSM",
    xcm: {
      fee: { token: "KSM", amount: "54632622" },
      weightLimit: DEST_WEIGHT,
    },
  },
  {
    to: "karura",
    token: "DAI",
    xcm: {
      fee: { token: "DAI", amount: "808240000000000" },
      weightLimit: DEST_WEIGHT,
    },
  },
  {
    to: "karura",
    token: "USDCet",
    xcm: {
      fee: { token: "USDCet", amount: "808" },
      weightLimit: DEST_WEIGHT,
    },
  },
  {
    to: "karura",
    token: "WBTC",
    xcm: {
      fee: { token: "WBTC", amount: "2" },
      weightLimit: DEST_WEIGHT,
    },
  },
  {
    to: "karura",
    token: "WETH",
    xcm: {
      fee: { token: "WETH", amount: "449022222222" },
      weightLimit: DEST_WEIGHT,
    },
  },
  {
    to: "karura",
    token: "BNB",
    xcm: {
      fee: { token: "BNB", amount: "3232960000000" },
      weightLimit: DEST_WEIGHT,
    },
  },
  {
    to: "karura",
    token: "BUSD",
    xcm: {
      fee: { token: "BUSD", amount: "808240000000000" },
      weightLimit: DEST_WEIGHT,
    },
  },
  {
    to: "karura",
    token: "ARB",
    xcm: {
      fee: { token: "ARB", amount: "727416000000000" },
      weightLimit: DEST_WEIGHT,
    },
  },
  {
    to: "kusama",
    token: "KSM",
    xcm: {
      fee: { token: "KSM", amount: "90287436" },
      weightLimit: DEST_WEIGHT,
    },
  },
  {
    to: "moonriver",
    token: "MOVR",
    xcm: {
      fee: { token: "MOVR", amount: "23356409465885" },
      weightLimit: DEST_WEIGHT,
    },
  },
  {
    to: "statemine",
    token: "USDT",
    xcm: {
      fee: { token: "USDT", amount: "1183" },
      weightLimit: DEST_WEIGHT,
    },
  }
];

export const calamariTokensConfig: Record<string, BasicToken> = {
  KMA: { name: "KMA", symbol: "KMA", decimals: 12, ed: "100000000000" },
  KAR: { name: "KAR", symbol: "KAR", decimals: 12, ed: "100000000000" },
  KUSD: { name: "KUSD", symbol: "KUSD", decimals: 12, ed: "10000000000" },
  LKSM: { name: "LKSM", symbol: "LKSM", decimals: 12, ed: "500000000" },
  KSM: { name: "KSM", symbol: "KSM", decimals: 12, ed: "100000000" },
  MOVR: { name: "MOVR", symbol: "MOVR", decimals: 18, ed: "100000000000000000" },
  USDT: { name: "USDT", symbol: "USDT", decimals: 6, ed: "10000" },
  DAI: { name: "DAI", symbol: "DAI", decimals: 18, ed: "10000000000000000" },
  USDCet: { name: "USDCet", symbol: "USDCet", decimals: 6, ed: "10000" },
  WETH: { name: "WETH", symbol: "WETH", decimals: 18, ed: "5555555555555" },
  WBTC: { name: "WBTC", symbol: "WBTC", decimals: 8, ed: "35" },
  BNB: { name: "BNB", symbol: "BNB", decimals: 18, ed: "40000000000000" },
  BUSD: { name: "BUSD", symbol: "BUSD", decimals: 18, ed: "10000000000000000" },
  ARB: { name: "ARB", symbol: "ARB", decimals: 18, ed: "9000000000000000"},
};

const SUPPORTED_TOKENS: Record<string, number> = {
  KMA: 1,
  KAR: 8,
  KUSD: 9,
  LKSM: 10,
  MOVR: 11,
  KSM: 12,
  USDT: 14,
  DAI: 15,
  USDCet: 16,
  ARB: 17,
  BNB: 21,
  BUSD: 23,
  WBTC: 26,
  WETH: 27
};

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
const createBalanceStorages = (api: AnyApi) => {
  return {
    balances: (address: string) =>
      Storage.create<DeriveBalancesAll>({
        api,
        path: "derive.balances.all",
        params: [address],
      }),
    assets: (id: number, address: string) =>
      Storage.create<any>({
        api,
        path: "query.assets.account",
        params: [id, address],
      }),
  };
};

class MantaBalanceAdapter extends BalanceAdapter {
  private storages: ReturnType<typeof createBalanceStorages>;

  constructor({ api, chain, tokens }: BalanceAdapterConfigs) {
    super({ api, chain, tokens });
    this.storages = createBalanceStorages(api);
  }

  public subscribeBalance(
    token: string,
    address: string
  ): Observable<BalanceData> {
    const storage = this.storages.balances(address);

    if (token === this.nativeToken) {
      return storage.observable.pipe(
        map((data) => ({
          free: FN.fromInner(data.freeBalance.toString(), this.decimals),
          locked: FN.fromInner(data.lockedBalance.toString(), this.decimals),
          reserved: FN.fromInner(
            data.reservedBalance.toString(),
            this.decimals
          ),
          available: FN.fromInner(
            data.availableBalance.toString(),
            this.decimals
          ),
        }))
      );
    }

    const tokenID = SUPPORTED_TOKENS[token];

    if (tokenID === undefined) {
      throw new TokenNotFound(token);
    }

    return this.storages.assets(tokenID, address).observable.pipe(
      map((balance) => {
        const amount = FN.fromInner(
          balance.unwrapOrDefault()?.balance?.toString() || "0",
          this.getToken(token).decimals
        );

        return {
          free: amount,
          locked: new FN(0),
          reserved: new FN(0),
          available: amount,
        };
      })
    );
  }
}

class BaseMantaAdapter extends BaseCrossChainAdapter {
  private balanceAdapter?: MantaBalanceAdapter;

  public async init(api: AnyApi) {
    this.api = api;

    await api.isReady;

    this.balanceAdapter = new MantaBalanceAdapter({
      chain: this.chain.id as ChainId,
      api,
      tokens: calamariTokensConfig,
    });
  }

  public subscribeTokenBalance(
    token: string,
    address: string
  ): Observable<BalanceData> {
    if (!this.balanceAdapter) {
      throw new ApiNotFound(this.chain.id);
    }

    return this.balanceAdapter.subscribeBalance(token, address);
  }

  public subscribeMaxInput(
    token: string,
    address: string,
    to: ChainId
  ): Observable<FN> {
    if (!this.balanceAdapter) {
      throw new ApiNotFound(this.chain.id);
    }

    return combineLatest({
      txFee:
        token === this.balanceAdapter?.nativeToken
          ? this.estimateTxFee({
              amount: FN.ZERO,
              to,
              token,
              address,
              signer: address,
            })
          : "0",
      balance: this.balanceAdapter
        .subscribeBalance(token, address)
        .pipe(map((i) => i.available)),
    }).pipe(
      map(({ balance, txFee }) => {
        const tokenMeta = this.balanceAdapter?.getToken(token);
        const feeFactor = 1.2;
        const fee = FN.fromInner(txFee, tokenMeta?.decimals).mul(
          new FN(feeFactor)
        );
        // always minus ed
        return balance
          .minus(fee)
          .minus(FN.fromInner(tokenMeta?.ed || "0", tokenMeta?.decimals));
      })
    );
  }

  public createTx(
    params: TransferParams
  ):
    | SubmittableExtrinsic<"promise", ISubmittableResult>
    | SubmittableExtrinsic<"rxjs", ISubmittableResult> {
    if (this.api === undefined) {
      throw new ApiNotFound(this.chain.id);
    }

    const { address, amount, to, token } = params;
    const toChain = chains[to];


    const tokenId = SUPPORTED_TOKENS[token];

    if (tokenId === undefined) {
      throw new TokenNotFound(token);
    }

    let dst: any;
    if (
      isChainEqual(toChain, "moonriver") ||
      isChainEqual(toChain, "moonbeam")
    ) {
      dst = {
        parents: 1,
        interior: {
          X2: [
            { Parachain: toChain.paraChainId },
            { AccountKey20: { key: address, network: "Any" } },
          ],
        },
      };
    } else if (isChainEqual(toChain, "kusama") || isChainEqual(toChain, "polkadot")) {
      const accountId = this.api?.createType("AccountId32", address).toHex();
      dst = {
        parents: 1,
        interior: { X1: { AccountId32: { id: accountId, network: "Any" } } },
      };
    } else {
      const accountId = this.api?.createType("AccountId32", address).toHex();
      dst = {
        parents: 1,
        interior: {
          X2: [
            { Parachain: toChain.paraChainId },
            { AccountId32: { id: accountId, network: "Any" } },
          ],
        },
      };
    }
    return this.api?.tx.xTokens.transfer(
      { MantaCurrency: tokenId },
      amount.toChainData(),
      {
        V1: dst
      },
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      this.getDestWeight(token, to)!.toString()
    );
  }
}

export class CalamariAdapter extends BaseMantaAdapter {
  constructor() {
    super(chains.calamari, calamariRoutersConfig, calamariTokensConfig);
  }
}
