/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  SavedGasFees,
  TransactionController,
  TransactionControllerPostTransactionBalanceUpdatedEvent,
  TransactionControllerTransactionApprovedEvent,
  TransactionControllerTransactionConfirmedEvent,
  TransactionControllerTransactionDroppedEvent,
  TransactionControllerTransactionFailedEvent,
  TransactionControllerTransactionNewSwapApprovalEvent,
  TransactionControllerTransactionNewSwapEvent,
  TransactionControllerTransactionRejectedEvent,
  TransactionControllerTransactionStatusUpdatedEvent,
  TransactionControllerTransactionSubmittedEvent,
  TransactionControllerUnapprovedTransactionAddedEvent,
  TransactionMeta,
} from '@metamask/transaction-controller';
import {
  NetworkController,
  NetworkControllerFindNetworkClientIdByChainIdAction,
  NetworkControllerGetNetworkClientByIdAction,
  NetworkControllerStateChangeEvent,
} from '@metamask/network-controller';
import { TransactionUpdateController } from '@metamask-institutional/transaction-update';
import SmartTransactionsController from '@metamask/smart-transactions-controller';
import { SmartTransactionStatuses } from '@metamask/smart-transactions-controller/dist/types';
import { GasFeeController } from '@metamask/gas-fee-controller';
import { KeyringController } from '@metamask/keyring-controller';
import { Hex } from '@metamask/utils';
import {
  ActionConstraint,
  ControllerMessenger,
  EventConstraint,
} from '@metamask/base-controller';
import { AccountsControllerGetSelectedAccountAction } from '@metamask/accounts-controller';
import { ApprovalControllerActions } from '@metamask/approval-controller';
import { PreferencesController } from '../controllers/preferences-controller';
import {
  getCurrentChainSupportsSmartTransactions,
  getFeatureFlagsByChainId,
  getIsSmartTransaction,
  getSmartTransactionsPreferenceEnabled,
  isHardwareWallet,
} from '../../../shared/modules/selectors';
import { submitSmartTransactionHook } from '../lib/transaction/smart-transactions';
import { CHAIN_IDS } from '../../../shared/constants/network';
import { trace } from '../../../shared/lib/trace';
import OnboardingController from '../controllers/onboarding';
///: BEGIN:ONLY_INCLUDE_IF(build-mmi)
import {
  afterTransactionSign as afterTransactionSignMMI,
  beforeCheckPendingTransaction as beforeCheckPendingTransactionMMI,
  beforeTransactionPublish as beforeTransactionPublishMMI,
  getAdditionalSignArguments as getAdditionalSignArgumentsMMI,
} from '../lib/transaction/mmi-hooks';
///: END:ONLY_INCLUDE_IF
import {
  handlePostTransactionBalanceUpdate,
  handleTransactionAdded,
  handleTransactionApproved,
  handleTransactionConfirmed,
  handleTransactionDropped,
  handleTransactionFailed,
  handleTransactionRejected,
  handleTransactionSubmitted,
} from '../lib/transaction/metrics';
import {
  SwapsControllerSetApproveTxIdAction,
  SwapsControllerSetTradeTxIdAction,
} from '../controllers/swaps/swaps.types';
import {
  ControllerInit,
  ControllerInitRequest,
  ControllerName,
} from './controller-init';

type MessengerActions =
  | ApprovalControllerActions
  | NetworkControllerFindNetworkClientIdByChainIdAction
  | NetworkControllerGetNetworkClientByIdAction
  | AccountsControllerGetSelectedAccountAction
  | SwapsControllerSetTradeTxIdAction
  | SwapsControllerSetApproveTxIdAction;

type MessengerEvent =
  | TransactionControllerPostTransactionBalanceUpdatedEvent
  | TransactionControllerUnapprovedTransactionAddedEvent
  | TransactionControllerTransactionApprovedEvent
  | TransactionControllerTransactionDroppedEvent
  | TransactionControllerTransactionConfirmedEvent
  | TransactionControllerTransactionFailedEvent
  | TransactionControllerTransactionRejectedEvent
  | TransactionControllerTransactionSubmittedEvent
  | TransactionControllerTransactionStatusUpdatedEvent
  | TransactionControllerTransactionNewSwapEvent
  | TransactionControllerTransactionNewSwapApprovalEvent
  | NetworkControllerStateChangeEvent;

type Messenger = ControllerMessenger<MessengerActions, MessengerEvent>;

