import { createSelector } from 'reselect';
import {
  TransactionEnvelopeType,
  TransactionMeta,
} from '@metamask/transaction-controller';
import txHelper from '../helpers/utils/tx-helper';
import {
  roundExponential,
  getTransactionFee,
  addFiat,
  addEth,
} from '../helpers/utils/confirm-tx.util';
import {
  getGasEstimateType,
  getGasFeeEstimates,
  getNativeCurrency,
} from '../ducks/metamask/metamask';
import {
  GasEstimateTypes,
  CUSTOM_GAS_ESTIMATE,
} from '../../shared/constants/gas';
import {
  getMaximumGasTotalInHexWei,
  getMinimumGasTotalInHexWei,
} from '../../shared/modules/gas.utils';
import { isEqualCaseInsensitive } from '../../shared/modules/string-utils';
import { calcTokenAmount } from '../../shared/lib/transactions-controller-utils';
import {
  decGWEIToHexWEI,
  getValueFromWeiHex,
  subtractHexes,
  sumHexes,
} from '../../shared/modules/conversion.utils';
import {
  getProviderConfig,
  getCurrentChainId,
} from '../../shared/modules/selectors/networks';
import { getAveragePriceEstimateInHexWEI } from './custom-gas';
import {
  checkNetworkAndAccountSupports1559,
  getMetaMaskAccounts,
  getTokenExchangeRates,
} from './selectors';
import {
  getUnapprovedTransactions,
  selectTransactionMetadata,
  selectTransactionSender,
  unapprovedPersonalMsgsSelector,
  unapprovedDecryptMsgsSelector,
  unapprovedEncryptionPublicKeyMsgsSelector,
  unapprovedTypedMessagesSelector,
} from './transactions';
import { MetaMaskReduxState } from '../store/store';
import { getKnownPropertyNames } from '@metamask/utils';

const unapprovedTxsSelector = (state: MetaMaskReduxState) =>
  getUnapprovedTransactions(state);

export const unconfirmedTransactionsListSelector = createSelector(
  unapprovedTxsSelector,
  unapprovedPersonalMsgsSelector,
  unapprovedDecryptMsgsSelector,
  unapprovedEncryptionPublicKeyMsgsSelector,
  unapprovedTypedMessagesSelector,
  getCurrentChainId,
  (
    unapprovedTxs = {},
    unapprovedPersonalMsgs = {},
    unapprovedDecryptMsgs = {},
    unapprovedEncryptionPublicKeyMsgs = {},
    unapprovedTypedMessages = {},
    chainId,
  ) =>
    txHelper(
      unapprovedTxs,
      unapprovedPersonalMsgs,
      unapprovedDecryptMsgs,
      unapprovedEncryptionPublicKeyMsgs,
      unapprovedTypedMessages,
      chainId,
    ) || [],
);

export const unconfirmedTransactionsHashSelector = createSelector(
  unapprovedTxsSelector,
  unapprovedPersonalMsgsSelector,
  unapprovedDecryptMsgsSelector,
  unapprovedEncryptionPublicKeyMsgsSelector,
  unapprovedTypedMessagesSelector,
  getCurrentChainId,
  (
    unapprovedTxs = {},
    unapprovedPersonalMsgs = {},
    unapprovedDecryptMsgs = {},
    unapprovedEncryptionPublicKeyMsgs = {},
    unapprovedTypedMessages = {},
    chainId,
  ) => {
    const filteredUnapprovedTxs = getKnownPropertyNames(unapprovedTxs).reduce<{
      [address: string]: TransactionMeta;
    }>((acc, address) => {
      const transactions = { ...acc };

      if (unapprovedTxs[address].chainId === chainId) {
        transactions[address] = unapprovedTxs[address];
      }

      return transactions;
    }, {});

    return {
      ...filteredUnapprovedTxs,
      ...unapprovedPersonalMsgs,
      ...unapprovedDecryptMsgs,
      ...unapprovedEncryptionPublicKeyMsgs,
      ...unapprovedTypedMessages,
    };
  },
);

export const unconfirmedMessagesHashSelector = createSelector(
  unapprovedPersonalMsgsSelector,
  unapprovedDecryptMsgsSelector,
  unapprovedEncryptionPublicKeyMsgsSelector,
  unapprovedTypedMessagesSelector,
  (
    unapprovedPersonalMsgs = {},
    unapprovedDecryptMsgs = {},
    unapprovedEncryptionPublicKeyMsgs = {},
    unapprovedTypedMessages = {},
  ) => {
    return {
      ...unapprovedPersonalMsgs,
      ...unapprovedDecryptMsgs,
      ...unapprovedEncryptionPublicKeyMsgs,
      ...unapprovedTypedMessages,
    };
  },
);
export const use4ByteResolutionSelector = (state: MetaMaskReduxState) =>
  state.metamask.PreferencesController.use4ByteResolution;
