import { Storage } from '@acala-network/sdk/utils/storage';
import { AnyApi, FixedPointNumber as FN } from '@acala-network/sdk-core';
import { combineLatest, map, Observable } from 'rxjs';

import { SubmittableExtrinsic } from '@polkadot/api/types';
import { DeriveBalancesAll } from '@polkadot/api-derive/balances/types';
import { ISubmittableResult } from '@polkadot/types/types';

import { BalanceAdapter, BalanceAdapterConfigs } from '../balance-adapter';
import { BaseCrossChainAdapter } from '../base-chain-adapter';
import { ChainId, chains } from '../configs';
import { ApiNotFound, InvalidAddress, TokenNotFound } from '../errors';

import {
  BalanceData,
  ExtendedToken,
  RouteConfigs,
  TransferParams,
} from '../types';
import { validateAddress } from '../utils/validate-address';
import { isChainEqual } from '../utils/is-chain-equal';

const DEST_WEIGHT = '5000000000';

export const calamariRoutersConfig: Omit<RouteConfigs, 'from'>[] = [
  {
    to: 'karura',
    token: 'KMA',
    xcm: {
      fee: { token: 'KMA', amount: '6400000000' },
      weightLimit: DEST_WEIGHT,
    },
  },
  {
    to: 'karura',
    token: 'KUSD',
    xcm: {
      fee: { token: 'KUSD', amount: '6381112603' },
      weightLimit: DEST_WEIGHT,
    },
  },
  {
    to: 'karura',
    token: 'KAR',
    xcm: {
      fee: { token: 'KAR', amount: '6400000000' },
      weightLimit: DEST_WEIGHT,
    },
  },
  {
    to: 'karura',
    token: 'USDT',
    xcm: {
      fee: { token: 'USDT', amount: '808' },
      weightLimit: DEST_WEIGHT,
    },
  },
  {
    to: 'karura',
    token: 'LKSM',
    xcm: {
      fee: { token: 'LKSM', amount: '452334406' },
      weightLimit: DEST_WEIGHT,
    },
  },
  {
    to: 'karura',
    token: 'KSM',
    xcm: {
      fee: { token: 'KSM', amount: '54632622' },
      weightLimit: DEST_WEIGHT,
    },
  },
  {
    to: 'karura',
    token: 'DAI',
    xcm: {
      fee: { token: 'DAI', amount: '808240000000000' },
      weightLimit: DEST_WEIGHT,
    },
  },
  {
    to: 'karura',
    token: 'USDCet',
    xcm: {
      fee: { token: 'USDCet', amount: '808' },
      weightLimit: DEST_WEIGHT,
    },
  },
  {
    to: 'karura',
    token: 'WBTC',
    xcm: {
      fee: { token: 'WBTC', amount: '2' },
      weightLimit: DEST_WEIGHT,
    },
  },
  {
    to: 'karura',
    token: 'WETH',
    xcm: {
      fee: { token: 'WETH', amount: '449022222222' },
      weightLimit: DEST_WEIGHT,
    },
  },
  {
    to: 'karura',
    token: 'BNBet',
    xcm: {
      fee: { token: 'BNBet', amount: '3232960000000' },
      weightLimit: DEST_WEIGHT,
    },
  },
  {
    to: 'karura',
    token: 'BUSDet',
    xcm: {
      fee: { token: 'BUSDet', amount: '808240000000000' },
      weightLimit: DEST_WEIGHT,
    },
  },
  {
    to: 'karura',
    token: 'ARBet',
    xcm: {
      fee: { token: 'ARBet', amount: '727416000000000' },
      weightLimit: DEST_WEIGHT,
    },
  },
  {
    to: 'karura',
    token: 'MATICet',
    xcm: {
      fee: { token: 'MATICet', amount: '801280000000000' },
      weightLimit: DEST_WEIGHT,
    },
  },
  {
    to: 'karura',
    token: 'LDO',
    xcm: {
      fee: { token: 'LDO', amount: '400640000000000' },
      weightLimit: DEST_WEIGHT,
    },
  },
  {
    to: 'karura',
    token: 'SHIB',
    xcm: {
      fee: { token: 'SHIB', amount: '80128000000000000000' },
      weightLimit: DEST_WEIGHT,
    },
  },
  {
    to: 'karura',
    token: 'UNI',
    xcm: {
      fee: { token: 'UNI', amount: '160256000000000' },
      weightLimit: DEST_WEIGHT,
    },
  },
  {
    to: 'karura',
    token: 'LINK',
    xcm: {
      fee: { token: 'LINK', amount: '160256000000000' },
      weightLimit: DEST_WEIGHT,
    },
  },
  {
    to: 'karura',
    token: 'APE',
    xcm: {
      fee: { token: 'APE', amount: '240384000000000' },
      weightLimit: DEST_WEIGHT,
    },
  },
  {
    to: 'kusama',
    token: 'KSM',
    xcm: {
      fee: { token: 'KSM', amount: '90287436' },
      weightLimit: DEST_WEIGHT,
    },
  },
  {
    to: 'moonriver',
    token: 'MOVR',
    xcm: {
      fee: { token: 'MOVR', amount: '23356409465885' },
      weightLimit: DEST_WEIGHT,
    },
  },
  {
    to: 'statemine',
    token: 'USDT',
    xcm: {
      fee: { token: 'USDT', amount: '1183' },
      weightLimit: DEST_WEIGHT,
    },
  },
];