export class TransactionControllerInit extends ControllerInit<TransactionController> {
  public init(request: ControllerInitRequest): TransactionController {
    const {
      getGlobalChainId,
      getPermittedAccounts,
      getStateUI,
      getTransactionMetricsRequest,
      persistedState,
    } = request;

    const controllerMessenger = request.controllerMessenger as Messenger;

    const {
      gasFeeController,
      keyringController,
      networkController,
      onboardingController,
      preferencesController,
      smartTransactionsController,
      transactionUpdateController,
    } = this.#getControllers(request);

    const transactionControllerMessenger = controllerMessenger.getRestricted({
      name: 'TransactionController',
      allowedActions: [
        `ApprovalController:addRequest`,
        'NetworkController:findNetworkClientIdByChainId',
        'NetworkController:getNetworkClientById',
        'AccountsController:getSelectedAccount',
      ],
      allowedEvents: [`NetworkController:stateChange`],
    });

    const controller = new TransactionController({
      getCurrentNetworkEIP1559Compatibility: () =>
        networkController().getEIP1559Compatibility() as Promise<boolean>,
      getCurrentAccountEIP1559Compatibility: async () => true,
      // @ts-expect-error Missing types
      getExternalPendingTransactions: (address) =>
        this.#getExternalPendingTransactions(
          smartTransactionsController(),
          address,
        ),
      getGasFeeEstimates: gasFeeController().fetchGasFeeEstimates.bind(
        gasFeeController(),
      ),
      getNetworkClientRegistry:
        networkController().getNetworkClientRegistry.bind(networkController()),
      getNetworkState: () => networkController().state,
      // @ts-expect-error Missing types
      getPermittedAccounts: getPermittedAccounts.bind(this),
      getSavedGasFees: () => {
        const globalChainId = getGlobalChainId();
        return preferencesController().state.advancedGasFee[
          globalChainId
        ] as unknown as SavedGasFees;
      },
      incomingTransactions: {
        etherscanApiKeysByChainId: {
          [CHAIN_IDS.MAINNET as Hex]: process.env.ETHERSCAN_API_KEY as string,
          [CHAIN_IDS.SEPOLIA as Hex]: process.env.ETHERSCAN_API_KEY as string,
        },
        includeTokenTransfers: false,
        isEnabled: () =>
          preferencesController().state.incomingTransactionsPreferences?.[
            // @ts-expect-error Missing types
            getGlobalChainId()
          ] && onboardingController().state.completedOnboarding,
        queryEntireHistory: false,
        updateTransactions: false,
      },
      isFirstTimeInteractionEnabled: () =>
        preferencesController().state.securityAlertsEnabled,
      isSimulationEnabled: () =>
        preferencesController().state.useTransactionSimulations,
      messenger: transactionControllerMessenger,
      pendingTransactions: {
        isResubmitEnabled: () =>
          !(
            getSmartTransactionsPreferenceEnabled(getStateUI()) &&
            getCurrentChainSupportsSmartTransactions(getStateUI())
          ),
      },
      testGasFeeFlows: Boolean(process.env.TEST_GAS_FEE_FLOWS),
      // @ts-expect-error Missing types
      trace,
      hooks: {
        ///: BEGIN:ONLY_INCLUDE_IF(build-mmi)
        afterSign: (txMeta, signedEthTx) =>
          afterTransactionSignMMI(
            txMeta,
            signedEthTx,
            transactionUpdateController().addTransactionToWatchList.bind(
              transactionUpdateController,
            ),
          ),
        beforeCheckPendingTransaction:
          beforeCheckPendingTransactionMMI.bind(this),
        beforePublish: beforeTransactionPublishMMI.bind(this),
        getAdditionalSignArguments: getAdditionalSignArgumentsMMI.bind(this),
        ///: END:ONLY_INCLUDE_IF
        // @ts-expect-error Missing types
        publish: (...args) =>
          // @ts-expect-error Missing types
          this.#publishSmartTransactionHook(
            controller,
            smartTransactionsController,
            controllerMessenger,
            getStateUI(),
            ...args,
          ),
      },
      // @ts-expect-error Missing types
      sign: (...args) => keyringController().signTransaction(...args),
      state: persistedState.TransactionController,
    });

    this.#addTransactionControllerListeners(
      controllerMessenger,
      getTransactionMetricsRequest,
    );

    return controller;
  }

  #getControllers(request: ControllerInitRequest) {
    return {
      gasFeeController: () =>
        request.getController<GasFeeController>(
          ControllerName.GasFeeController,
        ),
      keyringController: () =>
        request.getController<KeyringController>(
          ControllerName.KeyringController,
        ),
      networkController: () =>
        request.getController<NetworkController>(
          ControllerName.NetworkController,
        ),
      onboardingController: () =>
        request.getController<OnboardingController>(
          ControllerName.OnboardingController,
        ),
      preferencesController: () =>
        request.getController<PreferencesController>(
          ControllerName.PreferencesController,
        ),
      smartTransactionsController: () =>
        request.getController<SmartTransactionsController>(
          ControllerName.SmartTransactionsController,
        ),
      transactionUpdateController: () =>
        request.getController<TransactionUpdateController>(
          ControllerName.TransactionUpdateController,
        ),
    };
  }

  #publishSmartTransactionHook(
    transactionController: TransactionController,
    smartTransactionsController: SmartTransactionsController,
    controllerMessenger: ControllerMessenger<ActionConstraint, EventConstraint>,
    uiState: any,
    transactionMeta: TransactionMeta,
    signedTransactionInHex: Hex,
  ) {
    const isSmartTransaction = getIsSmartTransaction(uiState);

    if (!isSmartTransaction) {
      // Will cause TransactionController to publish to the RPC provider as normal.
      return { transactionHash: undefined };
    }

    const featureFlags = getFeatureFlagsByChainId(uiState);

    return submitSmartTransactionHook({
      transactionMeta,
      signedTransactionInHex,
      transactionController,
      smartTransactionsController,
      // @ts-expect-error Missing types
      controllerMessenger,
      isSmartTransaction,
      isHardwareWallet: isHardwareWallet(uiState),
      // @ts-expect-error Missing types
      featureFlags,
    });
  }

  #getExternalPendingTransactions(
    smartTransactionsController: SmartTransactionsController,
    address: string,
  ) {
    return smartTransactionsController.getTransactions({
      addressFrom: address,
      status: SmartTransactionStatuses.PENDING,
    });
  }

  #addTransactionControllerListeners(
    controllerMessenger: Messenger,
    getTransactionMetricsRequest: () => any,
  ) {
    const transactionMetricsRequest = getTransactionMetricsRequest();

    controllerMessenger.subscribe(
      'TransactionController:postTransactionBalanceUpdated',
      handlePostTransactionBalanceUpdate.bind(null, transactionMetricsRequest),
    );

    controllerMessenger.subscribe(
      'TransactionController:unapprovedTransactionAdded',
      (transactionMeta) =>
        handleTransactionAdded(transactionMetricsRequest, { transactionMeta }),
    );

    controllerMessenger.subscribe(
      'TransactionController:transactionApproved',
      handleTransactionApproved.bind(null, transactionMetricsRequest),
    );

    controllerMessenger.subscribe(
      'TransactionController:transactionDropped',
      handleTransactionDropped.bind(null, transactionMetricsRequest),
    );

    controllerMessenger.subscribe(
      'TransactionController:transactionConfirmed',
      // @ts-expect-error Missing types
      handleTransactionConfirmed.bind(null, transactionMetricsRequest),
    );

    controllerMessenger.subscribe(
      'TransactionController:transactionFailed',
      handleTransactionFailed.bind(null, transactionMetricsRequest),
    );

    controllerMessenger.subscribe(
      'TransactionController:transactionNewSwap',
      ({ transactionMeta }) =>
        // TODO: This can be called internally by the TransactionController
        // since Swaps Controller registers this action handler
        controllerMessenger.call(
          'SwapsController:setTradeTxId',
          transactionMeta.id,
        ),
    );

    controllerMessenger.subscribe(
      'TransactionController:transactionNewSwapApproval',
      ({ transactionMeta }) =>
        // TODO: This can be called internally by the TransactionController
        // since Swaps Controller registers this action handler
        controllerMessenger.call(
          'SwapsController:setApproveTxId',
          transactionMeta.id,
        ),
    );

    controllerMessenger.subscribe(
      'TransactionController:transactionRejected',
      handleTransactionRejected.bind(null, transactionMetricsRequest),
    );

    controllerMessenger.subscribe(
      'TransactionController:transactionSubmitted',
      handleTransactionSubmitted.bind(null, transactionMetricsRequest),
    );
  }
}