export const currentCurrencySelector = (state: MetaMaskReduxState) =>
  state.metamask.CurrencyController.currentCurrency;
export const conversionRateSelector = (state: MetaMaskReduxState) =>
  state.metamask.CurrencyController.currencyRates[
    getProviderConfig(state).ticker
  ]?.conversionRate;
export const txDataSelector = (state: MetaMaskReduxState) =>
  state.confirmTransaction.txData;
const tokenDataSelector = (state: MetaMaskReduxState) =>
  state.confirmTransaction.tokenData;
const tokenPropsSelector = (state: MetaMaskReduxState) =>
  state.confirmTransaction.tokenProps;

const tokenDecimalsSelector = createSelector(
  tokenPropsSelector,
  (tokenProps) => tokenProps && tokenProps.decimals,
);

const tokenDataArgsSelector = createSelector(
  tokenDataSelector,
  (tokenData) => (tokenData && tokenData.args) || [],
);

const txParamsSelector = createSelector(
  txDataSelector,
  (txData) => (txData && txData.txParams) || {},
);

export const tokenAddressSelector = createSelector(
  txParamsSelector,
  (txParams) => txParams && txParams.to,
);

const TOKEN_PARAM_TO = '_to';
const TOKEN_PARAM_VALUE = '_value';

export const sendTokenTokenAmountAndToAddressSelector = createSelector(
  tokenDataArgsSelector,
  tokenDecimalsSelector,
  (args, tokenDecimals) => {
    let toAddress = '';
    let tokenAmount = '0';

    // Token params here are ethers BigNumbers, which have a different
    // interface than bignumber.js
    if (args && args.length) {
      toAddress = args[TOKEN_PARAM_TO];
      let value = args[TOKEN_PARAM_VALUE].toString();

      if (tokenDecimals) {
        // bignumber.js return value
        value = calcTokenAmount(value, tokenDecimals).toFixed();
      }

      tokenAmount = roundExponential(value);
    }

    return {
      toAddress,
      tokenAmount,
    };
  },
);

export const contractExchangeRateSelector = createSelector(
  (state: MetaMaskReduxState) => getTokenExchangeRates(state),
  tokenAddressSelector,
  (contractExchangeRates, tokenAddress) => {
    const address = getKnownPropertyNames(contractExchangeRates).find(
      (address) => {
        return isEqualCaseInsensitive(address, tokenAddress);
      },
    );
    return address ? contractExchangeRates[address] : undefined;
  },
);