export const mantaRoutersConfig: Omit<RouteConfigs, 'from'>[] = [
  {
    to: 'polkadot',
    token: 'DOT',
    xcm: {
      fee: { token: 'DOT', amount: '364421524' },
      weightLimit: DEST_WEIGHT,
    },
  },
  {
    to: 'moonbeam',
    token: 'GLMR',
    xcm: {
      fee: { token: 'GLMR', amount: '0' },
      weightLimit: DEST_WEIGHT,
    },
  },
  {
    to: 'acala',
    token: 'ACA',
    xcm: {
      fee: { token: 'ACA', amount: '8082400000' },
      weightLimit: DEST_WEIGHT,
    },
  },
  {
    to: 'acala',
    token: 'DAI',
    xcm: {
      fee: { token: 'DAI', amount: '25212875000000000' },
      weightLimit: DEST_WEIGHT,
    },
  },
  {
    to: 'acala',
    token: 'USDT',
    xcm: {
      fee: { token: 'USDT', amount: '808' },
      weightLimit: DEST_WEIGHT,
    },
  },
  {
    to: 'acala',
    token: 'USDCet',
    xcm: {
      fee: { token: 'USDCet', amount: '808' },
      weightLimit: DEST_WEIGHT,
    },
  },
  {
    to: 'acala',
    token: 'WETH',
    xcm: {
      fee: { token: 'WETH', amount: '687004000000' },
      weightLimit: DEST_WEIGHT,
    },
  },
  {
    to: 'acala',
    token: 'WBTC',
    xcm: {
      fee: { token: 'WBTC', amount: '4' },
      weightLimit: DEST_WEIGHT,
    },
  },
  {
    to: 'acala',
    token: 'APE',
    xcm: {
      fee: { token: 'APE', amount: '242472000000000' },
      weightLimit: DEST_WEIGHT,
    },
  },
  {
    to: 'acala',
    token: 'LDOT',
    xcm: {
      fee: { token: 'LDOT', amount: '13400229' },
      weightLimit: DEST_WEIGHT,
    },
  },
];

