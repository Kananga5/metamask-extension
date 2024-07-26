import React from 'react';
import { fireEvent, renderWithProvider, screen } from '../../../../test/jest';
import configureStore from '../../../store/store';
import testData from '../../../../.storybook/test-data';

import { NETWORK_TYPES } from '../../../../shared/constants/network';
import { DetectedTokensBanner } from '.';

describe('DetectedTokensBanner', () => {
  let setShowDetectedTokensSpy;

  const args = {};

  const mockStore = {
    ...testData,
    metamask: {
      ...testData.metamask,
      selectedNetworkClientId: NETWORK_TYPES.SEPOLIA,
    },
  };

  beforeEach(() => {
    setShowDetectedTokensSpy = jest.fn();
    args.actionButtonOnClick = setShowDetectedTokensSpy;
  });

  it('should render correctly', () => {
    const store = configureStore(mockStore);
    const { getByTestId, container } = renderWithProvider(
      <DetectedTokensBanner {...args} />,
      store,
    );

    expect(getByTestId('detected-token-banner')).toBeDefined();
    expect(container).toMatchSnapshot();
  });
  it('should render number of tokens detected link', () => {
    const store = configureStore(mockStore);
    renderWithProvider(<DetectedTokensBanner {...args} />, store);

    expect(
      screen.getByText('3 new tokens found in this account'),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByText('Import tokens'));
    expect(setShowDetectedTokensSpy).toHaveBeenCalled();
  });
});
