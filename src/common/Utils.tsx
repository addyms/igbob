import { App, Trade } from '../redux/types';
import { algodClient, indexerClient } from '../algorand/utils/Utils';
import { extractAppState, extractManageAppState } from '../utils/Utils';
import {
  getAccountInformation,
  getAppAccountTrade,
  getAssetBalance,
  getStablecoinBalance
} from '../algorand/account/Account';
import { getCouponRound, getHasDefaulted } from '../investor/Utils';

export enum FETCH_APPS_FILTER {
  ALL = 'all',
  UPCOMING = 'upcoming',
  SALE = 'sale',
  LIVE = 'live',
  EXPIRED = 'expired',
  ISSUER = 'issuer',
  GREEN_VERIFIER = 'green-verifier',
  FINANCIAL_REGULATOR = 'financial-regulator',
}

export async function fetchApps(
  accessToken: string,
  setApps: (apps: App[]) => void,
  filter: FETCH_APPS_FILTER,
  addr?: string,
): Promise<void> {
  try {
    // Fetch and parse
    const url: string = filter === FETCH_APPS_FILTER.ISSUER ||
    filter === FETCH_APPS_FILTER.GREEN_VERIFIER ||
    filter === FETCH_APPS_FILTER.FINANCIAL_REGULATOR  ?
      `https://igbob.herokuapp.com/apps/${filter}-apps/${addr}` :
      `https://igbob.herokuapp.com/apps/${filter}-apps`
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}`},
    });
    const parsedResponse = await response.json();

    const apps = parsedResponse.map(app => {
      // Set current coupon round
      app.coupon_round = getCouponRound(app.end_buy_date, app.maturity_date, app.period, app.bond_length);

      // Set ssc states, minted, balances and default
      Promise.all(
        [
          algodClient.getApplicationByID(app.app_id).do(),
          algodClient.getApplicationByID(app.manage_app_id).do(),
          indexerClient.lookupAssetByID(app.bond_id).do(),
          getAccountInformation(app.bond_escrow_address),
          getAccountInformation(app.stablecoin_escrow_address)
        ]
      ).then(([mainApp, manageApp, asset, bondEscrow, stablecoinEscrow]) => {
        app.app_global_state = extractAppState(mainApp.params['global-state']);
        app.manage_app_global_state = extractManageAppState(manageApp.params['global-state']);
        app.bonds_minted = asset.asset.params.total as number;
        app.bond_escrow_balance = getAssetBalance(bondEscrow, app.bond_id) as number;
        app.stablecoin_escrow_balance = getStablecoinBalance(stablecoinEscrow) as number;
        app.defaulted = getHasDefaulted(app);
      });

      return app;
    });

    setApps(apps);
  } catch (err) {
    console.error(err.message);
  }
}

export async function fetchApp(
  accessToken: string,
  setApp: (app: App) => void,
  app_id: number,
): Promise<void> {
  try {
    const response = await fetch(`https://igbob.herokuapp.com/apps/app/${app_id}`, {
      headers: { Authorization: `Bearer ${accessToken}`},
    });
    const parseResponse = await response.json();
    setApp(parseResponse);
  } catch (err) {
    console.error(err.message);
  }
}

export enum FETCH_TRADES_FILTER {
  ALL = 'all',
  LIVE = 'live',
  EXPIRED = 'expired',
}

export enum FETCH_MY_TRADES_FILTER {
  MY_ALL = 'my-all',
  MY_LIVE = 'my-live',
  MY_SALE = 'my-expired',
}

export async function fetchTrades(
  accessToken: string,
  setTrades: (trades: Trade[]) => void,
  filter: FETCH_TRADES_FILTER | FETCH_MY_TRADES_FILTER,
): Promise<void> {
  try {
    const response = await fetch(`https://igbob.herokuapp.com/trades/${filter}-trades`, {
      headers: { Authorization: `Bearer ${accessToken}`},
    });
    const parsedResponse = await response.json();

    // Set balance and frozen
    const trades = parsedResponse.map(async trade => {
      const appAccountTrade = await getAppAccountTrade(
        trade.seller_address,
        trade.app_id,
        trade.bond_id
      );
      return {
        ...trade,
        seller_balance: appAccountTrade.balance,
        seller_frozen: appAccountTrade.frozen,
      }
    });

    setTrades(await Promise.all(trades));
  } catch (err) {
    console.error(err.message);
  }
}