export const calamariTokensConfig: Record<string, ExtendedToken> = {
  KMA: {
    name: 'KMA',
    symbol: 'KMA',
    decimals: 12,
    ed: '100000000000',
    toRaw: () => ({ MantaCurrency: 1 }),
  },
  KAR: {
    name: 'KAR',
    symbol: 'KAR',
    decimals: 12,
    ed: '100000000000',
    toRaw: () => ({ MantaCurrency: 8 }),
  },
  KUSD: {
    name: 'KUSD',
    symbol: 'KUSD',
    decimals: 12,
    ed: '10000000000',
    toRaw: () => ({ MantaCurrency: 9 }),
  },
  LKSM: {
    name: 'LKSM',
    symbol: 'LKSM',
    decimals: 12,
    ed: '500000000',
    toRaw: () => ({ MantaCurrency: 10 }),
  },
  MOVR: {
    name: 'MOVR',
    symbol: 'MOVR',
    decimals: 18,
    ed: '100000000000000000',
    toRaw: () => ({ MantaCurrency: 11 }),
  },
  KSM: {
    name: 'KSM',
    symbol: 'KSM',
    decimals: 12,
    ed: '100000000',
    toRaw: () => ({ MantaCurrency: 12 }),
  },
  USDT: {
    name: 'USDT',
    symbol: 'USDT',
    decimals: 6,
    ed: '10000',
    toRaw: () => ({ MantaCurrency: 14 }),
  },
  DAI: {
    name: 'DAI',
    symbol: 'DAI',
    decimals: 18,
    ed: '10000000000000000',
    toRaw: () => ({ MantaCurrency: 15 }),
  },
  USDCet: {
    name: 'USDCet',
    symbol: 'USDCet',
    decimals: 6,
    ed: '10000',
    toRaw: () => ({ MantaCurrency: 16 }),
  },
  WETH: {
    name: 'WETH',
    symbol: 'WETH',
    decimals: 18,
    ed: '5555555555555',
    toRaw: () => ({ MantaCurrency: 27 }),
  },
  WBTC: {
    name: 'WBTC',
    symbol: 'WBTC',
    decimals: 8,
    ed: '35',
    toRaw: () => ({ MantaCurrency: 26 }),
  },
  BNBet: {
    name: 'BNBet',
    symbol: 'BNBet',
    decimals: 18,
    ed: '40000000000000',
    toRaw: () => ({ MantaCurrency: 21 }),
  },
  BUSDet: {
    name: 'BUSDet',
    symbol: 'BUSDet',
    decimals: 18,
    ed: '10000000000000000',
    toRaw: () => ({ MantaCurrency: 23 }),
  },
  ARBet: {
    name: 'ARBet',
    symbol: 'ARBet',
    decimals: 18,
    ed: '9000000000000000',
    toRaw: () => ({ MantaCurrency: 17 }),
  },
  MATICet: {
    name: 'MATICet',
    symbol: 'MATICet',
    decimals: 18,
    ed: '10000000000000000',
    toRaw: () => ({ MantaCurrency: 20 }),
  },
  LDO: {
    name: 'LDO',
    symbol: 'LDO',
    decimals: 18,
    ed: '5000000000000000',
    toRaw: () => ({ MantaCurrency: 18 }),
  },
  SHIB: {
    name: 'SHIB',
    symbol: 'SHIB',
    decimals: 18,
    ed: '1000000000000000000000',
    toRaw: () => ({ MantaCurrency: 19 }),
  },
  UNI: {
    name: 'UNI',
    symbol: 'UNI',
    decimals: 18,
    ed: '2000000000000000',
    toRaw: () => ({ MantaCurrency: 22 }),
  },
  LINK: {
    name: 'LINK',
    symbol: 'LINK',
    decimals: 18,
    ed: '2000000000000000',
    toRaw: () => ({ MantaCurrency: 24 }),
  },
  APE: {
    name: 'APE',
    symbol: 'APE',
    decimals: 18,
    ed: '3000000000000000',
    toRaw: () => ({ MantaCurrency: 25 }),
  },
};