export const transactionFeeSelector = function (
  state: MetaMaskReduxState,
  txData: Partial<TransactionMeta>,
) {
  const currentCurrency = currentCurrencySelector(state);
  const conversionRate = conversionRateSelector(state);
  const nativeCurrency = getNativeCurrency(state);
  const gasFeeEstimates = getGasFeeEstimates(state) || {};
  const gasEstimateType = getGasEstimateType(state);
  const networkAndAccountSupportsEIP1559 =
    checkNetworkAndAccountSupports1559(state);

  const gasEstimationObject = {
    gasLimit: txData.txParams?.gas ?? '0x0',
  };

  if (networkAndAccountSupportsEIP1559) {
    const { gasPrice = '0' } = gasFeeEstimates;
    const selectedGasEstimates = gasFeeEstimates[txData.userFeeLevel] || {};
    if (txData.txParams?.type === TransactionEnvelopeType.legacy) {
      gasEstimationObject.gasPrice =
        txData.txParams?.gasPrice ?? decGWEIToHexWEI(gasPrice);
    } else {
      const { suggestedMaxPriorityFeePerGas, suggestedMaxFeePerGas } =
        selectedGasEstimates;
      gasEstimationObject.maxFeePerGas =
        txData.txParams?.maxFeePerGas &&
        (txData.userFeeLevel === CUSTOM_GAS_ESTIMATE || !suggestedMaxFeePerGas)
          ? txData.txParams?.maxFeePerGas
          : decGWEIToHexWEI(suggestedMaxFeePerGas || gasPrice);
      gasEstimationObject.maxPriorityFeePerGas =
        txData.txParams?.maxPriorityFeePerGas &&
        (txData.userFeeLevel === CUSTOM_GAS_ESTIMATE ||
          !suggestedMaxPriorityFeePerGas)
          ? txData.txParams?.maxPriorityFeePerGas
          : (suggestedMaxPriorityFeePerGas &&
              decGWEIToHexWEI(suggestedMaxPriorityFeePerGas)) ||
            gasEstimationObject.maxFeePerGas;
      gasEstimationObject.baseFeePerGas = decGWEIToHexWEI(
        gasFeeEstimates.estimatedBaseFee,
      );
    }
  } else {
    switch (gasEstimateType) {
      case GasEstimateTypes.feeMarket:
      case GasEstimateTypes.none:
        gasEstimationObject.gasPrice = txData.txParams?.gasPrice ?? '0x0';
        break;
      case GasEstimateTypes.ethGasPrice:
        gasEstimationObject.gasPrice =
          txData.txParams?.gasPrice ??
          decGWEIToHexWEI(gasFeeEstimates.gasPrice);
        break;
      case GasEstimateTypes.legacy:
        gasEstimationObject.gasPrice =
          txData.txParams?.gasPrice ?? getAveragePriceEstimateInHexWEI(state);
        break;
      default:
        break;
    }
  }

  const { txParams: { value = '0x0' } = {} } = txData;

  const fiatTransactionAmount = getValueFromWeiHex({
    value,
    fromCurrency: nativeCurrency,
    toCurrency: currentCurrency,
    conversionRate,
    numberOfDecimals: 2,
  });
  const ethTransactionAmount = getValueFromWeiHex({
    value,
    fromCurrency: nativeCurrency,
    toCurrency: nativeCurrency,
    conversionRate,
    numberOfDecimals: 6,
  });

  const hexMinimumTransactionFee =
    getMinimumGasTotalInHexWei(gasEstimationObject);
  const hexMaximumTransactionFee =
    getMaximumGasTotalInHexWei(gasEstimationObject);

  const fiatMinimumTransactionFee = getTransactionFee({
    value: hexMinimumTransactionFee,
    fromCurrency: nativeCurrency,
    toCurrency: currentCurrency,
    numberOfDecimals: 2,
    conversionRate,
  });

  const fiatMaximumTransactionFee = getTransactionFee({
    value: hexMaximumTransactionFee,
    fromCurrency: nativeCurrency,
    toCurrency: currentCurrency,
    numberOfDecimals: 2,
    conversionRate,
  });

  const ethTransactionFee = getTransactionFee({
    value: hexMinimumTransactionFee,
    fromCurrency: nativeCurrency,
    toCurrency: nativeCurrency,
    numberOfDecimals: 6,
    conversionRate,
  });

  const fiatTransactionTotal = addFiat(
    fiatMinimumTransactionFee,
    fiatTransactionAmount,
  );
  const ethTransactionTotal = addEth(ethTransactionFee, ethTransactionAmount);
  const hexTransactionTotal = sumHexes(value, hexMinimumTransactionFee);

  return {
    hexTransactionAmount: value,
    fiatTransactionAmount,
    ethTransactionAmount,
    hexMinimumTransactionFee,
    fiatMinimumTransactionFee,
    hexMaximumTransactionFee,
    fiatMaximumTransactionFee,
    ethTransactionFee,
    fiatTransactionTotal,
    ethTransactionTotal,
    hexTransactionTotal,
    gasEstimationObject,
  };
};

export function selectTransactionFeeById(
  state: MetaMaskReduxState,
  transactionId: string,
) {
  const transactionMetadata = selectTransactionMetadata(state, transactionId);
  return transactionFeeSelector(state, transactionMetadata ?? {});
}

// Cannot use createSelector due to circular dependency caused by getMetaMaskAccounts.
export function selectTransactionAvailableBalance(
  state: MetaMaskReduxState,
  transactionId: string,
) {
  const accounts = getMetaMaskAccounts(state);
  const sender = selectTransactionSender(state, transactionId);

  return sender ? accounts[sender]?.balance : undefined;
}

export function selectIsMaxValueEnabled(
  state: MetaMaskReduxState,
  transactionId: string,
) {
  return state.confirmTransaction.maxValueMode?.[transactionId] ?? false;
}

export const selectMaxValue = createSelector(
  selectTransactionFeeById,
  selectTransactionAvailableBalance,
  (transactionFee, balance) =>
    balance && transactionFee.hexMaximumTransactionFee
      ? subtractHexes(balance, transactionFee.hexMaximumTransactionFee)
      : undefined,
);

export const selectTransactionValue = createSelector(
  selectIsMaxValueEnabled,
  selectMaxValue,
  selectTransactionMetadata,
  (isMaxValueEnabled, maxValue, transactionMetadata) =>
    isMaxValueEnabled ? maxValue : transactionMetadata?.txParams?.value,
);
