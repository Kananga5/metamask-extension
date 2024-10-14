import { connect } from 'react-redux';
import { withRouter } from 'react-router-dom';
import { compose } from 'redux';
import {
  getAllAccountsOnNetworkAreEmpty,
  getIsNetworkUsed,
  getNetworkIdentifier,
  getPreferences,
  isNetworkLoading,
  getTheme,
  getIsTestnet,
  getCurrentChainId,
  getShouldShowSeedPhraseReminder,
  isCurrentProviderCustom,
  ///: BEGIN:ONLY_INCLUDE_IF(keyring-snaps)
  getUnapprovedConfirmations,
  ///: END:ONLY_INCLUDE_IF
  getShowExtensionInFullSizeView,
  getSelectedAccount,
  getPermittedAccountsForCurrentTab,
  getSwitchedNetworkDetails,
  getNeverShowSwitchedNetworkMessage,
  getNetworkToAutomaticallySwitchTo,
  getNumberOfAllUnapprovedTransactionsAndMessages,
  getShowSurveyToast,
  getNewPrivacyPolicyToastShownDate,
  getShowPrivacyPolicyToast,
  getUseRequestQueue,
  getUseNftDetection,
  getNftDetectionEnablementToast,
  getCurrentNetwork,
} from '../../selectors';
import { getSmartTransactionsOptInStatus } from '../../../shared/modules/selectors';
import {
  lockMetamask,
  hideImportNftsModal,
  hideIpfsModal,
  setCurrentCurrency,
  setLastActiveTime,
  toggleAccountMenu,
  toggleNetworkMenu,
  hideImportTokensModal,
  hideDeprecatedNetworkModal,
  addPermittedAccount,
  setSurveyLinkLastClickedOrClosed,
  setNewPrivacyPolicyToastClickedOrClosed,
  setNewPrivacyPolicyToastShownDate,
  automaticallySwitchNetwork,
  clearSwitchedNetworkDetails,
  neverShowSwitchedNetworkMessage,
  setShowNftDetectionEnablementToast,
  ///: BEGIN:ONLY_INCLUDE_IF(keyring-snaps)
  hideKeyringRemovalResultModal,
  ///: END:ONLY_INCLUDE_IF
  setEditedNetwork,
  hidePermittedNetworkToast,
} from '../../store/actions';
import { pageChanged } from '../../ducks/history/history';
import { prepareToLeaveSwaps } from '../../ducks/swaps/swaps';
import { getSendStage } from '../../ducks/send';
import {
  getAlertEnabledness,
  getIsUnlocked,
  getProviderConfig,
} from '../../ducks/metamask/metamask';
import { DEFAULT_AUTO_LOCK_TIME_LIMIT } from '../../../shared/constants/preferences';
import Routes from './routes.component';