export const mantaTokensConfig: Record<string, ExtendedToken> = {
  MANTA: {
    name: 'MANTA',
    symbol: 'MANTA',
    decimals: 18,
    ed: '100000000000000000',
    toRaw: () => ({ MantaCurrency: 1 }),
  },
  DOT: {
    name: 'DOT',
    symbol: 'DOT',
    decimals: 10,
    ed: '10000000000',
    toRaw: () => ({ MantaCurrency: 8 }),
  },
  GLMR: {
    name: 'GLMR',
    symbol: 'GLMR',
    decimals: 18,
    ed: '1',
    toRaw: () => ({ MantaCurrency: 10 }),
  },
  ACA: {
    name: 'ACA',
    symbol: 'ACA',
    decimals: 12,
    ed: '100000000000',
    toRaw: () => ({ MantaCurrency: 11 }),
  },
  DAI: {
    name: 'DAI',
    symbol: 'DAI',
    decimals: 18,
    ed: '10000000000000000',
    toRaw: () => ({ MantaCurrency: 23 }),
  },
  USDT: {
    name: 'USDT',
    symbol: 'USDT',
    decimals: 6,
    ed: '10000',
    toRaw: () => ({ MantaCurrency: 9 }),
  },
  USDCet: {
    name: 'USDCet',
    symbol: 'USDCet',
    decimals: 6,
    ed: '10000',
    toRaw: () => ({ MantaCurrency: 24 }),
  },
  WETH: {
    name: 'WETH',
    symbol: 'WETH',
    decimals: 18,
    ed: '5555555555555',
    toRaw: () => ({ MantaCurrency: 27 }),
  },
  WBTC: {
    name: 'WBTC',
    symbol: 'WBTC',
    decimals: 8,
    ed: '35',
    toRaw: () => ({ MantaCurrency: 26 }),
  },
  LDOT: {
    name: 'LDOT',
    symbol: 'LDOT',
    decimals: 10,
    ed: '500000000',
    toRaw: () => ({ MantaCurrency: 12 }),
  },
  BUSD: {
    name: 'BUSD',
    symbol: 'BUSD',
    decimals: 18,
    ed: '10000000000000000',
    toRaw: () => ({ MantaCurrency: 21 }),
  },
  ARB: {
    name: 'ARB',
    symbol: 'ARB',
    decimals: 18,
    ed: '9000000000000000',
    toRaw: () => ({ MantaCurrency: 20 }),
  },
  LDO: {
    name: 'LDO',
    symbol: 'LDO',
    decimals: 18,
    ed: '5000000000000000',
    toRaw: () => ({ MantaCurrency: 15 }),
  },
  SHIB: {
    name: 'SHIB',
    symbol: 'SHIB',
    decimals: 18,
    ed: '1000000000000000000000',
    toRaw: () => ({ MantaCurrency: 16 }),
  },
  UNI: {
    name: 'UNI',
    symbol: 'UNI',
    decimals: 18,
    ed: '2000000000000000',
    toRaw: () => ({ MantaCurrency: 17 }),
  },
  LINK: {
    name: 'LINK',
    symbol: 'LINK',
    decimals: 18,
    ed: '2000000000000000',
    toRaw: () => ({ MantaCurrency: 18 }),
  },
  APE: {
    name: 'APE',
    symbol: 'APE',
    decimals: 18,
    ed: '3000000000000000',
    toRaw: () => ({ MantaCurrency: 19 }),
  },
};

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
const createBalanceStorages = (api: AnyApi) => {
  return {
    balances: (address: string) =>
      Storage.create<DeriveBalancesAll>({
        api,
        path: 'derive.balances.all',
        params: [address],
      }),
    assets: (id: number, address: string) =>
      Storage.create<any>({
        api,
        path: 'query.assets.account',
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
    if (!validateAddress(address)) throw new InvalidAddress(address);

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

    const tokenData: ExtendedToken = this.getToken(token);

    if (!tokenData) throw new TokenNotFound(token);

    return this.storages.assets(tokenData.toRaw(), address).observable.pipe(
      map((balance) => {
        const amount = FN.fromInner(
          balance.unwrapOrDefault()?.balance?.toString() || '0',
          tokenData.decimals
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
      tokens:
        this.chain.id === 'manta' ? mantaTokensConfig : calamariTokensConfig,
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
          : '0',
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
          .minus(FN.fromInner(tokenMeta?.ed || '0', tokenMeta?.decimals));
      })
    );
  }

  public createTx(
    params: TransferParams
  ):
    | SubmittableExtrinsic<'promise', ISubmittableResult>
    | SubmittableExtrinsic<'rxjs', ISubmittableResult> {
    if (this.api === undefined) {
      throw new ApiNotFound(this.chain.id);
    }
    const { address, amount, to, token } = params;
    const toChain = chains[to];
    const tokenData: ExtendedToken = this.getToken(token);

    if (
      isChainEqual(toChain, 'moonriver') ||
      isChainEqual(toChain, 'moonbeam')
    ) {
      const dst = {
        parents: 1,
        interior: {
          X2: [
            { Parachain: toChain.paraChainId },
            { AccountKey20: { key: address, network: 'Any' } },
          ],
        },
      };
      return this.api?.tx.xTokens.transfer(
        tokenData.toRaw(),
        amount.toChainData(),
        {
          V1: dst,
        },
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        { Limited: this.getDestWeight(token, to)!.toString() }
      );
    }

    return this.createXTokensTx(params);
  }
}

export class CalamariAdapter extends BaseMantaAdapter {
  constructor() {
    super(chains.calamari, calamariRoutersConfig, calamariTokensConfig);
  }
}

export class MantaAdapter extends BaseMantaAdapter {
  constructor() {
    super(chains.manta, mantaRoutersConfig, mantaTokensConfig);
  }
}
