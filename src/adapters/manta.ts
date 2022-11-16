import { Storage } from "@acala-network/sdk/utils/storage";
import { AnyApi, FixedPointNumber as FN } from "@acala-network/sdk-core";
import { combineLatest, map, Observable } from "rxjs";

import { SubmittableExtrinsic } from "@polkadot/api/types";
import { DeriveBalancesAll } from "@polkadot/api-derive/balances/types";
import { ISubmittableResult } from "@polkadot/types/types";

import { BalanceAdapter, BalanceAdapterConfigs } from "../balance-adapter";
import { BaseCrossChainAdapter } from "../base-chain-adapter";
import { ChainName, chains } from "../configs";
import { ApiNotFound, CurrencyNotFound } from "../errors";
import {
  BalanceData,
  BasicToken,
  CrossChainRouterConfigs,
  CrossChainTransferParams,
} from "../types";
import { isChainEqual } from "../utils/is-chain-equal";

const DEST_WEIGHT = "5000000000";

export const calamariRoutersConfig: Omit<CrossChainRouterConfigs, "from">[] = [
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
    to: "kusama",
    token: "KSM",
    xcm: {
      fee: { token: "KSM", amount: "11523248" },
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
];

export const calamariTokensConfig: Record<string, BasicToken> = {
  KMA: { name: "KMA", symbol: "KMA", decimals: 12, ed: "100000000000" },
  KAR: { name: "KAR", symbol: "KAR", decimals: 12, ed: "100000000000" },
  KUSD: { name: "KUSD", symbol: "KUSD", decimals: 12, ed: "10000000000" },
  LKSM: { name: "LKSM", symbol: "LKSM", decimals: 12, ed: "500000000" },
  KSM: { name: "KSM", symbol: "KSM", decimals: 12, ed: "100000000" },
  MOVR: { name: "MOVR", symbol: "MOVR", decimals: 18, ed: "10000000000000000" },
};

const SUPPORTED_TOKENS: Record<string, number> = {
  KMA: 1,
  KUSD: 9,
  LKSM: 10,
  MOVR: 11,
  KSM: 12,
  KAR: 8,
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
      throw new CurrencyNotFound(token);
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

  public override async setApi(api: AnyApi) {
    this.api = api;

    await api.isReady;

    this.balanceAdapter = new MantaBalanceAdapter({
      chain: this.chain.id as ChainName,
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
    to: ChainName
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
    params: CrossChainTransferParams
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
      throw new CurrencyNotFound(token);
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

    // to relay-chain
    if (toChain.id === "kusama" || toChain.id === "polkadot") {
      const accountId = this.api?.createType("AccountId32", address).toHex();
      dst = {
        parents: 1,
        interior: { X1: { AccountId32: { id: accountId, network: "Any" } } },
      };
    }
    console.log('dst', dst);

    return this.api?.tx.xTokens.transfer(
      { MantaCurrency: tokenId },
      amount.toChainData(),
      {
        V1: dst
      },
      this.getDestWeight(token, to)?.toString()
    );
  }
}

export class CalamariAdapter extends BaseMantaAdapter {
  constructor() {
    super(chains.calamari, calamariRoutersConfig, calamariTokensConfig);
  }
}