function mapStateToProps(state) {
  const { activeTab, appState } = state;
  const { alertOpen, alertMessage, isLoading, loadingMessage } = appState;
  const { autoLockTimeLimit = DEFAULT_AUTO_LOCK_TIME_LIMIT } =
    getPreferences(state);
  const { completedOnboarding } = state.metamask;

  // If there is more than one connected account to activeTabOrigin,
  // *BUT* the current account is not one of them, show the banner
  const allowShowAccountSetting = getAlertEnabledness(state).unconnectedAccount;
  const account = getSelectedAccount(state);
  const activeTabOrigin = activeTab?.origin;
  const connectedAccounts = getPermittedAccountsForCurrentTab(state);
  const currentNetwork = getCurrentNetwork(state);
  const showConnectAccountToast = Boolean(
    allowShowAccountSetting &&
      account &&
      activeTabOrigin &&
      connectedAccounts.length > 0 &&
      !connectedAccounts.find((address) => address === account.address),
  );

  const networkToAutomaticallySwitchTo =
    getNetworkToAutomaticallySwitchTo(state);
  const switchedNetworkDetails = getSwitchedNetworkDetails(state);

  const useNftDetection = getUseNftDetection(state);
  const showNftEnablementToast = getNftDetectionEnablementToast(state);

  return {
    alertOpen,
    alertMessage,
    account,
    showConnectAccountToast,
    activeTabOrigin,
    textDirection: state.metamask.textDirection,
    isLoading,
    loadingMessage,
    isUnlocked: getIsUnlocked(state),
    isNetworkLoading: isNetworkLoading(state),
    currentCurrency: state.metamask.currentCurrency,
    autoLockTimeLimit,
    browserEnvironmentOs: state.metamask.browserEnvironment?.os,
    browserEnvironmentContainter: state.metamask.browserEnvironment?.browser,
    providerId: getNetworkIdentifier(state),
    providerType: getProviderConfig(state).type,
    theme: getTheme(state),
    sendStage: getSendStage(state),
    isNetworkUsed: getIsNetworkUsed(state),
    allAccountsOnNetworkAreEmpty: getAllAccountsOnNetworkAreEmpty(state),
    isTestNet: getIsTestnet(state),
    showExtensionInFullSizeView: getShowExtensionInFullSizeView(state),
    smartTransactionsOptInStatus: getSmartTransactionsOptInStatus(state),
    currentChainId: getCurrentChainId(state),
    shouldShowSeedPhraseReminder: getShouldShowSeedPhraseReminder(state),
    forgottenPassword: state.metamask.forgottenPassword,
    isCurrentProviderCustom: isCurrentProviderCustom(state),
    completedOnboarding,
    isAccountMenuOpen: state.metamask.isAccountMenuOpen,
    isNetworkMenuOpen: state.metamask.isNetworkMenuOpen,
    isImportTokensModalOpen: state.appState.importTokensModalOpen,
    isBasicConfigurationModalOpen: state.appState.showBasicFunctionalityModal,
    isDeprecatedNetworkModalOpen: state.appState.deprecatedNetworkModalOpen,
    accountDetailsAddress: state.appState.accountDetailsAddress,
    isImportNftsModalOpen: state.appState.importNftsModal.open,
    isIpfsModalOpen: state.appState.showIpfsModalOpen,
    isPermittedNetworkToastOpen: state.appState.showPermittedNetworkToastOpen,
    switchedNetworkDetails,
    useNftDetection,
    showNftEnablementToast,
    networkToAutomaticallySwitchTo,
    currentNetwork,
    totalUnapprovedConfirmationCount:
      getNumberOfAllUnapprovedTransactionsAndMessages(state),
    neverShowSwitchedNetworkMessage: getNeverShowSwitchedNetworkMessage(state),
    currentExtensionPopupId: state.metamask.currentExtensionPopupId,
    useRequestQueue: getUseRequestQueue(state),
    newPrivacyPolicyToastShownDate: getNewPrivacyPolicyToastShownDate(state),
    showPrivacyPolicyToast: getShowPrivacyPolicyToast(state),
    showSurveyToast: getShowSurveyToast(state),
    ///: BEGIN:ONLY_INCLUDE_IF(keyring-snaps)
    isShowKeyringSnapRemovalResultModal:
      state.appState.showKeyringRemovalSnapModal,
    pendingConfirmations: getUnapprovedConfirmations(state),
    ///: END:ONLY_INCLUDE_IF
  };
}

function mapDispatchToProps(dispatch) {
  return {
    lockMetaMask: () => dispatch(lockMetamask(false)),
    setCurrentCurrencyToUSD: () => dispatch(setCurrentCurrency('usd')),
    setLastActiveTime: () => dispatch(setLastActiveTime()),
    pageChanged: (path) => dispatch(pageChanged(path)),
    prepareToLeaveSwaps: () => dispatch(prepareToLeaveSwaps()),
    toggleAccountMenu: () => dispatch(toggleAccountMenu()),
    toggleNetworkMenu: () => dispatch(toggleNetworkMenu()),
    hideImportNftsModal: () => dispatch(hideImportNftsModal()),
    hideIpfsModal: () => dispatch(hideIpfsModal()),
    hidePermittedNetworkToast: () => dispatch(hidePermittedNetworkToast()),
    hideImportTokensModal: () => dispatch(hideImportTokensModal()),
    hideDeprecatedNetworkModal: () => dispatch(hideDeprecatedNetworkModal()),
    addPermittedAccount: (activeTabOrigin, address) =>
      dispatch(addPermittedAccount(activeTabOrigin, address)),
    clearSwitchedNetworkDetails: () => dispatch(clearSwitchedNetworkDetails()),
    setSwitchedNetworkNeverShowMessage: () =>
      dispatch(neverShowSwitchedNetworkMessage()),
    automaticallySwitchNetwork: (networkId, selectedTabOrigin) =>
      dispatch(automaticallySwitchNetwork(networkId, selectedTabOrigin)),
    setSurveyLinkLastClickedOrClosed: (time) =>
      dispatch(setSurveyLinkLastClickedOrClosed(time)),
    setNewPrivacyPolicyToastClickedOrClosed: () =>
      dispatch(setNewPrivacyPolicyToastClickedOrClosed()),
    setNewPrivacyPolicyToastShownDate: (date) =>
      dispatch(setNewPrivacyPolicyToastShownDate(date)),
    clearEditedNetwork: () => dispatch(setEditedNetwork()),
    ///: BEGIN:ONLY_INCLUDE_IF(keyring-snaps)
    hideShowKeyringSnapRemovalResultModal: () =>
      dispatch(hideKeyringRemovalResultModal()),
    ///: END:ONLY_INCLUDE_IF
    setHideNftEnablementToast: (value) =>
      dispatch(setShowNftDetectionEnablementToast(value)),
  };
}

export default compose(
  withRouter,
  connect(mapStateToProps, mapDispatchToProps),
)(Routes);
